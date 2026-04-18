"""add installment_plan to orders and installment fields to payments

Revision ID: 20260411_0012
Revises: 20260411_0011
Create Date: 2026-04-11 03:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260411_0012"
down_revision = "20260411_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("orders") as batch_op:
        batch_op.add_column(
            sa.Column("installment_plan", sa.String(16), nullable=False, server_default="full")
        )

    with op.batch_alter_table("payments") as batch_op:
        batch_op.add_column(sa.Column("installment_number", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("due_date", sa.Date(), nullable=True))

    # Remove server defaults (keep values already written)
    with op.batch_alter_table("orders") as batch_op:
        batch_op.alter_column("installment_plan", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.drop_column("due_date")
        batch_op.drop_column("installment_number")

    with op.batch_alter_table("orders") as batch_op:
        batch_op.drop_column("installment_plan")
