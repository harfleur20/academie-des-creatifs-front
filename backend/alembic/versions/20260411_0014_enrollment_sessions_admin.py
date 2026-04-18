"""link enrollments to formation sessions

Revision ID: 20260411_0014
Revises: 20260411_0013
Create Date: 2026-04-11 06:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260411_0014"
down_revision = "20260411_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("enrollments") as batch_op:
        batch_op.add_column(sa.Column("session_id", sa.Integer(), nullable=True))
        batch_op.create_index(op.f("ix_enrollments_session_id"), ["session_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_enrollments_session_id",
            "formation_sessions",
            ["session_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.execute(
        """
        UPDATE enrollments
        SET session_id = (
            SELECT fs.id
            FROM formation_sessions fs
            WHERE fs.formation_id = enrollments.formation_id
              AND fs.status != 'cancelled'
              AND fs.end_date >= CURRENT_DATE
            ORDER BY fs.start_date ASC, fs.id ASC
            LIMIT 1
        )
        WHERE session_id IS NULL
        """
    )

    op.execute(
        """
        UPDATE enrollments
        SET session_id = (
            SELECT fs.id
            FROM formation_sessions fs
            WHERE fs.formation_id = enrollments.formation_id
              AND fs.status != 'cancelled'
              AND fs.end_date < CURRENT_DATE
            ORDER BY fs.end_date DESC, fs.id DESC
            LIMIT 1
        )
        WHERE session_id IS NULL
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("enrollments") as batch_op:
        batch_op.drop_constraint("fk_enrollments_session_id", type_="foreignkey")
        batch_op.drop_index(op.f("ix_enrollments_session_id"))
        batch_op.drop_column("session_id")
