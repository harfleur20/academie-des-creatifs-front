"""add realtime messaging

Revision ID: 20260424_0043
Revises: 20260420_0042
Create Date: 2026-04-24 00:43:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260424_0043"
down_revision = "20260420_0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("first_login_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("welcome_message_sent_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "message_threads",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("thread_type", sa.String(length=32), nullable=False, server_default="direct"),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "message_thread_participants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role_snapshot", sa.String(length=32), nullable=False),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["thread_id"], ["message_threads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("thread_id", "user_id", name="uq_message_thread_participant"),
    )
    op.create_index(op.f("ix_message_thread_participants_thread_id"), "message_thread_participants", ["thread_id"])
    op.create_index(op.f("ix_message_thread_participants_user_id"), "message_thread_participants", ["user_id"])
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("sender_user_id", sa.Integer(), nullable=True),
        sa.Column("sender_type", sa.String(length=16), nullable=False, server_default="user"),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["thread_id"], ["message_threads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_messages_sender_user_id"), "messages", ["sender_user_id"])
    op.create_index(op.f("ix_messages_thread_id"), "messages", ["thread_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_messages_thread_id"), table_name="messages")
    op.drop_index(op.f("ix_messages_sender_user_id"), table_name="messages")
    op.drop_table("messages")
    op.drop_index(op.f("ix_message_thread_participants_user_id"), table_name="message_thread_participants")
    op.drop_index(op.f("ix_message_thread_participants_thread_id"), table_name="message_thread_participants")
    op.drop_table("message_thread_participants")
    op.drop_table("message_threads")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("welcome_message_sent_at")
        batch_op.drop_column("first_login_at")
