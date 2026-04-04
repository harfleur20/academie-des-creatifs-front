"""add home featured flags for formations

Revision ID: 20260403_0006
Revises: 20260403_0005
Create Date: 2026-04-03 16:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260403_0006"
down_revision = "20260403_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "formations",
        sa.Column(
            "is_featured_home",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "formations",
        sa.Column(
            "home_feature_rank",
            sa.Integer(),
            nullable=False,
            server_default="100",
        ),
    )

    op.execute(
        sa.text(
            """
            UPDATE formations
            SET is_featured_home = TRUE,
                home_feature_rank = CASE slug
                    WHEN 'motion-design-par-la-pratique' THEN 10
                    WHEN 'deviens-un-brand-designer' THEN 20
                    WHEN 'maitrisez-design-packaging-a-z' THEN 30
                    WHEN 'monetisation-audience-tiktok' THEN 40
                    WHEN 'bootcamp-brand-designer-presentiel' THEN 50
                    ELSE 100
                END
            WHERE slug IN (
                'motion-design-par-la-pratique',
                'deviens-un-brand-designer',
                'maitrisez-design-packaging-a-z',
                'monetisation-audience-tiktok',
                'bootcamp-brand-designer-presentiel'
            )
            """
        )
    )

    op.alter_column("formations", "is_featured_home", server_default=None)
    op.alter_column("formations", "home_feature_rank", server_default=None)


def downgrade() -> None:
    op.drop_column("formations", "home_feature_rank")
    op.drop_column("formations", "is_featured_home")
