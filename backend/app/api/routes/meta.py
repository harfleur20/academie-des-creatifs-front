from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/platform")
def platform_summary() -> dict[str, object]:
  return {
    "name": settings.app_name,
    "version": settings.app_version,
    "surfaces": [
      "site-ecommerce",
      "dashboard-student-online",
      "dashboard-student-onsite",
      "dashboard-teacher",
      "dashboard-admin",
    ],
    "roles": ["student", "teacher", "admin"],
    "badges": [
      "aventurier",
      "debutant",
      "intermediaire",
      "semi_pro",
      "professionnel",
    ],
  }
