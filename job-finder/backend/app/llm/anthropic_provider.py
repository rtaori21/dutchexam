"""Anthropic backend with prompt caching for large invariants."""

from __future__ import annotations
from app.config import settings


def chat(system: str, user: str, *, cached_blocks: list[str], max_tokens: int) -> str:
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
    return msg.content[0].text
