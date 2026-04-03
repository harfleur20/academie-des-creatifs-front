from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


FormatType = Literal["live", "ligne", "presentiel"]
DashboardType = Literal["classic", "guided"]


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
    current_price_amount: int
    current_price_label: str
    original_price_label: str | None = None
    allow_installments: bool


class CartSnapshot(BaseModel):
    items: list[CartItemView]
    total_amount: int
    total_amount_label: str
    live_items_count: int
    ligne_items_count: int
    presentiel_items_count: int
    classic_items_count: int
    guided_items_count: int


class CheckoutResponse(BaseModel):
    message: str
    redirect_path: str
    processed_items: int
    order_references: list[str]


class EnrollmentView(BaseModel):
    id: int
    formation_id: int
    formation_slug: str
    formation_title: str
    image: str
    format_type: FormatType
    dashboard_type: DashboardType
    order_reference: str
    status: str
    student_code: str | None = None
    session_label: str
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
