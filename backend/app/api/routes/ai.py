from datetime import UTC, date, datetime
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_optional
from app.db.session import get_db
from app.models.entities import (
    AssignmentRecord,
    AssignmentSubmissionRecord,
    EnrollmentRecord,
    FormationRecord,
    FormationSessionRecord,
    GradeRecord,
    LessonCompletionRecord,
    QuizAttemptRecord,
    QuizRecord,
    ResourceRecord,
    SessionCourseDayRecord,
    UserRecord,
)
from app.services.ai_client import resolve_ai_runtime_config, run_ai_chat
from app.services.catalog import get_catalog_detail_item, list_catalog_items

router = APIRouter(prefix="/ai", tags=["ai"])

ACADEMY_WHATSAPP_NUMBER = "237680950319"
ACADEMY_WHATSAPP_TEXT = (
    "Bonjour l'Academie des Creatifs, j'aimerais avoir des informations."
)
CHAT_RESPONSE_FORMAT_GUIDANCE = (
    "Format de reponse pour le widget chat : utilise du Markdown simple et lisible. "
    "Fais des paragraphes courts, des listes a puces quand il y a plusieurs elements, "
    "et du gras avec moderation pour les mots importants. "
    "N'utilise pas de tableaux Markdown ni de colonnes avec le caractere | ; "
    "sur mobile, presente les comparaisons en liste. "
    "Evite les longues lignes collees et separe les idees importantes."
)

ECOMMERCE_INTENT_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "orientation",
        (
            "quelle formation",
            "choisir",
            "diagnostic",
            "orientation",
            "debuter",
            "débuter",
            "niveau",
            "profil",
            "reconversion",
            "conseil",
            "conseille",
        ),
    ),
    (
        "catalog",
        (
            "catalogue",
            "formation",
            "formations",
            "programme",
            "module",
            "modules",
            "cours",
            "certificat",
            "attestation",
        ),
    ),
    (
        "pricing_enrollment",
        (
            "prix",
            "tarif",
            "cout",
            "coût",
            "payer",
            "paiement",
            "tranche",
            "inscription",
            "acheter",
            "panier",
            "checkout",
            "commande",
        ),
    ),
    (
        "contact",
        (
            "whatsapp",
            "contact",
            "contacter",
            "ecrire",
            "écrire",
            "appeler",
            "telephone",
            "téléphone",
            "support",
            "aide",
        ),
    ),
    (
        "academy_info",
        (
            "academie",
            "académie",
            "a propos",
            "à propos",
            "equipe",
            "équipe",
            "qui êtes",
            "qui etes",
            "localisation",
            "adresse",
        ),
    ),
)

STUDENT_INTENT_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "student_progress",
        (
            "progression",
            "module",
            "cours",
            "prochain cours",
            "devoir",
            "devoirs",
            "quiz",
            "ressource",
            "ressources",
            "note",
            "notes",
            "certificat",
            "attestation",
        ),
    ),
    (
        "student_payment",
        (
            "paiement",
            "payer",
            "tranche",
            "facture",
            "commande",
            "retard",
        ),
    ),
    (
        "student_support",
        (
            "whatsapp",
            "contact",
            "support",
            "aide",
            "administration",
            "probleme",
            "problème",
            "bloque",
            "bloqué",
            "bug",
        ),
    ),
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    formation_title: str = ""
    module_title: str | None = None
    lesson_title: str | None = None
    enrollment_id: int | None = None
    assistant_mode: Literal[
        "student_learning",
        "ecommerce_support",
        "teacher_assistant",
        "admin_assistant",
    ] = "student_learning"
    history: list[ChatMessage] = Field(default_factory=list)


class ChatAction(BaseModel):
    id: str
    label: str
    href: str
    style: Literal["primary", "secondary"] = "secondary"


class ChatResponse(BaseModel):
    reply: str
    actions: list[ChatAction] = Field(default_factory=list)


def _build_whatsapp_url(message: str = ACADEMY_WHATSAPP_TEXT) -> str:
    return f"https://wa.me/{ACADEMY_WHATSAPP_NUMBER}?text={quote(message)}"


def _text_matches_any(text: str, keywords: tuple[str, ...]) -> bool:
    normalized = text.lower()
    return any(keyword in normalized for keyword in keywords)


