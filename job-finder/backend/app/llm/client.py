"""Pluggable LLM client. Routes to Ollama (local, free), Groq/OpenAI-compatible
(free cloud tier), or Anthropic (paid) based on `LLM_BACKEND` in .env.

Public API: `chat(system, user, cached_blocks=[], max_tokens=4000, kind="other") -> str`.

`cached_blocks` are large invariant context (profile, base resume) reused
across calls. With Anthropic they map to system blocks with cache_control:
ephemeral; with Ollama/Groq they're concatenated into the system message
(no built-in prompt caching).

Every call writes an `LLMCall` audit row so the /env page can show token
usage and the daily cost budget.
"""

from __future__ import annotations
import logging
import time
from app.config import settings

log = logging.getLogger(__name__)


def _log_call(backend: str, model: str, kind: str, prompt_tokens: int,
              completion_tokens: int, duration_ms: int, error: str = "") -> None:
    """Best-effort audit row. Failure here must never break the actual call."""
    try:
        from app.db.session import get_session
        from app.db.models import LLMCall

        with get_session() as s:
            s.add(LLMCall(
                backend=backend, model=model, kind=kind,
                prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
                duration_ms=duration_ms, error=error,
            ))
            s.commit()
    except Exception as e:
        log.warning("LLMCall audit insert failed: %s", e)


def chat(system: str, user: str, *, cached_blocks: list[str] | None = None,
         max_tokens: int = 4000, kind: str = "other") -> str:
    backend = (settings.llm_backend or "ollama").lower()
    cached_blocks = cached_blocks or []
    log.info("LLM call backend=%s kind=%s sys_chars=%d user_chars=%d cached_blocks=%d",
             backend, kind, len(system), len(user), len(cached_blocks))

    if backend == "anthropic":
        from app.llm import anthropic_provider as p
        model = settings.anthropic_model
    elif backend in ("openai", "groq"):
        from app.llm import openai_compat as p
        model = settings.openai_model
    else:
        from app.llm import ollama as p
        model = settings.ollama_model

    started = time.time()
    err = ""
    pt = ct = 0
    try:
        result = p.chat(system=system, user=user, cached_blocks=cached_blocks, max_tokens=max_tokens)
        # Each provider attaches `last_usage` on its module after the call so
        # we can read it without changing every provider's return type.
        usage = getattr(p, "last_usage", None) or {}
        pt = int(usage.get("prompt_tokens") or 0)
        ct = int(usage.get("completion_tokens") or 0)
        return result
    except Exception as e:
        err = str(e)[:500]
        raise
    finally:
        _log_call(backend, model, kind, pt, ct, int((time.time() - started) * 1000), err)


def health() -> dict:
    """Self-test the configured backend. Used by /api/llm/health."""
    backend = (settings.llm_backend or "ollama").lower()
    try:
        out = chat("Reply with the single word OK.", "ping", max_tokens=10, kind="test")
        return {"ok": True, "backend": backend, "sample": out[:80]}
    except Exception as e:
        return {"ok": False, "backend": backend, "error": str(e)}
