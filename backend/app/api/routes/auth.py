from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_session_cookie
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import UserRecord
from app.schemas.auth import AuthResponse, LoginPayload, RegisterPayload
from app.services.auth import (
    authenticate_user,
    create_user,
    create_user_session,
    revoke_session,
    serialize_auth_user,
)

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

    raw_token, _ = create_user_session(db, user, remember_me=True)
    set_auth_cookie(response, raw_token, remember_me=True)
    return AuthResponse(
        message="Compte cree avec succes.",
        user=serialize_auth_user(user),
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

    raw_token, _ = create_user_session(db, user, remember_me=payload.remember_me)
    set_auth_cookie(response, raw_token, remember_me=payload.remember_me)
    return AuthResponse(
        message="Connexion reussie.",
        user=serialize_auth_user(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    db: Session = Depends(get_db),
    session_token: str | None = Depends(get_session_cookie),
) -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    if session_token:
        revoke_session(db, session_token)
    clear_auth_cookie(response)
    return response


@router.get("/me", response_model=AuthResponse)
def read_me(current_user: UserRecord = Depends(get_current_user)) -> AuthResponse:
    return AuthResponse(
        message="Session active.",
        user=serialize_auth_user(current_user),
    )
