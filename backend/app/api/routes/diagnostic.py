import json
import re

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
    whatsapp: str = ""
    expectations: str = ""


class SuggestionResponse(BaseModel):
    suggestions: list[str]
    whatsapp_message: str


def _format_catalog_context(db: Session) -> tuple[str, list[str]]:
    formations = list_catalog_items(db)
    if not formations:
        return "Aucune formation cataloguee pour le moment.", []

    lines: list[str] = []
    titles: list[str] = []
    for formation in formations:
        titles.append(formation.title)
        format_label = {
            "ligne": "en ligne",
            "live": "live",
            "presentiel": "en presentiel",
        }.get(formation.format_type, formation.format_type)
        lines.append(
            f'- {formation.title} | categorie: {formation.category} | niveau: {formation.level} '
            f'| format: {format_label} | prix: {formation.current_price_label}'
        )

    return "\n".join(lines), titles


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


def _fallback_suggestions(data: DiagnosticData, catalog_titles: list[str]) -> list[str]:
    if not catalog_titles:
        return [
            "Design Graphique — Proposition de base selon votre profil.",
            "Marketing Digital — Proposition de base selon votre profil.",
        ]

    level_label = "debutant" if data.level == "debutant" else "intermediaire"
    selected = catalog_titles[:3]
    return [
        (
            f"{title} — Proposition adaptee a votre niveau {level_label}, "
            f"a votre interet pour {data.domain or 'ce domaine'} et a votre objectif de progression."
        )
        for title in selected
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

    catalog_context, catalog_titles = _format_catalog_context(db)
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
                max_tokens=700,
            )
        except Exception:
            raw = ""

    parsed_suggestions = _parse_suggestions(raw)
    suggestions_list = [
        f"**{item['title']}** — {item['reason']}"
        for item in parsed_suggestions
    ]
    if not suggestions_list:
        suggestions_list = _fallback_suggestions(data, catalog_titles)

    training_type_fr = {
        "online": "En ligne",
        "presentiel": "En presentiel",
        "both": "En ligne ou presentiel",
    }.get(data.training_type, data.training_type)

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
