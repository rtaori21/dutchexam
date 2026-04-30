"""Authenticated LinkedIn jobs-search scraper.

Reuses the saved cookie state from `data/linkedin_state.json` (also used by
the Easy Apply flow). Compared to JobSpy:
  - works with your real LinkedIn session, so no per-IP rate limit
  - can use any LinkedIn search URL — including saved searches with
    `f_TPR=r3600` (posted in last hour) for near-real-time freshness
  - DOM is fragile (LinkedIn changes class names) so it's best-effort

Source URL format examples:
  https://www.linkedin.com/jobs/search/?keywords=AI%20Manager&location=Netherlands&f_TPR=r3600
  https://www.linkedin.com/jobs/collections/recommended/  (your personalized feed)
"""

from __future__ import annotations
import logging
import re
from urllib.parse import urlparse, parse_qs
from app.config import settings

log = logging.getLogger(__name__)


def detect_token(url: str) -> str | None:
    """If this is a LinkedIn jobs URL we can scrape, return a label token (the URL itself)."""
    if not re.search(r"linkedin\.com/(jobs|jobs-guest)/", url, re.I):
        return None
    return url


def _state_path():
    return settings.data_dir / "linkedin_state.json"


def _login_if_needed(page) -> None:
    page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded", timeout=30000)
    if "feed" in page.url or "jobs" in page.url or "checkpoint" in page.url:
        return
    if not (settings.linkedin_email and settings.linkedin_password):
        raise RuntimeError("Not signed in and LINKEDIN_EMAIL/LINKEDIN_PASSWORD not set in .env")
    page.fill("input#username", settings.linkedin_email)
    page.fill("input#password", settings.linkedin_password)
    page.click("button[type='submit']")
    page.wait_for_load_state("networkidle", timeout=30000)
    if "checkpoint" in page.url or "challenge" in page.url:
        raise RuntimeError("LinkedIn challenge — sign in once via Chrome with the same email, then retry")


def fetch(url: str, *, max_jobs: int = 50) -> list[dict]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log.error("playwright not installed")
        return []

    state = _state_path()
    rows: list[dict] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(storage_state=str(state) if state.exists() else None)
        page = ctx.new_page()
        try:
            if not state.exists():
                _login_if_needed(page)
                ctx.storage_state(path=str(state))

            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2500)

            # If we got bounced to login, recover and retry
            if "/login" in page.url or "/uas/login" in page.url:
                _login_if_needed(page)
                ctx.storage_state(path=str(state))
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(2500)

            # Scroll the inner job list a few times to lazy-load more cards
            for _ in range(6):
                page.mouse.wheel(0, 2400)
                page.wait_for_timeout(600)

            # Job cards have varied class names; try multiple selectors and merge
            extracted = page.evaluate(
                """() => {
                    const out = [];
                    const seen = new Set();
                    const sels = [
                        'li[data-occludable-job-id]',
                        'div.job-card-container',
                        'div.base-card',
                        'li.jobs-search-results__list-item',
                    ];
                    for (const sel of sels) {
                        for (const el of document.querySelectorAll(sel)) {
                            const a = el.querySelector('a[href*="/jobs/view/"]') || el.querySelector('a.job-card-list__title') || el.querySelector('a.base-card__full-link');
                            if (!a) continue;
                            let href = a.href;
                            const idMatch = href.match(/jobs\\/view\\/(\\d+)/);
                            const id = idMatch ? idMatch[1] : href;
                            if (seen.has(id)) continue;
                            seen.add(id);
                            const titleEl = el.querySelector('.job-card-list__title, .base-search-card__title, h3') || a;
                            const companyEl = el.querySelector('.job-card-container__primary-description, .base-search-card__subtitle, .job-card-container__company-name, h4');
                            const locEl = el.querySelector('.job-card-container__metadata-item, .job-search-card__location');
                            out.push({
                                id,
                                href,
                                title: (titleEl?.innerText || '').trim().split('\\n')[0].slice(0, 200),
                                company: (companyEl?.innerText || '').trim().split('\\n')[0].slice(0, 200),
                                location: (locEl?.innerText || '').trim().split('\\n')[0].slice(0, 200),
                            });
                        }
                    }
                    return out;
                }"""
            )
        except Exception as e:
            log.exception("linkedin_auth fetch failed for %s: %s", url, e)
            extracted = []
        finally:
            browser.close()

    for j in (extracted or [])[:max_jobs]:
        if not j.get("title") or not j.get("href"):
            continue
        rows.append(
            {
                "source": "linkedin_auth",
                "external_id": j["id"],
                "title": j["title"],
                "company": j.get("company", ""),
                "location": j.get("location", ""),
                "url": j["href"].split("?")[0],  # strip tracking query
                "description": "",
                "posted_at": None,
                "salary_min": None,
                "salary_max": None,
                "salary_currency": None,
                "is_remote": "remote" in (j.get("location", "")).lower(),
                "seniority": None,
                "job_type": None,
            }
        )

    log.info("linkedin_auth scraped %d jobs from %s", len(rows), url)
    return rows
