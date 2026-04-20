from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import OrderRecord, PaymentRecord, UserRecord
from app.services.email import send_payment_reminder

REMINDER_LOOKAHEAD_DAYS = 7
OPEN_PAYMENT_STATUSES = {"pending"}


def utc_now() -> datetime:
    return datetime.now(UTC)


def today_utc() -> date:
    return utc_now().date()


def is_payment_open(status: str) -> bool:
    return status in OPEN_PAYMENT_STATUSES


def should_mark_payment_late(payment: PaymentRecord, *, today: date | None = None) -> bool:
    return False


def sync_payment_deadlines(
    db: Session,
    *,
    order_reference: str | None = None,
) -> set[str]:
    statement = select(PaymentRecord)
    if order_reference is not None:
        statement = statement.where(PaymentRecord.order_reference == order_reference)

    payments = db.scalars(statement).all()
    today = today_utc()
    changed_refs: set[str] = set()

    for payment in payments:
        next_status = payment.status
        if payment.status == "late":
            next_status = "pending"

        if next_status != payment.status:
            payment.status = next_status
            db.add(payment)
            changed_refs.add(payment.order_reference)

    return changed_refs


def recompute_order_status(db: Session, order_reference: str) -> OrderRecord | None:
    order = db.scalar(select(OrderRecord).where(OrderRecord.reference == order_reference))
    if order is None:
        return None

    payments = db.scalars(
        select(PaymentRecord).where(PaymentRecord.order_reference == order_reference)
    ).all()
    if not payments:
        return order

    total = len(payments)
    confirmed_count = sum(1 for payment in payments if payment.status == "confirmed")
    open_count = sum(1 for payment in payments if payment.status == "pending")
    failed_count = sum(1 for payment in payments if payment.status == "failed")
    cancelled_count = sum(1 for payment in payments if payment.status == "cancelled")

    if confirmed_count == total:
        next_status = "paid"
    elif confirmed_count > 0:
        next_status = "partially_paid"
    elif open_count > 0:
        next_status = "pending"
    elif cancelled_count == total:
        next_status = "cancelled"
    elif failed_count > 0:
        next_status = "failed"
    else:
        next_status = order.status

    if order.status != next_status:
        order.status = next_status
        db.add(order)

    return order


def refresh_payment_states(
    db: Session,
    *,
    order_reference: str | None = None,
) -> None:
    changed_refs = sync_payment_deadlines(db, order_reference=order_reference)
    refs_to_refresh = set(changed_refs)
    if order_reference is not None:
        refs_to_refresh.add(order_reference)
    else:
        refs_to_refresh.update(
            db.scalars(select(PaymentRecord.order_reference).distinct()).all()
        )

    for reference in refs_to_refresh:
        recompute_order_status(db, reference)


def payment_can_send_reminder(payment: PaymentRecord) -> bool:
    return payment.status == "pending"


def payment_requires_attention(payment: PaymentRecord) -> bool:
    return payment.status in {"pending", "failed", "cancelled"}


def payment_due_label(payment: PaymentRecord) -> str | None:
    if payment.due_date is None:
        return None

    today = today_utc()

    # Single payment (no installment_number): show "expired" if past confirmation window
    if payment.installment_number is None:
        if payment.status == "confirmed":
            return None
        if payment.due_date < today:
            return "A confirmer"
        return None

    if payment.due_date < today:
        return "A regler"

    days_left = (payment.due_date - today).days
    if days_left == 0:
        return "Echeance aujourd'hui"
    if days_left == 1:
        return "Demain"
    if days_left <= REMINDER_LOOKAHEAD_DAYS:
        return f"Dans {days_left} jours"
    return "A venir"


def send_manual_payment_reminder(
    db: Session,
    payment: PaymentRecord,
) -> PaymentRecord:
    if not payment_can_send_reminder(payment):
        raise ValueError("Cette echeance ne peut pas etre relancee dans son statut actuel.")

    order = db.scalar(select(OrderRecord).where(OrderRecord.reference == payment.order_reference))
    user = None
    if order is not None and order.user_id is not None:
        user = db.get(UserRecord, order.user_id)
    if user is None:
        user = db.scalar(select(UserRecord).where(UserRecord.full_name == payment.payer_name))
    if user is None:
        raise ValueError("Impossible de trouver le destinataire de cette relance.")

    send_payment_reminder(
        to=user.email,
        name=user.full_name,
        formation_title=order.formation_title if order is not None else "votre formation",
        order_reference=payment.order_reference,
        amount=payment.amount,
        currency=payment.currency,
        due_date=payment.due_date,
        installment_number=payment.installment_number,
        status=payment.status,
    )

    payment.reminder_count += 1
    payment.last_reminded_at = utc_now()
    db.add(payment)
    return payment
