"""add avatar_url to users

Revision ID: 20260417_0026
Revises: 20260417_0025
Create Date: 2026-04-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260417_0026"
down_revision = "20260417_0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
