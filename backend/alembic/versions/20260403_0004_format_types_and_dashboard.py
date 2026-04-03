"""refactor formations to live ligne presentiel with dashboard types

Revision ID: 20260403_0004
Revises: 20260403_0003
Create Date: 2026-04-03 05:45:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260403_0004"
down_revision = "20260403_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("formations") as batch_op:
        batch_op.alter_column(
            "delivery_mode",
            new_column_name="format_type",
            existing_type=sa.String(length=32),
        )
        batch_op.add_column(sa.Column("dashboard_type", sa.String(length=32), nullable=True))

    with op.batch_alter_table("orders") as batch_op:
        batch_op.alter_column(
            "delivery_mode",
            new_column_name="format_type",
            existing_type=sa.String(length=32),
        )
        batch_op.add_column(sa.Column("dashboard_type", sa.String(length=32), nullable=True))

    with op.batch_alter_table("enrollments") as batch_op:
        batch_op.alter_column(
            "delivery_mode",
            new_column_name="format_type",
            existing_type=sa.String(length=32),
        )
        batch_op.add_column(sa.Column("dashboard_type", sa.String(length=32), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE formations
            SET format_type = CASE
                WHEN format_type = 'onsite' THEN 'presentiel'
                ELSE 'live'
            END
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE formations
            SET format_type = 'ligne'
            WHERE slug IN ('maitrisez-design-packaging-a-z', 'monetisation-audience-tiktok')
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE formations
            SET dashboard_type = CASE
                WHEN format_type = 'ligne' THEN 'classic'
                ELSE 'guided'
            END
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE formations
            SET allow_installments = CASE
                WHEN format_type = 'presentiel' AND current_price_amount > 90000 THEN TRUE
                ELSE FALSE
            END
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE orders
            SET format_type = CASE
                WHEN format_type = 'onsite' THEN 'presentiel'
                WHEN format_type = 'online' THEN 'live'
                WHEN format_type IS NULL THEN 'live'
                ELSE format_type
            END
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE orders
            SET format_type = (
                SELECT formations.format_type
                FROM formations
                WHERE formations.id = orders.formation_id
            )
            WHERE formation_id IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE orders
            SET dashboard_type = CASE
                WHEN format_type = 'ligne' THEN 'classic'
                ELSE 'guided'
            END
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE enrollments
            SET format_type = CASE
                WHEN format_type = 'onsite' THEN 'presentiel'
                ELSE 'live'
            END
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE enrollments
            SET format_type = (
                SELECT formations.format_type
                FROM formations
                WHERE formations.id = enrollments.formation_id
            )
            WHERE formation_id IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE enrollments
            SET dashboard_type = CASE
                WHEN format_type = 'ligne' THEN 'classic'
                ELSE 'guided'
            END
            """
        )
    )

    with op.batch_alter_table("formations") as batch_op:
        batch_op.alter_column("dashboard_type", existing_type=sa.String(length=32), nullable=False)

    with op.batch_alter_table("orders") as batch_op:
        batch_op.alter_column("format_type", existing_type=sa.String(length=32), nullable=False)
        batch_op.alter_column("dashboard_type", existing_type=sa.String(length=32), nullable=False)

    with op.batch_alter_table("enrollments") as batch_op:
        batch_op.alter_column("format_type", existing_type=sa.String(length=32), nullable=False)
        batch_op.alter_column("dashboard_type", existing_type=sa.String(length=32), nullable=False)


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE formations
            SET format_type = CASE
                WHEN format_type = 'presentiel' THEN 'onsite'
                ELSE 'online'
            END
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE orders
            SET format_type = CASE
                WHEN format_type = 'presentiel' THEN 'onsite'
                ELSE 'online'
            END
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE enrollments
            SET format_type = CASE
                WHEN format_type = 'presentiel' THEN 'onsite'
                ELSE 'online'
            END
            """
        )
    )

    with op.batch_alter_table("enrollments") as batch_op:
        batch_op.drop_column("dashboard_type")
        batch_op.alter_column(
            "format_type",
            new_column_name="delivery_mode",
            existing_type=sa.String(length=32),
        )

    with op.batch_alter_table("orders") as batch_op:
        batch_op.drop_column("dashboard_type")
        batch_op.alter_column(
            "format_type",
            new_column_name="delivery_mode",
            existing_type=sa.String(length=32),
        )

    with op.batch_alter_table("formations") as batch_op:
        batch_op.drop_column("dashboard_type")
        batch_op.alter_column(
            "format_type",
            new_column_name="delivery_mode",
            existing_type=sa.String(length=32),
        )
