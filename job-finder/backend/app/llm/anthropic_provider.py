"""Anthropic backend with prompt caching for large invariants."""

from __future__ import annotations
from app.config import settings


last_usage: dict | None = None


def chat(system: str, user: str, *, cached_blocks: list[str], max_tokens: int) -> str:
    global last_usage
    last_usage = None
    try:
        import anthropic
    except ImportError as e:
        raise RuntimeError("anthropic SDK not installed") from e
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    sys_blocks: list[dict] = [{"type": "text", "text": system}]
    for b in cached_blocks:
        sys_blocks.append({"type": "text", "text": b, "cache_control": {"type": "ephemeral"}})

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    msg = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=sys_blocks,
        messages=[{"role": "user", "content": user}],
    )
    u = getattr(msg, "usage", None)
    if u is not None:
        last_usage = {
            "prompt_tokens": (getattr(u, "input_tokens", 0) or 0)
                + (getattr(u, "cache_creation_input_tokens", 0) or 0)
                + (getattr(u, "cache_read_input_tokens", 0) or 0),
            "completion_tokens": getattr(u, "output_tokens", 0) or 0,
        }
    return msg.content[0].text
