import hashlib
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.core.security import hash_password
from app.models.entities import PasswordResetRecord, UserRecord
from app.schemas.auth import AuthResponse, LoginPayload, RegisterPayload
from app.services.auth import (
    authenticate_user,
    create_user,
    create_user_access_token,
    serialize_auth_user,
)
from app.services.email import send_password_reset_email, send_welcome_email
from app.services.messaging import ensure_welcome_message

router = APIRouter(prefix="/auth", tags=["auth"])


def set_auth_cookie(response: Response, token: str, remember_me: bool) -> None:
    max_age = 60 * 60 * 24 * (30 if remember_me else 1)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        samesite=settings.session_cookie_samesite,
        secure=settings.session_cookie_secure,
        max_age=max_age,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        samesite=settings.session_cookie_samesite,
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterPayload,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    try:
        user = create_user(db, payload)
    except ValueError as error:
        field_name = str(error)
        if field_name == "email":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"field": "email", "message": "Cette adresse e-mail est deja utilisee."},
            ) from None
        if field_name == "phone":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"field": "phone", "message": "Ce numero de telephone est deja utilise."},
            ) from None
        raise

    access_token, expires_at = create_user_access_token(user, remember_me=True)
    set_auth_cookie(response, access_token, remember_me=True)
    send_welcome_email(user.email, user.full_name)
    return AuthResponse(
        message="Compte cree avec succes.",
        user=serialize_auth_user(user),
        access_token=access_token,
        expires_at=expires_at,
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginPayload,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    user = authenticate_user(db, payload)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Adresse e-mail ou mot de passe incorrect.",
        )

    access_token, expires_at = create_user_access_token(user, remember_me=payload.remember_me)
    set_auth_cookie(response, access_token, remember_me=payload.remember_me)
    ensure_welcome_message(db, user)
    return AuthResponse(
        message="Connexion reussie.",
        user=serialize_auth_user(user),
        access_token=access_token,
        expires_at=expires_at,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    db: Session = Depends(get_db),
) -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_auth_cookie(response)
    return response


@router.get("/me", response_model=AuthResponse)
def read_me(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> AuthResponse:
    ensure_welcome_message(db, current_user)
    access_token, expires_at = create_user_access_token(current_user, remember_me=False)
    return AuthResponse(
        message="Session active.",
        user=serialize_auth_user(current_user),
        access_token=access_token,
        expires_at=expires_at,
    )


# ── Password Reset ────────────────────────────────────────────────

class ForgotPasswordPayload(BaseModel):
    email: str


class ResetPasswordPayload(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères.")
        return v


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
def forgot_password(
    payload: ForgotPasswordPayload,
    db: Session = Depends(get_db),
) -> None:
    """Always returns 204 to avoid user enumeration."""
    user = db.query(UserRecord).filter(UserRecord.email == payload.email.strip().lower()).first()
    if not user:
        return

    # Invalidate any existing unused tokens for this user
    db.query(PasswordResetRecord).filter(
        PasswordResetRecord.user_id == user.id,
        PasswordResetRecord.used_at.is_(None),
    ).delete()

    raw_token = os.urandom(32).hex()
    record = PasswordResetRecord(
        user_id=user.id,
        token_hash=_hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    db.add(record)
    db.commit()

    reset_link = f"{settings.frontend_url}/reset-password?token={raw_token}"
    send_password_reset_email(user.email, user.full_name, reset_link)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    payload: ResetPasswordPayload,
    db: Session = Depends(get_db),
) -> None:
    token_hash = _hash_token(payload.token)
    record = (
        db.query(PasswordResetRecord)
        .filter(PasswordResetRecord.token_hash == token_hash)
        .first()
    )

    now = datetime.now(timezone.utc)

    if not record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lien invalide ou expiré.")
    if record.used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce lien a déjà été utilisé.")
    if record.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce lien a expiré.")

    user = db.query(UserRecord).filter(UserRecord.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lien invalide.")

    user.password_hash = hash_password(payload.new_password)
    record.used_at = now
    db.commit()
