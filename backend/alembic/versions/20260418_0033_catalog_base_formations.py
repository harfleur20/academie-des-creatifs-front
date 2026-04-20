"""move base catalog formations out of startup seed

Revision ID: 20260418_0033
Revises: 20260418_0032
Create Date: 2026-04-18 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql, sqlite


revision = "20260418_0033"
down_revision = "20260418_0032"
branch_labels = None
depends_on = None


FORMATIONS = [
    {
        "slug": "maitrisez-design-packaging-a-z",
        "title": "Maitrisez le Design de Packaging de A a Z - De la decoupe a l'impression",
        "category": "Packaging design",
        "level": "Niveau intermediaire",
        "image": "/Flyers/packaging.jpg",
        "intro": "",
        "mentor_name": "",
        "mentor_label": "",
        "mentor_image": "",
        "included_items": [],
        "objective_items": [],
        "project_items": [],
        "audience_text": "",
        "certificate_copy": "",
        "certificate_image": "",
        "module_items": [],
        "faq_items": [],
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
        "intro": "",
        "mentor_name": "",
        "mentor_label": "",
        "mentor_image": "",
        "included_items": [],
        "objective_items": [],
        "project_items": [],
        "audience_text": "",
        "certificate_copy": "",
        "certificate_image": "",
        "module_items": [],
        "faq_items": [],
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
        "intro": "",
        "mentor_name": "",
        "mentor_label": "",
        "mentor_image": "",
        "included_items": [],
        "objective_items": [],
        "project_items": [],
        "audience_text": "",
        "certificate_copy": "",
        "certificate_image": "",
        "module_items": [],
        "faq_items": [],
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
        "intro": "",
        "mentor_name": "",
        "mentor_label": "",
        "mentor_image": "",
        "included_items": [],
        "objective_items": [],
        "project_items": [],
        "audience_text": "",
        "certificate_copy": "",
        "certificate_image": "",
        "module_items": [],
        "faq_items": [],
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
        "intro": "",
        "mentor_name": "",
        "mentor_label": "",
        "mentor_image": "",
        "included_items": [],
        "objective_items": [],
        "project_items": [],
        "audience_text": "",
        "certificate_copy": "",
        "certificate_image": "",
        "module_items": [],
        "faq_items": [],
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


def _formations_table() -> sa.TableClause:
    return sa.table(
        "formations",
        sa.column("slug", sa.String),
        sa.column("title", sa.String),
        sa.column("category", sa.String),
        sa.column("level", sa.String),
        sa.column("image", sa.String),
        sa.column("intro", sa.Text),
        sa.column("mentor_name", sa.String),
        sa.column("mentor_label", sa.String),
        sa.column("mentor_image", sa.String),
        sa.column("included_items", sa.JSON),
        sa.column("objective_items", sa.JSON),
        sa.column("project_items", sa.JSON),
        sa.column("audience_text", sa.Text),
        sa.column("certificate_copy", sa.Text),
        sa.column("certificate_image", sa.String),
        sa.column("module_items", sa.JSON),
        sa.column("faq_items", sa.JSON),
        sa.column("format_type", sa.String),
        sa.column("dashboard_type", sa.String),
        sa.column("session_label", sa.String),
        sa.column("current_price_amount", sa.Integer),
        sa.column("original_price_amount", sa.Integer),
        sa.column("price_currency", sa.String),
        sa.column("allow_installments", sa.Boolean),
        sa.column("is_featured_home", sa.Boolean),
        sa.column("home_feature_rank", sa.Integer),
        sa.column("rating", sa.Float),
        sa.column("reviews", sa.Integer),
        sa.column("badges", sa.JSON),
    )


def upgrade() -> None:
    bind = op.get_bind()
    formations_table = _formations_table()

    if bind.dialect.name == "postgresql":
        statement = (
            postgresql.insert(formations_table)
            .values(FORMATIONS)
            .on_conflict_do_nothing(index_elements=["slug"])
        )
        bind.execute(statement)
        return

    if bind.dialect.name == "sqlite":
        for formation in FORMATIONS:
            bind.execute(sqlite.insert(formations_table).values(formation).prefix_with("OR IGNORE"))
        return

    for formation in FORMATIONS:
        exists = bind.execute(
            sa.select(formations_table.c.slug).where(formations_table.c.slug == formation["slug"])
        ).first()
        if not exists:
            bind.execute(formations_table.insert().values(formation))


def downgrade() -> None:
    slugs = [formation["slug"] for formation in FORMATIONS]
    formations_table = _formations_table()
    op.execute(sa.delete(formations_table).where(formations_table.c.slug.in_(slugs)))
