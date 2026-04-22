from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import (
    AssignmentRecord,
    AssignmentSubmissionRecord,
    CartItemRecord,
    EnrollmentRecord,
    FavoriteItemRecord,
    FormationRecord,
    FormationSessionRecord,
    GradeRecord,
    OrderRecord,
    PaymentRecord,
    QuizAttemptRecord,
    QuizRecord,
    ResourceRecord,
    SessionLiveEventRecord,
    TeacherProfileRecord,
    UserRecord,
)
from app.schemas.commerce import (
    AssignedTeacherView,
    CartItemView,
    CartSnapshot,
    CheckoutResponse,
    EnrollmentView,
    FavoriteItemView,
    FavoriteSnapshot,
    GroupedInstallmentView,
    InstallmentLine,
    NotificationView,
    StudentDashboardSummary,
    StudentOrderGroupView,
    StudentOrderSummary,
    StudentPaymentLineView,
)
from app.services.auth import build_avatar_initials, get_dashboard_path
from app.services.catalog import format_fcfa, should_allow_installments
from app.services.email import OrderEmailData, send_order_confirmation
from app.services.formation_sessions import find_current_or_next_session, get_session_presentation
from app.services.order_access import sync_order_enrollment_access
from app.services.order_confirmations import send_order_confirmation_for_orders
from app.services.payments import payment_due_label, refresh_payment_states, today_utc
from app.services.tara_money import (
    build_tara_payment_product_id,
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


def _resolve_checkout_session(
    db: Session,
    cart_item: CartItemRecord,
    formation: FormationRecord,
) -> FormationSessionRecord | None:
    if cart_item.session_id is not None:
        session = db.get(FormationSessionRecord, cart_item.session_id)
        if session is not None:
            return session
    return find_current_or_next_session(db, formation.id)


def _where_same_session(statement, model, session_id: int | None):
    if session_id is None:
        return statement.where(model.session_id.is_(None))
    return statement.where(model.session_id == session_id)


def ensure_no_duplicate_purchase(
    db: Session,
    user: UserRecord,
    formation: FormationRecord,
    session: FormationSessionRecord | None,
) -> None:
    session_id = session.id if session is not None else None

    enrollment_statement = select(EnrollmentRecord).where(
        EnrollmentRecord.user_id == user.id,
        EnrollmentRecord.formation_id == formation.id,
        EnrollmentRecord.status.in_(("active", "completed", "pending", "suspended")),
    )
    enrollment = db.scalar(_where_same_session(enrollment_statement, EnrollmentRecord, session_id))
    if enrollment is not None:
        label = session.label if session is not None else "ce parcours"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vous êtes déjà inscrit à {label}.",
        )

    order_statement = select(OrderRecord).where(
        OrderRecord.user_id == user.id,
        OrderRecord.formation_id == formation.id,
        OrderRecord.status.in_(("pending", "partially_paid", "paid")),
    )
    order = db.scalar(_where_same_session(order_statement, OrderRecord, session_id))
    if order is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Une commande existe déjà pour cette formation et cette session. "
                "Consultez vos paiements pour finaliser ou suivre cette commande."
            ),
        )


def _cancel_unpaid_checkout_attempts_for_retry(
    db: Session,
    user: UserRecord,
    formation: FormationRecord,
    session: FormationSessionRecord | None,
) -> None:
    orders = db.scalars(
        select(OrderRecord).where(
            OrderRecord.user_id == user.id,
            OrderRecord.formation_id == formation.id,
            OrderRecord.status == "pending",
        )
    ).all()

    for order in orders:
        confirmed_count = (
            db.scalar(
                select(func.count(PaymentRecord.id)).where(
                    PaymentRecord.order_reference == order.reference,
                    PaymentRecord.status == "confirmed",
                )
            )
            or 0
        )
        if confirmed_count:
            continue

        payments = db.scalars(
            select(PaymentRecord).where(PaymentRecord.order_reference == order.reference)
        ).all()
        for payment in payments:
            if payment.status in {"pending", "late", "failed"}:
                payment.status = "cancelled"
                db.add(payment)

        order.status = "cancelled"
        db.add(order)

    db.flush()


def _build_installment_preview(
    db: Session,
    rows: list[tuple[CartItemRecord, FormationRecord]],
    *,
    allow_installments: bool,
) -> dict[str, list[InstallmentLine]]:
    if not allow_installments:
        return {}

    today = today_utc()
    preview: dict[str, list[InstallmentLine]] = {}
    for cart_item, formation in rows:
        session = _resolve_checkout_session(db, cart_item, formation)
        session_end = session.end_date if session is not None else today + timedelta(days=60)
        n_inst, due_dates, amounts = _compute_installment_schedule(
            total=formation.current_price_amount,
            session_end_date=session_end,
            today=today,
            allow_installments=True,
        )
        if n_inst <= 1:
            continue
        preview[formation.slug] = [
            InstallmentLine(
                number=index + 1,
                amount=amount,
                amount_label=format_fcfa(amount) or f"{amount} {formation.price_currency}",
                due_date=due_date,
                status="preview",
            )
            for index, (amount, due_date) in enumerate(zip(amounts, due_dates))
        ]
    return preview


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
        installment_schedules_preview=_build_installment_preview(
            db,
            rows,
            allow_installments=allow_installments,
        ),
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
    if user.role not in {"guest", "student"}:
        return build_cart_snapshot(db, [])

    rows = db.execute(
        select(CartItemRecord, FormationRecord)
        .join(FormationRecord, CartItemRecord.formation_id == FormationRecord.id)
        .where(CartItemRecord.user_id == user.id)
        .order_by(CartItemRecord.created_at.desc())
    ).all()
    return build_cart_snapshot(db, rows)


