from app.core.security import utc_now
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    FormationRecord,
    OnsiteSessionRecord,
    OrderRecord,
    PaymentRecord,
    UserRecord,
)
from app.schemas.catalog import (
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
    DashboardType,
    FormationCatalogItem,
    FormationBadge,
    FormatType,
)


def format_fcfa(amount: int | None) -> str | None:
    if amount is None:
        return None
    return f"{amount:,}".replace(",", " ") + " FCFA"


def get_dashboard_type_for_format(format_type: FormatType) -> DashboardType:
    if format_type == "ligne":
        return "classic"
    return "guided"


def should_allow_installments(format_type: FormatType, current_price_amount: int) -> bool:
    return format_type == "presentiel" and current_price_amount > 90000


def normalize_marketing_badges(
    badges: list[str] | None,
    *,
    current_price_amount: int,
    original_price_amount: int | None,
) -> list[FormationBadge]:
    normalized: list[FormationBadge] = []

    for badge in badges or []:
        if badge not in {"premium", "populaire"}:
            continue
        if badge not in normalized:
            normalized.append(badge)  # type: ignore[arg-type]

    if original_price_amount is not None and original_price_amount > current_price_amount:
        normalized.append("promo")

    return normalized


def apply_formation_business_rules(record: FormationRecord) -> None:
    record.dashboard_type = get_dashboard_type_for_format(record.format_type)  # type: ignore[arg-type]
    record.allow_installments = should_allow_installments(
        record.format_type,  # type: ignore[arg-type]
        record.current_price_amount,
    )
    record.badges = [
        badge
        for badge in normalize_marketing_badges(
            list(record.badges or []),
            current_price_amount=record.current_price_amount,
            original_price_amount=record.original_price_amount,
        )
        if badge != "promo"
    ]


def serialize_catalog_item(record: FormationRecord) -> FormationCatalogItem:
    current_price = record.current_price_amount
    original_price = record.original_price_amount
    format_type = record.format_type  # type: ignore[assignment]
    dashboard_type = record.dashboard_type  # type: ignore[assignment]

    return FormationCatalogItem(
        id=record.id,
        slug=record.slug,
        title=record.title,
        category=record.category,
        level=record.level,
        image=record.image,
        format_type=format_type,
        dashboard_type=dashboard_type,
        session_label=record.session_label,
        current_price_amount=current_price,
        current_price_label=format_fcfa(current_price) or "",
        original_price_amount=original_price,
        original_price_label=format_fcfa(original_price),
        price_currency=record.price_currency,
        allow_installments=record.allow_installments,
        rating=record.rating,
        reviews=record.reviews,
        badges=normalize_marketing_badges(
            list(record.badges or []),
            current_price_amount=current_price,
            original_price_amount=original_price,
        ),
    )


def list_catalog_items(db: Session) -> list[FormationCatalogItem]:
    records = db.scalars(select(FormationRecord).order_by(FormationRecord.id)).all()
    return [serialize_catalog_item(record) for record in records]


def get_catalog_item(db: Session, slug: str) -> FormationCatalogItem | None:
    record = db.scalar(select(FormationRecord).where(FormationRecord.slug == slug))
    if record is None:
        return None
    return serialize_catalog_item(record)


def create_catalog_entry(
    db: Session,
    payload: AdminFormationCreate,
) -> FormationCatalogItem:
    existing = db.scalar(select(FormationRecord).where(FormationRecord.slug == payload.slug))
    if existing is not None:
        raise ValueError("Une formation avec ce slug existe deja.")

    if (
        payload.original_price_amount is not None
        and payload.original_price_amount < payload.current_price_amount
    ):
        raise ValueError("Le prix barre ne peut pas etre inferieur au prix actuel.")

    record = FormationRecord(
        slug=payload.slug,
        title=payload.title,
        category=payload.category,
        level=payload.level,
        image=payload.image,
        format_type=payload.format_type,
        dashboard_type=get_dashboard_type_for_format(payload.format_type),
        session_label=payload.session_label,
        current_price_amount=payload.current_price_amount,
        original_price_amount=payload.original_price_amount,
        price_currency="XAF",
        allow_installments=should_allow_installments(
            payload.format_type, payload.current_price_amount
        ),
        rating=payload.rating,
        reviews=payload.reviews,
        badges=list(payload.badges),
    )
    apply_formation_business_rules(record)

    db.add(record)
    db.commit()
    db.refresh(record)
    return serialize_catalog_item(record)


