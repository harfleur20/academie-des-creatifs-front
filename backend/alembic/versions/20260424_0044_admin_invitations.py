"""add admin_invitations table

Revision ID: 20260424_0044
Revises: 20260424_0043
Create Date: 2026-04-24 12:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260424_0044"
down_revision = "20260424_0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_invitations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("token", sa.String(64), unique=True, index=True, nullable=False),
        sa.Column("email", sa.String(180), index=True, nullable=False),
        sa.Column("full_name", sa.String(180), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("admin_invitations")
