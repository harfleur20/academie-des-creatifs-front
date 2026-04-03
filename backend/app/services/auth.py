from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    generate_session_token,
    hash_password,
    hash_session_token,
    session_expiration,
    utc_now,
    verify_password,
)
from app.models.entities import AuthSessionRecord, UserRecord
from app.schemas.auth import AuthUser, LoginPayload, RegisterPayload


def build_avatar_initials(full_name: str) -> str:
    parts = [part for part in full_name.split() if part]
    if not parts:
        return "AC"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[1][0]}".upper()


def get_dashboard_path(role: str) -> str:
    if role == "admin":
        return "/admin"
    if role == "teacher":
        return "/espace/enseignant"
    return "/espace/etudiant"


def serialize_auth_user(user: UserRecord) -> AuthUser:
    return AuthUser(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        role=user.role,  # type: ignore[arg-type]
        status=user.status,
        avatar_initials=build_avatar_initials(user.full_name),
        dashboard_path=get_dashboard_path(user.role),
    )


def get_user_by_email(db: Session, email: str) -> UserRecord | None:
    return db.scalar(select(UserRecord).where(UserRecord.email == email.lower()))


def create_user(db: Session, payload: RegisterPayload) -> UserRecord:
    existing_by_email = get_user_by_email(db, payload.email)
    if existing_by_email is not None:
        raise ValueError("email")

    existing_by_phone = db.scalar(select(UserRecord).where(UserRecord.phone == payload.phone))
    if existing_by_phone is not None:
        raise ValueError("phone")

    user = UserRecord(
        full_name=payload.full_name.strip(),
        email=payload.email.strip().lower(),
        phone=payload.phone.strip(),
        password_hash=hash_password(payload.password),
        role="student",
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: LoginPayload) -> UserRecord | None:
    user = get_user_by_email(db, payload.email)
    if user is None or user.status != "active":
        return None

    if not verify_password(payload.password, user.password_hash):
        return None

    return user


def create_user_session(
    db: Session,
    user: UserRecord,
    remember_me: bool,
) -> tuple[str, AuthSessionRecord]:
    raw_token = generate_session_token()
    session = AuthSessionRecord(
        user_id=user.id,
        token_hash=hash_session_token(raw_token),
        expires_at=session_expiration(remember_me),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return raw_token, session


def get_user_from_session_token(db: Session, token: str) -> UserRecord | None:
    token_hash = hash_session_token(token)
    session = db.scalar(
        select(AuthSessionRecord).where(
            AuthSessionRecord.token_hash == token_hash,
            AuthSessionRecord.revoked_at.is_(None),
            AuthSessionRecord.expires_at > utc_now(),
        )
    )
    if session is None:
        return None

    user = db.get(UserRecord, session.user_id)
    if user is None or user.status != "active":
        return None

    return user


def revoke_session(db: Session, token: str) -> None:
    token_hash = hash_session_token(token)
    session = db.scalar(select(AuthSessionRecord).where(AuthSessionRecord.token_hash == token_hash))
    if session is None or session.revoked_at is not None:
        return

    session.revoked_at = utc_now()
    db.add(session)
    db.commit()
