"""Resume + cover-letter tailoring via the configured LLM backend.

Uses the unified `app.llm.client.chat()` so it works with Ollama (local/free),
Groq (free cloud), or Anthropic (paid) without code changes.
"""

from __future__ import annotations
import json
import logging
from app.config import settings
from app.profile_loader import load_profile
from app.llm.client import chat as llm_chat

log = logging.getLogger(__name__)

TAILOR_SYSTEM = """You are an elite resume strategist for senior tech leadership roles.
You receive a base resume (markdown) and a target job description.
Output a tailored markdown resume that:
- Stays truthful — no fabricated achievements, employers, or dates.
- Re-orders bullets so the most relevant 3 bullets per role appear first.
- Adds keywords from the JD verbatim where the candidate genuinely has the skill.
- Keeps the resume to one page (~600 words).
- Returns ONLY the tailored markdown, no commentary, no code fences."""

COVER_SYSTEM = """You write tight, specific cover letters for senior tech leaders.
3 short paragraphs, ~220 words total, no clichés, no "I'm thrilled".
Reference 1-2 concrete proof points from the resume that map to the JD.
Return ONLY the letter body, no greeting/signoff."""


def _read_resume(version: str) -> str:
    path = settings.resumes_dir / version
    if not path.exists():
        raise FileNotFoundError(f"Base resume not found: {path}")
    return path.read_text()


def tailor_resume(job_description: str, resume_version: str) -> str:
    profile = load_profile()
    base = _read_resume(resume_version)
    return llm_chat(
        system=TAILOR_SYSTEM,
        user=f"Job description:\n{job_description}",
        cached_blocks=[
            f"Candidate profile (truth source):\n{json.dumps(profile.get('candidate', {}))}\n\nNarrative:\n{json.dumps(profile.get('narrative', {}))}",
            f"Base resume (markdown):\n{base}",
        ],
        max_tokens=4000,
    )


def write_cover_letter(job_description: str, tailored_resume_md: str) -> str:
    return llm_chat(
        system=COVER_SYSTEM,
        user=f"Target job:\n{job_description}",
        cached_blocks=[f"Resume (truth source):\n{tailored_resume_md}"],
        max_tokens=1500,
    )


def tailor_for_job(job_id: int) -> dict:
    """Generate tailored resume + cover letter for a job; persist to data/output/."""
    from app.db.session import get_session
    from app.db.models import Job

    with get_session() as s:
        job = s.get(Job, job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")
        version = job.suggested_resume or "manager.md"
        out_dir = settings.data_dir / "output" / f"job_{job.id:05d}"
        out_dir.mkdir(parents=True, exist_ok=True)

        log.info("Tailoring job %d (%s) with backend=%s, base=%s",
                 job.id, job.title, settings.llm_backend, version)
        resume_md = tailor_resume(job.description, version)
        (out_dir / "resume.md").write_text(resume_md)

        cover = write_cover_letter(job.description, resume_md)
        (out_dir / "cover_letter.md").write_text(cover)

        # Auto-render PDF (best-effort; failure doesn't break the API call)
        pdf_path = None
        try:
            from app.tailor.pdf import render_pdf

            pdf_path = render_pdf(out_dir / "resume.md", out_dir / "resume.pdf")
        except Exception as e:
            log.warning("PDF render skipped: %s", e)

        return {
            "job_id": job.id,
            "resume_version": version,
            "resume_path": str(out_dir / "resume.md"),
            "cover_letter_path": str(out_dir / "cover_letter.md"),
            "resume_pdf_path": str(pdf_path) if pdf_path else None,
            "llm_backend": settings.llm_backend,
        }
