"""add is_final_project and review score to assignments/submissions

Revision ID: 20260413_0019
Revises: 20260412_0018
Create Date: 2026-04-13 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260413_0019"
down_revision = "20260412_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("assignments", sa.Column("is_final_project", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("assignment_submissions", sa.Column("review_score", sa.Float(), nullable=True))
    op.add_column("assignment_submissions", sa.Column("review_max_score", sa.Float(), nullable=False, server_default="20"))


def downgrade() -> None:
    op.drop_column("assignment_submissions", "review_max_score")
    op.drop_column("assignment_submissions", "review_score")
    op.drop_column("assignments", "is_final_project")
