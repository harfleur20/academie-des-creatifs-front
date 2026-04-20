import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.entities import SiteConfigRecord, UserRecord

router = APIRouter(prefix="/admin/site-config", tags=["site-config"])
public_router = APIRouter(prefix="/site-content", tags=["site-content"])

PUBLIC_JSON_KEYS = {
    "album_items",
    "videos",
    "testimonials",
    "badge_levels",
    "trainers",
}

ALLOWED_KEYS = {
    "site_name", "tagline", "seo_description",
    "logo_url", "favicon_url",
    "banner_title", "banner_subtitle", "banner_cta", "banner_image_url",
    "color_primary", "color_accent", "font_heading", "font_body",
} | PUBLIC_JSON_KEYS

_admin_only = require_roles("admin")


def _decode_json_value(value: str) -> object:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return []


@public_router.get("", response_model=dict[str, object])
def read_public_site_content(db: Session = Depends(get_db)) -> dict[str, object]:
    rows = db.scalars(
        select(SiteConfigRecord).where(SiteConfigRecord.key.in_(PUBLIC_JSON_KEYS))
    ).all()
    values = {row.key: _decode_json_value(row.value) for row in rows}
    return {key: values.get(key, []) for key in PUBLIC_JSON_KEYS}


@router.get("", response_model=dict[str, str])
def read_site_config(
    db: Session = Depends(get_db),
    _: UserRecord = Depends(_admin_only),
) -> dict[str, str]:
    rows = db.scalars(select(SiteConfigRecord)).all()
    return {r.key: r.value for r in rows}


@router.patch("", response_model=dict[str, str])
def update_site_config(
    payload: dict[str, str],
    db: Session = Depends(get_db),
    _: UserRecord = Depends(_admin_only),
) -> dict[str, str]:
    for key, value in payload.items():
        if key not in ALLOWED_KEYS:
            continue
        row = db.get(SiteConfigRecord, key)
        if row:
            row.value = value
        else:
            db.add(SiteConfigRecord(key=key, value=value))
    db.commit()
    rows = db.scalars(select(SiteConfigRecord)).all()
    return {r.key: r.value for r in rows}
