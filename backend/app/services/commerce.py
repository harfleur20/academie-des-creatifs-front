from __future__ import annotations

from datetime import UTC, date, datetime, time

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.entities import (
    CartItemRecord,
    EnrollmentRecord,
    FavoriteItemRecord,
    FormationRecord,
    FormationSessionRecord,
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
    FavoriteItemView,
    FavoriteSnapshot,
    NotificationView,
    StudentDashboardSummary,
)
from app.services.auth import get_dashboard_path
from app.services.catalog import format_fcfa
from app.services.formation_sessions import get_session_presentation


def utc_now() -> datetime:
    return datetime.now(UTC)


def combine_date_to_utc(value: datetime | None = None, *, day: date | None = None) -> datetime:
    if value is not None:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
    if day is not None:
        return datetime.combine(day, time.min, tzinfo=UTC)
    return utc_now()


def get_session_display_label(db: Session, formation: FormationRecord) -> str:
    presentation = get_session_presentation(
        db,
        formation_id=formation.id,
        format_type=formation.format_type,
    )
    return presentation.session_label or "Acces immediat"


def ensure_can_purchase(db: Session, formation: FormationRecord) -> None:
    presentation = get_session_presentation(
        db,
        formation_id=formation.id,
        format_type=formation.format_type,
    )
    if presentation.can_purchase:
        return

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=presentation.purchase_message
        or "Cette formation n'est pas disponible a l'achat pour le moment.",
    )


def serialize_cart_item(db: Session, item: CartItemRecord, formation: FormationRecord) -> CartItemView:
    return CartItemView(
        id=item.id,
        formation_id=formation.id,
        formation_slug=formation.slug,
        title=formation.title,
        image=formation.image,
        format_type=formation.format_type,  # type: ignore[arg-type]
        dashboard_type=formation.dashboard_type,  # type: ignore[arg-type]
        session_label=get_session_display_label(db, formation),
        level=formation.level,
        current_price_amount=formation.current_price_amount,
        current_price_label=format_fcfa(formation.current_price_amount) or "",
        original_price_label=format_fcfa(formation.original_price_amount),
        allow_installments=formation.allow_installments,
    )


def build_cart_snapshot(db: Session, rows: list[tuple[CartItemRecord, FormationRecord]]) -> CartSnapshot:
    items = [serialize_cart_item(db, item, formation) for item, formation in rows]
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


def serialize_favorite_item(
    db: Session,
    item: FavoriteItemRecord,
    formation: FormationRecord,
) -> FavoriteItemView:
    return FavoriteItemView(
        id=item.id,
        formation_id=formation.id,
        formation_slug=formation.slug,
        title=formation.title,
        image=formation.image,
        format_type=formation.format_type,  # type: ignore[arg-type]
        dashboard_type=formation.dashboard_type,  # type: ignore[arg-type]
        session_label=get_session_display_label(db, formation),
        level=formation.level,
        current_price_amount=formation.current_price_amount,
        current_price_label=format_fcfa(formation.current_price_amount) or "",
        original_price_label=format_fcfa(formation.original_price_amount),
        allow_installments=formation.allow_installments,
        rating=formation.rating,
        reviews=formation.reviews,
        badges=formation.badges,
    )


def build_favorite_snapshot(
    db: Session,
    rows: list[tuple[FavoriteItemRecord, FormationRecord]],
) -> FavoriteSnapshot:
    items = [serialize_favorite_item(db, item, formation) for item, formation in rows]
    return FavoriteSnapshot(items=items, total_count=len(items))


def list_cart_snapshot(db: Session, user: UserRecord) -> CartSnapshot:
    rows = db.execute(
        select(CartItemRecord, FormationRecord)
        .join(FormationRecord, CartItemRecord.formation_id == FormationRecord.id)
        .where(CartItemRecord.user_id == user.id)
        .order_by(CartItemRecord.created_at.desc())
    ).all()
    return build_cart_snapshot(db, rows)


def list_favorite_snapshot(db: Session, user: UserRecord) -> FavoriteSnapshot:
    rows = db.execute(
        select(FavoriteItemRecord, FormationRecord)
        .join(FormationRecord, FavoriteItemRecord.formation_id == FormationRecord.id)
        .where(FavoriteItemRecord.user_id == user.id)
        .order_by(FavoriteItemRecord.created_at.desc())
    ).all()
    return build_favorite_snapshot(db, rows)


