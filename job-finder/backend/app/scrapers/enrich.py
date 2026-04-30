"""Per-row enrichment applied at persistence time: salary parsing + recruiter
contact extraction. Cheap regex is always run; LLM fallbacks are gated."""

from __future__ import annotations
from app.parsers.salary import parse_salary_regex, parse_salary
from app.parsers.contacts import extract_contacts


def enrich_row(row: dict, *, llm_salary: bool = False) -> dict:
    """Mutates and returns the row dict with salary + contact fields filled.

    `llm_salary=True` lets the LLM extract salary when regex finds nothing —
    use sparingly to avoid token spend on every JD.
    """
    desc = row.get("description") or ""

    # Salary: only fill if missing
    if not (row.get("salary_min") and row.get("salary_max")):
        s = parse_salary_regex(desc) if not llm_salary else parse_salary(desc)
        if s:
            row["salary_min"] = float(s["min"])
            row["salary_max"] = float(s["max"])
            row["salary_currency"] = s.get("currency") or row.get("salary_currency") or "EUR"

    # Contacts
    c = extract_contacts(desc)
    row["recruiter_emails"] = ",".join(c["emails"])
    row["recruiter_linkedin"] = ",".join(c["linkedin"])

    return row
