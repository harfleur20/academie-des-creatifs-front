from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import OnsiteSessionRecord, UserRecord
from app.schemas.teacher import TeacherOverview, TeacherSessionItem


def list_teacher_sessions(db: Session, user: UserRecord) -> list[TeacherSessionItem]:
    records = db.scalars(
        select(OnsiteSessionRecord)
        .where(OnsiteSessionRecord.teacher_name == user.full_name)
        .order_by(OnsiteSessionRecord.start_date.asc())
    ).all()
    return [
        TeacherSessionItem(
            id=record.id,
            formation_title=record.formation_title,
            label=record.label,
            start_date=record.start_date,
            campus_label=record.campus_label,
            seat_capacity=record.seat_capacity,
            enrolled_count=record.enrolled_count,
            teacher_name=record.teacher_name,
            status=record.status,
        )
        for record in records
    ]


def get_teacher_overview(db: Session, user: UserRecord) -> TeacherOverview:
    sessions = list_teacher_sessions(db, user)
    planned_sessions_count = sum(1 for item in sessions if item.status == "planned")
    open_sessions_count = sum(1 for item in sessions if item.status == "open")
    total_students_count = sum(item.enrolled_count for item in sessions)

    return TeacherOverview(
        assigned_sessions_count=len(sessions),
        planned_sessions_count=planned_sessions_count,
        open_sessions_count=open_sessions_count,
        total_students_count=total_students_count,
        next_session_label=sessions[0].label if sessions else None,
        sessions=sessions,
    )
