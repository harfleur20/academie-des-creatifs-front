"""guest role — new registrations default to guest, promote to student on first confirmed payment
Retroactively set role='guest' for students with no confirmed payment.

Revision ID: 20260419_0038
Revises: 20260418_0037
Create Date: 2026-04-19
"""

from alembic import op

revision = "20260419_0038"
down_revision = "20260418_0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Downgrade to 'guest' every user with role='student' who has no confirmed payment.
    op.execute("""
        UPDATE users
        SET role = 'guest'
        WHERE role = 'student'
          AND id NOT IN (
              SELECT DISTINCT o.user_id
              FROM orders o
              JOIN payments p ON p.order_reference = o.reference
              WHERE p.status = 'confirmed'
                AND o.user_id IS NOT NULL
          )
    """)


def downgrade() -> None:
    # Restore all guests back to student (best-effort rollback).
    op.execute("UPDATE users SET role = 'student' WHERE role = 'guest'")
