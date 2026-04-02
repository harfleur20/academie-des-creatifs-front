from dataclasses import dataclass, field
import os


@dataclass(frozen=True)
class Settings:
    app_name: str = "Académie des Créatifs API"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    environment: str = os.getenv("APP_ENV", "development")
    allowed_origins: list[str] = field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )


settings = Settings()
