from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.entities import UserRecord
from app.schemas.teacher import TeacherOverview
from app.services.teacher import get_teacher_overview

router = APIRouter(prefix="/teacher", tags=["teacher"])


@router.get("/overview", response_model=TeacherOverview)
def read_teacher_overview(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("teacher")),
) -> TeacherOverview:
    return get_teacher_overview(db, current_user)
