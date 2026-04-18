from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import (
    CartItemRecord,
    EnrollmentRecord,
    FavoriteItemRecord,
    FormationRecord,
    FormationSessionRecord,
    OrderRecord,
    PaymentRecord,
    UserRecord,
)
from app.schemas.commerce import (
    CartItemView,
    CartSnapshot,
    CheckoutResponse,
    EnrollmentView,
    FavoriteItemView,
    FavoriteSnapshot,
    InstallmentLine,
    NotificationView,
    StudentDashboardSummary,
)
from app.services.auth import get_dashboard_path
from app.services.catalog import format_fcfa, should_allow_installments
from app.services.email import OrderEmailData, send_order_confirmation
from app.services.formation_sessions import find_current_or_next_session, get_session_presentation
from app.services.order_access import sync_order_enrollment_access
from app.services.payments import payment_due_label, refresh_payment_states, today_utc
from app.services.tara_money import (
    build_tara_product_id,
    build_tara_return_url,
    build_tara_webhook_url,
    create_tara_payment_link,
    is_tara_money_configured,
)
from app.services.stripe_payments import (
    build_stripe_cancel_url,
    build_stripe_line_item,
    build_stripe_success_url,
    create_stripe_checkout_session,
    is_stripe_configured,
)

CHECKOUT_INSTALLMENT_THRESHOLD = 100000


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


def get_enrollment_session_label(db: Session, enrollment: EnrollmentRecord, formation: FormationRecord) -> str:
    if enrollment.session_id is not None:
        session = db.get(FormationSessionRecord, enrollment.session_id)
        if session is not None:
            return session.label
    return get_session_display_label(db, formation)


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
    presentation = get_session_presentation(db, formation_id=formation.id, format_type=formation.format_type)  # type: ignore[arg-type]
    return CartItemView(
        id=item.id,
        formation_id=formation.id,
        formation_slug=formation.slug,
        title=formation.title,
        image=formation.image,
        format_type=formation.format_type,  # type: ignore[arg-type]
        dashboard_type=formation.dashboard_type,  # type: ignore[arg-type]
        session_label=presentation.session_label or "Accès immédiat",
        level=formation.level,
        mentor_name=formation.mentor_name or None,
        current_price_amount=formation.current_price_amount,
        current_price_label=format_fcfa(formation.current_price_amount) or "",
        original_price_label=format_fcfa(formation.original_price_amount),
        allow_installments=should_allow_installments(
            formation.format_type,  # type: ignore[arg-type]
            formation.current_price_amount,
        ),
        can_purchase=presentation.can_purchase,
        purchase_message=presentation.purchase_message,
    )


def cart_allows_checkout_installments(cart_total_amount: int) -> bool:
    return cart_total_amount >= CHECKOUT_INSTALLMENT_THRESHOLD


def build_cart_snapshot(db: Session, rows: list[tuple[CartItemRecord, FormationRecord]]) -> CartSnapshot:
    total_amount = sum(formation.current_price_amount for _, formation in rows)
    allow_installments = cart_allows_checkout_installments(total_amount)
    items = [
        CartItemView(
            id=item.id,
            formation_id=formation.id,
            formation_slug=formation.slug,
            title=formation.title,
            image=formation.image,
            format_type=formation.format_type,  # type: ignore[arg-type]
            dashboard_type=formation.dashboard_type,  # type: ignore[arg-type]
            session_label=get_session_display_label(db, formation),
            level=formation.level,
            mentor_name=formation.mentor_name or None,
            current_price_amount=formation.current_price_amount,
            current_price_label=format_fcfa(formation.current_price_amount) or "",
            original_price_label=format_fcfa(formation.original_price_amount),
            allow_installments=allow_installments,
            can_purchase=get_session_presentation(db, formation_id=formation.id, format_type=formation.format_type).can_purchase,  # type: ignore[arg-type]
            purchase_message=get_session_presentation(db, formation_id=formation.id, format_type=formation.format_type).purchase_message,  # type: ignore[arg-type]
        )
        for item, formation in rows
    ]
    live_items_count = sum(1 for item in items if item.format_type == "live")
    ligne_items_count = sum(1 for item in items if item.format_type == "ligne")
    presentiel_items_count = sum(1 for item in items if item.format_type == "presentiel")
    classic_items_count = sum(1 for item in items if item.dashboard_type == "classic")
    guided_items_count = sum(1 for item in items if item.dashboard_type == "guided")
    return CartSnapshot(
        items=items,
        total_amount=total_amount,
        total_amount_label=format_fcfa(total_amount) or "0 FCFA",
        allow_installments=allow_installments,
        installment_threshold_amount=CHECKOUT_INSTALLMENT_THRESHOLD,
        installment_threshold_label=format_fcfa(CHECKOUT_INSTALLMENT_THRESHOLD) or "100 000 FCFA",
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
        allow_installments=should_allow_installments(
            formation.format_type,  # type: ignore[arg-type]
            formation.current_price_amount,
        ),
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
        session = find_current_or_next_session(db, formation.id)
        db.add(CartItemRecord(
            user_id=user.id,
            formation_id=formation.id,
            session_id=session.id if session is not None else None,
        ))
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
    prefix = f"AC-ORD-{year}-"
    existing_references = db.scalars(
        select(OrderRecord.reference).where(OrderRecord.reference.like(f"{prefix}%"))
    ).all()
    highest_sequence = 0
    for reference in existing_references:
        suffix = reference.removeprefix(prefix)
        if suffix.isdigit():
            highest_sequence = max(highest_sequence, int(suffix))
    sequence = highest_sequence + offset + 1
    return f"AC-ORD-{year}-{sequence:04d}"


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
        session_label=get_enrollment_session_label(db, enrollment, formation),
        created_at=enrollment.created_at,
    )


