from importlib import import_module

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings

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


def _module_exists(name: str) -> bool:
    try:
        import_module(name)
    except ModuleNotFoundError:
        return False
    return True


def _call_ai(prompt: str) -> str:
    if settings.openai_api_key and _module_exists("openai"):
        openai_mod = import_module("openai")
        client = openai_mod.OpenAI(api_key=settings.openai_api_key)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content or ""

    if settings.anthropic_api_key and _module_exists("anthropic"):
        anthropic_mod = import_module("anthropic")
        client = anthropic_mod.Anthropic(api_key=settings.anthropic_api_key)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text if resp.content else ""

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Service IA non configuré.",
    )


@router.post("/suggest", response_model=SuggestionResponse)
def suggest_formations(data: DiagnosticData) -> SuggestionResponse:
    name = (data.first_name or data.last_name).strip() or "l'apprenant"
    level_label = "débutant" if data.level == "debutant" else "intermédiaire"
    training_label = {
        "online": "en ligne",
        "presentiel": "en présentiel",
        "both": "en ligne ou en présentiel",
    }.get(data.training_type, data.training_type)

    prompt = f"""Tu es un conseiller pédagogique de l'Académie des Créatifs, école de créativité francophone.

Voici le profil d'un candidat :
- Prénom/Nom : {name}
- Domaine d'intérêt : {data.domain}
- Auto-évaluation dans ce domaine : {data.self_rating}/10
- Niveau : {level_label}
- Nationalité : {data.nationality}
- Ville : {data.city}
- Type de formation souhaité : {training_label}
- Attentes : {data.expectations}

Propose 3 formations spécifiques de l'Académie des Créatifs adaptées à ce profil parmi :
Design Graphique, Marketing Digital, Vidéo & Motion, Intelligence Artificielle & Outils IA, No-Code & Tech, Freelance & Business Créatif, Photoshop Maîtrise Totale, Community Management & Personal Branding.

Pour chaque formation, donne :
1. Le titre exact
2. Une phrase de justification personnalisée (pourquoi c'est adapté à CE profil)

Réponds en JSON strict avec ce format :
{{"suggestions": [{{"title": "...", "reason": "..."}}]}}
Ne mets rien d'autre que le JSON."""

    raw = _call_ai(prompt)

    import json, re
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    suggestions_list: list[str] = []
    if match:
        try:
            parsed = json.loads(match.group())
            for s in parsed.get("suggestions", [])[:3]:
                suggestions_list.append(f"**{s['title']}** — {s['reason']}")
        except Exception:
            pass

    if not suggestions_list:
        suggestions_list = [
            "Design Graphique — Formation recommandée selon votre profil",
            "Marketing Digital — Complémentaire à votre domaine",
        ]

    training_type_fr = {
        "online": "En ligne",
        "presentiel": "En présentiel",
        "both": "En ligne ou présentiel",
    }.get(data.training_type, data.training_type)

    wa_lines = [
        f"👋 Bonjour ! Je viens de compléter le diagnostic de l'Académie des Créatifs.",
        f"",
        f"👤 *Nom :* {name}",
        f"🎯 *Domaine :* {data.domain}",
        f"📊 *Auto-évaluation :* {data.self_rating}/10",
        f"🏆 *Niveau :* {level_label.capitalize()}",
        f"🌍 *Pays :* {data.nationality}",
        f"📍 *Ville :* {data.city}",
        f"💻 *Préférence :* {training_type_fr}",
        f"💬 *Attentes :* {data.expectations}",
        f"",
        f"✨ *Formations suggérées :*",
    ]
    for s in suggestions_list:
        clean = re.sub(r'\*\*?', '', s)
        wa_lines.append(f"• {clean}")

    wa_message = "\n".join(wa_lines)

    return SuggestionResponse(
        suggestions=suggestions_list,
        whatsapp_message=wa_message,
    )
