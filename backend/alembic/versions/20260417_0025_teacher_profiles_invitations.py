"""add teacher_profiles, teacher_invitations, formation_teachers

Revision ID: 20260417_0025
Revises: 20260417_0024
Create Date: 2026-04-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260417_0025"
down_revision = "20260417_0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "teacher_profiles",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False),
        sa.Column("whatsapp", sa.String(32), nullable=True),
        sa.Column("subject", sa.String(180), nullable=True),
        sa.Column("experience_years", sa.Integer, nullable=True),
        sa.Column("portfolio_url", sa.String(512), nullable=True),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        "teacher_invitations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("token", sa.String(64), unique=True, index=True, nullable=False),
        sa.Column("email", sa.String(180), index=True, nullable=False),
        sa.Column("full_name", sa.String(180), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        "formation_teachers",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("formation_id", sa.Integer, sa.ForeignKey("formations.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("teacher_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.UniqueConstraint("formation_id", "teacher_id"),
    )


def downgrade() -> None:
    op.drop_table("formation_teachers")
    op.drop_table("teacher_invitations")
    op.drop_table("teacher_profiles")
