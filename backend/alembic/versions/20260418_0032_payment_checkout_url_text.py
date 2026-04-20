"""expand payment checkout url storage

Revision ID: 20260418_0032
Revises: 20260418_0031
Create Date: 2026-04-18 02:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260418_0032"
down_revision = "20260418_0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.alter_column(
            "provider_checkout_url",
            existing_type=sa.String(length=512),
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.alter_column(
            "provider_checkout_url",
            existing_type=sa.Text(),
            type_=sa.String(length=512),
            existing_nullable=True,
        )
