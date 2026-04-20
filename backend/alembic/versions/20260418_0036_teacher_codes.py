"""add teacher code generation

Revision ID: 20260418_0036
Revises: 20260418_0035
Create Date: 2026-04-18 00:00:00.000000
"""

from __future__ import annotations

from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op


revision = "20260418_0036"
down_revision = "20260418_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("teacher_profiles") as batch_op:
        batch_op.add_column(sa.Column("teacher_code", sa.String(length=20), nullable=True))
        batch_op.create_index(op.f("ix_teacher_profiles_teacher_code"), ["teacher_code"], unique=True)

    op.create_table(
        "teacher_code_counters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("last_sequence", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_teacher_code_counters_year"),
        "teacher_code_counters",
        ["year"],
        unique=True,
    )

    bind = op.get_bind()
    teacher_profiles = sa.table(
        "teacher_profiles",
        sa.column("id", sa.Integer),
        sa.column("teacher_code", sa.String),
    )
    counters = sa.table(
        "teacher_code_counters",
        sa.column("year", sa.Integer),
        sa.column("last_sequence", sa.Integer),
    )

    year = datetime.now(timezone.utc).year
    rows = bind.execute(
        sa.select(teacher_profiles.c.id)
        .where(teacher_profiles.c.teacher_code.is_(None))
        .order_by(teacher_profiles.c.id)
    ).mappings().all()

    for sequence, row in enumerate(rows, start=1):
        bind.execute(
            sa.update(teacher_profiles)
            .where(teacher_profiles.c.id == row["id"])
            .values(teacher_code=f"ENS-{year}-{sequence:04d}")
        )

    if rows:
        bind.execute(counters.insert().values(year=year, last_sequence=len(rows)))


def downgrade() -> None:
    op.drop_index(op.f("ix_teacher_code_counters_year"), table_name="teacher_code_counters")
    op.drop_table("teacher_code_counters")
    with op.batch_alter_table("teacher_profiles") as batch_op:
        batch_op.drop_index(op.f("ix_teacher_profiles_teacher_code"))
        batch_op.drop_column("teacher_code")
