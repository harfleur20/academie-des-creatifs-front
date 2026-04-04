from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import secrets

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings


password_hasher = PasswordHasher()


def utc_now() -> datetime:
    return datetime.now(UTC)


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False

    try:
        return password_hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def generate_session_token() -> str:
    return secrets.token_urlsafe(48)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def session_expiration(remember_me: bool) -> datetime:
    if remember_me:
        return utc_now() + timedelta(days=30)
    return utc_now() + timedelta(days=1)


def access_token_expiration(remember_me: bool) -> datetime:
    if remember_me:
        return utc_now() + timedelta(days=settings.jwt_access_token_remember_days)
    return utc_now() + timedelta(minutes=settings.jwt_access_token_minutes)


def create_access_token(user_id: int, role: str, remember_me: bool) -> tuple[str, datetime]:
    expires_at = access_token_expiration(remember_me)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iss": settings.jwt_issuer,
        "iat": int(utc_now().timestamp()),
        "exp": int(expires_at.timestamp()),
        "type": "access",
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return token, expires_at


def decode_access_token(token: str) -> dict[str, str | int] | None:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
        )
    except jwt.PyJWTError:
        return None

    if payload.get("type") != "access":
        return None

    return payload
