"""add site_config table

Revision ID: 20260411_0010
Revises: 20260411_0009
Create Date: 2026-04-11 01:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260411_0010"
down_revision = "20260411_0009"
branch_labels = None
depends_on = None

DEFAULTS = [
    ("site_name",        "Académie des Créatifs"),
    ("tagline",          "Formez-vous. Créez. Évoluez."),
    ("seo_description",  ""),
    ("logo_url",         ""),
    ("favicon_url",      ""),
    ("banner_title",     "Formez-vous avec les meilleurs"),
    ("banner_subtitle",  "Découvrez nos formations en ligne, en live et en présentiel."),
    ("banner_cta",       "Découvrir le catalogue"),
    ("banner_image_url", ""),
    ("color_primary",    "#1f2559"),
    ("color_accent",     "#18a7a3"),
    ("font_heading",     "Space Grotesk"),
    ("font_body",        "Manrope"),
]


def upgrade() -> None:
    site_config = op.create_table(
        "site_config",
        sa.Column("key",   sa.String(64), primary_key=True),
        sa.Column("value", sa.Text(),     nullable=False, server_default=""),
    )
    op.bulk_insert(site_config, [{"key": k, "value": v} for k, v in DEFAULTS])


def downgrade() -> None:
    op.drop_table("site_config")
