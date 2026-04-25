from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.api.routes.certificates import public_router as public_certificates_router
from app.core.config import settings
from app.db.seed import seed_database
from app.db.session import SessionLocal, database_has_schema, verify_database_connection


def create_app() -> FastAPI:
    uploads_root = Path(__file__).resolve().parent.parent / "uploads"
    uploads_root.mkdir(parents=True, exist_ok=True)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "API socle pour la plateforme hybride Academie des Creatifs : "
            "catalogue, dashboards, paiements et gestion pedagogique."
        ),
    )

    @app.on_event("startup")
    def startup_event() -> None:
        verify_database_connection()

        if not database_has_schema():
            return

        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", tags=["meta"])
    def read_root() -> dict[str, str]:
        return {
            "message": "Bienvenue sur l'API de l'Academie des Creatifs.",
            "api_prefix": settings.api_prefix,
            "environment": settings.environment,
        }

    app.mount("/uploads", StaticFiles(directory=str(uploads_root)), name="uploads")
    app.include_router(public_certificates_router)
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
