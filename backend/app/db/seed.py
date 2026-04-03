from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.entities import (
    FormationRecord,
    OnsiteSessionRecord,
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
        "session_label": "Prochaine session : 15 avril 2026",
        "current_price_amount": 50000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": False,
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
        "session_label": "Prochaine session : 06 mai 2026",
        "current_price_amount": 65000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": False,
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
        "session_label": "Prochaine session : 17 avril 2026",
        "current_price_amount": 70000,
        "original_price_amount": 95000,
        "price_currency": "XAF",
        "allow_installments": False,
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
        "session_label": "Prochaine session : 09 mai 2026",
        "current_price_amount": 50000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": False,
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
        "session_label": "Cohorte presentiel : 20 mai 2026",
        "current_price_amount": 120000,
        "original_price_amount": None,
        "price_currency": "XAF",
        "allow_installments": True,
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

ONSITE_SESSION_SEED = [
    {
        "formation_title": "Brand Identity Intensive",
        "label": "Cohorte Avril 2026",
        "start_date": date(2026, 4, 17),
        "campus_label": "Douala - Bonapriso",
        "seat_capacity": 30,
        "enrolled_count": 18,
        "teacher_name": "Bihee Alex",
        "status": "open",
    },
    {
        "formation_title": "Motion Design Bootcamp",
        "label": "Cohorte Mai 2026",
        "start_date": date(2026, 5, 3),
        "campus_label": "Douala - Akwa",
        "seat_capacity": 24,
        "enrolled_count": 11,
        "teacher_name": "Francis Kenne",
        "status": "open",
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


def seed_database(db: Session) -> None:
    if not _table_has_rows(db, FormationRecord):
        db.add_all(FormationRecord(**item) for item in FORMATION_SEED)
    else:
        formations_by_slug = {
            formation.slug: formation for formation in db.scalars(select(FormationRecord)).all()
        }
        for item in FORMATION_SEED:
            if item["slug"] in formations_by_slug:
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

    if not _table_has_rows(db, OnsiteSessionRecord):
        db.add_all(OnsiteSessionRecord(**item) for item in ONSITE_SESSION_SEED)

    if not _table_has_rows(db, OrderRecord):
        db.add_all(OrderRecord(**item) for item in ORDER_SEED)

    if not _table_has_rows(db, PaymentRecord):
        db.add_all(PaymentRecord(**item) for item in PAYMENT_SEED)

    db.commit()
