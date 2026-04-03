from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    CartItemRecord,
    EnrollmentRecord,
    FormationRecord,
    OrderRecord,
    PaymentRecord,
    StudentCodeCounterRecord,
    UserRecord,
)
from app.schemas.commerce import (
    CartItemView,
    CartSnapshot,
    CheckoutResponse,
    EnrollmentView,
    StudentDashboardSummary,
)
from app.services.auth import get_dashboard_path
from app.services.catalog import format_fcfa


def utc_now() -> datetime:
    return datetime.now(UTC)


def serialize_cart_item(item: CartItemRecord, formation: FormationRecord) -> CartItemView:
    return CartItemView(
        id=item.id,
        formation_id=formation.id,
        formation_slug=formation.slug,
        title=formation.title,
        image=formation.image,
        format_type=formation.format_type,  # type: ignore[arg-type]
        dashboard_type=formation.dashboard_type,  # type: ignore[arg-type]
        session_label=formation.session_label,
        current_price_amount=formation.current_price_amount,
        current_price_label=format_fcfa(formation.current_price_amount) or "",
        original_price_label=format_fcfa(formation.original_price_amount),
        allow_installments=formation.allow_installments,
    )


def build_cart_snapshot(rows: list[tuple[CartItemRecord, FormationRecord]]) -> CartSnapshot:
    items = [serialize_cart_item(item, formation) for item, formation in rows]
    total_amount = sum(item.current_price_amount for item in items)
    live_items_count = sum(1 for item in items if item.format_type == "live")
    ligne_items_count = sum(1 for item in items if item.format_type == "ligne")
    presentiel_items_count = sum(1 for item in items if item.format_type == "presentiel")
    classic_items_count = sum(1 for item in items if item.dashboard_type == "classic")
    guided_items_count = sum(1 for item in items if item.dashboard_type == "guided")
    return CartSnapshot(
        items=items,
        total_amount=total_amount,
        total_amount_label=format_fcfa(total_amount) or "0 FCFA",
        live_items_count=live_items_count,
        ligne_items_count=ligne_items_count,
        presentiel_items_count=presentiel_items_count,
        classic_items_count=classic_items_count,
        guided_items_count=guided_items_count,
    )


def list_cart_snapshot(db: Session, user: UserRecord) -> CartSnapshot:
    rows = db.execute(
        select(CartItemRecord, FormationRecord)
        .join(FormationRecord, CartItemRecord.formation_id == FormationRecord.id)
        .where(CartItemRecord.user_id == user.id)
        .order_by(CartItemRecord.created_at.desc())
    ).all()
    return build_cart_snapshot(rows)


def add_item_to_cart(db: Session, user: UserRecord, formation_slug: str) -> CartSnapshot:
    formation = db.scalar(select(FormationRecord).where(FormationRecord.slug == formation_slug))
    if formation is None:
        raise HTTPException(status_code=404, detail="Formation introuvable.")

    existing = db.scalar(
        select(CartItemRecord).where(
            CartItemRecord.user_id == user.id,
            CartItemRecord.formation_id == formation.id,
        )
    )
    if existing is None:
        db.add(CartItemRecord(user_id=user.id, formation_id=formation.id))
        db.commit()

    return list_cart_snapshot(db, user)