def _detect_chat_intents(
    assistant_mode: Literal[
        "student_learning",
        "ecommerce_support",
        "teacher_assistant",
        "admin_assistant",
    ],
    text: str,
) -> list[str]:
    rules = ECOMMERCE_INTENT_RULES if assistant_mode == "ecommerce_support" else STUDENT_INTENT_RULES
    intents = [intent for intent, keywords in rules if _text_matches_any(text, keywords)]

    if not intents and assistant_mode == "ecommerce_support":
        intents.append("catalog")

    return intents


def _dedupe_actions(actions: list[ChatAction]) -> list[ChatAction]:
    deduped: list[ChatAction] = []
    seen: set[str] = set()
    for action in actions:
        key = f"{action.id}:{action.href}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(action)
    return deduped


def _action_diagnostic(style: Literal["primary", "secondary"] = "secondary") -> ChatAction:
    return ChatAction(
        id="diagnostic",
        label="Passer un diagnostic",
        href="/diagnostic",
        style=style,
    )


def _action_whatsapp(
    style: Literal["primary", "secondary"] = "secondary",
    message: str = ACADEMY_WHATSAPP_TEXT,
) -> ChatAction:
    return ChatAction(
        id="whatsapp",
        label="Nous écrire sur WhatsApp",
        href=_build_whatsapp_url(message),
        style=style,
    )


def _build_chat_actions(
    assistant_mode: Literal[
        "student_learning",
        "ecommerce_support",
        "teacher_assistant",
        "admin_assistant",
    ],
    user_message: str,
    reply: str,
    intents: list[str] | None = None,
) -> list[ChatAction]:
    detected_intents = intents or _detect_chat_intents(assistant_mode, f"{user_message}\n{reply}")

    if assistant_mode == "ecommerce_support":
        actions: list[ChatAction] = []
        if "orientation" in detected_intents:
            actions.extend([
                _action_diagnostic("primary"),
                ChatAction(id="formations", label="Voir les formations", href="/formations", style="secondary"),
                _action_whatsapp("secondary"),
            ])
        if "catalog" in detected_intents:
            actions.extend([
                ChatAction(id="formations", label="Voir les formations", href="/formations", style="primary"),
                _action_diagnostic("secondary"),
            ])
        if "pricing_enrollment" in detected_intents:
            actions.extend([
                ChatAction(id="formations", label="Comparer les formations", href="/formations", style="primary"),
                ChatAction(id="cart", label="Voir le panier", href="/panier", style="secondary"),
                _action_whatsapp("secondary"),
            ])
        if "contact" in detected_intents:
            actions.extend([
                _action_whatsapp("primary"),
                ChatAction(id="help", label="Consulter l'aide", href="/aide", style="secondary"),
            ])
        if "academy_info" in detected_intents:
            actions.extend([
                ChatAction(id="about", label="Découvrir l'Académie", href="/a-propos", style="primary"),
                ChatAction(id="team", label="Voir l'équipe", href="/notre-equipe", style="secondary"),
                _action_whatsapp("secondary"),
            ])
        if not actions:
            actions.extend([_action_diagnostic("primary"), _action_whatsapp("secondary")])

        return _dedupe_actions(actions)

    if assistant_mode == "student_learning":
        combined_text = f"{user_message}\n{reply}"
        student_intents = detected_intents or _detect_chat_intents(assistant_mode, combined_text)
        actions = []
        if "student_progress" in student_intents:
            actions.append(
                ChatAction(id="student_paths", label="Mes parcours", href="/espace/etudiant/parcours", style="primary")
            )
        if "student_payment" in student_intents:
            actions.append(
                ChatAction(id="student_payments", label="Mes paiements", href="/espace/etudiant/paiements", style="primary")
            )
        if "student_support" in student_intents:
            actions.append(
                _action_whatsapp(
                    "primary",
                    "Bonjour l'Academie des Creatifs, j'ai besoin d'aide dans mon espace etudiant.",
                )
            )
            actions.append(ChatAction(id="student_help", label="Aide étudiant", href="/espace/etudiant/aide", style="secondary"))
        elif "student_payment" in student_intents:
            actions.append(
                _action_whatsapp(
                    "secondary",
                    "Bonjour l'Academie des Creatifs, j'ai besoin d'aide pour un paiement.",
                )
            )

        return _dedupe_actions(actions)

    return []


