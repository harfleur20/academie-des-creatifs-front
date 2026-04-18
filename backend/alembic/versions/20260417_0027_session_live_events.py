"""create session_live_events table

Revision ID: 20260417_0027
Revises: 20260417_0026
Create Date: 2026-04-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260417_0027"
down_revision = "20260417_0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "session_live_events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "session_id",
            sa.Integer,
            sa.ForeignKey("formation_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer, nullable=False, server_default="90"),
        sa.Column("status", sa.String(32), nullable=False, server_default="scheduled"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_session_live_events_session_id",
        "session_live_events",
        ["session_id"],
    )
    op.create_index(
        "ix_session_live_events_scheduled_at",
        "session_live_events",
        ["scheduled_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_session_live_events_scheduled_at", table_name="session_live_events")
    op.drop_index("ix_session_live_events_session_id", table_name="session_live_events")
    op.drop_table("session_live_events")
