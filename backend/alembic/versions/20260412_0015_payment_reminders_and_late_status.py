"""add payment reminder metadata

Revision ID: 20260412_0015
Revises: 20260411_0014
Create Date: 2026-04-12 09:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260412_0015"
down_revision = "20260411_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.add_column(
            sa.Column("reminder_count", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(sa.Column("last_reminded_at", sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table("payments") as batch_op:
        batch_op.alter_column("reminder_count", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.drop_column("last_reminded_at")
        batch_op.drop_column("reminder_count")