def _build_intent_guidance(
    assistant_mode: Literal[
        "student_learning",
        "ecommerce_support",
        "teacher_assistant",
        "admin_assistant",
    ],
    intents: list[str],
) -> str:
    if assistant_mode == "ecommerce_support":
        lines = [
            "Logique d'intentions ecommerce :",
            "- orientation : si le profil est vague, oriente vers le diagnostic, puis propose 2 ou 3 formations pertinentes du catalogue sans inventer.",
            "- catalog : compare les formations avec format, niveau, prix, lien interne et statut d'achat.",
            "- pricing_enrollment : explique uniquement les prix et disponibilites fournis, mentionne le paiement en tranches seulement quand il est disponible.",
            "- contact : reponds brièvement et indique que le bouton WhatsApp permet de joindre l'equipe.",
            "- academy_info : presente l'Academie avec les donnees du site et renvoie vers les pages utiles si besoin.",
        ]
        return "\n".join(lines + [f"Intentions detectees : {', '.join(intents) or 'catalog'}"])

    if assistant_mode == "student_learning":
        lines = [
            "Logique d'intentions etudiant :",
            "- student_progress : utilise le contexte etudiant pour repondre sur progression, cours, devoirs, quiz, ressources, notes et certificat.",
            "- student_payment : renvoie vers l'espace paiements et propose le support si la situation semble bloquante.",
            "- student_support : invite a contacter l'equipe via le bouton WhatsApp ou la page d'aide etudiant.",
            "- Si la question sort du parcours, recentre poliment sur la formation ou le support.",
        ]
        return "\n".join(lines + [f"Intentions detectees : {', '.join(intents) or 'aucune'}"])

    return ""


def _build_context_lines(
    formation_title: str,
    module_title: str | None,
    lesson_title: str | None,
) -> list[str]:
    context_parts: list[str] = []
    if formation_title:
        context_parts.append(f'Formation : "{formation_title}"')
    if module_title:
        context_parts.append(f'Module en cours : "{module_title}"')
    if lesson_title:
        context_parts.append(f'Leçon en cours : "{lesson_title}"')
    return context_parts


def _compact_text(value: str | None, limit: int = 280) -> str:
    compacted = " ".join((value or "").split())
    if len(compacted) <= limit:
        return compacted
    return compacted[: limit - 1].rstrip() + "…"


def _join_preview(items: list[str], *, limit: int = 3, item_limit: int = 110) -> str:
    preview = [_compact_text(item, item_limit) for item in items if _compact_text(item, item_limit)]
    if not preview:
        return "Non renseigne."
    suffix = "" if len(preview) <= limit else f" (+{len(preview) - limit} autre(s))"
    return "; ".join(preview[:limit]) + suffix


def _build_site_context() -> str:
    return "\n".join(
        [
            "Informations pratiques du site :",
            "- Catalogue public : /formations",
            "- Fiche formation : /formations/{slug}",
            "- Diagnostic d'orientation : /diagnostic. A proposer quand la personne ne sait pas quelle formation choisir.",
            f"- WhatsApp officiel : +237 680 950 319 | lien : https://wa.me/{ACADEMY_WHATSAPP_NUMBER}",
            "- Aide publique : /aide",
            "- Pages utiles : /a-propos, /notre-equipe, /blog, /panier",
            "- Pour les achats, verifier la disponibilite de la formation et ne jamais promettre une inscription si can_purchase est faux.",
            "- Pour les questions sans donnee disponible, dire que l'information n'est pas encore renseignee et proposer le diagnostic ou WhatsApp.",
        ]
    )


