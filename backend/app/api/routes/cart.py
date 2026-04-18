from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.entities import UserRecord
from app.schemas.commerce import CartItemPayload, CartSnapshot, CheckoutPayload, CheckoutResponse
from app.services.commerce import (
    add_item_to_cart,
    checkout_cart,
    list_cart_snapshot,
    remove_item_from_cart,
)

router = APIRouter(prefix="/cart", tags=["cart"])


@router.get("", response_model=CartSnapshot)
def read_cart(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> CartSnapshot:
    return list_cart_snapshot(db, current_user)


@router.post("/items", response_model=CartSnapshot)
def add_cart_item(
    payload: CartItemPayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> CartSnapshot:
    return add_item_to_cart(db, current_user, payload.formation_slug)


@router.delete("/items/{formation_slug}", response_model=CartSnapshot)
def delete_cart_item(
    formation_slug: str,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> CartSnapshot:
    return remove_item_from_cart(db, current_user, formation_slug)


@router.post("/checkout", response_model=CheckoutResponse)
def checkout(
    payload: CheckoutPayload = Body(default_factory=CheckoutPayload),
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> CheckoutResponse:
    return checkout_cart(
        db,
        current_user,
        payload.installment_slugs,
        payload.use_installments,
        payload.payment_provider,
    )
