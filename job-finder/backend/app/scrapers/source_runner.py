"""Polls every enabled CompanySource and feeds rows through the same matcher
+ persistence + alerter pipeline used by JobSpy. Auto-detects ATS type from URL
when not specified, falling back to the generic Playwright crawler.
"""

from __future__ import annotations
import logging
from datetime import datetime, timedelta
from sqlalchemy import select
from app.db.session import get_session
from app.db.models import CompanySource, Job, StatusEvent
from app.matcher.heuristic import score_job
from app.scrapers.enrich import enrich_row
from app.scrapers.canonical import canonical_key
from app.config import settings
from app.scrapers import greenhouse, lever, ashby, generic_playwright, linkedin_auth
from app.db.models import ScrapeRun

log = logging.getLogger(__name__)


ATS_FETCHERS = {
    "greenhouse": (greenhouse.detect_token, greenhouse.fetch),
    "lever": (lever.detect_token, lever.fetch),
    "ashby": (ashby.detect_token, ashby.fetch),
    "linkedin": (linkedin_auth.detect_token, linkedin_auth.fetch),
}


def detect_ats(url: str) -> tuple[str, str | None]:
    """Returns (ats_type, board_token_or_None)."""
    for ats, (detector, _) in ATS_FETCHERS.items():
        token = detector(url)
        if token:
            return ats, token
    return "generic", None


def _scrape_one(src: CompanySource) -> tuple[list[dict], str | None]:
    """Fetch rows for a single source. Returns (rows, error_or_None)."""
    try:
        if src.ats in ATS_FETCHERS and src.board_token:
            _, fetcher = ATS_FETCHERS[src.ats]
            rows = fetcher(src.board_token)
        else:
            rows = generic_playwright.fetch(src.url)
        return rows, None
    except Exception as e:
        log.exception("Source %s scrape failed: %s", src.url, e)
        return [], str(e)


def _upsert_and_score(rows: list[dict], src: CompanySource) -> tuple[int, int, list[int]]:
    """Returns (new_jobs, updated_jobs, list_of_high_match_job_ids)."""
    new_count = 0
    updated_count = 0
    high_match_ids: list[int] = []
    with get_session() as session:
        for row in rows:
            # Tag company name with the user-supplied label if better than detected
            if src.name and (not row.get("company") or len(src.name) > len(row.get("company", ""))):
                row["company"] = src.name

            score, reasoning, resume = score_job(row)
            if score == 0:
                continue
            enrich_row(row)
            row["canonical_key"] = canonical_key(row.get("company", ""), row.get("title", ""), row.get("location", ""))
            existing = session.execute(
                select(Job).where(Job.source == row["source"], Job.external_id == row["external_id"])
            ).scalar_one_or_none()
            if existing:
                existing.match_score = score
                existing.match_reasoning = reasoning
                existing.suggested_resume = resume
                existing.canonical_key = row["canonical_key"]
                if not (existing.salary_min and existing.salary_max) and row.get("salary_min"):
                    existing.salary_min = row["salary_min"]
                    existing.salary_max = row["salary_max"]
                    existing.salary_currency = row.get("salary_currency")
                if row.get("recruiter_emails"):
                    existing.recruiter_emails = row["recruiter_emails"]
                if row.get("recruiter_linkedin"):
                    existing.recruiter_linkedin = row["recruiter_linkedin"]
                updated_count += 1
                continue
            # Cross-source auto-reject: if an equivalent job was previously
            # rejected by the user, mark this new row rejected too — no alert.
            from app.scrapers.runner import _initial_status_for

            initial_status, note = _initial_status_for(session, row)
            job = Job(**row, status=initial_status, match_score=score, match_reasoning=reasoning, suggested_resume=resume)
            session.add(job)
            session.flush()
            session.add(StatusEvent(job_id=job.id, from_status=None, to_status=initial_status, note=note))
            new_count += 1
            if initial_status == "new" and score >= settings.alert_min_score:
                high_match_ids.append(job.id)
        session.commit()
    return new_count, updated_count, high_match_ids


