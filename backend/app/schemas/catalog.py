from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


MarketingBadge = Literal["premium", "populaire"]
FormationBadge = Literal["premium", "populaire", "promo"]
FormatType = Literal["live", "ligne", "presentiel"]
DashboardType = Literal["classic", "guided"]
UserRole = Literal["admin", "teacher", "student", "guest"]
UserStatus = Literal["active", "suspended"]
EnrollmentStatus = Literal["pending", "active", "suspended", "completed", "cancelled"]
SessionStatus = Literal["planned", "open", "completed", "cancelled"]
SessionState = Literal[
    "not_applicable",
    "unscheduled",
    "upcoming",
    "started_open",
    "started_closed",
    "ended",
]
OrderStatus = Literal["pending", "paid", "partially_paid", "failed", "cancelled"]
PaymentStatus = Literal["pending", "confirmed", "late", "failed", "cancelled"]


class FormationProjectItem(BaseModel):
    title: str
    image: str
    kind: Literal["image", "video"] = "image"
    poster: str | None = None

    @field_validator("title", "image", "poster")
    @classmethod
    def validate_project_strings(cls, value: str | None) -> str | None:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Ce champ ne peut pas etre vide.")
        return trimmed


class FormationModuleItem(BaseModel):
    title: str
    summary: str = ""
    duration: str = ""
    lessons: list[str] = Field(default_factory=list)

    @field_validator("title", "summary", "duration")
    @classmethod
    def validate_module_strings(cls, value: str) -> str:
        return value.strip()

    @field_validator("lessons")
    @classmethod
    def validate_lessons(cls, value: list[str]) -> list[str]:
        return [lesson.strip() for lesson in value if lesson.strip()]


