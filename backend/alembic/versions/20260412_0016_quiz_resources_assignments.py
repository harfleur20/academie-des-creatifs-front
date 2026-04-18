"""add quizzes, resources and assignments tables

Revision ID: 20260412_0016
Revises: 20260412_0015
Create Date: 2026-04-12 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260412_0016"
down_revision = "20260412_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── quizzes ──────────────────────────���─────────────────────────────────
    op.create_table(
        "quizzes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id", sa.Integer(),
            sa.ForeignKey("formation_sessions.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── quiz_questions ─────────────────────────────────────────────────────
    op.create_table(
        "quiz_questions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "quiz_id", sa.Integer(),
            sa.ForeignKey("quizzes.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("options", sa.JSON(), nullable=False),
        sa.Column("correct_index", sa.Integer(), nullable=False, server_default="0"),
    )

    # ── quiz_attempts ──────────────────────────────────────────────────────
    op.create_table(
        "quiz_attempts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "quiz_id", sa.Integer(),
            sa.ForeignKey("quizzes.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "enrollment_id", sa.Integer(),
            sa.ForeignKey("enrollments.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column("score_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("quiz_id", "enrollment_id", "attempt_number", name="uq_quiz_attempt"),
    )

    # ── resources ──────────────────────────────────────────────────────────
    op.create_table(
        "resources",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id", sa.Integer(),
            sa.ForeignKey("formation_sessions.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("resource_type", sa.String(16), nullable=False, server_default="link"),
        sa.Column("url", sa.String(512), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── assignments ────────────────────────────────────────────────────────
    op.create_table(
        "assignments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id", sa.Integer(),
            sa.ForeignKey("formation_sessions.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False, server_default=""),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── assignment_submissions ───────────────────────────────��─────────────
    op.create_table(
        "assignment_submissions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "assignment_id", sa.Integer(),
            sa.ForeignKey("assignments.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "enrollment_id", sa.Integer(),
            sa.ForeignKey("enrollments.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("file_url", sa.String(512), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_reviewed", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("assignment_id", "enrollment_id", name="uq_assignment_submission"),
    )


def downgrade() -> None:
    op.drop_table("assignment_submissions")
    op.drop_table("assignments")
    op.drop_table("resources")
    op.drop_table("quiz_attempts")
    op.drop_table("quiz_questions")
    op.drop_table("quizzes")
