from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.entities import (
    FormationRecord,
    FormationSessionRecord,
    OrderRecord,
    PaymentRecord,
    UserRecord,
)


FORMATION_SEED = [
    {
        "slug": "maitrisez-design-packaging-a-z",
        "title": "Maitrisez le Design de Packaging de A a Z - De la decoupe a l'impression",
        "category": "Packaging design",
        "level": "Niveau intermediaire",
        "image": "/Flyers/packaging.jpg",
        "format_type": "ligne",
        "dashboard_type": "classic",
        "session_label": "",
        "current_price_amount": 50000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": False,
        "is_featured_home": True,
        "home_feature_rank": 30,
        "rating": 3.0,
        "reviews": 65,
        "badges": [],
    },
    {
        "slug": "deviens-un-brand-designer",
        "title": "Demarque-toi des autres graphistes, deviens un Brand Designer",
        "category": "Brand designer",
        "level": "Niveau intermediaire",
        "image": "/Flyers/brand-identity.jpg",
        "format_type": "live",
        "dashboard_type": "guided",
        "session_label": "",
        "current_price_amount": 65000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": False,
        "is_featured_home": True,
        "home_feature_rank": 20,
        "rating": 4.0,
        "reviews": 205,
        "badges": ["premium"],
    },
    {
        "slug": "motion-design-par-la-pratique",
        "title": "Apprendre le motion design par la pratique (+40h de formation)",
        "category": "Motion design",
        "level": "Niveau intermediaire",
        "image": "/Flyers/Motion-design.jpg",
        "format_type": "live",
        "dashboard_type": "guided",
        "session_label": "",
        "current_price_amount": 70000,
        "original_price_amount": 95000,
        "price_currency": "XAF",
        "allow_installments": False,
        "is_featured_home": True,
        "home_feature_rank": 10,
        "rating": 3.0,
        "reviews": 895,
        "badges": ["populaire"],
    },
    {
        "slug": "monetisation-audience-tiktok",
        "title": "De la creation a la monetisation : la methode complete pour vivre de votre audience TikTok",
        "category": "TikTok marketing",
        "level": "Tous niveaux",
        "image": "/Flyers/Flyer_TIKTOK_Academie.jpg",
        "format_type": "ligne",
        "dashboard_type": "classic",
        "session_label": "",
        "current_price_amount": 50000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": False,
        "is_featured_home": True,
        "home_feature_rank": 40,
        "rating": 4.5,
        "reviews": 104,
        "badges": ["premium"],
    },
    {
        "slug": "bootcamp-brand-designer-presentiel",
        "title": "Bootcamp Brand Designer en presentiel - Coaching intensif et evaluation continue",
        "category": "Brand designer",
        "level": "Niveau intermediaire",
        "image": "/Flyers/brand-identity.jpg",
        "format_type": "presentiel",
        "dashboard_type": "guided",
        "session_label": "",
        "current_price_amount": 120000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": True,
        "is_featured_home": True,
        "home_feature_rank": 50,
        "rating": 4.5,
        "reviews": 36,
        "badges": ["premium"],
    },
]

USER_SEED = [
    {
        "full_name": "Francis Kenne",
        "email": "francis@academiedescreatifs.com",
        "phone": "+237680000001",
        "password_hash": hash_password("Admin123!"),
        "role": "admin",
        "status": "active",
    },
    {
        "full_name": "Bihee Alex",
        "email": "alex@academiedescreatifs.com",
        "phone": "+237680000002",
        "password_hash": hash_password("Teacher123!"),
        "role": "teacher",
        "status": "active",
    },
    {
        "full_name": "Melvine Possi",
        "email": "melvine@example.com",
        "phone": "+237680000003",
        "password_hash": hash_password("Student123!"),
        "role": "student",
        "status": "active",
    },
    {
        "full_name": "Loic Djitouo",
        "email": "loic@example.com",
        "phone": "+237680000004",
        "password_hash": hash_password("Student123!"),
        "role": "student",
        "status": "active",
    },
]

ORDER_SEED = [
    {
        "reference": "AC-ORD-2026-001",
        "customer_name": "Melvine Possi",
        "formation_title": "Demarque-toi des autres graphistes, deviens un Brand Designer",
        "format_type": "live",
        "dashboard_type": "guided",
        "total_amount": 65000,
        "currency": "XAF",
        "status": "paid",
    },
    {
        "reference": "AC-ORD-2026-002",
        "customer_name": "Loic Djitouo",
        "formation_title": "Apprendre le motion design par la pratique (+40h de formation)",
        "format_type": "live",
        "dashboard_type": "guided",
        "total_amount": 70000,
        "currency": "XAF",
        "status": "pending",
    },
]

PAYMENT_SEED = [
    {
        "order_reference": "AC-ORD-2026-001",
        "payer_name": "Melvine Possi",
        "amount": 65000,
        "currency": "XAF",
        "provider_code": "mobile_money",
        "status": "confirmed",
        "paid_at": datetime(2026, 4, 2, 10, 15, tzinfo=timezone.utc),
    },
    {
        "order_reference": "AC-ORD-2026-002",
        "payer_name": "Loic Djitouo",
        "amount": 35000,
        "currency": "XAF",
        "provider_code": "card",
        "status": "pending",
        "paid_at": None,
    },
]


def _table_has_rows(db: Session, model: type[object]) -> bool:
    return db.scalar(select(model).limit(1)) is not None


