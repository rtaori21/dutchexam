from datetime import datetime, timedelta
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from app.db.session import get_session
from app.db.models import Job, StatusEvent, JobStatus
from app.api.schemas import JobOut, StatusUpdate, NotesUpdate, StatsOut, SalaryHistogram, BundleOut
from app.config import settings
from app.scrapers.runner import run_scrape_pass

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"ok": True, "ts": datetime.utcnow().isoformat()}


@router.get("/llm/health")
def llm_health() -> dict:
    from app.llm.client import health as _h

    return _h()


@router.get("/jobs", response_model=list[JobOut])
def list_jobs(
    status: str | None = Query(None),
    min_score: int = Query(0, ge=0, le=100),
    source: str | None = Query(None),
    q: str | None = Query(None, description="Search title, company, location (case-insensitive)"),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
):
    from sqlalchemy import or_

    with get_session() as s:
        sel = select(Job)
        if status:
            sel = sel.where(Job.status == status)
        if min_score:
            sel = sel.where(Job.match_score >= min_score)
        if source:
            sel = sel.where(Job.source == source)
        if q:
            like = f"%{q}%"
            sel = sel.where(or_(Job.title.ilike(like), Job.company.ilike(like), Job.location.ilike(like)))
        sel = sel.order_by(Job.match_score.desc().nullslast(), Job.discovered_at.desc())
        sel = sel.limit(limit).offset(offset)
        return list(s.execute(sel).scalars())


# This must be declared BEFORE /jobs/{job_id} so the literal path wins the
# match — otherwise FastAPI tries to parse "duplicates" as an int job_id.
@router.get("/jobs/duplicates")
def find_duplicates():
    """Group jobs sharing canonical_key — same posting across LinkedIn/Indeed/Greenhouse/etc."""
    from app.scrapers.canonical import canonical_key

    with get_session() as s:
        jobs = list(s.query(Job).filter(Job.status != "rejected").all())
    by_key: dict[str, list] = {}
    for j in jobs:
        key = j.canonical_key or canonical_key(j.company, j.title, j.location)
        by_key.setdefault(key, []).append(j)
    clusters = []
    for key, group in by_key.items():
        if len(group) < 2:
            continue
        clusters.append(
            {
                "canonical_key": key,
                "count": len(group),
                "jobs": [
                    {
                        "id": j.id,
                        "title": j.title,
                        "company": j.company,
                        "location": j.location,
                        "source": j.source,
                        "url": j.url,
                        "match_score": j.match_score,
                        "llm_score": j.llm_score,
                        "status": j.status,
                    }
                    for j in sorted(group, key=lambda x: -(x.match_score or 0))
                ],
            }
        )
    clusters.sort(key=lambda c: -c["count"])
    return clusters


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: int):
    with get_session() as s:
        j = s.get(Job, job_id)
        if not j:
            raise HTTPException(404)
        return j


def _build_bundle_safe(job_id: int) -> None:
    """Run the full content bundle generation; swallow errors so background
    invocation never breaks the API. Errors are logged, the user can retry
    by clicking 'Re-tailor' on the detail page."""
    import logging

    log = logging.getLogger("api.bundle_bg")
    try:
        from app.tailor.bundle import build_bundle

        build_bundle(job_id)
    except Exception as e:
        log.exception("background bundle build failed for job %d: %s", job_id, e)


@router.patch("/jobs/{job_id}/status", response_model=JobOut)
def update_status(job_id: int, body: StatusUpdate, background: BackgroundTasks):
    if body.status not in JobStatus:
        raise HTTPException(400, f"Invalid status. Allowed: {JobStatus}")
    fire_bundle = False
    with get_session() as s:
        j = s.get(Job, job_id)
        if not j:
            raise HTTPException(404)
        prev = j.status
        j.status = body.status
        s.add(StatusEvent(job_id=j.id, from_status=prev, to_status=body.status, note=body.note))
        s.commit()
        s.refresh(j)
        # Auto-tailor on transition to "approved" (skip if bundle already exists)
        if prev != "approved" and body.status == "approved" and not j.talking_points:
            fire_bundle = True
        result = JobOut.model_validate(j)
    if fire_bundle:
        background.add_task(_build_bundle_safe, job_id)
    return result


