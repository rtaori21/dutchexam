"""Ashby public job board GraphQL endpoint."""

from __future__ import annotations
import re
import httpx


def detect_token(url: str) -> str | None:
    m = re.search(r"jobs\.ashbyhq\.com/([a-z0-9_\-]+)", url, re.I)
    return m.group(1) if m else None


def fetch(slug: str) -> list[dict]:
    api = "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiBoardWithTeams"
    payload = {
        "operationName": "ApiBoardWithTeams",
        "variables": {"organizationHostedJobsPageName": slug},
        "query": "query ApiBoardWithTeams($organizationHostedJobsPageName: String!) { jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) { jobPostings { id title locationName employmentType externalLink secondaryLocations { locationName } } } }",
    }
    with httpx.Client(timeout=30) as c:
        r = c.post(api, json=payload)
        r.raise_for_status()
        data = r.json()

    rows = []
    postings = (((data or {}).get("data") or {}).get("jobBoard") or {}).get("jobPostings") or []
    for j in postings:
        loc = j.get("locationName") or ""
        rows.append(
            {
                "source": f"ashby:{slug}",
                "external_id": j.get("id", ""),
                "title": j.get("title", ""),
                "company": slug,
                "location": loc,
                "url": j.get("externalLink") or f"https://jobs.ashbyhq.com/{slug}/{j.get('id')}",
                "description": "",  # Ashby description requires a 2nd call; skip for now (matcher uses title)
                "posted_at": None,
                "salary_min": None,
                "salary_max": None,
                "salary_currency": None,
                "is_remote": "remote" in loc.lower(),
                "seniority": None,
                "job_type": j.get("employmentType"),
            }
        )
    return rows
