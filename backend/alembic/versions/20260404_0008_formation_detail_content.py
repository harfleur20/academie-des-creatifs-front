"""add formation detail content fields

Revision ID: 20260404_0008
Revises: 20260404_0007
Create Date: 2026-04-04 18:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260404_0008"
down_revision = "20260404_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("formations") as batch_op:
        batch_op.add_column(
            sa.Column("intro", sa.Text(), nullable=False, server_default=sa.text("''"))
        )
        batch_op.add_column(
            sa.Column("mentor_name", sa.String(length=180), nullable=False, server_default=sa.text("''"))
        )
        batch_op.add_column(
            sa.Column("mentor_label", sa.String(length=255), nullable=False, server_default=sa.text("''"))
        )
        batch_op.add_column(
            sa.Column("mentor_image", sa.String(length=255), nullable=False, server_default=sa.text("''"))
        )
        batch_op.add_column(
            sa.Column("included_items", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )
        batch_op.add_column(
            sa.Column("objective_items", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )
        batch_op.add_column(
            sa.Column("project_items", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )
        batch_op.add_column(
            sa.Column("audience_text", sa.Text(), nullable=False, server_default=sa.text("''"))
        )
        batch_op.add_column(
            sa.Column("certificate_copy", sa.Text(), nullable=False, server_default=sa.text("''"))
        )
        batch_op.add_column(
            sa.Column("certificate_image", sa.String(length=255), nullable=False, server_default=sa.text("''"))
        )
        batch_op.add_column(
            sa.Column("module_items", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )
        batch_op.add_column(
            sa.Column("faq_items", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )

    with op.batch_alter_table("formations") as batch_op:
        batch_op.alter_column("intro", server_default=None)
        batch_op.alter_column("mentor_name", server_default=None)
        batch_op.alter_column("mentor_label", server_default=None)
        batch_op.alter_column("mentor_image", server_default=None)
        batch_op.alter_column("included_items", server_default=None)
        batch_op.alter_column("objective_items", server_default=None)
        batch_op.alter_column("project_items", server_default=None)
        batch_op.alter_column("audience_text", server_default=None)
        batch_op.alter_column("certificate_copy", server_default=None)
        batch_op.alter_column("certificate_image", server_default=None)
        batch_op.alter_column("module_items", server_default=None)
        batch_op.alter_column("faq_items", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("formations") as batch_op:
        batch_op.drop_column("faq_items")
        batch_op.drop_column("module_items")
        batch_op.drop_column("certificate_image")
        batch_op.drop_column("certificate_copy")
        batch_op.drop_column("audience_text")
        batch_op.drop_column("project_items")
        batch_op.drop_column("objective_items")
        batch_op.drop_column("included_items")
        batch_op.drop_column("mentor_image")
        batch_op.drop_column("mentor_label")
        batch_op.drop_column("mentor_name")
        batch_op.drop_column("intro")
