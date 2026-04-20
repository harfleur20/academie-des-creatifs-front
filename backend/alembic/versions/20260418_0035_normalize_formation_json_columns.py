"""normalize formation json list columns

Revision ID: 20260418_0035
Revises: 20260418_0034
Create Date: 2026-04-18 00:00:00.000000
"""

from __future__ import annotations

import json

import sqlalchemy as sa
from alembic import op


revision = "20260418_0035"
down_revision = "20260418_0034"
branch_labels = None
depends_on = None


JSON_COLUMNS = (
    "badges",
    "included_items",
    "objective_items",
    "project_items",
    "module_items",
    "faq_items",
)


def _formation_table() -> sa.TableClause:
    return sa.table(
        "formations",
        sa.column("id", sa.Integer),
        *[sa.column(column, sa.JSON) for column in JSON_COLUMNS],
    )


def _decoded_json_list(value: object) -> list[object] | None:
    if not isinstance(value, str):
        return None
    try:
        decoded = json.loads(value)
    except json.JSONDecodeError:
        return None
    return decoded if isinstance(decoded, list) else None


def upgrade() -> None:
    bind = op.get_bind()
    formations = _formation_table()
    columns = [formations.c[column] for column in JSON_COLUMNS]

    rows = bind.execute(sa.select(formations.c.id, *columns)).mappings().all()
    for row in rows:
        updates = {
            column: decoded
            for column in JSON_COLUMNS
            if (decoded := _decoded_json_list(row[column])) is not None
        }
        if updates:
            bind.execute(
                sa.update(formations)
                .where(formations.c.id == row["id"])
                .values(**updates)
            )


def downgrade() -> None:
    pass
