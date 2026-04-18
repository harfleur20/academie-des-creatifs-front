"""seed default mentor (Francis Kenne) on formations with empty mentor_name

Revision ID: 20260417_0020
Revises: 20260413_0019
Create Date: 2026-04-17 00:00:00.000000
"""

from alembic import op

revision = "20260417_0020"
down_revision = "20260413_0019"
branch_labels = None
depends_on = None

DEFAULT_NAME  = "Francis Kenne"
DEFAULT_LABEL = "Responsable académique"
DEFAULT_IMAGE = "/Teams/photo-fk.jpg"


def upgrade() -> None:
    op.execute(
        f"""
        UPDATE formations
        SET
            mentor_name  = '{DEFAULT_NAME}',
            mentor_label = '{DEFAULT_LABEL}',
            mentor_image = '{DEFAULT_IMAGE}'
        WHERE TRIM(mentor_name) = ''
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        UPDATE formations
        SET
            mentor_name  = '',
            mentor_label = '',
            mentor_image = ''
        WHERE mentor_name = '{DEFAULT_NAME}'
          AND mentor_label = '{DEFAULT_LABEL}'
          AND mentor_image = '{DEFAULT_IMAGE}'
        """
    )
