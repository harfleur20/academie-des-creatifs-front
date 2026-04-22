"""
Teacher management: invitations, profiles, formation assignments, session management.

Routes:
  Admin:
    POST   /admin/teachers/invite
    GET    /admin/teachers
    GET    /admin/teachers/{teacher_id}
    POST   /admin/formations/{slug}/teachers
    DELETE /admin/formations/{slug}/teachers/{teacher_id}

  Public:
    GET    /invitations/teacher/{token}
    POST   /invitations/teacher/{token}/accept

  Teacher self:
    GET    /teacher/profile
    PATCH  /teacher/profile
    GET    /teacher/formations
    GET    /teacher/formations/{formation_id}/sessions
"""
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.entities import (
    AssignmentRecord,
    AssignmentSubmissionRecord,
    AttendanceRecord,
    ChapterRecord,
    CourseRecord,
    EnrollmentRecord,
    FormationRecord,
    FormationSessionRecord,
    FormationTeacherRecord,
    GradeRecord,
    LessonProgressRecord,
    LessonRecord,
    QuizAttemptRecord,
    QuizRecord,
    ResourceRecord,
    SessionCourseDayRecord,
    SessionLiveEventRecord,
    TeacherInvitationRecord,
    TeacherProfileRecord,
    UserRecord,
)
from app.schemas.teacher import (
    AdminTeacherActivitySummary,
    AdminTeacherAssignmentDueDateUpdate,
    AdminTeacherContentAudit,
    AdminTeacherCourseDayPage,
    AdminTeacherCourseAudit,
    AdminTeacherCourseDayAudit,
    AdminTeacherDetail,
    AdminTeacherItem,
    AdminTeacherPedagogyAlert,
    AdminTeacherPedagogySessionAudit,
    AdminTeacherQuizStatusUpdate,
    AdminTeacherResourcePublicationUpdate,
    AdminTeacherStudentItem,
    AdminTeacherUpdate,
    FormationTeacherAssign,
    LiveEventCreate,
    LiveEventUpdate,
    LiveEventView,
    LiveRoomInfo,
    TeacherFormationItem,
    TeacherFullSessionItem,
    TeacherInviteAccept,
    TeacherInviteCreate,
    TeacherInviteInfo,
    TeacherInviteView,
    TeacherProfileUpdate,
    TeacherProfileView,
)
from app.services.formation_sessions import (
    build_session_presentation,
    extract_jitsi_room_name,
    get_single_session_presentation,
    today_utc,
    validate_live_event_in_session,
)
from app.services.teacher_codes import ensure_teacher_profile, generate_teacher_code

router = APIRouter(tags=["teachers"])

INVITE_EXPIRY_DAYS = 7
PEDAGOGY_COURSE_DAY_PREVIEW_LIMIT = 4
PEDAGOGY_COURSE_DAY_PAGE_MAX = 25


# ── helpers ────────────────────────────────────────────────────────────────────

def _get_teacher_or_404(db: Session, teacher_id: int) -> UserRecord:
    user = db.get(UserRecord, teacher_id)
    if user is None or user.role != "teacher":
        raise HTTPException(status_code=404, detail="Enseignant introuvable.")
    return user


def _get_profile(db: Session, user_id: int) -> TeacherProfileRecord | None:
    return db.scalar(select(TeacherProfileRecord).where(TeacherProfileRecord.user_id == user_id))


def _serialize_teacher(db: Session, user: UserRecord) -> AdminTeacherItem:
    profile = _get_profile(db, user.id)
    count_q = db.query(FormationTeacherRecord).filter(FormationTeacherRecord.teacher_id == user.id).count()
    sessions_count = int(
        db.scalar(
            select(func.count(FormationSessionRecord.id)).where(
                FormationSessionRecord.teacher_name == user.full_name,
                FormationSessionRecord.status != "cancelled",
            )
        )
        or 0
    )
    students_count = int(
        db.scalar(
            select(func.count(EnrollmentRecord.id))
            .join(FormationSessionRecord, FormationSessionRecord.id == EnrollmentRecord.session_id)
            .where(
                FormationSessionRecord.teacher_name == user.full_name,
                EnrollmentRecord.status.in_(("active", "completed")),
            )
        )
        or 0
    )
    return AdminTeacherItem(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        teacher_code=profile.teacher_code if profile else None,
        status=user.status,
        whatsapp=profile.whatsapp if profile else None,
        nationality=profile.nationality if profile else None,
        subject=profile.subject if profile else None,
        experience_years=profile.experience_years if profile else None,
        portfolio_url=profile.portfolio_url if profile else None,
        assigned_formations_count=count_q,
        assigned_sessions_count=sessions_count,
        students_count=students_count,
        created_at=user.created_at,
    )


def _get_teacher_formations(db: Session, teacher_id: int) -> list[FormationRecord]:
    return db.scalars(
        select(FormationRecord)
        .join(FormationTeacherRecord, FormationTeacherRecord.formation_id == FormationRecord.id)
        .where(FormationTeacherRecord.teacher_id == teacher_id)
        .order_by(FormationRecord.title.asc())
    ).all()


def _get_teacher_sessions(db: Session, teacher_name: str) -> list[FormationSessionRecord]:
    return db.scalars(
        select(FormationSessionRecord)
        .where(FormationSessionRecord.teacher_name == teacher_name)
        .order_by(FormationSessionRecord.start_date.asc(), FormationSessionRecord.id.asc())
    ).all()


