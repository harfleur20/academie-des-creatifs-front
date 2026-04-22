import json
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from importlib import import_module
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.entities import (
    AssignmentCommentRecord,
    AssignmentRecord,
    AssignmentSubmissionRecord,
    AttendanceRecord,
    ChapterRecord,
    CourseRecord,
    EnrollmentRecord,
    FormationRecord,
    FormationSessionRecord,
    GradeRecord,
    LessonRecord,
    QuizAttemptRecord,
    QuizQuestionRecord,
    QuizRecord,
    ResourceRecord,
    SessionCourseDayRecord,
    SessionLiveEventRecord,
    UserRecord,
)
from app.schemas.catalog import AdminUploadedAsset
from app.schemas.commerce import AssignmentCommentCreate, AssignmentCommentView
from app.schemas.teacher import (
    AssignmentCreate,
    AssignmentReviewPayload,
    AssignmentSubmissionView,
    AssignmentUpdate,
    AssignmentView,
    AttendanceEntry,
    AttendanceRow,
    ChapterCreate,
    ChapterUpdate,
    ChapterView,
    CourseDayCreate,
    CourseDayUpdate,
    CourseDayView,
    CourseCreate,
    CourseUpdate,
    CourseView,
    GradeEntry,
    GradeRow,
    LessonCreate,
    LessonUpdate,
    LessonView,
    QuizAttemptStudentView,
    QuizCreate,
    QuizResultsView,
    QuizUpdate,
    QuizView,
    QuizQuestionView,
    ResourceCreate,
    ResourceView,
    TeacherOverview,
    TeacherPerformanceOverview,
    TeacherSessionStudent,
)
from app.services.ai_client import resolve_ai_runtime_config, run_ai_chat
from app.services.formation_sessions import validate_live_event_in_session
from app.services.teacher import get_teacher_overview, get_teacher_performance

router = APIRouter(prefix="/teacher", tags=["teacher"])

_teacher = require_roles("teacher")

# ── Upload constants ────────────────────────────────────────────────────────
TEACHER_UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "uploads" / "teacher-media"
TEACHER_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

_ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
_ALLOWED_VIDEO_EXT = {".mp4", ".webm", ".mov"}
_ALLOWED_PDF_EXT   = {".pdf"}
_ALLOWED_ARCHIVE_EXT = {".zip", ".rar"}
_ALLOWED_DOC_EXT = {".docx"}

_IMAGE_CT = {"image/png", "image/jpeg", "image/webp"}
_VIDEO_CT = {"video/mp4", "video/webm", "video/quicktime"}
_PDF_CT   = {"application/pdf"}
_ARCHIVE_CT = {
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/vnd.rar",
    "application/octet-stream",
}
_DOC_CT = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
}

MAX_IMAGE_BYTES = 2  * 1024 * 1024   #   2 MB
MAX_VIDEO_BYTES = 30 * 1024 * 1024   #  30 MB
MAX_PDF_BYTES   = 5  * 1024 * 1024   #   5 MB
MAX_ARCHIVE_BYTES = 50 * 1024 * 1024  #  50 MB
MAX_DOC_BYTES = 10 * 1024 * 1024      #  10 MB
AI_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024
AI_DOCUMENT_TEXT_MAX_CHARS = 24000
AI_LESSON_MIN_CONTENT_CHARS = 900


