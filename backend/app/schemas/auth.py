from typing import Literal

from pydantic import BaseModel, Field, field_validator


UserRole = Literal["admin", "teacher", "student"]


class RegisterPayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=180)
    email: str = Field(min_length=5, max_length=180)
    phone: str = Field(min_length=8, max_length=32)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("full_name", "email", "phone")
    @classmethod
    def strip_values(cls, value: str) -> str:
        return value.strip()

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.lower()
        if "@" not in normalized or "." not in normalized.split("@")[-1]:
            raise ValueError("Adresse e-mail invalide.")
        return normalized

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        if not value.startswith("+"):
            raise ValueError("Le numero doit inclure l'indicatif international.")
        return value


class LoginPayload(BaseModel):
    email: str = Field(min_length=5, max_length=180)
    password: str = Field(min_length=8, max_length=72)
    remember_me: bool = False

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class AuthUser(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None
    role: UserRole
    status: str
    avatar_initials: str
    dashboard_path: str


class AuthResponse(BaseModel):
    message: str
    user: AuthUser
