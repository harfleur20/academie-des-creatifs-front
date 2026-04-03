"""add cart, checkout and enrollment tables

Revision ID: 20260403_0003
Revises: 20260403_0002
Create Date: 2026-04-03 01:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260403_0003"
down_revision = "20260403_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("student_code", sa.String(length=16), nullable=True))
        batch_op.create_index(op.f("ix_users_student_code"), ["student_code"], unique=True)

    with op.batch_alter_table("orders") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("formation_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("delivery_mode", sa.String(length=32), nullable=True))
        batch_op.create_foreign_key("fk_orders_user_id", "users", ["user_id"], ["id"], ondelete="SET NULL")
        batch_op.create_foreign_key(
            "fk_orders_formation_id",
            "formations",
            ["formation_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.create_table(
        "cart_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("formation_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["formation_id"], ["formations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cart_items_formation_id"), "cart_items", ["formation_id"], unique=False)
    op.create_index(op.f("ix_cart_items_user_id"), "cart_items", ["user_id"], unique=False)

    op.create_table(
        "enrollments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("formation_id", sa.Integer(), nullable=False),
        sa.Column("order_reference", sa.String(length=64), nullable=False),
        sa.Column("delivery_mode", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["formation_id"], ["formations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_enrollments_formation_id"), "enrollments", ["formation_id"], unique=False)
    op.create_index(op.f("ix_enrollments_user_id"), "enrollments", ["user_id"], unique=False)

    op.create_table(
        "student_code_counters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("last_sequence", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_student_code_counters_year"),
        "student_code_counters",
        ["year"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_student_code_counters_year"), table_name="student_code_counters")
    op.drop_table("student_code_counters")

    op.drop_index(op.f("ix_enrollments_user_id"), table_name="enrollments")
    op.drop_index(op.f("ix_enrollments_formation_id"), table_name="enrollments")
    op.drop_table("enrollments")

    op.drop_index(op.f("ix_cart_items_user_id"), table_name="cart_items")
    op.drop_index(op.f("ix_cart_items_formation_id"), table_name="cart_items")
    op.drop_table("cart_items")

    with op.batch_alter_table("orders") as batch_op:
        batch_op.drop_constraint("fk_orders_formation_id", type_="foreignkey")
        batch_op.drop_constraint("fk_orders_user_id", type_="foreignkey")
        batch_op.drop_column("delivery_mode")
        batch_op.drop_column("formation_id")
        batch_op.drop_column("user_id")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index(op.f("ix_users_student_code"))
        batch_op.drop_column("student_code")
