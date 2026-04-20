from __future__ import annotations

from importlib import import_module

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import OrderRecord, PaymentRecord, UserRecord
from app.services.order_access import sync_order_enrollment_access
from app.services.order_confirmations import send_order_confirmation_for_orders
from app.services.payments import refresh_payment_states
from app.services.stripe_payments import (
    extract_stripe_payment_ids,
    extract_stripe_order_references,
    retrieve_stripe_checkout_session,
    stripe_checkout_session_is_paid,
)

router = APIRouter(prefix="/stripe", tags=["stripe"])


def _get_stripe_module():
    try:
        return import_module("stripe")
    except ModuleNotFoundError:
        return None


def _first_pending_payment(db: Session, order_reference: str) -> PaymentRecord | None:
    return db.scalar(
        select(PaymentRecord)
        .where(
            PaymentRecord.order_reference == order_reference,
            PaymentRecord.provider_code == "stripe",
            PaymentRecord.status.in_(("pending", "late")),
        )
        .order_by(PaymentRecord.id.asc())
    )


def _first_confirmed_payment(db: Session, order_reference: str) -> PaymentRecord | None:
    return db.scalar(
        select(PaymentRecord)
        .where(
            PaymentRecord.order_reference == order_reference,
            PaymentRecord.provider_code == "stripe",
            PaymentRecord.status == "confirmed",
        )
        .order_by(PaymentRecord.id.asc())
    )


def _confirm_stripe_orders(
    db: Session,
    order_references: list[str],
    payment_ids: list[int] | None = None,
) -> tuple[list[str], list[str]]:
    matched_orders: list[str] = []
    newly_confirmed_orders: list[str] = []

    if payment_ids:
        payments = db.scalars(
            select(PaymentRecord)
            .where(
                PaymentRecord.id.in_(payment_ids),
                PaymentRecord.provider_code == "stripe",
            )
            .order_by(PaymentRecord.id.asc())
        ).all()
        payments_by_id = {payment.id: payment for payment in payments}

        for payment_id in payment_ids:
            payment = payments_by_id.get(payment_id)
            if payment is None:
                continue
            if payment.order_reference not in matched_orders:
                matched_orders.append(payment.order_reference)
            if payment.status == "confirmed":
                continue
            if payment.status not in {"pending", "late", "failed"}:
                continue

            payment.status = "confirmed"
            if payment.paid_at is None:
                from app.core.security import utc_now

                payment.paid_at = utc_now()
            db.add(payment)
            db.flush()
            refresh_payment_states(db, order_reference=payment.order_reference)
            sync_order_enrollment_access(db, payment.order_reference)
            if payment.order_reference not in newly_confirmed_orders:
                newly_confirmed_orders.append(payment.order_reference)

        return matched_orders, newly_confirmed_orders

    for order_reference in order_references:
        payment = _first_pending_payment(db, order_reference)
        if payment is None:
            if _first_confirmed_payment(db, order_reference) is not None:
                matched_orders.append(order_reference)
            continue

        payment.status = "confirmed"
        if payment.paid_at is None:
            from app.core.security import utc_now

            payment.paid_at = utc_now()
        db.add(payment)
        db.flush()
        refresh_payment_states(db, order_reference=order_reference)
        sync_order_enrollment_access(db, order_reference)
        matched_orders.append(order_reference)
        newly_confirmed_orders.append(order_reference)

    return matched_orders, newly_confirmed_orders


class StripeCheckoutConfirmPayload(BaseModel):
    session_id: str


@router.post("/webhook")
async def receive_stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    stripe = _get_stripe_module()

    if not settings.stripe_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook Stripe non configure.",
        )

    if stripe is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe n'est pas disponible sur ce serveur.",
        )
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.errors.SignatureVerificationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Signature invalide.") from e

    if event["type"] != "checkout.session.completed":
        return {"status": "ignored", "type": event["type"]}

    session = event["data"]["object"]
    if session.get("payment_status") != "paid":
        return {"status": "not_paid"}

    matched, newly_confirmed = _confirm_stripe_orders(
        db,
        extract_stripe_order_references(session),
        extract_stripe_payment_ids(session),
    )

    db.commit()
    if newly_confirmed:
        send_order_confirmation_for_orders(db, newly_confirmed)
    return {
        "status": "received",
        "matched_orders": matched,
        "newly_confirmed_orders": newly_confirmed,
    }


@router.post("/checkout/confirm")
def confirm_stripe_checkout(
    payload: StripeCheckoutConfirmPayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> dict[str, object]:
    try:
        session = retrieve_stripe_checkout_session(payload.session_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Stripe: {error}",
        ) from error

    order_references = extract_stripe_order_references(session)
    payment_ids = extract_stripe_payment_ids(session)
    if not order_references:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune commande Stripe n'a ete retrouvee pour cette session.",
        )

    owned_references = set(
        db.scalars(
            select(OrderRecord.reference).where(
                OrderRecord.reference.in_(order_references),
                OrderRecord.user_id == current_user.id,
            )
        ).all()
    )
    if owned_references != set(order_references):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cette session Stripe ne correspond pas a votre compte.",
        )

    if not stripe_checkout_session_is_paid(session):
        return {
            "status": "pending",
            "matched_orders": [],
            "newly_confirmed_orders": [],
            "message": "Paiement Stripe encore en cours de confirmation.",
        }

    matched, newly_confirmed = _confirm_stripe_orders(db, order_references, payment_ids)
    db.commit()

    if newly_confirmed:
        send_order_confirmation_for_orders(db, newly_confirmed)

    return {
        "status": "confirmed" if newly_confirmed else "already_confirmed",
        "matched_orders": matched,
        "newly_confirmed_orders": newly_confirmed,
        "message": (
            "Paiement Stripe confirme. Vos acces viennent d'etre actives."
            if newly_confirmed
            else "Paiement Stripe deja confirme. Vos acces sont disponibles."
        ),
    }
