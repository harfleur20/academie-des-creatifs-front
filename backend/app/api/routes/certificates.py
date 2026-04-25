from html import escape

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.entities import EnrollmentRecord, FormationRecord, UserRecord
from app.schemas.commerce import CertificateView
from app.services.certificates import (
    build_certificate_view,
    get_certificate_ineligibility_reason,
    is_certificate_token_valid,
    parse_certificate_token,
)
from app.services.certificate_share import (
    build_certificate_share_description,
    build_certificate_share_title,
    render_certificate_share_image,
)

router = APIRouter(prefix="/certificates", tags=["certificates"])
public_router = APIRouter(prefix="/certificats", tags=["certificates"])


def _certificate_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Certificat introuvable.",
    )


def _resolve_certificate(token: str, db: Session) -> CertificateView:
    try:
        enrollment_id, _signature = parse_certificate_token(token)
    except (ValueError, TypeError):
        raise _certificate_not_found() from None

    enrollment = db.scalar(
        select(EnrollmentRecord).where(
            EnrollmentRecord.id == enrollment_id,
            EnrollmentRecord.status.in_(["active", "completed"]),
        )
    )
    if enrollment is None:
        raise _certificate_not_found()

    student = db.get(UserRecord, enrollment.user_id)
    formation = db.get(FormationRecord, enrollment.formation_id)
    if student is None:
        raise _certificate_not_found()

    ineligibility_reason = get_certificate_ineligibility_reason(db, enrollment, formation)
    if ineligibility_reason:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ineligibility_reason,
        )

    certificate = build_certificate_view(db, enrollment, student, formation)
    if not is_certificate_token_valid(
        token,
        enrollment.id,
        certificate.certificate_number,
    ):
        raise _certificate_not_found()

    return certificate


@router.get("/verify/{token}", response_model=CertificateView)
def verify_certificate(
    token: str,
    db: Session = Depends(get_db),
) -> CertificateView:
    return _resolve_certificate(token, db)


@public_router.get("/partager/{token}", response_class=HTMLResponse, include_in_schema=False)
def share_certificate(
    token: str,
    db: Session = Depends(get_db),
) -> HTMLResponse:
    certificate = _resolve_certificate(token, db)
    share_url = certificate.share_url or f"{settings.backend_public_url}/certificats/partager/{token}"
    image_url = (
        certificate.share_image_url
        or f"{settings.backend_public_url}/certificats/partager/{token}/image.png"
    )
    verification_url = (
        certificate.verification_url
        or f"{settings.frontend_url}/certificats/verifier/{token}"
    )
    title = build_certificate_share_title(certificate)
    description = build_certificate_share_description(certificate)
    escaped_title = escape(title)
    escaped_description = escape(description)
    escaped_share_url = escape(share_url)
    escaped_image_url = escape(image_url)
    escaped_verification_url = escape(verification_url)

    html = f"""<!doctype html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escaped_title}</title>
    <meta name="description" content="{escaped_description}" />
    <meta property="og:site_name" content="Académie des Créatifs" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="{escaped_title}" />
    <meta property="og:description" content="{escaped_description}" />
    <meta property="og:url" content="{escaped_share_url}" />
    <meta property="og:image" content="{escaped_image_url}" />
    <meta property="og:image:secure_url" content="{escaped_image_url}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="{escaped_title}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escaped_title}" />
    <meta name="twitter:description" content="{escaped_description}" />
    <meta name="twitter:image" content="{escaped_image_url}" />
    <link rel="canonical" href="{escaped_verification_url}" />
    <meta http-equiv="refresh" content="0; url={escaped_verification_url}" />
    <style>
      body {{
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f7fafb;
        color: #10242b;
        display: grid;
        place-items: center;
        min-height: 100vh;
      }}
      .share-card {{
        width: min(92vw, 640px);
        border-radius: 24px;
        background: #ffffff;
        box-shadow: 0 20px 60px rgba(15, 70, 84, 0.12);
        overflow: hidden;
      }}
      .share-card img {{
        display: block;
        width: 100%;
        height: auto;
      }}
      .share-card__body {{
        padding: 24px 28px 30px;
      }}
      .share-card__body h1 {{
        margin: 0 0 10px;
        font-size: 28px;
        line-height: 1.15;
      }}
      .share-card__body p {{
        margin: 0 0 18px;
        color: #4b5f66;
        line-height: 1.6;
      }}
      .share-card__body a {{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 20px;
        border-radius: 999px;
        background: #1f2559;
        color: #ffffff;
        text-decoration: none;
        font-weight: 700;
      }}
    </style>
  </head>
  <body>
    <article class="share-card">
      <img src="{escaped_image_url}" alt="{escaped_title}" />
      <div class="share-card__body">
        <h1>{escaped_title}</h1>
        <p>{escaped_description}</p>
        <a href="{escaped_verification_url}">Ouvrir le certificat</a>
      </div>
    </article>
    <script>
      window.location.replace({escaped_verification_url!r});
    </script>
  </body>
</html>"""
    return HTMLResponse(
        content=html,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@public_router.get("/partager/{token}/image.png", include_in_schema=False)
def share_certificate_image(
    token: str,
    db: Session = Depends(get_db),
) -> Response:
    certificate = _resolve_certificate(token, db)
    image = render_certificate_share_image(certificate)
    return Response(
        content=image,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )
