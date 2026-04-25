from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import exists, func, or_, select, tuple_
from sqlalchemy.orm import Session

from app.models.entities import (
    EnrollmentRecord,
    FormationTeacherRecord,
    MessageRecord,
    MessageThreadParticipantRecord,
    MessageThreadRecord,
    UserRecord,
)
from app.schemas.messaging import MessageThreadDetail, MessageThreadView, MessageUserView, MessageView
from app.services.auth import build_avatar_initials


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _admin_ids(db: Session) -> list[int]:
    return list(db.scalars(select(UserRecord.id).where(UserRecord.role == "admin", UserRecord.status == "active")))


def _can_message(db: Session, sender: UserRecord, recipient: UserRecord) -> bool:
    if sender.id == recipient.id or recipient.status != "active":
        return False
    if sender.role == "admin" or recipient.role == "admin":
        return True

    if sender.role == "student" and recipient.role == "teacher":
        return db.scalar(
            select(
                exists().where(
                    EnrollmentRecord.user_id == sender.id,
                    EnrollmentRecord.status == "active",
                    FormationTeacherRecord.formation_id == EnrollmentRecord.formation_id,
                    FormationTeacherRecord.teacher_id == recipient.id,
                )
            )
        )

    if sender.role == "teacher" and recipient.role == "student":
        return db.scalar(
            select(
                exists().where(
                    EnrollmentRecord.user_id == recipient.id,
                    EnrollmentRecord.status == "active",
                    FormationTeacherRecord.formation_id == EnrollmentRecord.formation_id,
                    FormationTeacherRecord.teacher_id == sender.id,
                )
            )
        )

    if sender.role == "student" and recipient.role == "student":
        sender_enrollments = select(
            EnrollmentRecord.formation_id,
            EnrollmentRecord.session_id,
        ).where(
            EnrollmentRecord.user_id == sender.id,
            EnrollmentRecord.status == "active",
            EnrollmentRecord.session_id.is_not(None),
        )
        return db.scalar(
            select(
                exists().where(
                    EnrollmentRecord.user_id == recipient.id,
                    EnrollmentRecord.status == "active",
                    EnrollmentRecord.session_id.is_not(None),
                    tuple_(EnrollmentRecord.formation_id, EnrollmentRecord.session_id).in_(sender_enrollments),
                )
            )
        )

    return False


def list_available_recipients(db: Session, user: UserRecord) -> list[MessageUserView]:
    if user.role == "admin":
        users = db.scalars(
            select(UserRecord)
            .where(UserRecord.id != user.id, UserRecord.status == "active")
            .order_by(UserRecord.role, UserRecord.full_name)
        ).all()
    elif user.role == "student":
        teacher_ids = select(FormationTeacherRecord.teacher_id).join(
            EnrollmentRecord,
            FormationTeacherRecord.formation_id == EnrollmentRecord.formation_id,
        ).where(EnrollmentRecord.user_id == user.id, EnrollmentRecord.status == "active")
        classmate_ids = select(EnrollmentRecord.user_id).where(
            EnrollmentRecord.status == "active",
            EnrollmentRecord.user_id != user.id,
            EnrollmentRecord.session_id.is_not(None),
            tuple_(EnrollmentRecord.formation_id, EnrollmentRecord.session_id).in_(
                select(EnrollmentRecord.formation_id, EnrollmentRecord.session_id).where(
                    EnrollmentRecord.user_id == user.id,
                    EnrollmentRecord.status == "active",
                    EnrollmentRecord.session_id.is_not(None),
                )
            ),
        )
        users = db.scalars(
            select(UserRecord)
            .where(
                UserRecord.status == "active",
                UserRecord.id != user.id,
                or_(
                    UserRecord.role == "admin",
                    UserRecord.id.in_(teacher_ids),
                    UserRecord.id.in_(classmate_ids),
                ),
            )
            .order_by(UserRecord.role, UserRecord.full_name)
        ).all()
    elif user.role == "teacher":
        student_ids = select(EnrollmentRecord.user_id).join(
            FormationTeacherRecord,
            FormationTeacherRecord.formation_id == EnrollmentRecord.formation_id,
        ).where(FormationTeacherRecord.teacher_id == user.id, EnrollmentRecord.status == "active")
        users = db.scalars(
            select(UserRecord)
            .where(
                UserRecord.status == "active",
                UserRecord.id != user.id,
                or_(UserRecord.role == "admin", UserRecord.id.in_(student_ids)),
            )
            .order_by(UserRecord.role, UserRecord.full_name)
        ).all()
    else:
        users = []

    return [_serialize_user(item) for item in users]


