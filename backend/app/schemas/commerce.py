from datetime import date, datetime
from typing import Literal, Annotated

from pydantic import BaseModel, Field, model_validator


FormatType = Literal["live", "ligne", "presentiel"]
DashboardType = Literal["classic", "guided"]
NotificationTone = Literal["info", "success", "warning"]
NotificationCategory = Literal[
    "payment",
    "enrollment",
    "session",
    "assignment",
    "quiz",
    "live",
    "resource",
    "result",
    "admin",
    "system",
]
CheckoutPaymentMode = Literal["full", "installments"]


class CartItemPayload(BaseModel):
    formation_slug: str = Field(min_length=3, max_length=255)


class CartItemView(BaseModel):
    id: int
    formation_id: int
    formation_slug: str
    title: str
    image: str
    format_type: FormatType
    dashboard_type: DashboardType
    session_label: str
    level: str
    mentor_name: str | None = None
    current_price_amount: int
    current_price_label: str
    original_price_label: str | None = None
    allow_installments: bool
    can_purchase: bool = True
    purchase_message: str | None = None


class InstallmentLine(BaseModel):
    number: int
    amount: int
    amount_label: str
    due_date: date
    status: str


class CartSnapshot(BaseModel):
    items: list[CartItemView]
    total_amount: int
    total_amount_label: str
    allow_installments: bool = False
    installment_threshold_amount: int = 100000
    installment_threshold_label: str = "100 000 FCFA"
    installment_schedules_preview: dict[str, list[InstallmentLine]] = Field(default_factory=dict)
    live_items_count: int
    ligne_items_count: int
    presentiel_items_count: int
    classic_items_count: int
    guided_items_count: int


class FavoriteItemView(BaseModel):
    id: int
    formation_id: int
    formation_slug: str
    title: str
    image: str
    format_type: FormatType
    dashboard_type: DashboardType
    session_label: str
    level: str
    current_price_amount: int
    current_price_label: str
    original_price_label: str | None = None
    allow_installments: bool
    rating: float
    reviews: int
    badges: list[str]


class FavoriteSnapshot(BaseModel):
    items: list[FavoriteItemView]
    total_count: int


class CheckoutPayload(BaseModel):
    installment_slugs: list[str] = Field(default_factory=list)
    use_installments: bool = False
    payment_mode: CheckoutPaymentMode | None = None
    payment_provider: str | None = None


class PaymentCheckoutPayload(BaseModel):
    payment_provider: str | None = None


class TaraPaymentLinksView(BaseModel):
    whatsapp_link: str | None = None
    telegram_link: str | None = None
    dikalo_link: str | None = None
    sms_link: str | None = None


class CheckoutResponse(BaseModel):
    message: str
    redirect_path: str
    external_redirect_url: str | None = None
    payment_provider: str | None = None
    processed_items: int
    order_references: list[str]
    installment_schedules: dict[str, list[InstallmentLine]] = Field(default_factory=dict)
    payment_links: TaraPaymentLinksView | None = None


class AssignedTeacherView(BaseModel):
    full_name: str
    teacher_code: str | None = None
    avatar_initials: str
    avatar_url: str | None = None
    email: str | None = None
    whatsapp: str | None = None


class EnrollmentView(BaseModel):
    id: int
    formation_id: int
    session_id: int | None = None
    formation_slug: str
    formation_title: str
    image: str
    format_type: FormatType
    dashboard_type: DashboardType
    order_reference: str
    status: str
    student_code: str | None = None
    session_label: str
    assigned_teacher: AssignedTeacherView | None = None
    created_at: datetime


class StudentDashboardSummary(BaseModel):
    student_code: str | None = None
    live_enrollments_count: int
    ligne_enrollments_count: int
    presentiel_enrollments_count: int
    classic_enrollments_count: int
    guided_enrollments_count: int
    classic_enrollments: list[EnrollmentView]
    guided_enrollments: list[EnrollmentView]