def update_catalog_entry(
    db: Session, slug: str, payload: AdminFormationUpdate
) -> FormationCatalogItem | None:
    record = db.scalar(select(FormationRecord).where(FormationRecord.slug == slug))
    if record is None:
        return None

    if "title" in payload.model_fields_set and payload.title is not None:
        record.title = payload.title

    if "category" in payload.model_fields_set and payload.category is not None:
        record.category = payload.category

    if "level" in payload.model_fields_set and payload.level is not None:
        record.level = payload.level

    if "image" in payload.model_fields_set and payload.image is not None:
        record.image = payload.image

    if "format_type" in payload.model_fields_set and payload.format_type is not None:
        record.format_type = payload.format_type

    if "rating" in payload.model_fields_set and payload.rating is not None:
        record.rating = payload.rating

    if "reviews" in payload.model_fields_set and payload.reviews is not None:
        record.reviews = payload.reviews

    if (
        "current_price_amount" in payload.model_fields_set
        and payload.current_price_amount is not None
    ):
        record.current_price_amount = payload.current_price_amount

    if "original_price_amount" in payload.model_fields_set:
        record.original_price_amount = payload.original_price_amount

    if "session_label" in payload.model_fields_set and payload.session_label is not None:
        record.session_label = payload.session_label

    if "badges" in payload.model_fields_set and payload.badges is not None:
        record.badges = list(payload.badges)

    if (
        record.original_price_amount is not None
        and record.original_price_amount < record.current_price_amount
    ):
        raise ValueError("Le prix barre ne peut pas etre inferieur au prix actuel.")

    apply_formation_business_rules(record)

    db.add(record)
    db.commit()
    db.refresh(record)
    return serialize_catalog_item(record)


def get_admin_overview(db: Session) -> AdminDashboardOverview:
    formations_count = db.scalar(select(func.count()).select_from(FormationRecord)) or 0
    live_formations_count = (
        db.scalar(
            select(func.count()).select_from(FormationRecord).where(FormationRecord.format_type == "live")
        )
        or 0
    )
    ligne_formations_count = (
        db.scalar(
            select(func.count()).select_from(FormationRecord).where(FormationRecord.format_type == "ligne")
        )
        or 0
    )
    presentiel_formations_count = (
        db.scalar(
            select(func.count())
            .select_from(FormationRecord)
            .where(FormationRecord.format_type == "presentiel")
        )
        or 0
    )
    presentiel_sessions_count = (
        db.scalar(select(func.count()).select_from(OnsiteSessionRecord)) or 0
    )
    users_count = db.scalar(select(func.count()).select_from(UserRecord)) or 0
    paid_orders_count = (
        db.scalar(select(func.count()).select_from(OrderRecord).where(OrderRecord.status == "paid"))
        or 0
    )
    pending_orders_count = (
        db.scalar(select(func.count()).select_from(OrderRecord).where(OrderRecord.status == "pending"))
        or 0
    )
    confirmed_payments_count = (
        db.scalar(
            select(func.count()).select_from(PaymentRecord).where(PaymentRecord.status == "confirmed")
        )
        or 0
    )
    pending_payments_count = (
        db.scalar(
            select(func.count()).select_from(PaymentRecord).where(PaymentRecord.status == "pending")
        )
        or 0
    )
    total_confirmed_revenue_amount = (
        db.scalar(
            select(func.coalesce(func.sum(PaymentRecord.amount), 0)).where(
                PaymentRecord.status == "confirmed"
            )
        )
        or 0
    )

    return AdminDashboardOverview(
        formations_count=formations_count,
        live_formations_count=live_formations_count,
        ligne_formations_count=ligne_formations_count,
        presentiel_formations_count=presentiel_formations_count,
        presentiel_sessions_count=presentiel_sessions_count,
        users_count=users_count,
        paid_orders_count=paid_orders_count,
        pending_orders_count=pending_orders_count,
        confirmed_payments_count=confirmed_payments_count,
        pending_payments_count=pending_payments_count,
        total_confirmed_revenue_amount=int(total_confirmed_revenue_amount),
        total_confirmed_revenue_label=format_fcfa(int(total_confirmed_revenue_amount)) or "0 FCFA",
    )


def list_admin_users(db: Session) -> list[AdminUserItem]:
    records = db.scalars(select(UserRecord).order_by(UserRecord.created_at.desc())).all()
    return [
        AdminUserItem(
            id=record.id,
            full_name=record.full_name,
            email=record.email,
            role=record.role,
            status=record.status,
            created_at=record.created_at,
        )
        for record in records
    ]


def update_admin_user(
    db: Session,
    user_id: int,
    payload: AdminUserUpdate,
) -> AdminUserItem | None:
    record = db.get(UserRecord, user_id)
    if record is None:
        return None

    if payload.role is not None:
        record.role = payload.role

    if payload.status is not None:
        record.status = payload.status

    db.add(record)
    db.commit()
    db.refresh(record)
    return AdminUserItem(
        id=record.id,
        full_name=record.full_name,
        email=record.email,
        role=record.role,  # type: ignore[arg-type]
        status=record.status,  # type: ignore[arg-type]
        created_at=record.created_at,
    )


