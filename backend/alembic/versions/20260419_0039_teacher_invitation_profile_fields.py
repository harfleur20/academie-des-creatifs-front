"""add profile fields to teacher invitations

Revision ID: 20260419_0039
Revises: 20260419_0038
Create Date: 2026-04-19 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260419_0039"
down_revision = "20260419_0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("teacher_invitations") as batch_op:
        batch_op.add_column(sa.Column("whatsapp", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("subject", sa.String(length=180), nullable=True))
        batch_op.add_column(sa.Column("experience_years", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("portfolio_url", sa.String(length=512), nullable=True))
        batch_op.add_column(sa.Column("bio", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("teacher_invitations") as batch_op:
        batch_op.drop_column("bio")
        batch_op.drop_column("portfolio_url")
        batch_op.drop_column("experience_years")
        batch_op.drop_column("subject")
        batch_op.drop_column("whatsapp")