@router.get("/overview", response_model=TeacherOverview)
def read_teacher_overview(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> TeacherOverview:
    return get_teacher_overview(db, current_user)


@router.get("/performance", response_model=TeacherPerformanceOverview)
def read_teacher_performance(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> TeacherPerformanceOverview:
    return get_teacher_performance(db, current_user)


# ── helpers ────────────────────────────────────────────

def _get_session_for_teacher(
    db: Session, session_id: int, teacher_name: str
) -> FormationSessionRecord:
    session = db.scalar(
        select(FormationSessionRecord).where(FormationSessionRecord.id == session_id)
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session introuvable.")
    if session.teacher_name != teacher_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cette session ne vous est pas assignée.")
    return session


def _students_for_session(
    db: Session, session: FormationSessionRecord
) -> list[tuple[EnrollmentRecord, UserRecord]]:
    rows = db.execute(
        select(EnrollmentRecord, UserRecord)
        .join(UserRecord, UserRecord.id == EnrollmentRecord.user_id)
        .where(
            EnrollmentRecord.session_id == session.id,
            EnrollmentRecord.status.in_(("active", "completed")),
        )
        .order_by(UserRecord.full_name)
    ).all()
    return [(r.EnrollmentRecord, r.UserRecord) for r in rows]


def _course_day_status_from_live_event(status_value: str) -> str:
    return {
        "scheduled": "planned",
        "live": "live",
        "done": "done",
        "cancelled": "cancelled",
    }.get(status_value, "planned")


def _get_course_day_for_teacher(
    db: Session,
    course_day_id: int,
    teacher_name: str,
) -> SessionCourseDayRecord:
    course_day = db.get(SessionCourseDayRecord, course_day_id)
    if not course_day:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journée de cours introuvable.")
    _get_session_for_teacher(db, course_day.session_id, teacher_name)
    return course_day


def _resolve_course_day_for_session(
    db: Session,
    session: FormationSessionRecord,
    course_day_id: int | None,
) -> SessionCourseDayRecord | None:
    if course_day_id is None:
        return None
    course_day = db.get(SessionCourseDayRecord, course_day_id)
    if not course_day or course_day.session_id != session.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La journée de cours ne correspond pas à cette session.",
        )
    return course_day


def _ensure_live_event_course_days(db: Session, session_id: int) -> None:
    events = db.scalars(
        select(SessionLiveEventRecord)
        .where(SessionLiveEventRecord.session_id == session_id)
        .order_by(SessionLiveEventRecord.scheduled_at)
    ).all()
    if not events:
        return

    days_by_event_id = {
        day.live_event_id: day
        for day in db.scalars(
            select(SessionCourseDayRecord).where(
                SessionCourseDayRecord.session_id == session_id,
                SessionCourseDayRecord.live_event_id.is_not(None),
            )
        ).all()
    }
    changed = False
    for event in events:
        status_value = _course_day_status_from_live_event(event.status)
        course_day = days_by_event_id.get(event.id)
        if course_day:
            if (
                course_day.title != event.title
                or course_day.scheduled_at != event.scheduled_at
                or course_day.duration_minutes != event.duration_minutes
                or course_day.status != status_value
            ):
                course_day.title = event.title
                course_day.scheduled_at = event.scheduled_at
                course_day.duration_minutes = event.duration_minutes
                course_day.status = status_value
                changed = True
            continue
        db.add(SessionCourseDayRecord(
            session_id=session_id,
            live_event_id=event.id,
            title=event.title,
            scheduled_at=event.scheduled_at,
            duration_minutes=event.duration_minutes,
            status=status_value,
        ))
        changed = True
    if changed:
        db.commit()


def _course_day_title_map(db: Session, day_ids: set[int]) -> dict[int, SessionCourseDayRecord]:
    if not day_ids:
        return {}
    days = db.scalars(
        select(SessionCourseDayRecord).where(SessionCourseDayRecord.id.in_(day_ids))
    ).all()
    return {day.id: day for day in days}


def _serialize_attendance_row(
    record: AttendanceRecord,
    enrollment_to_name: dict[int, str],
    course_days: dict[int, SessionCourseDayRecord] | None = None,
) -> AttendanceRow:
    course_day = course_days.get(record.course_day_id) if course_days and record.course_day_id else None
    return AttendanceRow(
        enrollment_id=record.enrollment_id,
        course_day_id=record.course_day_id,
        status=record.status,  # type: ignore[arg-type]
        note=record.note,
        student_name=enrollment_to_name.get(record.enrollment_id, "—"),
        course_day_title=course_day.title if course_day else None,
        course_day_scheduled_at=course_day.scheduled_at if course_day else None,
    )


def _serialize_grade_row(
    record: GradeRecord,
    enrollment_to_name: dict[int, str],
    course_days: dict[int, SessionCourseDayRecord] | None = None,
) -> GradeRow:
    course_day = course_days.get(record.course_day_id) if course_days and record.course_day_id else None
    return GradeRow(
        enrollment_id=record.enrollment_id,
        course_day_id=record.course_day_id,
        label=record.label,
        score=record.score,
        max_score=record.max_score,
        note=record.note,
        student_name=enrollment_to_name.get(record.enrollment_id, "—"),
        course_day_title=course_day.title if course_day else None,
        course_day_scheduled_at=course_day.scheduled_at if course_day else None,
    )


def _count_for_day(db: Session, model: type, course_day_id: int) -> int:
    return int(
        db.scalar(
            select(func.count()).select_from(model).where(model.course_day_id == course_day_id)
        )
        or 0
    )


def _serialize_course_day(db: Session, course_day: SessionCourseDayRecord) -> CourseDayView:
    attendance_count = _count_for_day(db, AttendanceRecord, course_day.id)
    return CourseDayView(
        id=course_day.id,
        session_id=course_day.session_id,
        live_event_id=course_day.live_event_id,
        title=course_day.title,
        scheduled_at=course_day.scheduled_at,
        duration_minutes=course_day.duration_minutes,
        status=course_day.status,  # type: ignore[arg-type]
        attendance_count=attendance_count,
        present_count=int(db.scalar(select(func.count()).select_from(AttendanceRecord).where(
            AttendanceRecord.course_day_id == course_day.id,
            AttendanceRecord.status == "present",
        )) or 0),
        absent_count=int(db.scalar(select(func.count()).select_from(AttendanceRecord).where(
            AttendanceRecord.course_day_id == course_day.id,
            AttendanceRecord.status == "absent",
        )) or 0),
        late_count=int(db.scalar(select(func.count()).select_from(AttendanceRecord).where(
            AttendanceRecord.course_day_id == course_day.id,
            AttendanceRecord.status == "late",
        )) or 0),
        excused_count=int(db.scalar(select(func.count()).select_from(AttendanceRecord).where(
            AttendanceRecord.course_day_id == course_day.id,
            AttendanceRecord.status == "excused",
        )) or 0),
        quiz_count=_count_for_day(db, QuizRecord, course_day.id),
        assignment_count=_count_for_day(db, AssignmentRecord, course_day.id),
        resource_count=_count_for_day(db, ResourceRecord, course_day.id),
        grade_count=_count_for_day(db, GradeRecord, course_day.id),
        created_at=course_day.created_at,
    )


# ── AI draft generation ─────────────────────────────────

class _AITextModel(BaseModel):
    @field_validator(
        "title",
        "description",
        "content",
        "instructions",
        "level",
        "objectives",
        check_fields=False,
    )
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class AIGenerationBasePayload(_AITextModel):
    session_id: int = Field(gt=0)
    topic: str = Field(min_length=3, max_length=255)
    level: str | None = Field(default=None, max_length=120)
    objectives: str | None = Field(default=None, max_length=1200)

    @field_validator("topic")
    @classmethod
    def strip_topic(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise ValueError("Sujet requis.")
        return cleaned


class AICourseDraftPayload(AIGenerationBasePayload):
    chapters_count: int = Field(default=3, ge=1, le=6)
    lessons_per_chapter: int = Field(default=3, ge=1, le=6)


class AIQuizDraftPayload(AIGenerationBasePayload):
    course_day_id: int | None = None
    questions_count: int = Field(default=5, ge=2, le=20)
    options_per_question: int = Field(default=4, ge=2, le=6)


class AIAssignmentDraftPayload(AIGenerationBasePayload):
    course_day_id: int | None = None
    duration_days: int = Field(default=7, ge=1, le=60)
    is_final_project: bool = False


class AIGeneratedLessonDraft(_AITextModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=AI_LESSON_MIN_CONTENT_CHARS, max_length=12000)


class AIGeneratedChapterDraft(_AITextModel):
    title: str = Field(min_length=1, max_length=255)
    lessons: list[AIGeneratedLessonDraft] = Field(min_length=1, max_length=8)


class AIGeneratedCourseDraft(_AITextModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=1200)
    chapters: list[AIGeneratedChapterDraft] = Field(min_length=1, max_length=8)


class AIGeneratedQuizQuestionDraft(_AITextModel):
    text: str = Field(min_length=1, max_length=1000)
    options: list[str] = Field(min_length=2, max_length=8)
    correct_index: int = Field(ge=0)

    @field_validator("options")
    @classmethod
    def clean_options(cls, value: list[str]) -> list[str]:
        cleaned = [str(option).strip() for option in value if str(option).strip()]
        if len(cleaned) < 2:
            raise ValueError("Une question doit avoir au moins deux options.")
        return cleaned[:8]

    @model_validator(mode="after")
    def clamp_correct_index(self) -> "AIGeneratedQuizQuestionDraft":
        if self.correct_index >= len(self.options):
            self.correct_index = 0
        return self


class AIGeneratedQuizDraft(_AITextModel):
    title: str = Field(min_length=1, max_length=255)
    duration_minutes: int | None = Field(default=None, ge=1, le=240)
    questions: list[AIGeneratedQuizQuestionDraft] = Field(min_length=1, max_length=30)


class AIGeneratedAssignmentDraft(_AITextModel):
    title: str = Field(min_length=1, max_length=255)
    instructions: str = Field(min_length=1, max_length=8000)
    is_final_project: bool = False
    duration_days: int = Field(default=7, ge=1, le=60)


def _compact_generation_value(value: object, max_chars: int = 900) -> str:
    if value in (None, "", [], {}):
        return "Non renseigne"
    try:
        text = json.dumps(value, ensure_ascii=False)
    except TypeError:
        text = str(value)
    text = text.strip()
    return text[:max_chars] + ("..." if len(text) > max_chars else "")


def _generation_context_for_session(
    db: Session,
    session: FormationSessionRecord,
    course_day: SessionCourseDayRecord | None = None,
) -> str:
    formation = db.get(FormationRecord, session.formation_id)
    formation_title = formation.title if formation else "Formation non renseignee"
    formation_level = formation.level if formation else "Non renseigne"
    formation_format = formation.format_type if formation else "Non renseigne"
    formation_intro = formation.intro if formation else ""
    day_line = ""
    if course_day is not None:
        day_line = (
            f"\nJournee ciblee: {course_day.title}, "
            f"{course_day.scheduled_at.isoformat()}, {course_day.duration_minutes} minutes."
        )
    return (
        f"Formation: {formation_title}\n"
        f"Niveau catalogue: {formation_level}\n"
        f"Format: {formation_format}\n"
        f"Session: {session.label}, du {session.start_date.isoformat()} au {session.end_date.isoformat()}\n"
        f"Introduction catalogue: {_compact_generation_value(formation_intro, 700)}\n"
        f"Objectifs catalogue: {_compact_generation_value(formation.objective_items if formation else None)}\n"
        f"Modules catalogue: {_compact_generation_value(formation.module_items if formation else None)}\n"
        f"Projets catalogue: {_compact_generation_value(formation.project_items if formation else None)}"
        f"{day_line}"
    )


def _parse_ai_json_object(raw_reply: str) -> dict[str, object]:
    text = raw_reply.strip()
    if text.startswith("```"):
        text = "\n".join(
            line for line in text.splitlines() if not line.strip().startswith("```")
        ).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("La reponse IA ne contient pas d'objet JSON.")
    data = json.loads(text[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("La reponse IA doit etre un objet JSON.")
    return data


def _run_teacher_ai_generation(
    *,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
) -> dict[str, object]:
    if resolve_ai_runtime_config() is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Le service IA n'est pas configure.",
        )
    try:
        reply = run_ai_chat(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            max_tokens=max_tokens,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Le service IA n'est pas disponible. Verifiez la configuration.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="La generation IA a echoue.",
        ) from exc
    try:
        return _parse_ai_json_object(reply)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="La reponse IA n'est pas un JSON valide.",
        ) from exc


def _teacher_ai_system_prompt() -> str:
    return (
        "Tu es un concepteur pedagogique francophone pour l'Academie des Creatifs. "
        "Tu produis des contenus directement exploitables par un professeur. "
        "Respecte le contexte de formation fourni. "
        "Retourne uniquement un objet JSON valide, sans commentaire, sans bloc ```. "
        "Les champs content des lecons peuvent utiliser du Markdown pedagogique."
    )


def _course_content_requirements(chapters_count: int, lessons_per_chapter: int) -> str:
    return (
        "Qualite obligatoire des lecons:\n"
        f"- chaque lecon doit contenir au moins {AI_LESSON_MIN_CONTENT_CHARS} caracteres utiles;\n"
        "- chaque champ content doit etre un mini-cours complet, pas un resume;\n"
        "- structure chaque lecon avec des sous-titres Markdown: ## Objectif, ## Notions cles, "
        "## Explication detaillee, ## Exemple concret, ## Methode pas a pas, "
        "## Exercice pratique, ## A retenir;\n"
        "- illustre avec des exemples concrets, mini-cas, listes d'actions, erreurs frequentes "
        "et analogies utiles lorsque c'est pertinent;\n"
        "- evite les phrases vagues comme 'approfondir le sujet'; donne de la matiere enseignable;\n"
        f"- la description ne doit jamais annoncer un nombre different de {chapters_count} chapitres "
        f"et {chapters_count * lessons_per_chapter} lecons;\n"
        "- les titres de chapitres doivent suivre l'ordre logique Chapitre 1, Chapitre 2, etc."
    )


def _validate_course_draft_shape(
    draft: AIGeneratedCourseDraft,
    chapters_count: int,
    lessons_per_chapter: int,
) -> AIGeneratedCourseDraft:
    if len(draft.chapters) != chapters_count:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "L'IA n'a pas respecté la structure demandée : "
                f"{chapters_count} chapitres attendus, {len(draft.chapters)} reçu(s)."
            ),
        )
    for chapter_index, chapter in enumerate(draft.chapters, start=1):
        if len(chapter.lessons) != lessons_per_chapter:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "L'IA n'a pas respecté la structure demandée : "
                    f"{lessons_per_chapter} leçons attendues dans le chapitre {chapter_index}, "
                    f"{len(chapter.lessons)} reçue(s)."
                ),
            )
        for lesson_index, lesson in enumerate(chapter.lessons, start=1):
            if len(lesson.content.strip()) < AI_LESSON_MIN_CONTENT_CHARS:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=(
                        "L'IA a généré une leçon trop légère : "
                        f"chapitre {chapter_index}, leçon {lesson_index}."
                    ),
                )
    return draft


