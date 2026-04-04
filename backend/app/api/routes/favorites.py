from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.entities import UserRecord
from app.schemas.commerce import CartItemPayload, FavoriteSnapshot
from app.services.commerce import (
    add_item_to_favorites,
    list_favorite_snapshot,
    remove_item_from_favorites,
)

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=FavoriteSnapshot)
def read_favorites(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> FavoriteSnapshot:
    return list_favorite_snapshot(db, current_user)


@router.post("/items", response_model=FavoriteSnapshot)
def add_favorite_item(
    payload: CartItemPayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> FavoriteSnapshot:
    return add_item_to_favorites(db, current_user, payload.formation_slug)


@router.delete("/items/{formation_slug}", response_model=FavoriteSnapshot)
def delete_favorite_item(
    formation_slug: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> FavoriteSnapshot:
    return remove_item_from_favorites(db, current_user, formation_slug)
