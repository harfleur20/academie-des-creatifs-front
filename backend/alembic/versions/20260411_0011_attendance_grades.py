"""add attendance_records and grade_records tables

Revision ID: 20260411_0011
Revises: 20260411_0010
Create Date: 2026-04-11 02:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260411_0011"
down_revision = "20260411_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id", sa.Integer(),
            sa.ForeignKey("formation_sessions.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "enrollment_id", sa.Integer(),
            sa.ForeignKey("enrollments.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="present"),
        sa.Column("note",   sa.Text(),     nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("session_id", "enrollment_id", name="uq_attendance"),
    )

    op.create_table(
        "grade_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id", sa.Integer(),
            sa.ForeignKey("formation_sessions.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "enrollment_id", sa.Integer(),
            sa.ForeignKey("enrollments.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("label",     sa.String(180), nullable=False),
        sa.Column("score",     sa.Float(),     nullable=False, server_default="0"),
        sa.Column("max_score", sa.Float(),     nullable=False, server_default="20"),
        sa.Column("note",      sa.Text(),      nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("session_id", "enrollment_id", "label", name="uq_grade"),
    )


def downgrade() -> None:
    op.drop_table("grade_records")
    op.drop_table("attendance_records")