def ensure_commerce_user(user: UserRecord) -> None:
    if user.role not in {"guest", "student"}:
        if user.role == "admin":
            detail = "Votre compte administrateur ne peut pas effectuer d'achat."
        elif user.role == "teacher":
            detail = "Votre compte enseignant ne peut pas effectuer d'achat."
        else:
            detail = "Ce compte ne peut pas effectuer d'achat."

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


def list_favorite_snapshot(db: Session, user: UserRecord) -> FavoriteSnapshot:
    rows = db.execute(
        select(FavoriteItemRecord, FormationRecord)
        .join(FormationRecord, FavoriteItemRecord.formation_id == FormationRecord.id)
        .where(FavoriteItemRecord.user_id == user.id)
        .order_by(FavoriteItemRecord.created_at.desc())
    ).all()
    return build_favorite_snapshot(db, rows)


def add_item_to_cart(db: Session, user: UserRecord, formation_slug: str) -> CartSnapshot:
    ensure_commerce_user(user)

    formation = db.scalar(select(FormationRecord).where(FormationRecord.slug == formation_slug))
    if formation is None:
        raise HTTPException(status_code=404, detail="Formation introuvable.")

    ensure_can_purchase(db, formation)
    session = find_current_or_next_session(db, formation.id)

    existing = db.scalar(
        select(CartItemRecord).where(
            CartItemRecord.user_id == user.id,
            CartItemRecord.formation_id == formation.id,
        )
    )
    if existing is not None:
        return list_cart_snapshot(db, user)

    _cancel_unpaid_checkout_attempts_for_retry(db, user, formation, session)
    ensure_no_duplicate_purchase(db, user, formation, session)

    if existing is None:
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
    session: FormationSessionRecord | None = None,
    teacher_cache: dict[str, AssignedTeacherView | None] | None = None,
) -> EnrollmentView:
    return EnrollmentView(
        id=enrollment.id,
        formation_id=formation.id,
        session_id=enrollment.session_id,
        formation_slug=formation.slug,
        formation_title=formation.title,
        image=formation.image,
        format_type=enrollment.format_type,  # type: ignore[arg-type]
        dashboard_type=enrollment.dashboard_type,  # type: ignore[arg-type]
        order_reference=enrollment.order_reference,
        status=enrollment.status,
        student_code=student_code,
        session_label=get_enrollment_session_label(db, enrollment, formation),
        assigned_teacher=build_assigned_teacher_view(db, session, cache=teacher_cache),
        created_at=enrollment.created_at,
    )


def build_assigned_teacher_view(
    db: Session,
    session: FormationSessionRecord | None,
    *,
    cache: dict[str, AssignedTeacherView | None] | None = None,
) -> AssignedTeacherView | None:
    teacher_name = (session.teacher_name or "").strip() if session is not None else ""
    if not teacher_name:
        return None

    if cache is not None and teacher_name in cache:
        return cache[teacher_name]

    row = db.execute(
        select(UserRecord, TeacherProfileRecord)
        .outerjoin(TeacherProfileRecord, TeacherProfileRecord.user_id == UserRecord.id)
        .where(
            UserRecord.role == "teacher",
            UserRecord.full_name == teacher_name,
        )
        .limit(1)
    ).first()

    if row is None:
        if cache is not None:
            cache[teacher_name] = None
        return None

    teacher_user, teacher_profile = row
    teacher = AssignedTeacherView(
        full_name=teacher_user.full_name,
        teacher_code=teacher_profile.teacher_code if teacher_profile is not None else None,
        avatar_initials=build_avatar_initials(teacher_user.full_name),
        avatar_url=teacher_user.avatar_url,
        email=teacher_user.email,
        whatsapp=(
            teacher_profile.whatsapp
            if teacher_profile is not None and teacher_profile.whatsapp
            else teacher_user.phone
        ),
    )

    if cache is not None:
        cache[teacher_name] = teacher
    return teacher


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


def _build_group_reference(db: Session, year: int) -> str:
    prefix = f"AC-GRP-{year}-"
    existing = db.scalars(
        select(OrderRecord.group_reference).where(OrderRecord.group_reference.like(f"{prefix}%"))
    ).all()
    highest = 0
    for ref in existing:
        if ref:
            suffix = ref.removeprefix(prefix)
            if suffix.isdigit():
                highest = max(highest, int(suffix))
    return f"AC-GRP-{year}-{highest + 1:04d}"