def _split_installments_rounded(total: int, n: int) -> list[int]:
    """Split total into n parts rounded down to nearest 500 FCFA. Last absorbs remainder."""
    if n == 1:
        return [total]
    base = (total // n // 500) * 500
    parts = [base] * (n - 1)
    parts.append(total - sum(parts))
    return parts


def _compute_installment_schedule(
    total: int,
    session_end_date: date,
    today: date,
    allow_installments: bool,
) -> tuple[int, list[date], list[int]]:
    """
    Returns (n_installments, due_dates, amounts) based on session duration rules.

    Duration rules:
    - allow_installments=False OR ≤7 days  → 1 (single, due today+3 for webhook window)
    - 8–14 days                             → 2 installments, interval = duration
    - 15–29 days                            → 2 installments, last ≤ end_date − 5j
    - ≥30 days                              → 3 installments, last ≤ end_date − 5j
                                              (fallback to 2 if available days < 14)
    """
    if not allow_installments:
        return 1, [today + timedelta(days=3)], [total]

    duration = (session_end_date - today).days

    if duration <= 7:
        return 1, [today + timedelta(days=3)], [total]

    if duration <= 14:
        interval = max(7, duration)
        return 2, [today, today + timedelta(days=interval)], _split_installments_rounded(total, 2)

    if duration < 30:
        available = max(7, (session_end_date - timedelta(days=5) - today).days)
        return 2, [today, today + timedelta(days=available)], _split_installments_rounded(total, 2)

    # ≥ 30 days
    deadline = session_end_date - timedelta(days=5)
    available = (deadline - today).days

    if available < 14:
        interval = max(7, available)
        return 2, [today, today + timedelta(days=interval)], _split_installments_rounded(total, 2)

    interval = max(7, available // 2)
    due_dates = [today, today + timedelta(days=interval), today + timedelta(days=interval * 2)]
    return 3, due_dates, _split_installments_rounded(total, 3)


def _plan_label(n: int) -> str:
    return {1: "full", 2: "2x", 3: "3x"}.get(n, "full")


def _build_checkout_redirect_path(user: UserRecord, dashboard_types: set[str]) -> str:
    if user.role != "student":
        return get_dashboard_path(user.role)
    if dashboard_types == {"classic"}:
        return "/espace/etudiant?focus=classic"
    if dashboard_types == {"guided"}:
        return "/espace/etudiant?focus=guided"
    return "/espace/etudiant?focus=all"


def _checkout_cart_mock(
    db: Session,
    user: UserRecord,
    rows: list[tuple[CartItemRecord, FormationRecord]],
    use_installments: bool,
) -> CheckoutResponse:
    order_references: list[str] = []
    installment_schedules: dict[str, list[InstallmentLine]] = {}
    dashboard_types: set[str] = set()
    email_orders: list[OrderEmailData] = []
    now = utc_now()
    today = now.date()

    for index, (cart_item, formation) in enumerate(rows):
        ensure_can_purchase(db, formation)
        order_reference = _build_order_reference(db, now.year, index)
        order_references.append(order_reference)
        dashboard_types.add(formation.dashboard_type)

        # Resolve session to compute installment schedule
        session = (
            db.get(FormationSessionRecord, cart_item.session_id)
            if cart_item.session_id is not None
            else find_current_or_next_session(db, formation.id)
        )
        session_end = session.end_date if session is not None else today + timedelta(days=60)

        n_inst, due_dates, amounts = _compute_installment_schedule(
            total=formation.current_price_amount,
            session_end_date=session_end,
            today=today,
            allow_installments=use_installments and formation.allow_installments,
        )
        is_installment = n_inst > 1

        order_status = "partially_paid" if is_installment else "paid"
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
            status=order_status,
            installment_plan=_plan_label(n_inst),
        )
        db.add(order)

        if is_installment:
            schedule: list[InstallmentLine] = []
            for i, (amt, due) in enumerate(zip(amounts, due_dates)):
                pmt_status = "confirmed" if i == 0 else "pending"
                db.add(PaymentRecord(
                    order_reference=order_reference,
                    payer_name=user.full_name,
                    amount=amt,
                    currency=formation.price_currency,
                    provider_code="mock_installment",
                    status=pmt_status,
                    paid_at=now if i == 0 else None,
                    installment_number=i + 1,
                    due_date=due,
                ))
                schedule.append(InstallmentLine(
                    number=i + 1,
                    amount=amt,
                    amount_label=format_fcfa(amt),
                    due_date=due,
                    status=pmt_status,
                ))
            installment_schedules[order_reference] = schedule
            email_orders.append(OrderEmailData(
                reference=order_reference,
                formation_title=formation.title,
                format_type=formation.format_type,
                total_amount=formation.current_price_amount,
                currency=formation.price_currency,
                installment_plan=_plan_label(n_inst),
                installment_lines=[
                    {"number": line.number, "amount": line.amount, "due_date": line.due_date, "status": line.status}
                    for line in schedule
                ],
            ))
        else:
            db.add(PaymentRecord(
                order_reference=order_reference,
                payer_name=user.full_name,
                amount=formation.current_price_amount,
                currency=formation.price_currency,
                provider_code="mock_checkout",
                status="confirmed",
                paid_at=now,
                due_date=today + timedelta(days=3),
            ))
            email_orders.append(OrderEmailData(
                reference=order_reference,
                formation_title=formation.title,
                format_type=formation.format_type,
                total_amount=formation.current_price_amount,
                currency=formation.price_currency,
                installment_plan="full",
            ))

        db.flush()
        sync_order_enrollment_access(db, order_reference)
        db.delete(cart_item)

    db.commit()

    if email_orders:
        send_order_confirmation(user.email, user.full_name, email_orders)

    return CheckoutResponse(
        message=(
            "Inscription créée avec plan 3× — premier versement confirmé."
            if installment_schedules else
            "Paiement simulé avec succès et inscriptions créées."
        ),
        redirect_path=_build_checkout_redirect_path(user, dashboard_types),
        processed_items=len(rows),
        order_references=order_references,
        installment_schedules=installment_schedules,
    )


def _checkout_cart_with_tara(
    db: Session,
    user: UserRecord,
    rows: list[tuple[CartItemRecord, FormationRecord]],
    use_installments: bool,
) -> CheckoutResponse:
    order_references: list[str] = []
    installment_schedules: dict[str, list[InstallmentLine]] = {}
    dashboard_types: set[str] = set()
    now = utc_now()
    today = now.date()
    due_today_total = 0
    picture_url = ""

    for index, (cart_item, formation) in enumerate(rows):
        ensure_can_purchase(db, formation)
        order_reference = _build_order_reference(db, now.year, index)
        order_references.append(order_reference)
        dashboard_types.add(formation.dashboard_type)
        if not picture_url and formation.image:
            picture_url = formation.image

        # Resolve session for installment schedule
        session = (
            db.get(FormationSessionRecord, cart_item.session_id)
            if cart_item.session_id is not None
            else find_current_or_next_session(db, formation.id)
        )
        session_end = session.end_date if session is not None else today + timedelta(days=60)

        n_inst, due_dates, amounts = _compute_installment_schedule(
            total=formation.current_price_amount,
            session_end_date=session_end,
            today=today,
            allow_installments=use_installments and formation.allow_installments,
        )
        is_installment = n_inst > 1

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
            status="pending",
            installment_plan=_plan_label(n_inst),
        )
        db.add(order)

        if is_installment:
            schedule: list[InstallmentLine] = []
            for i, (amt, due) in enumerate(zip(amounts, due_dates)):
                db.add(PaymentRecord(
                    order_reference=order_reference,
                    payer_name=user.full_name,
                    amount=amt,
                    currency=formation.price_currency,
                    provider_code="tara_money",
                    status="pending",
                    paid_at=None,
                    installment_number=i + 1,
                    due_date=due,
                ))
                schedule.append(InstallmentLine(
                    number=i + 1,
                    amount=amt,
                    amount_label=format_fcfa(amt),
                    due_date=due,
                    status="pending",
                ))
            installment_schedules[order_reference] = schedule
            due_today_total += amounts[0]
        else:
            db.add(PaymentRecord(
                order_reference=order_reference,
                payer_name=user.full_name,
                amount=formation.current_price_amount,
                currency=formation.price_currency,
                provider_code="tara_money",
                status="pending",
                paid_at=None,
                due_date=today + timedelta(days=3),
            ))
            due_today_total += formation.current_price_amount

        db.delete(cart_item)

    db.flush()

    picture_url = picture_url or "/logo_academie_hd.png"
    if picture_url.startswith("/"):
        picture_url = f"{settings.backend_public_url}{picture_url}"

    if len(rows) == 1:
        formation = rows[0][1]
        product_name = formation.title
        product_description = (
            f"Premier versement pour {formation.title}"
            if use_installments
            else f"Paiement pour {formation.title}"
        )
    else:
        product_name = f"Commande Académie des Créatifs ({len(rows)} formations)"
        product_description = (
            "Premier versement de votre commande multi-formations."
            if use_installments
            else "Reglement de votre commande multi-formations."
        )

    try:
        payment_links = create_tara_payment_link(
            product_id=build_tara_product_id(order_references),
            product_name=product_name,
            product_price=due_today_total,
            product_description=product_description,
            product_picture_url=picture_url,
            return_url=build_tara_return_url(order_references),
            webhook_url=build_tara_webhook_url(),
        )
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=502, detail=str(error)) from error

    db.commit()
    return CheckoutResponse(
        message="Lien de paiement Tara Money généré. Finalisez le règlement pour poursuivre votre inscription.",
        redirect_path="/espace/etudiant/paiements",
        external_redirect_url=payment_links.preferred_redirect_url(),
        payment_provider="tara_money",
        processed_items=len(rows),
        order_references=order_references,
        installment_schedules=installment_schedules,
        payment_links={
            "whatsapp_link": payment_links.whatsapp_link,
            "telegram_link": payment_links.telegram_link,
            "dikalo_link": payment_links.dikalo_link,
            "sms_link": payment_links.sms_link,
        },
    )


