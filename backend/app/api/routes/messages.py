from __future__ import annotations

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.db.session import SessionLocal, get_db
from app.models.entities import UserRecord
from app.schemas.messaging import (
    CreateMessagePayload,
    CreateThreadPayload,
    MessageThreadDetail,
    MessageThreadView,
    MessageUserView,
    MessageView,
    MessagingSummary,
)
from app.services.auth import get_user_from_access_token, get_user_from_session_token
from app.services.messaging import (
    create_message,
    create_thread,
    get_thread_detail,
    list_available_recipients,
    list_threads,
    mark_thread_read,
    participant_ids_for_thread,
    unread_count,
)
from app.services.realtime import messaging_manager


router = APIRouter(prefix="/messages", tags=["messages"])


async def _broadcast_summary(db: Session, user_ids: list[int]) -> None:
    for user_id in set(user_ids):
        user = db.get(UserRecord, user_id)
        if user:
            await messaging_manager.send_to_user(
                user_id,
                {"type": "messages.summary", "unread_count": unread_count(db, user)},
            )


@router.get("/recipients", response_model=list[MessageUserView])
def read_recipients(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[MessageUserView]:
    return list_available_recipients(db, current_user)


@router.get("/summary", response_model=MessagingSummary)
def read_summary(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> MessagingSummary:
    return MessagingSummary(unread_count=unread_count(db, current_user))


@router.get("/threads", response_model=list[MessageThreadView])
def read_threads(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[MessageThreadView]:
    return list_threads(db, current_user)


@router.post("/threads", response_model=MessageThreadDetail, status_code=status.HTTP_201_CREATED)
async def create_message_thread(
    payload: CreateThreadPayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> MessageThreadDetail:
    thread = create_thread(db, current_user, payload.participant_ids, payload.subject, payload.body)
    participant_ids = participant_ids_for_thread(db, thread.id)
    for user_id in participant_ids:
        await messaging_manager.send_to_user(user_id, {"type": "messages.thread_created", "thread_id": thread.id})
    await _broadcast_summary(db, participant_ids)
    return thread


@router.get("/threads/{thread_id}", response_model=MessageThreadDetail)
async def read_thread(
    thread_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> MessageThreadDetail:
    detail = get_thread_detail(db, thread_id, current_user)
    await _broadcast_summary(db, [current_user.id])
    return detail


@router.post("/threads/{thread_id}/messages", response_model=MessageView, status_code=status.HTTP_201_CREATED)
async def create_thread_message(
    thread_id: int,
    payload: CreateMessagePayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> MessageView:
    message = create_message(db, thread_id, current_user, payload.body)
    participant_ids = participant_ids_for_thread(db, thread_id)
    for user_id in participant_ids:
        await messaging_manager.send_to_user(
            user_id,
            {
                "type": "messages.message_created",
                "thread_id": thread_id,
                "message": message.model_dump(mode="json"),
            },
        )
    await _broadcast_summary(db, participant_ids)
    return message


@router.patch("/threads/{thread_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    thread_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> None:
    mark_thread_read(db, thread_id, current_user)
    await _broadcast_summary(db, [current_user.id])


def _websocket_user(websocket: WebSocket, db: Session) -> UserRecord | None:
    token = websocket.query_params.get("token")
    if token:
        user = get_user_from_access_token(db, token)
        if user:
            return user

    cookie_token = websocket.cookies.get(settings.session_cookie_name)
    if not cookie_token:
        return None
    return get_user_from_access_token(db, cookie_token) or get_user_from_session_token(db, cookie_token)


@router.websocket("/ws")
async def messages_websocket(websocket: WebSocket) -> None:
    db = SessionLocal()
    user = _websocket_user(websocket, db)
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        db.close()
        return

    await messaging_manager.connect(user.id, websocket)
    try:
        await websocket.send_json({"type": "messages.summary", "unread_count": unread_count(db, user)})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        messaging_manager.disconnect(user.id, websocket)
        db.close()
