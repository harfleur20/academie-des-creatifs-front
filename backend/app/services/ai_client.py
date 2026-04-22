from __future__ import annotations

from dataclasses import dataclass
from importlib import import_module
from typing import Literal

from app.core.config import settings


@dataclass(frozen=True)
class AIRuntimeConfig:
    provider: Literal["openai", "huggingface", "anthropic"]
    api_key: str
    model: str
    base_url: str | None = None


def module_exists(module_name: str) -> bool:
    try:
        import_module(module_name)
    except ModuleNotFoundError:
        return False
    return True


def resolve_ai_runtime_config() -> AIRuntimeConfig | None:
    provider = (settings.ai_provider or "openai").strip().lower()

    if provider in {"huggingface", "hf"}:
        api_key = settings.ai_api_key or settings.hf_token
        model = settings.ai_model or settings.hf_model or "openai/gpt-oss-20b:cheapest"
        base_url = settings.ai_base_url or settings.hf_base_url or "https://router.huggingface.co/v1"
        if not api_key or not model:
            return None
        return AIRuntimeConfig(
            provider="huggingface",
            api_key=api_key,
            model=model,
            base_url=base_url,
        )

    if provider == "anthropic":
        api_key = settings.ai_api_key or settings.anthropic_api_key
        model = settings.ai_model or "claude-haiku-4-5-20251001"
        if not api_key or not model:
            return None
        return AIRuntimeConfig(
            provider="anthropic",
            api_key=api_key,
            model=model,
        )

    api_key = settings.ai_api_key or settings.openai_api_key
    model = settings.ai_model or "gpt-4o-mini"
    base_url = settings.ai_base_url or settings.openai_base_url or None
    if not api_key or not model:
        return None
    return AIRuntimeConfig(
        provider="openai",
        api_key=api_key,
        model=model,
        base_url=base_url,
    )


def _extract_openai_reply_text(message_content: object) -> str:
    if isinstance(message_content, str):
        return message_content
    if isinstance(message_content, list):
        text_parts: list[str] = []
        for item in message_content:
            if isinstance(item, dict):
                text = item.get("text")
            else:
                text = getattr(item, "text", None)
            if text:
                text_parts.append(str(text))
        return "\n".join(text_parts)
    return ""


def _extract_anthropic_reply_text(content: object) -> str:
    if not isinstance(content, list):
        return ""
    text_parts: list[str] = []
    for block in content:
        text = getattr(block, "text", None)
        if text:
            text_parts.append(str(text))
    return "\n".join(text_parts)


def run_ai_chat(
    *,
    system_prompt: str,
    messages: list[dict[str, str]],
    max_tokens: int = 1024,
    timeout_seconds: float | None = None,
) -> str:
    runtime = resolve_ai_runtime_config()
    if runtime is None:
        raise ValueError("AI runtime is not configured.")

    if runtime.provider == "anthropic":
        if not module_exists("anthropic"):
            raise ValueError("Anthropic SDK is not installed.")
        anthropic_module = import_module("anthropic")
        kwargs: dict = {"api_key": runtime.api_key}
        if timeout_seconds is not None:
            kwargs["timeout"] = timeout_seconds
        client = anthropic_module.Anthropic(**kwargs)
        response = client.messages.create(
            model=runtime.model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages,
        )
        return _extract_anthropic_reply_text(response.content)

    if not module_exists("openai"):
        raise ValueError("OpenAI SDK is not installed.")

    openai_module = import_module("openai")
    OpenAI = openai_module.OpenAI
    kwargs: dict = {"api_key": runtime.api_key}
    if runtime.base_url:
        kwargs["base_url"] = runtime.base_url
    if timeout_seconds is not None:
        kwargs["timeout"] = timeout_seconds

    client = OpenAI(**kwargs)
    response = client.chat.completions.create(
        model=runtime.model,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system_prompt}, *messages],
    )
    return _extract_openai_reply_text(response.choices[0].message.content)
