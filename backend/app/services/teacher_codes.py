from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import TeacherCodeCounterRecord, TeacherProfileRecord, UserRecord


def generate_teacher_code(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    counter = db.scalar(
        select(TeacherCodeCounterRecord)
        .where(TeacherCodeCounterRecord.year == year)
        .with_for_update()
    )
    if counter is None:
        counter = TeacherCodeCounterRecord(year=year, last_sequence=0)
        db.add(counter)
        db.flush()

    counter.last_sequence += 1
    db.add(counter)
    return f"ENS-{year}-{counter.last_sequence:04d}"


def ensure_teacher_profile(db: Session, user: UserRecord) -> TeacherProfileRecord:
    profile = db.scalar(
        select(TeacherProfileRecord).where(TeacherProfileRecord.user_id == user.id)
    )
    if profile is None:
        profile = TeacherProfileRecord(
            user_id=user.id,
            teacher_code=generate_teacher_code(db),
        )
        db.add(profile)
        db.flush()
        return profile

    if not profile.teacher_code:
        profile.teacher_code = generate_teacher_code(db)
        db.add(profile)
        db.flush()

    return profile
