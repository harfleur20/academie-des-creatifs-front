"""add meeting_link to formation_sessions

Revision ID: 20260417_0024
Revises: 20260417_0023
Create Date: 2026-04-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260417_0024"
down_revision = "20260417_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "formation_sessions",
        sa.Column("meeting_link", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("formation_sessions", "meeting_link")