def _get_teacher_session_or_404(db: Session, teacher_name: str, session_id: int) -> FormationSessionRecord:
    session = db.scalar(
        select(FormationSessionRecord).where(
            FormationSessionRecord.id == session_id,
            FormationSessionRecord.teacher_name == teacher_name,
        )
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Session enseignant introuvable.")
    return session


def _get_teacher_quiz_or_404(db: Session, teacher_name: str, quiz_id: int) -> QuizRecord:
    quiz = db.get(QuizRecord, quiz_id)
    if quiz is None:
        raise HTTPException(status_code=404, detail="Quiz introuvable.")
    session = db.get(FormationSessionRecord, quiz.session_id)
    if session is None or session.teacher_name != teacher_name:
        raise HTTPException(status_code=404, detail="Quiz enseignant introuvable.")
    return quiz


def _get_teacher_resource_or_404(db: Session, teacher_name: str, resource_id: int) -> ResourceRecord:
    resource = db.get(ResourceRecord, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Ressource introuvable.")
    session = db.get(FormationSessionRecord, resource.session_id)
    if session is None or session.teacher_name != teacher_name:
        raise HTTPException(status_code=404, detail="Ressource enseignant introuvable.")
    return resource


def _get_teacher_assignment_or_404(db: Session, teacher_name: str, assignment_id: int) -> AssignmentRecord:
    assignment = db.get(AssignmentRecord, assignment_id)
    if assignment is None:
        raise HTTPException(status_code=404, detail="Devoir introuvable.")
    session = db.get(FormationSessionRecord, assignment.session_id)
    if session is None or session.teacher_name != teacher_name:
        raise HTTPException(status_code=404, detail="Devoir enseignant introuvable.")
    return assignment


def _count_session_rows(db: Session, model: type, session_ids: list[int]) -> int:
    if not session_ids:
        return 0
    return int(
        db.scalar(
            select(func.count(model.id)).where(model.session_id.in_(session_ids))
        )
        or 0
    )


def _count_attendance_by_status(db: Session, session_ids: list[int], status_value: str) -> int:
    if not session_ids:
        return 0
    return int(
        db.scalar(
            select(func.count(AttendanceRecord.id)).where(
                AttendanceRecord.session_id.in_(session_ids),
                AttendanceRecord.status == status_value,
            )
        )
        or 0
    )


def _count_teacher_lessons(db: Session, session_ids: list[int]) -> int:
    if not session_ids:
        return 0
    return int(
        db.scalar(
            select(func.count(LessonRecord.id))
            .join(ChapterRecord, ChapterRecord.id == LessonRecord.chapter_id)
            .join(CourseRecord, CourseRecord.id == ChapterRecord.course_id)
            .where(CourseRecord.session_id.in_(session_ids))
        )
        or 0
    )


def _count_teacher_submissions(db: Session, session_ids: list[int], *, pending_only: bool = False) -> int:
    if not session_ids:
        return 0
    query = (
        select(func.count(AssignmentSubmissionRecord.id))
        .join(AssignmentRecord, AssignmentRecord.id == AssignmentSubmissionRecord.assignment_id)
        .where(AssignmentRecord.session_id.in_(session_ids))
    )
    if pending_only:
        query = query.where(AssignmentSubmissionRecord.is_reviewed.is_(False))
    return int(db.scalar(query) or 0)


def _count_teacher_quiz_attempts(db: Session, session_ids: list[int]) -> int:
    if not session_ids:
        return 0
    return int(
        db.scalar(
            select(func.count(QuizAttemptRecord.id))
            .join(QuizRecord, QuizRecord.id == QuizAttemptRecord.quiz_id)
            .where(QuizRecord.session_id.in_(session_ids))
        )
        or 0
    )


def _average_grade_pct(grades: list[GradeRecord]) -> float | None:
    valid = [grade for grade in grades if grade.max_score > 0]
    if not valid:
        return None
    value = sum((grade.score / grade.max_score) * 100 for grade in valid) / len(valid)
    return round(value, 1)


def _teacher_activity_summary(
    db: Session,
    sessions: list[FormationSessionRecord],
) -> AdminTeacherActivitySummary:
    session_ids = [session.id for session in sessions]
    today = today_utc()
    grades = db.scalars(
        select(GradeRecord).where(GradeRecord.session_id.in_(session_ids))
    ).all() if session_ids else []
    student_ids = set(
        db.scalars(
            select(EnrollmentRecord.user_id).where(
                EnrollmentRecord.session_id.in_(session_ids),
                EnrollmentRecord.status.in_(("active", "completed")),
            )
        ).all()
    ) if session_ids else set()
    return AdminTeacherActivitySummary(
        sessions_count=len(sessions),
        active_sessions_count=sum(
            1 for session in sessions
            if session.status != "cancelled" and session.end_date >= today
        ),
        students_count=len(student_ids),
        course_days_count=_count_session_rows(db, SessionCourseDayRecord, session_ids),
        live_events_count=_count_session_rows(db, SessionLiveEventRecord, session_ids),
        courses_count=_count_session_rows(db, CourseRecord, session_ids),
        lessons_count=_count_teacher_lessons(db, session_ids),
        resources_count=_count_session_rows(db, ResourceRecord, session_ids),
        assignments_count=_count_session_rows(db, AssignmentRecord, session_ids),
        submissions_count=_count_teacher_submissions(db, session_ids),
        pending_reviews_count=_count_teacher_submissions(db, session_ids, pending_only=True),
        quizzes_count=_count_session_rows(db, QuizRecord, session_ids),
        quiz_attempts_count=_count_teacher_quiz_attempts(db, session_ids),
        attendance_present_count=_count_attendance_by_status(db, session_ids, "present"),
        attendance_late_count=_count_attendance_by_status(db, session_ids, "late"),
        attendance_absent_count=_count_attendance_by_status(db, session_ids, "absent"),
        grades_count=len(grades),
        average_grade_pct=_average_grade_pct(grades),
    )


def _lesson_ids_for_session(db: Session, session_id: int) -> list[int]:
    return db.scalars(
        select(LessonRecord.id)
        .join(ChapterRecord, ChapterRecord.id == LessonRecord.chapter_id)
        .join(CourseRecord, CourseRecord.id == ChapterRecord.course_id)
        .where(CourseRecord.session_id == session_id)
    ).all()


def _progress_pct_for_enrollment(db: Session, enrollment_id: int, lesson_ids: list[int]) -> float:
    if not lesson_ids:
        return 0.0
    completed_count = int(
        db.scalar(
            select(func.count(LessonProgressRecord.id)).where(
                LessonProgressRecord.enrollment_id == enrollment_id,
                LessonProgressRecord.lesson_id.in_(lesson_ids),
            )
        )
        or 0
    )
    return round((completed_count / len(lesson_ids)) * 100, 1)


def _latest_student_activity(
    db: Session,
    enrollment: EnrollmentRecord,
    lesson_ids: list[int],
) -> datetime | None:
    activity_dates = [enrollment.updated_at, enrollment.created_at]
    for model in (AttendanceRecord, GradeRecord, AssignmentSubmissionRecord):
        latest = db.scalar(
            select(func.max(model.updated_at)).where(model.enrollment_id == enrollment.id)
        )
        if latest is not None:
            activity_dates.append(latest)
    if lesson_ids:
        latest_progress = db.scalar(
            select(func.max(LessonProgressRecord.completed_at)).where(
                LessonProgressRecord.enrollment_id == enrollment.id,
                LessonProgressRecord.lesson_id.in_(lesson_ids),
            )
        )
        if latest_progress is not None:
            activity_dates.append(latest_progress)
    return max((item for item in activity_dates if item is not None), default=None)


def _serialize_teacher_students(
    db: Session,
    sessions: list[FormationSessionRecord],
) -> list[AdminTeacherStudentItem]:
    session_ids = [session.id for session in sessions]
    if not session_ids:
        return []

    rows = db.execute(
        select(EnrollmentRecord, UserRecord, FormationRecord, FormationSessionRecord)
        .join(UserRecord, UserRecord.id == EnrollmentRecord.user_id)
        .join(FormationRecord, FormationRecord.id == EnrollmentRecord.formation_id)
        .join(FormationSessionRecord, FormationSessionRecord.id == EnrollmentRecord.session_id)
        .where(
            FormationSessionRecord.id.in_(session_ids),
            EnrollmentRecord.status.in_(("active", "completed")),
        )
        .order_by(UserRecord.full_name.asc(), FormationRecord.title.asc())
    ).all()
    lesson_ids_by_session: dict[int, list[int]] = {}
    students: list[AdminTeacherStudentItem] = []
    for row in rows:
        enrollment = row.EnrollmentRecord
        student = row.UserRecord
        formation = row.FormationRecord
        session = row.FormationSessionRecord
        lesson_ids = lesson_ids_by_session.setdefault(session.id, _lesson_ids_for_session(db, session.id))
        attendance_rows = db.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.session_id == session.id,
                AttendanceRecord.enrollment_id == enrollment.id,
            )
        ).all()
        grades = db.scalars(
            select(GradeRecord).where(
                GradeRecord.session_id == session.id,
                GradeRecord.enrollment_id == enrollment.id,
            )
        ).all()
        submissions = db.scalars(
            select(AssignmentSubmissionRecord)
            .join(AssignmentRecord, AssignmentRecord.id == AssignmentSubmissionRecord.assignment_id)
            .where(
                AssignmentRecord.session_id == session.id,
                AssignmentSubmissionRecord.enrollment_id == enrollment.id,
            )
        ).all()
        students.append(
            AdminTeacherStudentItem(
                enrollment_id=enrollment.id,
                student_id=student.id,
                full_name=student.full_name,
                email=student.email,
                student_code=student.student_code,
                formation_title=formation.title,
                formation_slug=formation.slug,
                session_id=session.id,
                session_label=session.label,
                enrollment_status=enrollment.status,
                progress_pct=_progress_pct_for_enrollment(db, enrollment.id, lesson_ids),
                attendance_count=len(attendance_rows),
                present_count=sum(1 for item in attendance_rows if item.status == "present"),
                late_count=sum(1 for item in attendance_rows if item.status == "late"),
                absent_count=sum(1 for item in attendance_rows if item.status == "absent"),
                grades_count=len(grades),
                average_grade_pct=_average_grade_pct(grades),
                submissions_count=len(submissions),
                pending_reviews_count=sum(1 for item in submissions if not item.is_reviewed),
                last_activity_at=_latest_student_activity(db, enrollment, lesson_ids),
            )
        )
    return students


