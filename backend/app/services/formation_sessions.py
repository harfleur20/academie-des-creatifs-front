from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from secrets import token_hex
from urllib.parse import unquote, urlparse

from sqlalchemy import asc, desc, func, select
from sqlalchemy.orm import Session

from app.models.entities import EnrollmentRecord, FormationRecord, FormationSessionRecord

SESSION_GRACE_DAYS = 5
SESSION_SUPPORTED_FORMATS = {"live", "presentiel"}
JITSI_DOMAIN = "meet.jit.si"
JITSI_BASE_URL = f"https://{JITSI_DOMAIN}"
_UNSET = object()

FRENCH_MONTHS = {
    1: "janvier",
    2: "fevrier",
    3: "mars",
    4: "avril",
    5: "mai",
    6: "juin",
    7: "juillet",
    8: "aout",
    9: "septembre",
    10: "octobre",
    11: "novembre",
    12: "decembre",
}


@dataclass(slots=True)
class SessionPresentation:
    session: FormationSessionRecord | None
    state: str
    session_label: str | None
    card_session_label: str | None
    campus_label: str | None
    purchase_message: str | None
    can_purchase: bool
    start_date: date | None
    end_date: date | None
    late_enrollment_until: date | None


def today_utc() -> date:
    return datetime.now(UTC).date()


def supports_sessions(format_type: str) -> bool:
    return format_type in SESSION_SUPPORTED_FORMATS


def format_session_date(value: date) -> str:
    month_name = FRENCH_MONTHS.get(value.month, "")
    return f"{value.day:02d} {month_name} {value.year}"


def find_current_or_next_session(
    db: Session,
    formation_id: int,
) -> FormationSessionRecord | None:
    today = today_utc()
    return db.scalar(
        select(FormationSessionRecord)
        .where(
            FormationSessionRecord.formation_id == formation_id,
            FormationSessionRecord.status != "cancelled",
            FormationSessionRecord.end_date >= today,
        )
        .order_by(asc(FormationSessionRecord.start_date), asc(FormationSessionRecord.id))
    )


def find_latest_past_session(
    db: Session,
    formation_id: int,
) -> FormationSessionRecord | None:
    today = today_utc()
    return db.scalar(
        select(FormationSessionRecord)
        .where(
            FormationSessionRecord.formation_id == formation_id,
            FormationSessionRecord.status != "cancelled",
            FormationSessionRecord.end_date < today,
        )
        .order_by(desc(FormationSessionRecord.end_date), desc(FormationSessionRecord.id))
    )


def build_session_presentation(
    *,
    format_type: str,
    session: FormationSessionRecord | None,
    had_previous_session: bool = False,
) -> SessionPresentation:
    if not supports_sessions(format_type):
        return SessionPresentation(
            session=None,
            state="not_applicable",
            session_label=None,
            card_session_label=None,
            campus_label=None,
            purchase_message=None,
            can_purchase=True,
            start_date=None,
            end_date=None,
            late_enrollment_until=None,
        )

    if session is None:
        return SessionPresentation(
            session=None,
            state="ended" if had_previous_session else "unscheduled",
            session_label="Pas encore de nouvelle session",
            card_session_label=None,
            campus_label=None,
            purchase_message="Inscriptions closes",
            can_purchase=False,
            start_date=None,
            end_date=None,
            late_enrollment_until=None,
        )

    today = today_utc()
    late_enrollment_until = session.start_date + timedelta(days=SESSION_GRACE_DAYS)

    if today < session.start_date:
        next_label = f"Prochaine session : {format_session_date(session.start_date)}"
        return SessionPresentation(
            session=session,
            state="upcoming",
            session_label=next_label,
            card_session_label=next_label,
            campus_label=session.campus_label,
            purchase_message=None,
            can_purchase=True,
            start_date=session.start_date,
            end_date=session.end_date,
            late_enrollment_until=late_enrollment_until,
        )

    if today <= session.end_date:
        can_purchase = today <= late_enrollment_until
        return SessionPresentation(
            session=session,
            state="started_open" if can_purchase else "started_closed",
            session_label="Cette formation a debute",
            card_session_label=None,
            campus_label=session.campus_label,
            purchase_message=None if can_purchase else "Inscriptions closes",
            can_purchase=can_purchase,
            start_date=session.start_date,
            end_date=session.end_date,
            late_enrollment_until=late_enrollment_until,
        )

    return SessionPresentation(
        session=session,
        state="ended",
        session_label="Pas encore de nouvelle session",
        card_session_label=None,
        campus_label=session.campus_label,
        purchase_message="Inscriptions closes",
        can_purchase=False,
        start_date=session.start_date,
        end_date=session.end_date,
        late_enrollment_until=late_enrollment_until,
    )


def get_session_presentation(
    db: Session,
    *,
    formation_id: int,
    format_type: str,
) -> SessionPresentation:
    if not supports_sessions(format_type):
        return build_session_presentation(format_type=format_type, session=None)

    session = find_current_or_next_session(db, formation_id)
    if session is not None:
        return build_session_presentation(format_type=format_type, session=session)

    previous_session = find_latest_past_session(db, formation_id)
    return build_session_presentation(
        format_type=format_type,
        session=None,
        had_previous_session=previous_session is not None,
    )


def get_single_session_presentation(
    *,
    format_type: str,
    session: FormationSessionRecord,
) -> SessionPresentation:
    return build_session_presentation(format_type=format_type, session=session)


