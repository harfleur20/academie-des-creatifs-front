from app.core.security import utc_now
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    FormationRecord,
    FormationSessionRecord,
    OrderRecord,
    PaymentRecord,
    UserRecord,
)
from app.schemas.catalog import (
    AdminFormationItem,
    AdminFormationSessionCreate,
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
    FormationDetailItem,
    FormationFaqItem,
    FormationModuleItem,
    FormationProjectItem,
    FormatType,
)
from app.services.formation_sessions import (
    assert_can_create_session,
    get_session_presentation,
    supports_sessions,
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


def _normalize_text(value: str | None) -> str:
    return (value or "").strip()


def _normalize_list(value: list[object] | None) -> list[str]:
    normalized: list[str] = []
    for item in value or []:
        if isinstance(item, str):
            trimmed = item.strip()
            if trimmed:
                normalized.append(trimmed)
    return normalized


def _default_mentor_label(format_type: FormatType) -> str:
    if format_type == "presentiel":
        return "Responsable de cohorte et encadrement academique"
    if format_type == "ligne":
        return "Formateur principal et suivi du parcours"
    return "Formateur live et accompagnement des sessions"


def _default_included_items(record: FormationRecord) -> list[str]:
    items = [
        "Acces a l'espace de formation apres validation",
        "Ressources, supports et suivi de progression du parcours",
        "Encadrement par l'equipe Academie des Creatifs",
        "Acces au certificat ou a l'attestation de fin de parcours",
    ]
    if record.allow_installments:
        items.append("Paiement en tranches selon les conditions de l'offre")
    else:
        items.append("Paiement simple avec acces immediat a la formule choisie")
    return items


def _default_objective_items(record: FormationRecord) -> list[str]:
    format_label = {
        "live": "les sessions live",
        "ligne": "le parcours en ligne",
        "presentiel": "les ateliers en presentiel",
    }.get(record.format_type, "le parcours")
    return [
        f"Comprendre la structure du programme et ses livrables dans {format_label}",
        "Monter en competence sur des cas concrets et professionnalisants",
        "Produire des rendus exploitables dans un contexte reel",
        "Avancer avec un cadre de progression clair jusqu'a la validation",
        "Valoriser votre progression dans votre espace personnel",
        "Finaliser un parcours plus lisible et mieux cadence",
    ]


def _default_projects(record: FormationRecord) -> list[FormationProjectItem]:
    return [
        FormationProjectItem(title=f"{record.category} - projet applique", image=record.image),
        FormationProjectItem(title="Exercice guide de mise en pratique", image=record.image),
        FormationProjectItem(title="Livrable final a presenter", image=record.image),
    ]


def _default_modules(record: FormationRecord) -> list[FormationModuleItem]:
    return [
        FormationModuleItem(
            title="Module 1 - Prise en main du parcours",
            summary="Comprendre la structure du programme, les attendus et le rythme conseille.",
            lessons=[
                "Presentation du programme et des objectifs",
                "Organisation des ressources et du rythme de travail",
                "Methode de progression conseillee",
                "Premiers reperes pour bien demarrer",
            ],
        ),
        FormationModuleItem(
            title="Module 2 - Mise en pratique guidee",
            summary="Passer des notions aux exercices et consolider l'execution.",
            lessons=[
                "Exercices d'application progressifs",
                "Analyse des erreurs frequentes",
                "Ajustements et amelioration des rendus",
                "Preparation du livrable intermediaire",
            ],
        ),
        FormationModuleItem(
            title="Module 3 - Validation et finalisation",
            summary="Finaliser les productions et preparer la validation du parcours.",
            lessons=[
                "Finalisation du travail principal",
                "Points de verification avant validation",
                "Presentation du rendu final",
                "Orientation vers la suite du parcours",
            ],
        ),
    ]


def _default_faqs(record: FormationRecord) -> list[FormationFaqItem]:
    return [
        FormationFaqItem(
            question="Quand l'acces a la formation est-il active ?",
            answer="L'acces est ouvert apres validation de votre inscription ou de votre paiement selon le format choisi.",
        ),
        FormationFaqItem(
            question="Cette formation est-elle adaptee aux debutants ?",
            answer="Le niveau affiche sur la fiche reste la reference, mais le parcours est structure pour garder un fil de progression clair.",
        ),
        FormationFaqItem(
            question="Le format influence-t-il le dashboard ?",
            answer="Oui. Les formations live et presentiel suivent un espace guide, tandis que les formations en ligne utilisent un dashboard d'apprentissage plus classique.",
        ),
        FormationFaqItem(
            question="Y a-t-il un certificat a la fin ?",
            answer="Oui, un certificat ou une attestation peut etre delivre apres validation des exigences du parcours.",
        ),
    ]


def build_formation_detail_content(record: FormationRecord) -> dict[str, object]:
    format_label = {
        "live": "en live",
        "ligne": "en ligne",
        "presentiel": "en presentiel",
    }.get(record.format_type, "sur mesure")
    intro = _normalize_text(record.intro) or (
        f"Decouvrez une formation {format_label} concue pour vous aider a progresser plus vite, structurer vos competences et obtenir un rendu concret sur de vrais cas de travail."
    )
    mentor_name = _normalize_text(record.mentor_name) or "Equipe Academie des Creatifs"
    mentor_label = _normalize_text(record.mentor_label) or _default_mentor_label(record.format_type)  # type: ignore[arg-type]
    mentor_image = _normalize_text(record.mentor_image) or "/Teams/photo-fk.jpg"
    included = _normalize_list(record.included_items) or _default_included_items(record)
    objectives = _normalize_list(record.objective_items) or _default_objective_items(record)
    projects = (
        [FormationProjectItem.model_validate(item) for item in (record.project_items or [])]
        if record.project_items
        else _default_projects(record)
    )
    audience_text = _normalize_text(record.audience_text) or (
        "Cette formation s'adresse aux creatifs, graphistes, freelances et profils en reconversion qui veulent progresser dans un cadre plus clair, plus concret et plus professionnalisant."
    )
    certificate_copy = _normalize_text(record.certificate_copy) or (
        "Une attestation de fin de parcours peut etre delivree apres validation des exigences de la formation et completion des etapes obligatoires du programme."
    )
    certificate_image = _normalize_text(record.certificate_image) or "/certicate.jpg"
    modules = (
        [FormationModuleItem.model_validate(item) for item in (record.module_items or [])]
        if record.module_items
        else _default_modules(record)
    )
    faqs = (
        [FormationFaqItem.model_validate(item) for item in (record.faq_items or [])]
        if record.faq_items
        else _default_faqs(record)
    )

    return {
        "intro": intro,
        "mentor_name": mentor_name,
        "mentor_label": mentor_label,
        "mentor_image": mentor_image,
        "included": included,
        "objectives": objectives,
        "projects": projects,
        "audience_text": audience_text,
        "certificate_copy": certificate_copy,
        "certificate_image": certificate_image,
        "modules": modules,
        "faqs": faqs,
    }


def serialize_catalog_item(db: Session, record: FormationRecord) -> FormationCatalogItem:
    current_price = record.current_price_amount
    original_price = record.original_price_amount
    format_type = record.format_type  # type: ignore[assignment]
    dashboard_type = record.dashboard_type  # type: ignore[assignment]
    presentation = get_session_presentation(
        db,
        formation_id=record.id,
        format_type=format_type,
    )

    return FormationCatalogItem(
        id=record.id,
        slug=record.slug,
        title=record.title,
        category=record.category,
        level=record.level,
        image=record.image,
        format_type=format_type,
        dashboard_type=dashboard_type,
        session_state=presentation.state,  # type: ignore[arg-type]
        session_label=presentation.session_label,
        card_session_label=presentation.card_session_label,
        purchase_message=presentation.purchase_message,
        can_purchase=presentation.can_purchase,
        session_start_date=presentation.start_date,
        session_end_date=presentation.end_date,
        late_enrollment_until=presentation.late_enrollment_until,
        current_price_amount=current_price,
        current_price_label=format_fcfa(current_price) or "",
        original_price_amount=original_price,
        original_price_label=format_fcfa(original_price),
        price_currency=record.price_currency,
        allow_installments=record.allow_installments,
        is_featured_home=record.is_featured_home,
        home_feature_rank=record.home_feature_rank,
        rating=record.rating,
        reviews=record.reviews,
        badges=normalize_marketing_badges(
            list(record.badges or []),
            current_price_amount=current_price,
            original_price_amount=original_price,
        ),
    )


def serialize_detail_item(db: Session, record: FormationRecord) -> FormationDetailItem:
    catalog_item = serialize_catalog_item(db, record)
    return FormationDetailItem(
        **catalog_item.model_dump(),
        **build_formation_detail_content(record),
    )


def serialize_admin_formation_item(db: Session, record: FormationRecord) -> AdminFormationItem:
    detail_item = serialize_detail_item(db, record)
    return AdminFormationItem(**detail_item.model_dump())


def list_catalog_items(db: Session) -> list[FormationCatalogItem]:
    records = db.scalars(select(FormationRecord).order_by(FormationRecord.id)).all()
    return [serialize_catalog_item(db, record) for record in records]


def get_catalog_item(db: Session, slug: str) -> FormationCatalogItem | None:
    record = db.scalar(select(FormationRecord).where(FormationRecord.slug == slug))
    if record is None:
        return None
    return serialize_catalog_item(db, record)


def get_catalog_detail_item(db: Session, slug: str) -> FormationDetailItem | None:
    record = db.scalar(select(FormationRecord).where(FormationRecord.slug == slug))
    if record is None:
        return None
    return serialize_detail_item(db, record)


def list_admin_catalog_items(db: Session) -> list[AdminFormationItem]:
    records = db.scalars(select(FormationRecord).order_by(FormationRecord.id)).all()
    return [serialize_admin_formation_item(db, record) for record in records]


def create_catalog_entry(
    db: Session,
    payload: AdminFormationCreate,
) -> AdminFormationItem:
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
        intro=payload.intro or "",
        mentor_name=payload.mentor_name or "",
        mentor_label=payload.mentor_label or "",
        mentor_image=payload.mentor_image or "",
        included_items=list(payload.included or []),
        objective_items=list(payload.objectives or []),
        project_items=[item.model_dump() for item in (payload.projects or [])],
        audience_text=payload.audience_text or "",
        certificate_copy=payload.certificate_copy or "",
        certificate_image=payload.certificate_image or "",
        module_items=[item.model_dump() for item in (payload.modules or [])],
        faq_items=[item.model_dump() for item in (payload.faqs or [])],
        format_type=payload.format_type,
        dashboard_type=get_dashboard_type_for_format(payload.format_type),
        session_label="",
        current_price_amount=payload.current_price_amount,
        original_price_amount=payload.original_price_amount,
        price_currency="XAF",
        allow_installments=should_allow_installments(
            payload.format_type, payload.current_price_amount
        ),
        is_featured_home=payload.is_featured_home,
        home_feature_rank=payload.home_feature_rank,
        rating=payload.rating,
        reviews=payload.reviews,
        badges=list(payload.badges),
    )
    apply_formation_business_rules(record)

    db.add(record)
    db.commit()
    db.refresh(record)
    return serialize_admin_formation_item(db, record)


