"""Best-effort scraper for arbitrary career pages (Workday, SmartRecruiters, custom).

Strategy:
1. Render the page with Playwright (handles JS-driven SPAs like Workday)
2. Extract all <a> elements whose href looks like a job posting and whose text looks like a title
3. Score titles against the search profile for relevance

This is intentionally conservative — it returns links + titles but no description.
The matcher's heuristic uses title + location, which is enough for the alert decision.
For deeper details, the user clicks through and reviews in the dashboard.
"""

from __future__ import annotations
import logging
import re
from urllib.parse import urljoin, urlparse

log = logging.getLogger(__name__)

# Heuristics for what looks like a "job posting" URL
JOB_URL_HINTS = (
    "/job/",
    "/jobs/",
    "/career/",
    "/careers/",
    "/openings/",
    "/positions/",
    "/vacancy/",
    "/vacancies/",
    "/posting/",
    "/postings/",
    "JobDetail",
    "/job-",
    "/joblist/",
)


def fetch(url: str, *, max_links: int = 200) -> list[dict]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log.error("Playwright not installed — `playwright install chromium` after pip install")
        return []

    parsed = urlparse(url)
    company = parsed.netloc.replace("www.", "").split(".")[0]
    rows: list[dict] = []
    seen: set[str] = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
        page = ctx.new_page()
        try:
            page.goto(url, wait_until="networkidle", timeout=45_000)
        except Exception as e:
            log.warning("Page load slow/timeout for %s: %s", url, e)

        # Try to expand "Show more" type buttons a couple times
        for _ in range(3):
            try:
                btn = page.locator("button:has-text('More'), button:has-text('Load'), button:has-text('Show')").first
                if btn and btn.is_visible(timeout=1500):
                    btn.click(timeout=1500)
                    page.wait_for_timeout(800)
            except Exception:
                break

        # Pull all anchors
        anchors = page.eval_on_selector_all(
            "a",
            "els => els.map(e => ({href: e.href, text: (e.innerText || '').trim().slice(0, 200)}))",
        )
        browser.close()

    for a in anchors[: max_links * 5]:  # over-collect, then filter
        href = a.get("href") or ""
        text = (a.get("text") or "").strip()
        if not href or not text or len(text) < 4:
            continue
        full = urljoin(url, href)
        if full in seen:
            continue
        if not any(h.lower() in full.lower() for h in JOB_URL_HINTS):
            continue
        # Skip nav links
        if re.fullmatch(r"(home|careers?|jobs?|all\s*jobs?|view\s*all)", text, re.I):
            continue
        seen.add(full)
        rows.append(
            {
                "source": f"web:{company}",
                "external_id": full,  # URL is the dedupe key
                "title": text.split("\n")[0][:200],
                "company": company,
                "location": "",
                "url": full,
                "description": "",
                "posted_at": None,
                "salary_min": None,
                "salary_max": None,
                "salary_currency": None,
                "is_remote": "remote" in text.lower(),
                "seniority": None,
                "job_type": None,
            }
        )
        if len(rows) >= max_links:
            break

    log.info("Generic Playwright scrape of %s -> %d candidate rows", url, len(rows))
    return rows
