"""add session course days

Revision ID: 20260417_0028
Revises: 20260417_0027
Create Date: 2026-04-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260417_0028"
down_revision = "20260417_0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "session_course_days",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("formation_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "live_event_id",
            sa.Integer(),
            sa.ForeignKey("session_live_events.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("status", sa.String(32), nullable=False, server_default="planned"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_session_course_days_session_id", "session_course_days", ["session_id"])
    op.create_index("ix_session_course_days_live_event_id", "session_course_days", ["live_event_id"], unique=True)
    op.create_index("ix_session_course_days_scheduled_at", "session_course_days", ["scheduled_at"])

    with op.batch_alter_table("attendance_records") as batch:
        batch.add_column(sa.Column("course_day_id", sa.Integer(), nullable=True))
        batch.create_index("ix_attendance_records_course_day_id", ["course_day_id"])
        batch.create_foreign_key(
            "fk_attendance_records_course_day_id",
            "session_course_days",
            ["course_day_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.drop_constraint("uq_attendance", type_="unique")
        batch.create_unique_constraint(
            "uq_attendance_course_day",
            ["session_id", "enrollment_id", "course_day_id"],
        )

    with op.batch_alter_table("grade_records") as batch:
        batch.add_column(sa.Column("course_day_id", sa.Integer(), nullable=True))
        batch.create_index("ix_grade_records_course_day_id", ["course_day_id"])
        batch.create_foreign_key(
            "fk_grade_records_course_day_id",
            "session_course_days",
            ["course_day_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.drop_constraint("uq_grade", type_="unique")
        batch.create_unique_constraint(
            "uq_grade_course_day",
            ["session_id", "enrollment_id", "label", "course_day_id"],
        )

    for table in ("quizzes", "resources", "assignments"):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("course_day_id", sa.Integer(), nullable=True))
            batch.create_index(f"ix_{table}_course_day_id", ["course_day_id"])
            batch.create_foreign_key(
                f"fk_{table}_course_day_id",
                "session_course_days",
                ["course_day_id"],
                ["id"],
                ondelete="SET NULL",
            )


def downgrade() -> None:
    for table in ("assignments", "resources", "quizzes"):
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(f"fk_{table}_course_day_id", type_="foreignkey")
            batch.drop_index(f"ix_{table}_course_day_id")
            batch.drop_column("course_day_id")

    with op.batch_alter_table("grade_records") as batch:
        batch.drop_constraint("uq_grade_course_day", type_="unique")
        batch.drop_constraint("fk_grade_records_course_day_id", type_="foreignkey")
        batch.drop_index("ix_grade_records_course_day_id")
        batch.drop_column("course_day_id")
        batch.create_unique_constraint("uq_grade", ["session_id", "enrollment_id", "label"])

    with op.batch_alter_table("attendance_records") as batch:
        batch.drop_constraint("uq_attendance_course_day", type_="unique")
        batch.drop_constraint("fk_attendance_records_course_day_id", type_="foreignkey")
        batch.drop_index("ix_attendance_records_course_day_id")
        batch.drop_column("course_day_id")
        batch.create_unique_constraint("uq_attendance", ["session_id", "enrollment_id"])

    op.drop_index("ix_session_course_days_scheduled_at", table_name="session_course_days")
    op.drop_index("ix_session_course_days_live_event_id", table_name="session_course_days")
    op.drop_index("ix_session_course_days_session_id", table_name="session_course_days")
    op.drop_table("session_course_days")
