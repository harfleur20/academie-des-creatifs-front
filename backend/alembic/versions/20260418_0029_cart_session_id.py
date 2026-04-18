"""add session_id to cart_items

Revision ID: 20260418_0029
Revises: 20260417_0028
Create Date: 2026-04-18 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260418_0029"
down_revision = "20260417_0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("cart_items") as batch_op:
        batch_op.add_column(sa.Column("session_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("cart_items") as batch_op:
        batch_op.drop_column("session_id")
