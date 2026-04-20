from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    CartItemRecord,
    EnrollmentRecord,
    FormationRecord,
    FormationSessionRecord,
    OrderRecord,
    PaymentRecord,
    StudentCodeCounterRecord,
    UserRecord,
)
from app.services.formation_sessions import get_session_presentation, refresh_session_enrolled_count
from app.core.security import utc_now


def _remove_matching_cart_items(
    db: Session,
    *,
    user_id: int,
    formation_id: int,
    session_id: int | None,
) -> None:
    statement = select(CartItemRecord).where(
        CartItemRecord.user_id == user_id,
        CartItemRecord.formation_id == formation_id,
    )
    if session_id is None:
        statement = statement.where(CartItemRecord.session_id.is_(None))
    else:
        statement = statement.where(CartItemRecord.session_id == session_id)

    for cart_item in db.scalars(statement).all():
        db.delete(cart_item)


def get_or_create_student_code(db: Session, user: UserRecord) -> str:
    if user.student_code:
        return user.student_code

    year = utc_now().year
    counter = db.scalar(
        select(StudentCodeCounterRecord)
        .where(StudentCodeCounterRecord.year == year)
        .with_for_update()
    )
    if counter is None:
        counter = StudentCodeCounterRecord(year=year, last_sequence=0)
        db.add(counter)
        db.flush()

    counter.last_sequence += 1
    student_code = f"AC{str(year)[-2:]}-{counter.last_sequence:03d}E"
    user.student_code = student_code
    db.add(counter)
    db.add(user)
    db.flush()
    return student_code


def sync_order_enrollment_access(db: Session, order_reference: str) -> EnrollmentRecord | None:
    order = db.scalar(select(OrderRecord).where(OrderRecord.reference == order_reference))
    if order is None or order.user_id is None or order.formation_id is None:
        return None

    user = db.get(UserRecord, order.user_id)
    formation = db.get(FormationRecord, order.formation_id)
    if user is None or formation is None:
        return None

    confirmed_payments = (
        db.scalar(
            select(func.count(PaymentRecord.id)).where(
                PaymentRecord.order_reference == order_reference,
                PaymentRecord.status == "confirmed",
            )
        )
        or 0
    )

    linked_session = db.get(FormationSessionRecord, order.session_id) if order.session_id is not None else None
    if linked_session is None:
        linked_session = get_session_presentation(
            db,
            formation_id=formation.id,
            format_type=formation.format_type,
        ).session
    linked_session_id = linked_session.id if linked_session is not None else None

    enrollment_statement = select(EnrollmentRecord).where(
        EnrollmentRecord.user_id == user.id,
        EnrollmentRecord.formation_id == formation.id,
    )
    if linked_session_id is None:
        enrollment_statement = enrollment_statement.where(EnrollmentRecord.session_id.is_(None))
    else:
        enrollment_statement = enrollment_statement.where(EnrollmentRecord.session_id == linked_session_id)
    enrollment = db.scalar(enrollment_statement)
    previous_session_id = enrollment.session_id if enrollment is not None else None

    if confirmed_payments > 0:
        if user.role == "guest":
            user.role = "student"
            db.flush()
        get_or_create_student_code(db, user)

        if enrollment is None:
            enrollment = EnrollmentRecord(
                user_id=user.id,
                formation_id=formation.id,
                session_id=linked_session_id,
                order_reference=order_reference,
                format_type=order.format_type,
                dashboard_type=order.dashboard_type,
                status="active",
            )
            db.add(enrollment)
            db.flush()
        else:
            enrollment.status = "active"
            enrollment.order_reference = order_reference
            enrollment.session_id = linked_session_id
            db.add(enrollment)

        if previous_session_id is not None and previous_session_id != enrollment.session_id:
            refresh_session_enrolled_count(db, previous_session_id)
        if enrollment.session_id is not None:
            refresh_session_enrolled_count(db, enrollment.session_id)
        _remove_matching_cart_items(
            db,
            user_id=user.id,
            formation_id=formation.id,
            session_id=linked_session_id,
        )
        return enrollment

    if enrollment is None or enrollment.order_reference != order_reference:
        return enrollment

    if order.status == "cancelled":
        enrollment.status = "cancelled"
    elif order.status == "failed":
        enrollment.status = "suspended"
    else:
        enrollment.status = "pending"
    db.add(enrollment)
    if enrollment.session_id is not None:
        refresh_session_enrolled_count(db, enrollment.session_id)
    return enrollment