class FormationFaqItem(BaseModel):
    question: str
    answer: str

    @field_validator("question", "answer")
    @classmethod
    def validate_faq_strings(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Ce champ ne peut pas etre vide.")
        return trimmed


class FormationDetailContent(BaseModel):
    intro: str = ""
    mentor_name: str = ""
    mentor_label: str = ""
    mentor_image: str = ""
    included: list[str] = Field(default_factory=list)
    objectives: list[str] = Field(default_factory=list)
    projects: list[FormationProjectItem] = Field(default_factory=list)
    audience_text: str = ""
    certificate_copy: str = ""
    certificate_image: str = ""
    modules: list[FormationModuleItem] = Field(default_factory=list)
    faqs: list[FormationFaqItem] = Field(default_factory=list)

    @field_validator(
        "intro",
        "mentor_name",
        "mentor_label",
        "mentor_image",
        "audience_text",
        "certificate_copy",
        "certificate_image",
    )
    @classmethod
    def validate_detail_strings(cls, value: str) -> str:
        return value.strip()

    @field_validator("included", "objectives")
    @classmethod
    def validate_string_lists(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item.strip()]


class FormationCatalogItem(BaseModel):
    id: int
    slug: str
    title: str
    category: str
    level: str
    image: str
    format_type: FormatType
    dashboard_type: DashboardType
    session_state: SessionState
    session_label: str | None = None
    card_session_label: str | None = None
    purchase_message: str | None = None
    can_purchase: bool
    session_start_date: date | None = None
    session_end_date: date | None = None
    late_enrollment_until: date | None = None
    current_price_amount: int = Field(ge=0)
    current_price_label: str
    original_price_amount: int | None = Field(default=None, ge=0)
    original_price_label: str | None = None
    price_currency: str
    allow_installments: bool
    is_featured_home: bool
    home_feature_rank: int = Field(ge=0)
    rating: float = Field(ge=0, le=5)
    reviews: int = Field(ge=0)
    badges: list[FormationBadge] = Field(default_factory=list)



class FormationDetailItem(FormationCatalogItem, FormationDetailContent):
    pass


class AdminFormationItem(FormationDetailItem):
    pass


class AdminFormationBase(BaseModel):
    title: str | None = None
    category: str | None = None
    level: str | None = None
    image: str | None = None
    format_type: FormatType | None = None
    rating: float | None = Field(default=None, ge=0, le=5)
    reviews: int | None = Field(default=None, ge=0)
    current_price_amount: int | None = Field(default=None, ge=0)
    original_price_amount: int | None = Field(default=None, ge=0)
    is_featured_home: bool | None = None
    home_feature_rank: int | None = Field(default=None, ge=0)
    badges: list[MarketingBadge] | None = None
    intro: str | None = None
    mentor_name: str | None = None
    mentor_label: str | None = None
    mentor_image: str | None = None
    included: list[str] | None = None
    objectives: list[str] | None = None
    projects: list[FormationProjectItem] | None = None
    audience_text: str | None = None
    modules: list[FormationModuleItem] | None = None
    faqs: list[FormationFaqItem] | None = None

    @field_validator(
        "title",
        "category",
        "level",
        "image",
        "intro",
        "mentor_name",
        "mentor_label",
        "mentor_image",
        "audience_text",
    )
    @classmethod
    def validate_non_empty_string(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return value.strip()

    @field_validator("rating")
    @classmethod
    def validate_rating_step(cls, value: float | None) -> float | None:
        return value

    @field_validator("badges")
    @classmethod
    def validate_badges(cls, value: list[MarketingBadge] | None) -> list[MarketingBadge] | None:
        if value is None:
            return value
        # Remove duplicates while preserving input order.
        return list(dict.fromkeys(value))

    @field_validator("included", "objectives")
    @classmethod
    def validate_optional_string_lists(
        cls, value: list[str] | None
    ) -> list[str] | None:
        if value is None:
            return value
        return [item.strip() for item in value if item.strip()]


class AdminFormationCreate(AdminFormationBase):
    slug: str = Field(min_length=3, max_length=255)
    title: str
    category: str
    level: str
    image: str
    format_type: FormatType
    current_price_amount: int = Field(ge=0)
    is_featured_home: bool = False
    home_feature_rank: int = Field(default=100, ge=0)
    rating: float = Field(default=0, ge=0, le=5)
    reviews: int = Field(default=0, ge=0)
    badges: list[MarketingBadge] = Field(default_factory=list)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        trimmed = value.strip().lower()
        if not trimmed:
            raise ValueError("Le slug ne peut pas etre vide.")
        return trimmed

    @model_validator(mode="after")
    def validate_prices(self) -> "AdminFormationCreate":
        if (
            self.original_price_amount is not None
            and self.original_price_amount < self.current_price_amount
        ):
            raise ValueError("Le prix barre ne peut pas etre inferieur au prix actuel.")
        return self


class AdminFormationUpdate(AdminFormationBase):
    @model_validator(mode="after")
    def validate_non_empty_payload(self) -> "AdminFormationUpdate":
        if (
            self.title is None
            and self.category is None
            and self.level is None
            and self.image is None
            and self.format_type is None
            and self.rating is None
            and self.reviews is None
            and self.current_price_amount is None
            and self.original_price_amount is None
            and self.is_featured_home is None
            and self.home_feature_rank is None
            and self.badges is None
            and self.intro is None
            and self.mentor_name is None
            and self.mentor_label is None
            and self.mentor_image is None
            and self.included is None
            and self.objectives is None
            and self.projects is None
            and self.audience_text is None
            and self.modules is None
            and self.faqs is None
        ):
            raise ValueError("Au moins un champ admin doit etre fourni.")
        return self


class AdminDashboardOverview(BaseModel):
    formations_count: int
    live_formations_count: int
    ligne_formations_count: int
    presentiel_formations_count: int
    presentiel_sessions_count: int
    users_count: int
    paid_orders_count: int
    pending_orders_count: int
    confirmed_payments_count: int
    pending_payments_count: int
    late_payments_count: int
    total_confirmed_revenue_amount: int
    total_confirmed_revenue_label: str
    missed_course_days_count: int = 0


class AdminMissedCourseDay(BaseModel):
    id: int
    session_id: int
    session_label: str
    formation_title: str
    teacher_name: str
    title: str
    scheduled_at: datetime
    duration_minutes: int
    status: str


class AdminCourseDayStatusUpdate(BaseModel):
    status: Literal["planned", "done", "cancelled", "live"]


class AdminUploadedAsset(BaseModel):
    filename: str
    path: str
    public_url: str
    content_type: str
    size: int = Field(ge=0)


class AdminUserItem(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None = None
    role: UserRole
    status: UserStatus
    student_code: str | None = None
    enrollments_count: int = 0
    created_at: datetime


class AdminEnrollmentItem(BaseModel):
    id: int
    user_id: int
    student_name: str
    student_email: str
    student_phone: str | None = None
    student_code: str | None = None
    user_status: UserStatus
    formation_id: int
    formation_slug: str
    formation_title: str
    format_type: FormatType
    dashboard_type: DashboardType
    order_reference: str
    order_status: OrderStatus | None = None
    payments_count: int = 0
    confirmed_payments_count: int = 0
    pending_payments_count: int = 0
    late_payments_count: int = 0
    failed_payments_count: int = 0
    cancelled_payments_count: int = 0
    session_id: int | None = None
    session_label: str | None = None
    session_start_date: date | None = None
    session_end_date: date | None = None
    campus_label: str | None = None
    teacher_name: str | None = None
    status: EnrollmentStatus
    created_at: datetime


class AdminOnsiteSessionItem(BaseModel):
    id: int
    formation_id: int
    formation_slug: str
    formation_title: str
    format_type: FormatType
    label: str
    start_date: date
    end_date: date
    campus_label: str
    seat_capacity: int
    enrolled_count: int
    teacher_name: str
    status: SessionStatus
    session_state: SessionState
    can_purchase: bool
    session_label: str | None = None
    meeting_link: str | None = None


class AdminFormationSessionCreate(BaseModel):
    formation_id: int = Field(gt=0)
    label: str
    start_date: date
    end_date: date
    campus_label: str | None = None
    seat_capacity: int = Field(default=0, ge=0)
    teacher_name: str | None = None
    status: SessionStatus = "planned"
    meeting_link: str | None = None

    @field_validator("label", "campus_label", "teacher_name")
    @classmethod
    def validate_session_create_strings(cls, value: str | None) -> str | None:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Ce champ ne peut pas etre vide.")
        return trimmed

    @model_validator(mode="after")
    def validate_dates(self) -> "AdminFormationSessionCreate":
        if self.end_date < self.start_date:
            raise ValueError("La date de fin doit etre posterieure ou egale a la date de debut.")
        return self


class AdminOrderItem(BaseModel):
    id: int
    reference: str
    customer_name: str
    formation_title: str
    total_amount: int
    total_amount_label: str
    currency: str
    status: OrderStatus
    created_at: datetime


class AdminPaymentItem(BaseModel):
    id: int
    order_reference: str
    payer_name: str
    amount: int
    amount_label: str
    currency: str
    order_status: OrderStatus | None = None
    installment_plan: str | None = None
    installment_number: int | None = None
    due_date: date | None = None
    provider_code: str
    provider_payment_id: str | None = None
    provider_checkout_url: str | None = None
    status: PaymentStatus
    reminder_count: int = 0
    last_reminded_at: datetime | None = None
    can_send_reminder: bool = False
    paid_at: datetime | None
    created_at: datetime


class AdminUserUpdate(BaseModel):
    role: UserRole | None = None
    status: UserStatus | None = None

    @model_validator(mode="after")
    def validate_non_empty_payload(self) -> "AdminUserUpdate":
        if self.role is None and self.status is None:
            raise ValueError("Au moins un champ utilisateur doit etre fourni.")
        return self


class AdminEnrollmentUpdate(BaseModel):
    status: EnrollmentStatus | None = None
    session_id: int | None = None

    @model_validator(mode="after")
    def validate_non_empty_payload(self) -> "AdminEnrollmentUpdate":
        if self.status is None and "session_id" not in self.model_fields_set:
            raise ValueError("Au moins un champ inscription doit etre fourni.")
        return self


class AdminOnsiteSessionUpdate(BaseModel):
    label: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    campus_label: str | None = None
    seat_capacity: int | None = Field(default=None, ge=0)
    teacher_name: str | None = None
    status: SessionStatus | None = None
    meeting_link: str | None = None

    @field_validator("label", "campus_label", "teacher_name")
    @classmethod
    def validate_session_strings(cls, value: str | None) -> str | None:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Ce champ ne peut pas etre vide.")
        return trimmed

    @model_validator(mode="after")
    def validate_non_empty_payload(self) -> "AdminOnsiteSessionUpdate":
        if not self.model_fields_set:
            raise ValueError("Au moins un champ session doit etre fourni.")
        return self

    @model_validator(mode="after")
    def validate_dates(self) -> "AdminOnsiteSessionUpdate":
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("La date de fin doit etre posterieure ou egale a la date de debut.")
        return self


class AdminOrderUpdate(BaseModel):
    status: OrderStatus


class AdminPaymentUpdate(BaseModel):
    provider_code: str | None = None
    status: PaymentStatus | None = None

    @field_validator("provider_code")
    @classmethod
    def validate_provider_code(cls, value: str | None) -> str | None:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Le prestataire ne peut pas etre vide.")
        return trimmed

    @model_validator(mode="after")
    def validate_non_empty_payload(self) -> "AdminPaymentUpdate":
        if self.provider_code is None and self.status is None:
            raise ValueError("Au moins un champ paiement doit etre fourni.")
        return self