def update_catalog_entry(
    db: Session, slug: str, payload: AdminFormationUpdate
) -> AdminFormationItem | None:
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

    if "intro" in payload.model_fields_set and payload.intro is not None:
        record.intro = payload.intro

    if "mentor_name" in payload.model_fields_set and payload.mentor_name is not None:
        record.mentor_name = payload.mentor_name

    if "mentor_label" in payload.model_fields_set and payload.mentor_label is not None:
        record.mentor_label = payload.mentor_label

    if "mentor_image" in payload.model_fields_set and payload.mentor_image is not None:
        record.mentor_image = payload.mentor_image

    if "included" in payload.model_fields_set and payload.included is not None:
        record.included_items = list(payload.included)

    if "objectives" in payload.model_fields_set and payload.objectives is not None:
        record.objective_items = list(payload.objectives)

    if "projects" in payload.model_fields_set and payload.projects is not None:
        record.project_items = [item.model_dump() for item in payload.projects]

    if "audience_text" in payload.model_fields_set and payload.audience_text is not None:
        record.audience_text = payload.audience_text

    if "certificate_copy" in payload.model_fields_set and payload.certificate_copy is not None:
        record.certificate_copy = payload.certificate_copy

    if "certificate_image" in payload.model_fields_set and payload.certificate_image is not None:
        record.certificate_image = payload.certificate_image

    if "modules" in payload.model_fields_set and payload.modules is not None:
        record.module_items = [item.model_dump() for item in payload.modules]

    if "faqs" in payload.model_fields_set and payload.faqs is not None:
        record.faq_items = [item.model_dump() for item in payload.faqs]

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

    if "is_featured_home" in payload.model_fields_set and payload.is_featured_home is not None:
        record.is_featured_home = payload.is_featured_home

    if "home_feature_rank" in payload.model_fields_set and payload.home_feature_rank is not None:
        record.home_feature_rank = payload.home_feature_rank

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
    return serialize_admin_formation_item(db, record)


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
        db.scalar(select(func.count()).select_from(FormationSessionRecord)) or 0
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
    records = db.execute(
        select(FormationSessionRecord, FormationRecord)
        .join(FormationRecord, FormationSessionRecord.formation_id == FormationRecord.id)
        .order_by(FormationSessionRecord.start_date.asc(), FormationSessionRecord.id.asc())
    ).all()
    return [
        serialize_admin_formation_session(db, session_record, formation_record)
        for session_record, formation_record in records
    ]


