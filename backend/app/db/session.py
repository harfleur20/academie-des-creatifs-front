from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
import app.models  # noqa: F401


def _database_url() -> str:
    if not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL manquant. Configure PostgreSQL avant de lancer l'API ou les migrations."
        )
    return settings.database_url


def _engine_options() -> dict[str, object]:
    database_url = _database_url()
    if database_url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}
    return {
        "connect_args": {"connect_timeout": 5},
        "pool_pre_ping": True,
    }


engine: Engine = create_engine(
    _database_url(),
    future=True,
    **_engine_options(),
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def database_has_schema() -> bool:
    inspector = inspect(engine)
    return inspector.has_table("formations") and inspector.has_table("users")


def verify_database_connection() -> None:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - depends on local infra
        raise RuntimeError(
            "Connexion a la base impossible. Verifie PostgreSQL, DATABASE_URL et le mot de passe."
        ) from exc
