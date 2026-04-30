"""Orchestrates a JobSpy scrape pass: pull rows, score, persist new ones, fire alerts.
Writes a ScrapeRun audit row at the *start* of the pass with status=running so the
Observability dashboard shows live activity, then updates it on completion."""

from __future__ import annotations
import json
import logging
from collections import Counter
from datetime import datetime
from sqlalchemy import select
from app.db.session import get_session
from app.db.models import Job, StatusEvent, ScrapeRun
from app.scrapers.jobspy_scraper import scrape as jobspy_scrape
from app.matcher.heuristic import score_job
from app.scrapers.enrich import enrich_row
from app.scrapers.canonical import canonical_key
from app.config import settings

log = logging.getLogger(__name__)


def _initial_status_for(session, row: dict) -> tuple[str, str]:
    """Cross-source auto-reject: if a job with the same canonical_key was
    previously rejected OR marked lost, suppress new arrivals of equivalent
    jobs from any other source."""
    src = row.get("source", "?")
    ck = row.get("canonical_key")
    if not ck:
        return "new", f"discovered via {src}"
    suppressed_statuses = ("rejected", "lost")
    prior = session.execute(
        select(Job).where(Job.canonical_key == ck, Job.status.in_(suppressed_statuses)).limit(1)
    ).scalar_one_or_none()
    if prior:
        return "rejected", f"auto-rejected: matches previously {prior.status} #{prior.id}"
    return "new", f"discovered via {src}"


def _upsert(session, row: dict) -> tuple[Job, bool, str]:
    """Returns (job, inserted, initial_status). initial_status is 'new' for
    fresh inserts unless cross-source rejection suppression kicked in."""
    existing = session.execute(
        select(Job).where(Job.source == row["source"], Job.external_id == row["external_id"])
    ).scalar_one_or_none()
    if existing:
        return existing, False, existing.status
    status, note = _initial_status_for(session, row)
    job = Job(**row, status=status)
    session.add(job)
    session.flush()
    session.add(StatusEvent(job_id=job.id, from_status=None, to_status=status, note=note))
    return job, True, status


def _create_run_row(label: str) -> int:
    """Open a ScrapeRun row in 'running' state and return its id."""
    with get_session() as s:
        run = ScrapeRun(
            kind="jobspy",
            label=label,
            started_at=datetime.utcnow(),
            status="running",
        )
        s.add(run)
        s.commit()
        s.refresh(run)
        return run.id


def _close_run_row(run_id: int, *, status: str, error: str, started: datetime,
                   rows_seen: int, new_jobs: int, updated_jobs: int,
                   alerts_sent: int, breakdown: dict) -> None:
    finished = datetime.utcnow()
    with get_session() as s:
        run = s.get(ScrapeRun, run_id)
        if not run:
            return
        run.finished_at = finished
        run.duration_s = (finished - started).total_seconds()
        run.rows_seen = rows_seen
        run.new_jobs = new_jobs
        run.updated_jobs = updated_jobs
        run.alerts_sent = alerts_sent
        run.status = status
        run.error = error
        run.breakdown_json = json.dumps(breakdown)
        s.commit()


def run_scrape_pass(sites: list[str] | None = None) -> dict:
    """One JobSpy pass. If `sites` is given, only those sites are pulled.
    Returns a summary dict and writes a ScrapeRun row (visible while running)."""
    started = datetime.utcnow()
    label = "+".join(s.title() for s in (sites or ["LinkedIn", "Indeed", "Glassdoor"]))
    run_id = _create_run_row(label)

    rows: list[dict] = []
    new_count = updated_count = 0
    high_match_ids: list[int] = []
    breakdown: Counter[str] = Counter()
    error = ""
    scrape_errors: list[dict] = []

    try:
        rows, scrape_errors = jobspy_scrape(sites_override=sites)
        with get_session() as session:
            for row in rows:
                score, reasoning, resume = score_job(row)
                if score == 0:
                    continue
                enrich_row(row)
                row["canonical_key"] = canonical_key(row.get("company", ""), row.get("title", ""), row.get("location", ""))
                job, inserted, initial_status = _upsert(session, row)
                job.match_score = score
                job.match_reasoning = reasoning
                job.suggested_resume = resume
                job.canonical_key = row["canonical_key"]
                session.commit()
                if inserted:
                    new_count += 1
                    breakdown[row["source"]] += 1
                    # Only alert + count for stats if it actually surfaced as 'new'.
                    # Cross-source-auto-rejected jobs are silently filed away.
                    if initial_status == "new" and score >= settings.alert_min_score:
                        high_match_ids.append(job.id)
                else:
                    updated_count += 1
    except Exception as e:
        log.exception("scrape_pass failed: %s", e)
        error = str(e)

    if high_match_ids:
        from app.notifier.dispatch import notify_new_matches

        notify_new_matches(high_match_ids)

    if error:
        final_status = "error"
    elif scrape_errors:
        # Some site/term/country fetches failed (e.g. Glassdoor on multi-word locations)
        final_status = "partial"
        if not error:
            err_summary = "; ".join(f"{e.get('sites')} {e.get('location')!r}: {e.get('error','')[:60]}" for e in scrape_errors[:3])
            error = f"{len(scrape_errors)} fetch failures: {err_summary}"
    else:
        final_status = "ok"

    _close_run_row(
        run_id, status=final_status, error=error, started=started,
        rows_seen=len(rows), new_jobs=new_count, updated_jobs=updated_count,
        alerts_sent=len(high_match_ids), breakdown=dict(breakdown),
    )

    summary = {
        "started_at": started.isoformat(),
        "duration_s": (datetime.utcnow() - started).total_seconds(),
        "rows_seen": len(rows),
        "new_jobs": new_count,
        "updated_jobs": updated_count,
        "alerts_sent": len(high_match_ids),
        "breakdown": dict(breakdown),
        "status": final_status,
        "error": error,
    }
    log.info("Scrape pass: %s", summary)
    return summary
