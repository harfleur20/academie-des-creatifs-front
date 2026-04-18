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

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.entities import (
    EnrollmentRecord,
    FormationRecord,
    FormationSessionRecord,
    FormationTeacherRecord,
    SessionCourseDayRecord,
    SessionLiveEventRecord,
    TeacherInvitationRecord,
    TeacherProfileRecord,
    UserRecord,
)
from app.schemas.teacher import (
    AdminTeacherItem,
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

router = APIRouter(tags=["teachers"])

INVITE_EXPIRY_DAYS = 7


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
    assigned = db.scalar(
        select(FormationTeacherRecord)
        .where(FormationTeacherRecord.teacher_id == user.id)
        .with_only_columns(FormationTeacherRecord.id)
        .count()  # type: ignore[attr-defined]
    ) or 0
    count_q = db.query(FormationTeacherRecord).filter(FormationTeacherRecord.teacher_id == user.id).count()
    return AdminTeacherItem(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        status=user.status,
        whatsapp=profile.whatsapp if profile else None,
        subject=profile.subject if profile else None,
        experience_years=profile.experience_years if profile else None,
        portfolio_url=profile.portfolio_url if profile else None,
        assigned_formations_count=count_q,
        created_at=user.created_at,
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
        enrolled_count=s.enrolled_count,
        meeting_link=s.meeting_link,
        status=s.status,
        session_state=presentation.state if presentation else "not_applicable",
    )


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
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRY_DAYS),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return TeacherInviteView(
        id=invitation.id,
        token=invitation.token,
        email=invitation.email,
        full_name=invitation.full_name,
        status=invitation.status,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
    )


@router.get("/admin/teachers/invitations", response_model=list[TeacherInviteView])
def list_teacher_invitations(
    db: Session = Depends(get_db),
    _: UserRecord = Depends(require_roles("admin")),
) -> list[TeacherInviteView]:
    invitations = db.scalars(
        select(TeacherInvitationRecord).order_by(TeacherInvitationRecord.created_at.desc())
    ).all()
    return [
        TeacherInviteView(
            id=inv.id,
            token=inv.token,
            email=inv.email,
            full_name=inv.full_name,
            status=inv.status,
            expires_at=inv.expires_at,
            created_at=inv.created_at,
        )
        for inv in invitations
    ]


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
    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Cette invitation a expiré.")
    return TeacherInviteInfo(
        token=invitation.token,
        email=invitation.email,
        full_name=invitation.full_name,
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
    if invitation.expires_at < datetime.now(timezone.utc):
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
        whatsapp=payload.whatsapp,
        subject=payload.subject,
        experience_years=payload.experience_years,
        portfolio_url=payload.portfolio_url,
        bio=payload.bio,
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
        whatsapp=profile.whatsapp if profile else None,
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
        profile = TeacherProfileRecord(user_id=current_user.id)
        db.add(profile)

    if payload.whatsapp is not None:
        profile.whatsapp = payload.whatsapp
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
        whatsapp=profile.whatsapp,
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