def build_grouped_orders(
    db: Session,
    orders: list[OrderRecord],
) -> list[StudentOrderGroupView]:
    from collections import defaultdict
    from app.services.payments import payment_due_label

    # group by group_reference (fallback = order.reference for legacy orders)
    groups: dict[str, list[OrderRecord]] = defaultdict(list)
    for order in orders:
        key = order.group_reference or order.reference
        groups[key].append(order)

    result: list[StudentOrderGroupView] = []
    for group_ref, group_orders in groups.items():
        group_orders_sorted = sorted(group_orders, key=lambda o: o.created_at)
        created_at = group_orders_sorted[0].created_at

        # collect all payments across orders in this group
        all_payments: list[PaymentRecord] = []
        for order in group_orders_sorted:
            payments = db.scalars(
                select(PaymentRecord)
                .where(PaymentRecord.order_reference == order.reference)
                .order_by(PaymentRecord.installment_number.nullsfirst(), PaymentRecord.id)
            ).all()
            all_payments.extend(payments)

        # group payments by installment_number
        inst_buckets: dict[int | None, list[PaymentRecord]] = defaultdict(list)
        for p in all_payments:
            inst_buckets[p.installment_number].append(p)

        grouped_payments: list[GroupedInstallmentView] = []
        for inst_num in sorted(inst_buckets.keys(), key=lambda x: (x is None, x)):
            bucket = inst_buckets[inst_num]
            total = sum(p.amount for p in bucket)
            statuses = {p.status for p in bucket}
            if statuses == {"confirmed"}:
                grp_status = "confirmed"
            elif "confirmed" in statuses:
                grp_status = "partially_confirmed"
            else:
                grp_status = "pending"
            due_date = min((p.due_date for p in bucket if p.due_date), default=None)
            can_pay = any(p.status in {"pending", "failed"} for p in bucket)
            grouped_payments.append(GroupedInstallmentView(
                installment_number=inst_num,
                checkout_key="single" if inst_num is None else str(inst_num),
                amount=total,
                amount_label=format_fcfa(total) or f"{total} FCFA",
                due_date=due_date,
                status=grp_status,
                can_pay=can_pay,
                payment_ids=[p.id for p in bucket],
            ))

        total_amount = sum(o.total_amount for o in group_orders_sorted)
        if all(o.status == "paid" for o in group_orders_sorted):
            grp_order_status = "paid"
        elif any(p.status == "confirmed" for p in all_payments):
            grp_order_status = "partially_paid"
        elif any(o.status == "failed" for o in group_orders_sorted):
            grp_order_status = "failed"
        elif any(o.status == "cancelled" for o in group_orders_sorted):
            grp_order_status = "cancelled"
        else:
            grp_order_status = "pending"

        # installment plan: if any order has installments, show that plan
        plans = [o.installment_plan for o in group_orders_sorted if o.installment_plan != "full"]
        installment_plan = plans[0] if plans else "full"

        result.append(StudentOrderGroupView(
            group_reference=group_ref,
            created_at=created_at,
            orders=[
                StudentOrderSummary(
                    reference=o.reference,
                    formation_title=o.formation_title,
                    format_type=o.format_type,
                    total_amount=o.total_amount,
                    total_amount_label=format_fcfa(o.total_amount) or f"{o.total_amount} FCFA",
                    status=o.status,
                )
                for o in group_orders_sorted
            ],
            total_amount=total_amount,
            total_amount_label=format_fcfa(total_amount) or f"{total_amount} FCFA",
            installment_plan=installment_plan,
            status=grp_order_status,
            grouped_payments=grouped_payments,
            payments=[
                StudentPaymentLineView(
                    id=p.id,
                    installment_number=p.installment_number,
                    amount=p.amount,
                    amount_label=format_fcfa(p.amount) or f"{p.amount} FCFA",
                    currency=p.currency,
                    provider_code=p.provider_code,
                    status=p.status,
                    due_date=p.due_date,
                    paid_at=p.paid_at,
                    due_label=payment_due_label(p),
                    can_pay=p.status in {"pending", "failed"},
                    checkout_url=p.provider_checkout_url,
                )
                for p in all_payments
            ],
        ))

    result.sort(key=lambda g: g.created_at, reverse=True)
    return result


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
    group_reference = _build_group_reference(db, now.year) if len(rows) > 1 else None

    for index, (cart_item, formation) in enumerate(rows):
        ensure_can_purchase(db, formation)
        order_reference = _build_order_reference(db, now.year, index)
        order_references.append(order_reference)
        dashboard_types.add(formation.dashboard_type)

        session = _resolve_checkout_session(db, cart_item, formation)
        _cancel_unpaid_checkout_attempts_for_retry(db, user, formation, session)
        ensure_no_duplicate_purchase(db, user, formation, session)
        session_end = session.end_date if session is not None else today + timedelta(days=60)

        n_inst, due_dates, amounts = _compute_installment_schedule(
            total=formation.current_price_amount,
            session_end_date=session_end,
            today=today,
            allow_installments=use_installments,
        )
        is_installment = n_inst > 1

        order_status = "partially_paid" if is_installment else "paid"
        order = OrderRecord(
            reference=order_reference,
            group_reference=group_reference,
            user_id=user.id,
            formation_id=formation.id,
            session_id=session.id if session is not None else None,
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
    due_today_payments: list[PaymentRecord] = []
    group_reference = _build_group_reference(db, now.year) if len(rows) > 1 else None

    for index, (cart_item, formation) in enumerate(rows):
        ensure_can_purchase(db, formation)
        order_reference = _build_order_reference(db, now.year, index)
        order_references.append(order_reference)
        dashboard_types.add(formation.dashboard_type)
        if not picture_url and formation.image:
            picture_url = formation.image

        session = _resolve_checkout_session(db, cart_item, formation)
        _cancel_unpaid_checkout_attempts_for_retry(db, user, formation, session)
        ensure_no_duplicate_purchase(db, user, formation, session)
        session_end = session.end_date if session is not None else today + timedelta(days=60)

        n_inst, due_dates, amounts = _compute_installment_schedule(
            total=formation.current_price_amount,
            session_end_date=session_end,
            today=today,
            allow_installments=use_installments,
        )
        is_installment = n_inst > 1

        order = OrderRecord(
            reference=order_reference,
            group_reference=group_reference,
            user_id=user.id,
            formation_id=formation.id,
            session_id=session.id if session is not None else None,
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
                payment = PaymentRecord(
                    order_reference=order_reference,
                    payer_name=user.full_name,
                    amount=amt,
                    currency=formation.price_currency,
                    provider_code="tara_money",
                    status="pending",
                    paid_at=None,
                    installment_number=i + 1,
                    due_date=due,
                )
                db.add(payment)
                if i == 0:
                    due_today_payments.append(payment)
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
            payment = PaymentRecord(
                order_reference=order_reference,
                payer_name=user.full_name,
                amount=formation.current_price_amount,
                currency=formation.price_currency,
                provider_code="tara_money",
                status="pending",
                paid_at=None,
                due_date=today + timedelta(days=3),
            )
            db.add(payment)
            due_today_payments.append(payment)
            due_today_total += formation.current_price_amount

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

    product_id = build_tara_payment_product_id([payment.id for payment in due_today_payments])

    try:
        payment_links = create_tara_payment_link(
            product_id=product_id,
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

    checkout_url = payment_links.preferred_redirect_url()
    for payment in due_today_payments:
        payment.provider_payment_id = product_id
        payment.provider_checkout_url = checkout_url
        db.add(payment)

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
    use_installments: bool,
) -> CheckoutResponse:
    order_references: list[str] = []
    installment_schedules: dict[str, list[InstallmentLine]] = {}
    dashboard_types: set[str] = set()
    checkout_payments: list[tuple[PaymentRecord, str]] = []
    now = utc_now()
    today = now.date()
    group_reference = _build_group_reference(db, now.year) if len(rows) > 1 else None

    for index, (cart_item, formation) in enumerate(rows):
        ensure_can_purchase(db, formation)
        order_reference = _build_order_reference(db, now.year, index)
        order_references.append(order_reference)
        dashboard_types.add(formation.dashboard_type)
        session = _resolve_checkout_session(db, cart_item, formation)
        _cancel_unpaid_checkout_attempts_for_retry(db, user, formation, session)
        ensure_no_duplicate_purchase(db, user, formation, session)
        session_end = session.end_date if session is not None else today + timedelta(days=60)

        n_inst, due_dates, amounts = _compute_installment_schedule(
            total=formation.current_price_amount,
            session_end_date=session_end,
            today=today,
            allow_installments=use_installments,
        )
        is_installment = n_inst > 1

        order = OrderRecord(
            reference=order_reference,
            group_reference=group_reference,
            user_id=user.id,
            formation_id=formation.id,
            session_id=session.id if session is not None else None,
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
                payment = PaymentRecord(
                    order_reference=order_reference,
                    payer_name=user.full_name,
                    amount=amt,
                    currency=formation.price_currency,
                    provider_code="stripe",
                    status="pending",
                    paid_at=None,
                    installment_number=i + 1,
                    due_date=due,
                )
                db.add(payment)
                if i == 0:
                    checkout_payments.append((payment, f"{formation.title} - versement 1"))
                schedule.append(InstallmentLine(
                    number=i + 1,
                    amount=amt,
                    amount_label=format_fcfa(amt),
                    due_date=due,
                    status="pending",
                ))
            installment_schedules[order_reference] = schedule
        else:
            payment = PaymentRecord(
                order_reference=order_reference,
                payer_name=user.full_name,
                amount=formation.current_price_amount,
                currency=formation.price_currency,
                provider_code="stripe",
                status="pending",
                paid_at=None,
                due_date=today,
            )
            db.add(payment)
            checkout_payments.append((payment, formation.title))

    db.flush()
    line_items = [
        build_stripe_line_item(name=name, amount=payment.amount, currency=payment.currency)
        for payment, name in checkout_payments
    ]
    checkout_payment_ids = [payment.id for payment, _ in checkout_payments]

    try:
        session_url = create_stripe_checkout_session(
            order_references=order_references,
            line_items=line_items,
            success_url=build_stripe_success_url(settings.frontend_url),
            cancel_url=build_stripe_cancel_url(settings.frontend_url),
            customer_email=user.email,
            payment_ids=checkout_payment_ids,
        )
    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"Stripe: {error}") from error

    for payment, _ in checkout_payments:
        payment.provider_checkout_url = session_url
        db.add(payment)

    db.commit()
    return CheckoutResponse(
        message=(
            "Paiement Stripe initié pour le premier versement. Finalisez le règlement pour activer votre inscription."
            if installment_schedules
            else "Paiement Stripe initié. Finalisez le règlement pour activer votre inscription."
        ),
        redirect_path=_build_checkout_redirect_path(user, dashboard_types),
        external_redirect_url=session_url,
        payment_provider="stripe",
        processed_items=len(rows),
        order_references=order_references,
        installment_schedules=installment_schedules,
    )


def checkout_cart(
    db: Session,
    user: UserRecord,
    installment_slugs: list[str] | None = None,
    use_installments: bool = False,
    payment_provider: str | None = None,
) -> CheckoutResponse:
    ensure_commerce_user(user)

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
    if payment_provider == "stripe":
        if not is_stripe_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Stripe n'est pas configuré sur ce serveur.",
            )
        return _checkout_cart_with_stripe(db, user, rows, order_level_installments)
    if is_tara_money_configured():
        return _checkout_cart_with_tara(db, user, rows, order_level_installments)
    return _checkout_cart_mock(db, user, rows, order_level_installments)


def checkout_student_payment(
    db: Session,
    user: UserRecord,
    payment_id: int,
    payment_provider: str | None = None,
) -> CheckoutResponse:
    ensure_commerce_user(user)

    payment = db.get(PaymentRecord, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Paiement introuvable.")

    order = db.scalar(select(OrderRecord).where(OrderRecord.reference == payment.order_reference))
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Paiement introuvable.")

    refresh_payment_states(db, order_reference=order.reference)
    db.flush()
    payment = db.get(PaymentRecord, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Paiement introuvable.")

    if payment.status == "confirmed":
        return CheckoutResponse(
            message="Cette échéance est déjà confirmée.",
            redirect_path="/espace/etudiant/paiements",
            processed_items=1,
            order_references=[order.reference],
        )
    if payment.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cette échéance a été annulée.")

    if payment_provider == "stripe":
        if not is_stripe_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Stripe n'est pas configuré sur ce serveur.",
            )
        tranche_label = (
            f"versement {payment.installment_number}"
            if payment.installment_number is not None
            else "paiement"
        )
        try:
            session_url = create_stripe_checkout_session(
                order_references=[order.reference],
                line_items=[
                    build_stripe_line_item(
                        name=f"{order.formation_title} - {tranche_label}",
                        amount=payment.amount,
                        currency=payment.currency,
                    )
                ],
                success_url=build_stripe_success_url(settings.frontend_url),
                cancel_url=build_stripe_cancel_url(settings.frontend_url),
                customer_email=user.email,
                payment_ids=[payment.id],
            )
        except Exception as error:
            db.rollback()
            raise HTTPException(status_code=502, detail=f"Stripe: {error}") from error

        payment.provider_code = "stripe"
        payment.provider_checkout_url = session_url
        if payment.status == "failed":
            payment.status = "pending"
        db.add(payment)
        db.commit()
        return CheckoutResponse(
            message="Paiement Stripe initié pour cette échéance.",
            redirect_path="/espace/etudiant/paiements",
            external_redirect_url=session_url,
            payment_provider="stripe",
            processed_items=1,
            order_references=[order.reference],
        )

    formation = db.get(FormationRecord, order.formation_id) if order.formation_id is not None else None
    picture_url = formation.image if formation is not None and formation.image else "/logo_academie_hd.png"
    if picture_url.startswith("/"):
        picture_url = f"{settings.backend_public_url}{picture_url}"

    if is_tara_money_configured():
        product_id = build_tara_payment_product_id([payment.id])
        tranche_label = (
            f"tranche {payment.installment_number}"
            if payment.installment_number is not None
            else "paiement"
        )
        try:
            payment_links = create_tara_payment_link(
                product_id=product_id,
                product_name=f"{order.formation_title} - {tranche_label}",
                product_price=payment.amount,
                product_description=(
                    f"Règlement de la {tranche_label} pour {order.formation_title}."
                ),
                product_picture_url=picture_url,
                return_url=build_tara_return_url([order.reference]),
                webhook_url=build_tara_webhook_url(),
            )
        except ValueError as error:
            db.rollback()
            raise HTTPException(status_code=502, detail=str(error)) from error

        checkout_url = payment_links.preferred_redirect_url()
        payment.provider_code = "tara_money"
        payment.provider_payment_id = product_id
        payment.provider_checkout_url = checkout_url
        if payment.status == "failed":
            payment.status = "pending"
        db.add(payment)
        db.commit()
        return CheckoutResponse(
            message="Lien de paiement Tara Money généré pour cette échéance.",
            redirect_path="/espace/etudiant/paiements",
            external_redirect_url=checkout_url,
            payment_provider="tara_money",
            processed_items=1,
            order_references=[order.reference],
            payment_links={
                "whatsapp_link": payment_links.whatsapp_link,
                "telegram_link": payment_links.telegram_link,
                "dikalo_link": payment_links.dikalo_link,
                "sms_link": payment_links.sms_link,
            },
        )

    payment.provider_code = "mock_checkout"
    payment.status = "confirmed"
    payment.paid_at = utc_now()
    db.add(payment)
    db.flush()
    refresh_payment_states(db, order_reference=order.reference)
    sync_order_enrollment_access(db, order.reference)
    db.commit()
    send_order_confirmation_for_orders(db, [order.reference])
    return CheckoutResponse(
        message="Échéance confirmée en mode simulation.",
        redirect_path="/espace/etudiant/paiements",
        processed_items=1,
        order_references=[order.reference],
    )


def list_user_enrollments(db: Session, user: UserRecord) -> list[EnrollmentView]:
    rows = db.execute(
        select(EnrollmentRecord, FormationRecord, FormationSessionRecord)
        .join(FormationRecord, EnrollmentRecord.formation_id == FormationRecord.id)
        .outerjoin(FormationSessionRecord, EnrollmentRecord.session_id == FormationSessionRecord.id)
        .where(
            EnrollmentRecord.user_id == user.id,
            EnrollmentRecord.status.in_(("active", "completed")),
        )
        .order_by(EnrollmentRecord.created_at.desc())
    ).all()
    teacher_cache: dict[str, AssignedTeacherView | None] = {}
    return [
        _serialize_enrollment(
            db,
            enrollment,
            formation,
            user.student_code,
            session=session,
            teacher_cache=teacher_cache,
        )
        for enrollment, formation, session in rows
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
                ),
                PaymentRecord.status != "cancelled",
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
                action_label = "Paiements"
                action_path = "/espace/etudiant/paiements"
                created_at = combine_date_to_utc(payment.paid_at or payment.created_at)
            elif payment.status == "pending" and payment.due_date is not None and payment.due_date <= today:
                title = "Paiement à régler"
                message = (
                    f"{due_prefix}le paiement de {format_fcfa(payment.amount) or f'{payment.amount} FCFA'} "
                    f"pour {formation_title} est disponible au règlement."
                )
                tone = "warning"
                action_label = "Payer"
                action_path = "/espace/etudiant/paiements"
                created_at = combine_date_to_utc(day=payment.due_date)
            elif (
                payment.status == "pending"
                and (due_label := payment_due_label(payment)) is not None
                and (due_label == "Demain" or due_label.startswith("Dans "))
            ):
                title = "Échéance à venir"
                message = (
                    f"{due_prefix}le paiement de {format_fcfa(payment.amount) or f'{payment.amount} FCFA'} "
                    f"pour {formation_title} approche."
                )
                tone = "warning"
                action_label = "Paiements"
                action_path = "/espace/etudiant/paiements"
                created_at = combine_date_to_utc(day=payment.due_date)
            else:
                title = "Paiement à régulariser"
                message = (
                    f"{due_prefix}le paiement de {format_fcfa(payment.amount) or f'{payment.amount} FCFA'} "
                    f"pour {formation_title} nécessite une régularisation."
                )
                tone = "warning"
                action_label = "Paiements"
                action_path = "/espace/etudiant/paiements"
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
                    action_label="Parcours",
                    action_path=workspace_path,
                )
            )

        active_enrollment_rows = [
            (enrollment, formation)
            for enrollment, formation in enrollment_rows
            if enrollment.status in ("active", "completed") and enrollment.session_id is not None
        ]
        session_ids = sorted(
            {int(enrollment.session_id) for enrollment, _formation in active_enrollment_rows}
        )
        enrollment_ids = [enrollment.id for enrollment, _formation in active_enrollment_rows]
        enrollment_by_session = {
            int(enrollment.session_id): enrollment
            for enrollment, _formation in active_enrollment_rows
        }

        if session_ids and enrollment_ids:
            now = utc_now()
            submitted_rows = db.scalars(
                select(AssignmentSubmissionRecord).where(
                    AssignmentSubmissionRecord.enrollment_id.in_(enrollment_ids)
                )
            ).all()
            submitted_pairs = {
                (submission.assignment_id, submission.enrollment_id)
                for submission in submitted_rows
            }

            upcoming_assignment_rows = db.execute(
                select(AssignmentRecord, FormationSessionRecord)
                .join(FormationSessionRecord, FormationSessionRecord.id == AssignmentRecord.session_id)
                .where(
                    AssignmentRecord.session_id.in_(session_ids),
                    AssignmentRecord.due_date >= now,
                    AssignmentRecord.due_date <= now + timedelta(days=7),
                )
                .order_by(AssignmentRecord.due_date.asc(), AssignmentRecord.id.asc())
                .limit(20)
            ).all()
            shown_assignment_alerts = 0
            for assignment, session in upcoming_assignment_rows:
                enrollment = enrollment_by_session.get(assignment.session_id)
                if enrollment is None or (assignment.id, enrollment.id) in submitted_pairs:
                    continue
                due_text = combine_date_to_utc(assignment.due_date).strftime("%d/%m/%Y a %Hh%M")
                notifications.append(
                    NotificationView(
                        id=f"student-assignment-due-{assignment.id}-{enrollment.id}",
                        title="Devoir a rendre",
                        message=(
                            f"\"{assignment.title}\" est a remettre avant le "
                            f"{due_text} pour {session.label}."
                        ),
                        tone="warning",
                        category="assignment",
                        created_at=now,
                        action_label="Devoirs",
                        action_path="/espace/etudiant/devoirs",
                    )
                )
                shown_assignment_alerts += 1
                if shown_assignment_alerts >= 5:
                    break

            reviewed_submission_rows = db.execute(
                select(AssignmentSubmissionRecord, AssignmentRecord, FormationSessionRecord)
                .join(AssignmentRecord, AssignmentRecord.id == AssignmentSubmissionRecord.assignment_id)
                .join(FormationSessionRecord, FormationSessionRecord.id == AssignmentRecord.session_id)
                .where(
                    AssignmentSubmissionRecord.enrollment_id.in_(enrollment_ids),
                    AssignmentSubmissionRecord.is_reviewed.is_(True),
                )
                .order_by(AssignmentSubmissionRecord.updated_at.desc(), AssignmentSubmissionRecord.id.desc())
                .limit(3)
            ).all()
            for submission, assignment, session in reviewed_submission_rows:
                score_text = ""
                if submission.review_score is not None:
                    score_text = (
                        f" Note: {submission.review_score:g}/"
                        f"{submission.review_max_score:g}."
                    )
                notifications.append(
                    NotificationView(
                        id=f"student-assignment-reviewed-{submission.id}",
                        title="Devoir corrige",
                        message=f"Votre rendu \"{assignment.title}\" a ete corrige.{score_text}",
                        tone="success",
                        category="assignment",
                        created_at=combine_date_to_utc(submission.updated_at),
                        action_label="Devoirs",
                        action_path="/espace/etudiant/devoirs",
                    )
                )

            quiz_attempt_rows = db.scalars(
                select(QuizAttemptRecord).where(QuizAttemptRecord.enrollment_id.in_(enrollment_ids))
            ).all()
            attempts_by_quiz_enrollment: dict[tuple[int, int], list[QuizAttemptRecord]] = {}
            for attempt in quiz_attempt_rows:
                attempts_by_quiz_enrollment.setdefault(
                    (attempt.quiz_id, attempt.enrollment_id),
                    [],
                ).append(attempt)

            active_quiz_rows = db.execute(
                select(QuizRecord, FormationSessionRecord)
                .join(FormationSessionRecord, FormationSessionRecord.id == QuizRecord.session_id)
                .where(
                    QuizRecord.session_id.in_(session_ids),
                    QuizRecord.status == "active",
                )
                .order_by(QuizRecord.scheduled_at.asc().nullslast(), QuizRecord.created_at.desc())
                .limit(10)
            ).all()
            shown_quiz_alerts = 0
            for quiz, session in active_quiz_rows:
                enrollment = enrollment_by_session.get(quiz.session_id)
                if enrollment is None:
                    continue
                attempts = attempts_by_quiz_enrollment.get((quiz.id, enrollment.id), [])
                best_score = max((attempt.score_pct for attempt in attempts), default=None)
                if best_score is not None and best_score >= 50:
                    continue
                if len(attempts) >= 2:
                    continue
                title = "Quiz disponible" if not attempts else "Quiz a reprendre"
                notifications.append(
                    NotificationView(
                        id=f"student-quiz-open-{quiz.id}-{enrollment.id}",
                        title=title,
                        message=f"\"{quiz.title}\" est ouvert pour {session.label}.",
                        tone="info" if not attempts else "warning",
                        category="quiz",
                        created_at=combine_date_to_utc(quiz.scheduled_at or quiz.created_at),
                        action_label="Quiz",
                        action_path="/espace/etudiant/quizz",
                    )
                )
                shown_quiz_alerts += 1
                if shown_quiz_alerts >= 5:
                    break

            live_rows = db.execute(
                select(SessionLiveEventRecord, FormationSessionRecord)
                .join(FormationSessionRecord, FormationSessionRecord.id == SessionLiveEventRecord.session_id)
                .where(
                    SessionLiveEventRecord.session_id.in_(session_ids),
                    SessionLiveEventRecord.status.in_(("scheduled", "planned", "open")),
                    SessionLiveEventRecord.scheduled_at >= now,
                    SessionLiveEventRecord.scheduled_at <= now + timedelta(days=2),
                )
                .order_by(SessionLiveEventRecord.scheduled_at.asc(), SessionLiveEventRecord.id.asc())
                .limit(3)
            ).all()
            for live, session in live_rows:
                scheduled = combine_date_to_utc(live.scheduled_at).strftime("%d/%m/%Y a %Hh%M")
                notifications.append(
                    NotificationView(
                        id=f"student-live-{live.id}",
                        title="Live a venir",
                        message=f"{live.title} est programme le {scheduled} pour {session.label}.",
                        tone="info",
                        category="live",
                        created_at=now,
                        action_label="Rejoindre",
                        action_path=f"/live/{session.id}",
                    )
                )

            resource_visible_at = func.coalesce(ResourceRecord.published_at, ResourceRecord.created_at)
            resource_rows = db.execute(
                select(ResourceRecord, FormationSessionRecord)
                .join(FormationSessionRecord, FormationSessionRecord.id == ResourceRecord.session_id)
                .where(
                    ResourceRecord.session_id.in_(session_ids),
                    or_(ResourceRecord.published_at.is_(None), ResourceRecord.published_at <= now),
                    resource_visible_at >= now - timedelta(days=30),
                )
                .order_by(resource_visible_at.desc(), ResourceRecord.id.desc())
                .limit(3)
            ).all()
            for resource, session in resource_rows:
                notifications.append(
                    NotificationView(
                        id=f"student-resource-{resource.id}",
                        title="Nouvelle ressource",
                        message=f"\"{resource.title}\" est disponible pour {session.label}.",
                        tone="info",
                        category="resource",
                        created_at=combine_date_to_utc(resource.published_at or resource.created_at),
                        action_label="Ressources",
                        action_path="/espace/etudiant/ressources",
                    )
                )

            grade_rows = db.execute(
                select(GradeRecord, FormationSessionRecord)
                .join(FormationSessionRecord, FormationSessionRecord.id == GradeRecord.session_id)
                .where(
                    GradeRecord.enrollment_id.in_(enrollment_ids),
                    ~GradeRecord.label.ilike("Quiz:%"),
                )
                .order_by(GradeRecord.updated_at.desc(), GradeRecord.id.desc())
                .limit(3)
            ).all()
            for grade, session in grade_rows:
                notifications.append(
                    NotificationView(
                        id=f"student-grade-{grade.id}",
                        title="Nouvelle note",
                        message=(
                            f"{grade.label}: {grade.score:g}/{grade.max_score:g} "
                            f"pour {session.label}."
                        ),
                        tone="success",
                        category="result",
                        created_at=combine_date_to_utc(grade.updated_at),
                        action_label="Resultats",
                        action_path="/espace/etudiant/resultats",
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
                    action_label="Mon code",
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
                    action_label="Catalogue",
                    action_path="/formations",
                )
            )

    elif user.role == "teacher":
        sessions = db.scalars(
            select(FormationSessionRecord)
            .where(FormationSessionRecord.teacher_name == user.full_name)
            .order_by(FormationSessionRecord.start_date.asc())
        ).all()
        session_ids = [session.id for session in sessions]

        if session_ids:
            enrollment_rows = db.execute(
                select(EnrollmentRecord, UserRecord, FormationRecord, FormationSessionRecord)
                .join(UserRecord, UserRecord.id == EnrollmentRecord.user_id)
                .join(FormationRecord, FormationRecord.id == EnrollmentRecord.formation_id)
                .join(FormationSessionRecord, FormationSessionRecord.id == EnrollmentRecord.session_id)
                .where(
                    EnrollmentRecord.session_id.in_(session_ids),
                    EnrollmentRecord.status.in_(("active", "completed")),
                )
                .order_by(EnrollmentRecord.created_at.desc(), EnrollmentRecord.id.desc())
                .limit(5)
            ).all()
            for enrollment, student, formation, session in enrollment_rows:
                notifications.append(
                    NotificationView(
                        id=f"teacher-enrollment-{enrollment.id}",
                        title="Nouvel inscrit",
                        message=(
                            f"{student.full_name} a rejoint {session.label} "
                            f"pour {formation.title}."
                        ),
                        tone="success",
                        category="enrollment",
                        created_at=combine_date_to_utc(enrollment.created_at),
                        action_label="Session",
                        action_path=f"/espace/enseignant/session/{session.id}",
                    )
                )

            pending_submission_rows = db.execute(
                select(
                    AssignmentSubmissionRecord,
                    AssignmentRecord,
                    EnrollmentRecord,
                    UserRecord,
                    FormationSessionRecord,
                )
                .join(AssignmentRecord, AssignmentRecord.id == AssignmentSubmissionRecord.assignment_id)
                .join(EnrollmentRecord, EnrollmentRecord.id == AssignmentSubmissionRecord.enrollment_id)
                .join(UserRecord, UserRecord.id == EnrollmentRecord.user_id)
                .join(FormationSessionRecord, FormationSessionRecord.id == AssignmentRecord.session_id)
                .where(
                    AssignmentRecord.session_id.in_(session_ids),
                    AssignmentSubmissionRecord.is_reviewed.is_(False),
                )
                .order_by(AssignmentSubmissionRecord.submitted_at.desc(), AssignmentSubmissionRecord.id.desc())
                .limit(5)
            ).all()
            for submission, assignment, _enrollment, student, session in pending_submission_rows:
                notifications.append(
                    NotificationView(
                        id=f"teacher-submission-{submission.id}",
                        title="Nouveau rendu",
                        message=(
                            f"{student.full_name} a rendu \"{assignment.title}\" "
                            f"pour {session.label}."
                        ),
                        tone="warning",
                        category="assignment",
                        created_at=combine_date_to_utc(submission.submitted_at),
                        action_label="Corriger",
                        action_path="/espace/enseignant/devoirs",
                    )
                )

            pending_reviews_count = int(
                db.scalar(
                    select(func.count(AssignmentSubmissionRecord.id))
                    .join(AssignmentRecord, AssignmentRecord.id == AssignmentSubmissionRecord.assignment_id)
                    .where(
                        AssignmentRecord.session_id.in_(session_ids),
                        AssignmentSubmissionRecord.is_reviewed.is_(False),
                    )
                )
                or 0
            )
            if pending_reviews_count > 1:
                latest_submission = pending_submission_rows[0][0]
                notifications.append(
                    NotificationView(
                        id=(
                            f"teacher-pending-reviews-{user.id}-"
                            f"{pending_reviews_count}-{latest_submission.id}"
                        ),
                        title="Corrections en attente",
                        message=f"{pending_reviews_count} rendus attendent une correction.",
                        tone="warning",
                        category="assignment",
                        created_at=combine_date_to_utc(latest_submission.submitted_at),
                        action_label="Corriger",
                        action_path="/espace/enseignant/devoirs",
                    )
                )

            quiz_attempt_rows = db.execute(
                select(
                    QuizAttemptRecord,
                    QuizRecord,
                    EnrollmentRecord,
                    UserRecord,
                    FormationSessionRecord,
                )
                .join(QuizRecord, QuizRecord.id == QuizAttemptRecord.quiz_id)
                .join(EnrollmentRecord, EnrollmentRecord.id == QuizAttemptRecord.enrollment_id)
                .join(UserRecord, UserRecord.id == EnrollmentRecord.user_id)
                .join(FormationSessionRecord, FormationSessionRecord.id == QuizRecord.session_id)
                .where(QuizRecord.session_id.in_(session_ids))
                .order_by(QuizAttemptRecord.submitted_at.desc(), QuizAttemptRecord.id.desc())
                .limit(5)
            ).all()
            for attempt, quiz, _enrollment, student, session in quiz_attempt_rows:
                notifications.append(
                    NotificationView(
                        id=f"teacher-quiz-attempt-{attempt.id}",
                        title="Quiz soumis",
                        message=(
                            f"{student.full_name} a termine \"{quiz.title}\" "
                            f"avec {attempt.score_pct:.0f}% pour {session.label}."
                        ),
                        tone="success" if attempt.score_pct >= 50 else "warning",
                        category="quiz",
                        created_at=combine_date_to_utc(attempt.submitted_at),
                        action_label="Quiz",
                        action_path="/espace/enseignant/quizz",
                    )
                )

            now = utc_now()
            live_rows = db.execute(
                select(SessionLiveEventRecord, FormationSessionRecord)
                .join(FormationSessionRecord, FormationSessionRecord.id == SessionLiveEventRecord.session_id)
                .where(
                    SessionLiveEventRecord.session_id.in_(session_ids),
                    SessionLiveEventRecord.status.in_(("scheduled", "planned", "open")),
                    SessionLiveEventRecord.scheduled_at >= now,
                    SessionLiveEventRecord.scheduled_at <= now + timedelta(days=2),
                )
                .order_by(SessionLiveEventRecord.scheduled_at.asc(), SessionLiveEventRecord.id.asc())
                .limit(3)
            ).all()
            for live, session in live_rows:
                scheduled = combine_date_to_utc(live.scheduled_at).strftime("%d/%m/%Y a %Hh%M")
                notifications.append(
                    NotificationView(
                        id=f"teacher-live-{live.id}",
                        title="Live a venir",
                        message=f"{live.title} est programme le {scheduled} pour {session.label}.",
                        tone="info",
                        category="live",
                        created_at=now,
                        action_label="Live",
                        action_path=f"/espace/enseignant/session/{session.id}",
                    )
                )

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
                    action_label="Session",
                    action_path=f"/espace/enseignant/session/{session.id}",
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
                    action_label="Espace",
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
                    action_label="Commandes",
                    action_path="/admin/commandes",
                ),
                NotificationView(
                    id="admin-pending-payments",
                    title="Paiements a surveiller",
                    message=(
                        f"{pending_payments} paiement(s) en attente necessitent un suivi."
                    ),
                    tone="warning" if pending_payments > 0 else "info",
                    category="admin",
                    created_at=utc_now(),
                    action_label="Paiements",
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
                    action_label="Performance",
                    action_path="/admin/performance",
                ),
            ]
        )

    return sorted(notifications, key=lambda item: item.created_at, reverse=True)