def build_formation_session_seed(today: date) -> list[dict[str, object]]:
    return [
        {
            "formation_slug": "deviens-un-brand-designer",
            "label": "Session live de mai 2026",
            "start_date": today + date.resolution * 12,
            "end_date": today + date.resolution * 32,
            "campus_label": "Classe virtuelle Zoom",
            "seat_capacity": 80,
            "enrolled_count": 22,
            "teacher_name": "Bihee Alex",
            "status": "planned",
        },
        {
            "formation_slug": "motion-design-par-la-pratique",
            "label": "Session live intensive motion design",
            "start_date": today + date.resolution * 6,
            "end_date": today + date.resolution * 26,
            "campus_label": "Classe virtuelle Zoom",
            "seat_capacity": 60,
            "enrolled_count": 15,
            "teacher_name": "Francis Kenne",
            "status": "planned",
        },
        {
            "formation_slug": "bootcamp-brand-designer-presentiel",
            "label": "Cohorte presentiel Douala",
            "start_date": today + date.resolution * 18,
            "end_date": today + date.resolution * 48,
            "campus_label": "Douala - Bonapriso",
            "seat_capacity": 30,
            "enrolled_count": 12,
            "teacher_name": "Bihee Alex",
            "status": "planned",
        },
    ]


def seed_database(db: Session) -> None:
    today = date.today()

    if not _table_has_rows(db, FormationRecord):
        db.add_all(FormationRecord(**item) for item in FORMATION_SEED)
    else:
        formations_by_slug = {
            formation.slug: formation for formation in db.scalars(select(FormationRecord)).all()
        }
        for item in FORMATION_SEED:
            if item["slug"] in formations_by_slug:
                existing = formations_by_slug[item["slug"]]
                if getattr(existing, "is_featured_home", False) is False and item.get("is_featured_home"):
                    existing.is_featured_home = item["is_featured_home"]
                if getattr(existing, "home_feature_rank", 100) == 100 and item.get("home_feature_rank") is not None:
                    existing.home_feature_rank = item["home_feature_rank"]
                db.add(existing)
                continue
            db.add(FormationRecord(**item))

    if not _table_has_rows(db, UserRecord):
        db.add_all(UserRecord(**item) for item in USER_SEED)
    else:
        users_by_email = {
            user.email: user for user in db.scalars(select(UserRecord)).all()
        }
        for item in USER_SEED:
            existing_user = users_by_email.get(item["email"])
            if existing_user is None:
                db.add(UserRecord(**item))
                continue

            if not existing_user.phone:
                existing_user.phone = item["phone"]

            if not existing_user.password_hash:
                existing_user.password_hash = item["password_hash"]

            if not existing_user.role:
                existing_user.role = item["role"]

            if not existing_user.status:
                existing_user.status = item["status"]

            db.add(existing_user)

    db.flush()

    formation_sessions_seed = build_formation_session_seed(today)

    if not _table_has_rows(db, FormationSessionRecord):
        formations_by_slug = {
            formation.slug: formation for formation in db.scalars(select(FormationRecord)).all()
        }
        for item in formation_sessions_seed:
            formation = formations_by_slug.get(str(item["formation_slug"]))
            if formation is None:
                continue
            db.add(
                FormationSessionRecord(
                    formation_id=formation.id,
                    label=str(item["label"]),
                    start_date=item["start_date"],
                    end_date=item["end_date"],
                    campus_label=str(item["campus_label"]),
                    seat_capacity=int(item["seat_capacity"]),
                    enrolled_count=int(item["enrolled_count"]),
                    teacher_name=str(item["teacher_name"]),
                    status=str(item["status"]),
                )
            )
    else:
        formations_by_slug = {
            formation.slug: formation for formation in db.scalars(select(FormationRecord)).all()
        }
        existing_sessions = db.scalars(select(FormationSessionRecord)).all()
        existing_keys = {(session.formation_id, session.label) for session in existing_sessions}
        for item in formation_sessions_seed:
            formation = formations_by_slug.get(str(item["formation_slug"]))
            if formation is None:
                continue
            session_key = (formation.id, str(item["label"]))
            if session_key in existing_keys:
                continue
            db.add(
                FormationSessionRecord(
                    formation_id=formation.id,
                    label=str(item["label"]),
                    start_date=item["start_date"],
                    end_date=item["end_date"],
                    campus_label=str(item["campus_label"]),
                    seat_capacity=int(item["seat_capacity"]),
                    enrolled_count=int(item["enrolled_count"]),
                    teacher_name=str(item["teacher_name"]),
                    status=str(item["status"]),
                )
            )

    users_by_name = {user.full_name: user for user in db.scalars(select(UserRecord)).all()}
    formations_by_title = {
        formation.title: formation for formation in db.scalars(select(FormationRecord)).all()
    }

    if not _table_has_rows(db, OrderRecord):
        for item in ORDER_SEED:
            user = users_by_name.get(item["customer_name"])
            formation = formations_by_title.get(item["formation_title"])
            db.add(
                OrderRecord(
                    **item,
                    user_id=user.id if user else None,
                    formation_id=formation.id if formation else None,
                )
            )
    else:
        orders_by_reference = {
            order.reference: order for order in db.scalars(select(OrderRecord)).all()
        }
        for item in ORDER_SEED:
            existing_order = orders_by_reference.get(item["reference"])
            user = users_by_name.get(item["customer_name"])
            formation = formations_by_title.get(item["formation_title"])

            if existing_order is None:
                db.add(
                    OrderRecord(
                        **item,
                        user_id=user.id if user else None,
                        formation_id=formation.id if formation else None,
                    )
                )
                continue

            if existing_order.user_id is None and user:
                existing_order.user_id = user.id

            if existing_order.formation_id is None and formation:
                existing_order.formation_id = formation.id

            db.add(existing_order)

    if not _table_has_rows(db, PaymentRecord):
        db.add_all(PaymentRecord(**item) for item in PAYMENT_SEED)

    db.commit()