def _extract_docx_text(content: bytes) -> str:
    try:
        with ZipFile(BytesIO(content)) as archive:
            xml_content = archive.read("word/document.xml")
    except (BadZipFile, KeyError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document Word invalide ou illisible.",
        ) from exc

    root = ET.fromstring(xml_content)
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    paragraphs: list[str] = []
    for paragraph in root.iter(f"{namespace}p"):
        parts = [node.text or "" for node in paragraph.iter(f"{namespace}t")]
        line = "".join(parts).strip()
        if line:
            paragraphs.append(line)
    return "\n".join(paragraphs)


def _extract_pdf_text(content: bytes) -> str:
    try:
        pypdf = import_module("pypdf")
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La lecture PDF nécessite la dépendance pypdf côté serveur.",
        ) from exc

    try:
        reader = pypdf.PdfReader(BytesIO(content))
        pages = reader.pages[:80]
        return "\n".join((page.extract_text() or "").strip() for page in pages)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF invalide ou illisible.",
        ) from exc


def _extract_ai_document_text(filename: str, content: bytes) -> str:
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document vide.")
    if len(content) > AI_DOCUMENT_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Document trop lourd. Limite : 8 MB.",
        )

    suffix = Path(filename).suffix.lower()
    if suffix == ".docx":
        text = _extract_docx_text(content)
    elif suffix == ".pdf":
        text = _extract_pdf_text(content)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format non supporté. Utilisez un fichier PDF ou Word .docx.",
        )

    cleaned = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    if len(cleaned) < 80:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le document ne contient pas assez de texte exploitable.",
        )
    return cleaned[:AI_DOCUMENT_TEXT_MAX_CHARS]


