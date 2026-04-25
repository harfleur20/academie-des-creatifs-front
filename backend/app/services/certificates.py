from __future__ import annotations

import base64
import hashlib
import hmac
import re
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import (
    EnrollmentRecord,
    FormationRecord,
    FormationSessionRecord,
    LessonCompletionRecord,
    UserRecord,
)
from app.schemas.commerce import CertificateView


FRENCH_MONTHS = {
    1: "janvier",
    2: "février",
    3: "mars",
    4: "avril",
    5: "mai",
    6: "juin",
    7: "juillet",
    8: "août",
    9: "septembre",
    10: "octobre",
    11: "novembre",
    12: "décembre",
}


def _format_french_date(value: datetime) -> str:
    return f"{value.day} {FRENCH_MONTHS[value.month]} {value.year}"


def _normalize_duration_label(value: int, unit: str) -> str:
    if unit == "jour":
        return f"{value} jour" + ("s" if value > 1 else "")
    if unit == "semaine":
        return f"{value} semaine" + ("s" if value > 1 else "")
    if unit == "mois":
        return f"{value} mois"
    return f"{value} an" + ("s" if value > 1 else "")


def _extract_duration_from_text(text: str | None) -> str | None:
    if not text:
        return None
    match = re.search(
        r"\b(\d+)\s*(jour|jours|semaine|semaines|mois|an|ans)\b",
        text,
        flags=re.IGNORECASE,
    )
    if match is None:
        return None

    value = int(match.group(1))
    raw_unit = match.group(2).lower()
    if raw_unit.startswith("jour"):
        unit = "jour"
    elif raw_unit.startswith("semaine"):
        unit = "semaine"
    elif raw_unit == "mois":
        unit = "mois"
    else:
        unit = "an"
    return _normalize_duration_label(value, unit)


def _session_duration_label(session: FormationSessionRecord | None) -> str | None:
    if session is None:
        return None

    total_days = max(1, (session.end_date - session.start_date).days + 1)
    rounded_months = round(total_days / 30)
    if rounded_months >= 2:
        return _normalize_duration_label(rounded_months, "mois")

    rounded_weeks = round(total_days / 7)
    if rounded_weeks >= 2:
        return _normalize_duration_label(rounded_weeks, "semaine")

    return _normalize_duration_label(total_days, "jour")


def _formation_duration_label(
    db: Session,
    enrollment: EnrollmentRecord,
    formation: FormationRecord | None,
) -> str | None:
    if formation is not None:
        for text in (formation.intro, formation.certificate_copy):
            label = _extract_duration_from_text(text)
            if label:
                return label

    if enrollment.session_id is None:
        return None

    session = db.get(FormationSessionRecord, enrollment.session_id)
    return _session_duration_label(session)


def _count_total_lessons(db: Session, formation: FormationRecord | None) -> int:
    if formation is None or not formation.module_items:
        return 0
    return sum(len(module.get("lessons", [])) for module in formation.module_items)


def _classic_progress_pct(
    db: Session,
    enrollment: EnrollmentRecord,
    formation: FormationRecord | None,
) -> int:
    total = _count_total_lessons(db, formation)
    if total <= 0:
        return 0

    completed = int(
        db.scalar(
            select(func.count())
            .select_from(LessonCompletionRecord)
            .where(LessonCompletionRecord.enrollment_id == enrollment.id)
        )
        or 0
    )
    return round((completed / total) * 100)


def get_certificate_ineligibility_reason(
    db: Session,
    enrollment: EnrollmentRecord,
    formation: FormationRecord | None,
) -> str | None:
    if enrollment.dashboard_type == "classic":
        if _classic_progress_pct(db, enrollment, formation) < 100:
            return "Certificat non disponible : parcours incomplet."
        return None

    if enrollment.status != "completed":
        return "Certificat non disponible : parcours non validé."
    return None


def _certificate_issued_at(db: Session, enrollment: EnrollmentRecord) -> datetime:
    if enrollment.dashboard_type == "classic":
        completed_at = db.scalar(
            select(func.max(LessonCompletionRecord.created_at)).where(
                LessonCompletionRecord.enrollment_id == enrollment.id,
            )
        )
        if completed_at is not None:
            return completed_at

    return enrollment.updated_at or enrollment.created_at or datetime.now(UTC)


def build_certificate_number(enrollment: EnrollmentRecord, issued_at: datetime) -> str:
    message = (
        "certificate-number:"
        f"{enrollment.id}:"
        f"{enrollment.user_id}:"
        f"{enrollment.formation_id}"
    ).encode("utf-8")
    digest = hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        message,
        hashlib.sha256,
    ).digest()
    token = base64.b32encode(digest).decode("ascii").rstrip("=")[:12]
    return f"CERT-{issued_at.year}-{token[:4]}-{token[4:8]}-{token[8:12]}"


def build_certificate_token(enrollment_id: int, certificate_number: str) -> str:
    message = f"certificate:{enrollment_id}:{certificate_number}".encode("utf-8")
    digest = hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        message,
        hashlib.sha256,
    ).digest()
    signature = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return f"{enrollment_id}.{signature}"


def build_certificate_share_path(token: str) -> str:
    return f"/certificats/partager/{token}"


def build_certificate_share_image_path(token: str) -> str:
    return f"/certificats/partager/{token}/image.png"


def parse_certificate_token(token: str) -> tuple[int, str]:
    enrollment_part, signature = token.split(".", 1)
    enrollment_id = int(enrollment_part)
    return enrollment_id, signature


def is_certificate_token_valid(
    token: str,
    enrollment_id: int,
    certificate_number: str,
) -> bool:
    expected = build_certificate_token(enrollment_id, certificate_number)
    return hmac.compare_digest(token, expected)


def build_certificate_view(
    db: Session,
    enrollment: EnrollmentRecord,
    student: UserRecord,
    formation: FormationRecord | None,
) -> CertificateView:
    issued_at = _certificate_issued_at(db, enrollment)
    issued_date_label = _format_french_date(issued_at)
    certificate_number = build_certificate_number(enrollment, issued_at)
    token = build_certificate_token(enrollment.id, certificate_number)
    verification_path = f"/certificats/verifier/{token}"
    local_verification_url = f"{settings.frontend_url}{verification_path}"
    share_path = build_certificate_share_path(token)
    share_url = f"{settings.backend_public_url}{share_path}"
    share_image_path = build_certificate_share_image_path(token)
    share_image_url = f"{settings.backend_public_url}{share_image_path}"
    formation_duration = _formation_duration_label(db, enrollment, formation)

    return CertificateView(
        enrollment_id=enrollment.id,
        certificate_number=certificate_number,
        verification_token=token,
        verification_path=verification_path,
        verification_url=local_verification_url,
        share_path=share_path,
        share_url=share_url,
        share_image_url=share_image_url,
        student_name=student.full_name,
        student_code=student.student_code,
        formation_title=formation.title if formation else "Formation",
        formation_duration=formation_duration,
        format_type=enrollment.format_type,
        dashboard_type=enrollment.dashboard_type,
        mentor_name=formation.mentor_name if formation else "",
        level=formation.level if formation else "",
        session_label=formation.session_label if formation else "",
        issued_date=issued_date_label,
        is_valid=True,
    )
