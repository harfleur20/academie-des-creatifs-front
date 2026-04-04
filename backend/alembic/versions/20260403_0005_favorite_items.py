"""add favorite items table

Revision ID: 20260403_0005
Revises: 20260403_0004
Create Date: 2026-04-03 12:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260403_0005"
down_revision = "20260403_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "favorite_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("formation_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["formation_id"], ["formations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "formation_id", name="uq_favorite_items_user_formation"),
    )
    op.create_index(op.f("ix_favorite_items_formation_id"), "favorite_items", ["formation_id"], unique=False)
    op.create_index(op.f("ix_favorite_items_user_id"), "favorite_items", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_favorite_items_user_id"), table_name="favorite_items")
    op.drop_index(op.f("ix_favorite_items_formation_id"), table_name="favorite_items")
    op.drop_table("favorite_items")
