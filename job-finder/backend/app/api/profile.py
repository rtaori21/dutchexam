"""GET + PATCH the editable parts of search_profile.yml from the dashboard."""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.profile_loader import load_profile, update_profile
from app.matcher.heuristic import COUNTRY_ALIASES

router = APIRouter()


class ProfilePatch(BaseModel):
    """Whitelisted keys the dashboard may write back. Everything is optional."""
    location_filter: dict | None = None
    target_roles: dict | None = None
    resume_routing: list[dict] | None = None
    default_resume: str | None = None
    filters: dict | None = None
    scoring: dict | None = None
    # Nested scraper fields
    sites: list[str] | None = None
    site_intervals: dict[str, int] | None = None
    search_terms: list[str] | None = None
    countries: list[dict] | None = None
    results_wanted: int | None = None
    hours_old: int | None = None


@router.get("")
def get_profile():
    p = load_profile()
    return {
        "candidate": p.get("candidate", {}),
        "location_filter": p.get("location_filter", {}),
        "target_roles": p.get("target_roles", {}),
        "resume_routing": p.get("resume_routing", []),
        "default_resume": p.get("default_resume"),
        "filters": p.get("filters", {}),
        "scoring": p.get("scoring", {}),
        "scrapers": p.get("scrapers", {}),
        "available_countries": sorted(COUNTRY_ALIASES.keys()),
    }


@router.patch("")
def patch_profile(body: ProfilePatch):
    payload = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    # Translate flat scraper fields into nested keys
    for nested in ("sites", "site_intervals", "search_terms", "countries", "results_wanted", "hours_old"):
        if nested in payload:
            payload[f"scrapers.jobspy.{nested}"] = payload.pop(nested)
    if not payload:
        raise HTTPException(400, "no patchable fields supplied")
    result = update_profile(payload)
    # If sites or site_intervals changed, reschedule the per-site JobSpy jobs immediately.
    if any(k.startswith("scrapers.jobspy.") for k in payload):
        try:
            from app import scheduler as sched

            sched.reschedule()
        except Exception:
            pass
    return result
