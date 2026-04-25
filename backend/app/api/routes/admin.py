import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.entities import AdminInvitationRecord, UserRecord
from app.services.auth import create_user_access_token, serialize_auth_user
from app.services.email import send_admin_invitation_email
from app.schemas.catalog import (
    AdminCourseDayStatusUpdate,
    AdminEnrollmentItem,
    AdminEnrollmentUpdate,
    AdminFormationSessionCreate,
    AdminFormationItem,
    AdminDashboardOverview,
    AdminFormationCreate,
    AdminFormationUpdate,
    AdminMissedCourseDay,
    AdminOnsiteSessionItem,
    AdminOnsiteSessionUpdate,
    AdminOrderItem,
    AdminOrderUpdate,
    AdminPaymentItem,
    AdminPaymentUpdate,
    AdminPerformanceOverview,
    AdminUploadedAsset,
    AdminUserItem,
    AdminUserUpdate,
)
from app.services.catalog import (
    admin_patch_course_day_status,
    create_admin_onsite_session,
    create_catalog_entry,
    get_admin_performance,
    get_admin_overview,
    list_admin_enrollments,
    list_admin_catalog_items,
    list_admin_missed_course_days,
    list_admin_onsite_sessions,
    list_admin_orders,
    list_admin_payments,
    list_admin_users,
    remind_admin_payment,
    update_admin_onsite_session,
    update_admin_enrollment,
    update_admin_order,
    update_admin_payment,
    update_admin_user,
    update_catalog_entry,
)

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_roles("admin"))],
)

UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "uploads" / "admin-media"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

# ── Public router for invitation acceptance (no auth required) ──────────────
public_router = APIRouter(tags=["admin-invitations"])

ADMIN_INVITE_EXPIRY_DAYS = 7


# ── Schemas ─────────────────────────────────────────────────────────────────
class AdminInviteCreate(BaseModel):
    email: EmailStr
    full_name: str


class AdminInviteView(BaseModel):
    id: int
    email: str
    full_name: str
    token: str
    status: str
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminInviteAccept(BaseModel):
    password: str


# ── Helpers ──────────────────────────────────────────────────────────────────
def _serialize_admin_invite(inv: AdminInvitationRecord) -> AdminInviteView:
    return AdminInviteView(
        id=inv.id,
        email=inv.email,
        full_name=inv.full_name,
        token=inv.token,
        status="expired" if (inv.status == "pending" and inv.expires_at < datetime.now(timezone.utc)) else inv.status,
        expires_at=inv.expires_at,
        created_at=inv.created_at,
    )


# ── Admin-protected routes ────────────────────────────────────────────────────
@router.post("/invitations", response_model=AdminInviteView, status_code=201)
def create_admin_invitation(
    payload: AdminInviteCreate,
    db: Session = Depends(get_db),
) -> AdminInviteView:
    if db.scalar(select(UserRecord).where(UserRecord.email == payload.email)):
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email.")
    pending = db.scalar(
        select(AdminInvitationRecord).where(
            AdminInvitationRecord.email == payload.email,
            AdminInvitationRecord.status == "pending",
        )
    )
    if pending and pending.expires_at > datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Une invitation est déjà en attente pour cet email.")

    token = secrets.token_urlsafe(32)
    inv = AdminInvitationRecord(
        token=token,
        email=payload.email,
        full_name=payload.full_name,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=ADMIN_INVITE_EXPIRY_DAYS),
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    try:
        send_admin_invitation_email(payload.email, payload.full_name, token)
    except Exception:
        pass
    return _serialize_admin_invite(inv)


@router.get("/invitations", response_model=list[AdminInviteView])
def list_admin_invitations(db: Session = Depends(get_db)) -> list[AdminInviteView]:
    invs = db.scalars(
        select(AdminInvitationRecord).order_by(AdminInvitationRecord.created_at.desc())
    ).all()
    return [_serialize_admin_invite(i) for i in invs]


