"""add group_reference to orders

Revision ID: 20260418_0031
Revises: 20260418_0030
Create Date: 2026-04-18 01:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260418_0031"
down_revision = "20260418_0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("group_reference", sa.String(64), nullable=True),
    )
    op.create_index("ix_orders_group_reference", "orders", ["group_reference"])


def downgrade() -> None:
    op.drop_index("ix_orders_group_reference", table_name="orders")
    op.drop_column("orders", "group_reference")
