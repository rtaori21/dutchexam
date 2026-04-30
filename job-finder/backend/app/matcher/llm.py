"""LLM-based deep match scoring. Catches semantic mismatches the keyword
matcher misses (e.g. an "AI Director" role that's actually a sales position).

Runs after the heuristic prefilter, only on the top N candidates per pass to
keep token costs bounded."""

from __future__ import annotations
import json
import logging
import re
from app.llm.client import chat as llm_chat
from app.profile_loader import load_profile

log = logging.getLogger(__name__)

DEEP_SCORE_SYSTEM = """You are a hiring strategist evaluating fit between a candidate and a job posting.
Score 0-100 where:
  90-100: dream fit — title, level, scope, and tech stack all align
  70-89:  strong fit — most signals align, minor gaps
  50-69:  borderline — some clear pluses and minuses; worth a look
  30-49:  weak — too junior, wrong domain, or scope mismatch
  0-29:   not a fit — wrong function, wrong industry, or trap (e.g. AI in title but actually sales)
Look for traps: titles that sound technical but are sales/marketing/product, or
seniority mismatches (e.g. "Senior Manager" that's actually a team lead with no reports).
Return ONLY a JSON object: {"score": <int>, "reasoning": "<one paragraph, max 60 words>"}"""


def deep_score(job_title: str, company: str, location: str, description: str) -> dict | None:
    """Returns {score, reasoning} or None on failure."""
    profile = load_profile()
    cand = profile.get("candidate", {})
    roles = profile.get("target_roles", {})
    narr = profile.get("narrative", {})
    user = (
        f"Job title: {job_title}\n"
        f"Company: {company}\n"
        f"Location: {location}\n\n"
        f"Job description (truncated):\n{(description or '')[:5000]}"
    )
    try:
        out = llm_chat(
            system=DEEP_SCORE_SYSTEM,
            user=user,
            cached_blocks=[
                f"Candidate:\n{json.dumps(cand)}\n\nTarget roles:\n{json.dumps(roles)}\n\nNarrative:\n{json.dumps(narr)}"
            ],
            max_tokens=300,
            kind="score",
        )
    except Exception as e:
        log.warning("deep_score LLM call failed for %r: %s", job_title, e)
        return None
    m = re.search(r"\{.*\}", out, re.S)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(d.get("score"), int):
        return None
    return {"score": max(0, min(100, d["score"])), "reasoning": (d.get("reasoning") or "")[:600]}


def deep_score_top_n(top_n: int = 20) -> dict:
    """Score the top N un-deep-scored jobs from the DB. Returns a summary
    and writes a ScrapeRun audit row so the run shows up on /observability."""
    from datetime import datetime
    from sqlalchemy import select
    from app.db.session import get_session
    from app.db.models import Job, ScrapeRun

    started = datetime.utcnow()
    with get_session() as s:
        candidates = list(
            s.execute(
                select(Job)
                .where(Job.llm_score.is_(None), Job.match_score >= 40)
                .order_by(Job.match_score.desc())
                .limit(top_n)
            ).scalars()
        )
    scored = 0
    for job in candidates:
        result = deep_score(job.title, job.company, job.location, job.description)
        if not result:
            continue
        with get_session() as s:
            fresh = s.get(Job, job.id)
            fresh.llm_score = result["score"]
            fresh.llm_reasoning = result["reasoning"]
            s.commit()
        scored += 1
    log.info("deep_score: %d/%d jobs scored", scored, len(candidates))

    finished = datetime.utcnow()
    # Truthful status: ok if all candidates scored, partial if some failed
    # (Groq rate limit), error if zero scored when there were candidates.
    if not candidates:
        status = "ok"
    elif scored == 0:
        status = "error"
    elif scored < len(candidates):
        status = "partial"
    else:
        status = "ok"
    with get_session() as s:
        s.add(ScrapeRun(
            kind="llm_score",
            label=f"deep_score(top {top_n})",
            started_at=started,
            finished_at=finished,
            duration_s=(finished - started).total_seconds(),
            rows_seen=len(candidates),
            new_jobs=scored,
            updated_jobs=0,
            alerts_sent=0,
            status=status,
            error="" if status != "error" else "no candidates scored (LLM down or rate-limited)",
        ))
        s.commit()
    return {"candidates": len(candidates), "scored": scored, "status": status}