def list_admin_onsite_sessions(db: Session) -> list[AdminOnsiteSessionItem]:
    records = db.scalars(
        select(OnsiteSessionRecord).order_by(OnsiteSessionRecord.start_date.asc())
    ).all()
    return [
        AdminOnsiteSessionItem(
            id=record.id,
            formation_title=record.formation_title,
            label=record.label,
            start_date=record.start_date,
            campus_label=record.campus_label,
            seat_capacity=record.seat_capacity,
            enrolled_count=record.enrolled_count,
            teacher_name=record.teacher_name,
            status=record.status,
        )
        for record in records
    ]


def update_admin_onsite_session(
    db: Session,
    session_id: int,
    payload: AdminOnsiteSessionUpdate,
) -> AdminOnsiteSessionItem | None:
    record = db.get(OnsiteSessionRecord, session_id)
    if record is None:
        return None

    if payload.label is not None:
        record.label = payload.label
    if payload.start_date is not None:
        record.start_date = payload.start_date
    if payload.campus_label is not None:
        record.campus_label = payload.campus_label
    if payload.seat_capacity is not None:
        record.seat_capacity = payload.seat_capacity
    if payload.teacher_name is not None:
        record.teacher_name = payload.teacher_name
    if payload.status is not None:
        record.status = payload.status

    db.add(record)
    db.commit()
    db.refresh(record)
    return AdminOnsiteSessionItem(
        id=record.id,
        formation_title=record.formation_title,
        label=record.label,
        start_date=record.start_date,
        campus_label=record.campus_label,
        seat_capacity=record.seat_capacity,
        enrolled_count=record.enrolled_count,
        teacher_name=record.teacher_name,
        status=record.status,  # type: ignore[arg-type]
    )


def list_admin_orders(db: Session) -> list[AdminOrderItem]:
    records = db.scalars(select(OrderRecord).order_by(OrderRecord.created_at.desc())).all()
    return [
        AdminOrderItem(
            id=record.id,
            reference=record.reference,
            customer_name=record.customer_name,
            formation_title=record.formation_title,
            total_amount=record.total_amount,
            total_amount_label=format_fcfa(record.total_amount) or "",
            currency=record.currency,
            status=record.status,
            created_at=record.created_at,
        )
        for record in records
    ]


def update_admin_order(
    db: Session,
    order_id: int,
    payload: AdminOrderUpdate,
) -> AdminOrderItem | None:
    record = db.get(OrderRecord, order_id)
    if record is None:
        return None

    record.status = payload.status
    db.add(record)
    db.commit()
    db.refresh(record)
    return AdminOrderItem(
        id=record.id,
        reference=record.reference,
        customer_name=record.customer_name,
        formation_title=record.formation_title,
        total_amount=record.total_amount,
        total_amount_label=format_fcfa(record.total_amount) or "",
        currency=record.currency,
        status=record.status,  # type: ignore[arg-type]
        created_at=record.created_at,
    )


def list_admin_payments(db: Session) -> list[AdminPaymentItem]:
    records = db.scalars(select(PaymentRecord).order_by(PaymentRecord.created_at.desc())).all()
    return [
        AdminPaymentItem(
            id=record.id,
            order_reference=record.order_reference,
            payer_name=record.payer_name,
            amount=record.amount,
            amount_label=format_fcfa(record.amount) or "",
            currency=record.currency,
            provider_code=record.provider_code,
            status=record.status,
            paid_at=record.paid_at,
            created_at=record.created_at,
        )
        for record in records
    ]


def update_admin_payment(
    db: Session,
    payment_id: int,
    payload: AdminPaymentUpdate,
) -> AdminPaymentItem | None:
    record = db.get(PaymentRecord, payment_id)
    if record is None:
        return None

    if payload.provider_code is not None:
        record.provider_code = payload.provider_code

    if payload.status is not None:
        record.status = payload.status
        if payload.status == "confirmed" and record.paid_at is None:
            record.paid_at = utc_now()
        if payload.status != "confirmed":
            record.paid_at = None

        order = db.scalar(
            select(OrderRecord).where(OrderRecord.reference == record.order_reference)
        )
        if order is not None:
            if payload.status == "confirmed":
                order.status = "paid"
                db.add(order)
            elif payload.status == "failed":
                order.status = "failed"
                db.add(order)
            elif payload.status == "pending":
                order.status = "pending"
                db.add(order)

    db.add(record)
    db.commit()
    db.refresh(record)
    return AdminPaymentItem(
        id=record.id,
        order_reference=record.order_reference,
        payer_name=record.payer_name,
        amount=record.amount,
        amount_label=format_fcfa(record.amount) or "",
        currency=record.currency,
        provider_code=record.provider_code,
        status=record.status,  # type: ignore[arg-type]
        paid_at=record.paid_at,
        created_at=record.created_at,
    )
