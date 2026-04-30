"""Builds the alert payload from new high-match Jobs and dispatches to all channels."""

from __future__ import annotations
from datetime import datetime
from sqlalchemy import select
from app.db.models import Job
from app.db.session import get_session
from app.notifier.email import send_email
from app.notifier.telegram import send_telegram


def _job_card_html(j: Job) -> str:
    salary = ""
    if j.salary_min or j.salary_max:
        currency = j.salary_currency or "EUR"
        lo = f"{int(j.salary_min):,}" if j.salary_min else "?"
        hi = f"{int(j.salary_max):,}" if j.salary_max else "?"
        salary = f"<div>💰 {currency} {lo} – {hi}</div>"
    return f"""
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin:8px 0;font-family:system-ui">
      <div style="font-size:12px;color:#6b7280">{j.source} · score {j.match_score}</div>
      <div style="font-size:18px;font-weight:600">{j.title}</div>
      <div style="color:#374151">{j.company} — {j.location or 'n/a'}</div>
      {salary}
      <div style="margin-top:6px;color:#6b7280;font-size:13px">{j.match_reasoning}</div>
      <div style="margin-top:10px">
        <a href="{j.url}" style="background:#2563eb;color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none">Open posting</a>
        <a href="http://localhost:3737/jobs/{j.id}" style="margin-left:8px;color:#2563eb">Review in dashboard ↗</a>
      </div>
    </div>
    """


def _job_card_md(j: Job) -> str:
    return (
        f"*{j.title}* — {j.company}\n"
        f"📍 {j.location or 'n/a'}  ·  ⭐ {j.match_score}/100  ·  `{j.source}`\n"
        f"_{j.match_reasoning}_\n"
        f"[Open posting]({j.url})  ·  [Review](http://localhost:3737/jobs/{j.id})"
    )


def notify_new_matches(jobs_or_ids: list) -> None:
    """Accepts a list of Job instances or job IDs. Reloads in a fresh session
    so we don't touch detached instances from a closed session."""
    if not jobs_or_ids:
        return
    ids = [j.id if hasattr(j, "id") else int(j) for j in jobs_or_ids]
    with get_session() as session:
        jobs = list(session.execute(select(Job).where(Job.id.in_(ids))).scalars())
        if not jobs:
            return
        n = len(jobs)
        top_score = max((j.match_score or 0) for j in jobs)
        subject = f"[Job Finder] {n} new match{'es' if n > 1 else ''} — top score {top_score}"
        cards = "\n".join(_job_card_html(j) for j in jobs)
        html = f"<h2>{n} new job{'s' if n > 1 else ''} matched your profile</h2>{cards}"
        text = "\n\n".join(f"{j.title} — {j.company} ({j.match_score}) {j.url}" for j in jobs)
        tg = "*🎯 New matches*\n\n" + "\n\n".join(_job_card_md(j) for j in jobs)
        # mark alerted while we have live instances
        for j in jobs:
            j.alerted_at = datetime.utcnow()
        session.commit()

    send_email(subject, html, text, kind="alert")
    send_telegram(tg[:4000], kind="alert")
