"""add session and checkout refs to payments

Revision ID: 20260418_0030
Revises: 20260418_0029
Create Date: 2026-04-18 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260418_0030"
down_revision = "20260418_0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("orders") as batch_op:
        batch_op.add_column(sa.Column("session_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_orders_session_id", ["session_id"])
        batch_op.create_foreign_key(
            "fk_orders_session_id",
            "formation_sessions",
            ["session_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("payments") as batch_op:
        batch_op.add_column(sa.Column("provider_payment_id", sa.String(length=180), nullable=True))
        batch_op.add_column(sa.Column("provider_checkout_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.drop_column("provider_checkout_url")
        batch_op.drop_column("provider_payment_id")

    with op.batch_alter_table("orders") as batch_op:
        batch_op.drop_constraint("fk_orders_session_id", type_="foreignkey")
        batch_op.drop_index("ix_orders_session_id")
        batch_op.drop_column("session_id")
