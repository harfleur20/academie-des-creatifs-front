"""add duration_minutes to quizzes

Revision ID: 20260412_0017
Revises: 20260412_0016
Create Date: 2026-04-12 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260412_0017"
down_revision = "20260412_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quizzes",
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("quizzes", "duration_minutes")