class LessonKey(BaseModel):
    module_index: int
    lesson_index: int


class EnrollmentProgress(BaseModel):
    enrollment_id: int
    completed: list[LessonKey]
    total_lessons: int
    completed_count: int
    progress_pct: int


class StudentSessionView(BaseModel):
    id: int
    formation_id: int
    formation_title: str
    formation_slug: str
    format_type: FormatType
    label: str
    start_date: date
    end_date: date
    teacher_name: str | None = None
    assigned_teacher: AssignedTeacherView | None = None
    campus_label: str | None = None
    meeting_link: str | None = None
    status: str


class StudentClassmateView(BaseModel):
    user_id: int
    enrollment_id: int
    full_name: str
    avatar_url: str | None = None
    student_code: str | None = None
    badge_level: str
    badge_label: str
    badge_image_url: str
    badge_ring_pct: float = 0.0
    is_current_user: bool = False


class StudentClassView(BaseModel):
    session_id: int
    formation_id: int
    formation_title: str
    formation_slug: str
    format_type: FormatType
    session_label: str
    start_date: date
    end_date: date
    status: str
    teacher_name: str | None = None
    campus_label: str | None = None
    classmates: list[StudentClassmateView] = Field(default_factory=list)


class StudentCourseDayView(BaseModel):
    id: int
    session_id: int
    live_event_id: int | None = None
    title: str
    scheduled_at: datetime
    duration_minutes: int
    status: str
    attendance_count: int = 0
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    excused_count: int = 0
    quiz_count: int = 0
    assignment_count: int = 0
    resource_count: int = 0
    grade_count: int = 0
    created_at: datetime


class NotificationView(BaseModel):
    id: str
    title: str
    message: str
    tone: NotificationTone
    category: NotificationCategory
    created_at: datetime
    action_label: str | None = None
    action_path: str | None = None


class CertificateView(BaseModel):
    enrollment_id: int
    certificate_number: str
    student_name: str
    formation_title: str
    format_type: str
    dashboard_type: str
    mentor_name: str
    level: str
    session_label: str
    issued_date: str


# ── Student quiz schemas ───────────────────────────────────────────────────────

class StudentQuizQuestionView(BaseModel):
    id: int
    order_index: int
    text: str
    options: list[str]
    # correct_index intentionally omitted — only sent after attempt


class StudentQuizAttemptView(BaseModel):
    attempt_number: int
    score_pct: float
    submitted_at: datetime
    correct_answers: list[int]   # correct_index per question, revealed after attempt


AttemptStatus = Literal["not_started", "passed", "failed_retry_now", "failed_retry_after", "failed_no_retry"]


class StudentQuizView(BaseModel):
    id: int
    session_id: int
    session_label: str
    formation_title: str
    title: str
    scheduled_at: datetime | None
    duration_minutes: int | None
    status: str                          # draft | active | closed
    attempt_status: AttemptStatus
    next_attempt_available_at: datetime | None   # set when retry is blocked 8h
    best_score_pct: float | None
    attempts: list[StudentQuizAttemptView]
    questions: list[StudentQuizQuestionView]     # empty until quiz is active


class QuizAnswerPayload(BaseModel):
    answers: list[int] = Field(min_length=1)   # one chosen index per question


# ── Student resource schemas ───────────────────────────────────────────────────

class StudentResourceView(BaseModel):
    id: int
    session_id: int
    session_label: str
    formation_title: str
    title: str
    resource_type: str
    url: str
    published_at: datetime | None
    created_at: datetime


# ── Student assignment schemas ─────────────────────────────────────────────────

AssignmentStudentStatus = Literal["pending", "submitted", "late", "reviewed"]
AssignmentCommentAuthorRole = Literal["student", "teacher"]


