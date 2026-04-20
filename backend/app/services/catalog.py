import json
from datetime import timezone

from pydantic import ValidationError

from app.core.security import utc_now
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    AttendanceRecord,
    AssignmentSubmissionRecord,
    EnrollmentRecord,
    FormationRecord,
    FormationSessionRecord,
    FormationTeacherRecord,
    GradeRecord,
    OrderRecord,
    PaymentRecord,
    QuizAttemptRecord,
    SessionCourseDayRecord,
    UserRecord,
)
from app.schemas.catalog import (
    AdminCourseDayStatusUpdate,
    AdminFormationItem,
    AdminFormationSessionCreate,
    AdminDashboardOverview,
    AdminEnrollmentItem,
    AdminEnrollmentUpdate,
    AdminFormationCreate,
    AdminFormationUpdate,
    AdminMissedCourseDay,
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
    create_formation_session,
    get_single_session_presentation,
    get_session_presentation,
    refresh_session_enrolled_count,
    update_formation_session,
)
from app.services.order_access import sync_order_enrollment_access
from app.services.payments import (
    payment_can_send_reminder,
    refresh_payment_states,
    send_manual_payment_reminder,
)
from app.services.teacher_codes import ensure_teacher_profile

DEFAULT_CERTIFICATE_IMAGE = "/certicate.jpg"
DEFAULT_CERTIFICATE_COPY = (
    "Une attestation de fin de parcours peut etre delivree apres validation des exigences "
    "de la formation et completion des etapes obligatoires du programme."
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
    return current_price_amount >= 100000


def _json_list(value: object | None) -> list[object]:
    if value is None:
        return []
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            return []
        try:
            parsed = json.loads(trimmed)
        except json.JSONDecodeError:
            return []
        return parsed if isinstance(parsed, list) else []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return []


def normalize_marketing_badges(
    badges: object | None,
    *,
    current_price_amount: int,
    original_price_amount: int | None,
) -> list[FormationBadge]:
    normalized: list[FormationBadge] = []

    for badge in _json_list(badges):
        if not isinstance(badge, str):
            continue
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
            record.badges,
            current_price_amount=record.current_price_amount,
            original_price_amount=record.original_price_amount,
        )
        if badge != "promo"
    ]


def _normalize_text(value: str | None) -> str:
    return (value or "").strip()


def _normalize_list(value: object | None) -> list[str]:
    normalized: list[str] = []
    for item in _json_list(value):
        if isinstance(item, str):
            trimmed = item.strip()
            if trimmed:
                normalized.append(trimmed)
        elif isinstance(item, dict):
            text = item.get("text")
            if isinstance(text, str):
                trimmed = text.strip()
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
    if should_allow_installments(record.format_type, record.current_price_amount):  # type: ignore[arg-type]
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


def _validated_projects(record: FormationRecord) -> list[FormationProjectItem]:
    raw_items = _json_list(record.project_items)
    if not raw_items:
        return _default_projects(record)
    try:
        return [FormationProjectItem.model_validate(item) for item in raw_items]
    except (TypeError, ValueError, ValidationError):
        return _default_projects(record)


def _validated_modules(record: FormationRecord) -> list[FormationModuleItem]:
    raw_items = _json_list(record.module_items)
    if not raw_items:
        return _default_modules(record)
    try:
        return [FormationModuleItem.model_validate(item) for item in raw_items]
    except (TypeError, ValueError, ValidationError):
        return _default_modules(record)


