"""Pluggable LLM client. Routes to Ollama (local, free), Groq/OpenAI-compatible
(free cloud tier), or Anthropic (paid) based on `LLM_BACKEND` in .env.

Public API: `chat(system, user, cached_blocks=[], max_tokens=4000) -> str`.

`cached_blocks` are large invariant context (profile, base resume) that should
be cached across calls. With Anthropic they map to system blocks with
cache_control: ephemeral; with Ollama/Groq they're concatenated into the
system message (they don't have prompt caching).
"""

from __future__ import annotations
import logging
from app.config import settings

log = logging.getLogger(__name__)


def chat(system: str, user: str, *, cached_blocks: list[str] | None = None, max_tokens: int = 4000) -> str:
    backend = (settings.llm_backend or "ollama").lower()
    cached_blocks = cached_blocks or []
    log.info("LLM call backend=%s sys_chars=%d user_chars=%d cached_blocks=%d",
             backend, len(system), len(user), len(cached_blocks))

    if backend == "anthropic":
        from app.llm import anthropic_provider as p
    elif backend in ("openai", "groq"):
        from app.llm import openai_compat as p
    else:
        from app.llm import ollama as p

    return p.chat(system=system, user=user, cached_blocks=cached_blocks, max_tokens=max_tokens)


def health() -> dict:
    """Self-test the configured backend. Used by /api/llm/health."""
    backend = (settings.llm_backend or "ollama").lower()
    try:
        out = chat("Reply with the single word OK.", "ping", max_tokens=10)
        return {"ok": True, "backend": backend, "sample": out[:80]}
    except Exception as e:
        return {"ok": False, "backend": backend, "error": str(e)}
