"""Twice-daily Telegram digest at 08:00 and 20:00 Europe/Amsterdam.
Quieter than per-job alerts; better signal-to-noise."""

from __future__ import annotations
import logging
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from app.db.session import get_session
from app.db.models import Job, StatusEvent
from app.notifier.telegram import send_telegram

log = logging.getLogger(__name__)


def _section(title: str, lines: list[str], limit: int = 8) -> str:
    if not lines:
        return ""
    head = f"*{title}* ({len(lines)})"
    body = "\n".join(lines[:limit])
    if len(lines) > limit:
        body += f"\n_…{len(lines) - limit} more_"
    return f"{head}\n{body}"


def build_digest(window_hours: int = 12) -> str:
    since = datetime.utcnow() - timedelta(hours=window_hours)
    parts: list[str] = []

    with get_session() as s:
        # New high-match jobs in window (regardless of alert state)
        new_jobs = list(
            s.execute(
                select(Job)
                .where(and_(Job.discovered_at >= since, Job.match_score >= 50, Job.status == "new"))
                .order_by(Job.match_score.desc())
                .limit(20)
            ).scalars()
        )
        new_lines = [
            f"⭐ {j.match_score} · *{j.title}* — {j.company}, {j.location or '?'}\n  [open]({j.url}) · [review](http://localhost:3737/jobs/{j.id})"
            for j in new_jobs
        ]
        parts.append(_section("🎯 New matches", new_lines))

        # Awaiting review (any age, top 10 by score)
        awaiting = list(
            s.execute(
                select(Job)
                .where(Job.status == "new", Job.match_score >= 60)
                .order_by(Job.match_score.desc())
                .limit(10)
            ).scalars()
        )
        awaiting_lines = [
            f"⭐ {j.match_score} · *{j.title}* — {j.company}\n  [review](http://localhost:3737/jobs/{j.id})"
            for j in awaiting
        ]
        parts.append(_section("⏳ Awaiting your decision", awaiting_lines))

        # Status changes in window
        events = list(
            s.execute(
                select(StatusEvent)
                .where(StatusEvent.created_at >= since, StatusEvent.from_status.is_not(None))
                .order_by(StatusEvent.created_at.desc())
                .limit(20)
            ).scalars()
        )
        if events:
            ev_lines = []
            for ev in events:
                job = s.get(Job, ev.job_id)
                if not job:
                    continue
                ev_lines.append(
                    f"`{ev.from_status} → {ev.to_status}` · *{job.title}* — {job.company}"
                )
            parts.append(_section("🔄 Status changes", ev_lines))

    body = "\n\n".join(p for p in parts if p)
    if not body:
        body = "_No new activity in the last 12 hours._"
    return f"*🗓 Job Finder digest* — {datetime.now().strftime('%a %H:%M')}\n\n{body}"


def send_digest() -> dict:
    msg = build_digest()
    ok = send_telegram(msg[:4000], kind="digest")
    log.info("digest sent ok=%s len=%d", ok, len(msg))
    return {"sent": ok, "length": len(msg)}
