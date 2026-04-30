"""SMTP-based email alerts. Configure via .env (Gmail App Password works).
Every send is logged to the Notification table for the observability page."""

from __future__ import annotations
import smtplib
import logging
from email.message import EmailMessage
from app.config import settings
from app.db.session import get_session
from app.db.models import Notification

log = logging.getLogger(__name__)


def _log(channel: str, kind: str, subject: str, body: str, status: str, error: str = "") -> None:
    try:
        with get_session() as s:
            s.add(Notification(channel=channel, kind=kind, subject=subject, body=body[:8000], status=status, error=error))
            s.commit()
    except Exception:
        log.exception("notification log write failed")


def send_email(subject: str, html_body: str, text_body: str = "", *, kind: str = "alert") -> bool:
    if not (settings.smtp_user and settings.smtp_password and settings.alert_to):
        _log("email", kind, subject, html_body, "skipped", "SMTP not configured")
        log.info("Email skipped: SMTP not configured")
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.alert_from or settings.smtp_user
    msg["To"] = settings.alert_to
    msg.set_content(text_body or "Open in HTML-capable client.")
    msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
            s.starttls()
            s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)
        _log("email", kind, subject, html_body, "sent")
        log.info("Email sent: %s", subject)
        return True
    except Exception as e:
        _log("email", kind, subject, html_body, "failed", str(e)[:500])
        log.exception("Email send failed: %s", e)
        return False
