"""add dismissed_notification_ids to users

Revision ID: 20260425_0045
Revises: 20260424_0044
Create Date: 2026-04-25 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260425_0045"
down_revision = "20260424_0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "dismissed_notification_ids",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "dismissed_notification_ids")
