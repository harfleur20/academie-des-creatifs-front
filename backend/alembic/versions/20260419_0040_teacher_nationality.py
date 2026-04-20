"""add nationality to teacher profiles and invitations

Revision ID: 20260419_0040
Revises: 20260419_0039
Create Date: 2026-04-19 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260419_0040"
down_revision = "20260419_0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("teacher_profiles") as batch_op:
        batch_op.add_column(sa.Column("nationality", sa.String(length=120), nullable=True))

    with op.batch_alter_table("teacher_invitations") as batch_op:
        batch_op.add_column(sa.Column("nationality", sa.String(length=120), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("teacher_invitations") as batch_op:
        batch_op.drop_column("nationality")

    with op.batch_alter_table("teacher_profiles") as batch_op:
        batch_op.drop_column("nationality")
