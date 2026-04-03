from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.seed import seed_database
from app.db.session import SessionLocal, database_has_schema


def create_app() -> FastAPI:
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

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
