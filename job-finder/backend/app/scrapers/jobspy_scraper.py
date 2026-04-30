"""Wraps `python-jobspy` to pull from LinkedIn/Indeed/Glassdoor for every
configured (search_term × country) pair.

Returns a list of normalized dicts ready for matcher + persistence.
"""

from __future__ import annotations
import logging
from datetime import datetime
import math
from app.profile_loader import load_profile

log = logging.getLogger(__name__)


def _safe_float(v):
    try:
        if v is None:
            return None
        f = float(v)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _safe_str(v) -> str:
    if v is None:
        return ""
    s = str(v)
    return "" if s.lower() == "nan" else s


def _to_dt(v):
    if not v or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, datetime):
        return v
    try:
        return datetime.fromisoformat(str(v))
    except ValueError:
        return None


def scrape(sites_override: list[str] | None = None) -> list[dict]:
    """Run a JobSpy pull for every (search_term × country) pair, dedupe, return rows.
    `sites_override`, when given, narrows to a subset of the profile's sites — used
    by the per-site scheduled jobs so each site (LinkedIn / Indeed / etc.) can run
    on its own interval."""
    try:
        from jobspy import scrape_jobs
    except ImportError:
        log.error("python-jobspy not installed. Run: pip install -e backend")
        return []

    profile = load_profile()
    js = profile["scrapers"]["jobspy"]
    enabled = js.get("sites", [])
    sites = [s for s in enabled if s in (sites_override or enabled)] if sites_override else enabled
    if not sites:
        return []
    results_wanted = js.get("results_wanted", 25)
    hours_old = js.get("hours_old", 24)

    # Backwards-compat: support old single-location config and new countries list.
    countries = js.get("countries")
    if not countries:
        countries = [{"location": js.get("location", "Netherlands"), "country_indeed": js.get("country_indeed", "Netherlands")}]

    seen: set[tuple[str, str]] = set()
    rows: list[dict] = []

    for term in js["search_terms"]:
        for c in countries:
            location = c.get("location")
            country_indeed = c.get("country_indeed") or location
            # Glassdoor's location parser only accepts city or country names —
            # multi-word strings like "Remote, Europe" return HTTP 400. Drop
            # Glassdoor for those queries; the others handle it fine.
            sites_for_call = sites
            if "," in (location or "") and "glassdoor" in sites:
                sites_for_call = [s for s in sites if s != "glassdoor"]
            log.info("JobSpy: term=%r location=%r sites=%s", term, location, sites_for_call)
            try:
                df = scrape_jobs(
                    site_name=sites_for_call,
                    search_term=term,
                    location=location,
                    results_wanted=results_wanted,
                    hours_old=hours_old,
                    country_indeed=country_indeed,
                    linkedin_fetch_description=True,
                    verbose=0,
                )
            except Exception as e:
                log.exception("JobSpy failed for term=%r location=%r: %s", term, location, e)
                continue

            if df is None or df.empty:
                continue

            for _, r in df.iterrows():
                site = _safe_str(r.get("site")).lower() or "unknown"
                ext_id = _safe_str(r.get("id")) or _safe_str(r.get("job_url"))
                if not ext_id:
                    continue
                key = (site, ext_id)
                if key in seen:
                    continue
                seen.add(key)

                rows.append(
                    {
                        "source": site,
                        "external_id": ext_id,
                        "title": _safe_str(r.get("title")),
                        "company": _safe_str(r.get("company")),
                        "location": _safe_str(r.get("location"))
                        or _safe_str(r.get("city"))
                        or _safe_str(r.get("country")),
                        "url": _safe_str(r.get("job_url")),
                        "description": _safe_str(r.get("description")),
                        "posted_at": _to_dt(r.get("date_posted")),
                        "salary_min": _safe_float(r.get("min_amount")),
                        "salary_max": _safe_float(r.get("max_amount")),
                        "salary_currency": _safe_str(r.get("currency")) or None,
                        "is_remote": bool(r.get("is_remote") or False),
                        "seniority": _safe_str(r.get("job_level")) or None,
                        "job_type": _safe_str(r.get("job_type")) or None,
                    }
                )
    log.info("JobSpy returned %d unique rows across %d term×country pairs",
             len(rows), len(js['search_terms']) * len(countries))
    return rows
