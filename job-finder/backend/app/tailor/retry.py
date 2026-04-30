"""Tailor retry queue. When build_bundle() fails (typically rate-limit), the
job is queued and re-tried on a schedule with exponential backoff."""

from __future__ import annotations
import logging
from datetime import datetime, timedelta
from sqlalchemy import select
from app.db.session import get_session
from app.db.models import TailorRetry, Job

log = logging.getLogger(__name__)

# Backoff: 5m -> 15m -> 30m -> 60m -> 120m, then give up at 5 attempts.
BACKOFF_MINUTES = [5, 15, 30, 60, 120]
MAX_ATTEMPTS = len(BACKOFF_MINUTES)


def enqueue(job_id: int, error: str) -> None:
    """Insert or update a retry row for `job_id`."""
    now = datetime.utcnow()
    with get_session() as s:
        existing = s.execute(
            select(TailorRetry).where(TailorRetry.job_id == job_id)
        ).scalar_one_or_none()
        if existing:
            existing.attempts += 1
            existing.last_error = (error or "")[:1000]
            existing.last_attempt_at = now
            if existing.attempts < MAX_ATTEMPTS:
                existing.next_attempt_at = now + timedelta(minutes=BACKOFF_MINUTES[existing.attempts])
            else:
                # Park at "max" — don't keep retrying; user can reset from UI.
                existing.next_attempt_at = now + timedelta(days=365)
        else:
            s.add(TailorRetry(
                job_id=job_id, attempts=1, last_error=(error or "")[:1000],
                last_attempt_at=now, next_attempt_at=now + timedelta(minutes=BACKOFF_MINUTES[1]),
            ))
        s.commit()
    log.warning("Tailor enqueued for retry job_id=%d error=%r", job_id, (error or "")[:100])


def succeed(job_id: int) -> None:
    """Tailor succeeded; clear any pending retry."""
    with get_session() as s:
        existing = s.execute(
            select(TailorRetry).where(TailorRetry.job_id == job_id)
        ).scalar_one_or_none()
        if existing:
            s.delete(existing)
            s.commit()


def list_pending() -> list[dict]:
    with get_session() as s:
        rows = list(s.execute(
            select(TailorRetry).order_by(TailorRetry.next_attempt_at.asc())
        ).scalars())
        return [{
            "id": r.id,
            "job_id": r.job_id,
            "attempts": r.attempts,
            "max_attempts": MAX_ATTEMPTS,
            "last_error": r.last_error,
            "last_attempt_at": r.last_attempt_at.isoformat() if r.last_attempt_at else None,
            "next_attempt_at": r.next_attempt_at.isoformat(),
            "exhausted": r.attempts >= MAX_ATTEMPTS,
        } for r in rows]


def reset_one(job_id: int) -> bool:
    """User manually retried — wipe the row so build_bundle runs fresh."""
    with get_session() as s:
        existing = s.execute(
            select(TailorRetry).where(TailorRetry.job_id == job_id)
        ).scalar_one_or_none()
        if not existing:
            return False
        s.delete(existing)
        s.commit()
    return True


def run_due() -> dict:
    """Try every retry row whose next_attempt_at has passed. Called by the scheduler."""
    from app.tailor.bundle import build_bundle

    now = datetime.utcnow()
    with get_session() as s:
        due = list(s.execute(
            select(TailorRetry)
            .where(TailorRetry.next_attempt_at <= now, TailorRetry.attempts < MAX_ATTEMPTS)
        ).scalars())
        ids = [r.job_id for r in due]

    succeeded = failed = 0
    for jid in ids:
        try:
            build_bundle(jid)
            succeed(jid)
            succeeded += 1
            log.info("Tailor retry succeeded for job_id=%d", jid)
        except Exception as e:
            enqueue(jid, str(e))
            failed += 1
    return {"attempted": len(ids), "succeeded": succeeded, "failed": failed}
