from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


MarketingBadge = Literal["premium", "populaire"]
FormationBadge = Literal["premium", "populaire", "promo"]
FormatType = Literal["live", "ligne", "presentiel"]
DashboardType = Literal["classic", "guided"]
UserRole = Literal["admin", "teacher", "student"]
UserStatus = Literal["active", "suspended"]
SessionStatus = Literal["planned", "open", "completed", "cancelled"]
OrderStatus = Literal["pending", "paid", "partially_paid", "failed", "cancelled"]
PaymentStatus = Literal["pending", "confirmed", "failed"]


class FormationCatalogItem(BaseModel):
    id: int
    slug: str
    title: str
    category: str
    level: str
    image: str
    format_type: FormatType
    dashboard_type: DashboardType
    session_label: str
    current_price_amount: int = Field(ge=0)
    current_price_label: str
    original_price_amount: int | None = Field(default=None, ge=0)
    original_price_label: str | None = None
    price_currency: str
    allow_installments: bool
    rating: float = Field(ge=0, le=5)
    reviews: int = Field(ge=0)
    badges: list[FormationBadge] = Field(default_factory=list)

    @field_validator("rating")
    @classmethod
    def validate_rating_step(cls, value: float) -> float:
        scaled = round(value * 2)
        if abs((scaled / 2) - value) > 1e-9:
            raise ValueError("La note doit avancer par pas de 0.5.")
        return value


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
    session_label: str | None = None
    badges: list[MarketingBadge] | None = None

    @field_validator("title", "category", "level", "image", "session_label")
    @classmethod
    def validate_non_empty_string(cls, value: str | None) -> str | None:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Ce champ ne peut pas etre vide.")
        return trimmed

    @field_validator("rating")
    @classmethod
    def validate_rating_step(cls, value: float | None) -> float | None:
        if value is None:
            return value
        scaled = round(value * 2)
        if abs((scaled / 2) - value) > 1e-9:
            raise ValueError("La note doit avancer par pas de 0.5.")
        return value

    @field_validator("badges")
    @classmethod
    def validate_badges(cls, value: list[MarketingBadge] | None) -> list[MarketingBadge] | None:
        if value is None:
            return value
        # Remove duplicates while preserving input order.
        return list(dict.fromkeys(value))


class AdminFormationCreate(AdminFormationBase):
    slug: str = Field(min_length=3, max_length=255)
    title: str
    category: str
    level: str
    image: str
    format_type: FormatType
    current_price_amount: int = Field(ge=0)
    session_label: str
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
            and self.session_label is None
            and self.badges is None
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
    total_confirmed_revenue_amount: int
    total_confirmed_revenue_label: str


class AdminUserItem(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    status: UserStatus
    created_at: datetime


class AdminOnsiteSessionItem(BaseModel):
    id: int
    formation_title: str
    label: str
    start_date: date
    campus_label: str
    seat_capacity: int
    enrolled_count: int
    teacher_name: str
    status: SessionStatus


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
    provider_code: str
    status: PaymentStatus
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


class AdminOnsiteSessionUpdate(BaseModel):
    label: str | None = None
    start_date: date | None = None
    campus_label: str | None = None
    seat_capacity: int | None = Field(default=None, ge=0)
    teacher_name: str | None = None
    status: SessionStatus | None = None

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
        if (
            self.label is None
            and self.start_date is None
            and self.campus_label is None
            and self.seat_capacity is None
            and self.teacher_name is None
            and self.status is None
        ):
            raise ValueError("Au moins un champ session doit etre fourni.")
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
