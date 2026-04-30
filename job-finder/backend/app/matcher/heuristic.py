"""Fast heuristic match scoring (0-100). Cheap, deterministic, runs on every
scraped row before any LLM call.

Strict location filter: jobs whose location is recognizably outside the target
countries/cities are filtered out unless they're remote and allow_remote=true.
This prevents the matcher from scoring (e.g.) "Head of Data, Adyen Chicago"
high just because the title is a perfect match.
"""

from __future__ import annotations
from app.profile_loader import load_profile

# Country aliases — extend if you target additional countries.
COUNTRY_ALIASES = {
    "Netherlands": ["netherlands", "nederland", "the netherlands", "holland", "nl"],
    "Belgium": ["belgium", "belgië", "belgique", "be"],
    "Germany": ["germany", "deutschland", "de"],
    "France": ["france", "fr"],
    "United Kingdom": ["united kingdom", "uk", "britain", "england", "scotland", "wales"],
    "Ireland": ["ireland", "éire", "ie"],
    "Spain": ["spain", "españa", "es"],
    "Portugal": ["portugal", "pt"],
    "Sweden": ["sweden", "sverige", "se"],
    "Denmark": ["denmark", "danmark", "dk"],
    "Norway": ["norway", "norge", "no"],
    "Finland": ["finland", "suomi", "fi"],
    "Switzerland": ["switzerland", "schweiz", "suisse", "ch"],
    "Austria": ["austria", "österreich", "at"],
    "Poland": ["poland", "polska", "pl"],
}


def _icontains(haystack: str, needles: list[str]) -> bool:
    h = haystack.lower()
    return any(n.lower() in h for n in needles)


def _route_resume(title: str, profile: dict) -> str:
    title_l = title.lower()
    for rule in profile.get("resume_routing", []):
        if any(m.lower() in title_l for m in rule.get("match", [])):
            return rule["use"]
    return profile.get("default_resume", "manager.md")


def _location_pass(location: str, is_remote: bool, lf: dict) -> tuple[bool, str]:
    """Returns (passes_filter, reason). Empty location is treated as ambiguous and
    allowed through with a downweight (caller can apply)."""
    allow_remote = lf.get("allow_remote", True)
    strict = lf.get("strict", True)
    countries = lf.get("countries", []) or []
    cities = lf.get("cities", []) or []

    # remote check
    if is_remote and allow_remote:
        return True, "remote OK"
    loc_l = (location or "").lower()
    if not loc_l:
        # ambiguous — let it through if non-strict
        return (not strict, "no location data")

    # explicit "remote" string in location
    if "remote" in loc_l and allow_remote:
        return True, "remote in location"

    # any city match
    for c in cities:
        if c.lower() in loc_l:
            return True, f"city match ({c})"

    # any country match (including aliases)
    for c in countries:
        aliases = COUNTRY_ALIASES.get(c, []) + [c.lower()]
        if any(a in loc_l for a in aliases):
            return True, f"country match ({c})"

    return (not strict, f"location outside target ({location})")


def score_job(job: dict) -> tuple[int, str, str | None]:
    """Returns (score, reasoning, suggested_resume_filename).
    Returns (0, reason, None) if hard-filtered out.
    """
    profile = load_profile()
    weights = profile["scoring"]["weights"]
    title = (job.get("title") or "").strip()
    company = (job.get("company") or "").strip()
    location = (job.get("location") or "").strip()
    description = (job.get("description") or "").strip()
    is_remote = bool(job.get("is_remote"))
    full = f"{title} {description}"

    # --- HARD FILTERS ---
    filt = profile.get("filters", {})
    if _icontains(title, filt.get("exclude_titles", [])):
        return 0, "Excluded: title matches blocklist", None
    if company and _icontains(company, filt.get("exclude_companies", [])):
        return 0, "Excluded: company on blocklist", None

    must_any = profile["scoring"].get("must_have_any", [])
    if must_any and not _icontains(full, must_any):
        return 0, "Excluded: missing required domain keywords (data/ai/ml/etc.)", None

    lf = profile.get("location_filter") or {}
    loc_passes, loc_reason = _location_pass(location, is_remote, lf)
    if not loc_passes:
        return 0, f"Excluded: {loc_reason}", None

    # --- SCORING ---
    score = 0
    reasons: list[str] = []

    primary = profile["target_roles"]["primary"]
    secondary = profile["target_roles"].get("secondary", [])
    if any(p.lower() in title.lower() for p in primary):
        score += weights["title_match"]
        reasons.append("primary title match")
    elif any(s.lower() in title.lower() for s in secondary):
        score += int(weights["title_match"] * 0.6)
        reasons.append("secondary title match")

    # location bonus (already passed the gate above)
    score += weights["location_match"]
    reasons.append(loc_reason)

    seniority_kw = profile["filters"].get("min_seniority_keywords", [])
    if _icontains(title, seniority_kw):
        score += weights["seniority_match"]
        reasons.append("senior+ title")
    elif _icontains(description[:1000], seniority_kw):
        score += int(weights["seniority_match"] * 0.5)
        reasons.append("senior+ keywords in description")

    domain_hits = sum(1 for k in must_any if k.lower() in full.lower())
    score += min(weights["keyword_density"], domain_hits * 2)
    if domain_hits:
        reasons.append(f"{domain_hits} domain keyword hits")

    score = max(0, min(100, score))
    return score, "; ".join(reasons) or "low signal", _route_resume(title, profile)