@router.patch("/jobs/{job_id}/notes", response_model=JobOut)
def update_notes(job_id: int, body: NotesUpdate):
    with get_session() as s:
        j = s.get(Job, job_id)
        if not j:
            raise HTTPException(404)
        j.notes = body.notes
        s.commit()
        s.refresh(j)
        return j


@router.get("/jobs/{job_id}/events")
def list_events(job_id: int):
    """Status timeline for a job — used to render history on the detail page."""
    with get_session() as s:
        j = s.get(Job, job_id)
        if not j:
            raise HTTPException(404)
        rows = (
            s.query(StatusEvent)
            .filter(StatusEvent.job_id == job_id)
            .order_by(StatusEvent.created_at.asc())
            .all()
        )
        return [
            {
                "id": e.id,
                "from_status": e.from_status,
                "to_status": e.to_status,
                "note": e.note,
                "created_at": e.created_at.isoformat(),
            }
            for e in rows
        ]


@router.get("/stats", response_model=StatsOut)
def stats():
    with get_session() as s:
        total = s.scalar(select(func.count()).select_from(Job)) or 0
        rows = s.execute(select(Job.status, func.count()).group_by(Job.status)).all()
        by_status = {st: n for st, n in rows}
        since = datetime.utcnow() - timedelta(hours=24)
        new_today = (
            s.scalar(select(func.count()).select_from(Job).where(Job.discovered_at >= since)) or 0
        )
        applied_total = by_status.get("applied", 0) + by_status.get("interview", 0) + by_status.get(
            "offer", 0
        )
        avg = s.scalar(select(func.avg(Job.match_score)))
        return StatsOut(
            total=total,
            by_status=by_status,
            new_today=new_today,
            applied_total=applied_total,
            avg_score=float(avg) if avg is not None else None,
        )


@router.post("/scrape/run")
def trigger_scrape():
    """Manual trigger — useful for the dashboard 'Refresh' button."""
    return run_scrape_pass()


@router.post("/jobs/rescore")
def rescore_all():
    """Re-run the heuristic matcher over every persisted job. Called after
    profile changes (location filter, role lists, weights) so existing jobs
    reflect the new rules. Hard-filtered jobs are deleted so the feed stays clean."""
    from app.matcher.heuristic import score_job

    from app.scrapers.canonical import canonical_key

    rescored = 0
    deleted = 0
    with get_session() as s:
        jobs = list(s.query(Job).all())
        for j in jobs:
            row = {
                "title": j.title,
                "company": j.company,
                "location": j.location,
                "description": j.description,
                "is_remote": j.is_remote,
            }
            score, reasoning, resume = score_job(row)
            if score == 0 and j.status in ("new",):
                s.delete(j)
                deleted += 1
                continue
            j.match_score = score
            j.match_reasoning = reasoning
            j.suggested_resume = resume
            j.canonical_key = canonical_key(j.company, j.title, j.location)
            rescored += 1
        s.commit()
    return {"rescored": rescored, "deleted": deleted, "remaining": rescored}


