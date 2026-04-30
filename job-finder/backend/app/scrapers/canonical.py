"""Cross-source duplicate detection via a canonical key derived from (company, title, city).

Same job posted to LinkedIn, Indeed, and Greenhouse will have different
external_ids but produce the same canonical_key, so we can flag clusters."""

from __future__ import annotations
import re

# Tokens we strip when normalizing titles
NOISE_TITLE_TOKENS = {
    "senior", "sr", "junior", "jr", "staff", "principal", "lead", "head",
    "manager", "director", "vp", "chief", "of", "the", "and", "&", "remote",
    "hybrid", "fulltime", "full-time", "part-time", "(m/f/d)", "(m/f)", "m/f/d",
}
COMPANY_NOISE = {"inc", "ltd", "llc", "ag", "gmbh", "bv", "n.v.", "corp", "co", "the"}


def _norm(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_title(title: str) -> str:
    parts = [t for t in _norm(title).split() if t not in NOISE_TITLE_TOKENS]
    return " ".join(parts) or _norm(title)


def normalize_company(company: str) -> str:
    parts = [t for t in _norm(company).split() if t not in COMPANY_NOISE]
    return " ".join(parts) or _norm(company)


def normalize_city(location: str) -> str:
    """Take the first comma-segment as the city signal."""
    s = (location or "").split(",")[0]
    return _norm(s)


def canonical_key(company: str, title: str, location: str) -> str:
    return f"{normalize_company(company)}|{normalize_title(title)}|{normalize_city(location)}"