def _count_course_day_rows(db: Session, model: type, course_day_id: int) -> int:
    return int(
        db.scalar(
            select(func.count(model.id)).where(model.course_day_id == course_day_id)
        )
        or 0
    )


def _count_course_day_attendance(db: Session, course_day_id: int, status_value: str | None = None) -> int:
    query = select(func.count(AttendanceRecord.id)).where(AttendanceRecord.course_day_id == course_day_id)
    if status_value is not None:
        query = query.where(AttendanceRecord.status == status_value)
    return int(db.scalar(query) or 0)


def _assignment_submission_counts(db: Session, assignment_id: int) -> tuple[int, int]:
    submissions = db.scalars(
        select(AssignmentSubmissionRecord).where(AssignmentSubmissionRecord.assignment_id == assignment_id)
    ).all()
    return len(submissions), sum(1 for submission in submissions if not submission.is_reviewed)


def _quiz_attempt_count(db: Session, quiz_id: int) -> int:
    return int(
        db.scalar(
            select(func.count(QuizAttemptRecord.id)).where(QuizAttemptRecord.quiz_id == quiz_id)
        )
        or 0
    )


def _course_audits_for_session(db: Session, session_id: int) -> list[AdminTeacherCourseAudit]:
    courses = db.scalars(
        select(CourseRecord)
        .where(CourseRecord.session_id == session_id)
        .order_by(CourseRecord.created_at.asc(), CourseRecord.id.asc())
    ).all()
    audits: list[AdminTeacherCourseAudit] = []
    for course in courses:
        chapter_ids = db.scalars(
            select(ChapterRecord.id).where(ChapterRecord.course_id == course.id)
        ).all()
        lessons_count = int(
            db.scalar(
                select(func.count(LessonRecord.id)).where(LessonRecord.chapter_id.in_(chapter_ids))
            )
            or 0
        ) if chapter_ids else 0
        audits.append(
            AdminTeacherCourseAudit(
                id=course.id,
                title=course.title,
                chapters_count=len(chapter_ids),
                lessons_count=lessons_count,
            )
        )
    return audits


def _course_day_audits_for_session(
    db: Session,
    session_id: int,
    *,
    offset: int = 0,
    limit: int | None = None,
) -> list[AdminTeacherCourseDayAudit]:
    query = (
        select(SessionCourseDayRecord)
        .where(SessionCourseDayRecord.session_id == session_id)
        .order_by(SessionCourseDayRecord.scheduled_at.asc(), SessionCourseDayRecord.id.asc())
        .offset(offset)
    )
    if limit is not None:
        query = query.limit(limit)
    days = db.scalars(query).all()
    return [
        AdminTeacherCourseDayAudit(
            id=day.id,
            title=day.title,
            scheduled_at=day.scheduled_at,
            status=day.status,
            attendance_count=_count_course_day_attendance(db, day.id),
            present_count=_count_course_day_attendance(db, day.id, "present"),
            absent_count=_count_course_day_attendance(db, day.id, "absent"),
            late_count=_count_course_day_attendance(db, day.id, "late"),
            resource_count=_count_course_day_rows(db, ResourceRecord, day.id),
            assignment_count=_count_course_day_rows(db, AssignmentRecord, day.id),
            quiz_count=_count_course_day_rows(db, QuizRecord, day.id),
        )
        for day in days
    ]


def _serialize_teacher_course_day_page(
    db: Session,
    session_id: int,
    *,
    offset: int,
    limit: int,
) -> AdminTeacherCourseDayPage:
    total_count = int(
        db.scalar(
            select(func.count(SessionCourseDayRecord.id)).where(SessionCourseDayRecord.session_id == session_id)
        )
        or 0
    )
    return AdminTeacherCourseDayPage(
        items=_course_day_audits_for_session(db, session_id, offset=offset, limit=limit),
        total_count=total_count,
        offset=offset,
        limit=limit,
    )


