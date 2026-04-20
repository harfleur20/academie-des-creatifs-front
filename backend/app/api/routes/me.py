from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.security import hash_password, verify_password
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
    LessonCompletionRecord,
    LessonProgressRecord,
    LessonRecord,
    OrderRecord,
    PaymentRecord,
    QuizAttemptRecord,
    QuizQuestionRecord,
    QuizRecord,
    ResourceRecord,
    SessionCourseDayRecord,
    SessionLiveEventRecord,
    UserRecord,
)
from app.schemas.catalog import AdminUploadedAsset
from app.schemas.commerce import (
    AssignmentCommentCreate,
    AssignmentCommentView,
    AssignmentStudentStatus,
    AssignmentSubmitPayload,
    AttemptStatus,
    CertificateView,
    EnrollmentProgress,
    EnrollmentView,
    LessonKey,
    NotificationView,
    PaymentCheckoutPayload,
    QuizAnswerPayload,
    StudentAssignmentView,
    StudentDashboardSummary,
    StudentOrderGroupView,
    StudentOrderView,
    StudentPaymentLineView,
    StudentChapterView,
    StudentCourseDayView,
    StudentCourseView,
    StudentLessonView,
    StudentQuizAttemptView,
    StudentQuizQuestionView,
    StudentQuizView,
    StudentSessionView,
    StudentResourceView,
    CheckoutResponse,
)
from app.schemas.teacher import StudentLiveEventView
from app.services.badge import (
    compute_enrollment_badge_progress,
)
from app.services.catalog import format_fcfa
from app.services.commerce import (
    build_assigned_teacher_view,
    build_grouped_orders,
    checkout_student_payment,
    get_student_dashboard_summary,
    list_user_enrollments,
    list_user_notifications,
)
from app.services.payments import payment_due_label, refresh_payment_states

QUIZ_RETRY_HOURS = 8
QUIZ_PASS_PCT = 80.0

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


@router.get("/sessions", response_model=list[StudentSessionView])
def read_my_sessions(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[StudentSessionView]:
    from sqlalchemy import select as sa_select

    teacher_cache = {}
    rows = db.execute(
        sa_select(FormationSessionRecord, FormationRecord)
        .join(EnrollmentRecord, EnrollmentRecord.session_id == FormationSessionRecord.id)
        .join(FormationRecord, FormationRecord.id == FormationSessionRecord.formation_id)
        .where(
            EnrollmentRecord.user_id == current_user.id,
            EnrollmentRecord.status.in_(["active", "pending"]),
            FormationSessionRecord.status.notin_(["cancelled"]),
        )
        .order_by(FormationSessionRecord.start_date.asc())
    ).all()
    return [
        StudentSessionView(
            id=s.id,
            formation_id=f.id,
            formation_title=f.title,
            formation_slug=f.slug,
            format_type=f.format_type,  # type: ignore[arg-type]
            label=s.label,
            start_date=s.start_date,
            end_date=s.end_date,
            teacher_name=s.teacher_name,
            assigned_teacher=build_assigned_teacher_view(db, s, cache=teacher_cache),
            campus_label=s.campus_label,
            meeting_link=s.meeting_link,
            status=s.status,
        )
        for s, f in rows
    ]


def _count_course_day_rows(db: Session, model: type, course_day_id: int) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(model)
            .where(model.course_day_id == course_day_id)
        )
        or 0
    )


@router.get("/course-days", response_model=list[StudentCourseDayView])
def read_my_course_days(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[StudentCourseDayView]:
    session_ids = _enrolled_session_ids(db, current_user.id)
    if not session_ids:
        return []

    days = db.scalars(
        select(SessionCourseDayRecord)
        .where(SessionCourseDayRecord.session_id.in_(session_ids))
        .order_by(SessionCourseDayRecord.scheduled_at)
    ).all()

    return [
        StudentCourseDayView(
            id=day.id,
            session_id=day.session_id,
            live_event_id=day.live_event_id,
            title=day.title,
            scheduled_at=day.scheduled_at,
            duration_minutes=day.duration_minutes,
            status=day.status,
            attendance_count=_count_course_day_rows(db, AttendanceRecord, day.id),
            present_count=int(db.scalar(select(func.count()).select_from(AttendanceRecord).where(
                AttendanceRecord.course_day_id == day.id,
                AttendanceRecord.status == "present",
            )) or 0),
            absent_count=int(db.scalar(select(func.count()).select_from(AttendanceRecord).where(
                AttendanceRecord.course_day_id == day.id,
                AttendanceRecord.status == "absent",
            )) or 0),
            late_count=int(db.scalar(select(func.count()).select_from(AttendanceRecord).where(
                AttendanceRecord.course_day_id == day.id,
                AttendanceRecord.status == "late",
            )) or 0),
            excused_count=int(db.scalar(select(func.count()).select_from(AttendanceRecord).where(
                AttendanceRecord.course_day_id == day.id,
                AttendanceRecord.status == "excused",
            )) or 0),
            quiz_count=_count_course_day_rows(db, QuizRecord, day.id),
            assignment_count=_count_course_day_rows(db, AssignmentRecord, day.id),
            resource_count=_count_course_day_rows(db, ResourceRecord, day.id),
            grade_count=_count_course_day_rows(db, GradeRecord, day.id),
            created_at=day.created_at,
        )
        for day in days
    ]


_AVATAR_ROOT = Path(__file__).resolve().parents[3] / "uploads" / "avatars"
_AVATAR_ROOT.mkdir(parents=True, exist_ok=True)
_AVATAR_MAX_BYTES = 2 * 1024 * 1024
_AVATAR_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
_AVATAR_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}