def run_due_sources() -> dict:
    """Scrape every CompanySource whose interval has elapsed.
    Each per-source scrape is logged as its own ScrapeRun."""
    started = datetime.utcnow()
    summary = {"sources_checked": 0, "sources_run": 0, "new_jobs": 0, "alerts_sent": 0, "errors": []}
    high_match_total: list[int] = []

    with get_session() as s:
        sources = list(s.execute(select(CompanySource).where(CompanySource.enabled == True)).scalars())  # noqa: E712

    for src in sources:
        summary["sources_checked"] += 1
        if src.last_scraped_at and (datetime.utcnow() - src.last_scraped_at) < timedelta(minutes=src.interval_min):
            continue
        summary["sources_run"] += 1
        run_started = datetime.utcnow()
        rows, err = _scrape_one(src)
        new_count = updated_count = 0
        if err is None:
            new_count, updated_count, hm = _upsert_and_score(rows, src)
            high_match_total.extend(hm)
        with get_session() as s:
            fresh = s.get(CompanySource, src.id)
            if fresh:
                fresh.last_scraped_at = datetime.utcnow()
                fresh.last_status = "error" if err else "ok"
                fresh.last_error = err or ""
                fresh.last_jobs_found = len(rows)
                s.commit()
            # Audit row for the observability dashboard
            now = datetime.utcnow()
            run = ScrapeRun(
                kind="source",
                label=f"{src.ats}:{src.name}",
                source_id=src.id,
                started_at=run_started,
                finished_at=now,
                duration_s=(now - run_started).total_seconds(),
                rows_seen=len(rows),
                new_jobs=new_count,
                updated_jobs=updated_count,
                alerts_sent=0,
                status="error" if err else "ok",
                error=err or "",
            )
            s.add(run)
            s.commit()
        if err:
            summary["errors"].append({"source": src.name, "error": err[:200]})
        summary["new_jobs"] += new_count

    if high_match_total:
        from app.notifier.dispatch import notify_new_matches

        notify_new_matches(high_match_total)
        summary["alerts_sent"] = len(high_match_total)

    summary["duration_s"] = (datetime.utcnow() - started).total_seconds()
    log.info("Source pass: %s", summary)
    return summary


def run_one_source(source_id: int) -> dict:
    """Manual trigger for a single source — used by the dashboard 'Scrape now' button."""
    with get_session() as s:
        src = s.get(CompanySource, source_id)
        if not src:
            return {"error": "not found"}
    run_started = datetime.utcnow()
    rows, err = _scrape_one(src)
    new_count, updated_count, high_match_ids = (0, 0, [])
    if err is None:
        new_count, updated_count, high_match_ids = _upsert_and_score(rows, src)
    with get_session() as s:
        fresh = s.get(CompanySource, source_id)
        if fresh:
            fresh.last_scraped_at = datetime.utcnow()
            fresh.last_status = "error" if err else "ok"
            fresh.last_error = err or ""
            fresh.last_jobs_found = len(rows)
            s.commit()
        now = datetime.utcnow()
        run = ScrapeRun(
            kind="source",
            label=f"{src.ats}:{src.name}",
            source_id=src.id,
            started_at=run_started,
            finished_at=now,
            duration_s=(now - run_started).total_seconds(),
            rows_seen=len(rows),
            new_jobs=new_count,
            updated_jobs=updated_count,
            alerts_sent=len(high_match_ids),
            status="error" if err else "ok",
            error=err or "",
        )
        s.add(run)
        s.commit()
    if high_match_ids:
        from app.notifier.dispatch import notify_new_matches

        notify_new_matches(high_match_ids)
    return {
        "source": src.name,
        "rows": len(rows),
        "new_jobs": new_count,
        "updated_jobs": updated_count,
        "alerts_sent": len(high_match_ids),
        "error": err,
    }
