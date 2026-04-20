from datetime import date, datetime
import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

AttendanceStatus = Literal["present", "absent", "late", "excused"]
TeacherUserStatus = Literal["active", "suspended"]

PHONE_RE = re.compile(r"^\+[1-9]\d{7,14}$")


def normalize_optional_phone(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = re.sub(r"[\s().-]+", "", value.strip())
    if not normalized:
        return None
    if not PHONE_RE.fullmatch(normalized):
        raise ValueError("Numéro de téléphone invalide. Utilisez le format international, ex. +237600000000.")
    return normalized


# ── Teacher profile ────────────────────────────────────────────────────────────

class TeacherProfileUpdate(BaseModel):
    whatsapp: str | None = Field(default=None, max_length=32)
    nationality: str | None = Field(default=None, max_length=120)
    subject: str | None = Field(default=None, max_length=180)
    experience_years: int | None = Field(default=None, ge=0, le=60)
    portfolio_url: str | None = Field(default=None, max_length=512)
    bio: str | None = None

    @field_validator("whatsapp")
    @classmethod
    def validate_whatsapp(cls, v: str | None) -> str | None:
        return normalize_optional_phone(v)

    @field_validator("nationality", "subject", "portfolio_url")
    @classmethod
    def strip_strings(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else v


class TeacherProfileView(BaseModel):
    user_id: int
    full_name: str
    email: str
    teacher_code: str | None = None
    whatsapp: str | None = None
    nationality: str | None = None
    subject: str | None = None
    experience_years: int | None = None
    portfolio_url: str | None = None
    bio: str | None = None


# ── Teacher invitation ─────────────────────────────────────────────────────────

class TeacherInviteCreate(BaseModel):
    email: str = Field(min_length=3, max_length=180)
    full_name: str = Field(min_length=2, max_length=180)
    whatsapp: str | None = Field(default=None, max_length=32)
    nationality: str | None = Field(default=None, max_length=120)
    subject: str | None = Field(default=None, max_length=180)
    experience_years: int | None = Field(default=None, ge=0, le=60)
    portfolio_url: str | None = Field(default=None, max_length=512)
    bio: str | None = None

    @field_validator("email", "full_name")
    @classmethod
    def strip_fields(cls, v: str) -> str:
        return v.strip()

    @field_validator("whatsapp")
    @classmethod
    def validate_whatsapp(cls, v: str | None) -> str | None:
        return normalize_optional_phone(v)

    @field_validator("nationality", "subject", "portfolio_url", "bio")
    @classmethod
    def strip_optional_fields(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None


class TeacherInviteView(BaseModel):
    id: int
    token: str
    email: str
    full_name: str
    whatsapp: str | None = None
    nationality: str | None = None
    subject: str | None = None
    experience_years: int | None = None
    portfolio_url: str | None = None
    bio: str | None = None
    status: str
    expires_at: datetime
    created_at: datetime


class TeacherInviteAccept(BaseModel):
    password: str = Field(min_length=8, max_length=128)
    whatsapp: str | None = Field(default=None, max_length=32)
    nationality: str | None = Field(default=None, max_length=120)
    subject: str | None = Field(default=None, max_length=180)
    experience_years: int | None = Field(default=None, ge=0, le=60)
    portfolio_url: str | None = Field(default=None, max_length=512)
    bio: str | None = None

    @field_validator("whatsapp")
    @classmethod
    def validate_whatsapp(cls, v: str | None) -> str | None:
        return normalize_optional_phone(v)

    @field_validator("nationality", "subject", "portfolio_url", "bio")
    @classmethod
    def strip_optional_fields(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None


class TeacherInviteInfo(BaseModel):
    token: str
    email: str
    full_name: str
    whatsapp: str | None = None
    nationality: str | None = None
    subject: str | None = None
    experience_years: int | None = None
    portfolio_url: str | None = None
    bio: str | None = None
    status: str


# ── Formation-teacher assignment ───────────────────────────────────────────────

class FormationTeacherAssign(BaseModel):
    teacher_id: int = Field(gt=0)


class TeacherFormationItem(BaseModel):
    id: int
    slug: str
    title: str
    format_type: str
    image: str
    session_label: str | None = None
    session_state: str | None = None
    meeting_link: str | None = None


# ── Admin teacher list ─────────────────────────────────────────────────────────

class AdminTeacherItem(BaseModel):
    id: int
    full_name: str
    email: str
    teacher_code: str | None = None
    status: str
    whatsapp: str | None = None
    nationality: str | None = None
    subject: str | None = None
    experience_years: int | None = None
    portfolio_url: str | None = None
    assigned_formations_count: int = 0
    assigned_sessions_count: int = 0
    students_count: int = 0
    created_at: datetime


class AdminTeacherUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=180)
    email: str | None = Field(default=None, min_length=3, max_length=180)
    status: TeacherUserStatus | None = None
    whatsapp: str | None = Field(default=None, max_length=32)
    nationality: str | None = Field(default=None, max_length=120)
    subject: str | None = Field(default=None, max_length=180)
    experience_years: int | None = Field(default=None, ge=0, le=60)
    portfolio_url: str | None = Field(default=None, max_length=512)
    bio: str | None = None

    @field_validator("full_name", "email")
    @classmethod
    def strip_required_strings(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else v

    @field_validator("whatsapp")
    @classmethod
    def validate_whatsapp(cls, v: str | None) -> str | None:
        return normalize_optional_phone(v)

    @field_validator("nationality", "subject", "portfolio_url", "bio")
    @classmethod
    def strip_optional_fields(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None


class TeacherFullSessionItem(BaseModel):
    id: int
    formation_id: int
    formation_title: str
    formation_slug: str
    format_type: str
    label: str
    start_date: date
    end_date: date
    campus_label: str | None = None
    seat_capacity: int
    enrolled_count: int
    meeting_link: str | None = None
    status: str
    session_state: str


class AdminTeacherActivitySummary(BaseModel):
    sessions_count: int = 0
    active_sessions_count: int = 0
    students_count: int = 0
    course_days_count: int = 0
    live_events_count: int = 0
    courses_count: int = 0
    lessons_count: int = 0
    resources_count: int = 0
    assignments_count: int = 0
    submissions_count: int = 0
    pending_reviews_count: int = 0
    quizzes_count: int = 0
    quiz_attempts_count: int = 0
    attendance_present_count: int = 0
    attendance_late_count: int = 0
    attendance_absent_count: int = 0
    grades_count: int = 0
    average_grade_pct: float | None = None


class AdminTeacherStudentItem(BaseModel):
    enrollment_id: int
    student_id: int
    full_name: str
    email: str
    student_code: str | None = None
    formation_title: str
    formation_slug: str
    session_id: int | None = None
    session_label: str | None = None
    enrollment_status: str
    progress_pct: float
    attendance_count: int = 0
    present_count: int = 0
    late_count: int = 0
    absent_count: int = 0
    grades_count: int = 0
    average_grade_pct: float | None = None
    submissions_count: int = 0
    pending_reviews_count: int = 0
    last_activity_at: datetime | None = None


class AdminTeacherCourseDayAudit(BaseModel):
    id: int
    title: str
    scheduled_at: datetime
    status: str
    attendance_count: int = 0
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    resource_count: int = 0
    assignment_count: int = 0
    quiz_count: int = 0


class AdminTeacherContentAudit(BaseModel):
    id: int
    title: str
    content_type: str
    status: str | None = None
    scheduled_at: datetime | None = None
    due_date: datetime | None = None
    submissions_count: int = 0
    pending_reviews_count: int = 0
    attempts_count: int = 0


class AdminTeacherCourseAudit(BaseModel):
    id: int
    title: str
    chapters_count: int = 0
    lessons_count: int = 0


class AdminTeacherPedagogyAlert(BaseModel):
    code: str
    level: Literal["info", "warning", "critical"]
    label: str
    detail: str | None = None


class AdminTeacherPedagogySessionAudit(BaseModel):
    session_id: int
    formation_title: str
    formation_slug: str
    session_label: str
    session_status: str
    start_date: date
    end_date: date
    students_count: int = 0
    course_days_count: int = 0
    live_events_count: int = 0
    courses_count: int = 0
    lessons_count: int = 0
    resources_count: int = 0
    assignments_count: int = 0
    quizzes_count: int = 0
    pending_reviews_count: int = 0
    alerts: list[AdminTeacherPedagogyAlert] = Field(default_factory=list)
    course_days: list[AdminTeacherCourseDayAudit] = Field(default_factory=list)
    courses: list[AdminTeacherCourseAudit] = Field(default_factory=list)
    contents: list[AdminTeacherContentAudit] = Field(default_factory=list)


class AdminTeacherCourseDayPage(BaseModel):
    items: list[AdminTeacherCourseDayAudit] = Field(default_factory=list)
    total_count: int = 0
    offset: int = 0
    limit: int = 0


class AdminTeacherQuizStatusUpdate(BaseModel):
    status: Literal["draft", "active", "closed"]


class AdminTeacherResourcePublicationUpdate(BaseModel):
    published_at: datetime | None = None


class AdminTeacherAssignmentDueDateUpdate(BaseModel):
    due_date: datetime


class AdminTeacherDetail(BaseModel):
    teacher: AdminTeacherItem
    formations: list[TeacherFormationItem]
    sessions: list[TeacherFullSessionItem]
    activity: AdminTeacherActivitySummary = Field(default_factory=AdminTeacherActivitySummary)
    students: list[AdminTeacherStudentItem] = Field(default_factory=list)
    pedagogy: list[AdminTeacherPedagogySessionAudit] = Field(default_factory=list)



QuizStatus = Literal["draft", "active", "closed"]
ResourceType = Literal["pdf", "link", "video", "image"]
LessonType = Literal["text", "video", "pdf", "quiz", "assignment", "resource"]
CourseDayStatus = Literal["planned", "live", "done", "cancelled"]


class TeacherSessionStudent(BaseModel):
    enrollment_id: int
    student_id: int
    full_name: str
    email: str
    student_code: str | None = None
    enrollment_status: str


class AttendanceEntry(BaseModel):
    enrollment_id: int
    course_day_id: int | None = None
    status: AttendanceStatus
    note: str | None = None


class AttendanceRow(AttendanceEntry):
    student_name: str
    course_day_title: str | None = None
    course_day_scheduled_at: datetime | None = None


class GradeEntry(BaseModel):
    enrollment_id: int
    course_day_id: int | None = None
    label: str = Field(min_length=1, max_length=180)
    score: float = Field(ge=0)
    max_score: float = Field(default=20, gt=0)
    note: str | None = None


class GradeRow(GradeEntry):
    student_name: str
    course_day_title: str | None = None
    course_day_scheduled_at: datetime | None = None


class TeacherSessionItem(BaseModel):
    id: int
    formation_title: str
    formation_image: str
    format_type: str
    label: str
    start_date: date
    end_date: date
    campus_label: str
    seat_capacity: int
    enrolled_count: int
    teacher_name: str
    status: str


class TeacherOverview(BaseModel):
    assigned_sessions_count: int
    planned_sessions_count: int
    open_sessions_count: int
    total_students_count: int
    next_session_label: str | None
    sessions: list[TeacherSessionItem]


class CourseDayCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    scheduled_at: datetime
    duration_minutes: int = Field(default=90, ge=15, le=480)
    status: CourseDayStatus = "planned"

    @field_validator("title")
    @classmethod
    def strip_course_day_title(cls, v: str) -> str:
        return v.strip()


class CourseDayUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=480)
    status: CourseDayStatus | None = None


class CourseDayView(BaseModel):
    id: int
    session_id: int
    live_event_id: int | None
    title: str
    scheduled_at: datetime
    duration_minutes: int
    status: CourseDayStatus
    attendance_count: int = 0
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    excused_count: int = 0
    quiz_count: int = 0
    assignment_count: int = 0
    resource_count: int = 0
    grade_count: int = 0
    created_at: datetime


# ── Quiz schemas ───────────────────────────────────────────────────────────────

class QuizQuestionCreate(BaseModel):
    order_index: int = 0
    text: str = Field(min_length=1, max_length=1000)
    options: list[str] = Field(min_length=2, max_length=8)
    correct_index: int = Field(ge=0)


class QuizCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    course_day_id: int | None = None
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=240)
    questions: list[QuizQuestionCreate] = Field(default_factory=list)


class QuizUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    course_day_id: int | None = None
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=240)
    status: QuizStatus | None = None


class QuizQuestionView(BaseModel):
    id: int
    order_index: int
    text: str
    options: list[str]
    correct_index: int


class QuizView(BaseModel):
    id: int
    session_id: int
    course_day_id: int | None
    title: str
    scheduled_at: datetime | None
    duration_minutes: int | None
    status: QuizStatus
    questions: list[QuizQuestionView]
    created_at: datetime


class QuizAttemptStudentView(BaseModel):
    enrollment_id: int
    student_name: str
    attempt_number: int
    score_pct: float
    submitted_at: datetime


class QuizResultsView(BaseModel):
    quiz_id: int
    title: str
    total_students: int
    attempts: list[QuizAttemptStudentView]


# ── Resource schemas ───────────────────────────────────────────────────────────

class ResourceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    course_day_id: int | None = None
    resource_type: ResourceType = "link"
    url: str = Field(min_length=1, max_length=512)
    published_at: datetime | None = None


class ResourceView(BaseModel):
    id: int
    session_id: int
    course_day_id: int | None
    title: str
    resource_type: ResourceType
    url: str
    published_at: datetime | None
    created_at: datetime


# ── Assignment schemas ─────────────────────────────────────────────────────────

class AssignmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    course_day_id: int | None = None
    instructions: str = ""
    due_date: datetime
    is_final_project: bool = False


class AssignmentUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    course_day_id: int | None = None
    instructions: str | None = None
    due_date: datetime | None = None
    is_final_project: bool | None = None


class AssignmentReviewPayload(BaseModel):
    review_score: float | None = Field(default=None, ge=0)
    review_max_score: float = Field(default=20, gt=0)


class AssignmentSubmissionView(BaseModel):
    id: int
    enrollment_id: int
    student_name: str
    file_url: str
    submitted_at: datetime
    is_reviewed: bool
    review_score: float | None = None
    review_max_score: float = 20
    comment_count: int = 0


class AssignmentView(BaseModel):
    id: int
    session_id: int
    course_day_id: int | None
    title: str
    instructions: str
    due_date: datetime
    is_final_project: bool
    submissions_count: int
    created_at: datetime


# ── Course / Chapter / Lesson schemas ─────────────────────────────────────────

class LessonCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    lesson_type: LessonType = "text"
    order_index: int = 0
    content: str | None = None
    video_url: str | None = Field(default=None, max_length=512)
    file_url: str | None = Field(default=None, max_length=512)
    quiz_id: int | None = None
    assignment_id: int | None = None
    resource_id: int | None = None


class LessonUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    lesson_type: LessonType | None = None
    order_index: int | None = None
    content: str | None = None
    video_url: str | None = Field(default=None, max_length=512)
    file_url: str | None = Field(default=None, max_length=512)
    quiz_id: int | None = None
    assignment_id: int | None = None
    resource_id: int | None = None


class LessonView(BaseModel):
    id: int
    chapter_id: int
    title: str
    lesson_type: LessonType
    order_index: int
    content: str | None
    video_url: str | None
    file_url: str | None
    quiz_id: int | None
    assignment_id: int | None
    resource_id: int | None
    # resolved titles for linked objects
    quiz_title: str | None = None
    assignment_title: str | None = None
    resource_title: str | None = None
    created_at: datetime


class ChapterCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    order_index: int = 0


class ChapterUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    order_index: int | None = None


class ChapterView(BaseModel):
    id: int
    course_id: int
    title: str
    order_index: int
    lessons: list[LessonView] = []
    created_at: datetime


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""


class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None


class CourseView(BaseModel):
    id: int
    session_id: int
    title: str
    description: str
    chapters: list[ChapterView] = []
    total_lessons: int = 0
    created_at: datetime
    updated_at: datetime


LiveEventStatus = Literal["scheduled", "live", "done", "cancelled"]


class LiveEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    scheduled_at: datetime
    duration_minutes: int = Field(default=90, ge=15, le=480)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()


class LiveEventUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=480)
    status: LiveEventStatus | None = None


class LiveEventView(BaseModel):
    id: int
    session_id: int
    title: str
    scheduled_at: datetime
    duration_minutes: int
    status: LiveEventStatus
    created_at: datetime


class StudentLiveEventView(BaseModel):
    id: int
    session_id: int
    formation_title: str
    formation_slug: str
    session_label: str
    meeting_link: str | None
    title: str
    scheduled_at: datetime
    duration_minutes: int
    status: LiveEventStatus


class LiveRoomInfo(BaseModel):
    session_id: int
    formation_title: str
    label: str
    format_type: str
    start_date: date
    end_date: date
    teacher_name: str | None
    meeting_link: str
    jitsi_room: str
