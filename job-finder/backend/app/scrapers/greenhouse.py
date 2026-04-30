"""Greenhouse public board API. Fast, JSON, no auth.

Board token is the slug after `boards.greenhouse.io/` or `boards-api.greenhouse.io/v1/boards/`.
Example: https://boards.greenhouse.io/airbnb -> token = "airbnb"
"""

from __future__ import annotations
import re
import httpx


def detect_token(url: str) -> str | None:
    m = re.search(r"greenhouse\.io/(?:v1/boards/|embed/job_board\?for=|)([a-z0-9_\-]+)", url, re.I)
    return m.group(1) if m else None


def fetch(token: str) -> list[dict]:
    """Returns a list of normalized job rows for the given board token."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
    with httpx.Client(timeout=30, follow_redirects=True) as c:
        r = c.get(url)
        r.raise_for_status()
        data = r.json()

    rows = []
    for j in data.get("jobs", []):
        rows.append(
            {
                "source": f"greenhouse:{token}",
                "external_id": str(j.get("id")),
                "title": j.get("title", ""),
                "company": (j.get("company") or {}).get("name") or token,
                "location": (j.get("location") or {}).get("name") or "",
                "url": j.get("absolute_url", ""),
                "description": _strip_html(j.get("content") or ""),
                "posted_at": None,
                "salary_min": None,
                "salary_max": None,
                "salary_currency": None,
                "is_remote": "remote" in ((j.get("location") or {}).get("name") or "").lower(),
                "seniority": None,
                "job_type": None,
            }
        )
    return rows


def _strip_html(s: str) -> str:
    import html

    s = html.unescape(s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s