def _content_audits_for_session(db: Session, session_id: int) -> list[AdminTeacherContentAudit]:
    resources = db.scalars(
        select(ResourceRecord)
        .where(ResourceRecord.session_id == session_id)
        .order_by(ResourceRecord.created_at.asc(), ResourceRecord.id.asc())
    ).all()
    assignments = db.scalars(
        select(AssignmentRecord)
        .where(AssignmentRecord.session_id == session_id)
        .order_by(AssignmentRecord.due_date.asc(), AssignmentRecord.id.asc())
    ).all()
    quizzes = db.scalars(
        select(QuizRecord)
        .where(QuizRecord.session_id == session_id)
        .order_by(QuizRecord.created_at.asc(), QuizRecord.id.asc())
    ).all()

    contents: list[AdminTeacherContentAudit] = [
        AdminTeacherContentAudit(
            id=resource.id,
            title=resource.title,
            content_type=f"resource:{resource.resource_type}",
            status="published" if resource.published_at else "draft",
            scheduled_at=resource.published_at,
        )
        for resource in resources
    ]
    for assignment in assignments:
        submissions_count, pending_reviews_count = _assignment_submission_counts(db, assignment.id)
        contents.append(
            AdminTeacherContentAudit(
                id=assignment.id,
                title=assignment.title,
                content_type="assignment",
                status="pending_review" if pending_reviews_count else "assigned",
                due_date=assignment.due_date,
                submissions_count=submissions_count,
                pending_reviews_count=pending_reviews_count,
            )
        )
    contents.extend(
        AdminTeacherContentAudit(
            id=quiz.id,
            title=quiz.title,
            content_type="quiz",
            status=quiz.status,
            scheduled_at=quiz.scheduled_at,
            attempts_count=_quiz_attempt_count(db, quiz.id),
        )
        for quiz in quizzes
    )

    def sort_key(item: AdminTeacherContentAudit) -> tuple[datetime, str]:
        value = item.scheduled_at or item.due_date
        if value is None:
            value = datetime.max.replace(tzinfo=timezone.utc)
        elif value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value, item.title.lower()

    return sorted(contents, key=sort_key)


def _pedagogy_alerts_for_session(
    session: FormationSessionRecord,
    students_count: int,
    live_events_count: int,
    lessons_count: int,
    resources_count: int,
    assignments_count: int,
    quizzes_count: int,
    pending_reviews_count: int,
    course_days: list[AdminTeacherCourseDayAudit],
    contents: list[AdminTeacherContentAudit],
) -> list[AdminTeacherPedagogyAlert]:
    alerts: list[AdminTeacherPedagogyAlert] = []

    if session.status in ("planned", "active") and not course_days and live_events_count == 0:
        alerts.append(
            AdminTeacherPedagogyAlert(
                code="missing_schedule",
                level="warning",
                label="Aucune journée planifiée",
                detail="La session n'a encore ni journée de cours ni classe live planifiée.",
            )
        )

    if students_count > 0 and lessons_count == 0 and resources_count == 0:
        alerts.append(
            AdminTeacherPedagogyAlert(
                code="missing_learning_content",
                level="critical",
                label="Aucun contenu pédagogique",
                detail="Aucune leçon ni ressource publiée pour cette session.",
            )
        )
    elif students_count > 0 and lessons_count == 0:
        alerts.append(
            AdminTeacherPedagogyAlert(
                code="missing_lessons",
                level="warning",
                label="Aucune leçon structurée",
                detail="La session a des étudiants mais aucune leçon rattachée aux cours.",
            )
        )

    if students_count > 0 and assignments_count + quizzes_count == 0:
        alerts.append(
            AdminTeacherPedagogyAlert(
                code="missing_evaluations",
                level="warning",
                label="Aucune évaluation",
                detail="Aucun devoir ni quiz n'est encore disponible pour cette session.",
            )
        )

    if students_count > 0 and course_days and sum(day.attendance_count for day in course_days) == 0:
        alerts.append(
            AdminTeacherPedagogyAlert(
                code="attendance_not_marked",
                level="warning",
                label="Présences non saisies",
                detail="Des journées existent mais aucune présence étudiante n'a été enregistrée.",
            )
        )

    draft_contents_count = sum(1 for content in contents if content.status == "draft")
    if draft_contents_count > 0:
        alerts.append(
            AdminTeacherPedagogyAlert(
                code="draft_content",
                level="info",
                label="Contenus en brouillon",
                detail=f"{draft_contents_count} contenu(x) reste(nt) en brouillon.",
            )
        )

    if pending_reviews_count > 0:
        alerts.append(
            AdminTeacherPedagogyAlert(
                code="pending_reviews",
                level="critical",
                label="Corrections en attente",
                detail=f"{pending_reviews_count} rendu(x) attend(ent) encore une correction.",
            )
        )

    return alerts


def _teacher_pedagogy_audit(
    db: Session,
    sessions: list[FormationSessionRecord],
    formations_by_id: dict[int, FormationRecord],
) -> list[AdminTeacherPedagogySessionAudit]:
    audits: list[AdminTeacherPedagogySessionAudit] = []
    for session in sessions:
        formation = formations_by_id.get(session.formation_id)
        if formation is None:
            continue
        session_ids = [session.id]
        assignments = db.scalars(
            select(AssignmentRecord).where(AssignmentRecord.session_id == session.id)
        ).all()
        pending_reviews_count = 0
        for assignment in assignments:
            _, pending = _assignment_submission_counts(db, assignment.id)
            pending_reviews_count += pending
        students_count = int(
            db.scalar(
                select(func.count(EnrollmentRecord.id)).where(
                    EnrollmentRecord.session_id == session.id,
                    EnrollmentRecord.status.in_(("active", "completed")),
                )
            )
            or 0
        )
        course_days = _course_day_audits_for_session(
            db,
            session.id,
            limit=PEDAGOGY_COURSE_DAY_PREVIEW_LIMIT,
        )
        course_days_count = int(
            db.scalar(
                select(func.count(SessionCourseDayRecord.id)).where(SessionCourseDayRecord.session_id == session.id)
            )
            or 0
        )
        live_events_count = _count_session_rows(db, SessionLiveEventRecord, session_ids)
        courses = _course_audits_for_session(db, session.id)
        lessons_count = _count_teacher_lessons(db, session_ids)
        resources_count = _count_session_rows(db, ResourceRecord, session_ids)
        quizzes_count = _count_session_rows(db, QuizRecord, session_ids)
        contents = _content_audits_for_session(db, session.id)
        audits.append(
            AdminTeacherPedagogySessionAudit(
                session_id=session.id,
                formation_title=formation.title,
                formation_slug=formation.slug,
                session_label=session.label,
                session_status=session.status,
                start_date=session.start_date,
                end_date=session.end_date,
                students_count=students_count,
                course_days_count=course_days_count,
                live_events_count=live_events_count,
                courses_count=_count_session_rows(db, CourseRecord, session_ids),
                lessons_count=lessons_count,
                resources_count=resources_count,
                assignments_count=len(assignments),
                quizzes_count=quizzes_count,
                pending_reviews_count=pending_reviews_count,
                alerts=_pedagogy_alerts_for_session(
                    session=session,
                    students_count=students_count,
                    live_events_count=live_events_count,
                    lessons_count=lessons_count,
                    resources_count=resources_count,
                    assignments_count=len(assignments),
                    quizzes_count=quizzes_count,
                    pending_reviews_count=pending_reviews_count,
                    course_days=course_days,
                    contents=contents,
                ),
                course_days=course_days,
                courses=courses,
                contents=contents,
            )
        )
    return audits


