from datetime import UTC, datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.entities import (
    AssignmentRecord,
    AssignmentSubmissionRecord,
    AttendanceRecord,
    ChapterRecord,
    CourseRecord,
    EnrollmentRecord,
    FormationRecord,
    FormationSessionRecord,
    GradeRecord,
    LessonProgressRecord,
    LessonRecord,
    QuizAttemptRecord,
    QuizRecord,
    UserRecord,
)
from app.schemas.teacher import (
    TeacherOverview,
    TeacherPerformanceAlert,
    TeacherPerformanceKpi,
    TeacherPerformanceOverview,
    TeacherPerformanceSessionRow,
    TeacherPerformanceStudentRow,
    TeacherSessionItem,
)
from app.services.teacher_codes import ensure_teacher_profile

ACTIVE_ENROLLMENT_STATUSES = ("active", "completed")


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _pct(numerator: float | int | None, denominator: float | int | None) -> float:
    if not denominator:
        return 0.0
    return round((float(numerator or 0) / float(denominator)) * 100, 1)


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
                    EnrollmentRecord.status.in_(ACTIVE_ENROLLMENT_STATUSES),
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


def _teacher_session_records(
    db: Session,
    user: UserRecord,
) -> list[tuple[FormationSessionRecord, FormationRecord]]:
    return db.execute(
        select(FormationSessionRecord, FormationRecord)
        .join(FormationRecord, FormationSessionRecord.formation_id == FormationRecord.id)
        .where(FormationSessionRecord.teacher_name == user.full_name)
        .order_by(FormationSessionRecord.start_date.asc(), FormationSessionRecord.id.asc())
    ).all()


def _average_grade_pct(scores: list[tuple[float, float]]) -> float | None:
    valid = [round((score / max_score) * 100, 1) for score, max_score in scores if max_score > 0]
    if not valid:
        return None
    return round(sum(valid) / len(valid), 1)


def _student_risk_level(
    progress_pct: float,
    attendance_rate_pct: float | None,
    average_grade_pct: float | None,
    pending_reviews_count: int,
) -> str:
    if (
        progress_pct < 25
        or (attendance_rate_pct is not None and attendance_rate_pct < 60)
        or (average_grade_pct is not None and average_grade_pct < 45)
    ):
        return "danger"
    if (
        progress_pct < 55
        or (attendance_rate_pct is not None and attendance_rate_pct < 80)
        or (average_grade_pct is not None and average_grade_pct < 60)
        or pending_reviews_count > 0
    ):
        return "warning"
    if (
        progress_pct >= 80
        and (attendance_rate_pct is None or attendance_rate_pct >= 90)
        and (average_grade_pct is None or average_grade_pct >= 70)
    ):
        return "good"
    return "neutral"


