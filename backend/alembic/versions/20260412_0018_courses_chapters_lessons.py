"""add courses, chapters, lessons, lesson_progress tables

Revision ID: 20260412_0018
Revises: 20260412_0017
Create Date: 2026-04-12 11:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260412_0018"
down_revision = "20260412_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── courses ───────────────────────────────────────────────────────────────
    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.Integer(),
                  sa.ForeignKey("formation_sessions.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )

    # ── chapters ──────────────────────────────────────────────────────────────
    op.create_table(
        "chapters",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("course_id", sa.Integer(),
                  sa.ForeignKey("courses.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )

    # ── lessons ───────────────────────────────────────────────────────────────
    op.create_table(
        "lessons",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("chapter_id", sa.Integer(),
                  sa.ForeignKey("chapters.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        # lesson_type: text | video | pdf | quiz | assignment | resource
        sa.Column("lesson_type", sa.String(16), nullable=False, server_default="text"),
        sa.Column("content", sa.Text(), nullable=True),        # for type=text
        sa.Column("video_url", sa.String(512), nullable=True), # for type=video
        sa.Column("file_url", sa.String(512), nullable=True),  # for type=pdf
        # FK links to existing objects
        sa.Column("quiz_id", sa.Integer(),
                  sa.ForeignKey("quizzes.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("assignment_id", sa.Integer(),
                  sa.ForeignKey("assignments.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("resource_id", sa.Integer(),
                  sa.ForeignKey("resources.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )

    # ── lesson_progress ───────────────────────────────────────────────────────
    op.create_table(
        "lesson_progress",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("enrollment_id", sa.Integer(),
                  sa.ForeignKey("enrollments.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("lesson_id", sa.Integer(),
                  sa.ForeignKey("lessons.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("completed_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("enrollment_id", "lesson_id", name="uq_lesson_progress"),
    )


def downgrade() -> None:
    op.drop_table("lesson_progress")
    op.drop_table("lessons")
    op.drop_table("chapters")
    op.drop_table("courses")
