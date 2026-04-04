from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class FormationRecord(TimestampMixin, Base):
    __tablename__ = "formations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(120), nullable=False)
    level: Mapped[str] = mapped_column(String(120), nullable=False)
    image: Mapped[str] = mapped_column(String(255), nullable=False)
    intro: Mapped[str] = mapped_column(Text, nullable=False, default="")
    mentor_name: Mapped[str] = mapped_column(String(180), nullable=False, default="")
    mentor_label: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    mentor_image: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    included_items: Mapped[list[object]] = mapped_column(JSON, nullable=False, default=list)
    objective_items: Mapped[list[object]] = mapped_column(JSON, nullable=False, default=list)
    project_items: Mapped[list[object]] = mapped_column(JSON, nullable=False, default=list)
    audience_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    certificate_copy: Mapped[str] = mapped_column(Text, nullable=False, default="")
    certificate_image: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    module_items: Mapped[list[object]] = mapped_column(JSON, nullable=False, default=list)
    faq_items: Mapped[list[object]] = mapped_column(JSON, nullable=False, default=list)
    format_type: Mapped[str] = mapped_column(String(32), nullable=False)
    dashboard_type: Mapped[str] = mapped_column(String(32), nullable=False)
    session_label: Mapped[str] = mapped_column(String(255), nullable=False)
    current_price_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    original_price_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_currency: Mapped[str] = mapped_column(String(12), nullable=False, default="XAF")
    allow_installments: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_featured_home: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    home_feature_rank: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    rating: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    reviews: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    badges: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)


class UserRecord(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    student_code: Mapped[str | None] = mapped_column(
        String(16),
        unique=True,
        index=True,
        nullable=True,
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")


class FormationSessionRecord(TimestampMixin, Base):
    __tablename__ = "formation_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    formation_id: Mapped[int] = mapped_column(
        ForeignKey("formations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(180), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    campus_label: Mapped[str | None] = mapped_column(String(180), nullable=True)
    seat_capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    enrolled_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    teacher_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="planned")


class OnsiteSessionRecord(TimestampMixin, Base):
    __tablename__ = "onsite_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    formation_title: Mapped[str] = mapped_column(String(255), nullable=False)
    label: Mapped[str] = mapped_column(String(180), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    campus_label: Mapped[str] = mapped_column(String(180), nullable=False)
    seat_capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    enrolled_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    teacher_name: Mapped[str] = mapped_column(String(180), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="planned")


class OrderRecord(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    formation_id: Mapped[int | None] = mapped_column(
        ForeignKey("formations.id", ondelete="SET NULL"),
        nullable=True,
    )
    customer_name: Mapped[str] = mapped_column(String(180), nullable=False)
    formation_title: Mapped[str] = mapped_column(String(255), nullable=False)
    format_type: Mapped[str] = mapped_column(String(32), nullable=False)
    dashboard_type: Mapped[str] = mapped_column(String(32), nullable=False)
    total_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False, default="XAF")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")


class PaymentRecord(TimestampMixin, Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_reference: Mapped[str] = mapped_column(String(64), nullable=False)
    payer_name: Mapped[str] = mapped_column(String(180), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False, default="XAF")
    provider_code: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuthSessionRecord(TimestampMixin, Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CartItemRecord(TimestampMixin, Base):
    __tablename__ = "cart_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    formation_id: Mapped[int] = mapped_column(
        ForeignKey("formations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )


class FavoriteItemRecord(TimestampMixin, Base):
    __tablename__ = "favorite_items"
    __table_args__ = (UniqueConstraint("user_id", "formation_id", name="uq_favorite_items_user_formation"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    formation_id: Mapped[int] = mapped_column(
        ForeignKey("formations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )


class EnrollmentRecord(TimestampMixin, Base):
    __tablename__ = "enrollments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    formation_id: Mapped[int] = mapped_column(
        ForeignKey("formations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    order_reference: Mapped[str] = mapped_column(String(64), nullable=False)
    format_type: Mapped[str] = mapped_column(String(32), nullable=False)
    dashboard_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")


class StudentCodeCounterRecord(Base):
    __tablename__ = "student_code_counters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    last_sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
