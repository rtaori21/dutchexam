"""Lever public postings API. JSON, no auth.

Slug is the company portion of jobs.lever.co/{company}.
"""

from __future__ import annotations
import re
import httpx


def detect_token(url: str) -> str | None:
    m = re.search(r"jobs\.lever\.co/([a-z0-9_\-]+)", url, re.I)
    return m.group(1) if m else None


def fetch(slug: str) -> list[dict]:
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    with httpx.Client(timeout=30, follow_redirects=True) as c:
        r = c.get(url)
        r.raise_for_status()
        data = r.json()

    rows = []
    for j in data:
        cat = j.get("categories") or {}
        rows.append(
            {
                "source": f"lever:{slug}",
                "external_id": j.get("id", ""),
                "title": j.get("text", ""),
                "company": slug,
                "location": cat.get("location", "") or "",
                "url": j.get("hostedUrl") or j.get("applyUrl") or "",
                "description": _join(j.get("descriptionPlain"), j.get("additional"), j.get("lists")),
                "posted_at": None,
                "salary_min": None,
                "salary_max": None,
                "salary_currency": None,
                "is_remote": "remote" in (cat.get("location", "") or "").lower(),
                "seniority": cat.get("commitment"),
                "job_type": cat.get("team"),
            }
        )
    return rows


def _join(*parts) -> str:
    out = []
    for p in parts:
        if not p:
            continue
        if isinstance(p, list):
            for item in p:
                if isinstance(item, dict):
                    if item.get("text"):
                        out.append(item["text"])
                    if item.get("content"):
                        out.append(item["content"])
                else:
                    out.append(str(item))
        else:
            out.append(str(p))
    s = " ".join(out)
    import re as _re

    return _re.sub(r"\s+", " ", _re.sub(r"<[^>]+>", " ", s)).strip()
