"""add promo end date to formations

Revision ID: 20260420_0042
Revises: 20260420_0041
Create Date: 2026-04-20 00:42:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260420_0042"
down_revision = "20260420_0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("formations") as batch_op:
        batch_op.add_column(sa.Column("promo_ends_at", sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("formations") as batch_op:
        batch_op.drop_column("promo_ends_at")