def _serialize_teacher_detail(db: Session, user: UserRecord) -> AdminTeacherDetail:
    formations = _get_teacher_formations(db, user.id)
    sessions = _get_teacher_sessions(db, user.full_name)
    session_formations_by_id = {formation.id: formation for formation in formations}
    for session in sessions:
        if session.formation_id not in session_formations_by_id:
            formation = db.get(FormationRecord, session.formation_id)
            if formation is not None:
                session_formations_by_id[formation.id] = formation
    return AdminTeacherDetail(
        teacher=_serialize_teacher(db, user),
        formations=[_serialize_formation(db, formation, user.full_name) for formation in formations],
        sessions=[
            _serialize_session(db, session, session_formations_by_id[session.formation_id])
            for session in sessions
            if session.formation_id in session_formations_by_id
        ],
        activity=_teacher_activity_summary(db, sessions),
        students=_serialize_teacher_students(db, sessions),
        pedagogy=_teacher_pedagogy_audit(db, sessions, session_formations_by_id),
    )


def _serialize_formation(db: Session, f: FormationRecord, teacher_name: str) -> TeacherFormationItem:
    today = today_utc()
    session = db.scalar(
        select(FormationSessionRecord)
        .where(
            FormationSessionRecord.formation_id == f.id,
            FormationSessionRecord.teacher_name == teacher_name,
            FormationSessionRecord.status != "cancelled",
            FormationSessionRecord.end_date >= today,
        )
        .order_by(FormationSessionRecord.start_date.asc(), FormationSessionRecord.id.asc())
    )
    had_previous_session = db.scalar(
        select(FormationSessionRecord.id)
        .where(
            FormationSessionRecord.formation_id == f.id,
            FormationSessionRecord.teacher_name == teacher_name,
            FormationSessionRecord.status != "cancelled",
            FormationSessionRecord.end_date < today,
        )
        .limit(1)
    ) is not None
    presentation = build_session_presentation(
        format_type=f.format_type,
        session=session,
        had_previous_session=had_previous_session,
    )
    session = presentation.session if presentation else None
    return TeacherFormationItem(
        id=f.id,
        slug=f.slug,
        title=f.title,
        format_type=f.format_type,
        image=f.image,
        session_label=presentation.session_label if presentation else None,
        session_state=presentation.state if presentation else None,
        meeting_link=session.meeting_link if session else None,
    )


def _serialize_session(db: Session, s: FormationSessionRecord, f: FormationRecord) -> TeacherFullSessionItem:
    presentation = get_single_session_presentation(
        format_type=f.format_type,
        session=s,
    )
    enrolled_count = int(
        db.scalar(
            select(func.count(EnrollmentRecord.id)).where(
                EnrollmentRecord.session_id == s.id,
                EnrollmentRecord.status.in_(("active", "completed")),
            )
        )
        or 0
    )
    return TeacherFullSessionItem(
        id=s.id,
        formation_id=f.id,
        formation_title=f.title,
        formation_slug=f.slug,
        format_type=f.format_type,
        label=s.label,
        start_date=s.start_date,
        end_date=s.end_date,
        campus_label=s.campus_label,
        seat_capacity=s.seat_capacity,
        enrolled_count=enrolled_count,
        meeting_link=s.meeting_link,
        status=s.status,
        session_state=presentation.state if presentation else "not_applicable",
    )


def _serialize_invitation(invitation: TeacherInvitationRecord) -> TeacherInviteView:
    return TeacherInviteView(
        id=invitation.id,
        token=invitation.token,
        email=invitation.email,
        full_name=invitation.full_name,
        whatsapp=invitation.whatsapp,
        nationality=invitation.nationality,
        subject=invitation.subject,
        experience_years=invitation.experience_years,
        portfolio_url=invitation.portfolio_url,
        bio=invitation.bio,
        status=invitation.status,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
    )


def _is_invitation_expired(invitation: TeacherInvitationRecord) -> bool:
    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at < datetime.now(timezone.utc)


# ── Admin: invitations ─────────────────────────────────────────────────────────

