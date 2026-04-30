"""Ollama backend — fully local, free. Requires `ollama serve` + a pulled model."""

from __future__ import annotations
import httpx
from app.config import settings


def chat(system: str, user: str, *, cached_blocks: list[str], max_tokens: int) -> str:
    full_system = "\n\n".join([system, *cached_blocks]) if cached_blocks else system
    payload = {
        "model": settings.ollama_model,
        "messages": [
            {"role": "system", "content": full_system},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "options": {"num_predict": max_tokens, "temperature": 0.3},
    }
    url = f"{settings.ollama_host.rstrip('/')}/api/chat"
    with httpx.Client(timeout=180) as c:
        r = c.post(url, json=payload)
        r.raise_for_status()
        data = r.json()
    return (data.get("message") or {}).get("content", "")
