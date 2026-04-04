from dataclasses import dataclass, field
import os


def _parse_allowed_origins() -> list[str]:
    raw_origins = os.getenv("ALLOWED_ORIGINS")
    if not raw_origins:
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "Academie des Creatifs API"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    environment: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "").strip()
    session_cookie_name: str = os.getenv("SESSION_COOKIE_NAME", "ac_session")
    session_cookie_samesite: str = os.getenv("SESSION_COOKIE_SAMESITE", "lax")
    session_cookie_secure: bool = os.getenv("SESSION_COOKIE_SECURE", "false").lower() in {
        "1",
        "true",
        "yes",
    }
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "academie-des-creatifs-dev-secret")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_access_token_minutes: int = int(os.getenv("JWT_ACCESS_TOKEN_MINUTES", "1440"))
    jwt_access_token_remember_days: int = int(os.getenv("JWT_ACCESS_TOKEN_REMEMBER_DAYS", "30"))
    jwt_issuer: str = os.getenv("JWT_ISSUER", "academie-des-creatifs")
    allowed_origins: list[str] = field(default_factory=_parse_allowed_origins)


settings = Settings()
