import json
import re
import unicodedata
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.ai_client import resolve_ai_runtime_config, run_ai_chat
from app.services.catalog import list_catalog_items

router = APIRouter(prefix="/diagnostic", tags=["diagnostic"])


class DiagnosticData(BaseModel):
    first_name: str = ""
    last_name: str = ""
    domain: str = ""
    self_rating: int = 5
    level: str = ""
    nationality: str = ""
    city: str = ""
    training_type: str = ""
    availability: str = ""
    whatsapp: str = ""
    expectations: str = ""


class SuggestionResponse(BaseModel):
    suggestions: list[str]
    whatsapp_message: str


DIAGNOSTIC_AI_TIMEOUT_SECONDS = 6


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.lower())
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _format_catalog_context(db: Session) -> tuple[str, list[Any]]:
    formations = list_catalog_items(db)
    if not formations:
        return "Aucune formation cataloguee pour le moment.", []

    lines: list[str] = []
    for formation in formations:
        format_label = {
            "ligne": "en ligne",
            "live": "live",
            "presentiel": "en presentiel",
        }.get(formation.format_type, formation.format_type)
        lines.append(
            f'- {formation.title} | categorie: {formation.category} | niveau: {formation.level} '
            f'| format: {format_label} | prix: {formation.current_price_label}'
        )

    return "\n".join(lines), formations


def _parse_suggestions(raw: str) -> list[dict[str, str]]:
    candidate = raw.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate)
        candidate = re.sub(r"\s*```$", "", candidate)

    match = re.search(r"\{.*\}", candidate, re.DOTALL)
    if not match:
        return []

    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        return []

    suggestions: list[dict[str, str]] = []
    for item in parsed.get("suggestions", [])[:3]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        reason = str(item.get("reason", "")).strip()
        if title and reason:
            suggestions.append({"title": title, "reason": reason})
    return suggestions


def _fallback_suggestions(data: DiagnosticData, catalog_items: list[Any]) -> list[str]:
    if not catalog_items:
        return [
            "Design Graphique — Proposition de base selon votre profil.",
            "Marketing Digital — Proposition de base selon votre profil.",
        ]

    level_label = "debutant" if data.level == "debutant" else "intermediaire"
    profile_text = _normalize(f"{data.domain} {data.expectations}")
    profile_tokens = {
        token
        for token in re.split(r"[^a-z0-9]+", profile_text)
        if len(token) >= 4
    }
    preferred_format = {
        "online": {"ligne", "online"},
        "presentiel": {"presentiel"},
        "both": {"ligne", "online", "presentiel", "live"},
    }.get(data.training_type, set())

    scored: list[tuple[int, int, Any]] = []
    for index, item in enumerate(catalog_items):
        haystack = _normalize(
            f"{getattr(item, 'title', '')} {getattr(item, 'category', '')} {getattr(item, 'level', '')}"
        )
        score = 0
        for token in profile_tokens:
            if token in haystack:
                score += 4
        if data.level and _normalize(data.level) in haystack:
            score += 2
        if getattr(item, "format_type", "") in preferred_format:
            score += 1
        scored.append((score, -index, item))

    selected = [
        item
        for _score, _index, item in sorted(scored, key=lambda row: (row[0], row[1]), reverse=True)[:3]
    ]
    return [
        (
            f"{item.title} — Proposition adaptee a votre niveau {level_label}, "
            f"a votre interet pour {data.domain or 'ce domaine'}, a vos disponibilites "
            f"et a votre objectif de progression."
        )
        for item in selected
    ]


@router.post("/suggest", response_model=SuggestionResponse)
def suggest_formations(data: DiagnosticData, db: Session = Depends(get_db)) -> SuggestionResponse:
    name = (data.first_name or data.last_name).strip() or "l'apprenant"
    level_label = "debutant" if data.level == "debutant" else "intermediaire"
    training_label = {
        "online": "en ligne",
        "presentiel": "en presentiel",
        "both": "en ligne ou en presentiel",
    }.get(data.training_type, data.training_type)
    availability_label = {
        "day": "cours du jour",
        "evening": "cours du soir",
        "flexible": "flexible",
    }.get(data.availability, data.availability)

    catalog_context, catalog_items = _format_catalog_context(db)
    system_prompt = (
        "Tu es un conseiller pedagogique de l'Academie des Creatifs. "
        "Tu recommandes exactement 3 formations du catalogue fourni, sans en inventer. "
        "Tu reponds uniquement en JSON strict."
    )
    user_prompt = f"""Voici le profil d'un candidat :
- Prenom/Nom : {name}
- Domaine d'interet : {data.domain}
- Auto-evaluation dans ce domaine : {data.self_rating}/10
- Niveau : {level_label}
- Nationalite : {data.nationality}
- Ville : {data.city}
- Type de formation souhaite : {training_label}
- Disponibilites : {availability_label}
- Attentes : {data.expectations}

Voici les formations actuellement disponibles :
{catalog_context}

Propose exactement 3 formations adaptees a ce profil.
Pour chaque formation, donne :
1. le titre exact du catalogue
2. une justification courte, personnalisee, concrete

Reponds en JSON strict avec ce format :
{{"suggestions": [{{"title": "...", "reason": "..."}}]}}
Ne mets rien d'autre que le JSON."""

    raw = ""
    if resolve_ai_runtime_config() is not None:
        try:
            raw = run_ai_chat(
                system_prompt=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                max_tokens=500,
                timeout_seconds=DIAGNOSTIC_AI_TIMEOUT_SECONDS,
            )
        except Exception:
            raw = ""

    parsed_suggestions = _parse_suggestions(raw)
    suggestions_list = [
        f"**{item['title']}** — {item['reason']}"
        for item in parsed_suggestions
    ]
    if not suggestions_list:
        suggestions_list = _fallback_suggestions(data, catalog_items)

    training_type_fr = {
        "online": "En ligne",
        "presentiel": "En presentiel",
        "both": "En ligne ou presentiel",
    }.get(data.training_type, data.training_type)
    availability_fr = {
        "day": "Cours du jour",
        "evening": "Cours du soir",
        "flexible": "Flexible",
    }.get(data.availability, data.availability)

    wa_lines = [
        "Bonjour ! Je viens de completer le diagnostic de l'Academie des Creatifs.",
        "",
        f"Nom : {name}",
        f"Domaine : {data.domain}",
        f"Auto-evaluation : {data.self_rating}/10",
        f"Niveau : {level_label.capitalize()}",
        f"Pays : {data.nationality}",
        f"Ville : {data.city}",
        f"Preference : {training_type_fr}",
        f"Disponibilites : {availability_fr}",
        f"Attentes : {data.expectations}",
        "",
        "Formations suggerees :",
    ]
    for suggestion in suggestions_list:
        clean = re.sub(r"\*\*?", "", suggestion)
        wa_lines.append(f"- {clean}")

    return SuggestionResponse(
        suggestions=suggestions_list,
        whatsapp_message="\n".join(wa_lines),
    )
