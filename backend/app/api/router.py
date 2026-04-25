from fastapi import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.admin import public_router as admin_public_router
from app.api.routes.blog import router as blog_router
from app.api.routes.diagnostic import router as diagnostic_router
from app.api.routes.ai import router as ai_router
from app.api.routes.stripe_webhook import router as stripe_router
from app.api.routes.site_config import public_router as public_site_content_router
from app.api.routes.site_config import router as site_config_router
from app.api.routes.tara import router as tara_router
from app.api.routes.auth import router as auth_router
from app.api.routes.cart import router as cart_router
from app.api.routes.certificates import router as certificates_router
from app.api.routes.catalog import router as catalog_router
from app.api.routes.favorites import router as favorites_router
from app.api.routes.health import router as health_router
from app.api.routes.me import router as me_router
from app.api.routes.messages import router as messages_router
from app.api.routes.meta import router as meta_router
from app.api.routes.teacher import router as teacher_router
from app.api.routes.teachers import router as teachers_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(meta_router)
api_router.include_router(auth_router)
api_router.include_router(catalog_router)
api_router.include_router(cart_router)
api_router.include_router(certificates_router)
api_router.include_router(favorites_router)
api_router.include_router(me_router)
api_router.include_router(messages_router)
api_router.include_router(teacher_router)
api_router.include_router(teachers_router)
api_router.include_router(admin_router)
api_router.include_router(admin_public_router)
api_router.include_router(site_config_router)
api_router.include_router(public_site_content_router)
api_router.include_router(tara_router)
api_router.include_router(ai_router)
api_router.include_router(stripe_router)
api_router.include_router(blog_router)
api_router.include_router(diagnostic_router)