@router.post("/admin/teachers/invite", response_model=TeacherInviteView, status_code=201)
def invite_teacher(
    payload: TeacherInviteCreate,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> TeacherInviteView:
    existing = db.scalar(select(UserRecord).where(UserRecord.email == payload.email))
    if existing:
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email.")

    pending = db.scalar(
        select(TeacherInvitationRecord).where(
            TeacherInvitationRecord.email == payload.email,
            TeacherInvitationRecord.status == "pending",
        )
    )
    if pending:
        raise HTTPException(status_code=400, detail="Une invitation est déjà en attente pour cet email.")

    token = secrets.token_urlsafe(32)
    invitation = TeacherInvitationRecord(
        token=token,
        email=payload.email,
        full_name=payload.full_name,
        whatsapp=payload.whatsapp,
        nationality=payload.nationality,
        subject=payload.subject,
        experience_years=payload.experience_years,
        portfolio_url=payload.portfolio_url,
        bio=payload.bio,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRY_DAYS),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return _serialize_invitation(invitation)


@router.get("/admin/teachers/invitations", response_model=list[TeacherInviteView])
def list_teacher_invitations(
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> list[TeacherInviteView]:
    invitations = db.scalars(
        select(TeacherInvitationRecord).order_by(TeacherInvitationRecord.created_at.desc())
    ).all()
    return [_serialize_invitation(invitation) for invitation in invitations]


def _cancel_teacher_invitation(db: Session, invitation_id: int) -> TeacherInviteView:
    invitation = db.get(TeacherInvitationRecord, invitation_id)
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")
    if invitation.status == "accepted":
        raise HTTPException(status_code=400, detail="Cette invitation a déjà été acceptée.")
    if invitation.status != "cancelled":
        invitation.status = "cancelled"
        db.commit()
        db.refresh(invitation)
    return _serialize_invitation(invitation)


@router.post("/admin/teachers/invitations/{invitation_id}/revoke", response_model=TeacherInviteView)
def revoke_teacher_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> TeacherInviteView:
    return _cancel_teacher_invitation(db, invitation_id)


@router.post("/admin/teachers/invitations/{invitation_id}/cancel", response_model=TeacherInviteView)
def cancel_teacher_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> TeacherInviteView:
    return _cancel_teacher_invitation(db, invitation_id)


@router.get("/admin/teachers", response_model=list[AdminTeacherItem])
def list_teachers(
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> list[AdminTeacherItem]:
    teachers = db.scalars(
        select(UserRecord).where(UserRecord.role == "teacher").order_by(UserRecord.created_at.desc())
    ).all()
    return [_serialize_teacher(db, t) for t in teachers]


@router.get("/admin/teachers/{teacher_id}", response_model=AdminTeacherItem)
def get_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> AdminTeacherItem:
    teacher = _get_teacher_or_404(db, teacher_id)
    return _serialize_teacher(db, teacher)


@router.get("/admin/teachers/{teacher_id}/detail", response_model=AdminTeacherDetail)
def get_teacher_detail(
    teacher_id: int,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> AdminTeacherDetail:
    teacher = _get_teacher_or_404(db, teacher_id)
    return _serialize_teacher_detail(db, teacher)


@router.get("/admin/teachers/{teacher_id}/sessions/{session_id}/course-days", response_model=AdminTeacherCourseDayPage)
def get_teacher_session_course_days_admin(
    teacher_id: int,
    session_id: int,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=PEDAGOGY_COURSE_DAY_PAGE_MAX),
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> AdminTeacherCourseDayPage:
    teacher = _get_teacher_or_404(db, teacher_id)
    session = _get_teacher_session_or_404(db, teacher.full_name, session_id)
    return _serialize_teacher_course_day_page(db, session.id, offset=offset, limit=limit)


@router.patch("/admin/teachers/{teacher_id}/quizzes/{quiz_id}/status", response_model=AdminTeacherDetail)
def update_teacher_quiz_status_admin(
    teacher_id: int,
    quiz_id: int,
    payload: AdminTeacherQuizStatusUpdate,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> AdminTeacherDetail:
    teacher = _get_teacher_or_404(db, teacher_id)
    quiz = _get_teacher_quiz_or_404(db, teacher.full_name, quiz_id)
    quiz.status = payload.status
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return _serialize_teacher_detail(db, teacher)


@router.patch("/admin/teachers/{teacher_id}/resources/{resource_id}/publication", response_model=AdminTeacherDetail)
def update_teacher_resource_publication_admin(
    teacher_id: int,
    resource_id: int,
    payload: AdminTeacherResourcePublicationUpdate,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> AdminTeacherDetail:
    teacher = _get_teacher_or_404(db, teacher_id)
    resource = _get_teacher_resource_or_404(db, teacher.full_name, resource_id)
    session = _get_teacher_session_or_404(db, teacher.full_name, resource.session_id)
    if "published_at" in payload.model_fields_set and payload.published_at is not None:
        try:
            validate_live_event_in_session(session, payload.published_at)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if "published_at" in payload.model_fields_set:
        resource.published_at = payload.published_at
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return _serialize_teacher_detail(db, teacher)


@router.patch("/admin/teachers/{teacher_id}/assignments/{assignment_id}/due-date", response_model=AdminTeacherDetail)
def update_teacher_assignment_due_date_admin(
    teacher_id: int,
    assignment_id: int,
    payload: AdminTeacherAssignmentDueDateUpdate,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> AdminTeacherDetail:
    teacher = _get_teacher_or_404(db, teacher_id)
    assignment = _get_teacher_assignment_or_404(db, teacher.full_name, assignment_id)
    session = _get_teacher_session_or_404(db, teacher.full_name, assignment.session_id)
    try:
        validate_live_event_in_session(session, payload.due_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    assignment.due_date = payload.due_date
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return _serialize_teacher_detail(db, teacher)


@router.patch("/admin/teachers/{teacher_id}", response_model=AdminTeacherDetail)
def update_teacher_admin(
    teacher_id: int,
    payload: AdminTeacherUpdate,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> AdminTeacherDetail:
    teacher = _get_teacher_or_404(db, teacher_id)
    profile = ensure_teacher_profile(db, teacher)
    fields = payload.model_fields_set

    if "email" in fields and payload.email is not None:
        next_email = payload.email.strip().lower()
        existing = db.scalar(
            select(UserRecord).where(
                UserRecord.email == next_email,
                UserRecord.id != teacher.id,
            )
        )
        if existing:
            raise HTTPException(status_code=400, detail="Un autre compte utilise déjà cet email.")
        teacher.email = next_email

    if "full_name" in fields and payload.full_name is not None:
        previous_name = teacher.full_name
        teacher.full_name = payload.full_name.strip()
        if previous_name != teacher.full_name:
            sessions = db.scalars(
                select(FormationSessionRecord).where(FormationSessionRecord.teacher_name == previous_name)
            ).all()
            for session in sessions:
                session.teacher_name = teacher.full_name
                db.add(session)

    if "status" in fields and payload.status is not None:
        teacher.status = payload.status

    if "whatsapp" in fields:
        profile.whatsapp = payload.whatsapp
    if "nationality" in fields:
        profile.nationality = payload.nationality
    if "subject" in fields:
        profile.subject = payload.subject
    if "experience_years" in fields:
        profile.experience_years = payload.experience_years
    if "portfolio_url" in fields:
        profile.portfolio_url = payload.portfolio_url
    if "bio" in fields:
        profile.bio = payload.bio

    db.add(teacher)
    db.add(profile)
    db.commit()
    db.refresh(teacher)
    return _serialize_teacher_detail(db, teacher)


# ── Admin: formation ↔ teacher assignment ──────────────────────────────────────

@router.post("/admin/formations/{slug}/teachers", status_code=201)
def assign_teacher_to_formation(
    slug: str,
    payload: FormationTeacherAssign,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> dict:
    formation = db.scalar(select(FormationRecord).where(FormationRecord.slug == slug))
    if not formation:
        raise HTTPException(status_code=404, detail="Formation introuvable.")

    teacher = _get_teacher_or_404(db, payload.teacher_id)
    if teacher.status != "active":
        raise HTTPException(status_code=400, detail="Cet enseignant doit être actif avant affectation.")

    existing = db.scalar(
        select(FormationTeacherRecord).where(
            FormationTeacherRecord.formation_id == formation.id,
            FormationTeacherRecord.teacher_id == teacher.id,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Cet enseignant est déjà assigné à cette formation.")

    link = FormationTeacherRecord(formation_id=formation.id, teacher_id=teacher.id)
    db.add(link)
    db.commit()
    return {"detail": "Enseignant assigné avec succès."}


@router.delete("/admin/formations/{slug}/teachers/{teacher_id}", status_code=204)
def remove_teacher_from_formation(
    slug: str,
    teacher_id: int,
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> None:
    formation = db.scalar(select(FormationRecord).where(FormationRecord.slug == slug))
    if not formation:
        raise HTTPException(status_code=404, detail="Formation introuvable.")

    link = db.scalar(
        select(FormationTeacherRecord).where(
            FormationTeacherRecord.formation_id == formation.id,
            FormationTeacherRecord.teacher_id == teacher_id,
        )
    )
    if not link:
        raise HTTPException(status_code=404, detail="Assignation introuvable.")
    db.delete(link)
    db.commit()


# ── Public: invitation acceptance ─────────────────────────────────────────────

@router.get("/invitations/teacher/{token}", response_model=TeacherInviteInfo)
def get_invitation_info(token: str, db: Session = Depends(get_db)) -> TeacherInviteInfo:
    invitation = db.scalar(select(TeacherInvitationRecord).where(TeacherInvitationRecord.token == token))
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")
    if invitation.status == "accepted":
        raise HTTPException(status_code=400, detail="Cette invitation a déjà été utilisée.")
    if invitation.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cette invitation a été révoquée.")
    if invitation.status != "pending":
        raise HTTPException(status_code=400, detail="Cette invitation n'est plus active.")
    if _is_invitation_expired(invitation):
        invitation.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Cette invitation a expiré.")
    return TeacherInviteInfo(
        token=invitation.token,
        email=invitation.email,
        full_name=invitation.full_name,
        whatsapp=invitation.whatsapp,
        nationality=invitation.nationality,
        subject=invitation.subject,
        experience_years=invitation.experience_years,
        portfolio_url=invitation.portfolio_url,
        bio=invitation.bio,
        status=invitation.status,
    )


@router.post("/invitations/teacher/{token}/accept", status_code=201)
def accept_invitation(
    token: str,
    payload: TeacherInviteAccept,
    db: Session = Depends(get_db),
) -> dict:
    invitation = db.scalar(select(TeacherInvitationRecord).where(TeacherInvitationRecord.token == token))
    if not invitation or invitation.status != "pending":
        raise HTTPException(status_code=400, detail="Invitation invalide ou déjà utilisée.")
    if _is_invitation_expired(invitation):
        invitation.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Cette invitation a expiré.")

    existing = db.scalar(select(UserRecord).where(UserRecord.email == invitation.email))
    if existing:
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email.")

    user = UserRecord(
        full_name=invitation.full_name,
        email=invitation.email,
        password_hash=hash_password(payload.password),
        role="teacher",
        status="active",
    )
    db.add(user)
    db.flush()

    profile = TeacherProfileRecord(
        user_id=user.id,
        teacher_code=generate_teacher_code(db),
        whatsapp=payload.whatsapp if payload.whatsapp is not None else invitation.whatsapp,
        nationality=payload.nationality if payload.nationality is not None else invitation.nationality,
        subject=payload.subject if payload.subject is not None else invitation.subject,
        experience_years=(
            payload.experience_years
            if payload.experience_years is not None
            else invitation.experience_years
        ),
        portfolio_url=(
            payload.portfolio_url
            if payload.portfolio_url is not None
            else invitation.portfolio_url
        ),
        bio=payload.bio if payload.bio is not None else invitation.bio,
    )
    db.add(profile)

    invitation.status = "accepted"
    db.commit()
    return {"detail": "Compte enseignant créé avec succès. Vous pouvez maintenant vous connecter."}


# ── Teacher self: profile ──────────────────────────────────────────────────────

@router.get("/teacher/profile", response_model=TeacherProfileView)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("teacher")),
) -> TeacherProfileView:
    profile = _get_profile(db, current_user.id)
    return TeacherProfileView(
        user_id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        teacher_code=profile.teacher_code if profile else None,
        whatsapp=profile.whatsapp if profile else None,
        nationality=profile.nationality if profile else None,
        subject=profile.subject if profile else None,
        experience_years=profile.experience_years if profile else None,
        portfolio_url=profile.portfolio_url if profile else None,
        bio=profile.bio if profile else None,
    )


@router.patch("/teacher/profile", response_model=TeacherProfileView)
def update_my_profile(
    payload: TeacherProfileUpdate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("teacher")),
) -> TeacherProfileView:
    profile = _get_profile(db, current_user.id)
    if profile is None:
        profile = ensure_teacher_profile(db, current_user)

    if payload.whatsapp is not None:
        profile.whatsapp = payload.whatsapp
    if payload.nationality is not None:
        profile.nationality = payload.nationality
    if payload.subject is not None:
        profile.subject = payload.subject
    if payload.experience_years is not None:
        profile.experience_years = payload.experience_years
    if payload.portfolio_url is not None:
        profile.portfolio_url = payload.portfolio_url
    if payload.bio is not None:
        profile.bio = payload.bio

    db.commit()
    db.refresh(profile)
    return TeacherProfileView(
        user_id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        teacher_code=profile.teacher_code,
        whatsapp=profile.whatsapp,
        nationality=profile.nationality,
        subject=profile.subject,
        experience_years=profile.experience_years,
        portfolio_url=profile.portfolio_url,
        bio=profile.bio,
    )


# ── Teacher self: formations ───────────────────────────────────────────────────

@router.get("/teacher/formations", response_model=list[TeacherFormationItem])
def get_my_formations(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("teacher")),
) -> list[TeacherFormationItem]:
    formations = db.scalars(
        select(FormationRecord)
        .join(FormationTeacherRecord, FormationTeacherRecord.formation_id == FormationRecord.id)
        .where(FormationTeacherRecord.teacher_id == current_user.id)
        .order_by(FormationRecord.title.asc())
    ).all()
    return [_serialize_formation(db, f, current_user.full_name) for f in formations]


# ── Teacher self: sessions ─────────────────────────────────────────────────────

@router.get("/teacher/formations/{formation_id}/sessions", response_model=list[TeacherFullSessionItem])
def get_my_formation_sessions(
    formation_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("teacher")),
) -> list[TeacherFullSessionItem]:
    link = db.scalar(
        select(FormationTeacherRecord).where(
            FormationTeacherRecord.formation_id == formation_id,
            FormationTeacherRecord.teacher_id == current_user.id,
        )
    )
    if not link:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas assigné à cette formation.")

    formation = db.get(FormationRecord, formation_id)
    if not formation:
        raise HTTPException(status_code=404, detail="Formation introuvable.")

    sessions = db.scalars(
        select(FormationSessionRecord)
        .where(
            FormationSessionRecord.formation_id == formation_id,
            FormationSessionRecord.teacher_name == current_user.full_name,
        )
        .order_by(FormationSessionRecord.start_date.asc())
    ).all()
    return [_serialize_session(db, s, formation) for s in sessions]


# ── Live events (séances individuelles) ───────────────────────────────────────

def _get_session_for_teacher_by_id(db: Session, session_id: int, teacher_name: str) -> FormationSessionRecord:
    session = db.get(FormationSessionRecord, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session introuvable.")
    if session.teacher_name != teacher_name:
        raise HTTPException(status_code=403, detail="Cette session ne vous est pas assignée.")
    return session


def _serialize_live_event(e: SessionLiveEventRecord) -> LiveEventView:
    return LiveEventView(
        id=e.id,
        session_id=e.session_id,
        title=e.title,
        scheduled_at=e.scheduled_at,
        duration_minutes=e.duration_minutes,
        status=e.status,  # type: ignore[arg-type]
        created_at=e.created_at,
    )


def _course_day_status_from_live_event(status_value: str) -> str:
    return {
        "scheduled": "planned",
        "live": "live",
        "done": "done",
        "cancelled": "cancelled",
    }.get(status_value, "planned")


def _sync_course_day_for_live_event(db: Session, event: SessionLiveEventRecord) -> None:
    course_day = db.scalar(
        select(SessionCourseDayRecord).where(SessionCourseDayRecord.live_event_id == event.id)
    )
    status_value = _course_day_status_from_live_event(event.status)
    if course_day:
        course_day.title = event.title
        course_day.scheduled_at = event.scheduled_at
        course_day.duration_minutes = event.duration_minutes
        course_day.status = status_value
        db.add(course_day)
        return
    db.add(SessionCourseDayRecord(
        session_id=event.session_id,
        live_event_id=event.id,
        title=event.title,
        scheduled_at=event.scheduled_at,
        duration_minutes=event.duration_minutes,
        status=status_value,
    ))


@router.get("/teacher/sessions/{session_id}/live-events", response_model=list[LiveEventView])
def list_live_events(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("teacher")),
) -> list[LiveEventView]:
    _get_session_for_teacher_by_id(db, session_id, current_user.full_name)
    events = db.scalars(
        select(SessionLiveEventRecord)
        .where(SessionLiveEventRecord.session_id == session_id)
        .order_by(SessionLiveEventRecord.scheduled_at)
    ).all()
    return [_serialize_live_event(e) for e in events]


@router.post("/teacher/sessions/{session_id}/live-events", response_model=LiveEventView, status_code=201)
def create_live_event(
    session_id: int,
    payload: LiveEventCreate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("teacher")),
) -> LiveEventView:
    session = _get_session_for_teacher_by_id(db, session_id, current_user.full_name)
    try:
        validate_live_event_in_session(session, payload.scheduled_at)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    event = SessionLiveEventRecord(
        session_id=session_id,
        title=payload.title,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        status="scheduled",
    )
    db.add(event)
    db.flush()
    _sync_course_day_for_live_event(db, event)
    db.commit()
    db.refresh(event)
    return _serialize_live_event(event)


@router.patch("/teacher/live-events/{event_id}", response_model=LiveEventView)
def update_live_event(
    event_id: int,
    payload: LiveEventUpdate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("teacher")),
) -> LiveEventView:
    event = db.get(SessionLiveEventRecord, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Séance introuvable.")
    session = _get_session_for_teacher_by_id(db, event.session_id, current_user.full_name)
    if payload.title is not None:
        event.title = payload.title
    if payload.scheduled_at is not None:
        try:
            validate_live_event_in_session(session, payload.scheduled_at)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        event.scheduled_at = payload.scheduled_at
    if payload.duration_minutes is not None:
        event.duration_minutes = payload.duration_minutes
    if payload.status is not None:
        event.status = payload.status
    db.add(event)
    db.flush()
    _sync_course_day_for_live_event(db, event)
    db.commit()
    db.refresh(event)
    return _serialize_live_event(event)


@router.delete("/teacher/live-events/{event_id}", status_code=204)
def delete_live_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(require_roles("teacher")),
) -> None:
    event = db.get(SessionLiveEventRecord, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Séance introuvable.")
    _get_session_for_teacher_by_id(db, event.session_id, current_user.full_name)
    course_day = db.scalar(
        select(SessionCourseDayRecord).where(SessionCourseDayRecord.live_event_id == event.id)
    )
    if course_day:
        course_day.live_event_id = None
        course_day.status = "cancelled"
        db.add(course_day)
    db.delete(event)
    db.commit()


# ── Live room access ───────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/room", response_model=LiveRoomInfo)
def get_live_room(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> LiveRoomInfo:
    session = db.get(FormationSessionRecord, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session introuvable.")

    formation = db.get(FormationRecord, session.formation_id)
    if not formation:
        raise HTTPException(status_code=404, detail="Formation introuvable.")

    if formation.format_type != "live":
        raise HTTPException(status_code=400, detail="Cette session n'est pas une session live.")

    if not session.meeting_link:
        raise HTTPException(status_code=404, detail="Aucun lien de réunion configuré pour cette session.")

    # Access control: enrolled student OR assigned teacher OR admin
    if current_user.role == "admin":
        pass  # admin always allowed
    elif current_user.role == "teacher":
        if session.teacher_name != current_user.full_name:
            raise HTTPException(status_code=403, detail="Cette session ne vous est pas assignée.")
    else:
        enrollment = db.scalar(
            select(EnrollmentRecord).where(
                EnrollmentRecord.session_id == session_id,
                EnrollmentRecord.user_id == current_user.id,
                EnrollmentRecord.status.in_(("active", "completed")),
            )
        )
        if not enrollment:
            raise HTTPException(status_code=403, detail="Vous n'êtes pas inscrit à cette session.")

    jitsi_room = extract_jitsi_room_name(session.meeting_link)
    if not jitsi_room:
        raise HTTPException(status_code=400, detail="Lien Jitsi invalide pour cette session.")

    return LiveRoomInfo(
        session_id=session.id,
        formation_title=formation.title,
        label=session.label,
        format_type=formation.format_type,
        start_date=session.start_date,
        end_date=session.end_date,
        teacher_name=session.teacher_name,
        meeting_link=session.meeting_link,
        jitsi_room=jitsi_room,
    )
