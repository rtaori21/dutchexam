"""APScheduler-driven background polling. Started by FastAPI lifespan.

Built-in JobSpy sites each get their own scheduled job so LinkedIn,
Indeed, Glassdoor, etc. can run on independent intervals. Per-site
intervals are stored in `search_profile.yml -> scrapers.jobspy.site_intervals`;
fields not listed there fall back to `SCRAPE_INTERVAL_MINUTES`.
"""

from __future__ import annotations
import logging
from functools import partial
from apscheduler.schedulers.background import BackgroundScheduler
from app.config import settings
from app.scrapers.runner import run_scrape_pass
from app.scrapers.source_runner import run_due_sources
from app.notifier.digest import send_digest
from app.matcher.llm import deep_score_top_n
from app.profile_loader import load_profile, reload_all

log = logging.getLogger(__name__)
_scheduler: BackgroundScheduler | None = None


def _site_intervals() -> dict[str, int]:
    profile = load_profile()
    js = (profile.get("scrapers", {}) or {}).get("jobspy", {}) or {}
    intervals = (js.get("site_intervals") or {})
    enabled = js.get("sites", []) or []
    fallback = max(1, settings.scrape_interval_minutes)
    return {site: int(intervals.get(site, fallback)) for site in enabled}


def _add_jobspy_jobs() -> None:
    """Register one job per enabled built-in site, each with its own interval.
    Stagger first runs so they don't all hammer the network at once on startup —
    LinkedIn 30s out, Indeed 90s, Glassdoor 150s, etc."""
    if not _scheduler:
        return
    from datetime import datetime, timedelta

    intervals = _site_intervals()
    for i, (site, mins) in enumerate(intervals.items()):
        first_run = datetime.now() + timedelta(seconds=30 + i * 60)
        _scheduler.add_job(
            partial(run_scrape_pass, [site]),
            "interval",
            minutes=max(1, mins),
            id=f"jobspy:{site}",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
            next_run_time=first_run,
        )
    log.info("Registered %d JobSpy jobs: %s", len(intervals),
             ", ".join(f"{s}={m}m" for s, m in intervals.items()))


def start() -> None:
    global _scheduler
    if _scheduler:
        return
    _scheduler = BackgroundScheduler(timezone="Europe/Amsterdam")
    _add_jobspy_jobs()
    # Custom company-portal poller
    _scheduler.add_job(
        run_due_sources, "interval", minutes=1, id="sources",
        max_instances=1, coalesce=True,
    )
    # Twice-daily Telegram digest at 08:00 and 20:00 Europe/Amsterdam
    _scheduler.add_job(send_digest, "cron", hour="8,20", minute=0, id="digest")
    # LLM deep scoring once a day at 07:30
    _scheduler.add_job(lambda: deep_score_top_n(20), "cron", hour=7, minute=30, id="deep_score")
    # Drain the tailor retry queue every 5 minutes
    from app.tailor.retry import run_due as run_tailor_retries
    _scheduler.add_job(run_tailor_retries, "interval", minutes=5, id="tailor_retries",
                       max_instances=1, coalesce=True)
    _scheduler.start()
    log.info("Scheduler started")


def stop() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def reschedule() -> None:
    """Re-read the profile and re-create per-site JobSpy jobs. Other jobs
    (sources/digest/deep_score) are left alone."""
    if not _scheduler:
        return
    reload_all()
    # Remove every existing jobspy:* job then re-add from current profile.
    for job in list(_scheduler.get_jobs()):
        if job.id.startswith("jobspy:") or job.id == "scrape":
            try:
                _scheduler.remove_job(job.id)
            except Exception:
                pass
    _add_jobspy_jobs()


def list_jobs() -> list[dict]:
    """Diagnostic: returns the current scheduler state for the observability UI."""
    if not _scheduler:
        return []
    out = []
    for j in _scheduler.get_jobs():
        out.append({
            "id": j.id,
            "next_run": j.next_run_time.isoformat() if j.next_run_time else None,
            "trigger": str(j.trigger),
        })
    return out