def _serialize_user(user: UserRecord) -> MessageUserView:
    return MessageUserView(
        id=user.id,
        full_name=user.full_name,
        role=user.role,
        avatar_url=user.avatar_url,
        avatar_initials=build_avatar_initials(user.full_name),
    )


def _serialize_message(db: Session, message: MessageRecord) -> MessageView:
    sender = db.get(UserRecord, message.sender_user_id) if message.sender_user_id else None
    return MessageView(
        id=message.id,
        thread_id=message.thread_id,
        sender_user_id=message.sender_user_id,
        sender_type=message.sender_type,  # type: ignore[arg-type]
        sender_name=sender.full_name if sender else "Académie des Créatifs",
        sender_role=sender.role if sender else None,
        sender_avatar_url=sender.avatar_url if sender else None,
        sender_avatar_initials=build_avatar_initials(sender.full_name) if sender else "AC",
        body=message.body,
        created_at=message.created_at,
    )


def _thread_participant_ids(db: Session, thread_id: int) -> list[int]:
    return list(
        db.scalars(
            select(MessageThreadParticipantRecord.user_id).where(
                MessageThreadParticipantRecord.thread_id == thread_id
            )
        )
    )


def _get_participant(db: Session, thread_id: int, user_id: int) -> MessageThreadParticipantRecord | None:
    return db.scalar(
        select(MessageThreadParticipantRecord).where(
            MessageThreadParticipantRecord.thread_id == thread_id,
            MessageThreadParticipantRecord.user_id == user_id,
        )
    )


def require_thread_access(db: Session, thread_id: int, user: UserRecord) -> MessageThreadParticipantRecord:
    participant = _get_participant(db, thread_id, user.id)
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable.")
    return participant


def _serialize_thread(db: Session, thread: MessageThreadRecord, user: UserRecord) -> MessageThreadView:
    participants = db.scalars(
        select(UserRecord)
        .join(MessageThreadParticipantRecord, MessageThreadParticipantRecord.user_id == UserRecord.id)
        .where(MessageThreadParticipantRecord.thread_id == thread.id)
        .order_by(UserRecord.full_name)
    ).all()
    participant = _get_participant(db, thread.id, user.id)
    last_message = db.scalar(
        select(MessageRecord)
        .where(MessageRecord.thread_id == thread.id, MessageRecord.deleted_at.is_(None))
        .order_by(MessageRecord.created_at.desc(), MessageRecord.id.desc())
        .limit(1)
    )
    unread_filters = [
        MessageRecord.thread_id == thread.id,
        MessageRecord.deleted_at.is_(None),
        or_(MessageRecord.sender_user_id.is_(None), MessageRecord.sender_user_id != user.id),
    ]
    if participant and participant.last_read_at is not None:
        unread_filters.append(MessageRecord.created_at > participant.last_read_at)
    unread_count = db.scalar(select(func.count(MessageRecord.id)).where(*unread_filters))
    return MessageThreadView(
        id=thread.id,
        subject=thread.subject,
        thread_type=thread.thread_type,  # type: ignore[arg-type]
        participants=[_serialize_user(item) for item in participants],
        last_message=_serialize_message(db, last_message) if last_message else None,
        unread_count=int(unread_count or 0),
        last_message_at=thread.last_message_at,
        updated_at=thread.updated_at,
    )


def list_threads(db: Session, user: UserRecord) -> list[MessageThreadView]:
    threads = db.scalars(
        select(MessageThreadRecord)
        .join(MessageThreadParticipantRecord, MessageThreadParticipantRecord.thread_id == MessageThreadRecord.id)
        .where(MessageThreadParticipantRecord.user_id == user.id)
        .order_by(MessageThreadRecord.last_message_at.desc().nullslast(), MessageThreadRecord.updated_at.desc())
    ).all()
    return [_serialize_thread(db, thread, user) for thread in threads]


def get_thread_detail(db: Session, thread_id: int, user: UserRecord) -> MessageThreadDetail:
    participant = require_thread_access(db, thread_id, user)
    participant.last_read_at = _now()
    db.add(participant)
    db.commit()
    thread = db.get(MessageThreadRecord, thread_id)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable.")
    messages = db.scalars(
        select(MessageRecord)
        .where(MessageRecord.thread_id == thread_id, MessageRecord.deleted_at.is_(None))
        .order_by(MessageRecord.created_at.asc(), MessageRecord.id.asc())
    ).all()
    base = _serialize_thread(db, thread, user)
    return MessageThreadDetail(**base.model_dump(), messages=[_serialize_message(db, msg) for msg in messages])


