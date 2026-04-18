from typing import Literal
from importlib import import_module

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.models.entities import UserRecord

router = APIRouter(prefix="/ai", tags=["ai"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    formation_title: str
    module_title: str | None = None
    lesson_title: str | None = None
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str


def _build_system_prompt(formation_title: str, module_title: str | None, lesson_title: str | None) -> str:
    context_parts = [f'Formation : "{formation_title}"']
    if module_title:
        context_parts.append(f'Module en cours : "{module_title}"')
    if lesson_title:
        context_parts.append(f'Leçon en cours : "{lesson_title}"')
    context = "\n".join(context_parts)
    return (
        "Tu es un assistant pédagogique de l'Académie des Créatifs. "
        "Tu aides les étudiants dans leur apprentissage de manière concise, bienveillante et pédagogique. "
        f"Contexte de l'étudiant :\n{context}\n\n"
        "Réponds toujours en français. "
        "Si la question n'est pas liée à la formation, invite poliment l'étudiant à poser des questions en rapport avec son cours."
    )


def _chat_with_openai(system_prompt: str, messages: list[dict]) -> str:
    openai_module = import_module("openai")
    OpenAI = openai_module.OpenAI
    kwargs: dict = {"api_key": settings.openai_api_key}
    if settings.openai_base_url:
        kwargs["base_url"] = settings.openai_base_url
    client = OpenAI(**kwargs)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=1024,
        messages=[{"role": "system", "content": system_prompt}, *messages],
    )
    return response.choices[0].message.content or ""


@router.post("/chat", response_model=ChatResponse)
def ai_chat(
    body: ChatRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> ChatResponse:
    if not settings.openai_api_key or not _module_exists("openai"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="L'assistant IA n'est pas configuré pour le moment.",
        )

    system_prompt = _build_system_prompt(body.formation_title, body.module_title, body.lesson_title)
    messages = [
        {"role": msg.role, "content": msg.content}
        for msg in body.history[-10:]
    ]
    messages.append({"role": "user", "content": body.message})

    try:
        reply = _chat_with_openai(system_prompt, messages)
        return ChatResponse(reply=reply)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="L'assistant IA est temporairement indisponible. Réessayez dans quelques instants.",
        )


def _module_exists(module_name: str) -> bool:
    try:
        import_module(module_name)
    except ModuleNotFoundError:
        return False
    return True
