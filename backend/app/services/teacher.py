from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    EnrollmentRecord,
    FormationRecord,
    FormationSessionRecord,
    UserRecord,
)
from app.schemas.teacher import TeacherOverview, TeacherSessionItem
from app.services.teacher_codes import ensure_teacher_profile


def list_teacher_sessions(db: Session, user: UserRecord) -> list[TeacherSessionItem]:
    records = db.execute(
        select(FormationSessionRecord, FormationRecord)
        .join(FormationRecord, FormationSessionRecord.formation_id == FormationRecord.id)
        .where(FormationSessionRecord.teacher_name == user.full_name)
        .order_by(FormationSessionRecord.start_date.asc())
    ).all()

    items = []
    for record, formation in records:
        # Live count of active enrollments — always accurate
        live_count = int(
            db.scalar(
                select(func.count(EnrollmentRecord.id)).where(
                    EnrollmentRecord.session_id == record.id,
                    EnrollmentRecord.status.in_(("active", "completed")),
                )
            )
            or 0
        )
        items.append(
            TeacherSessionItem(
                id=record.id,
                formation_title=formation.title,
                formation_image=formation.image or "",
                format_type=formation.format_type or "ligne",
                label=record.label,
                start_date=record.start_date,
                end_date=record.end_date,
                campus_label=record.campus_label or "",
                seat_capacity=record.seat_capacity,
                enrolled_count=live_count,
                teacher_name=record.teacher_name or "",
                status=record.status,
            )
        )
    return items


def get_teacher_overview(db: Session, user: UserRecord) -> TeacherOverview:
    profile = ensure_teacher_profile(db, user)
    db.commit()

    sessions = list_teacher_sessions(db, user)
    planned_sessions_count = sum(1 for item in sessions if item.status == "planned")
    open_sessions_count = sum(1 for item in sessions if item.status == "open")
    total_students_count = sum(item.enrolled_count for item in sessions)

    return TeacherOverview(
        teacher_code=profile.teacher_code,
        assigned_sessions_count=len(sessions),
        planned_sessions_count=planned_sessions_count,
        open_sessions_count=open_sessions_count,
        total_students_count=total_students_count,
        next_session_label=sessions[0].label if sessions else None,
        sessions=sessions,
    )
