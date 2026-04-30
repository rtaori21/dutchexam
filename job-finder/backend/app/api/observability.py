"""Observability dashboard endpoints: scrape history, notification log, system health."""

from __future__ import annotations
import json
from datetime import datetime, timedelta
from collections import defaultdict
from fastapi import APIRouter, Query
from sqlalchemy import select, func, and_
from app.db.session import get_session, engine
from app.db.models import ScrapeRun, Notification, Job, CompanySource

router = APIRouter()


@router.get("/scrapes")
def list_scrapes(days: int = Query(30, ge=1, le=180), limit: int = Query(500, le=2000)):
    """Per-run scrape history for the last N days."""
    since = datetime.utcnow() - timedelta(days=days)
    with get_session() as s:
        rows = list(
            s.execute(
                select(ScrapeRun)
                .where(ScrapeRun.started_at >= since)
                .order_by(ScrapeRun.started_at.desc())
                .limit(limit)
            ).scalars()
        )
        return [
            {
                "id": r.id,
                "kind": r.kind,
                "label": r.label,
                "source_id": r.source_id,
                "started_at": r.started_at.isoformat(),
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                "duration_s": r.duration_s,
                "rows_seen": r.rows_seen,
                "new_jobs": r.new_jobs,
                "updated_jobs": r.updated_jobs,
                "alerts_sent": r.alerts_sent,
                "status": r.status,
                "error": r.error,
                "breakdown": json.loads(r.breakdown_json) if r.breakdown_json else {},
            }
            for r in rows
        ]


@router.get("/scrapes/daily")
def daily_rollup(days: int = Query(30, ge=1, le=180)):
    """Daily rollup for charting: new_jobs/run_count/error_count per day per kind."""
    since = datetime.utcnow() - timedelta(days=days)
    with get_session() as s:
        rows = list(
            s.execute(
                select(ScrapeRun.started_at, ScrapeRun.kind, ScrapeRun.label, ScrapeRun.new_jobs, ScrapeRun.status)
                .where(ScrapeRun.started_at >= since)
            ).all()
        )

    daily: dict[str, dict] = defaultdict(lambda: {"new_jobs": 0, "runs": 0, "errors": 0, "by_label": defaultdict(int)})
    for started_at, kind, label, new_jobs, status in rows:
        day = started_at.strftime("%Y-%m-%d")
        d = daily[day]
        d["new_jobs"] += new_jobs or 0
        d["runs"] += 1
        if status == "error":
            d["errors"] += 1
        d["by_label"][label] += new_jobs or 0

    out = []
    cursor = (datetime.utcnow() - timedelta(days=days - 1)).date()
    end = datetime.utcnow().date()
    while cursor <= end:
        key = cursor.strftime("%Y-%m-%d")
        d = daily.get(key, {"new_jobs": 0, "runs": 0, "errors": 0, "by_label": {}})
        out.append({"date": key, **{k: v for k, v in d.items() if k != "by_label"}, "by_label": dict(d.get("by_label", {}))})
        cursor += timedelta(days=1)
    return out


@router.get("/notifications")
def list_notifications(days: int = Query(30, ge=1, le=180), channel: str | None = None, limit: int = Query(500, le=2000)):
    since = datetime.utcnow() - timedelta(days=days)
    with get_session() as s:
        q = select(Notification).where(Notification.sent_at >= since)
        if channel:
            q = q.where(Notification.channel == channel)
        rows = list(s.execute(q.order_by(Notification.sent_at.desc()).limit(limit)).scalars())
        return [
            {
                "id": n.id,
                "channel": n.channel,
                "kind": n.kind,
                "subject": n.subject,
                "body": n.body,
                "status": n.status,
                "error": n.error,
                "sent_at": n.sent_at.isoformat(),
            }
            for n in rows
        ]


@router.get("/jobs")
def scheduled_jobs():
    """Current state of the APScheduler — useful to confirm per-site intervals took effect."""
    from app import scheduler as sched

    return sched.list_jobs()


@router.get("/health")
def system_health():
    """Aggregated system status for the header indicator."""
    from app.config import settings as _s
    from app.llm.client import health as llm_health

    try:
        with engine.connect() as conn:
            conn.execute(select(1))
        db_ok = True
    except Exception as e:
        db_ok = False

    last_scrape = None
    sources_total = sources_error = 0
    last_notification = None
    last_alert = None
    with get_session() as s:
        last = s.execute(select(ScrapeRun).order_by(ScrapeRun.started_at.desc()).limit(1)).scalar_one_or_none()
        if last:
            last_scrape = {
                "kind": last.kind,
                "label": last.label,
                "started_at": last.started_at.isoformat(),
                "status": last.status,
                "new_jobs": last.new_jobs,
            }
        sources_total = s.scalar(select(func.count()).select_from(CompanySource).where(CompanySource.enabled == True)) or 0  # noqa: E712
        sources_error = s.scalar(select(func.count()).select_from(CompanySource).where(and_(CompanySource.enabled == True, CompanySource.last_status == "error"))) or 0  # noqa: E712
        last_n = s.execute(select(Notification).order_by(Notification.sent_at.desc()).limit(1)).scalar_one_or_none()
        if last_n:
            last_notification = {
                "channel": last_n.channel,
                "kind": last_n.kind,
                "subject": last_n.subject,
                "status": last_n.status,
                "sent_at": last_n.sent_at.isoformat(),
            }
        last_a = s.execute(
            select(Notification).where(Notification.kind == "alert").order_by(Notification.sent_at.desc()).limit(1)
        ).scalar_one_or_none()
        if last_a:
            last_alert = last_a.sent_at.isoformat()

    overall = "ok"
    if not db_ok:
        overall = "error"
    elif sources_error or (last_scrape and last_scrape["status"] == "error"):
        overall = "warn"

    return {
        "overall": overall,
        "db": {"ok": db_ok},
        "llm": llm_health(),
        "telegram_configured": bool(_s.telegram_bot_token and _s.telegram_chat_id),
        "email_configured": bool(_s.smtp_user and _s.smtp_password),
        "last_scrape": last_scrape,
        "sources_total": sources_total,
        "sources_error": sources_error,
        "last_notification": last_notification,
        "last_alert_at": last_alert,
    }
