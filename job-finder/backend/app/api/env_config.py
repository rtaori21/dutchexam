"""Read + write the backend `.env` file from the dashboard so the user
doesn't have to edit it by hand. Secrets are masked on read; on write,
only modified fields are accepted (the frontend tracks dirty state).

Hot-reload: after writing, we re-instantiate Settings and copy fields
into the live `settings` singleton — no backend restart needed.
"""

from __future__ import annotations
import logging
from threading import RLock
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import settings, Settings

router = APIRouter()
log = logging.getLogger(__name__)

ENV_PATH = settings.root / "backend" / ".env"
_lock = RLock()


# Schema describes grouping, types, defaults, help, and which fields are secret.
ENV_SCHEMA: list[dict] = [
    {
        "group": "LLM backend",
        "description": "Pick one. Ollama is local + free; Groq is free cloud (no card); Anthropic is paid.",
        "vars": [
            {"key": "LLM_BACKEND", "type": "select", "options": ["ollama", "openai", "anthropic"], "default": "ollama"},
            {"key": "OLLAMA_HOST", "type": "url", "default": "http://localhost:11434", "help": "Only used when LLM_BACKEND=ollama"},
            {"key": "OLLAMA_MODEL", "type": "text", "default": "llama3.1:8b"},
            {"key": "OPENAI_API_KEY", "type": "secret", "help": "Free Groq key from console.groq.com — used when LLM_BACKEND=openai"},
            {"key": "OPENAI_BASE_URL", "type": "url", "default": "https://api.groq.com/openai/v1"},
            {"key": "OPENAI_MODEL", "type": "text", "default": "llama-3.3-70b-versatile"},
            {"key": "ANTHROPIC_API_KEY", "type": "secret"},
            {"key": "ANTHROPIC_MODEL", "type": "text", "default": "claude-sonnet-4-6"},
        ],
    },
    {
        "group": "Email alerts (optional)",
        "description": "Use a Gmail App Password (Account → Security → 2-step verification → App passwords).",
        "vars": [
            {"key": "SMTP_HOST", "type": "text", "default": "smtp.gmail.com"},
            {"key": "SMTP_PORT", "type": "number", "default": "587"},
            {"key": "SMTP_USER", "type": "email"},
            {"key": "SMTP_PASSWORD", "type": "secret"},
            {"key": "ALERT_FROM", "type": "email", "help": "Defaults to SMTP_USER when blank"},
            {"key": "ALERT_TO", "type": "email"},
        ],
    },
    {
        "group": "Telegram alerts (optional)",
        "description": "Setup: BotFather → /newbot → save token. Send any message to your bot, then visit https://api.telegram.org/bot<TOKEN>/getUpdates and copy chat.id.",
        "vars": [
            {"key": "TELEGRAM_BOT_TOKEN", "type": "secret"},
            {"key": "TELEGRAM_CHAT_ID", "type": "text"},
        ],
    },
    {
        "group": "Schedule",
        "vars": [
            {"key": "ALERT_MIN_SCORE", "type": "number", "default": "70", "help": "Heuristic score (0-100) below which alerts are suppressed"},
            {"key": "SCRAPE_INTERVAL_MINUTES", "type": "number", "default": "30", "help": "How often the JobSpy scraper runs"},
            {"key": "SOURCE_INTERVAL_MINUTES", "type": "number", "default": "15", "help": "Default polling interval for newly-added custom sources"},
        ],
    },
    {
        "group": "LinkedIn (auto-apply + authenticated scraping)",
        "description": "Required for the linkedin.com/jobs/search/?... custom sources and Easy Apply. Cookies are cached after first login.",
        "vars": [
            {"key": "LINKEDIN_EMAIL", "type": "email"},
            {"key": "LINKEDIN_PASSWORD", "type": "secret"},
            {"key": "AUTO_APPLY_ENABLED", "type": "boolean", "default": "false", "help": "Set true to enable Easy Apply. Per-job approval is still required."},
        ],
    },
]


def _all_keys() -> set[str]:
    return {v["key"] for g in ENV_SCHEMA for v in g["vars"]}


