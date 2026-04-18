from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import OrderRecord, PaymentRecord, UserRecord
from app.services.email import OrderEmailData, send_order_confirmation


def send_order_confirmation_for_orders(
    db: Session,
    order_references: list[str],
) -> bool:
    normalized_references = [reference.strip() for reference in order_references if reference.strip()]
    if not normalized_references:
        return False

    orders = db.scalars(
        select(OrderRecord).where(OrderRecord.reference.in_(normalized_references))
    ).all()
    order_by_reference = {order.reference: order for order in orders}
    grouped_payloads: dict[int, list[OrderEmailData]] = defaultdict(list)

    for reference in normalized_references:
        order = order_by_reference.get(reference)
        if order is None or order.user_id is None:
            continue

        payments = db.scalars(
            select(PaymentRecord)
            .where(PaymentRecord.order_reference == reference)
            .order_by(PaymentRecord.installment_number.nullsfirst(), PaymentRecord.id.asc())
        ).all()

        grouped_payloads[order.user_id].append(
            OrderEmailData(
                reference=order.reference,
                formation_title=order.formation_title,
                format_type=order.format_type,
                total_amount=order.total_amount,
                currency=order.currency,
                installment_plan=order.installment_plan,
                installment_lines=[
                    {
                        "number": payment.installment_number,
                        "amount": payment.amount,
                        "due_date": payment.due_date,
                        "status": payment.status,
                    }
                    for payment in payments
                ],
            )
        )

    sent = False
    for user_id, payloads in grouped_payloads.items():
        user = db.get(UserRecord, user_id)
        if user is None:
            continue
        send_order_confirmation(user.email, user.full_name, payloads)
        sent = True

    return sent
