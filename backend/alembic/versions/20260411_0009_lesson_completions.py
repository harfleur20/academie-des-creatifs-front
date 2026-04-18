"""add lesson_completions table

Revision ID: 20260411_0009
Revises: 20260404_0008
Create Date: 2026-04-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260411_0009"
down_revision = "20260404_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lesson_completions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "enrollment_id",
            sa.Integer(),
            sa.ForeignKey("enrollments.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("module_index", sa.Integer(), nullable=False),
        sa.Column("lesson_index", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "enrollment_id", "module_index", "lesson_index",
            name="uq_lesson_completion",
        ),
    )


def downgrade() -> None:
    op.drop_table("lesson_completions")