def _is_secret(key: str) -> bool:
    for g in ENV_SCHEMA:
        for v in g["vars"]:
            if v["key"] == key:
                return v["type"] == "secret"
    return False


def _read_env() -> dict[str, str]:
    """Best-effort .env parser. Treats `KEY=value` lines, ignores comments/blanks.
    Strips surrounding quotes from values."""
    if not ENV_PATH.exists():
        return {}
    out: dict[str, str] = {}
    for raw in ENV_PATH.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip()
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            v = v[1:-1]
        out[k] = v
    return out


def _mask(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 10:
        return "•" * len(value)
    return value[:4] + "•" * 8 + value[-4:]


def _write_env(values: dict[str, str]) -> None:
    """Atomic rewrite preserving the schema's grouping comments."""
    lines: list[str] = ["# Job Finder backend config — managed by the dashboard /env page.\n"]
    for g in ENV_SCHEMA:
        lines.append(f"# --- {g['group']} ---")
        if g.get("description"):
            for chunk in g["description"].split(". "):
                lines.append(f"# {chunk.strip()}")
        for v in g["vars"]:
            key = v["key"]
            val = values.get(key, v.get("default", ""))
            # Quote values that contain whitespace or shell-meaningful chars
            if val and any(c in val for c in (" ", "#", '"', "'", "$")):
                val = '"' + val.replace('"', '\\"') + '"'
            lines.append(f"{key}={val}")
        lines.append("")
    tmp = ENV_PATH.with_suffix(".env.tmp")
    tmp.write_text("\n".join(lines))
    tmp.replace(ENV_PATH)


def _reload_settings() -> None:
    """Re-read .env and patch the live Settings singleton in place so all
    `from app.config import settings` references see the new values."""
    new = Settings()
    for field in type(settings).model_fields.keys():
        try:
            setattr(settings, field, getattr(new, field))
        except Exception:
            pass


@router.get("")
def get_env():
    current = _read_env()
    groups = []
    for g in ENV_SCHEMA:
        items = []
        for v in g["vars"]:
            key = v["key"]
            raw = current.get(key, "")
            secret = v["type"] == "secret"
            items.append(
                {
                    "key": key,
                    "type": v["type"],
                    "options": v.get("options"),
                    "default": v.get("default", ""),
                    "help": v.get("help", ""),
                    "is_secret": secret,
                    "value": _mask(raw) if secret else raw,
                    "is_set": bool(raw),
                }
            )
        groups.append({
            "group": g["group"],
            "description": g.get("description", ""),
            "vars": items,
        })
    return {"groups": groups, "path": str(ENV_PATH)}


class PatchBody(BaseModel):
    values: dict[str, str] = {}
    unset: list[str] = []


@router.patch("")
def patch_env(body: PatchBody):
    allowed = _all_keys()
    incoming = {k: v for k, v in body.values.items() if k in allowed}
    unset = [k for k in body.unset if k in allowed]
    if not incoming and not unset:
        raise HTTPException(400, "No editable keys supplied")

    with _lock:
        current = _read_env()
        for k, v in incoming.items():
            if "•••" in v and _is_secret(k):
                continue
            current[k] = v
        for k in unset:
            current.pop(k, None)
        _write_env(current)
        _reload_settings()
        # If the JobSpy interval changed, push it into the running scheduler.
        try:
            from app import scheduler as sched

            sched.reschedule()
        except Exception as e:
            log.warning("scheduler reschedule skipped: %s", e)

    return {"ok": True, "written": list(incoming.keys()), "unset": unset, "live_settings_reloaded": True}


@router.post("/test/llm")
def test_llm():
    from app.llm.client import health
    return health()


@router.post("/test/telegram")
def test_telegram():
    from app.notifier.telegram import send_telegram
    ok = send_telegram("✅ Job Finder /env page — Telegram test message", kind="test")
    return {"sent": ok}


@router.post("/test/email")
def test_email():
    from app.notifier.email import send_email
    ok = send_email("Job Finder /env page test", "<p>This is a test from the env settings page.</p>", "Test from env page", kind="test")
    return {"sent": ok}