def _checkout_cart_with_stripe(
    db: Session,
    user: UserRecord,
    rows: list[tuple[CartItemRecord, FormationRecord]],
) -> CheckoutResponse:
    order_references: list[str] = []
    dashboard_types: set[str] = set()
    line_items: list[dict] = []
    now = utc_now()
    today = now.date()

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
            status="pending",
            installment_plan="full",
        )
        db.add(order)
        db.add(PaymentRecord(
            order_reference=order_reference,
            payer_name=user.full_name,
            amount=formation.current_price_amount,
            currency=formation.price_currency,
            provider_code="stripe",
            status="pending",
            paid_at=None,
            due_date=today,
        ))
        line_items.append(
            build_stripe_line_item(
                name=formation.title,
                amount=formation.current_price_amount,
                currency=formation.price_currency,
            )
        )
        db.delete(cart_item)

    db.flush()

    try:
        session_url = create_stripe_checkout_session(
            order_references=order_references,
            line_items=line_items,
            success_url=build_stripe_success_url(settings.frontend_url),
            cancel_url=build_stripe_cancel_url(settings.frontend_url),
            customer_email=user.email,
        )
    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"Stripe: {error}") from error

    db.commit()
    return CheckoutResponse(
        message="Paiement Stripe initié. Finalisez le règlement pour activer votre inscription.",
        redirect_path=_build_checkout_redirect_path(user, dashboard_types),
        external_redirect_url=session_url,
        payment_provider="stripe",
        processed_items=len(rows),
        order_references=order_references,
    )