def _build_catalog_context(db: Session) -> str:
    formations = list_catalog_items(db)
    if not formations:
        return f"{_build_site_context()}\n\nCatalogue : aucune formation cataloguee pour le moment."

    lines = [_build_site_context(), "", "Catalogue et fiches formations :"]
    for formation in formations[:10]:
        detail = get_catalog_detail_item(db, formation.slug)
        format_label = {
            "ligne": "en ligne",
            "live": "live",
            "presentiel": "en presentiel",
        }.get(formation.format_type, formation.format_type)
        session_label = f" | session: {formation.card_session_label}" if formation.card_session_label else ""
        purchase_label = (
            "inscription ouverte"
            if formation.can_purchase
            else f"inscription indisponible ({formation.purchase_message or formation.session_state})"
        )
        installment_label = " | paiement en tranches possible" if formation.allow_installments else ""
        original_price = (
            f" | prix barre: {formation.original_price_label}"
            if formation.original_price_label
            else ""
        )
        lines.append(
            f'- {formation.title} | lien: /formations/{formation.slug} | categorie: {formation.category} '
            f'| niveau: {formation.level} | format: {format_label} | prix: {formation.current_price_label}'
            f'{original_price}{installment_label} | statut achat: {purchase_label}{session_label}'
        )
        if detail is None:
            continue

        lines.append(f"  Intro : {_compact_text(detail.intro)}")
        lines.append(f"  Public cible : {_compact_text(detail.audience_text, 220)}")
        lines.append(f"  Inclus : {_join_preview(detail.included, limit=3)}")
        lines.append(f"  Objectifs : {_join_preview(detail.objectives, limit=3)}")
        lines.append(
            "  Modules : "
            + _join_preview([module.title for module in detail.modules], limit=4, item_limit=80)
        )
        if detail.faqs:
            faq_preview = [
                f"{faq.question} -> {_compact_text(faq.answer, 130)}"
                for faq in detail.faqs[:2]
            ]
            lines.append(f"  FAQ : {_join_preview(faq_preview, limit=2, item_limit=190)}")
    return "\n".join(lines)


