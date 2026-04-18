from __future__ import annotations

import hmac
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import utc_now
from app.db.session import get_db
from app.models.entities import PaymentRecord
from app.services.order_confirmations import send_order_confirmation_for_orders
from app.services.order_access import sync_order_enrollment_access
from app.services.payments import refresh_payment_states
from app.services.tara_money import (
    extract_order_references_from_product_id,
    extract_tara_product_id,
    extract_tara_webhook_status,
    is_tara_failure_status,
    is_tara_success_status,
)

router = APIRouter(prefix="/tara", tags=["tara"])


def _first_open_payment(db: Session, order_reference: str) -> PaymentRecord | None:
    return db.scalar(
        select(PaymentRecord)
        .where(
            PaymentRecord.order_reference == order_reference,
            PaymentRecord.status.in_(("pending", "late")),
        )
        .order_by(PaymentRecord.installment_number.nullsfirst(), PaymentRecord.id.asc())
    )


@router.post("/webhook")
def receive_tara_webhook(
    payload: dict[str, Any] = Body(default_factory=dict),
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if settings.tara_webhook_secret and not (
        token and hmac.compare_digest(token, settings.tara_webhook_secret)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Webhook Tara non autorise.",
        )

    webhook_status = extract_tara_webhook_status(payload)
    product_id = extract_tara_product_id(payload)
    order_references = extract_order_references_from_product_id(product_id)
    matched_orders: list[str] = []
    newly_confirmed_orders: list[str] = []

    for order_reference in order_references:
        payment = _first_open_payment(db, order_reference)
        if payment is None:
            continue

        if is_tara_success_status(webhook_status):
            was_confirmed = payment.status == "confirmed"
            payment.status = "confirmed"
            if payment.paid_at is None:
                payment.paid_at = utc_now()
            if not was_confirmed:
                newly_confirmed_orders.append(order_reference)
        elif is_tara_failure_status(webhook_status):
            payment.status = "failed"
            payment.paid_at = None
        else:
            continue

        db.add(payment)
        db.flush()
        refresh_payment_states(db, order_reference=order_reference)
        sync_order_enrollment_access(db, order_reference)
        matched_orders.append(order_reference)

    db.commit()
    if newly_confirmed_orders:
        send_order_confirmation_for_orders(db, newly_confirmed_orders)
    return {
        "status": "received",
        "event_status": webhook_status or "unknown",
        "matched_orders": matched_orders,
        "newly_confirmed_orders": newly_confirmed_orders,
    }