_STUDENT_UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "uploads" / "student-media"
_STUDENT_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
_ALLOWED_STUDENT_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
_ALLOWED_STUDENT_VIDEO_EXT = {".mp4", ".webm", ".mov"}
_ALLOWED_STUDENT_PDF_EXT = {".pdf"}
_ALLOWED_STUDENT_ARCHIVE_EXT = {".zip", ".rar"}
_ALLOWED_STUDENT_DOC_EXT = {".docx"}
_STUDENT_IMAGE_CT = {"image/png", "image/jpeg", "image/webp"}
_STUDENT_VIDEO_CT = {"video/mp4", "video/webm", "video/quicktime"}
_STUDENT_PDF_CT = {"application/pdf"}
_STUDENT_ARCHIVE_CT = {
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/vnd.rar",
    "application/octet-stream",
}
_STUDENT_DOC_CT = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
}
_STUDENT_MAX_IMAGE_BYTES = 2 * 1024 * 1024
_STUDENT_MAX_VIDEO_BYTES = 30 * 1024 * 1024
_STUDENT_MAX_PDF_BYTES = 5 * 1024 * 1024
_STUDENT_MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
_STUDENT_MAX_DOC_BYTES = 10 * 1024 * 1024


class UpdateProfilePayload(BaseModel):
    full_name: str
    phone: str | None = None


class UpdateProfileResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None