def _validated_faqs(record: FormationRecord) -> list[FormationFaqItem]:
    raw_items = _json_list(record.faq_items)
    if not raw_items:
        return _default_faqs(record)
    try:
        return [FormationFaqItem.model_validate(item) for item in raw_items]
    except (TypeError, ValueError, ValidationError):
        return _default_faqs(record)


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
    projects = _validated_projects(record)
    audience_text = _normalize_text(record.audience_text) or (
        "Cette formation s'adresse aux creatifs, graphistes, freelances et profils en reconversion qui veulent progresser dans un cadre plus clair, plus concret et plus professionnalisant."
    )
    certificate_copy = DEFAULT_CERTIFICATE_COPY
    certificate_image = DEFAULT_CERTIFICATE_IMAGE
    modules = _validated_modules(record)
    faqs = _validated_faqs(record)

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
        allow_installments=should_allow_installments(format_type, current_price),
        is_featured_home=record.is_featured_home,
        home_feature_rank=record.home_feature_rank,
        rating=record.rating,
        reviews=record.reviews,
        badges=normalize_marketing_badges(
            record.badges,
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
        certificate_copy="",
        certificate_image="",
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
    refresh_payment_states(db)
    db.commit()

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
    late_payments_count = (
        db.scalar(
            select(func.count()).select_from(PaymentRecord).where(PaymentRecord.status == "late")
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

    now = utc_now()
    missed_course_days_count = int(
        db.scalar(
            select(func.count(SessionCourseDayRecord.id))
            .outerjoin(
                AttendanceRecord,
                AttendanceRecord.course_day_id == SessionCourseDayRecord.id,
            )
            .where(
                SessionCourseDayRecord.status == "planned",
                SessionCourseDayRecord.scheduled_at < now,
            )
            .group_by(SessionCourseDayRecord.id)
            .having(func.count(AttendanceRecord.id) == 0)
        ) or 0
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
        late_payments_count=late_payments_count,
        total_confirmed_revenue_amount=int(total_confirmed_revenue_amount),
        total_confirmed_revenue_label=format_fcfa(int(total_confirmed_revenue_amount)) or "0 FCFA",
        missed_course_days_count=missed_course_days_count,
    )


def list_admin_missed_course_days(db: Session) -> list[AdminMissedCourseDay]:
    now = utc_now()
    # Subquery: course days that are past, still planned, and have 0 attendance
    attended_ids = (
        select(AttendanceRecord.course_day_id)
        .where(AttendanceRecord.course_day_id.isnot(None))
        .scalar_subquery()
    )
    rows = db.execute(
        select(SessionCourseDayRecord, FormationSessionRecord, FormationRecord)
        .join(FormationSessionRecord, FormationSessionRecord.id == SessionCourseDayRecord.session_id)
        .join(FormationRecord, FormationRecord.id == FormationSessionRecord.formation_id)
        .where(
            SessionCourseDayRecord.status == "planned",
            SessionCourseDayRecord.scheduled_at < now,
            SessionCourseDayRecord.id.notin_(attended_ids),
        )
        .order_by(SessionCourseDayRecord.scheduled_at.desc())
    ).all()

    return [
        AdminMissedCourseDay(
            id=cd.id,
            session_id=ses.id,
            session_label=ses.label,
            formation_title=fm.title,
            teacher_name=ses.teacher_name or "",
            title=cd.title,
            scheduled_at=cd.scheduled_at,
            duration_minutes=cd.duration_minutes,
            status=cd.status,
        )
        for cd, ses, fm in rows
    ]


def admin_patch_course_day_status(db: Session, course_day_id: int, payload: AdminCourseDayStatusUpdate) -> None:
    cd = db.get(SessionCourseDayRecord, course_day_id)
    if cd is None:
        raise ValueError("Journée de cours introuvable.")
    cd.status = payload.status
    db.commit()


def list_admin_users(db: Session) -> list[AdminUserItem]:
    records = db.scalars(select(UserRecord).order_by(UserRecord.created_at.desc())).all()
    # Count enrollments per user in one query
    enrollment_counts: dict[int, int] = dict(
        db.execute(
            select(EnrollmentRecord.user_id, func.count(EnrollmentRecord.id))
            .group_by(EnrollmentRecord.user_id)
        ).all()
    )
    return [
        AdminUserItem(
            id=record.id,
            full_name=record.full_name,
            email=record.email,
            phone=record.phone,
            role=record.role,
            status=record.status,
            student_code=record.student_code,
            enrollments_count=enrollment_counts.get(record.id, 0),
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

    if record.role == "teacher":
        ensure_teacher_profile(db, record)

    db.add(record)
    db.commit()
    db.refresh(record)
    enrollments_count = db.scalar(
        select(func.count(EnrollmentRecord.id)).where(EnrollmentRecord.user_id == record.id)
    ) or 0
    return AdminUserItem(
        id=record.id,
        full_name=record.full_name,
        email=record.email,
        phone=record.phone,
        role=record.role,  # type: ignore[arg-type]
        status=record.status,  # type: ignore[arg-type]
        student_code=record.student_code,
        enrollments_count=enrollments_count,
        created_at=record.created_at,
    )


def _admin_enrollment_rows(db: Session, enrollment_id: int | None = None):
    refresh_payment_states(db)
    db.commit()

    payment_stats = (
        select(
            PaymentRecord.order_reference.label("order_reference"),
            func.count(PaymentRecord.id).label("payments_count"),
            func.sum(case((PaymentRecord.status == "confirmed", 1), else_=0)).label(
                "confirmed_payments_count"
            ),
            func.sum(case((PaymentRecord.status == "pending", 1), else_=0)).label(
                "pending_payments_count"
            ),
            func.sum(case((PaymentRecord.status == "late", 1), else_=0)).label(
                "late_payments_count"
            ),
            func.sum(case((PaymentRecord.status == "failed", 1), else_=0)).label(
                "failed_payments_count"
            ),
            func.sum(case((PaymentRecord.status == "cancelled", 1), else_=0)).label(
                "cancelled_payments_count"
            ),
        )
        .group_by(PaymentRecord.order_reference)
        .subquery()
    )

    statement = (
        select(
            EnrollmentRecord,
            UserRecord,
            FormationRecord,
            FormationSessionRecord,
            OrderRecord,
            payment_stats.c.payments_count,
            payment_stats.c.confirmed_payments_count,
            payment_stats.c.pending_payments_count,
            payment_stats.c.late_payments_count,
            payment_stats.c.failed_payments_count,
            payment_stats.c.cancelled_payments_count,
        )
        .join(UserRecord, UserRecord.id == EnrollmentRecord.user_id)
        .join(FormationRecord, FormationRecord.id == EnrollmentRecord.formation_id)
        .outerjoin(FormationSessionRecord, FormationSessionRecord.id == EnrollmentRecord.session_id)
        .outerjoin(OrderRecord, OrderRecord.reference == EnrollmentRecord.order_reference)
        .outerjoin(payment_stats, payment_stats.c.order_reference == EnrollmentRecord.order_reference)
        .order_by(EnrollmentRecord.created_at.desc(), EnrollmentRecord.id.desc())
    )

    if enrollment_id is not None:
        statement = statement.where(EnrollmentRecord.id == enrollment_id)

    return db.execute(statement).all()


def _serialize_admin_enrollment_row(row) -> AdminEnrollmentItem:
    (
        enrollment,
        user,
        formation,
        session,
        order,
        payments_count,
        confirmed_payments_count,
        pending_payments_count,
        late_payments_count,
        failed_payments_count,
        cancelled_payments_count,
    ) = row

    session_label = None
    if session is not None:
        session_label = session.label
    elif formation.format_type == "ligne":
        session_label = "Acces immediat"

    return AdminEnrollmentItem(
        id=enrollment.id,
        user_id=user.id,
        student_name=user.full_name,
        student_email=user.email,
        student_phone=user.phone,
        student_code=user.student_code,
        user_status=user.status,  # type: ignore[arg-type]
        formation_id=formation.id,
        formation_slug=formation.slug,
        formation_title=formation.title,
        format_type=enrollment.format_type,  # type: ignore[arg-type]
        dashboard_type=enrollment.dashboard_type,  # type: ignore[arg-type]
        order_reference=enrollment.order_reference,
        order_status=order.status if order is not None else None,  # type: ignore[arg-type]
        payments_count=int(payments_count or 0),
        confirmed_payments_count=int(confirmed_payments_count or 0),
        pending_payments_count=int(pending_payments_count or 0),
        late_payments_count=int(late_payments_count or 0),
        failed_payments_count=int(failed_payments_count or 0),
        cancelled_payments_count=int(cancelled_payments_count or 0),
        session_id=session.id if session is not None else None,
        session_label=session_label,
        session_start_date=session.start_date if session is not None else None,
        session_end_date=session.end_date if session is not None else None,
        campus_label=session.campus_label if session is not None else None,
        teacher_name=session.teacher_name if session is not None else None,
        status=enrollment.status,  # type: ignore[arg-type]
        created_at=enrollment.created_at,
    )


def list_admin_enrollments(db: Session) -> list[AdminEnrollmentItem]:
    return [_serialize_admin_enrollment_row(row) for row in _admin_enrollment_rows(db)]


def update_admin_enrollment(
    db: Session,
    enrollment_id: int,
    payload: AdminEnrollmentUpdate,
) -> AdminEnrollmentItem | None:
    record = db.get(EnrollmentRecord, enrollment_id)
    if record is None:
        return None

    session_update_requested = "session_id" in payload.model_fields_set
    next_session_id = record.session_id

    if session_update_requested:
        requested_session_id = payload.session_id
        if requested_session_id != record.session_id:
            activity_counts = (
                db.scalar(
                    select(func.count(AttendanceRecord.id)).where(
                        AttendanceRecord.enrollment_id == record.id
                    )
                )
                or 0,
                db.scalar(
                    select(func.count(GradeRecord.id)).where(
                        GradeRecord.enrollment_id == record.id
                    )
                )
                or 0,
                db.scalar(
                    select(func.count(QuizAttemptRecord.id)).where(
                        QuizAttemptRecord.enrollment_id == record.id
                    )
                )
                or 0,
                db.scalar(
                    select(func.count(AssignmentSubmissionRecord.id)).where(
                        AssignmentSubmissionRecord.enrollment_id == record.id
                    )
                )
                or 0,
            )
            has_pedagogical_activity = any(activity_counts)
            if has_pedagogical_activity:
                raise ValueError(
                    "Cette inscription contient deja des donnees pedagogiques. "
                    "La session ne peut plus etre modifiee depuis l'admin."
                )

        if requested_session_id is not None:
            session_record = db.get(FormationSessionRecord, requested_session_id)
            if session_record is None:
                raise ValueError("La session selectionnee est introuvable.")
            if session_record.formation_id != record.formation_id:
                raise ValueError("La session selectionnee ne correspond pas a cette formation.")
            if session_record.status == "cancelled":
                raise ValueError("Une session annulee ne peut pas etre attribuee.")
            next_session_id = session_record.id
        else:
            next_session_id = None

    previous_session_id = record.session_id
    if payload.status is not None:
        record.status = payload.status
    if session_update_requested:
        record.session_id = next_session_id

    db.add(record)

    order_record = db.scalar(select(OrderRecord).where(OrderRecord.reference == record.order_reference))
    if order_record is not None and order_record.formation_id == record.formation_id:
        order_record.session_id = record.session_id
        db.add(order_record)

    if previous_session_id is not None and previous_session_id != record.session_id:
        refresh_session_enrolled_count(db, previous_session_id)
    if record.session_id is not None:
        refresh_session_enrolled_count(db, record.session_id)
    db.commit()

    row = next(iter(_admin_enrollment_rows(db, enrollment_id)), None)
    if row is None:
        return None
    return _serialize_admin_enrollment_row(row)


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


def ensure_session_teacher_assignment(
    db: Session,
    *,
    formation_id: int,
    teacher_name: str | None,
) -> None:
    teacher_label = _normalize_text(teacher_name)
    if not teacher_label:
        return

    teacher = db.scalar(
        select(UserRecord).where(
            UserRecord.full_name == teacher_label,
            UserRecord.role == "teacher",
            UserRecord.status == "active",
        )
    )
    if teacher is None:
        raise ValueError("Selectionnez un enseignant actif existant pour cette session.")

    existing_link = db.scalar(
        select(FormationTeacherRecord).where(
            FormationTeacherRecord.formation_id == formation_id,
            FormationTeacherRecord.teacher_id == teacher.id,
        )
    )
    if existing_link is None:
        db.add(FormationTeacherRecord(formation_id=formation_id, teacher_id=teacher.id))
        db.flush()


def update_admin_onsite_session(
    db: Session,
    session_id: int,
    payload: AdminOnsiteSessionUpdate,
) -> AdminOnsiteSessionItem | None:
    record = db.get(FormationSessionRecord, session_id)
    if record is None:
        return None

    formation = db.get(FormationRecord, record.formation_id)
    if formation is None:
        return None

    changes: dict[str, object] = {}
    if "label" in payload.model_fields_set and payload.label is not None:
        changes["label"] = payload.label
    if "start_date" in payload.model_fields_set and payload.start_date is not None:
        changes["start_date"] = payload.start_date
    if "end_date" in payload.model_fields_set and payload.end_date is not None:
        changes["end_date"] = payload.end_date
    if "campus_label" in payload.model_fields_set:
        changes["campus_label"] = payload.campus_label
    if "seat_capacity" in payload.model_fields_set and payload.seat_capacity is not None:
        changes["seat_capacity"] = payload.seat_capacity
    if "teacher_name" in payload.model_fields_set:
        changes["teacher_name"] = payload.teacher_name
    if "status" in payload.model_fields_set and payload.status is not None:
        changes["status"] = payload.status
    if "meeting_link" in payload.model_fields_set:
        changes["meeting_link"] = payload.meeting_link

    if "teacher_name" in payload.model_fields_set:
        ensure_session_teacher_assignment(
            db,
            formation_id=record.formation_id,
            teacher_name=payload.teacher_name,
        )

    record = update_formation_session(
        db,
        session=record,
        formation=formation,
        **changes,
    )
    return serialize_admin_formation_session(db, record, formation)


def create_admin_onsite_session(
    db: Session,
    payload: AdminFormationSessionCreate,
) -> AdminOnsiteSessionItem:
    formation = db.get(FormationRecord, payload.formation_id)
    if formation is None:
        raise ValueError("Formation introuvable.")

    ensure_session_teacher_assignment(
        db,
        formation_id=formation.id,
        teacher_name=payload.teacher_name,
    )

    record = create_formation_session(
        db,
        formation=formation,
        label=payload.label,
        start_date=payload.start_date,
        end_date=payload.end_date,
        campus_label=payload.campus_label,
        seat_capacity=payload.seat_capacity,
        teacher_name=payload.teacher_name,
        status=payload.status,
        meeting_link=payload.meeting_link,
    )
    return serialize_admin_formation_session(db, record, formation)


def serialize_admin_formation_session(
    db: Session,
    session_record: FormationSessionRecord,
    formation_record: FormationRecord,
) -> AdminOnsiteSessionItem:
    presentation = get_single_session_presentation(
        format_type=formation_record.format_type,
        session=session_record,
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
        meeting_link=session_record.meeting_link,
    )


def list_admin_orders(db: Session) -> list[AdminOrderItem]:
    refresh_payment_states(db)
    db.commit()
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
    sync_order_enrollment_access(db, record.reference)
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


def _serialize_admin_payment(db: Session, record: PaymentRecord) -> AdminPaymentItem:
    order = db.scalar(select(OrderRecord).where(OrderRecord.reference == record.order_reference))
    return AdminPaymentItem(
        id=record.id,
        order_reference=record.order_reference,
        payer_name=record.payer_name,
        amount=record.amount,
        amount_label=format_fcfa(record.amount) or "",
        currency=record.currency,
        order_status=order.status if order is not None else None,  # type: ignore[arg-type]
        installment_plan=order.installment_plan if order is not None else None,
        installment_number=record.installment_number,
        due_date=record.due_date,
        provider_code=record.provider_code,
        provider_payment_id=record.provider_payment_id,
        provider_checkout_url=record.provider_checkout_url,
        status=record.status,  # type: ignore[arg-type]
        reminder_count=record.reminder_count,
        last_reminded_at=record.last_reminded_at,
        can_send_reminder=payment_can_send_reminder(record),
        paid_at=record.paid_at,
        created_at=record.created_at,
    )


def list_admin_payments(db: Session) -> list[AdminPaymentItem]:
    refresh_payment_states(db)
    db.commit()
    records = db.scalars(select(PaymentRecord).order_by(PaymentRecord.created_at.desc())).all()
    return [_serialize_admin_payment(db, record) for record in records]


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

    db.add(record)
    db.flush()
    refresh_payment_states(db, order_reference=record.order_reference)
    sync_order_enrollment_access(db, record.order_reference)
    db.commit()
    db.refresh(record)
    return _serialize_admin_payment(db, record)


def remind_admin_payment(
    db: Session,
    payment_id: int,
) -> AdminPaymentItem | None:
    record = db.get(PaymentRecord, payment_id)
    if record is None:
        return None

    refresh_payment_states(db, order_reference=record.order_reference)
    db.flush()
    record = db.get(PaymentRecord, payment_id)
    if record is None:
        return None

    send_manual_payment_reminder(db, record)
    db.commit()
    db.refresh(record)
    return _serialize_admin_payment(db, record)
