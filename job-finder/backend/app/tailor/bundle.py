"""Full per-job content bundle: tailored resume, cover letter, talking points,
and recruiter outreach message. Triggered when status moves new → approved."""

from __future__ import annotations
import hashlib
import json
import logging
from pathlib import Path
from app.config import settings
from app.profile_loader import load_profile
from app.llm.client import chat as llm_chat
from app.tailor.claude import tailor_resume, write_cover_letter
from app.parsers.contacts import write_outreach_message

log = logging.getLogger(__name__)


def _bundle_hash(version: str, base_md: str, jd: str) -> str:
    """Cache key for a tailored bundle. Same hash + same files on disk ->
    we already produced this exact output before; no LLM needed."""
    h = hashlib.sha256()
    h.update(b"v1\n")
    h.update(version.encode())
    h.update(b"\n---\n")
    h.update(base_md.encode())
    h.update(b"\n---\n")
    h.update(jd.encode())
    return h.hexdigest()

TALKING_POINTS_SYSTEM = """You are prepping a senior tech leader for an application/screening call.
Produce exactly 3 talking points that connect concrete proof points from the candidate's resume
to the most important requirements in the JD. Each talking point:
- 1-2 sentences max
- Lead with the proof point (number, project, scope), then the connection to the JD requirement
- No filler, no clichés
Return as a markdown bulleted list (3 dashes), nothing else."""


def write_talking_points(job_description: str, resume_md: str) -> str:
    profile = load_profile()
    return llm_chat(
        system=TALKING_POINTS_SYSTEM,
        user=f"Job description:\n{job_description}",
        cached_blocks=[
            f"Candidate profile:\n{json.dumps(profile.get('candidate', {}))}\n\nNarrative:\n{json.dumps(profile.get('narrative', {}))}",
            f"Resume:\n{resume_md}",
        ],
        max_tokens=600,
        kind="talking",
    )


def build_bundle(job_id: int, *, force: bool = False) -> dict:
    """Generate every piece of content for an approved job and persist to disk + DB.

    Caches by `(version, base_md, jd)` content hash — calling Re-tailor on the
    same inputs is now free and instant. Pass `force=True` to bypass the cache."""
    from app.db.session import get_session
    from app.db.models import Job

    with get_session() as s:
        job = s.get(Job, job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")
        version = job.suggested_resume or "manager.md"
        out_dir = settings.data_dir / "output" / f"job_{job.id:05d}"
        out_dir.mkdir(parents=True, exist_ok=True)
        title, company, jd = job.title, job.company, job.description

    base_path = settings.resumes_dir / version
    base_md = base_path.read_text() if base_path.exists() else ""
    expected_hash = _bundle_hash(version, base_md, jd)
    hash_path = out_dir / "bundle.hash"
    resume_path = out_dir / "resume.md"

    # Cache hit: same inputs, all artefacts present -> skip LLM calls entirely.
    if (
        not force
        and hash_path.exists()
        and hash_path.read_text().strip() == expected_hash
        and resume_path.exists()
        and (out_dir / "cover_letter.md").exists()
    ):
        log.info("Bundle cache HIT for job %d — skipping LLM calls", job_id)
        return {
            "job_id": job_id,
            "resume_version": version,
            "resume_path": str(resume_path),
            "resume_pdf_path": str(out_dir / "resume.pdf") if (out_dir / "resume.pdf").exists() else None,
            "cover_letter_path": str(out_dir / "cover_letter.md"),
            "talking_points_path": str(out_dir / "talking_points.md"),
            "outreach_path": str(out_dir / "outreach.md"),
            "base_resume_path": str(out_dir / "resume.base.md") if (out_dir / "resume.base.md").exists() else None,
            "cached": True,
        }

    log.info("Bundle for job %d (%s) version=%s — generating fresh", job_id, title, version)

    # 1. Tailored resume
    resume_md = tailor_resume(jd, version)
    (out_dir / "resume.md").write_text(resume_md)

    # Save base for diff viewer
    if base_path.exists():
        (out_dir / "resume.base.md").write_text(base_md)

    # 2. Cover letter
    cover_md = write_cover_letter(jd, resume_md)
    (out_dir / "cover_letter.md").write_text(cover_md)

    # 3. Talking points
    tp_md = write_talking_points(jd, resume_md)
    (out_dir / "talking_points.md").write_text(tp_md)

    # 4. Recruiter outreach
    outreach = write_outreach_message(title, company, jd)
    (out_dir / "outreach.md").write_text(outreach)

    # 5. PDF of resume (best-effort)
    pdf_path = None
    try:
        from app.tailor.pdf import render_pdf

        pdf_path = render_pdf(out_dir / "resume.md", out_dir / "resume.pdf")
    except Exception as e:
        log.warning("pdf render failed: %s", e)

    with get_session() as s:
        job = s.get(Job, job_id)
        job.talking_points = tp_md
        job.recruiter_message = outreach
        s.commit()

    # Persist cache key only on success
    hash_path.write_text(expected_hash)

    return {
        "job_id": job_id,
        "resume_version": version,
        "resume_path": str(out_dir / "resume.md"),
        "resume_pdf_path": str(pdf_path) if pdf_path else None,
        "cover_letter_path": str(out_dir / "cover_letter.md"),
        "talking_points_path": str(out_dir / "talking_points.md"),
        "outreach_path": str(out_dir / "outreach.md"),
        "base_resume_path": str(out_dir / "resume.base.md") if base_path.exists() else None,
        "cached": False,
    }