def add_item_to_cart(db: Session, user: UserRecord, formation_slug: str) -> CartSnapshot:
    formation = db.scalar(select(FormationRecord).where(FormationRecord.slug == formation_slug))
    if formation is None:
        raise HTTPException(status_code=404, detail="Formation introuvable.")

    ensure_can_purchase(db, formation)

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


def add_item_to_favorites(db: Session, user: UserRecord, formation_slug: str) -> FavoriteSnapshot:
    formation = db.scalar(select(FormationRecord).where(FormationRecord.slug == formation_slug))
    if formation is None:
        raise HTTPException(status_code=404, detail="Formation introuvable.")

    existing = db.scalar(
        select(FavoriteItemRecord).where(
            FavoriteItemRecord.user_id == user.id,
            FavoriteItemRecord.formation_id == formation.id,
        )
    )
    if existing is None:
        db.add(FavoriteItemRecord(user_id=user.id, formation_id=formation.id))
        db.commit()

    return list_favorite_snapshot(db, user)


def remove_item_from_favorites(db: Session, user: UserRecord, formation_slug: str) -> FavoriteSnapshot:
    formation = db.scalar(select(FormationRecord).where(FormationRecord.slug == formation_slug))
    if formation is None:
        raise HTTPException(status_code=404, detail="Formation introuvable.")

    item = db.scalar(
        select(FavoriteItemRecord).where(
            FavoriteItemRecord.user_id == user.id,
            FavoriteItemRecord.formation_id == formation.id,
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Article introuvable dans les favoris.")

    db.delete(item)
    db.commit()
    return list_favorite_snapshot(db, user)


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
    db: Session,
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
        session_label=get_session_display_label(db, formation),
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
        ensure_can_purchase(db, formation)

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
        _serialize_enrollment(db, enrollment, formation, user.student_code)
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


def list_user_notifications(db: Session, user: UserRecord) -> list[NotificationView]:
    notifications: list[NotificationView] = []

    if user.role == "student":
        payment_rows = db.execute(
            select(PaymentRecord, OrderRecord)
            .outerjoin(OrderRecord, PaymentRecord.order_reference == OrderRecord.reference)
            .where(
                or_(
                    OrderRecord.user_id == user.id,
                    OrderRecord.customer_name == user.full_name,
                    PaymentRecord.payer_name == user.full_name,
                )
            )
            .order_by(func.coalesce(PaymentRecord.paid_at, PaymentRecord.created_at).desc())
        ).all()

        for payment, order in payment_rows:
            formation_title = order.formation_title if order else "votre formation"
            notifications.append(
                NotificationView(
                    id=f"payment-{payment.id}",
                    title=(
                        "Paiement confirme"
                        if payment.status == "confirmed"
                        else "Paiement en attente"
                    ),
                    message=(
                        f"Le paiement de {format_fcfa(payment.amount) or f'{payment.amount} FCFA'} "
                        f"pour {formation_title} a ete confirme."
                        if payment.status == "confirmed"
                        else f"Le paiement de {format_fcfa(payment.amount) or f'{payment.amount} FCFA'} "
                        f"pour {formation_title} est toujours en attente de validation."
                    ),
                    tone="success" if payment.status == "confirmed" else "warning",
                    category="payment",
                    created_at=combine_date_to_utc(payment.paid_at or payment.created_at),
                    action_label=(
                        "Acceder a mon espace"
                        if payment.status == "confirmed"
                        else "Voir mon panier"
                    ),
                    action_path="/espace/etudiant" if payment.status == "confirmed" else "/panier",
                )
            )

        enrollment_rows = db.execute(
            select(EnrollmentRecord, FormationRecord)
            .join(FormationRecord, EnrollmentRecord.formation_id == FormationRecord.id)
            .where(EnrollmentRecord.user_id == user.id)
            .order_by(EnrollmentRecord.created_at.desc())
        ).all()

        has_presentiel_enrollment = False
        for enrollment, formation in enrollment_rows:
            has_presentiel_enrollment = has_presentiel_enrollment or formation.format_type == "presentiel"
            workspace_path = (
                f"/espace/etudiant/classic/{enrollment.id}"
                if enrollment.dashboard_type == "classic"
                else f"/espace/etudiant/guided/{enrollment.id}"
            )
            notifications.append(
                NotificationView(
                    id=f"enrollment-{enrollment.id}",
                    title="Acces formation active",
                    message=(
                        f"{formation.title} est disponible dans votre espace "
                        f"{'classique' if enrollment.dashboard_type == 'classic' else 'guide'}."
                    ),
                    tone="info",
                    category="enrollment",
                    created_at=combine_date_to_utc(enrollment.created_at),
                    action_label="Ouvrir le parcours",
                    action_path=workspace_path,
                )
            )

        if user.student_code and has_presentiel_enrollment:
            notifications.append(
                NotificationView(
                    id=f"student-code-{user.id}",
                    title="Code etudiant attribue",
                    message=(
                        f"Votre code etudiant {user.student_code} est actif pour vos "
                        "formations guidees et votre suivi presentiel."
                    ),
                    tone="success",
                    category="system",
                    created_at=utc_now(),
                    action_label="Voir mon espace guide",
                    action_path="/espace/etudiant?focus=guided",
                )
            )

        if not notifications:
            notifications.append(
                NotificationView(
                    id=f"starter-{user.id}",
                    title="Votre espace est pret",
                    message=(
                        "Ajoutez une formation a votre panier ou finalisez un achat pour "
                        "recevoir ici vos rappels de paiement, acces et informations de session."
                    ),
                    tone="info",
                    category="system",
                    created_at=utc_now(),
                    action_label="Voir le catalogue",
                    action_path="/formations",
                )
            )

    elif user.role == "teacher":
        sessions = db.scalars(
            select(FormationSessionRecord)
            .where(FormationSessionRecord.teacher_name == user.full_name)
            .order_by(FormationSessionRecord.start_date.asc())
        ).all()

        for session in sessions:
            formation = db.get(FormationRecord, session.formation_id)
            if formation is None:
                continue
            notifications.append(
                NotificationView(
                    id=f"teacher-session-{session.id}",
                    title=f"Session {session.label}",
                    message=(
                        f"{formation.title} demarre le "
                        f"{session.start_date.strftime('%d/%m/%Y')} a {session.campus_label}. "
                        f"Places occupees: {session.enrolled_count}/{session.seat_capacity}."
                    ),
                    tone="info" if session.status == "open" else "warning",
                    category="session",
                    created_at=combine_date_to_utc(day=session.start_date),
                    action_label="Ouvrir l'espace enseignant",
                    action_path="/espace/enseignant",
                )
            )

        if not notifications:
            notifications.append(
                NotificationView(
                    id=f"teacher-empty-{user.id}",
                    title="Aucune session assignee pour le moment",
                    message=(
                        "Quand une cohorte vous sera attribuee, ses rappels et informations "
                        "apparaitront ici."
                    ),
                    tone="info",
                    category="system",
                    created_at=utc_now(),
                    action_label="Ouvrir l'espace enseignant",
                    action_path="/espace/enseignant",
                )
            )

    else:
        pending_orders = db.scalar(
            select(func.count()).select_from(OrderRecord).where(OrderRecord.status == "pending")
        ) or 0
        pending_payments = db.scalar(
            select(func.count()).select_from(PaymentRecord).where(PaymentRecord.status == "pending")
        ) or 0
        confirmed_revenue = db.scalar(
            select(func.coalesce(func.sum(PaymentRecord.amount), 0)).where(
                PaymentRecord.status == "confirmed"
            )
        ) or 0

        notifications.extend(
            [
                NotificationView(
                    id="admin-pending-orders",
                    title="Commandes en attente",
                    message=f"{pending_orders} commande(s) necessitent encore une validation ou un paiement.",
                    tone="warning" if pending_orders > 0 else "info",
                    category="admin",
                    created_at=utc_now(),
                    action_label="Ouvrir l'administration",
                    action_path="/admin",
                ),
                NotificationView(
                    id="admin-pending-payments",
                    title="Paiements a surveiller",
                    message=f"{pending_payments} paiement(s) sont encore marques comme en attente.",
                    tone="warning" if pending_payments > 0 else "info",
                    category="admin",
                    created_at=utc_now(),
                    action_label="Voir les paiements",
                    action_path="/admin",
                ),
                NotificationView(
                    id="admin-confirmed-revenue",
                    title="Encaissements confirmes",
                    message=(
                        f"Le total confirme a ce jour atteint "
                        f"{format_fcfa(int(confirmed_revenue)) or f'{confirmed_revenue} FCFA'}."
                    ),
                    tone="success",
                    category="admin",
                    created_at=utc_now(),
                    action_label="Voir le dashboard admin",
                    action_path="/admin",
                ),
            ]
        )

    return sorted(notifications, key=lambda item: item.created_at, reverse=True)