def checkout_cart(
    db: Session,
    user: UserRecord,
    installment_slugs: list[str] | None = None,
    use_installments: bool = False,
    payment_provider: str | None = None,
) -> CheckoutResponse:
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

    installment_set = set(installment_slugs or [])
    cart_total_amount = sum(formation.current_price_amount for _, formation in rows)
    order_level_installments = (
        bool(use_installments or installment_set)
        and cart_allows_checkout_installments(cart_total_amount)
    )
    if payment_provider == "stripe" and is_stripe_configured():
        return _checkout_cart_with_stripe(db, user, rows)
    if is_tara_money_configured():
        return _checkout_cart_with_tara(db, user, rows, order_level_installments)
    return _checkout_cart_mock(db, user, rows, order_level_installments)


def list_user_enrollments(db: Session, user: UserRecord) -> list[EnrollmentView]:
    rows = db.execute(
        select(EnrollmentRecord, FormationRecord)
        .join(FormationRecord, EnrollmentRecord.formation_id == FormationRecord.id)
        .where(
            EnrollmentRecord.user_id == user.id,
            EnrollmentRecord.status.in_(("active", "completed")),
        )
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
    refresh_payment_states(db)
    db.commit()

    notifications: list[NotificationView] = []

    if user.role == "student":
        today = today_utc()
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
            due_prefix = ""
            if payment.installment_number is not None:
                due_prefix = f"Tranche {payment.installment_number} · "
            if payment.due_date is not None:
                due_prefix += f"échéance {payment.due_date.strftime('%d/%m/%Y')} · "

            if payment.status == "confirmed":
                title = "Paiement confirmé"
                message = (
                    f"Le paiement de {format_fcfa(payment.amount) or f'{payment.amount} FCFA'} "
                    f"pour {formation_title} a été confirmé."
                )
                tone = "success"
                action_label = "Accéder à mon espace"
                action_path = "/espace/etudiant"
                created_at = combine_date_to_utc(payment.paid_at or payment.created_at)
            elif payment.status == "late":
                title = "Échéance en retard"
                message = (
                    f"{due_prefix}le paiement de {format_fcfa(payment.amount) or f'{payment.amount} FCFA'} "
                    f"pour {formation_title} est en retard."
                )
                tone = "warning"
                action_label = "Voir mes notifications"
                action_path = "/notifications"
                created_at = combine_date_to_utc(day=payment.due_date or today)
            elif payment.status == "pending" and payment.due_date is not None and payment.due_date <= today:
                title = "Échéance aujourd'hui"
                message = (
                    f"{due_prefix}le paiement de {format_fcfa(payment.amount) or f'{payment.amount} FCFA'} "
                    f"pour {formation_title} doit être régularisé aujourd'hui."
                )
                tone = "warning"
                action_label = "Voir mes notifications"
                action_path = "/notifications"
                created_at = combine_date_to_utc(day=payment.due_date)
            elif payment.status == "pending" and payment_due_label(payment) == "Echeance proche":
                title = "Échéance à venir"
                message = (
                    f"{due_prefix}le paiement de {format_fcfa(payment.amount) or f'{payment.amount} FCFA'} "
                    f"pour {formation_title} approche."
                )
                tone = "warning"
                action_label = "Voir mes notifications"
                action_path = "/notifications"
                created_at = combine_date_to_utc(day=payment.due_date)
            else:
                title = "Paiement à régulariser"
                message = (
                    f"{due_prefix}le paiement de {format_fcfa(payment.amount) or f'{payment.amount} FCFA'} "
                    f"pour {formation_title} nécessite une régularisation."
                )
                tone = "warning"
                action_label = "Voir mes notifications"
                action_path = "/notifications"
                created_at = combine_date_to_utc(payment.created_at)

            notifications.append(
                NotificationView(
                    id=f"payment-{payment.id}",
                    title=title,
                    message=message,
                    tone=tone,  # type: ignore[arg-type]
                    category="payment",
                    created_at=created_at,
                    action_label=action_label,
                    action_path=action_path,
                )
            )

        enrollment_rows = db.execute(
            select(EnrollmentRecord, FormationRecord)
            .join(FormationRecord, EnrollmentRecord.formation_id == FormationRecord.id)
            .where(EnrollmentRecord.user_id == user.id)
            .order_by(EnrollmentRecord.created_at.desc())
        ).all()

        for enrollment, formation in enrollment_rows:
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

        if user.student_code:
            notifications.append(
                NotificationView(
                    id=f"student-code-{user.id}",
                    title="Code academique attribue",
                    message=(
                        f"Votre code academique est {user.student_code}. "
                        "Il vous identifie officiellement en tant qu'etudiant de l'Academie "
                        "des Creatifs et est valable pour toutes vos formations."
                    ),
                    tone="success",
                    category="system",
                    created_at=utc_now(),
                    action_label="Mon espace etudiant",
                    action_path="/espace/etudiant",
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
        late_payments = db.scalar(
            select(func.count()).select_from(PaymentRecord).where(PaymentRecord.status == "late")
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
                    message=(
                        f"{pending_payments} paiement(s) en attente et {late_payments} en retard "
                        "necessitent un suivi."
                    ),
                    tone="warning" if pending_payments > 0 or late_payments > 0 else "info",
                    category="admin",
                    created_at=utc_now(),
                    action_label="Voir les paiements",
                    action_path="/admin/paiements",
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
