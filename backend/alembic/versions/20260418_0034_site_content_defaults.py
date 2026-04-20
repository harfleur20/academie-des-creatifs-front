"""seed editable public site content

Revision ID: 20260418_0034
Revises: 20260418_0033
Create Date: 2026-04-18 00:00:00.000000
"""

from __future__ import annotations

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql, sqlite


revision = "20260418_0034"
down_revision = "20260418_0033"
branch_labels = None
depends_on = None


SITE_CONTENT = {
    "album_items": [
        {"image": "/img-bg-4.jpg", "title": "Soutenance de Vanel à l'Académie des Créatifs"},
        {"image": "/Album/album-1.jpg", "title": "Séance de travaux pratiques sur Illustrator"},
        {"image": "/Album/album-2.jpg", "title": "Les bases du dessin pour les logos croquis"},
        {"image": "/Album/album-3.jpg", "title": "Séance de travaux pratiques sur Photoshop"},
        {"image": "/Album/album-9.jpg", "title": "Atelier pratique sur la conception de packaging"},
        {"image": "/Album/album-6.jpg", "title": "La toute première promotion de l'Académie des Créatifs"},
        {"image": "/Album/album-7.jpg", "title": "Présentation projet en présentiel par nos étudiants"},
        {"image": "/Album/album-8.jpg", "title": "Melvine, gagnante de la coupe des Créatifs"},
        {"image": "/Album/coupecreatif.jpg", "title": "Loic, gagnant de la coupe des Créatifs"},
    ],
    "videos": [
        "https://www.youtube.com/embed/dKrZ6tPL_wU",
        "https://www.youtube.com/embed/fHsVZ_qQ4ac",
        "https://www.youtube.com/embed/veXfXR9vgQM",
        "https://www.youtube.com/embed/HeIauv3DSs8",
    ],
    "testimonials": [
        {
            "quote": "Graphiste et bientôt développeur fullstack, grâce à l'Académie des Créatifs. Ils m'ont appris à saisir les opportunités et à vendre mes services.",
            "name": "Melvine Possi",
            "role": "Graphiste & développeur, freelance",
            "detail": "Ancienne étudiante de l'Académie des Créatifs",
            "image": "/T%C3%A9moignages/Melvine-Possi.jpg",
        },
        {
            "quote": "Je recommande fortement cette page à tous les amateurs en design graphique pour gagner en savoir-faire et acquérir de l'expérience.",
            "name": "Monsieur Bënguiste",
            "role": "Responsable des projets graphiques, Vacom Agency",
            "detail": "Partenaire de l'Académie des Créatifs",
            "image": "/T%C3%A9moignages/mr-benguiste.jpg",
        },
        {
            "quote": "L'Académie des Créatifs ne transmet pas seulement la compétence, mais également la passion pour le design graphique.",
            "name": "Loic Djitouo",
            "role": "Graphiste, freelance",
            "detail": "Gagnant 2e édition de la coupe des Créatifs",
            "image": "/T%C3%A9moignages/loic-djitcho.jpg",
        },
    ],
    "badge_levels": [
        {"name": "Aventurier", "image": "/Badges/bg-avanturier.svg", "className": "prog-carte-cercle-1"},
        {"name": "Débutant", "image": "/Badges/bg-debutant.svg", "className": "prog-carte-cercle-2"},
        {"name": "Intermédiaire", "image": "/Badges/bg-interm%C3%A9diare.svg", "className": "prog-carte-cercle-3"},
        {"name": "Semi-pro", "image": "/Badges/bg-semi-pro.svg", "className": "prog-carte-cercle-4"},
        {"name": "Professionnel", "image": "/Badges/bg-professionnel.svg", "className": "prog-carte-cercle-5"},
    ],
    "trainers": [
        {
            "name": "Francis Kenne",
            "image": "/Teams/photo-fk.jpg",
            "role": "Graphiste, motion graphics, développeur fullstack",
            "label": "Responsable académique",
        },
        {
            "name": "Bihee Alex",
            "image": "/Teams/photo-Alex-Bihee.jpg",
            "role": "Brand Identity, web designer, développeur front-end",
            "label": "Formateur",
        },
        {
            "name": "Natchi Dylan",
            "image": "/Teams/photo-natchi.jpg",
            "role": "Community manager, Canva Designer",
            "label": "Responsable des formations",
        },
        {
            "name": "Kouakam Lary",
            "image": "/Teams/laryadd.jpg",
            "role": "Graphiste, freelancer, développeur web",
            "label": "Formateur",
        },
    ],
}


def _site_config_table() -> sa.TableClause:
    return sa.table(
        "site_config",
        sa.column("key", sa.String),
        sa.column("value", sa.Text),
    )


def _rows() -> list[dict[str, str]]:
    return [
        {
            "key": key,
            "value": json.dumps(value, ensure_ascii=False),
        }
        for key, value in SITE_CONTENT.items()
    ]


def upgrade() -> None:
    bind = op.get_bind()
    site_config = _site_config_table()
    rows = _rows()

    if bind.dialect.name == "postgresql":
        statement = (
            postgresql.insert(site_config)
            .values(rows)
            .on_conflict_do_nothing(index_elements=["key"])
        )
        bind.execute(statement)
        return

    if bind.dialect.name == "sqlite":
        for row in rows:
            bind.execute(sqlite.insert(site_config).values(row).prefix_with("OR IGNORE"))
        return

    for row in rows:
        exists = bind.execute(
            sa.select(site_config.c.key).where(site_config.c.key == row["key"])
        ).first()
        if not exists:
            bind.execute(site_config.insert().values(row))


def downgrade() -> None:
    site_config = _site_config_table()
    op.execute(sa.delete(site_config).where(site_config.c.key.in_(SITE_CONTENT.keys())))
