from collections.abc import Callable

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.entities import UserRecord
from app.services.auth import get_user_from_access_token, get_user_from_session_token


bearer_scheme = HTTPBearer(auto_error=False)


def get_session_cookie(
    ac_session: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> str | None:
    return ac_session


def get_current_user_optional(
    db: Session = Depends(get_db),
    bearer_credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session_token: str | None = Depends(get_session_cookie),
) -> UserRecord | None:
    if bearer_credentials and bearer_credentials.scheme.lower() == "bearer":
        user = get_user_from_access_token(db, bearer_credentials.credentials)
        if user is not None:
            return user

    if not session_token:
        return None

    return get_user_from_access_token(db, session_token) or get_user_from_session_token(
        db, session_token
    )


def get_current_user(
    current_user: UserRecord | None = Depends(get_current_user_optional),
) -> UserRecord:
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise.",
        )
    return current_user


def require_roles(*roles: str) -> Callable[[UserRecord], UserRecord]:
    def dependency(current_user: UserRecord = Depends(get_current_user)) -> UserRecord:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse pour ce role.",
            )
        return current_user

    return dependency