@router.post("/invitations/{invitation_id}/revoke", response_model=AdminInviteView)
def revoke_admin_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
) -> AdminInviteView:
    inv = db.get(AdminInvitationRecord, invitation_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")
    if inv.status == "accepted":
        raise HTTPException(status_code=400, detail="Cette invitation a déjà été acceptée.")
    inv.status = "cancelled"
    db.commit()
    db.refresh(inv)
    return _serialize_admin_invite(inv)


# ── Public routes (no auth) ───────────────────────────────────────────────────
@public_router.get("/invitations/admin/{token}", response_model=AdminInviteView)
def get_admin_invitation(token: str, db: Session = Depends(get_db)) -> AdminInviteView:
    inv = db.scalar(select(AdminInvitationRecord).where(AdminInvitationRecord.token == token))
    if inv is None:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")
    return _serialize_admin_invite(inv)


@public_router.post("/invitations/admin/{token}/accept")
def accept_admin_invitation(
    token: str,
    payload: AdminInviteAccept,
    response: Response,
    db: Session = Depends(get_db),
) -> dict:
    inv = db.scalar(select(AdminInvitationRecord).where(AdminInvitationRecord.token == token))
    if inv is None:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")
    if inv.status != "pending":
        raise HTTPException(status_code=400, detail="Cette invitation n'est plus valide.")
    if inv.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Cette invitation a expiré.")
    if db.scalar(select(UserRecord).where(UserRecord.email == inv.email)):
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email.")

    user = UserRecord(
        email=inv.email,
        full_name=inv.full_name,
        password_hash=hash_password(payload.password),
        role="admin",
        status="active",
    )
    db.add(user)
    inv.status = "accepted"
    db.commit()
    db.refresh(user)

    access_token = create_user_access_token(user)
    from app.core.config import settings
    response.set_cookie(
        key=settings.session_cookie_name,
        value=access_token,
        httponly=True,
        samesite=settings.session_cookie_samesite,
        secure=settings.session_cookie_secure,
        max_age=60 * 60 * 24 * 30,
        path="/",
    )
    return {"user": serialize_auth_user(user)}
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogg", ".mov"}
IMAGE_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/avif",
}
VIDEO_CONTENT_TYPES = {
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_VIDEO_BYTES = 50 * 1024 * 1024


@router.get("/formations", response_model=list[AdminFormationItem])
def list_admin_formations(db: Session = Depends(get_db)) -> list[AdminFormationItem]:
    return list_admin_catalog_items(db)


@router.post("/formations", response_model=AdminFormationItem, status_code=201)
def create_admin_formation(
    payload: AdminFormationCreate,
    db: Session = Depends(get_db),
) -> AdminFormationItem:
    try:
        return create_catalog_entry(db, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.patch("/formations/{slug}", response_model=AdminFormationItem)
def patch_admin_formation(
    slug: str,
    payload: AdminFormationUpdate,
    db: Session = Depends(get_db),
) -> AdminFormationItem:
    try:
        updated = update_catalog_entry(db, slug, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if updated is None:
        raise HTTPException(status_code=404, detail="Formation introuvable.")
    return updated


@router.post("/uploads", response_model=AdminUploadedAsset, status_code=201)
async def upload_admin_asset(
    request: Request,
    filename: str = Query(min_length=1, max_length=255),
) -> AdminUploadedAsset:
    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="Aucun fichier recu.")

    original_name = Path(filename).name.strip()
    extension = Path(original_name).suffix.lower()
    content_type = request.headers.get("content-type", "application/octet-stream").split(";")[0].strip().lower()

    if extension in ALLOWED_IMAGE_EXTENSIONS:
        if content_type not in IMAGE_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Type de fichier image invalide.")
        max_bytes = MAX_IMAGE_BYTES
    elif extension in ALLOWED_VIDEO_EXTENSIONS:
        if content_type not in VIDEO_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Type de fichier video invalide.")
        max_bytes = MAX_VIDEO_BYTES
    else:
        raise HTTPException(status_code=400, detail="Extension de fichier non prise en charge.")

    if len(raw) > max_bytes:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux pour cet upload.")

    stored_name = f"{uuid4().hex}{extension}"
    destination = UPLOAD_ROOT / stored_name
    destination.write_bytes(raw)

    public_path = f"/uploads/admin-media/{stored_name}"
    public_url = f"{str(request.base_url).rstrip('/')}{public_path}"
    return AdminUploadedAsset(
        filename=original_name,
        path=public_path,
        public_url=public_url,
        content_type=content_type,
        size=len(raw),
    )


@router.get("/stats/overview", response_model=AdminDashboardOverview)
def read_admin_overview(db: Session = Depends(get_db)) -> AdminDashboardOverview:
    return get_admin_overview(db)


@router.get("/stats/performance", response_model=AdminPerformanceOverview)
def read_admin_performance(db: Session = Depends(get_db)) -> AdminPerformanceOverview:
    return get_admin_performance(db)


@router.get("/users", response_model=list[AdminUserItem])
def read_admin_users(db: Session = Depends(get_db)) -> list[AdminUserItem]:
    return list_admin_users(db)


@router.get("/enrollments", response_model=list[AdminEnrollmentItem])
def read_admin_enrollments(db: Session = Depends(get_db)) -> list[AdminEnrollmentItem]:
    return list_admin_enrollments(db)


@router.patch("/users/{user_id}", response_model=AdminUserItem)
def patch_admin_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
) -> AdminUserItem:
    updated = update_admin_user(db, user_id, payload)
    if updated is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    return updated


@router.patch("/enrollments/{enrollment_id}", response_model=AdminEnrollmentItem)
def patch_admin_enrollment(
    enrollment_id: int,
    payload: AdminEnrollmentUpdate,
    db: Session = Depends(get_db),
) -> AdminEnrollmentItem:
    try:
        updated = update_admin_enrollment(db, enrollment_id, payload)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if updated is None:
        raise HTTPException(status_code=404, detail="Inscription introuvable.")
    return updated


@router.get("/onsite-sessions", response_model=list[AdminOnsiteSessionItem])
def read_admin_onsite_sessions(
    db: Session = Depends(get_db),
) -> list[AdminOnsiteSessionItem]:
    return list_admin_onsite_sessions(db)


@router.post("/onsite-sessions", response_model=AdminOnsiteSessionItem, status_code=201)
def post_admin_onsite_session(
    payload: AdminFormationSessionCreate,
    db: Session = Depends(get_db),
) -> AdminOnsiteSessionItem:
    try:
        return create_admin_onsite_session(db, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.patch("/onsite-sessions/{session_id}", response_model=AdminOnsiteSessionItem)
def patch_admin_onsite_session(
    session_id: int,
    payload: AdminOnsiteSessionUpdate,
    db: Session = Depends(get_db),
) -> AdminOnsiteSessionItem:
    try:
        updated = update_admin_onsite_session(db, session_id, payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if updated is None:
        raise HTTPException(status_code=404, detail="Session introuvable.")
    return updated


@router.get("/orders", response_model=list[AdminOrderItem])
def read_admin_orders(db: Session = Depends(get_db)) -> list[AdminOrderItem]:
    return list_admin_orders(db)


@router.patch("/orders/{order_id}", response_model=AdminOrderItem)
def patch_admin_order(
    order_id: int,
    payload: AdminOrderUpdate,
    db: Session = Depends(get_db),
) -> AdminOrderItem:
    updated = update_admin_order(db, order_id, payload)
    if updated is None:
        raise HTTPException(status_code=404, detail="Commande introuvable.")
    return updated


@router.get("/payments", response_model=list[AdminPaymentItem])
def read_admin_payments(db: Session = Depends(get_db)) -> list[AdminPaymentItem]:
    return list_admin_payments(db)


@router.patch("/payments/{payment_id}", response_model=AdminPaymentItem)
def patch_admin_payment(
    payment_id: int,
    payload: AdminPaymentUpdate,
    db: Session = Depends(get_db),
) -> AdminPaymentItem:
    updated = update_admin_payment(db, payment_id, payload)
    if updated is None:
        raise HTTPException(status_code=404, detail="Paiement introuvable.")
    return updated


@router.post("/payments/{payment_id}/reminders", response_model=AdminPaymentItem)
def post_admin_payment_reminder(
    payment_id: int,
    db: Session = Depends(get_db),
) -> AdminPaymentItem:
    try:
        updated = remind_admin_payment(db, payment_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if updated is None:
        raise HTTPException(status_code=404, detail="Paiement introuvable.")
    return updated


@router.get("/missed-course-days", response_model=list[AdminMissedCourseDay])
def get_missed_course_days(db: Session = Depends(get_db)) -> list[AdminMissedCourseDay]:
    return list_admin_missed_course_days(db)


@router.patch("/course-days/{course_day_id}/status", status_code=204)
def patch_course_day_status(
    course_day_id: int,
    payload: AdminCourseDayStatusUpdate,
    db: Session = Depends(get_db),
) -> None:
    try:
        admin_patch_course_day_status(db, course_day_id, payload)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
