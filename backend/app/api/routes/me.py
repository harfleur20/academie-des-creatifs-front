from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.entities import UserRecord
from app.schemas.commerce import EnrollmentView, NotificationView, StudentDashboardSummary
from app.services.commerce import (
    get_student_dashboard_summary,
    list_user_enrollments,
    list_user_notifications,
)

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/enrollments", response_model=list[EnrollmentView])
def read_my_enrollments(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[EnrollmentView]:
    return list_user_enrollments(db, current_user)


@router.get("/dashboard", response_model=StudentDashboardSummary)
def read_my_dashboard(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> StudentDashboardSummary:
    return get_student_dashboard_summary(db, current_user)


@router.get("/notifications", response_model=list[NotificationView])
def read_my_notifications(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[NotificationView]:
    return list_user_notifications(db, current_user)