def unread_count(db: Session, user: UserRecord) -> int:
    rows = db.execute(
        select(MessageThreadParticipantRecord.thread_id, MessageThreadParticipantRecord.last_read_at).where(
            MessageThreadParticipantRecord.user_id == user.id
        )
    ).all()
    total = 0
    for thread_id, last_read_at in rows:
        unread_filters = [
            MessageRecord.thread_id == thread_id,
            MessageRecord.deleted_at.is_(None),
            or_(MessageRecord.sender_user_id.is_(None), MessageRecord.sender_user_id != user.id),
        ]
        if last_read_at is not None:
            unread_filters.append(MessageRecord.created_at > last_read_at)
        total += int(
            db.scalar(select(func.count(MessageRecord.id)).where(*unread_filters))
            or 0
        )
    return total


def create_thread(db: Session, user: UserRecord, participant_ids: list[int], subject: str, body: str) -> MessageThreadDetail:
    recipients = db.scalars(select(UserRecord).where(UserRecord.id.in_(set(participant_ids)))).all()
    if len(recipients) != len(set(participant_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Destinataire invalide.")
    for recipient in recipients:
        if not _can_message(db, user, recipient):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Destinataire non autorise.")

    now = _now()
    thread = MessageThreadRecord(
        subject=subject.strip() or "Nouvelle conversation",
        thread_type="support" if any(item.role == "admin" for item in recipients) else "direct",
        created_by_user_id=user.id,
        last_message_at=now,
    )
    db.add(thread)
    db.flush()
    for participant_user in [user, *recipients]:
        db.add(
            MessageThreadParticipantRecord(
                thread_id=thread.id,
                user_id=participant_user.id,
                role_snapshot=participant_user.role,
                last_read_at=now if participant_user.id == user.id else None,
            )
        )
    db.add(MessageRecord(thread_id=thread.id, sender_user_id=user.id, sender_type="user", body=body.strip()))
    db.commit()
    return get_thread_detail(db, thread.id, user)


def create_message(db: Session, thread_id: int, user: UserRecord, body: str) -> MessageView:
    participant = require_thread_access(db, thread_id, user)
    thread = db.get(MessageThreadRecord, thread_id)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation introuvable.")
    now = _now()
    message = MessageRecord(thread_id=thread_id, sender_user_id=user.id, sender_type="user", body=body.strip())
    thread.last_message_at = now
    participant.last_read_at = now
    db.add_all([message, thread, participant])
    db.commit()
    db.refresh(message)
    return _serialize_message(db, message)


def mark_thread_read(db: Session, thread_id: int, user: UserRecord) -> None:
    participant = require_thread_access(db, thread_id, user)
    participant.last_read_at = _now()
    db.add(participant)
    db.commit()


def participant_ids_for_thread(db: Session, thread_id: int) -> list[int]:
    return _thread_participant_ids(db, thread_id)


def ensure_welcome_message(db: Session, user: UserRecord) -> None:
    if user.role not in {"student", "teacher"}:
        return
    if user.welcome_message_sent_at is not None:
        return

    now = _now()
    admin_ids = _admin_ids(db)
    if not admin_ids:
        return

    if user.role == "student":
        subject = "Bienvenue dans votre espace étudiant"
        body = (
            "Bienvenue sur l'Académie des Créatifs. Votre espace étudiant regroupe vos cours, "
            "devoirs, résultats, paiements et échanges avec l'équipe pédagogique. "
            "Vous pouvez répondre ici si vous avez besoin d'aide."
        )
    else:
        subject = "Bienvenue dans votre espace enseignant"
        body = (
            "Bienvenue dans votre espace enseignant. Vous pouvez suivre vos sessions, vos étudiants, "
            "les devoirs et les ressources pédagogiques depuis votre tableau de bord. "
            "L'administration reste joignable dans cette conversation."
        )

    thread = MessageThreadRecord(
        subject=subject,
        thread_type="system",
        created_by_user_id=None,
        last_message_at=now,
    )
    db.add(thread)
    db.flush()
    db.add(MessageThreadParticipantRecord(thread_id=thread.id, user_id=user.id, role_snapshot=user.role))
    for admin_id in admin_ids:
        admin = db.get(UserRecord, admin_id)
        if admin:
            db.add(MessageThreadParticipantRecord(thread_id=thread.id, user_id=admin.id, role_snapshot=admin.role))
    db.add(MessageRecord(thread_id=thread.id, sender_user_id=None, sender_type="system", body=body))
    if user.first_login_at is None:
        user.first_login_at = now
    user.welcome_message_sent_at = now
    db.add(user)
    db.commit()
