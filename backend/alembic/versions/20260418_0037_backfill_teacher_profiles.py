"""backfill teacher profiles and codes

Revision ID: 20260418_0037
Revises: 20260418_0036
Create Date: 2026-04-18 00:00:00.000000
"""

from __future__ import annotations

from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op


revision = "20260418_0037"
down_revision = "20260418_0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    users = sa.table(
        "users",
        sa.column("id", sa.Integer),
        sa.column("role", sa.String),
    )
    teacher_profiles = sa.table(
        "teacher_profiles",
        sa.column("id", sa.Integer),
        sa.column("user_id", sa.Integer),
        sa.column("teacher_code", sa.String),
    )
    counters = sa.table(
        "teacher_code_counters",
        sa.column("year", sa.Integer),
        sa.column("last_sequence", sa.Integer),
    )

    year = datetime.now(timezone.utc).year
    counter_row = bind.execute(
        sa.select(counters.c.last_sequence).where(counters.c.year == year)
    ).first()
    sequence = int(counter_row[0]) if counter_row else 0
    if counter_row is None:
        bind.execute(counters.insert().values(year=year, last_sequence=0))

    existing_profile_user_ids = {
        row[0]
        for row in bind.execute(sa.select(teacher_profiles.c.user_id)).all()
    }
    teacher_rows = bind.execute(
        sa.select(users.c.id).where(users.c.role == "teacher").order_by(users.c.id)
    ).all()

    for row in teacher_rows:
        user_id = row[0]
        if user_id in existing_profile_user_ids:
            continue
        sequence += 1
        bind.execute(
            teacher_profiles.insert().values(
                user_id=user_id,
                teacher_code=f"ENS-{year}-{sequence:04d}",
            )
        )

    empty_code_rows = bind.execute(
        sa.select(teacher_profiles.c.id)
        .where(teacher_profiles.c.teacher_code.is_(None))
        .order_by(teacher_profiles.c.id)
    ).all()
    for row in empty_code_rows:
        sequence += 1
        bind.execute(
            sa.update(teacher_profiles)
            .where(teacher_profiles.c.id == row[0])
            .values(teacher_code=f"ENS-{year}-{sequence:04d}")
        )

    bind.execute(
        sa.update(counters)
        .where(counters.c.year == year)
        .values(last_sequence=sequence)
    )


def downgrade() -> None:
    pass
