"""Telegram bot for instant alerts. Setup:
  1. Talk to @BotFather, /newbot, save the token into TELEGRAM_BOT_TOKEN.
  2. Send any message to your bot, then visit
     https://api.telegram.org/bot<TOKEN>/getUpdates and copy chat.id into TELEGRAM_CHAT_ID.

Every send is logged to the Notification table for the observability page.
"""

from __future__ import annotations
import logging
import httpx
from app.config import settings
from app.db.session import get_session
from app.db.models import Notification

log = logging.getLogger(__name__)


def _log(kind: str, body: str, status: str, error: str = "") -> None:
    try:
        with get_session() as s:
            # Subject for telegram = first line for at-a-glance scanning
            subject = (body.split("\n", 1)[0] or "")[:200]
            s.add(Notification(channel="telegram", kind=kind, subject=subject, body=body[:8000], status=status, error=error))
            s.commit()
    except Exception:
        log.exception("notification log write failed")


def send_telegram(text: str, *, kind: str = "alert") -> bool:
    if not (settings.telegram_bot_token and settings.telegram_chat_id):
        _log(kind, text, "skipped", "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing")
        return False
    try:
        url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
        r = httpx.post(
            url,
            json={
                "chat_id": settings.telegram_chat_id,
                "text": text,
                "parse_mode": "Markdown",
                "disable_web_page_preview": False,
            },
            timeout=10,
        )
        r.raise_for_status()
        _log(kind, text, "sent")
        return True
    except Exception as e:
        _log(kind, text, "failed", str(e)[:500])
        log.exception("Telegram send failed: %s", e)
        return False