def _normalize_datetime(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value


def _format_date(value: date | None) -> str | None:
    if value is None:
        return None
    return value.strftime("%d/%m/%Y")


def _format_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.strftime("%d/%m/%Y à %H:%M")


def _format_duration(minutes: int | None) -> str | None:
    if minutes is None:
        return None
    if minutes >= 60:
        hours, remainder = divmod(minutes, 60)
        return f"{hours}h{remainder:02d}" if remainder else f"{hours}h"
    return f"{minutes} min"


def _count_total_lessons(formation: FormationRecord | None) -> int:
    if formation is None or not formation.module_items:
        return 0
    return sum(len(module.get("lessons", [])) for module in formation.module_items)


def _resolve_student_enrollment(
    db: Session,
    current_user: UserRecord,
    enrollment_id: int | None,
    formation_title: str,
) -> EnrollmentRecord | None:
    if enrollment_id is not None:
        return db.scalar(
            select(EnrollmentRecord).where(
                EnrollmentRecord.id == enrollment_id,
                EnrollmentRecord.user_id == current_user.id,
                EnrollmentRecord.status.in_(["active", "completed"]),
            )
        )

    if formation_title:
        return db.scalar(
            select(EnrollmentRecord)
            .join(FormationRecord, FormationRecord.id == EnrollmentRecord.formation_id)
            .where(
                EnrollmentRecord.user_id == current_user.id,
                EnrollmentRecord.status.in_(["active", "completed"]),
                FormationRecord.title == formation_title,
            )
            .order_by(EnrollmentRecord.created_at.desc())
        )

    return db.scalar(
        select(EnrollmentRecord)
        .where(
            EnrollmentRecord.user_id == current_user.id,
            EnrollmentRecord.status.in_(["active", "completed"]),
        )
        .order_by(EnrollmentRecord.created_at.desc())
    )


def _assignment_status_label(
    assignment: AssignmentRecord,
    submission: AssignmentSubmissionRecord | None,
    now: datetime,
) -> str:
    if submission:
        return "Corrige" if submission.is_reviewed else "Rendu"
    if _normalize_datetime(now) > _normalize_datetime(assignment.due_date):
        return "En retard"
    return "A rendre"


def _quiz_status_label(quiz: QuizRecord, attempts: list[QuizAttemptRecord]) -> str:
    if not attempts:
        return "Ouvert" if quiz.status == "active" else "A venir"

    best_score = max((attempt.score_pct for attempt in attempts), default=None)
    if best_score is None:
        return "Commence"
    if best_score >= 70:
        return f"Reussi ({best_score:.0f}%)"
    return f"A reprendre ({best_score:.0f}%)"


def _build_student_context(
    db: Session,
    current_user: UserRecord,
    formation_title: str,
    enrollment_id: int | None,
) -> str:
    enrollment = _resolve_student_enrollment(db, current_user, enrollment_id, formation_title)
    if enrollment is None:
        return "Aucune inscription exploitable n'a ete retrouvee pour cet etudiant."

    formation = db.get(FormationRecord, enrollment.formation_id)
    session = db.get(FormationSessionRecord, enrollment.session_id) if enrollment.session_id else None
    now = datetime.now(UTC)

    lines = [
        f"- Etudiant : {current_user.full_name}",
        f"- Formation : {formation.title if formation else formation_title or 'Non precisee'}",
        f"- Format : {enrollment.format_type}",
        f"- Type de parcours : {enrollment.dashboard_type}",
        f"- Statut d'inscription : {enrollment.status}",
        f"- Reference commande : {enrollment.order_reference}",
    ]

    completed_lessons = db.scalars(
        select(LessonCompletionRecord).where(LessonCompletionRecord.enrollment_id == enrollment.id)
    ).all()
    total_lessons = _count_total_lessons(formation)
    if total_lessons > 0:
        progress_pct = round((len(completed_lessons) / total_lessons) * 100)
        lines.append(
            f"- Progression actuelle : {len(completed_lessons)}/{total_lessons} lecons terminees ({progress_pct}%)"
        )

    if session is None:
        lines.append("- Session : aucune session planifiee ou rattachee pour le moment.")
        return "\n".join(lines)

    session_window = ""
    if session.start_date and session.end_date:
        session_window = f" du {_format_date(session.start_date)} au {_format_date(session.end_date)}"
    lines.append(f"- Session : {session.label}{session_window}")
    if session.campus_label:
        lines.append(f"- Campus / lieu : {session.campus_label}")
    if session.teacher_name:
        lines.append(f"- Enseignant referent : {session.teacher_name}")

    course_days = db.scalars(
        select(SessionCourseDayRecord)
        .where(SessionCourseDayRecord.session_id == session.id)
        .order_by(SessionCourseDayRecord.scheduled_at.asc())
    ).all()
    next_course = next(
        (
            day
            for day in course_days
            if _normalize_datetime(day.scheduled_at) >= _normalize_datetime(now)
        ),
        None,
    )
    if next_course:
        duration = _format_duration(next_course.duration_minutes)
        duration_suffix = f" | duree {duration}" if duration else ""
        lines.append(
            f"- Prochain cours : {next_course.title} | {_format_datetime(next_course.scheduled_at)}"
            f"{duration_suffix} | statut {next_course.status}"
        )
    elif course_days:
        last_course = course_days[-1]
        lines.append(
            f"- Dernier cours planifie : {last_course.title} | {_format_datetime(last_course.scheduled_at)} | statut {last_course.status}"
        )
    else:
        lines.append("- Prochain cours : aucun cours n'est encore planifie dans cette session.")

    assignments = db.scalars(
        select(AssignmentRecord)
        .where(AssignmentRecord.session_id == session.id)
        .order_by(AssignmentRecord.due_date.asc())
    ).all()
    submissions = db.scalars(
        select(AssignmentSubmissionRecord).where(
            AssignmentSubmissionRecord.enrollment_id == enrollment.id
        )
    ).all()
    submissions_by_assignment = {
        submission.assignment_id: submission
        for submission in submissions
    }
    if assignments:
        lines.append("- Devoirs principaux :")
        for assignment in assignments[:4]:
            submission = submissions_by_assignment.get(assignment.id)
            status_label = _assignment_status_label(assignment, submission, now)
            review_suffix = ""
            if submission and submission.is_reviewed and submission.review_score is not None:
                review_suffix = f" | note {submission.review_score}/{submission.review_max_score}"
            lines.append(
                f"  * {assignment.title} | echeance {_format_datetime(assignment.due_date)} | {status_label}{review_suffix}"
            )
    else:
        lines.append("- Devoirs principaux : aucun devoir publie pour le moment.")

    quizzes = db.scalars(
        select(QuizRecord)
        .where(QuizRecord.session_id == session.id)
        .order_by(QuizRecord.scheduled_at.asc().nullslast(), QuizRecord.created_at.asc())
    ).all()
    attempts = db.scalars(
        select(QuizAttemptRecord).where(QuizAttemptRecord.enrollment_id == enrollment.id)
    ).all()
    attempts_by_quiz: dict[int, list[QuizAttemptRecord]] = {}
    for attempt in attempts:
        attempts_by_quiz.setdefault(attempt.quiz_id, []).append(attempt)
    if quizzes:
        lines.append("- Quiz :")
        for quiz in quizzes[:4]:
            schedule = _format_datetime(quiz.scheduled_at) if quiz.scheduled_at else "Non programme"
            lines.append(
                f"  * {quiz.title} | {schedule} | {_quiz_status_label(quiz, attempts_by_quiz.get(quiz.id, []))}"
            )
    else:
        lines.append("- Quiz : aucun quiz publie pour cette session.")

    available_resources = [
        resource
        for resource in db.scalars(
            select(ResourceRecord)
            .where(ResourceRecord.session_id == session.id)
            .order_by(ResourceRecord.created_at.desc())
        ).all()
        if resource.published_at is None or _normalize_datetime(resource.published_at) <= _normalize_datetime(now)
    ]
    if available_resources:
        recent_resource_titles = ", ".join(resource.title for resource in available_resources[:3])
        lines.append(
            f"- Ressources disponibles : {len(available_resources)} | dernieres ressources : {recent_resource_titles}"
        )
    else:
        lines.append("- Ressources disponibles : aucune ressource publiee pour le moment.")

    grades = db.scalars(
        select(GradeRecord)
        .where(GradeRecord.enrollment_id == enrollment.id)
        .order_by(GradeRecord.created_at.desc())
    ).all()
    valid_grades = [grade for grade in grades if grade.max_score > 0]
    if valid_grades:
        score_total = sum(grade.score for grade in valid_grades)
        max_total = sum(grade.max_score for grade in valid_grades)
        average_on_twenty = (score_total / max_total) * 20 if max_total > 0 else None
        latest_grade = valid_grades[0]
        average_label = f"{average_on_twenty:.1f}/20" if average_on_twenty is not None else "Non calculee"
        lines.append(
            f"- Notes : moyenne {average_label} | derniere note {latest_grade.label} = {latest_grade.score}/{latest_grade.max_score}"
        )
    else:
        lines.append("- Notes : aucune note publiee pour l'instant.")

    return "\n".join(lines)


def _contains_placeholder_tokens(reply: str) -> bool:
    reply_lower = reply.lower()
    return any(token in reply_lower for token in ("[date]", "[heure]", "[lien]", "[nom]"))


def _build_system_prompt(
    assistant_mode: Literal[
        "student_learning",
        "ecommerce_support",
        "teacher_assistant",
        "admin_assistant",
    ],
    formation_title: str,
    module_title: str | None,
    lesson_title: str | None,
    catalog_context: str | None = None,
    student_context: str | None = None,
    intent_guidance: str | None = None,
) -> str:
    context_lines = _build_context_lines(formation_title, module_title, lesson_title)
    context = "\n".join(context_lines) if context_lines else "Aucun contexte pedagogique specifique fourni."
    guidance_block = f"\n\n{intent_guidance}" if intent_guidance else ""
    format_guidance = f"\n\n{CHAT_RESPONSE_FORMAT_GUIDANCE}"

    if assistant_mode == "ecommerce_support":
        catalog_block = f"\n\nDonnees site et catalogue disponibles :\n{catalog_context}" if catalog_context else ""
        return (
            "Tu es l'assistant du site ecommerce de l'Academie des Creatifs. "
            "Tu reponds en francais aux questions sur les formations, achats, paiements, acces, support et services. "
            "Utilise en priorite les donnees site et catalogue fournies ci-dessous : titres, liens, prix, formats, modules, FAQ, objectifs et statut d'achat. "
            "N'invente jamais un prix, une politique, une disponibilite ou une promesse commerciale. "
            "Si une information manque, dis-le clairement et propose une suite concrete. "
            "Quand tu cites une formation, ajoute son lien interne /formations/{slug} si disponible. "
            "Ne colle pas d'URL brute pour le diagnostic ou WhatsApp : l'interface ajoute les boutons utiles."
            f"{format_guidance}"
            f"{guidance_block}"
            f"{catalog_block}"
        )

    if assistant_mode == "teacher_assistant":
        return (
            "Tu es l'assistant des enseignants de l'Academie des Creatifs. "
            "Tu aides a resumer un cours, structurer des modules, proposer des devoirs, des consignes, "
            "des criteres d'evaluation et des retours pedagogiques. "
            "Tu reponds toujours en francais, avec des sorties claires, actionnables et faciles a relire.\n\n"
            f"{CHAT_RESPONSE_FORMAT_GUIDANCE}\n\n"
            f"Contexte disponible :\n{context}"
        )

    if assistant_mode == "admin_assistant":
        return (
            "Tu es l'assistant de l'equipe admin de l'Academie des Creatifs. "
            "Tu aides a produire des brouillons de cours, modules, devoirs, FAQ, messages internes, "
            "checklists et contenus operationnels. "
            "Tu reponds toujours en francais, de facon structuree, concise et exploitable. "
            "Quand une information manque, tu l'indiques au lieu de l'inventer.\n\n"
            f"{CHAT_RESPONSE_FORMAT_GUIDANCE}\n\n"
            f"Contexte disponible :\n{context}"
        )

    return (
        "Tu es un assistant pedagogique de l'Academie des Creatifs. "
        "Tu aides les etudiants dans leur apprentissage de maniere concise, bienveillante et pedagogique. "
        "Utilise en priorite les donnees factuelles fournies ci-dessous. "
        "Quand une information precise manque, dis clairement qu'elle n'est pas encore disponible dans la plateforme. "
        "N'utilise jamais de placeholders comme [date], [heure], [lien] ou [nom]. "
        "Si une date ou une heure est fournie dans le contexte, cite-la telle quelle.\n\n"
        f"Contexte de navigation :\n{context}\n\n"
        f"Contexte de l'etudiant :\n{student_context or 'Aucune donnee etudiant supplementaire disponible.'}\n\n"
        f"{intent_guidance + chr(10) + chr(10) if intent_guidance else ''}"
        f"{CHAT_RESPONSE_FORMAT_GUIDANCE}\n\n"
        "Reponds toujours en francais. "
        "Si la question n'est pas liee a la formation, invite poliment l'etudiant a poser une question en rapport avec son cours. "
        "Ne colle pas d'URL brute pour WhatsApp : l'interface ajoute le bouton si besoin."
    )


@router.post("/chat", response_model=ChatResponse)
def ai_chat(
    body: ChatRequest,
    current_user: UserRecord | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> ChatResponse:
    if body.assistant_mode != "ecommerce_support" and current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise.",
        )

    if resolve_ai_runtime_config() is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="L'assistant IA n'est pas configuré pour le moment.",
        )

    catalog_context = _build_catalog_context(db) if body.assistant_mode == "ecommerce_support" else None
    student_context = (
        _build_student_context(db, current_user, body.formation_title, body.enrollment_id)
        if body.assistant_mode == "student_learning" and current_user is not None
        else None
    )
    detected_intents = _detect_chat_intents(body.assistant_mode, body.message)
    system_prompt = _build_system_prompt(
        body.assistant_mode,
        body.formation_title,
        body.module_title,
        body.lesson_title,
        catalog_context,
        student_context,
        _build_intent_guidance(body.assistant_mode, detected_intents),
    )
    messages = [
        {"role": msg.role, "content": msg.content}
        for msg in body.history[-10:]
    ]
    messages.append({"role": "user", "content": body.message})

    try:
        reply = run_ai_chat(
            system_prompt=system_prompt,
            messages=messages,
            max_tokens=1024,
        )
        if body.assistant_mode == "student_learning" and _contains_placeholder_tokens(reply):
            reply = (
                "Je n'ai pas encore une donnee assez precise pour repondre correctement a cette question. "
                "Consulte le calendrier ou les devoirs de ton espace, ou repose ta question avec la formation ou le module concerne."
            )
        return ChatResponse(
            reply=reply,
            actions=_build_chat_actions(body.assistant_mode, body.message, reply, detected_intents),
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="L'assistant IA est temporairement indisponible. Réessayez dans quelques instants.",
        )
