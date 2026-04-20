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


class BlogPostRecord(Base):
    __tablename__ = "blog_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    excerpt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cover_image: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    author: Mapped[str] = mapped_column(String(180), nullable=False, default="Francis Kenne")
    category: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_popular: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    published_at: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    rating: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    reviews_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


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
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)


class TeacherProfileRecord(TimestampMixin, Base):
    __tablename__ = "teacher_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    teacher_code: Mapped[str | None] = mapped_column(
        String(20),
        unique=True,
        index=True,
        nullable=True,
    )
    whatsapp: Mapped[str | None] = mapped_column(String(32), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(120), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(180), nullable=True)
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)


class TeacherInvitationRecord(TimestampMixin, Base):
    __tablename__ = "teacher_invitations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(180), index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    whatsapp: Mapped[str | None] = mapped_column(String(32), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(120), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(180), nullable=True)
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FormationTeacherRecord(Base):
    __tablename__ = "formation_teachers"
    __table_args__ = (UniqueConstraint("formation_id", "teacher_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    formation_id: Mapped[int] = mapped_column(
        ForeignKey("formations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )


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
    meeting_link: Mapped[str | None] = mapped_column(String(512), nullable=True)


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
    group_reference: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    formation_id: Mapped[int | None] = mapped_column(
        ForeignKey("formations.id", ondelete="SET NULL"),
        nullable=True,
    )
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("formation_sessions.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    customer_name: Mapped[str] = mapped_column(String(180), nullable=False)
    formation_title: Mapped[str] = mapped_column(String(255), nullable=False)
    format_type: Mapped[str] = mapped_column(String(32), nullable=False)
    dashboard_type: Mapped[str] = mapped_column(String(32), nullable=False)
    total_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False, default="XAF")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    installment_plan: Mapped[str] = mapped_column(String(16), nullable=False, default="full")


class PaymentRecord(TimestampMixin, Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_reference: Mapped[str] = mapped_column(String(64), nullable=False)
    payer_name: Mapped[str] = mapped_column(String(180), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False, default="XAF")
    provider_code: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_payment_id: Mapped[str | None] = mapped_column(String(180), nullable=True)
    provider_checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    installment_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reminder_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_reminded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


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
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("formation_sessions.id", ondelete="SET NULL"),
        nullable=True,
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
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("formation_sessions.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    order_reference: Mapped[str] = mapped_column(String(64), nullable=False)
    format_type: Mapped[str] = mapped_column(String(32), nullable=False)
    dashboard_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")


class AttendanceRecord(TimestampMixin, Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("session_id", "enrollment_id", "course_day_id", name="uq_attendance_course_day"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("formation_sessions.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    course_day_id: Mapped[int | None] = mapped_column(
        ForeignKey("session_course_days.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="present")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class GradeRecord(TimestampMixin, Base):
    __tablename__ = "grade_records"
    __table_args__ = (
        UniqueConstraint("session_id", "enrollment_id", "label", "course_day_id", name="uq_grade_course_day"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("formation_sessions.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    course_day_id: Mapped[int | None] = mapped_column(
        ForeignKey("session_course_days.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    label: Mapped[str] = mapped_column(String(180), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    max_score: Mapped[float] = mapped_column(Float, nullable=False, default=20)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class SiteConfigRecord(Base):
    __tablename__ = "site_config"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")


class LessonCompletionRecord(TimestampMixin, Base):
    __tablename__ = "lesson_completions"
    __table_args__ = (
        UniqueConstraint(
            "enrollment_id", "module_index", "lesson_index",
            name="uq_lesson_completion",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    module_index: Mapped[int] = mapped_column(Integer, nullable=False)
    lesson_index: Mapped[int] = mapped_column(Integer, nullable=False)


class StudentCodeCounterRecord(Base):
    __tablename__ = "student_code_counters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    last_sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class TeacherCodeCounterRecord(Base):
    __tablename__ = "teacher_code_counters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    last_sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class QuizRecord(TimestampMixin, Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("formation_sessions.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    course_day_id: Mapped[int | None] = mapped_column(
        ForeignKey("session_course_days.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    # status: draft | active | closed


class QuizQuestionRecord(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    quiz_id: Mapped[int] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    correct_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class QuizAttemptRecord(TimestampMixin, Base):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        UniqueConstraint("quiz_id", "enrollment_id", "attempt_number", name="uq_quiz_attempt"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    quiz_id: Mapped[int] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    answers: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    score_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ResourceRecord(TimestampMixin, Base):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("formation_sessions.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    course_day_id: Mapped[int | None] = mapped_column(
        ForeignKey("session_course_days.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(16), nullable=False, default="link")
    # resource_type: pdf | link | video
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AssignmentRecord(TimestampMixin, Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("formation_sessions.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    course_day_id: Mapped[int | None] = mapped_column(
        ForeignKey("session_course_days.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    instructions: Mapped[str] = mapped_column(Text, nullable=False, default="")
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_final_project: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class AssignmentSubmissionRecord(TimestampMixin, Base):
    __tablename__ = "assignment_submissions"
    __table_args__ = (
        UniqueConstraint("assignment_id", "enrollment_id", name="uq_assignment_submission"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("assignments.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    file_url: Mapped[str] = mapped_column(String(512), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    review_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_max_score: Mapped[float] = mapped_column(Float, nullable=False, default=20)


class AssignmentCommentRecord(TimestampMixin, Base):
    __tablename__ = "assignment_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("assignments.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    author_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    author_role: Mapped[str] = mapped_column(String(16), nullable=False, default="student")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    attachment_url: Mapped[str | None] = mapped_column(String(512), nullable=True)


# ── Courses / Chapters / Lessons ──────────────────────────────────────────────

class CourseRecord(TimestampMixin, Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("formation_sessions.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")


class ChapterRecord(Base):
    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class LessonRecord(Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapters.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # lesson_type: text | video | pdf | quiz | assignment | resource
    lesson_type: Mapped[str] = mapped_column(String(16), nullable=False, default="text")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    quiz_id: Mapped[int | None] = mapped_column(
        ForeignKey("quizzes.id", ondelete="SET NULL"), nullable=True
    )
    assignment_id: Mapped[int | None] = mapped_column(
        ForeignKey("assignments.id", ondelete="SET NULL"), nullable=True
    )
    resource_id: Mapped[int | None] = mapped_column(
        ForeignKey("resources.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class LessonProgressRecord(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (
        UniqueConstraint("enrollment_id", "lesson_id", name="uq_lesson_progress"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    lesson_id: Mapped[int] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SessionCourseDayRecord(Base):
    __tablename__ = "session_course_days"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("formation_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    live_event_id: Mapped[int | None] = mapped_column(
        ForeignKey("session_live_events.id", ondelete="SET NULL"),
        unique=True,
        index=True,
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="planned", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SessionLiveEventRecord(Base):
    __tablename__ = "session_live_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("formation_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="scheduled", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PasswordResetRecord(Base):
    __tablename__ = "password_resets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