def _slug_room_part(value: str) -> str:
    normalized = "".join(
        char.lower() if char.isalnum() else "-"
        for char in (value or "").strip()
    ).strip("-")
    while "--" in normalized:
        normalized = normalized.replace("--", "-")
    return normalized or "formation"


def generate_jitsi_meeting_link(
    *,
    formation_slug: str,
    session_id: int,
) -> str:
    room = f"academiecreative-{_slug_room_part(formation_slug)}-{session_id}-{token_hex(6)}"
    return f"{JITSI_BASE_URL}/{room}"


def extract_jitsi_room_name(meeting_link: str | None) -> str | None:
    raw = (meeting_link or "").strip()
    if not raw:
        return None

    if "://" not in raw:
        room = raw.strip("/")
        lower_room = room.lower()
        domain_prefix = f"{JITSI_DOMAIN}/"
        if lower_room.startswith(domain_prefix):
            return room[len(domain_prefix):].strip("/") or None
        if "/" in room or "." in room:
            return None
        return room

    parsed = urlparse(raw)
    host = parsed.netloc.lower().removeprefix("www.")
    if host != JITSI_DOMAIN:
        return None

    room = unquote(parsed.path.strip("/"))
    return room or None


def normalize_meeting_link(
    *,
    format_type: str,
    formation_slug: str,
    session_id: int,
    meeting_link: str | None,
) -> str | None:
    raw = (meeting_link or "").strip()
    if format_type != "live":
        return raw or None

    if not raw:
        return generate_jitsi_meeting_link(
            formation_slug=formation_slug,
            session_id=session_id,
        )

    room = extract_jitsi_room_name(raw)
    if not room:
        raise ValueError("Le lien de reunion live doit etre un lien Jitsi meet.jit.si.")

    return f"{JITSI_BASE_URL}/{room}"


def validate_session_dates(start_date: date, end_date: date) -> None:
    if end_date < start_date:
        raise ValueError("La date de fin doit etre posterieure ou egale a la date de debut.")


def validate_live_event_in_session(
    session: FormationSessionRecord,
    scheduled_at: datetime,
) -> None:
    event_date = scheduled_at.astimezone(UTC).date() if scheduled_at.tzinfo else scheduled_at.date()
    if event_date < session.start_date or event_date > session.end_date:
        raise ValueError(
            "La seance live doit etre planifiee entre la date de debut et la date de fin de la session."
        )


def create_formation_session(
    db: Session,
    *,
    formation: FormationRecord,
    label: str,
    start_date: date,
    end_date: date,
    campus_label: str | None,
    seat_capacity: int,
    teacher_name: str | None,
    status: str,
    meeting_link: str | None,
) -> FormationSessionRecord:
    if not supports_sessions(formation.format_type):
        raise ValueError("Seules les formations live et presentiel peuvent recevoir des sessions.")

    validate_session_dates(start_date, end_date)

    record = FormationSessionRecord(
        formation_id=formation.id,
        label=label,
        start_date=start_date,
        end_date=end_date,
        campus_label=campus_label,
        seat_capacity=seat_capacity,
        enrolled_count=0,
        teacher_name=teacher_name,
        status=status,
        meeting_link=None,
    )
    db.add(record)
    db.flush()
    record.meeting_link = normalize_meeting_link(
        format_type=formation.format_type,
        formation_slug=formation.slug,
        session_id=record.id,
        meeting_link=meeting_link,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_formation_session(
    db: Session,
    *,
    session: FormationSessionRecord,
    formation: FormationRecord,
    label: str | object = _UNSET,
    start_date: date | object = _UNSET,
    end_date: date | object = _UNSET,
    campus_label: str | None | object = _UNSET,
    seat_capacity: int | object = _UNSET,
    teacher_name: str | None | object = _UNSET,
    status: str | object = _UNSET,
    meeting_link: str | None | object = _UNSET,
) -> FormationSessionRecord:
    if label is not _UNSET:
        session.label = label  # type: ignore[assignment]
    if start_date is not _UNSET:
        session.start_date = start_date  # type: ignore[assignment]
    if end_date is not _UNSET:
        session.end_date = end_date  # type: ignore[assignment]
    if campus_label is not _UNSET:
        session.campus_label = campus_label  # type: ignore[assignment]
    if seat_capacity is not _UNSET:
        session.seat_capacity = seat_capacity  # type: ignore[assignment]
    if teacher_name is not _UNSET:
        session.teacher_name = teacher_name  # type: ignore[assignment]
    if status is not _UNSET:
        session.status = status  # type: ignore[assignment]
    if meeting_link is not _UNSET:
        session.meeting_link = normalize_meeting_link(
            format_type=formation.format_type,
            formation_slug=formation.slug,
            session_id=session.id,
            meeting_link=meeting_link,  # type: ignore[arg-type]
        )
    elif formation.format_type == "live" and not (session.meeting_link or "").strip():
        session.meeting_link = generate_jitsi_meeting_link(
            formation_slug=formation.slug,
            session_id=session.id,
        )

    validate_session_dates(session.start_date, session.end_date)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def refresh_session_enrolled_count(db: Session, session_id: int) -> None:
    session = db.get(FormationSessionRecord, session_id)
    if session is None:
        return

    session.enrolled_count = int(
        db.scalar(
            select(func.count(EnrollmentRecord.id)).where(
                EnrollmentRecord.session_id == session_id,
                EnrollmentRecord.status.in_(("active", "completed")),
            )
        )
        or 0
    )
    db.add(session)
