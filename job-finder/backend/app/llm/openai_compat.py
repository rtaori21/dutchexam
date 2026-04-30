"""OpenAI-compatible chat backend. Works with Groq (free tier), OpenRouter,
DeepInfra, OpenAI, Together, etc. Configure OPENAI_BASE_URL + OPENAI_MODEL."""

from __future__ import annotations
import httpx
from app.config import settings


last_usage: dict | None = None


def chat(system: str, user: str, *, cached_blocks: list[str], max_tokens: int) -> str:
    global last_usage
    last_usage = None
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY not set; either fill it in .env or switch LLM_BACKEND to ollama")

    full_system = "\n\n".join([system, *cached_blocks]) if cached_blocks else system
    payload = {
        "model": settings.openai_model,
        "messages": [
            {"role": "system", "content": full_system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
    url = f"{settings.openai_base_url.rstrip('/')}/chat/completions"
    with httpx.Client(timeout=120) as c:
        r = c.post(url, json=payload, headers=headers)
        r.raise_for_status()
        data = r.json()
    u = data.get("usage") or {}
    last_usage = {
        "prompt_tokens": u.get("prompt_tokens") or 0,
        "completion_tokens": u.get("completion_tokens") or 0,
    }
    return data["choices"][0]["message"]["content"]
