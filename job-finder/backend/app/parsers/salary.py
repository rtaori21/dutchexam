"""Extract salary ranges from job descriptions.

Strategy:
1. Cheap regex first — handles 90% of cases ("€80k–120k", "EUR 100,000-140,000",
   "$120,000 to $160,000", "£70K-90K per year").
2. Fall back to LLM only if regex finds nothing AND the description mentions
   common salary keywords (we don't want to LLM-call every JD blindly).
"""

from __future__ import annotations
import re
import logging
from app.llm.client import chat as llm_chat

log = logging.getLogger(__name__)

CURRENCY_MAP = {"€": "EUR", "EUR": "EUR", "£": "GBP", "GBP": "GBP", "$": "USD", "USD": "USD"}

# Matches things like:
#   €80k - 120k        EUR 100,000 - 140,000      $120,000 to $160,000
#   £70K-90K           80–110k EUR
_NUM_K = r"(\d{2,3})(?:[.,]\d{3})?\s*[Kk]?"
_NUM_FULL = r"(\d{1,3}(?:[.,\s]\d{3})*(?:\.\d+)?)\s*[Kk]?"
SALARY_PATTERNS = [
    re.compile(rf"(?P<cur>[€£$]|EUR|GBP|USD)\s*{_NUM_FULL}\s*(?:[\-–—to]+|to)\s*(?:[€£$]|EUR|GBP|USD)?\s*{_NUM_FULL}", re.I),
    re.compile(rf"{_NUM_FULL}\s*(?:[\-–—to]+|to)\s*{_NUM_FULL}\s*(?P<cur>[€£$]|EUR|GBP|USD)", re.I),
    re.compile(rf"(?P<cur>[€£$]|EUR|GBP|USD)\s*{_NUM_K}\s*(?:[\-–—]|to)\s*{_NUM_K}", re.I),
]

KEYWORDS = ("salary", "compensation", "pay range", "remuneration", "ote", "base pay")


def _to_int(s: str) -> int | None:
    s = s.replace(" ", "").replace(",", "").replace(".", "")
    try:
        n = int(s)
    except ValueError:
        return None
    if n < 1000:
        n *= 1000  # treat "80" or "80k" as 80,000
    return n if 10_000 <= n <= 5_000_000 else None


def parse_salary_regex(text: str) -> dict | None:
    """Returns {min, max, currency} or None."""
    if not text:
        return None
    for pat in SALARY_PATTERNS:
        m = pat.search(text)
        if not m:
            continue
        groups = list(m.groups())
        # Find the currency group dynamically
        cur_raw = m.groupdict().get("cur") or ""
        # Extract two numerics by position (we don't know which group index)
        nums = [g for g in groups if g and re.match(r"^\d", str(g))]
        if len(nums) < 2:
            continue
        lo = _to_int(nums[0])
        hi = _to_int(nums[1])
        if lo is None or hi is None:
            continue
        if hi < lo:
            lo, hi = hi, lo
        # Sanity: range must be reasonable
        if hi / max(lo, 1) > 5:
            continue
        return {
            "min": lo,
            "max": hi,
            "currency": CURRENCY_MAP.get(cur_raw.upper(), CURRENCY_MAP.get(cur_raw, "EUR")),
        }
    return None


SALARY_LLM_SYSTEM = """Extract a salary range from the job description.
Return ONLY a JSON object: {"min": <int>, "max": <int>, "currency": "EUR"|"GBP"|"USD"}.
If no explicit numeric salary range is mentioned, return: {"min": null, "max": null, "currency": null}.
Numbers should be annual gross in the listed currency. Multiply Ks (e.g. 80k -> 80000)."""


def parse_salary_llm(description: str) -> dict | None:
    """Best-effort LLM extraction. Returns None on failure or missing data."""
    if not description:
        return None
    try:
        out = llm_chat(
            system=SALARY_LLM_SYSTEM,
            user=description[:6000],
            max_tokens=120,
            kind="salary",
        )
    except Exception as e:
        log.warning("salary LLM extraction failed: %s", e)
        return None
    import json
    import re as _re

    m = _re.search(r"\{.*\}", out, _re.S)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    if not (isinstance(d.get("min"), int) and isinstance(d.get("max"), int)):
        return None
    return {"min": d["min"], "max": d["max"], "currency": d.get("currency") or "EUR"}


def parse_salary(description: str) -> dict | None:
    """Regex first, LLM only if keywords present and regex empty."""
    out = parse_salary_regex(description)
    if out:
        return out
    if any(kw in (description or "").lower() for kw in KEYWORDS):
        return parse_salary_llm(description)
    return None
