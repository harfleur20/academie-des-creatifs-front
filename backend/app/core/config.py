from dataclasses import dataclass, field
from pathlib import Path
import os


def _load_dotenv_file() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue

        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


_load_dotenv_file()


def _dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        normalized = value.strip().rstrip("/")
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return ordered


def _parse_allowed_origins() -> list[str]:
    defaults = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    frontend_url = os.getenv("FRONTEND_URL", "").strip()
    raw_origins = os.getenv("ALLOWED_ORIGINS")
    configured = []
    if raw_origins:
        configured = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

    # In local development, keep the usual frontend ports open even if a custom
    # value was provided, so switching between 3000 and 5173 does not break CORS.
    environment = os.getenv("APP_ENV", "development").strip().lower()
    origins: list[str] = defaults[:] if environment != "production" else []
    if frontend_url:
        origins.append(frontend_url)
    origins.extend(configured)

    if not origins:
        origins = defaults

    return _dedupe_preserve_order(origins)


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
    # Email / SMTP — leave SMTP_HOST empty to disable sending (emails are logged instead)
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from: str = os.getenv("SMTP_FROM", "noreply@academie-creatifs.com")
    smtp_from_name: str = os.getenv("SMTP_FROM_NAME", "Académie des Créatifs")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    backend_public_url: str = os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8000").rstrip("/")
    tara_paymentlinks_url: str = os.getenv(
        "TARA_PAYMENTLINKS_URL",
        "https://www.dklo.co/api/tara/paymentlinks",
    ).strip()
    tara_api_key: str = os.getenv("TARA_API_KEY", "").strip()
    tara_business_id: str = os.getenv("TARA_BUSINESS_ID", "").strip()
    tara_webhook_secret: str = os.getenv("TARA_WEBHOOK_SECRET", "").strip()
    tara_timeout_seconds: int = int(os.getenv("TARA_TIMEOUT_SECONDS", "15"))
    resend_api_key: str = os.getenv("RESEND_API_KEY", "").strip()
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "").strip()
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "").strip()
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "").strip()
    stripe_secret_key: str = os.getenv("STRIPE_SECRET_KEY", "").strip()
    stripe_webhook_secret: str = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()


settings = Settings()
