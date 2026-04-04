"""add formation sessions

Revision ID: 20260404_0007
Revises: 20260403_0006
Create Date: 2026-04-04 10:30:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260404_0007"
down_revision: str | None = "20260403_0006"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "formation_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("formation_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=180), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("campus_label", sa.String(length=180), nullable=True),
        sa.Column("seat_capacity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enrolled_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("teacher_name", sa.String(length=180), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="planned"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["formation_id"], ["formations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_formation_sessions_formation_id"),
        "formation_sessions",
        ["formation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_formation_sessions_formation_id"), table_name="formation_sessions")
    op.drop_table("formation_sessions")