def remove_item_from_cart(db: Session, user: UserRecord, formation_slug: str) -> CartSnapshot:
    formation = db.scalar(select(FormationRecord).where(FormationRecord.slug == formation_slug))
    if formation is None:
        raise HTTPException(status_code=404, detail="Formation introuvable.")

    item = db.scalar(
        select(CartItemRecord).where(
            CartItemRecord.user_id == user.id,
            CartItemRecord.formation_id == formation.id,
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Article introuvable dans le panier.")

    db.delete(item)
    db.commit()
    return list_cart_snapshot(db, user)


def _build_order_reference(db: Session, year: int, offset: int) -> str:
    existing_count = db.scalar(select(func.count()).select_from(OrderRecord)) or 0
    sequence = existing_count + offset + 1
    return f"AC-ORD-{year}-{sequence:04d}"


def _get_or_create_student_code(db: Session, user: UserRecord) -> str:
    if user.student_code:
        return user.student_code

    year = utc_now().year
    counter = db.scalar(
        select(StudentCodeCounterRecord).where(StudentCodeCounterRecord.year == year)
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


def _serialize_enrollment(
    enrollment: EnrollmentRecord,
    formation: FormationRecord,
    student_code: str | None,
) -> EnrollmentView:
    return EnrollmentView(
        id=enrollment.id,
        formation_id=formation.id,
        formation_slug=formation.slug,
        formation_title=formation.title,
        image=formation.image,
        format_type=enrollment.format_type,  # type: ignore[arg-type]
        dashboard_type=enrollment.dashboard_type,  # type: ignore[arg-type]
        order_reference=enrollment.order_reference,
        status=enrollment.status,
        student_code=student_code,
        session_label=formation.session_label,
        created_at=enrollment.created_at,
    )


def checkout_cart(db: Session, user: UserRecord) -> CheckoutResponse:
    rows = db.execute(
        select(CartItemRecord, FormationRecord)
        .join(FormationRecord, CartItemRecord.formation_id == FormationRecord.id)
        .where(CartItemRecord.user_id == user.id)
        .order_by(CartItemRecord.id.asc())
    ).all()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Votre panier est vide.",
        )

    order_references: list[str] = []
    dashboard_types: set[str] = set()
    now = utc_now()

    for index, (cart_item, formation) in enumerate(rows):
        order_reference = _build_order_reference(db, now.year, index)
        order_references.append(order_reference)
        dashboard_types.add(formation.dashboard_type)

        order = OrderRecord(
            reference=order_reference,
            user_id=user.id,
            formation_id=formation.id,
            customer_name=user.full_name,
            formation_title=formation.title,
            format_type=formation.format_type,
            dashboard_type=formation.dashboard_type,
            total_amount=formation.current_price_amount,
            currency=formation.price_currency,
            status="paid",
        )
        db.add(order)

        payment = PaymentRecord(
            order_reference=order_reference,
            payer_name=user.full_name,
            amount=formation.current_price_amount,
            currency=formation.price_currency,
            provider_code="mock_checkout",
            status="confirmed",
            paid_at=now,
        )
        db.add(payment)

        enrollment = db.scalar(
            select(EnrollmentRecord).where(
                EnrollmentRecord.user_id == user.id,
                EnrollmentRecord.formation_id == formation.id,
            )
        )
        if enrollment is None:
            if formation.format_type == "presentiel":
                _get_or_create_student_code(db, user)

            enrollment = EnrollmentRecord(
                user_id=user.id,
                formation_id=formation.id,
                order_reference=order_reference,
                format_type=formation.format_type,
                dashboard_type=formation.dashboard_type,
                status="active",
            )
            db.add(enrollment)

        db.delete(cart_item)

    db.commit()

    if user.role != "student":
        redirect_path = get_dashboard_path(user.role)
    elif dashboard_types == {"classic"}:
        redirect_path = "/espace/etudiant?focus=classic"
    elif dashboard_types == {"guided"}:
        redirect_path = "/espace/etudiant?focus=guided"
    else:
        redirect_path = "/espace/etudiant?focus=all"

    return CheckoutResponse(
        message="Paiement simule avec succes et inscriptions creees.",
        redirect_path=redirect_path,
        processed_items=len(rows),
        order_references=order_references,
    )


def list_user_enrollments(db: Session, user: UserRecord) -> list[EnrollmentView]:
    rows = db.execute(
        select(EnrollmentRecord, FormationRecord)
        .join(FormationRecord, EnrollmentRecord.formation_id == FormationRecord.id)
        .where(EnrollmentRecord.user_id == user.id)
        .order_by(EnrollmentRecord.created_at.desc())
    ).all()
    return [
        _serialize_enrollment(enrollment, formation, user.student_code)
        for enrollment, formation in rows
    ]


def get_student_dashboard_summary(db: Session, user: UserRecord) -> StudentDashboardSummary:
    enrollments = list_user_enrollments(db, user)
    classic_enrollments = [item for item in enrollments if item.dashboard_type == "classic"]
    guided_enrollments = [item for item in enrollments if item.dashboard_type == "guided"]
    live_enrollments_count = sum(1 for item in enrollments if item.format_type == "live")
    ligne_enrollments_count = sum(1 for item in enrollments if item.format_type == "ligne")
    presentiel_enrollments_count = sum(
        1 for item in enrollments if item.format_type == "presentiel"
    )

    return StudentDashboardSummary(
        student_code=user.student_code,
        live_enrollments_count=live_enrollments_count,
        ligne_enrollments_count=ligne_enrollments_count,
        presentiel_enrollments_count=presentiel_enrollments_count,
        classic_enrollments_count=len(classic_enrollments),
        guided_enrollments_count=len(guided_enrollments),
        classic_enrollments=classic_enrollments,
        guided_enrollments=guided_enrollments,
    )