@router.post("/ai/course-draft", response_model=AIGeneratedCourseDraft)
def generate_course_draft(
    payload: AICourseDraftPayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> AIGeneratedCourseDraft:
    session = _get_session_for_teacher(db, payload.session_id, current_user.full_name)
    context = _generation_context_for_session(db, session)
    data = _run_teacher_ai_generation(
        system_prompt=_teacher_ai_system_prompt(),
        max_tokens=12000,
        user_prompt=(
            f"{context}\n\n"
            f"Sujet a developper: {payload.topic}\n"
            f"Niveau souhaite: {payload.level or 'adapte au catalogue'}\n"
            f"Objectifs specifiques du professeur: {payload.objectives or 'Non renseignes'}\n\n"
            "Genere un cours complet en francais avec:\n"
            f"- exactement {payload.chapters_count} chapitres;\n"
            f"- exactement {payload.lessons_per_chapter} lecons texte par chapitre;\n"
            "- des contenus de lecon riches, explicatifs, illustres par exemples et actionnables.\n\n"
            f"{_course_content_requirements(payload.chapters_count, payload.lessons_per_chapter)}\n\n"
            "Schema JSON attendu:\n"
            '{"title":"...","description":"...",'
            '"chapters":[{"title":"...","lessons":[{"title":"...","content":"..."}]}]}'
        ),
    )
    try:
        draft = AIGeneratedCourseDraft.model_validate(data)
        return _validate_course_draft_shape(
            draft,
            payload.chapters_count,
            payload.lessons_per_chapter,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="La reponse IA du cours est invalide ou trop légère.",
        ) from exc


@router.post("/ai/course-draft/document", response_model=AIGeneratedCourseDraft)
async def generate_course_draft_from_document(
    request: Request,
    session_id: int = Query(gt=0),
    filename: str = Query(min_length=1, max_length=255),
    level: str | None = Query(default=None, max_length=120),
    objectives: str | None = Query(default=None, max_length=1200),
    chapters_count: int = Query(default=3, ge=1, le=6),
    lessons_per_chapter: int = Query(default=3, ge=1, le=6),
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> AIGeneratedCourseDraft:
    session = _get_session_for_teacher(db, session_id, current_user.full_name)
    document_text = _extract_ai_document_text(filename, await request.body())
    context = _generation_context_for_session(db, session)
    data = _run_teacher_ai_generation(
        system_prompt=_teacher_ai_system_prompt(),
        max_tokens=14000,
        user_prompt=(
            f"{context}\n\n"
            f"Document fourni: {filename}\n"
            f"Niveau souhaite: {level or 'deduit du document et du catalogue'}\n"
            f"Objectifs specifiques du professeur: {objectives or 'Non renseignes'}\n\n"
            "Recree un programme complet de formation a partir du document ci-dessous. "
            "Si le document contient deja un plan, conserve sa logique et rends-la exploitable "
            "dans la plateforme. Si le document est un support brut, transforme-le en chapitres "
            "progressifs avec des lecons texte claires.\n\n"
            f"Contraintes: exactement {chapters_count} chapitres; exactement "
            f"{lessons_per_chapter} lecons texte par chapitre; contenu en francais; "
            "pas de liens inventes.\n\n"
            f"{_course_content_requirements(chapters_count, lessons_per_chapter)}\n\n"
            "Texte extrait du document:\n"
            f"{document_text}\n\n"
            "Schema JSON attendu:\n"
            '{"title":"...","description":"...",'
            '"chapters":[{"title":"...","lessons":[{"title":"...","content":"..."}]}]}'
        ),
    )
    try:
        draft = AIGeneratedCourseDraft.model_validate(data)
        return _validate_course_draft_shape(
            draft,
            chapters_count,
            lessons_per_chapter,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="La reponse IA du document est invalide ou trop légère.",
        ) from exc


@router.post("/ai/quiz-draft", response_model=AIGeneratedQuizDraft)
def generate_quiz_draft(
    payload: AIQuizDraftPayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> AIGeneratedQuizDraft:
    session = _get_session_for_teacher(db, payload.session_id, current_user.full_name)
    course_day = _resolve_course_day_for_session(db, session, payload.course_day_id)
    context = _generation_context_for_session(db, session, course_day)
    data = _run_teacher_ai_generation(
        system_prompt=_teacher_ai_system_prompt(),
        max_tokens=2400,
        user_prompt=(
            f"{context}\n\n"
            f"Sujet du quiz: {payload.topic}\n"
            f"Niveau souhaite: {payload.level or 'adapte au catalogue'}\n"
            f"Objectifs specifiques du professeur: {payload.objectives or 'Non renseignes'}\n\n"
            f"Genere exactement {payload.questions_count} questions a choix multiple. "
            f"Chaque question doit avoir exactement {payload.options_per_question} options. "
            "correct_index est l'index zero-based de la bonne reponse. "
            "Evite les questions pieges et couvre comprehension, application et analyse.\n\n"
            "Schema JSON attendu:\n"
            '{"title":"...","duration_minutes":30,'
            '"questions":[{"text":"...","options":["...","..."],"correct_index":0}]}'
        ),
    )
    try:
        return AIGeneratedQuizDraft.model_validate(data)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="La reponse IA du quiz est invalide.",
        ) from exc


@router.post("/ai/assignment-draft", response_model=AIGeneratedAssignmentDraft)
def generate_assignment_draft(
    payload: AIAssignmentDraftPayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> AIGeneratedAssignmentDraft:
    session = _get_session_for_teacher(db, payload.session_id, current_user.full_name)
    course_day = _resolve_course_day_for_session(db, session, payload.course_day_id)
    context = _generation_context_for_session(db, session, course_day)
    data = _run_teacher_ai_generation(
        system_prompt=_teacher_ai_system_prompt(),
        max_tokens=2200,
        user_prompt=(
            f"{context}\n\n"
            f"Sujet du devoir: {payload.topic}\n"
            f"Niveau souhaite: {payload.level or 'adapte au catalogue'}\n"
            f"Objectifs specifiques du professeur: {payload.objectives or 'Non renseignes'}\n"
            f"Delai recommande: {payload.duration_days} jours\n"
            f"Projet final: {'oui' if payload.is_final_project else 'non'}\n\n"
            "Genere une consigne claire avec livrables attendus, criteres de reussite, "
            "format de rendu et bareme indicatif sur 20. Le devoir doit etre realiste "
            "pour des etudiants de cette formation.\n\n"
            "Schema JSON attendu:\n"
            '{"title":"...","instructions":"...","is_final_project":false,"duration_days":7}'
        ),
    )
    try:
        draft = AIGeneratedAssignmentDraft.model_validate(data)
        draft.duration_days = payload.duration_days
        if payload.is_final_project:
            draft.is_final_project = True
        return draft
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="La reponse IA du devoir est invalide.",
        ) from exc


# ── students list ──────────────────────────────────────

@router.get("/sessions/{session_id}/students", response_model=list[TeacherSessionStudent])
def list_session_students(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[TeacherSessionStudent]:
    session = _get_session_for_teacher(db, session_id, current_user.full_name)
    pairs = _students_for_session(db, session)
    return [
        TeacherSessionStudent(
            enrollment_id=e.id,
            student_id=u.id,
            full_name=u.full_name,
            email=u.email,
            student_code=u.student_code,
            enrollment_status=e.status,
        )
        for e, u in pairs
    ]


# ── course days ────────────────────────────────────────

@router.get("/sessions/{session_id}/course-days", response_model=list[CourseDayView])
def list_course_days(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[CourseDayView]:
    _get_session_for_teacher(db, session_id, current_user.full_name)
    _ensure_live_event_course_days(db, session_id)
    days = db.scalars(
        select(SessionCourseDayRecord)
        .where(SessionCourseDayRecord.session_id == session_id)
        .order_by(SessionCourseDayRecord.scheduled_at)
    ).all()
    return [_serialize_course_day(db, day) for day in days]


@router.post("/sessions/{session_id}/course-days", response_model=CourseDayView, status_code=status.HTTP_201_CREATED)
def create_course_day(
    session_id: int,
    payload: CourseDayCreate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> CourseDayView:
    session = _get_session_for_teacher(db, session_id, current_user.full_name)
    try:
        validate_live_event_in_session(session, payload.scheduled_at)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    course_day = SessionCourseDayRecord(
        session_id=session_id,
        title=payload.title,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        status=payload.status,
    )
    db.add(course_day)
    db.commit()
    db.refresh(course_day)
    return _serialize_course_day(db, course_day)


@router.patch("/course-days/{course_day_id}", response_model=CourseDayView)
def update_course_day(
    course_day_id: int,
    payload: CourseDayUpdate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> CourseDayView:
    course_day = _get_course_day_for_teacher(db, course_day_id, current_user.full_name)
    session = _get_session_for_teacher(db, course_day.session_id, current_user.full_name)
    if payload.title is not None:
        course_day.title = payload.title.strip()
    if payload.scheduled_at is not None:
        try:
            validate_live_event_in_session(session, payload.scheduled_at)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        course_day.scheduled_at = payload.scheduled_at
    if payload.duration_minutes is not None:
        course_day.duration_minutes = payload.duration_minutes
    if payload.status is not None:
        course_day.status = payload.status
    db.add(course_day)
    db.commit()
    db.refresh(course_day)
    return _serialize_course_day(db, course_day)


@router.delete("/course-days/{course_day_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_day(
    course_day_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> None:
    course_day = _get_course_day_for_teacher(db, course_day_id, current_user.full_name)
    db.delete(course_day)
    db.commit()


# ── attendance ─────────────────────────────────────────

@router.get("/sessions/{session_id}/attendance", response_model=list[AttendanceRow])
def get_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[AttendanceRow]:
    session = _get_session_for_teacher(db, session_id, current_user.full_name)
    pairs = _students_for_session(db, session)
    enrollment_to_name = {e.id: u.full_name for e, u in pairs}

    rows = db.scalars(
        select(AttendanceRecord).where(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.course_day_id.is_(None),
        )
    ).all()
    return [_serialize_attendance_row(r, enrollment_to_name) for r in rows]


@router.post("/sessions/{session_id}/attendance", response_model=list[AttendanceRow])
def save_attendance(
    session_id: int,
    entries: list[AttendanceEntry],
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[AttendanceRow]:
    session = _get_session_for_teacher(db, session_id, current_user.full_name)
    pairs = _students_for_session(db, session)
    valid_ids = {e.id for e, _ in pairs}
    enrollment_to_name = {e.id: u.full_name for e, u in pairs}

    for entry in entries:
        if entry.enrollment_id not in valid_ids:
            continue
        existing = db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.enrollment_id == entry.enrollment_id,
                AttendanceRecord.course_day_id.is_(None),
            )
        )
        if existing:
            existing.status = entry.status
            existing.note = entry.note
        else:
            db.add(AttendanceRecord(
                session_id=session_id,
                enrollment_id=entry.enrollment_id,
                status=entry.status,
                note=entry.note,
            ))
    db.commit()

    rows = db.scalars(
        select(AttendanceRecord).where(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.course_day_id.is_(None),
        )
    ).all()
    return [_serialize_attendance_row(r, enrollment_to_name) for r in rows]


@router.get("/course-days/{course_day_id}/attendance", response_model=list[AttendanceRow])
def get_course_day_attendance(
    course_day_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[AttendanceRow]:
    course_day = _get_course_day_for_teacher(db, course_day_id, current_user.full_name)
    session = _get_session_for_teacher(db, course_day.session_id, current_user.full_name)
    pairs = _students_for_session(db, session)
    enrollment_to_name = {e.id: u.full_name for e, u in pairs}
    rows = db.scalars(
        select(AttendanceRecord)
        .where(
            AttendanceRecord.session_id == session.id,
            AttendanceRecord.course_day_id == course_day.id,
        )
        .order_by(AttendanceRecord.enrollment_id)
    ).all()
    return [_serialize_attendance_row(r, enrollment_to_name, {course_day.id: course_day}) for r in rows]


@router.post("/course-days/{course_day_id}/attendance", response_model=list[AttendanceRow])
def save_course_day_attendance(
    course_day_id: int,
    entries: list[AttendanceEntry],
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[AttendanceRow]:
    course_day = _get_course_day_for_teacher(db, course_day_id, current_user.full_name)
    session = _get_session_for_teacher(db, course_day.session_id, current_user.full_name)
    pairs = _students_for_session(db, session)
    valid_ids = {e.id for e, _ in pairs}
    enrollment_to_name = {e.id: u.full_name for e, u in pairs}

    for entry in entries:
        if entry.enrollment_id not in valid_ids:
            continue
        existing = db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.session_id == session.id,
                AttendanceRecord.enrollment_id == entry.enrollment_id,
                AttendanceRecord.course_day_id == course_day.id,
            )
        )
        if existing:
            existing.status = entry.status
            existing.note = entry.note
        else:
            db.add(AttendanceRecord(
                session_id=session.id,
                enrollment_id=entry.enrollment_id,
                course_day_id=course_day.id,
                status=entry.status,
                note=entry.note,
            ))
    db.commit()

    rows = db.scalars(
        select(AttendanceRecord)
        .where(
            AttendanceRecord.session_id == session.id,
            AttendanceRecord.course_day_id == course_day.id,
        )
        .order_by(AttendanceRecord.enrollment_id)
    ).all()
    return [_serialize_attendance_row(r, enrollment_to_name, {course_day.id: course_day}) for r in rows]


# ── grades ─────────────────────────────────────────────

@router.get("/sessions/{session_id}/grades", response_model=list[GradeRow])
def get_grades(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[GradeRow]:
    session = _get_session_for_teacher(db, session_id, current_user.full_name)
    pairs = _students_for_session(db, session)
    enrollment_to_name = {e.id: u.full_name for e, u in pairs}

    rows = db.scalars(
        select(GradeRecord).where(GradeRecord.session_id == session_id)
        .order_by(GradeRecord.enrollment_id, GradeRecord.label)
    ).all()
    course_days = _course_day_title_map(db, {r.course_day_id for r in rows if r.course_day_id})
    return [_serialize_grade_row(r, enrollment_to_name, course_days) for r in rows]


@router.post("/sessions/{session_id}/grades", response_model=list[GradeRow])
def save_grades(
    session_id: int,
    entries: list[GradeEntry],
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[GradeRow]:
    session = _get_session_for_teacher(db, session_id, current_user.full_name)
    pairs = _students_for_session(db, session)
    valid_ids = {e.id for e, _ in pairs}
    enrollment_to_name = {e.id: u.full_name for e, u in pairs}

    for entry in entries:
        if entry.enrollment_id not in valid_ids:
            continue
        course_day = _resolve_course_day_for_session(db, session, entry.course_day_id)
        query = select(GradeRecord).where(
            GradeRecord.session_id == session_id,
            GradeRecord.enrollment_id == entry.enrollment_id,
            GradeRecord.label == entry.label,
        )
        if course_day:
            query = query.where(GradeRecord.course_day_id == course_day.id)
        else:
            query = query.where(GradeRecord.course_day_id.is_(None))
        existing = db.scalar(query)
        if existing:
            existing.score = entry.score
            existing.max_score = entry.max_score
            existing.note = entry.note
        else:
            db.add(GradeRecord(
                session_id=session_id,
                enrollment_id=entry.enrollment_id,
                course_day_id=course_day.id if course_day else None,
                label=entry.label,
                score=entry.score,
                max_score=entry.max_score,
                note=entry.note,
            ))
    db.commit()

    rows = db.scalars(
        select(GradeRecord).where(GradeRecord.session_id == session_id)
        .order_by(GradeRecord.enrollment_id, GradeRecord.label)
    ).all()
    course_days = _course_day_title_map(db, {r.course_day_id for r in rows if r.course_day_id})
    return [_serialize_grade_row(r, enrollment_to_name, course_days) for r in rows]


# ══════════════════════════════════════════════════════════════════════════════
# QUIZ
# ══════════════════════════════════════════════════════════════════════════════

def _get_quiz_for_teacher(db: Session, quiz_id: int, teacher_name: str) -> QuizRecord:
    quiz = db.scalar(select(QuizRecord).where(QuizRecord.id == quiz_id))
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz introuvable.")
    session = db.get(FormationSessionRecord, quiz.session_id)
    if not session or session.teacher_name != teacher_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ce quiz ne vous appartient pas.")
    return quiz


def _serialize_quiz(db: Session, quiz: QuizRecord) -> QuizView:
    questions = db.scalars(
        select(QuizQuestionRecord)
        .where(QuizQuestionRecord.quiz_id == quiz.id)
        .order_by(QuizQuestionRecord.order_index)
    ).all()
    return QuizView(
        id=quiz.id,
        session_id=quiz.session_id,
        course_day_id=quiz.course_day_id,
        title=quiz.title,
        scheduled_at=quiz.scheduled_at,
        duration_minutes=quiz.duration_minutes,
        status=quiz.status,  # type: ignore[arg-type]
        questions=[
            QuizQuestionView(
                id=q.id,
                order_index=q.order_index,
                text=q.text,
                options=q.options,
                correct_index=q.correct_index,
            )
            for q in questions
        ],
        created_at=quiz.created_at,
    )


@router.get("/sessions/{session_id}/quizzes", response_model=list[QuizView])
def list_session_quizzes(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[QuizView]:
    _get_session_for_teacher(db, session_id, current_user.full_name)
    quizzes = db.scalars(
        select(QuizRecord).where(QuizRecord.session_id == session_id).order_by(QuizRecord.created_at)
    ).all()
    return [_serialize_quiz(db, q) for q in quizzes]


@router.post("/sessions/{session_id}/quizzes", response_model=QuizView, status_code=status.HTTP_201_CREATED)
def create_quiz(
    session_id: int,
    payload: QuizCreate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> QuizView:
    session = _get_session_for_teacher(db, session_id, current_user.full_name)
    course_day = _resolve_course_day_for_session(db, session, payload.course_day_id)
    scheduled_at = payload.scheduled_at or (course_day.scheduled_at if course_day else None)
    if scheduled_at is not None:
        try:
            validate_live_event_in_session(session, scheduled_at)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    quiz = QuizRecord(
        session_id=session_id,
        course_day_id=course_day.id if course_day else None,
        title=payload.title,
        scheduled_at=scheduled_at,
        duration_minutes=payload.duration_minutes,
    )
    db.add(quiz)
    db.flush()
    for i, q in enumerate(payload.questions):
        db.add(QuizQuestionRecord(
            quiz_id=quiz.id,
            order_index=q.order_index if q.order_index else i,
            text=q.text,
            options=q.options,
            correct_index=q.correct_index,
        ))
    db.commit()
    db.refresh(quiz)
    return _serialize_quiz(db, quiz)


@router.put("/quizzes/{quiz_id}", response_model=QuizView)
def update_quiz(
    quiz_id: int,
    payload: QuizUpdate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> QuizView:
    quiz = _get_quiz_for_teacher(db, quiz_id, current_user.full_name)
    session = _get_session_for_teacher(db, quiz.session_id, current_user.full_name)
    if payload.title is not None:
        quiz.title = payload.title
    if "course_day_id" in payload.model_fields_set:
        course_day = _resolve_course_day_for_session(db, session, payload.course_day_id)
        quiz.course_day_id = course_day.id if course_day else None
        if course_day and quiz.scheduled_at is None:
            quiz.scheduled_at = course_day.scheduled_at
    if payload.scheduled_at is not None:
        try:
            validate_live_event_in_session(session, payload.scheduled_at)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        quiz.scheduled_at = payload.scheduled_at
    if payload.duration_minutes is not None:
        quiz.duration_minutes = payload.duration_minutes
    if payload.status is not None:
        quiz.status = payload.status
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return _serialize_quiz(db, quiz)


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> None:
    quiz = _get_quiz_for_teacher(db, quiz_id, current_user.full_name)
    db.delete(quiz)
    db.commit()


@router.get("/quizzes/{quiz_id}/results", response_model=QuizResultsView)
def get_quiz_results(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> QuizResultsView:
    quiz = _get_quiz_for_teacher(db, quiz_id, current_user.full_name)
    session = db.get(FormationSessionRecord, quiz.session_id)
    pairs = _students_for_session(db, session)  # type: ignore[arg-type]
    enrollment_to_name = {e.id: u.full_name for e, u in pairs}

    attempts = db.scalars(
        select(QuizAttemptRecord).where(QuizAttemptRecord.quiz_id == quiz_id)
        .order_by(QuizAttemptRecord.enrollment_id, QuizAttemptRecord.attempt_number)
    ).all()

    return QuizResultsView(
        quiz_id=quiz.id,
        title=quiz.title,
        total_students=len(pairs),
        attempts=[
            QuizAttemptStudentView(
                enrollment_id=a.enrollment_id,
                student_name=enrollment_to_name.get(a.enrollment_id, "—"),
                attempt_number=a.attempt_number,
                score_pct=a.score_pct,
                submitted_at=a.submitted_at,
            )
            for a in attempts
        ],
    )


# ══════════════════════════════════════════════════════════════════════════════
# RESOURCES
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/sessions/{session_id}/resources", response_model=list[ResourceView])
def list_session_resources(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[ResourceView]:
    _get_session_for_teacher(db, session_id, current_user.full_name)
    resources = db.scalars(
        select(ResourceRecord).where(ResourceRecord.session_id == session_id)
        .order_by(ResourceRecord.created_at.desc())
    ).all()
    return [
        ResourceView(
            id=r.id,
            session_id=r.session_id,
            course_day_id=r.course_day_id,
            title=r.title,
            resource_type=r.resource_type,  # type: ignore[arg-type]
            url=r.url,
            published_at=r.published_at,
            created_at=r.created_at,
        )
        for r in resources
    ]


@router.post("/sessions/{session_id}/resources", response_model=ResourceView, status_code=status.HTTP_201_CREATED)
def create_resource(
    session_id: int,
    payload: ResourceCreate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> ResourceView:
    session = _get_session_for_teacher(db, session_id, current_user.full_name)
    course_day = _resolve_course_day_for_session(db, session, payload.course_day_id)
    if payload.published_at is not None:
        try:
            validate_live_event_in_session(session, payload.published_at)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    resource = ResourceRecord(
        session_id=session_id,
        course_day_id=course_day.id if course_day else None,
        title=payload.title,
        resource_type=payload.resource_type,
        url=payload.url,
        published_at=payload.published_at,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return ResourceView(
        id=resource.id,
        session_id=resource.session_id,
        course_day_id=resource.course_day_id,
        title=resource.title,
        resource_type=resource.resource_type,  # type: ignore[arg-type]
        url=resource.url,
        published_at=resource.published_at,
        created_at=resource.created_at,
    )


@router.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> None:
    resource = db.scalar(select(ResourceRecord).where(ResourceRecord.id == resource_id))
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ressource introuvable.")
    session = db.get(FormationSessionRecord, resource.session_id)
    if not session or session.teacher_name != current_user.full_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")
    db.delete(resource)
    db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# ASSIGNMENTS
# ══════════════════════════════════════════════════════════════════════════════

def _get_assignment_for_teacher(
    db: Session, assignment_id: int, teacher_name: str
) -> AssignmentRecord:
    assignment = db.scalar(select(AssignmentRecord).where(AssignmentRecord.id == assignment_id))
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devoir introuvable.")
    session = db.get(FormationSessionRecord, assignment.session_id)
    if not session or session.teacher_name != teacher_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")
    return assignment


def _serialize_assignment(db: Session, assignment: AssignmentRecord) -> AssignmentView:
    submissions_count = db.query(AssignmentSubmissionRecord).filter(
        AssignmentSubmissionRecord.assignment_id == assignment.id
    ).count()
    return AssignmentView(
        id=assignment.id,
        session_id=assignment.session_id,
        course_day_id=assignment.course_day_id,
        title=assignment.title,
        instructions=assignment.instructions,
        due_date=assignment.due_date,
        is_final_project=assignment.is_final_project,
        submissions_count=submissions_count,
        created_at=assignment.created_at,
    )


def _assignment_comment_count(db: Session, assignment_id: int, enrollment_id: int) -> int:
    return db.query(AssignmentCommentRecord).filter(
        AssignmentCommentRecord.assignment_id == assignment_id,
        AssignmentCommentRecord.enrollment_id == enrollment_id,
    ).count()


def _serialize_assignment_submission(
    db: Session,
    submission: AssignmentSubmissionRecord,
    student_name: str,
) -> AssignmentSubmissionView:
    return AssignmentSubmissionView(
        id=submission.id,
        enrollment_id=submission.enrollment_id,
        student_name=student_name,
        file_url=submission.file_url,
        submitted_at=submission.submitted_at,
        is_reviewed=submission.is_reviewed,
        review_score=submission.review_score,
        review_max_score=submission.review_max_score,
        comment_count=_assignment_comment_count(db, submission.assignment_id, submission.enrollment_id),
    )


def _serialize_assignment_comment(db: Session, comment: AssignmentCommentRecord) -> AssignmentCommentView:
    author = db.get(UserRecord, comment.author_user_id)
    fallback_name = "Formateur" if comment.author_role == "teacher" else "Étudiant"
    return AssignmentCommentView(
        id=comment.id,
        assignment_id=comment.assignment_id,
        enrollment_id=comment.enrollment_id,
        author_role=comment.author_role,  # type: ignore[arg-type]
        author_name=author.full_name if author else fallback_name,
        author_avatar_url=author.avatar_url if author else None,
        body=comment.body,
        attachment_url=comment.attachment_url,
        created_at=comment.created_at,
    )


@router.get("/sessions/{session_id}/assignments", response_model=list[AssignmentView])
def list_session_assignments(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[AssignmentView]:
    _get_session_for_teacher(db, session_id, current_user.full_name)
    assignments = db.scalars(
        select(AssignmentRecord).where(AssignmentRecord.session_id == session_id)
        .order_by(AssignmentRecord.due_date)
    ).all()
    return [_serialize_assignment(db, a) for a in assignments]


@router.post("/sessions/{session_id}/assignments", response_model=AssignmentView, status_code=status.HTTP_201_CREATED)
def create_assignment(
    session_id: int,
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> AssignmentView:
    session = _get_session_for_teacher(db, session_id, current_user.full_name)
    course_day = _resolve_course_day_for_session(db, session, payload.course_day_id)
    try:
        validate_live_event_in_session(session, payload.due_date)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    assignment = AssignmentRecord(
        session_id=session_id,
        course_day_id=course_day.id if course_day else None,
        title=payload.title,
        instructions=payload.instructions,
        due_date=payload.due_date,
        is_final_project=payload.is_final_project,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return _serialize_assignment(db, assignment)


@router.put("/assignments/{assignment_id}", response_model=AssignmentView)
def update_assignment(
    assignment_id: int,
    payload: AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> AssignmentView:
    assignment = _get_assignment_for_teacher(db, assignment_id, current_user.full_name)
    session = _get_session_for_teacher(db, assignment.session_id, current_user.full_name)
    if payload.title is not None:
        assignment.title = payload.title
    if "course_day_id" in payload.model_fields_set:
        course_day = _resolve_course_day_for_session(db, session, payload.course_day_id)
        assignment.course_day_id = course_day.id if course_day else None
    if payload.instructions is not None:
        assignment.instructions = payload.instructions
    if payload.due_date is not None:
        try:
            validate_live_event_in_session(session, payload.due_date)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        assignment.due_date = payload.due_date
    if payload.is_final_project is not None:
        assignment.is_final_project = payload.is_final_project
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return _serialize_assignment(db, assignment)


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> None:
    assignment = _get_assignment_for_teacher(db, assignment_id, current_user.full_name)
    db.delete(assignment)
    db.commit()


@router.get("/assignments/{assignment_id}/submissions", response_model=list[AssignmentSubmissionView])
def list_assignment_submissions(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[AssignmentSubmissionView]:
    assignment = _get_assignment_for_teacher(db, assignment_id, current_user.full_name)
    session = db.get(FormationSessionRecord, assignment.session_id)
    pairs = _students_for_session(db, session)  # type: ignore[arg-type]
    enrollment_to_name = {e.id: u.full_name for e, u in pairs}

    submissions = db.scalars(
        select(AssignmentSubmissionRecord)
        .where(AssignmentSubmissionRecord.assignment_id == assignment_id)
        .order_by(AssignmentSubmissionRecord.submitted_at)
    ).all()
    return [
        _serialize_assignment_submission(db, s, enrollment_to_name.get(s.enrollment_id, "—"))
        for s in submissions
    ]


# ══════════════════════════════════════════════════════════════════════════════
# COURSES / CHAPTERS / LESSONS
# ══════════════════════════════════════════════════════════════════════════════

def _resolve_lesson(db: Session, lesson: LessonRecord) -> LessonView:
    quiz_title = None
    assignment_title = None
    resource_title = None
    if lesson.quiz_id:
        q = db.get(QuizRecord, lesson.quiz_id)
        quiz_title = q.title if q else None
    if lesson.assignment_id:
        a = db.get(AssignmentRecord, lesson.assignment_id)
        assignment_title = a.title if a else None
    if lesson.resource_id:
        r = db.get(ResourceRecord, lesson.resource_id)
        resource_title = r.title if r else None
    return LessonView(
        id=lesson.id,
        chapter_id=lesson.chapter_id,
        title=lesson.title,
        lesson_type=lesson.lesson_type,  # type: ignore[arg-type]
        order_index=lesson.order_index,
        content=lesson.content,
        video_url=lesson.video_url,
        file_url=lesson.file_url,
        quiz_id=lesson.quiz_id,
        assignment_id=lesson.assignment_id,
        resource_id=lesson.resource_id,
        quiz_title=quiz_title,
        assignment_title=assignment_title,
        resource_title=resource_title,
        created_at=lesson.created_at,
    )


def _serialize_course(db: Session, course: CourseRecord) -> CourseView:
    chapters = db.scalars(
        select(ChapterRecord)
        .where(ChapterRecord.course_id == course.id)
        .order_by(ChapterRecord.order_index)
    ).all()
    chapter_views = []
    total_lessons = 0
    for ch in chapters:
        lessons = db.scalars(
            select(LessonRecord)
            .where(LessonRecord.chapter_id == ch.id)
            .order_by(LessonRecord.order_index)
        ).all()
        total_lessons += len(lessons)
        chapter_views.append(ChapterView(
            id=ch.id,
            course_id=ch.course_id,
            title=ch.title,
            order_index=ch.order_index,
            lessons=[_resolve_lesson(db, l) for l in lessons],
            created_at=ch.created_at,
        ))
    return CourseView(
        id=course.id,
        session_id=course.session_id,
        title=course.title,
        description=course.description,
        chapters=chapter_views,
        total_lessons=total_lessons,
        created_at=course.created_at,
        updated_at=course.updated_at,
    )


def _get_course_for_teacher(db: Session, course_id: int, teacher_name: str) -> CourseRecord:
    course = db.get(CourseRecord, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Cours introuvable.")
    session = db.get(FormationSessionRecord, course.session_id)
    if not session or session.teacher_name != teacher_name:
        raise HTTPException(status_code=403, detail="Ce cours ne vous appartient pas.")
    return course


def _get_chapter_for_teacher(db: Session, chapter_id: int, teacher_name: str) -> ChapterRecord:
    chapter = db.get(ChapterRecord, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapitre introuvable.")
    _get_course_for_teacher(db, chapter.course_id, teacher_name)
    return chapter


def _get_lesson_for_teacher(db: Session, lesson_id: int, teacher_name: str) -> LessonRecord:
    lesson = db.get(LessonRecord, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Leçon introuvable.")
    _get_chapter_for_teacher(db, lesson.chapter_id, teacher_name)
    return lesson


# ── Course CRUD ───────────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/courses", response_model=list[CourseView])
def list_session_courses(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[CourseView]:
    _get_session_for_teacher(db, session_id, current_user.full_name)
    courses = db.scalars(
        select(CourseRecord).where(CourseRecord.session_id == session_id).order_by(CourseRecord.created_at)
    ).all()
    return [_serialize_course(db, c) for c in courses]


@router.post("/sessions/{session_id}/courses", response_model=CourseView, status_code=201)
def create_course(
    session_id: int,
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> CourseView:
    _get_session_for_teacher(db, session_id, current_user.full_name)
    course = CourseRecord(session_id=session_id, title=payload.title, description=payload.description)
    db.add(course)
    db.commit()
    db.refresh(course)
    return _serialize_course(db, course)


@router.put("/courses/{course_id}", response_model=CourseView)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> CourseView:
    course = _get_course_for_teacher(db, course_id, current_user.full_name)
    if payload.title is not None:
        course.title = payload.title
    if payload.description is not None:
        course.description = payload.description
    db.add(course)
    db.commit()
    db.refresh(course)
    return _serialize_course(db, course)


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> None:
    course = _get_course_for_teacher(db, course_id, current_user.full_name)
    db.delete(course)
    db.commit()


# ── Chapter CRUD ──────────────────────────────────────────────────────────────

@router.post("/courses/{course_id}/chapters", response_model=ChapterView, status_code=201)
def create_chapter(
    course_id: int,
    payload: ChapterCreate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> ChapterView:
    _get_course_for_teacher(db, course_id, current_user.full_name)
    chapter = ChapterRecord(course_id=course_id, title=payload.title, order_index=payload.order_index)
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return ChapterView(id=chapter.id, course_id=chapter.course_id, title=chapter.title,
                       order_index=chapter.order_index, lessons=[], created_at=chapter.created_at)


@router.put("/chapters/{chapter_id}", response_model=ChapterView)
def update_chapter(
    chapter_id: int,
    payload: ChapterUpdate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> ChapterView:
    chapter = _get_chapter_for_teacher(db, chapter_id, current_user.full_name)
    if payload.title is not None:
        chapter.title = payload.title
    if payload.order_index is not None:
        chapter.order_index = payload.order_index
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    lessons = db.scalars(
        select(LessonRecord).where(LessonRecord.chapter_id == chapter.id).order_by(LessonRecord.order_index)
    ).all()
    return ChapterView(id=chapter.id, course_id=chapter.course_id, title=chapter.title,
                       order_index=chapter.order_index,
                       lessons=[_resolve_lesson(db, l) for l in lessons],
                       created_at=chapter.created_at)


@router.delete("/chapters/{chapter_id}", status_code=204)
def delete_chapter(
    chapter_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> None:
    chapter = _get_chapter_for_teacher(db, chapter_id, current_user.full_name)
    db.delete(chapter)
    db.commit()


# ── Lesson CRUD ───────────────────────────────────────────────────────────────

@router.post("/chapters/{chapter_id}/lessons", response_model=LessonView, status_code=201)
def create_lesson(
    chapter_id: int,
    payload: LessonCreate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> LessonView:
    _get_chapter_for_teacher(db, chapter_id, current_user.full_name)
    lesson = LessonRecord(
        chapter_id=chapter_id,
        title=payload.title,
        lesson_type=payload.lesson_type,
        order_index=payload.order_index,
        content=payload.content,
        video_url=payload.video_url,
        file_url=payload.file_url,
        quiz_id=payload.quiz_id,
        assignment_id=payload.assignment_id,
        resource_id=payload.resource_id,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return _resolve_lesson(db, lesson)


@router.put("/lessons/{lesson_id}", response_model=LessonView)
def update_lesson(
    lesson_id: int,
    payload: LessonUpdate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> LessonView:
    lesson = _get_lesson_for_teacher(db, lesson_id, current_user.full_name)
    for field in ("title", "lesson_type", "order_index", "content", "video_url",
                  "file_url", "quiz_id", "assignment_id", "resource_id"):
        val = getattr(payload, field)
        if val is not None:
            setattr(lesson, field, val)
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return _resolve_lesson(db, lesson)


@router.delete("/lessons/{lesson_id}", status_code=204)
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> None:
    lesson = _get_lesson_for_teacher(db, lesson_id, current_user.full_name)
    db.delete(lesson)
    db.commit()


@router.patch("/submissions/{submission_id}/review", response_model=AssignmentSubmissionView)
def mark_submission_reviewed(
    submission_id: int,
    payload: AssignmentReviewPayload | None = None,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> AssignmentSubmissionView:
    submission = db.scalar(select(AssignmentSubmissionRecord).where(AssignmentSubmissionRecord.id == submission_id))
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soumission introuvable.")
    assignment = _get_assignment_for_teacher(db, submission.assignment_id, current_user.full_name)
    session = db.get(FormationSessionRecord, assignment.session_id)
    pairs = _students_for_session(db, session)  # type: ignore[arg-type]
    enrollment_to_name = {e.id: u.full_name for e, u in pairs}
    submission.is_reviewed = True
    if payload and payload.review_score is not None:
        if payload.review_score > payload.review_max_score:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La note ne peut pas dépasser le barème.",
            )
        submission.review_score = payload.review_score
        submission.review_max_score = payload.review_max_score
        grade_label = f"{'Projet final' if assignment.is_final_project else 'Devoir'}: {assignment.title}"
        grade_query = select(GradeRecord).where(
            GradeRecord.session_id == assignment.session_id,
            GradeRecord.enrollment_id == submission.enrollment_id,
            GradeRecord.label == grade_label,
        )
        if assignment.course_day_id is not None:
            grade_query = grade_query.where(GradeRecord.course_day_id == assignment.course_day_id)
        else:
            grade_query = grade_query.where(GradeRecord.course_day_id.is_(None))
        grade = db.scalar(grade_query)
        if grade:
            grade.score = payload.review_score
            grade.max_score = payload.review_max_score
            grade.note = "Note automatique depuis la correction du devoir."
        else:
            db.add(GradeRecord(
                session_id=assignment.session_id,
                enrollment_id=submission.enrollment_id,
                course_day_id=assignment.course_day_id,
                label=grade_label,
                score=payload.review_score,
                max_score=payload.review_max_score,
                note="Note automatique depuis la correction du devoir.",
            ))
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return _serialize_assignment_submission(
        db,
        submission,
        enrollment_to_name.get(submission.enrollment_id, "—"),
    )


@router.get(
    "/assignments/{assignment_id}/enrollments/{enrollment_id}/comments",
    response_model=list[AssignmentCommentView],
)
def list_assignment_comments_for_student(
    assignment_id: int,
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> list[AssignmentCommentView]:
    assignment = _get_assignment_for_teacher(db, assignment_id, current_user.full_name)
    enrollment = db.get(EnrollmentRecord, enrollment_id)
    if not enrollment or enrollment.session_id != assignment.session_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Étudiant introuvable pour ce devoir.")

    comments = db.scalars(
        select(AssignmentCommentRecord)
        .where(
            AssignmentCommentRecord.assignment_id == assignment_id,
            AssignmentCommentRecord.enrollment_id == enrollment_id,
        )
        .order_by(AssignmentCommentRecord.created_at)
    ).all()
    return [_serialize_assignment_comment(db, comment) for comment in comments]


@router.post(
    "/assignments/{assignment_id}/enrollments/{enrollment_id}/comments",
    response_model=AssignmentCommentView,
    status_code=status.HTTP_201_CREATED,
)
def create_assignment_comment_for_student(
    assignment_id: int,
    enrollment_id: int,
    payload: AssignmentCommentCreate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(_teacher),
) -> AssignmentCommentView:
    assignment = _get_assignment_for_teacher(db, assignment_id, current_user.full_name)
    enrollment = db.get(EnrollmentRecord, enrollment_id)
    if not enrollment or enrollment.session_id != assignment.session_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Étudiant introuvable pour ce devoir.")

    comment = AssignmentCommentRecord(
        assignment_id=assignment_id,
        enrollment_id=enrollment_id,
        author_user_id=current_user.id,
        author_role="teacher",
        body=payload.body or "",
        attachment_url=payload.attachment_url,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _serialize_assignment_comment(db, comment)


# ══════════════════════════════════════════════════════════════════════════════
# UPLOADS  (images ≤2MB · PDF ≤5MB · vidéos ≤30MB · DOCX ≤10MB · ZIP/RAR ≤50MB)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/uploads", response_model=AdminUploadedAsset, status_code=status.HTTP_201_CREATED)
async def upload_teacher_asset(
    request: Request,
    filename: str = Query(min_length=1, max_length=255),
    current_user: UserRecord = Depends(_teacher),
) -> AdminUploadedAsset:
    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="Aucun fichier reçu.")

    original_name = Path(filename).name.strip()
    extension = Path(original_name).suffix.lower()
    content_type = (
        request.headers.get("content-type", "application/octet-stream")
        .split(";")[0].strip().lower()
    )

    if extension in _ALLOWED_IMAGE_EXT:
        if content_type not in _IMAGE_CT:
            raise HTTPException(status_code=400, detail="Type d'image invalide. Formats acceptés: JPG, PNG, WebP.")
        max_bytes = MAX_IMAGE_BYTES
    elif extension in _ALLOWED_VIDEO_EXT:
        if content_type not in _VIDEO_CT:
            raise HTTPException(status_code=400, detail="Type vidéo invalide. Formats acceptés: MP4, WebM, MOV.")
        max_bytes = MAX_VIDEO_BYTES
    elif extension in _ALLOWED_PDF_EXT:
        if content_type not in _PDF_CT:
            raise HTTPException(status_code=400, detail="Type de fichier invalide. Seuls les PDF sont acceptés pour ce format.")
        max_bytes = MAX_PDF_BYTES
    elif extension in _ALLOWED_ARCHIVE_EXT:
        if content_type not in _ARCHIVE_CT:
            raise HTTPException(status_code=400, detail="Type d'archive invalide. Formats acceptés: ZIP, RAR.")
        max_bytes = MAX_ARCHIVE_BYTES
    elif extension in _ALLOWED_DOC_EXT:
        if content_type not in _DOC_CT:
            raise HTTPException(status_code=400, detail="Type de document invalide. Seuls les fichiers DOCX sont acceptés pour ce format.")
        max_bytes = MAX_DOC_BYTES
    else:
        raise HTTPException(
            status_code=400,
            detail="Extension non supportée. Utilisez JPG/PNG/WebP (images), MP4/WebM/MOV (vidéos), PDF, ZIP, RAR ou DOCX.",
        )

    if len(raw) > max_bytes:
        limit_label = (
            "2 Mo" if extension in _ALLOWED_IMAGE_EXT
            else "5 Mo" if extension in _ALLOWED_PDF_EXT
            else "30 Mo" if extension in _ALLOWED_VIDEO_EXT
            else "10 Mo" if extension in _ALLOWED_DOC_EXT
            else "50 Mo"
        )
        raise HTTPException(status_code=400, detail=f"Fichier trop volumineux. Limite: {limit_label}.")

    stored_name = f"{uuid4().hex}{extension}"
    destination = TEACHER_UPLOAD_ROOT / stored_name
    destination.write_bytes(raw)

    public_path = f"/uploads/teacher-media/{stored_name}"
    public_url = f"{str(request.base_url).rstrip('/')}{public_path}"
    return AdminUploadedAsset(
        filename=original_name,
        path=public_path,
        public_url=public_url,
        content_type=content_type,
        size=len(raw),
    )
