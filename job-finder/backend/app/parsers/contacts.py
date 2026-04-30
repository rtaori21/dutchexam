"""Extract recruiter emails and LinkedIn handles from job descriptions, then
generate a ready-to-send outreach message."""

from __future__ import annotations
import re
import json
import logging
from app.llm.client import chat as llm_chat
from app.profile_loader import load_profile

log = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
LINKEDIN_RE = re.compile(r"https?://(?:www\.)?linkedin\.com/in/[A-Za-z0-9_\-%/.]+", re.I)

# Filter out role-based/generic addresses that aren't real recruiter contacts.
GENERIC_LOCAL_PARTS = {
    "info", "support", "hello", "contact", "noreply", "no-reply", "privacy",
    "legal", "press", "media", "marketing", "sales", "billing", "admin",
    "accounting", "hr", "people", "careers", "jobs", "recruiting", "talent",
    "applications",
}


def extract_contacts(description: str) -> dict:
    """Returns {emails: [...], linkedin: [...]} after filtering generics."""
    if not description:
        return {"emails": [], "linkedin": []}
    emails = sorted({e.lower() for e in EMAIL_RE.findall(description)})
    emails = [e for e in emails if e.split("@", 1)[0] not in GENERIC_LOCAL_PARTS]
    handles = sorted({h.rstrip("/").lower() for h in LINKEDIN_RE.findall(description)})
    return {"emails": emails, "linkedin": handles}


OUTREACH_SYSTEM = """You write short, specific outreach messages from a senior tech leader to a recruiter.
- 80-110 words.
- Mention 1 concrete proof point from the candidate's resume that maps to the role.
- One short sentence on availability/visa status.
- End with a clear CTA: "open to a 20-minute intro call this/next week".
- No emojis, no clichés, no "I'm thrilled".
- Return ONLY the message body, no greeting/signoff."""


def write_outreach_message(job_title: str, company: str, jd_excerpt: str) -> str:
    profile = load_profile()
    cand = profile.get("candidate", {})
    narr = profile.get("narrative", {})
    user = (
        f"Role: {job_title} at {company}.\n"
        f"JD excerpt:\n{(jd_excerpt or '')[:3000]}"
    )
    return llm_chat(
        system=OUTREACH_SYSTEM,
        user=user,
        cached_blocks=[
            f"Candidate:\n{json.dumps(cand)}\n\nNarrative:\n{json.dumps(narr)}",
        ],
        max_tokens=350,
    )
