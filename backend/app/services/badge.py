"""Badge progression logic.

Badges represent a student's skill progression within one enrollment/session.
They combine lesson progress, assignments, quizzes, live attendance, grades and
final project validation. The legacy helpers are kept for older call sites, but
student course views should use ``compute_enrollment_badge_progress``.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from math import ceil

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    AssignmentRecord,
    AssignmentSubmissionRecord,
    AttendanceRecord,
    EnrollmentRecord,
    GradeRecord,
    QuizAttemptRecord,
    QuizRecord,
    SessionCourseDayRecord,
)

# Ordered list: (level_key, min_progress_pct)
BADGE_LEVELS: list[tuple[str, float]] = [
    ("aventurier",    0.0),
    ("debutant",      25.0),
    ("intermediaire", 50.0),
    ("semi_pro",      75.0),
    ("professionnel", 100.0),
]

# Range boundaries for ring computation (lower bound per level)
_LOWER: dict[str, float] = {
    "aventurier":    0.0,
    "debutant":      25.0,
    "intermediaire": 50.0,
    "semi_pro":      75.0,
    "professionnel": 100.0,
}
_UPPER: dict[str, float] = {
    "aventurier":    25.0,
    "debutant":      50.0,
    "intermediaire": 75.0,
    "semi_pro":      100.0,
    "professionnel": 100.0,
}

BADGE_LABELS: dict[str, str] = {
    "aventurier":    "Aventurier",
    "debutant":      "Débutant",
    "intermediaire": "Intermédiaire",
    "semi_pro":      "Semi-pro",
    "professionnel": "Professionnel",
}

BADGE_IMAGES: dict[str, str] = {
    "aventurier":    "/Badges/bg-avanturier.svg",
    "debutant":      "/Badges/bg-debutant.svg",
    "intermediaire": "/Badges/bg-interm%C3%A9diare.svg",
    "semi_pro":      "/Badges/bg-semi-pro.svg",
    "professionnel": "/Badges/bg-professionnel.svg",
}

NEXT_BADGE: dict[str, str] = {
    "aventurier":    "debutant",
    "debutant":      "intermediaire",
    "intermediaire": "semi_pro",
    "semi_pro":      "professionnel",
}

PASSING_QUIZ_PCT = 80.0
FINAL_PROJECT_PCT = 80.0


@dataclass(frozen=True)
class BadgeStats:
    total_lessons: int
    completed_lessons: int
    lesson_progress_pct: float
    available_assignments: int = 0
    submitted_assignments: int = 0
    available_quizzes: int = 0
    attempted_quizzes: int = 0
    passed_quizzes: int = 0
    past_course_days: int = 0
    attended_course_days: int = 0
    grade_average_pct: float | None = None
    final_project_validated: bool = False


@dataclass(frozen=True)
class BadgeProgress:
    level: str
    ring_pct: float
    hint: str | None
    final_project_validated: bool
    grade_average_pct: float | None


def _ratio(done: float, required: float) -> float:
    if required <= 0:
        return 1.0
    return max(0.0, min(1.0, done / required))


def _required_count(total: int, pct: float) -> int:
    return max(1, ceil(total * pct / 100))


def _done_pct(done: int, total: int) -> float:
    if total <= 0:
        return 100.0
    return round(done / total * 100, 1)


def _has_lessons(stats: BadgeStats) -> bool:
    return stats.total_lessons > 0


def _meets_debutant(stats: BadgeStats) -> bool:
    if not _has_lessons(stats) or stats.lesson_progress_pct < 25:
        return False
    if stats.available_assignments > 0 and stats.submitted_assignments < 1:
        return False
    if stats.available_quizzes > 0 and stats.attempted_quizzes < 1:
        return False
    if stats.past_course_days > 0 and stats.attended_course_days < 1:
        return False
    return True


def _meets_intermediaire(stats: BadgeStats) -> bool:
    if not _has_lessons(stats) or stats.lesson_progress_pct < 50:
        return False
    if stats.available_assignments > 0 and stats.submitted_assignments < _required_count(stats.available_assignments, 50):
        return False
    if stats.available_quizzes > 0 and stats.passed_quizzes < _required_count(stats.available_quizzes, 50):
        return False
    if stats.past_course_days > 0 and stats.attended_course_days < _required_count(stats.past_course_days, 50):
        return False
    if stats.grade_average_pct is not None and stats.grade_average_pct < 50:
        return False
    return True


def _meets_semi_pro(stats: BadgeStats) -> bool:
    if not _has_lessons(stats) or stats.lesson_progress_pct < 75:
        return False
    if stats.available_assignments > 0 and stats.submitted_assignments < _required_count(stats.available_assignments, 75):
        return False
    if stats.available_quizzes > 0 and stats.passed_quizzes < _required_count(stats.available_quizzes, 70):
        return False
    if stats.past_course_days > 0 and stats.attended_course_days < _required_count(stats.past_course_days, 70):
        return False
    if stats.grade_average_pct is not None and stats.grade_average_pct < 60:
        return False
    return True


def _meets_professionnel(stats: BadgeStats) -> bool:
    if not _has_lessons(stats) or stats.lesson_progress_pct < 100:
        return False
    if stats.available_assignments > 0 and stats.submitted_assignments < stats.available_assignments:
        return False
    if stats.available_quizzes > 0 and stats.passed_quizzes < _required_count(stats.available_quizzes, 80):
        return False
    if stats.past_course_days > 0 and stats.attended_course_days < _required_count(stats.past_course_days, 80):
        return False
    if not stats.final_project_validated:
        return False
    if stats.grade_average_pct is not None and stats.grade_average_pct < 80:
        return False
    return True


_REQUIREMENT_CHECKS = {
    "debutant": _meets_debutant,
    "intermediaire": _meets_intermediaire,
    "semi_pro": _meets_semi_pro,
    "professionnel": _meets_professionnel,
}


def _requirement_ratios(level: str, stats: BadgeStats) -> list[float]:
    if level == "debutant":
        ratios = [_ratio(stats.lesson_progress_pct, 25)]
        if stats.available_assignments > 0:
            ratios.append(_ratio(stats.submitted_assignments, 1))
        if stats.available_quizzes > 0:
            ratios.append(_ratio(stats.attempted_quizzes, 1))
        if stats.past_course_days > 0:
            ratios.append(_ratio(stats.attended_course_days, 1))
        return ratios

    if level == "intermediaire":
        ratios = [_ratio(stats.lesson_progress_pct, 50)]
        if stats.available_assignments > 0:
            ratios.append(_ratio(stats.submitted_assignments, _required_count(stats.available_assignments, 50)))
        if stats.available_quizzes > 0:
            ratios.append(_ratio(stats.passed_quizzes, _required_count(stats.available_quizzes, 50)))
        if stats.past_course_days > 0:
            ratios.append(_ratio(stats.attended_course_days, _required_count(stats.past_course_days, 50)))
        if stats.grade_average_pct is not None:
            ratios.append(_ratio(stats.grade_average_pct, 50))
        return ratios

    if level == "semi_pro":
        ratios = [_ratio(stats.lesson_progress_pct, 75)]
        if stats.available_assignments > 0:
            ratios.append(_ratio(stats.submitted_assignments, _required_count(stats.available_assignments, 75)))
        if stats.available_quizzes > 0:
            ratios.append(_ratio(stats.passed_quizzes, _required_count(stats.available_quizzes, 70)))
        if stats.past_course_days > 0:
            ratios.append(_ratio(stats.attended_course_days, _required_count(stats.past_course_days, 70)))
        if stats.grade_average_pct is not None:
            ratios.append(_ratio(stats.grade_average_pct, 60))
        return ratios

    if level == "professionnel":
        ratios = [_ratio(stats.lesson_progress_pct, 100)]
        if stats.available_assignments > 0:
            ratios.append(_ratio(stats.submitted_assignments, stats.available_assignments))
        if stats.available_quizzes > 0:
            ratios.append(_ratio(stats.passed_quizzes, _required_count(stats.available_quizzes, 80)))
        if stats.past_course_days > 0:
            ratios.append(_ratio(stats.attended_course_days, _required_count(stats.past_course_days, 80)))
        ratios.append(1.0 if stats.final_project_validated else 0.0)
        if stats.grade_average_pct is not None:
            ratios.append(_ratio(stats.grade_average_pct, 80))
        return ratios

    return [0.0]


def _readiness_pct(level: str, stats: BadgeStats) -> float:
    ratios = _requirement_ratios(level, stats)
    if not ratios:
        return 0.0
    return round(sum(ratios) / len(ratios) * 100, 1)


def _missing_for(level: str, stats: BadgeStats) -> list[str]:
    missing: list[str] = []

    if level == "debutant":
        if not _has_lessons(stats):
            missing.append("le programme de cours doit être publié")
        elif stats.lesson_progress_pct < 25:
            missing.append("atteignez 25% de leçons terminées")
        if stats.available_assignments > 0 and stats.submitted_assignments < 1:
            missing.append("rendez au moins 1 devoir")
        if stats.available_quizzes > 0 and stats.attempted_quizzes < 1:
            missing.append("tentez au moins 1 quiz")
        if stats.past_course_days > 0 and stats.attended_course_days < 1:
            missing.append("assistez à au moins 1 cours live")
        return missing

    if level == "intermediaire":
        if not _has_lessons(stats):
            missing.append("le programme de cours doit être publié")
        elif stats.lesson_progress_pct < 50:
            missing.append("atteignez 50% de leçons terminées")
        if stats.available_assignments > 0:
            required = _required_count(stats.available_assignments, 50)
            if stats.submitted_assignments < required:
                missing.append(f"rendez {required} devoir(s) sur {stats.available_assignments}")
        if stats.available_quizzes > 0:
            required = _required_count(stats.available_quizzes, 50)
            if stats.passed_quizzes < required:
                missing.append(f"réussissez {required} quiz sur {stats.available_quizzes}")
        if stats.past_course_days > 0:
            required = _required_count(stats.past_course_days, 50)
            if stats.attended_course_days < required:
                missing.append(f"validez {required} présence(s) live sur {stats.past_course_days}")
        if stats.grade_average_pct is not None and stats.grade_average_pct < 50:
            missing.append("obtenez une moyenne d’au moins 10/20")
        return missing

    if level == "semi_pro":
        if not _has_lessons(stats):
            missing.append("le programme de cours doit être publié")
        elif stats.lesson_progress_pct < 75:
            missing.append("atteignez 75% de leçons terminées")
        if stats.available_assignments > 0:
            required = _required_count(stats.available_assignments, 75)
            if stats.submitted_assignments < required:
                missing.append(f"rendez {required} devoir(s) sur {stats.available_assignments}")
        if stats.available_quizzes > 0:
            required = _required_count(stats.available_quizzes, 70)
            if stats.passed_quizzes < required:
                missing.append(f"réussissez {required} quiz sur {stats.available_quizzes}")
        if stats.past_course_days > 0:
            required = _required_count(stats.past_course_days, 70)
            if stats.attended_course_days < required:
                missing.append(f"validez {required} présence(s) live sur {stats.past_course_days}")
        if stats.grade_average_pct is not None and stats.grade_average_pct < 60:
            missing.append("obtenez une moyenne d’au moins 12/20")
        return missing

    if level == "professionnel":
        if not _has_lessons(stats):
            missing.append("le programme de cours doit être publié")
        elif stats.lesson_progress_pct < 100:
            missing.append("terminez 100% des leçons")
        if stats.available_assignments > 0 and stats.submitted_assignments < stats.available_assignments:
            missing.append(f"rendez tous les devoirs ({stats.submitted_assignments}/{stats.available_assignments})")
        if stats.available_quizzes > 0:
            required = _required_count(stats.available_quizzes, 80)
            if stats.passed_quizzes < required:
                missing.append(f"réussissez {required} quiz sur {stats.available_quizzes}")
        if stats.past_course_days > 0:
            required = _required_count(stats.past_course_days, 80)
            if stats.attended_course_days < required:
                missing.append(f"validez {required} présence(s) live sur {stats.past_course_days}")
        if not stats.final_project_validated:
            missing.append("validez le projet final avec au moins 80%")
        if stats.grade_average_pct is not None and stats.grade_average_pct < 80:
            missing.append("obtenez une moyenne finale d’au moins 16/20")
        return missing

    return missing


def compute_badge_from_stats(stats: BadgeStats) -> BadgeProgress:
    """Compute the badge using the complete competency model."""
    if _meets_professionnel(stats):
        level = "professionnel"
    elif _meets_semi_pro(stats):
        level = "semi_pro"
    elif _meets_intermediaire(stats):
        level = "intermediaire"
    elif _meets_debutant(stats):
        level = "debutant"
    else:
        level = "aventurier"

    next_level = NEXT_BADGE.get(level)
    if next_level is None:
        return BadgeProgress(
            level=level,
            ring_pct=100.0,
            hint=None,
            final_project_validated=stats.final_project_validated,
            grade_average_pct=stats.grade_average_pct,
        )

    ring_pct = _readiness_pct(next_level, stats)
    missing = _missing_for(next_level, stats)
    hint = (
        f"Pour atteindre le niveau {BADGE_LABELS[next_level]}, {missing[0]}."
        if missing else
        f"Continuez votre progression pour atteindre le niveau {BADGE_LABELS[next_level]}."
    )
    return BadgeProgress(
        level=level,
        ring_pct=ring_pct,
        hint=hint,
        final_project_validated=stats.final_project_validated,
        grade_average_pct=stats.grade_average_pct,
    )


def is_final_project_validated(
    db: Session,
    enrollment: EnrollmentRecord,
    session_id: int,
) -> bool:
    """True if any final project submission is reviewed with score >= 80%."""
    finals = db.scalars(
        select(AssignmentRecord).where(
            AssignmentRecord.session_id == session_id,
            AssignmentRecord.is_final_project.is_(True),
        )
    ).all()
    if not finals:
        return False

    for final in finals:
        sub = db.scalar(
            select(AssignmentSubmissionRecord).where(
                AssignmentSubmissionRecord.assignment_id == final.id,
                AssignmentSubmissionRecord.enrollment_id == enrollment.id,
                AssignmentSubmissionRecord.is_reviewed.is_(True),
            )
        )
        if sub is None or sub.review_score is None or sub.review_max_score <= 0:
            continue
        if (sub.review_score / sub.review_max_score * 100) >= FINAL_PROJECT_PCT:
            return True

    return False


def _available_standard_assignments(
    db: Session,
    session_id: int,
    now: datetime,
) -> list[AssignmentRecord]:
    return db.scalars(
        select(AssignmentRecord).where(
            AssignmentRecord.session_id == session_id,
            AssignmentRecord.is_final_project.is_(False),
            AssignmentRecord.due_date <= now,
        )
    ).all()


def _assignment_submission_count(
    db: Session,
    enrollment_id: int,
    assignment_ids: list[int],
) -> int:
    if not assignment_ids:
        return 0
    return len(db.scalars(
        select(AssignmentSubmissionRecord.id).where(
            AssignmentSubmissionRecord.enrollment_id == enrollment_id,
            AssignmentSubmissionRecord.assignment_id.in_(assignment_ids),
        )
    ).all())


def _quiz_counts(db: Session, enrollment_id: int, session_id: int) -> tuple[int, int, int]:
    quiz_ids = db.scalars(
        select(QuizRecord.id).where(
            QuizRecord.session_id == session_id,
            QuizRecord.status.in_(("active", "closed")),
        )
    ).all()
    if not quiz_ids:
        return 0, 0, 0

    attempts = db.scalars(
        select(QuizAttemptRecord).where(
            QuizAttemptRecord.enrollment_id == enrollment_id,
            QuizAttemptRecord.quiz_id.in_(quiz_ids),
        )
    ).all()
    best_by_quiz: dict[int, float] = {}
    for attempt in attempts:
        best_by_quiz[attempt.quiz_id] = max(
            best_by_quiz.get(attempt.quiz_id, 0.0),
            attempt.score_pct,
        )

    attempted = len(best_by_quiz)
    passed = sum(1 for score_pct in best_by_quiz.values() if score_pct >= PASSING_QUIZ_PCT)
    return len(quiz_ids), attempted, passed


def _attendance_counts(db: Session, enrollment_id: int, session_id: int, now: datetime) -> tuple[int, int]:
    course_day_ids = db.scalars(
        select(SessionCourseDayRecord.id).where(
            SessionCourseDayRecord.session_id == session_id,
            SessionCourseDayRecord.scheduled_at <= now,
            SessionCourseDayRecord.status != "cancelled",
        )
    ).all()
    if not course_day_ids:
        return 0, 0

    rows = db.scalars(
        select(AttendanceRecord).where(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.enrollment_id == enrollment_id,
            AttendanceRecord.course_day_id.in_(course_day_ids),
        )
    ).all()
    attended = sum(1 for row in rows if row.status in {"present", "late", "excused"})
    return len(course_day_ids), attended


def _grade_average_pct(db: Session, enrollment_id: int, session_id: int) -> float | None:
    grades = db.scalars(
        select(GradeRecord).where(
            GradeRecord.session_id == session_id,
            GradeRecord.enrollment_id == enrollment_id,
        )
    ).all()
    percentages = [
        max(0.0, min(100.0, grade.score / grade.max_score * 100))
        for grade in grades
        if grade.max_score > 0
    ]
    if not percentages:
        return None
    return round(sum(percentages) / len(percentages), 1)


def compute_enrollment_badge_progress(
    db: Session,
    enrollment: EnrollmentRecord,
    session_id: int,
    total_lessons: int,
    completed_lessons: int,
    lesson_progress_pct: float,
    *,
    now: datetime | None = None,
) -> BadgeProgress:
    """Build full badge progress for one enrollment/session."""
    current_time = now or datetime.now(UTC)
    standard_assignments = _available_standard_assignments(db, session_id, current_time)
    standard_assignment_ids = [assignment.id for assignment in standard_assignments]
    available_quizzes, attempted_quizzes, passed_quizzes = _quiz_counts(db, enrollment.id, session_id)
    past_course_days, attended_course_days = _attendance_counts(db, enrollment.id, session_id, current_time)

    stats = BadgeStats(
        total_lessons=total_lessons,
        completed_lessons=completed_lessons,
        lesson_progress_pct=lesson_progress_pct,
        available_assignments=len(standard_assignment_ids),
        submitted_assignments=_assignment_submission_count(db, enrollment.id, standard_assignment_ids),
        available_quizzes=available_quizzes,
        attempted_quizzes=attempted_quizzes,
        passed_quizzes=passed_quizzes,
        past_course_days=past_course_days,
        attended_course_days=attended_course_days,
        grade_average_pct=_grade_average_pct(db, enrollment.id, session_id),
        final_project_validated=is_final_project_validated(db, enrollment, session_id),
    )
    return compute_badge_from_stats(stats)


def compute_badge_level(progress_pct: float, final_validated: bool) -> str:
    """Return the current badge key. Aventurier is granted at enrollment."""
    if progress_pct >= 100 and final_validated:
        return "professionnel"
    if progress_pct >= 75:
        return "semi_pro"
    if progress_pct >= 50:
        return "intermediaire"
    if progress_pct >= 25:
        return "debutant"
    return "aventurier"


def compute_ring_pct(progress_pct: float, final_validated: bool) -> float:
    """Return 0–100: how far the ring is filled within the current badge range.
    Drives the SVG stroke-dashoffset animation on the frontend."""
    level = compute_badge_level(progress_pct, final_validated)
    if level == "professionnel":
        return 100.0

    lo = _LOWER[level]
    hi = _UPPER[level]
    span = hi - lo
    if span == 0:
        return 100.0

    # Special case: semi_pro at 100% but no final project yet → 90% ring fill
    if level == "semi_pro" and progress_pct >= 100:
        return 90.0

    return min(100.0, round((progress_pct - lo) / span * 100, 1))


def next_badge_hint(progress_pct: float, final_validated: bool) -> str | None:
    """Human-readable hint shown below the ring."""
    level = compute_badge_level(progress_pct, final_validated)
    if level == "professionnel":
        return None

    nxt = NEXT_BADGE.get(level)
    if nxt is None:
        return None

    if nxt == "professionnel":
        if progress_pct < 100:
            remaining = round(100 - progress_pct)
            return f"Plus que {remaining}% de leçons puis le projet final pour devenir Professionnel"
        return "Soumettez votre projet final pour devenir Professionnel"

    threshold = _LOWER[nxt]
    remaining = round(threshold - progress_pct)
    return f"Plus que {remaining}% pour atteindre le niveau {BADGE_LABELS[nxt]}"