@router.patch("/profile", response_model=UpdateProfileResponse)
def update_profile(
    payload: UpdateProfilePayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> UpdateProfileResponse:
    name = payload.full_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Le nom ne peut pas être vide.")
    current_user.full_name = name
    current_user.phone = payload.phone.strip() if payload.phone else None
    db.add(current_user)
    db.commit()
    return UpdateProfileResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        phone=current_user.phone,
    )


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password", status_code=204)
def change_password(
    payload: ChangePasswordPayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 8 caractères.")
    current_user.password_hash = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()


class AvatarResponse(BaseModel):
    avatar_url: str


@router.post("/avatar", response_model=AvatarResponse)
async def upload_avatar(
    request: Request,
    filename: str = Query(min_length=1, max_length=255),
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> AvatarResponse:
    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="Aucun fichier reçu.")

    extension = Path(filename).suffix.lower()
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()

    if extension not in _AVATAR_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez PNG, JPG ou WebP.")
    if content_type not in _AVATAR_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Type MIME invalide.")
    if len(raw) > _AVATAR_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image trop volumineuse (max 2 Mo).")

    # Delete old avatar file if stored locally
    if current_user.avatar_url and current_user.avatar_url.startswith("/uploads/avatars/"):
        old_file = _AVATAR_ROOT / Path(current_user.avatar_url).name
        if old_file.exists():
            old_file.unlink(missing_ok=True)

    stored_name = f"{uuid4().hex}{extension}"
    (_AVATAR_ROOT / stored_name).write_bytes(raw)

    public_path = f"/uploads/avatars/{stored_name}"
    public_url = f"{str(request.base_url).rstrip('/')}{public_path}"

    current_user.avatar_url = public_url
    db.add(current_user)
    db.commit()

    return AvatarResponse(avatar_url=public_url)


@router.post("/uploads", response_model=AdminUploadedAsset, status_code=status.HTTP_201_CREATED)
async def upload_student_asset(
    request: Request,
    filename: str = Query(min_length=1, max_length=255),
    current_user: UserRecord = Depends(get_current_user),
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

    if extension in _ALLOWED_STUDENT_IMAGE_EXT:
        if content_type not in _STUDENT_IMAGE_CT:
            raise HTTPException(status_code=400, detail="Type d'image invalide. Formats acceptés: JPG, PNG, WebP.")
        max_bytes = _STUDENT_MAX_IMAGE_BYTES
    elif extension in _ALLOWED_STUDENT_VIDEO_EXT:
        if content_type not in _STUDENT_VIDEO_CT:
            raise HTTPException(status_code=400, detail="Type vidéo invalide. Formats acceptés: MP4, WebM, MOV.")
        max_bytes = _STUDENT_MAX_VIDEO_BYTES
    elif extension in _ALLOWED_STUDENT_PDF_EXT:
        if content_type not in _STUDENT_PDF_CT:
            raise HTTPException(status_code=400, detail="Type de fichier invalide. Seuls les PDF sont acceptés pour ce format.")
        max_bytes = _STUDENT_MAX_PDF_BYTES
    elif extension in _ALLOWED_STUDENT_ARCHIVE_EXT:
        if content_type not in _STUDENT_ARCHIVE_CT:
            raise HTTPException(status_code=400, detail="Type d'archive invalide. Formats acceptés: ZIP, RAR.")
        max_bytes = _STUDENT_MAX_ARCHIVE_BYTES
    elif extension in _ALLOWED_STUDENT_DOC_EXT:
        if content_type not in _STUDENT_DOC_CT:
            raise HTTPException(status_code=400, detail="Type de document invalide. Seuls les fichiers DOCX sont acceptés pour ce format.")
        max_bytes = _STUDENT_MAX_DOC_BYTES
    else:
        raise HTTPException(
            status_code=400,
            detail="Extension non supportée. Utilisez JPG/PNG/WebP, MP4/WebM/MOV, PDF, ZIP, RAR ou DOCX.",
        )

    if len(raw) > max_bytes:
        limit_label = (
            "2 Mo" if extension in _ALLOWED_STUDENT_IMAGE_EXT
            else "5 Mo" if extension in _ALLOWED_STUDENT_PDF_EXT
            else "30 Mo" if extension in _ALLOWED_STUDENT_VIDEO_EXT
            else "10 Mo" if extension in _ALLOWED_STUDENT_DOC_EXT
            else "50 Mo"
        )
        raise HTTPException(status_code=400, detail=f"Fichier trop volumineux. Limite: {limit_label}.")

    stored_name = f"{current_user.id}-{uuid4().hex}{extension}"
    destination = _STUDENT_UPLOAD_ROOT / stored_name
    destination.write_bytes(raw)

    public_path = f"/uploads/student-media/{stored_name}"
    public_url = f"{str(request.base_url).rstrip('/')}{public_path}"
    return AdminUploadedAsset(
        filename=original_name,
        path=public_path,
        public_url=public_url,
        content_type=content_type,
        size=len(raw),
    )


def _get_enrollment_or_404(
    db: Session, enrollment_id: int, user_id: int
) -> EnrollmentRecord:
    enrollment = db.scalar(
        select(EnrollmentRecord).where(
            EnrollmentRecord.id == enrollment_id,
            EnrollmentRecord.user_id == user_id,
            EnrollmentRecord.status.in_(["active", "completed"]),
        )
    )
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inscription introuvable.")
    return enrollment


def _count_total_lessons(db: Session, formation_id: int) -> int:
    formation = db.scalar(select(FormationRecord).where(FormationRecord.id == formation_id))
    if not formation or not formation.module_items:
        return 0
    return sum(len(m.get("lessons", [])) for m in formation.module_items)


def _build_progress(
    db: Session, enrollment: EnrollmentRecord
) -> EnrollmentProgress:
    rows = db.scalars(
        select(LessonCompletionRecord).where(
            LessonCompletionRecord.enrollment_id == enrollment.id
        )
    ).all()
    total = _count_total_lessons(db, enrollment.formation_id)
    completed_count = len(rows)
    progress_pct = round((completed_count / total) * 100) if total > 0 else 0
    return EnrollmentProgress(
        enrollment_id=enrollment.id,
        completed=[LessonKey(module_index=r.module_index, lesson_index=r.lesson_index) for r in rows],
        total_lessons=total,
        completed_count=completed_count,
        progress_pct=progress_pct,
    )


@router.get("/enrollments/{enrollment_id}/progress", response_model=EnrollmentProgress)
def read_enrollment_progress(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> EnrollmentProgress:
    enrollment = _get_enrollment_or_404(db, enrollment_id, current_user.id)
    return _build_progress(db, enrollment)


@router.get("/enrollments/{enrollment_id}/certificate", response_model=CertificateView)
def read_enrollment_certificate(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> CertificateView:
    from datetime import date as date_type
    enrollment = _get_enrollment_or_404(db, enrollment_id, current_user.id)

    # Eligibility check
    if enrollment.dashboard_type == "classic":
        prog = _build_progress(db, enrollment)
        if prog.progress_pct < 100:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Certificat non disponible : parcours incomplet.",
            )
    else:
        if enrollment.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Certificat non disponible : parcours non validé.",
            )

    formation = db.scalar(select(FormationRecord).where(FormationRecord.id == enrollment.formation_id))
    mentor_name = formation.mentor_name if formation else ""
    level = formation.level if formation else ""

    today = date_type.today()
    issued_date = today.strftime("%d %B %Y").lstrip("0")
    certificate_number = f"AC-{today.year}-{enrollment_id:05d}"

    return CertificateView(
        enrollment_id=enrollment_id,
        certificate_number=certificate_number,
        student_name=current_user.full_name,
        formation_title=enrollment.formation_title,
        format_type=enrollment.format_type,
        dashboard_type=enrollment.dashboard_type,
        mentor_name=mentor_name,
        level=level,
        session_label=formation.session_label if formation else "",
        issued_date=issued_date,
    )


@router.get("/orders", response_model=list[StudentOrderGroupView])
def read_my_orders(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[StudentOrderGroupView]:
    refresh_payment_states(db)
    orders = db.scalars(
        select(OrderRecord)
        .where(OrderRecord.user_id == current_user.id)
        .where(OrderRecord.status != "cancelled")
        .order_by(OrderRecord.created_at.asc())
    ).all()
    return build_grouped_orders(db, list(orders))


@router.post("/orders/{group_reference}/installments/{installment_key}/checkout", response_model=CheckoutResponse)
def checkout_group_installment(
    group_reference: str,
    installment_key: str,
    payload: PaymentCheckoutPayload = Body(default_factory=PaymentCheckoutPayload),
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> CheckoutResponse:
    from app.services.commerce import checkout_student_payment
    from app.services.tara_money import (
        build_tara_payment_product_id,
        build_tara_return_url,
        build_tara_webhook_url,
        create_tara_payment_link,
        is_tara_money_configured,
    )
    from app.services.catalog import format_fcfa
    from app.core.config import settings
    from app.services.stripe_payments import (
        build_stripe_cancel_url,
        build_stripe_line_item,
        build_stripe_success_url,
        create_stripe_checkout_session,
        is_stripe_configured,
    )

    refresh_payment_states(db)

    # find all orders in this group belonging to current user
    orders = db.scalars(
        select(OrderRecord).where(
            (OrderRecord.group_reference == group_reference) | (OrderRecord.reference == group_reference),
            OrderRecord.user_id == current_user.id,
        )
    ).all()
    if not orders:
        raise HTTPException(status_code=404, detail="Groupe de commandes introuvable.")

    order_refs = [o.reference for o in orders]
    open_payment_statement = (
        select(PaymentRecord).where(
            PaymentRecord.order_reference.in_(order_refs),
            PaymentRecord.status.in_({"pending", "failed"}),
        )
    )
    normalized_installment_key = installment_key.strip().lower()
    single_payment_keys = {"single", "unique", "full", "0", "none", "null"}
    installment_number: int | None = None

    if normalized_installment_key in single_payment_keys:
        payment_statement = open_payment_statement.where(PaymentRecord.installment_number.is_(None))
    else:
        try:
            installment_number = int(normalized_installment_key)
        except ValueError as error:
            raise HTTPException(status_code=400, detail="Tranche de paiement invalide.") from error
        if installment_number <= 0:
            payment_statement = open_payment_statement.where(PaymentRecord.installment_number.is_(None))
            installment_number = None
        else:
            payment_statement = open_payment_statement.where(
                PaymentRecord.installment_number == installment_number
            )

    payments = db.scalars(payment_statement).all()
    if not payments and installment_number == 1:
        # Compatibility with the first grouped-payment UI, which sent `1` for
        # legacy single payments where installment_number is NULL.
        payments = db.scalars(
            open_payment_statement.where(PaymentRecord.installment_number.is_(None))
        ).all()
        if payments:
            installment_number = None

    if not payments:
        raise HTTPException(status_code=400, detail="Aucun paiement à régler pour cette tranche.")

    # single payment in group → delegate to existing handler
    if len(payments) == 1:
        return checkout_student_payment(db, current_user, payments[0].id, payload.payment_provider)

    # multiple payments → create combined checkout link
    total = sum(p.amount for p in payments)
    n = len(orders)
    picture_url = f"{settings.backend_public_url}/logo_academie_hd.png"
    payment_label = (
        f"Tranche {installment_number}"
        if installment_number is not None
        else "Paiement unique"
    )
    order_title_by_ref = {order.reference: order.formation_title for order in orders}
    selected_order_refs = list(dict.fromkeys(p.order_reference for p in payments))

    if payload.payment_provider == "stripe":
        if not is_stripe_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Stripe n'est pas configuré sur ce serveur.",
            )
        try:
            checkout_url = create_stripe_checkout_session(
                order_references=selected_order_refs,
                line_items=[
                    build_stripe_line_item(
                        name=f"{order_title_by_ref.get(p.order_reference, 'Formation')} - {payment_label.lower()}",
                        amount=p.amount,
                        currency=p.currency,
                    )
                    for p in payments
                ],
                success_url=build_stripe_success_url(settings.frontend_url),
                cancel_url=build_stripe_cancel_url(settings.frontend_url),
                customer_email=current_user.email,
                payment_ids=[p.id for p in payments],
            )
        except Exception as error:
            db.rollback()
            raise HTTPException(status_code=502, detail=f"Stripe: {error}") from error

        for p in payments:
            p.provider_code = "stripe"
            p.provider_checkout_url = checkout_url
            if p.status == "failed":
                p.status = "pending"
            db.add(p)
        db.commit()
        return CheckoutResponse(
            message="Session Stripe générée pour cette tranche groupée.",
            redirect_path="/espace/etudiant/paiements",
            external_redirect_url=checkout_url,
            payment_provider="stripe",
            processed_items=len(payments),
            order_references=selected_order_refs,
        )

    if not is_tara_money_configured():
        # mock: confirm all
        from app.services.commerce import utc_now
        from app.services.order_access import sync_order_enrollment_access
        from app.services.order_confirmations import send_order_confirmation_for_orders
        now = utc_now()
        for p in payments:
            p.status = "confirmed"
            p.paid_at = now
            db.add(p)
        db.flush()
        for ref in order_refs:
            refresh_payment_states(db, order_reference=ref)
            sync_order_enrollment_access(db, ref)
        db.commit()
        send_order_confirmation_for_orders(db, order_refs)
        return CheckoutResponse(
            message="Tranche confirmée en mode simulation.",
            redirect_path="/espace/etudiant/paiements",
            processed_items=len(payments),
            order_references=order_refs,
        )

    product_id = build_tara_payment_product_id([p.id for p in payments])
    try:
        payment_links = create_tara_payment_link(
            product_id=product_id,
            product_name=f"{payment_label} — {n} formations",
            product_price=total,
            product_description=f"Règlement groupé ({payment_label.lower()}) pour {n} formations.",
            product_picture_url=picture_url,
            return_url=build_tara_return_url(order_refs),
            webhook_url=build_tara_webhook_url(),
        )
    except ValueError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    checkout_url = payment_links.preferred_redirect_url()
    for p in payments:
        p.provider_code = "tara_money"
        p.provider_payment_id = product_id
        p.provider_checkout_url = checkout_url
        if p.status == "failed":
            p.status = "pending"
        db.add(p)
    db.commit()
    return CheckoutResponse(
        message="Lien Tara Money généré pour cette tranche groupée.",
        redirect_path="/espace/etudiant/paiements",
        external_redirect_url=checkout_url,
        payment_provider="tara_money",
        processed_items=len(payments),
        order_references=order_refs,
        payment_links={
            "whatsapp_link": payment_links.whatsapp_link,
            "telegram_link": payment_links.telegram_link,
            "dikalo_link": payment_links.dikalo_link,
            "sms_link": payment_links.sms_link,
        },
    )


@router.post("/payments/{payment_id}/checkout", response_model=CheckoutResponse)
def checkout_my_payment(
    payment_id: int,
    payload: PaymentCheckoutPayload = Body(default_factory=PaymentCheckoutPayload),
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> CheckoutResponse:
    return checkout_student_payment(db, current_user, payment_id, payload.payment_provider)


# ── helpers: student enrollment → session ids ──────────────────────────────

def _enrolled_session_ids(db: Session, user_id: int) -> list[int]:
    rows = db.scalars(
        select(EnrollmentRecord.session_id)
        .where(
            EnrollmentRecord.user_id == user_id,
            EnrollmentRecord.session_id.isnot(None),
            EnrollmentRecord.status.in_(["active", "completed"]),
        )
    ).all()
    return [r for r in rows if r is not None]


def _enrollment_for_session(db: Session, user_id: int, session_id: int) -> EnrollmentRecord | None:
    return db.scalar(
        select(EnrollmentRecord).where(
            EnrollmentRecord.user_id == user_id,
            EnrollmentRecord.session_id == session_id,
            EnrollmentRecord.status.in_(["active", "completed"]),
        )
    )


def _session_label(db: Session, session_id: int) -> str:
    s = db.get(FormationSessionRecord, session_id)
    return s.label if s else f"Session {session_id}"


def _formation_title_for_session(db: Session, session_id: int) -> str:
    s = db.get(FormationSessionRecord, session_id)
    if s is None:
        return ""
    f = db.get(FormationRecord, s.formation_id)
    return f.title if f else ""


# ── quizzes ────────────────────────────────────────────────────────────────

def _build_attempt_status(
    attempts: list[QuizAttemptRecord],
    now: datetime,
) -> tuple[AttemptStatus, datetime | None]:
    if not attempts:
        return "not_started", None

    best = max(a.score_pct for a in attempts)
    if best >= QUIZ_PASS_PCT:
        return "passed", None

    last = max(attempts, key=lambda a: a.attempt_number)
    if last.attempt_number == 1:
        return "failed_retry_now", None
    if last.attempt_number == 2:
        unlock_at = last.submitted_at + timedelta(hours=QUIZ_RETRY_HOURS)
        if now < unlock_at:
            return "failed_retry_after", unlock_at
        return "failed_retry_now", None
    return "failed_no_retry", None


@router.get("/quizzes", response_model=list[StudentQuizView])
def read_my_quizzes(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[StudentQuizView]:
    session_ids = _enrolled_session_ids(db, current_user.id)
    if not session_ids:
        return []

    now = datetime.now(UTC)
    quizzes = db.scalars(
        select(QuizRecord)
        .where(QuizRecord.session_id.in_(session_ids))
        .order_by(QuizRecord.scheduled_at.nullslast(), QuizRecord.created_at)
    ).all()

    result: list[StudentQuizView] = []
    for quiz in quizzes:
        enrollment = _enrollment_for_session(db, current_user.id, quiz.session_id)
        if not enrollment:
            continue

        attempts = db.scalars(
            select(QuizAttemptRecord).where(
                QuizAttemptRecord.quiz_id == quiz.id,
                QuizAttemptRecord.enrollment_id == enrollment.id,
            ).order_by(QuizAttemptRecord.attempt_number)
        ).all()

        attempt_status, next_at = _build_attempt_status(list(attempts), now)
        best_score = max((a.score_pct for a in attempts), default=None)

        questions_raw = db.scalars(
            select(QuizQuestionRecord)
            .where(QuizQuestionRecord.quiz_id == quiz.id)
            .order_by(QuizQuestionRecord.order_index)
        ).all()

        # Only expose questions if quiz is active
        questions: list[StudentQuizQuestionView] = []
        if quiz.status == "active":
            questions = [
                StudentQuizQuestionView(id=q.id, order_index=q.order_index, text=q.text, options=q.options)
                for q in questions_raw
            ]

        correct_by_id = {q.id: q.correct_index for q in questions_raw}

        result.append(StudentQuizView(
            id=quiz.id,
            session_id=quiz.session_id,
            session_label=_session_label(db, quiz.session_id),
            formation_title=_formation_title_for_session(db, quiz.session_id),
            title=quiz.title,
            scheduled_at=quiz.scheduled_at,
            duration_minutes=quiz.duration_minutes,
            status=quiz.status,
            attempt_status=attempt_status,
            next_attempt_available_at=next_at,
            best_score_pct=best_score,
            attempts=[
                StudentQuizAttemptView(
                    attempt_number=a.attempt_number,
                    score_pct=a.score_pct,
                    submitted_at=a.submitted_at,
                    correct_answers=[correct_by_id.get(q.id, 0) for q in questions_raw],
                )
                for a in attempts
            ],
            questions=questions,
        ))

    return result


@router.post("/quizzes/{quiz_id}/attempt", response_model=StudentQuizView)
def submit_quiz_attempt(
    quiz_id: int,
    payload: QuizAnswerPayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> StudentQuizView:
    now = datetime.now(UTC)
    quiz = db.get(QuizRecord, quiz_id)
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz introuvable.")
    if quiz.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ce quiz n'est pas ouvert.")

    enrollment = _enrollment_for_session(db, current_user.id, quiz.session_id)
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous n'êtes pas inscrit à cette session.")

    attempts = db.scalars(
        select(QuizAttemptRecord).where(
            QuizAttemptRecord.quiz_id == quiz_id,
            QuizAttemptRecord.enrollment_id == enrollment.id,
        ).order_by(QuizAttemptRecord.attempt_number)
    ).all()
    attempts_list = list(attempts)

    attempt_status, next_at = _build_attempt_status(attempts_list, now)
    if attempt_status in ("passed", "failed_no_retry"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aucune tentative disponible.")
    if attempt_status == "failed_retry_after":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Réessayez après {next_at.isoformat() if next_at else '8h'}.",
        )

    questions = db.scalars(
        select(QuizQuestionRecord)
        .where(QuizQuestionRecord.quiz_id == quiz_id)
        .order_by(QuizQuestionRecord.order_index)
    ).all()
    questions_list = list(questions)

    if len(payload.answers) != len(questions_list):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Attendu {len(questions_list)} réponses, reçu {len(payload.answers)}.",
        )

    correct = sum(
        1 for q, ans in zip(questions_list, payload.answers) if q.correct_index == ans
    )
    score_pct = round((correct / len(questions_list)) * 100, 1) if questions_list else 0.0

    next_attempt_number = (max(a.attempt_number for a in attempts_list) + 1) if attempts_list else 1
    db.add(QuizAttemptRecord(
        quiz_id=quiz_id,
        enrollment_id=enrollment.id,
        attempt_number=next_attempt_number,
        answers=payload.answers,
        score_pct=score_pct,
        submitted_at=now,
    ))
    best_score_pct = max([a.score_pct for a in attempts_list] + [score_pct])
    grade_label = f"Quiz: {quiz.title}"
    grade_query = select(GradeRecord).where(
        GradeRecord.session_id == quiz.session_id,
        GradeRecord.enrollment_id == enrollment.id,
        GradeRecord.label == grade_label,
    )
    if quiz.course_day_id is not None:
        grade_query = grade_query.where(GradeRecord.course_day_id == quiz.course_day_id)
    else:
        grade_query = grade_query.where(GradeRecord.course_day_id.is_(None))
    grade = db.scalar(grade_query)
    normalized_score = round((best_score_pct / 100) * 20, 2)
    if grade:
        grade.score = normalized_score
        grade.max_score = 20
        grade.note = "Note automatique depuis le quiz."
    else:
        db.add(GradeRecord(
            session_id=quiz.session_id,
            enrollment_id=enrollment.id,
            course_day_id=quiz.course_day_id,
            label=grade_label,
            score=normalized_score,
            max_score=20,
            note="Note automatique depuis le quiz.",
        ))
    db.commit()

    # Re-fetch and return full quiz view
    return next(
        (q for q in read_my_quizzes(db=db, current_user=current_user) if q.id == quiz_id),
        None,  # type: ignore[return-value]
    )


# ── resources ──────────────────────────────────────────────────────────────

@router.get("/resources", response_model=list[StudentResourceView])
def read_my_resources(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[StudentResourceView]:
    session_ids = _enrolled_session_ids(db, current_user.id)
    if not session_ids:
        return []

    now = datetime.now(UTC)
    resources = db.scalars(
        select(ResourceRecord)
        .where(
            ResourceRecord.session_id.in_(session_ids),
            (ResourceRecord.published_at.is_(None)) | (ResourceRecord.published_at <= now),
        )
        .order_by(ResourceRecord.created_at.desc())
    ).all()

    return [
        StudentResourceView(
            id=r.id,
            session_id=r.session_id,
            session_label=_session_label(db, r.session_id),
            formation_title=_formation_title_for_session(db, r.session_id),
            title=r.title,
            resource_type=r.resource_type,
            url=r.url,
            published_at=r.published_at,
            created_at=r.created_at,
        )
        for r in resources
    ]


# ── assignments ────────────────────────────────────────────────────────────

def _assignment_student_status(
    assignment: AssignmentRecord,
    submission: AssignmentSubmissionRecord | None,
    now: datetime,
) -> AssignmentStudentStatus:
    if submission:
        return "reviewed" if submission.is_reviewed else "submitted"
    if _normalize_datetime(now) > _normalize_datetime(assignment.due_date):
        return "late"
    return "pending"


def _normalize_datetime(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value


def _assignment_comment_count(db: Session, assignment_id: int, enrollment_id: int) -> int:
    return db.query(AssignmentCommentRecord).filter(
        AssignmentCommentRecord.assignment_id == assignment_id,
        AssignmentCommentRecord.enrollment_id == enrollment_id,
    ).count()


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


def _serialize_student_assignment(
    db: Session,
    assignment: AssignmentRecord,
    enrollment: EnrollmentRecord,
    submission: AssignmentSubmissionRecord | None,
    now: datetime,
) -> StudentAssignmentView:
    return StudentAssignmentView(
        id=assignment.id,
        session_id=assignment.session_id,
        session_label=_session_label(db, assignment.session_id),
        formation_title=_formation_title_for_session(db, assignment.session_id),
        title=assignment.title,
        instructions=assignment.instructions,
        due_date=assignment.due_date,
        is_final_project=assignment.is_final_project,
        student_status=_assignment_student_status(assignment, submission, now),
        submitted_at=submission.submitted_at if submission else None,
        file_url=submission.file_url if submission else None,
        is_reviewed=submission.is_reviewed if submission else False,
        review_score=submission.review_score if submission else None,
        review_max_score=submission.review_max_score if submission else 20,
        comment_count=_assignment_comment_count(db, assignment.id, enrollment.id),
    )


@router.get("/assignments", response_model=list[StudentAssignmentView])
def read_my_assignments(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[StudentAssignmentView]:
    session_ids = _enrolled_session_ids(db, current_user.id)
    if not session_ids:
        return []

    now = datetime.now(UTC)
    assignments = db.scalars(
        select(AssignmentRecord)
        .where(AssignmentRecord.session_id.in_(session_ids))
        .order_by(AssignmentRecord.due_date)
    ).all()

    result: list[StudentAssignmentView] = []
    for assignment in assignments:
        enrollment = _enrollment_for_session(db, current_user.id, assignment.session_id)
        if not enrollment:
            continue
        submission = db.scalar(
            select(AssignmentSubmissionRecord).where(
                AssignmentSubmissionRecord.assignment_id == assignment.id,
                AssignmentSubmissionRecord.enrollment_id == enrollment.id,
            )
        )
        result.append(_serialize_student_assignment(db, assignment, enrollment, submission, now))

    return result


@router.post("/assignments/{assignment_id}/submit", response_model=StudentAssignmentView)
def submit_assignment(
    assignment_id: int,
    payload: AssignmentSubmitPayload,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> StudentAssignmentView:
    now = datetime.now(UTC)
    assignment = db.get(AssignmentRecord, assignment_id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devoir introuvable.")

    enrollment = _enrollment_for_session(db, current_user.id, assignment.session_id)
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous n'êtes pas inscrit à cette session.")

    if _normalize_datetime(now) > _normalize_datetime(assignment.due_date):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La date limite de remise est dépassée.")

    existing = db.scalar(
        select(AssignmentSubmissionRecord).where(
            AssignmentSubmissionRecord.assignment_id == assignment_id,
            AssignmentSubmissionRecord.enrollment_id == enrollment.id,
        )
    )
    if existing:
        existing.file_url = payload.file_url
        existing.submitted_at = now
        existing.is_reviewed = False
        existing.review_score = None
        existing.review_max_score = 20
        db.add(existing)
        submission = existing
    else:
        submission = AssignmentSubmissionRecord(
            assignment_id=assignment_id,
            enrollment_id=enrollment.id,
            file_url=payload.file_url,
            submitted_at=now,
        )
        db.add(submission)
    db.commit()
    db.refresh(submission)
    return _serialize_student_assignment(db, assignment, enrollment, submission, now)


@router.get("/assignments/{assignment_id}/comments", response_model=list[AssignmentCommentView])
def read_assignment_comments(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[AssignmentCommentView]:
    assignment = db.get(AssignmentRecord, assignment_id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devoir introuvable.")

    enrollment = _enrollment_for_session(db, current_user.id, assignment.session_id)
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous n'êtes pas inscrit à cette session.")

    comments = db.scalars(
        select(AssignmentCommentRecord)
        .where(
            AssignmentCommentRecord.assignment_id == assignment_id,
            AssignmentCommentRecord.enrollment_id == enrollment.id,
        )
        .order_by(AssignmentCommentRecord.created_at)
    ).all()
    return [_serialize_assignment_comment(db, comment) for comment in comments]


@router.post("/assignments/{assignment_id}/comments", response_model=AssignmentCommentView, status_code=status.HTTP_201_CREATED)
def create_assignment_comment(
    assignment_id: int,
    payload: AssignmentCommentCreate,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> AssignmentCommentView:
    assignment = db.get(AssignmentRecord, assignment_id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Devoir introuvable.")

    enrollment = _enrollment_for_session(db, current_user.id, assignment.session_id)
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous n'êtes pas inscrit à cette session.")

    comment = AssignmentCommentRecord(
        assignment_id=assignment_id,
        enrollment_id=enrollment.id,
        author_user_id=current_user.id,
        author_role="student",
        body=payload.body or "",
        attachment_url=payload.attachment_url,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _serialize_assignment_comment(db, comment)


@router.post(
    "/enrollments/{enrollment_id}/lessons/{module_index}/{lesson_index}/toggle",
    response_model=EnrollmentProgress,
)
def toggle_lesson_completion(
    enrollment_id: int,
    module_index: int,
    lesson_index: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> EnrollmentProgress:
    enrollment = _get_enrollment_or_404(db, enrollment_id, current_user.id)

    existing = db.scalar(
        select(LessonCompletionRecord).where(
            LessonCompletionRecord.enrollment_id == enrollment_id,
            LessonCompletionRecord.module_index == module_index,
            LessonCompletionRecord.lesson_index == lesson_index,
        )
    )
    if existing:
        db.delete(existing)
    else:
        db.add(LessonCompletionRecord(
            enrollment_id=enrollment_id,
            module_index=module_index,
            lesson_index=lesson_index,
        ))
    db.commit()
    return _build_progress(db, enrollment)


# ── Student results : attendance & grades for own enrollments ──────────────

class StudentAttendanceRow(BaseModel):
    course_day_id: int | None = None
    course_day_title: str | None = None
    course_day_scheduled_at: datetime | None = None
    status: str
    note: str | None = None

class StudentGradeRow(BaseModel):
    course_day_id: int | None = None
    course_day_title: str | None = None
    course_day_scheduled_at: datetime | None = None
    label: str
    score: float
    max_score: float
    note: str | None = None

class StudentEnrollmentResults(BaseModel):
    attendance: list[StudentAttendanceRow]
    grades: list[StudentGradeRow]


@router.get("/enrollments/{enrollment_id}/results", response_model=StudentEnrollmentResults)
def read_enrollment_results(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> StudentEnrollmentResults:
    enrollment = _get_enrollment_or_404(db, enrollment_id, current_user.id)
    if not enrollment.session_id:
        return StudentEnrollmentResults(attendance=[], grades=[])

    attendance_rows = db.scalars(
        select(AttendanceRecord).where(
            AttendanceRecord.session_id == enrollment.session_id,
            AttendanceRecord.enrollment_id == enrollment.id,
        )
    ).all()

    grade_rows = db.scalars(
        select(GradeRecord).where(
            GradeRecord.session_id == enrollment.session_id,
            GradeRecord.enrollment_id == enrollment.id,
        ).order_by(GradeRecord.label)
    ).all()
    course_day_ids = {
        row.course_day_id
        for row in [*attendance_rows, *grade_rows]
        if row.course_day_id is not None
    }
    course_days = {
        day.id: day
        for day in db.scalars(
            select(SessionCourseDayRecord).where(SessionCourseDayRecord.id.in_(course_day_ids))
        ).all()
    } if course_day_ids else {}

    return StudentEnrollmentResults(
        attendance=[
            StudentAttendanceRow(
                course_day_id=r.course_day_id,
                course_day_title=course_days[r.course_day_id].title if r.course_day_id in course_days else None,
                course_day_scheduled_at=course_days[r.course_day_id].scheduled_at if r.course_day_id in course_days else None,
                status=r.status,
                note=r.note,
            )
            for r in attendance_rows
        ],
        grades=[
            StudentGradeRow(
                course_day_id=g.course_day_id,
                course_day_title=course_days[g.course_day_id].title if g.course_day_id in course_days else None,
                course_day_scheduled_at=course_days[g.course_day_id].scheduled_at if g.course_day_id in course_days else None,
                label=g.label,
                score=g.score,
                max_score=g.max_score,
                note=g.note,
            )
            for g in grade_rows
        ],
    )


# ══════════════════════════════════════════════════════════════════════════════
# COURSES
# ══════════════════════════════════════════════════════════════════════════════

def _resolve_student_lesson(
    db: Session, lesson: LessonRecord, completed_ids: set[int]
) -> StudentLessonView:
    quiz_title = assignment_title = resource_title = None
    if lesson.quiz_id:
        q = db.get(QuizRecord, lesson.quiz_id)
        quiz_title = q.title if q else None
    if lesson.assignment_id:
        a = db.get(AssignmentRecord, lesson.assignment_id)
        assignment_title = a.title if a else None
    if lesson.resource_id:
        r = db.get(ResourceRecord, lesson.resource_id)
        resource_title = r.title if r else None
    return StudentLessonView(
        id=lesson.id,
        chapter_id=lesson.chapter_id,
        title=lesson.title,
        lesson_type=lesson.lesson_type,
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
        is_completed=lesson.id in completed_ids,
    )


@router.get("/courses", response_model=list[StudentCourseView])
def read_my_courses(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[StudentCourseView]:
    session_ids = _enrolled_session_ids(db, current_user.id)
    if not session_ids:
        return []

    # Fetch enrollment id for progress lookup
    enrollments = db.scalars(
        select(EnrollmentRecord).where(
            EnrollmentRecord.user_id == current_user.id,
            EnrollmentRecord.status.in_(["active", "completed"]),
        )
    ).all()
    enrollment_id_by_session = {e.session_id: e.id for e in enrollments}

    courses = db.scalars(
        select(CourseRecord)
        .where(CourseRecord.session_id.in_(session_ids))
        .order_by(CourseRecord.created_at)
    ).all()
    course_session_ids = {course.session_id for course in courses}

    result: list[StudentCourseView] = []
    for course in courses:
        enrollment_id = enrollment_id_by_session.get(course.session_id)

        # Collect completed lesson ids for this enrollment
        completed_ids: set[int] = set()
        if enrollment_id:
            rows = db.scalars(
                select(LessonProgressRecord.lesson_id).where(
                    LessonProgressRecord.enrollment_id == enrollment_id
                )
            ).all()
            completed_ids = set(rows)

        chapters = db.scalars(
            select(ChapterRecord)
            .where(ChapterRecord.course_id == course.id)
            .order_by(ChapterRecord.order_index)
        ).all()

        chapter_views: list[StudentChapterView] = []
        total_lessons = 0
        for ch in chapters:
            lessons = db.scalars(
                select(LessonRecord)
                .where(LessonRecord.chapter_id == ch.id)
                .order_by(LessonRecord.order_index)
            ).all()
            total_lessons += len(lessons)
            chapter_views.append(StudentChapterView(
                id=ch.id,
                title=ch.title,
                order_index=ch.order_index,
                lessons=[_resolve_student_lesson(db, l, completed_ids) for l in lessons],
            ))

        completed_lessons = len(completed_ids)
        progress_pct = round((completed_lessons / total_lessons * 100) if total_lessons > 0 else 0, 1)

        _enrollment = next((e for e in enrollments if e.id == enrollment_id), None)
        badge_progress = (
            compute_enrollment_badge_progress(
                db,
                _enrollment,
                course.session_id,
                total_lessons,
                completed_lessons,
                progress_pct,
            )
            if _enrollment else None
        )

        result.append(StudentCourseView(
            id=course.id,
            session_id=course.session_id,
            title=course.title,
            description=course.description,
            chapters=chapter_views,
            total_lessons=total_lessons,
            completed_lessons=completed_lessons,
            progress_pct=progress_pct,
            badge_level=badge_progress.level if badge_progress else "aventurier",
            badge_ring_pct=badge_progress.ring_pct if badge_progress else 0,
            badge_hint=badge_progress.hint if badge_progress else None,
            final_project_validated=badge_progress.final_project_validated if badge_progress else False,
        ))

    for enrollment in enrollments:
        if not enrollment.session_id or enrollment.session_id not in session_ids:
            continue
        if enrollment.session_id in course_session_ids:
            continue
        session = db.get(FormationSessionRecord, enrollment.session_id)
        formation = db.get(FormationRecord, enrollment.formation_id)
        if not session or not formation:
            continue
        progress_pct = 0.0
        badge_progress = compute_enrollment_badge_progress(
            db,
            enrollment,
            session.id,
            0,
            0,
            progress_pct,
        )
        result.append(StudentCourseView(
            id=-enrollment.id,
            session_id=session.id,
            title=formation.title,
            description="Cours en préparation.",
            chapters=[],
            total_lessons=0,
            completed_lessons=0,
            progress_pct=progress_pct,
            badge_level=badge_progress.level,
            badge_ring_pct=badge_progress.ring_pct,
            badge_hint=badge_progress.hint,
            final_project_validated=badge_progress.final_project_validated,
        ))

    return result


@router.post("/courses/lessons/{lesson_id}/complete", response_model=StudentCourseView)
def complete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> StudentCourseView:
    lesson = db.get(LessonRecord, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Leçon introuvable.")

    chapter = db.get(ChapterRecord, lesson.chapter_id)
    course = db.get(CourseRecord, chapter.course_id)  # type: ignore[union-attr]

    enrollment = db.scalar(
        select(EnrollmentRecord).where(
            EnrollmentRecord.user_id == current_user.id,
            EnrollmentRecord.session_id == course.session_id,
            EnrollmentRecord.status.in_(["active", "completed"]),
        )
    )
    if not enrollment:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas inscrit à ce cours.")

    # Upsert progress (ignore if already done)
    existing = db.scalar(
        select(LessonProgressRecord).where(
            LessonProgressRecord.enrollment_id == enrollment.id,
            LessonProgressRecord.lesson_id == lesson_id,
        )
    )
    if not existing:
        db.add(LessonProgressRecord(enrollment_id=enrollment.id, lesson_id=lesson_id))
        db.commit()

    # Return updated course view
    courses = read_my_courses(db=db, current_user=current_user)
    course_view = next((c for c in courses if c.id == course.id), None)
    if not course_view:
        raise HTTPException(status_code=404, detail="Cours introuvable.")
    return course_view


# ── Live events (séances live de l'étudiant) ───────────────────────────────────

@router.get("/live-events", response_model=list[StudentLiveEventView])
def get_my_live_events(
    db: Session = Depends(get_db),
    current_user: UserRecord = Depends(get_current_user),
) -> list[StudentLiveEventView]:
    """Retourne toutes les séances live des sessions où l'étudiant est inscrit."""
    enrollments = db.scalars(
        select(EnrollmentRecord).where(
            EnrollmentRecord.user_id == current_user.id,
            EnrollmentRecord.status.in_(("active", "completed")),
        )
    ).all()

    session_ids = [e.session_id for e in enrollments if e.session_id is not None]
    if not session_ids:
        return []

    rows = db.execute(
        select(SessionLiveEventRecord, FormationSessionRecord, FormationRecord)
        .join(FormationSessionRecord, FormationSessionRecord.id == SessionLiveEventRecord.session_id)
        .join(FormationRecord, FormationRecord.id == FormationSessionRecord.formation_id)
        .where(
            SessionLiveEventRecord.session_id.in_(session_ids),
            SessionLiveEventRecord.status.in_(("scheduled", "live")),
        )
        .order_by(SessionLiveEventRecord.scheduled_at)
    ).all()

    return [
        StudentLiveEventView(
            id=r.SessionLiveEventRecord.id,
            session_id=r.SessionLiveEventRecord.session_id,
            formation_title=r.FormationRecord.title,
            formation_slug=r.FormationRecord.slug,
            session_label=r.FormationSessionRecord.label,
            meeting_link=r.FormationSessionRecord.meeting_link,
            title=r.SessionLiveEventRecord.title,
            scheduled_at=r.SessionLiveEventRecord.scheduled_at,
            duration_minutes=r.SessionLiveEventRecord.duration_minutes,
            status=r.SessionLiveEventRecord.status,  # type: ignore[arg-type]
        )
        for r in rows
    ]
