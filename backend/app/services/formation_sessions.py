from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import asc, desc, select
from sqlalchemy.orm import Session

from app.models.entities import FormationSessionRecord

SESSION_GRACE_DAYS = 5
SESSION_SUPPORTED_FORMATS = {"live", "presentiel"}

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


def assert_can_create_session(
    db: Session,
    *,
    formation_id: int,
    exclude_session_id: int | None = None,
) -> None:
    today = today_utc()
    statement = (
        select(FormationSessionRecord)
        .where(
            FormationSessionRecord.formation_id == formation_id,
            FormationSessionRecord.status != "cancelled",
            FormationSessionRecord.end_date >= today,
        )
        .order_by(asc(FormationSessionRecord.start_date), asc(FormationSessionRecord.id))
    )

    if exclude_session_id is not None:
        statement = statement.where(FormationSessionRecord.id != exclude_session_id)

    existing = db.scalar(statement)
    if existing is not None:
        raise ValueError(
            "Impossible de creer une nouvelle session tant que la session en cours ou a venir n'est pas terminee."
        )