class StudentAssignmentView(BaseModel):
    id: int
    session_id: int
    session_label: str
    formation_title: str
    title: str
    instructions: str
    due_date: datetime
    is_final_project: bool = False
    student_status: AssignmentStudentStatus
    submitted_at: datetime | None
    file_url: str | None
    is_reviewed: bool
    review_score: float | None = None
    review_max_score: float = 20
    comment_count: int = 0


class AssignmentSubmitPayload(BaseModel):
    file_url: str = Field(min_length=1, max_length=512)


class AssignmentCommentView(BaseModel):
    id: int
    assignment_id: int
    enrollment_id: int
    author_role: AssignmentCommentAuthorRole
    author_name: str
    author_avatar_url: str | None = None
    body: str
    attachment_url: str | None = None
    created_at: datetime


class AssignmentCommentCreate(BaseModel):
    body: str | None = Field(default=None, max_length=2000)
    attachment_url: str | None = Field(default=None, max_length=512)

    @model_validator(mode="after")
    def ensure_message_or_attachment(self) -> "AssignmentCommentCreate":
        body = (self.body or "").strip()
        attachment_url = (self.attachment_url or "").strip()
        if not body and not attachment_url:
            raise ValueError("Ajoutez un message ou une pièce jointe.")
        self.body = body or None
        self.attachment_url = attachment_url or None
        return self


# ── Student course schemas ─────────────────────────────────────────────────────

class StudentLessonView(BaseModel):
    id: int
    chapter_id: int
    title: str
    lesson_type: str   # text | video | pdf | quiz | assignment | resource
    order_index: int
    content: str | None
    video_url: str | None
    file_url: str | None
    quiz_id: int | None
    assignment_id: int | None
    resource_id: int | None
    quiz_title: str | None = None
    assignment_title: str | None = None
    resource_title: str | None = None
    is_completed: bool = False


class StudentChapterView(BaseModel):
    id: int
    title: str
    order_index: int
    lessons: list[StudentLessonView] = []


class StudentCourseView(BaseModel):
    id: int
    session_id: int
    formation_id: int
    formation_title: str
    formation_slug: str
    session_label: str
    title: str
    description: str
    chapters: list[StudentChapterView] = []
    total_lessons: int
    completed_lessons: int
    progress_pct: float
    # Badge progression
    badge_level: str | None = None          # aventurier | debutant | intermediaire | semi_pro | professionnel
    badge_ring_pct: float = 0.0             # 0-100, drives SVG ring animation
    badge_hint: str | None = None           # "Plus que X% pour atteindre Intermédiaire"
    final_project_validated: bool = False


# ── Student payment schemas ────────────────────────────────────────────────────

class StudentPaymentLineView(BaseModel):
    id: int
    installment_number: int | None
    amount: int
    amount_label: str
    currency: str
    provider_code: str
    status: str
    due_date: date | None
    paid_at: datetime | None
    due_label: str | None
    can_pay: bool = False
    checkout_url: str | None = None


class StudentOrderView(BaseModel):
    reference: str
    session_id: int | None = None
    formation_title: str
    format_type: str
    total_amount: int
    total_amount_label: str
    currency: str
    status: str
    installment_plan: str
    created_at: datetime
    payments: list[StudentPaymentLineView]


class GroupedInstallmentView(BaseModel):
    installment_number: int | None
    checkout_key: str
    amount: int
    amount_label: str
    due_date: date | None
    status: str
    can_pay: bool
    payment_ids: list[int]


class StudentOrderSummary(BaseModel):
    reference: str
    formation_title: str
    format_type: str
    total_amount: int
    total_amount_label: str
    status: str


class StudentOrderGroupView(BaseModel):
    group_reference: str
    created_at: datetime
    orders: list[StudentOrderSummary]
    total_amount: int
    total_amount_label: str
    installment_plan: str
    status: str
    grouped_payments: list[GroupedInstallmentView]
    payments: list[StudentPaymentLineView] = Field(default_factory=list)