def update_admin_onsite_session(
    db: Session,
    session_id: int,
    payload: AdminOnsiteSessionUpdate,
) -> AdminOnsiteSessionItem | None:
    record = db.get(FormationSessionRecord, session_id)
    if record is None:
        return None

    if payload.label is not None:
        record.label = payload.label
    if payload.start_date is not None:
        record.start_date = payload.start_date
    if payload.end_date is not None:
        record.end_date = payload.end_date
    if payload.campus_label is not None:
        record.campus_label = payload.campus_label
    if payload.seat_capacity is not None:
        record.seat_capacity = payload.seat_capacity
    if payload.teacher_name is not None:
        record.teacher_name = payload.teacher_name
    if payload.status is not None:
        record.status = payload.status

    if record.end_date < record.start_date:
        raise ValueError("La date de fin doit etre posterieure ou egale a la date de debut.")

    if record.status != "cancelled":
        assert_can_create_session(
            db,
            formation_id=record.formation_id,
            exclude_session_id=record.id,
        )

    db.add(record)
    db.commit()
    db.refresh(record)
    formation = db.get(FormationRecord, record.formation_id)
    if formation is None:
        return None
    return serialize_admin_formation_session(db, record, formation)


def create_admin_onsite_session(
    db: Session,
    payload: AdminFormationSessionCreate,
) -> AdminOnsiteSessionItem:
    formation = db.get(FormationRecord, payload.formation_id)
    if formation is None:
        raise ValueError("Formation introuvable.")

    if not supports_sessions(formation.format_type):
        raise ValueError("Seules les formations live et presentiel peuvent recevoir des sessions.")

    assert_can_create_session(db, formation_id=formation.id)

    record = FormationSessionRecord(
        formation_id=formation.id,
        label=payload.label,
        start_date=payload.start_date,
        end_date=payload.end_date,
        campus_label=payload.campus_label,
        seat_capacity=payload.seat_capacity,
        enrolled_count=0,
        teacher_name=payload.teacher_name,
        status=payload.status,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return serialize_admin_formation_session(db, record, formation)


def serialize_admin_formation_session(
    db: Session,
    session_record: FormationSessionRecord,
    formation_record: FormationRecord,
) -> AdminOnsiteSessionItem:
    presentation = get_session_presentation(
        db,
        formation_id=formation_record.id,
        format_type=formation_record.format_type,
    )
    return AdminOnsiteSessionItem(
        id=session_record.id,
        formation_id=formation_record.id,
        formation_slug=formation_record.slug,
        formation_title=formation_record.title,
        format_type=formation_record.format_type,  # type: ignore[arg-type]
        label=session_record.label,
        start_date=session_record.start_date,
        end_date=session_record.end_date,
        campus_label=session_record.campus_label or "",
        seat_capacity=session_record.seat_capacity,
        enrolled_count=session_record.enrolled_count,
        teacher_name=session_record.teacher_name or "",
        status=session_record.status,  # type: ignore[arg-type]
        session_state=presentation.state,  # type: ignore[arg-type]
        can_purchase=presentation.can_purchase,
        session_label=presentation.session_label,
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
