from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.schemas.catalog import (
    AdminFormationSessionCreate,
    AdminFormationItem,
    AdminDashboardOverview,
    AdminFormationCreate,
    AdminFormationUpdate,
    AdminOnsiteSessionItem,
    AdminOnsiteSessionUpdate,
    AdminOrderItem,
    AdminOrderUpdate,
    AdminPaymentItem,
    AdminPaymentUpdate,
    AdminUserItem,
    AdminUserUpdate,
)
from app.services.catalog import (
    create_admin_onsite_session,
    create_catalog_entry,
    get_admin_overview,
    list_admin_catalog_items,
    list_admin_onsite_sessions,
    list_admin_orders,
    list_admin_payments,
    list_admin_users,
    update_admin_onsite_session,
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


@router.get("/stats/overview", response_model=AdminDashboardOverview)
def read_admin_overview(db: Session = Depends(get_db)) -> AdminDashboardOverview:
    return get_admin_overview(db)


@router.get("/users", response_model=list[AdminUserItem])
def read_admin_users(db: Session = Depends(get_db)) -> list[AdminUserItem]:
    return list_admin_users(db)


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