def get_teacher_performance(db: Session, user: UserRecord) -> TeacherPerformanceOverview:
    session_rows = _teacher_session_records(db, user)
    session_ids = [session.id for session, _formation in session_rows]
    now = _utc_now()

    if not session_ids:
        return TeacherPerformanceOverview(
            generated_at=now,
            kpis=[
                TeacherPerformanceKpi(
                    label="Sessions actives",
                    value="0",
                    detail="Aucune session ne vous est encore assignee.",
                    tone="warning",
                ),
                TeacherPerformanceKpi(
                    label="Etudiants suivis",
                    value="0",
                    detail="Vos cohortes apparaitront ici une fois assignees.",
                    tone="neutral",
                ),
                TeacherPerformanceKpi(
                    label="Presence moyenne",
                    value="—",
                    detail="Aucune presence n'est encore disponible.",
                    tone="neutral",
                ),
                TeacherPerformanceKpi(
                    label="Corrections en attente",
                    value="0",
                    detail="Aucun rendu a corriger pour le moment.",
                    tone="good",
                ),
            ],
            sessions=[],
            students=[],
            alerts=[
                TeacherPerformanceAlert(
                    code="no_sessions",
                    title="Aucune session assignee",
                    detail="Vos indicateurs de performance apparaitront des qu'une cohorte vous sera attribuee.",
                    tone="neutral",
                    action_label="Sessions",
                    action_path="/espace/enseignant/sessions",
                )
            ],
        )

    enrollment_counts_by_session = {
        int(session_id): int(count)
        for session_id, count in db.execute(
            select(EnrollmentRecord.session_id, func.count(EnrollmentRecord.id))
            .where(
                EnrollmentRecord.session_id.in_(session_ids),
                EnrollmentRecord.status.in_(ACTIVE_ENROLLMENT_STATUSES),
            )
            .group_by(EnrollmentRecord.session_id)
        ).all()
        if session_id is not None
    }
    attendance_rates_by_session = {
        int(session_id): _pct(attended_count or 0, total_count or 0)
        for session_id, total_count, attended_count in db.execute(
            select(
                AttendanceRecord.session_id,
                func.count(AttendanceRecord.id),
                func.sum(
                    case(
                        (AttendanceRecord.status.in_(("present", "late")), 1),
                        else_=0,
                    )
                ),
            )
            .where(AttendanceRecord.session_id.in_(session_ids))
            .group_by(AttendanceRecord.session_id)
        ).all()
    }
    pending_reviews_by_session = {
        int(session_id): int(count)
        for session_id, count in db.execute(
            select(AssignmentRecord.session_id, func.count(AssignmentSubmissionRecord.id))
            .join(AssignmentRecord, AssignmentRecord.id == AssignmentSubmissionRecord.assignment_id)
            .where(
                AssignmentRecord.session_id.in_(session_ids),
                AssignmentSubmissionRecord.is_reviewed.is_(False),
            )
            .group_by(AssignmentRecord.session_id)
        ).all()
    }
    quiz_score_by_session = {
        int(session_id): round(float(score), 1)
        for session_id, score in db.execute(
            select(QuizRecord.session_id, func.avg(QuizAttemptRecord.score_pct))
            .join(QuizRecord, QuizRecord.id == QuizAttemptRecord.quiz_id)
            .where(QuizRecord.session_id.in_(session_ids))
            .group_by(QuizRecord.session_id)
        ).all()
        if score is not None
    }
    lesson_counts_by_session = {
        int(session_id): int(count)
        for session_id, count in db.execute(
            select(CourseRecord.session_id, func.count(LessonRecord.id))
            .join(ChapterRecord, ChapterRecord.course_id == CourseRecord.id)
            .join(LessonRecord, LessonRecord.chapter_id == ChapterRecord.id)
            .where(CourseRecord.session_id.in_(session_ids))
            .group_by(CourseRecord.session_id)
        ).all()
    }

    enrollments = db.scalars(
        select(EnrollmentRecord).where(
            EnrollmentRecord.session_id.in_(session_ids),
            EnrollmentRecord.status.in_(ACTIVE_ENROLLMENT_STATUSES),
        )
    ).all()
    enrollment_ids = [enrollment.id for enrollment in enrollments]
    possible_lessons = sum(
        lesson_counts_by_session.get(int(enrollment.session_id or 0), 0)
        for enrollment in enrollments
    )
    completed_lessons = int(
        db.scalar(
            select(func.count(LessonProgressRecord.id)).where(
                LessonProgressRecord.enrollment_id.in_(enrollment_ids)
            )
        )
        or 0
    ) if enrollment_ids else 0
    average_progress_pct = _pct(completed_lessons, possible_lessons)

    progress_by_enrollment = {
        int(enrollment_id): int(count)
        for enrollment_id, count in db.execute(
            select(LessonProgressRecord.enrollment_id, func.count(LessonProgressRecord.id))
            .where(LessonProgressRecord.enrollment_id.in_(enrollment_ids))
            .group_by(LessonProgressRecord.enrollment_id)
        ).all()
    } if enrollment_ids else {}
    attendance_by_enrollment = {
        int(enrollment_id): {
            "total": int(total_count or 0),
            "attended": int(attended_count or 0),
        }
        for enrollment_id, total_count, attended_count in db.execute(
            select(
                AttendanceRecord.enrollment_id,
                func.count(AttendanceRecord.id),
                func.sum(
                    case(
                        (AttendanceRecord.status.in_(("present", "late")), 1),
                        else_=0,
                    )
                ),
            )
            .where(AttendanceRecord.enrollment_id.in_(enrollment_ids))
            .group_by(AttendanceRecord.enrollment_id)
        ).all()
    } if enrollment_ids else {}
    grade_rows = db.execute(
        select(GradeRecord.enrollment_id, GradeRecord.score, GradeRecord.max_score)
        .where(GradeRecord.enrollment_id.in_(enrollment_ids))
    ).all() if enrollment_ids else []
    grades_by_enrollment: dict[int, list[tuple[float, float]]] = {}
    for enrollment_id, score, max_score in grade_rows:
        grades_by_enrollment.setdefault(int(enrollment_id), []).append((float(score), float(max_score)))
    submission_by_enrollment = {
        int(enrollment_id): {
            "total": int(total_count or 0),
            "pending": int(pending_count or 0),
        }
        for enrollment_id, total_count, pending_count in db.execute(
            select(
                AssignmentSubmissionRecord.enrollment_id,
                func.count(AssignmentSubmissionRecord.id),
                func.sum(
                    case(
                        (AssignmentSubmissionRecord.is_reviewed.is_(False), 1),
                        else_=0,
                    )
                ),
            )
            .join(AssignmentRecord, AssignmentRecord.id == AssignmentSubmissionRecord.assignment_id)
            .where(
                AssignmentRecord.session_id.in_(session_ids),
                AssignmentSubmissionRecord.enrollment_id.in_(enrollment_ids),
            )
            .group_by(AssignmentSubmissionRecord.enrollment_id)
        ).all()
    } if enrollment_ids else {}
    attendance_last_by_enrollment = {
        int(enrollment_id): updated_at
        for enrollment_id, updated_at in db.execute(
            select(AttendanceRecord.enrollment_id, func.max(AttendanceRecord.updated_at))
            .where(AttendanceRecord.enrollment_id.in_(enrollment_ids))
            .group_by(AttendanceRecord.enrollment_id)
        ).all()
        if updated_at is not None
    } if enrollment_ids else {}
    grades_last_by_enrollment = {
        int(enrollment_id): updated_at
        for enrollment_id, updated_at in db.execute(
            select(GradeRecord.enrollment_id, func.max(GradeRecord.updated_at))
            .where(GradeRecord.enrollment_id.in_(enrollment_ids))
            .group_by(GradeRecord.enrollment_id)
        ).all()
        if updated_at is not None
    } if enrollment_ids else {}
    submissions_last_by_enrollment = {
        int(enrollment_id): updated_at
        for enrollment_id, updated_at in db.execute(
            select(AssignmentSubmissionRecord.enrollment_id, func.max(AssignmentSubmissionRecord.updated_at))
            .where(AssignmentSubmissionRecord.enrollment_id.in_(enrollment_ids))
            .group_by(AssignmentSubmissionRecord.enrollment_id)
        ).all()
        if updated_at is not None
    } if enrollment_ids else {}
    progress_last_by_enrollment = {
        int(enrollment_id): completed_at
        for enrollment_id, completed_at in db.execute(
            select(LessonProgressRecord.enrollment_id, func.max(LessonProgressRecord.completed_at))
            .where(LessonProgressRecord.enrollment_id.in_(enrollment_ids))
            .group_by(LessonProgressRecord.enrollment_id)
        ).all()
        if completed_at is not None
    } if enrollment_ids else {}

    sessions: list[TeacherPerformanceSessionRow] = []
    for session, formation in session_rows:
        enrolled_count = enrollment_counts_by_session.get(session.id, 0)
        fill_rate_pct = _pct(enrolled_count, session.seat_capacity)
        attendance_rate_pct = attendance_rates_by_session.get(session.id)
        pending_reviews_count = pending_reviews_by_session.get(session.id, 0)
        progress_values = []
        for enrollment in enrollments:
            if enrollment.session_id != session.id:
                continue
            total_lessons = lesson_counts_by_session.get(session.id, 0)
            progress_values.append(_pct(progress_by_enrollment.get(enrollment.id, 0), total_lessons))
        progress_pct = round(sum(progress_values) / len(progress_values), 1) if progress_values else 0.0
        alert_level = "good"
        if pending_reviews_count > 0 or (attendance_rate_pct is not None and attendance_rate_pct < 60):
            alert_level = "danger"
        elif progress_pct < 50 or (attendance_rate_pct is not None and attendance_rate_pct < 80):
            alert_level = "warning"
        elif fill_rate_pct == 0:
            alert_level = "neutral"
        sessions.append(
            TeacherPerformanceSessionRow(
                session_id=session.id,
                formation_title=formation.title,
                session_label=session.label,
                status=session.status,
                enrolled_count=enrolled_count,
                seat_capacity=session.seat_capacity,
                fill_rate_pct=fill_rate_pct,
                attendance_rate_pct=attendance_rate_pct,
                progress_pct=progress_pct,
                pending_reviews_count=pending_reviews_count,
                quiz_average_score_pct=quiz_score_by_session.get(session.id),
                alert_level=alert_level,
            )
        )

    student_rows = db.execute(
        select(EnrollmentRecord, UserRecord, FormationRecord, FormationSessionRecord)
        .join(UserRecord, UserRecord.id == EnrollmentRecord.user_id)
        .join(FormationRecord, FormationRecord.id == EnrollmentRecord.formation_id)
        .join(FormationSessionRecord, FormationSessionRecord.id == EnrollmentRecord.session_id)
        .where(
            EnrollmentRecord.session_id.in_(session_ids),
            EnrollmentRecord.status.in_(ACTIVE_ENROLLMENT_STATUSES),
        )
        .order_by(UserRecord.full_name.asc(), FormationRecord.title.asc())
    ).all()
    students: list[TeacherPerformanceStudentRow] = []
    for enrollment, student, formation, session in student_rows:
        total_lessons = lesson_counts_by_session.get(session.id, 0)
        progress_pct = _pct(progress_by_enrollment.get(enrollment.id, 0), total_lessons)
        attendance_stats = attendance_by_enrollment.get(enrollment.id)
        attendance_rate_pct = (
            _pct(attendance_stats["attended"], attendance_stats["total"])
            if attendance_stats and attendance_stats["total"] > 0
            else None
        )
        average_grade_pct = _average_grade_pct(grades_by_enrollment.get(enrollment.id, []))
        submission_stats = submission_by_enrollment.get(enrollment.id, {"total": 0, "pending": 0})
        last_activity_candidates = [
            enrollment.updated_at,
            attendance_last_by_enrollment.get(enrollment.id),
            grades_last_by_enrollment.get(enrollment.id),
            submissions_last_by_enrollment.get(enrollment.id),
            progress_last_by_enrollment.get(enrollment.id),
        ]
        students.append(
            TeacherPerformanceStudentRow(
                enrollment_id=enrollment.id,
                student_name=student.full_name,
                student_code=student.student_code,
                session_id=session.id,
                session_label=session.label,
                formation_title=formation.title,
                progress_pct=progress_pct,
                attendance_rate_pct=attendance_rate_pct,
                average_grade_pct=average_grade_pct,
                pending_reviews_count=int(submission_stats["pending"]),
                last_activity_at=max(
                    (item for item in last_activity_candidates if item is not None),
                    default=None,
                ),
                risk_level=_student_risk_level(
                    progress_pct=progress_pct,
                    attendance_rate_pct=attendance_rate_pct,
                    average_grade_pct=average_grade_pct,
                    pending_reviews_count=int(submission_stats["pending"]),
                ),
            )
        )

    students.sort(
        key=lambda item: (
            {"danger": 0, "warning": 1, "neutral": 2, "good": 3}[item.risk_level],
            item.progress_pct,
            item.student_name.lower(),
        )
    )

    active_sessions_count = sum(1 for session, _formation in session_rows if session.status == "open")
    total_students_count = sum(enrollment_counts_by_session.values())
    attendance_values = list(attendance_rates_by_session.values())
    average_attendance_pct = round(sum(attendance_values) / len(attendance_values), 1) if attendance_values else 0.0
    pending_reviews_total = sum(pending_reviews_by_session.values())

    kpis = [
        TeacherPerformanceKpi(
            label="Sessions actives",
            value=str(active_sessions_count),
            detail=f"{len(session_rows)} session(s) suivie(s) au total",
            tone="good" if active_sessions_count > 0 else "warning",
        ),
        TeacherPerformanceKpi(
            label="Etudiants suivis",
            value=str(total_students_count),
            detail=f"{sum(1 for item in students if item.risk_level == 'danger')} etudiant(s) a relancer en priorite",
            tone="good" if total_students_count > 0 else "warning",
        ),
        TeacherPerformanceKpi(
            label="Presence moyenne",
            value=f"{average_attendance_pct}%" if attendance_values else "—",
            detail=f"{sum(1 for item in sessions if item.attendance_rate_pct is not None and item.attendance_rate_pct < 70)} session(s) sous 70%",
            tone="good" if average_attendance_pct >= 85 else "warning" if attendance_values else "neutral",
        ),
        TeacherPerformanceKpi(
            label="Corrections en attente",
            value=str(pending_reviews_total),
            detail=f"Progression moyenne: {average_progress_pct}%",
            tone="danger" if pending_reviews_total > 0 else "good",
        ),
    ]

    alerts: list[TeacherPerformanceAlert] = []
    if pending_reviews_total > 0:
        alerts.append(
            TeacherPerformanceAlert(
                code="pending_reviews",
                title="Corrections a finaliser",
                detail=f"{pending_reviews_total} rendu(s) attendent encore votre correction.",
                tone="danger",
                action_label="Devoirs",
                action_path="/espace/enseignant/devoirs",
            )
        )
    risky_students_count = sum(1 for item in students if item.risk_level == "danger")
    if risky_students_count > 0:
        alerts.append(
            TeacherPerformanceAlert(
                code="at_risk_students",
                title="Etudiants a relancer",
                detail=f"{risky_students_count} etudiant(s) affichent une progression ou une presence critique.",
                tone="warning",
                action_label="Performance",
                action_path="/espace/enseignant/performance",
            )
        )
    low_attendance_sessions_count = sum(
        1
        for item in sessions
        if item.attendance_rate_pct is not None and item.attendance_rate_pct < 70
    )
    if low_attendance_sessions_count > 0:
        alerts.append(
            TeacherPerformanceAlert(
                code="low_attendance",
                title="Presences faibles",
                detail=f"{low_attendance_sessions_count} session(s) sont sous 70% de presence moyenne.",
                tone="warning",
                action_label="Sessions",
                action_path="/espace/enseignant/sessions",
            )
        )
    if not alerts:
        alerts.append(
            TeacherPerformanceAlert(
                code="healthy",
                title="Aucun blocage critique",
                detail="Vos sessions ne presentent pas d'alerte majeure a ce stade.",
                tone="good",
                action_label="Vue",
                action_path="/espace/enseignant",
            )
        )

    return TeacherPerformanceOverview(
        generated_at=now,
        kpis=kpis,
        sessions=sessions,
        students=students,
        alerts=alerts,
    )