@router.post("/jobs/{job_id}/tailor")
def tailor(job_id: int):
    """Generate the full content bundle: tailored resume + cover letter +
    talking points + recruiter outreach + PDF. Synchronous (waits for the LLM)."""
    from app.tailor.bundle import build_bundle

    try:
        return build_bundle(job_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/jobs/{job_id}/bundle", response_model=BundleOut)
def get_bundle(job_id: int):
    """Return all generated artifacts for a job (markdown for in-dashboard rendering)."""
    out_dir = settings.data_dir / "output" / f"job_{job_id:05d}"

    def _read(p: Path) -> str | None:
        return p.read_text() if p.exists() else None

    return BundleOut(
        job_id=job_id,
        base_resume_md=_read(out_dir / "resume.base.md"),
        tailored_resume_md=_read(out_dir / "resume.md"),
        cover_letter_md=_read(out_dir / "cover_letter.md"),
        talking_points_md=_read(out_dir / "talking_points.md"),
        outreach_md=_read(out_dir / "outreach.md"),
        resume_pdf_exists=(out_dir / "resume.pdf").exists(),
    )


@router.get("/jobs/{job_id}/resume.pdf")
def download_resume_pdf(job_id: int):
    p = settings.data_dir / "output" / f"job_{job_id:05d}" / "resume.pdf"
    if not p.exists():
        raise HTTPException(404, "PDF not generated yet — click 'Tailor' first")
    return FileResponse(p, media_type="application/pdf", filename=f"resume_job_{job_id}.pdf")


@router.post("/jobs/deep-score")
def trigger_deep_score(top_n: int = 20):
    """Run LLM deep scoring on the top N un-scored heuristic matches."""
    from app.matcher.llm import deep_score_top_n

    return deep_score_top_n(top_n)


@router.get("/stats/salaries", response_model=SalaryHistogram)
def salary_histogram():
    """Bucketed histogram of mid-range salaries among jobs that have salary data."""
    buckets = [
        {"label": "<60k", "low": 0, "high": 60_000},
        {"label": "60-80k", "low": 60_000, "high": 80_000},
        {"label": "80-100k", "low": 80_000, "high": 100_000},
        {"label": "100-120k", "low": 100_000, "high": 120_000},
        {"label": "120-150k", "low": 120_000, "high": 150_000},
        {"label": "150-200k", "low": 150_000, "high": 200_000},
        {"label": "200k+", "low": 200_000, "high": 10_000_000},
    ]
    with get_session() as s:
        rows = list(
            s.query(Job.salary_min, Job.salary_max, Job.salary_currency)
            .filter(Job.salary_min.is_not(None), Job.salary_max.is_not(None))
            .all()
        )
    if not rows:
        return SalaryHistogram(currency="EUR", buckets=[{**b, "count": 0} for b in buckets],
                               median_min=None, median_max=None, sample_size=0)

    mids = sorted([(lo + hi) / 2 for lo, hi, _ in rows])
    for b in buckets:
        b["count"] = sum(1 for m in mids if b["low"] <= m < b["high"])

    n = len(mids)
    lo_sorted = sorted([lo for lo, _, _ in rows])
    hi_sorted = sorted([hi for _, hi, _ in rows])
    return SalaryHistogram(
        currency=rows[0][2] or "EUR",
        buckets=buckets,
        median_min=lo_sorted[n // 2],
        median_max=hi_sorted[n // 2],
        sample_size=n,
    )


@router.post("/digest/preview")
def digest_preview():
    """Build the digest text without sending it. Useful to check what 8am/8pm will fire."""
    from app.notifier.digest import build_digest

    return {"text": build_digest()}


@router.post("/digest/send")
def digest_send_now():
    from app.notifier.digest import send_digest

    return send_digest()


@router.post("/jobs/{job_id}/apply")
def apply(job_id: int):
    """LinkedIn Easy Apply, gated by AUTO_APPLY_ENABLED + per-job click.

    Uses the most recent tailored resume PDF for this job (call /tailor first).
    Set SUBMIT_FOR_REAL=true env var to actually submit; otherwise stops at the
    pre-submit step and returns a screenshot path.
    """
    from app.applier.linkedin import easy_apply
    from app.config import settings as _s

    with get_session() as s:
        j = s.get(Job, job_id)
        if not j:
            raise HTTPException(404)
        pdf = _s.data_dir / "output" / f"job_{j.id:05d}" / "resume.pdf"
        return easy_apply(j.url, str(pdf))
