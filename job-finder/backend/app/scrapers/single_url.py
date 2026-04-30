"""Fetch a single job from any URL — Greenhouse / Lever / Ashby / LinkedIn / generic.

Used by `POST /api/jobs/import-url` so the user can paste any posting they
heard about (forwarded by a friend, seen on Twitter, etc.) and get it
through the same matcher + persist pipeline as a scheduled scrape."""

from __future__ import annotations
import logging
import re
from urllib.parse import urlparse
import httpx

log = logging.getLogger(__name__)


def _strip_html(s: str) -> str:
    import html
    s = html.unescape(s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _greenhouse_single(url: str) -> dict | None:
    """boards.greenhouse.io/<board>/jobs/<id> -> single job."""
    m = re.search(r"greenhouse\.io/(?:embed/job_app\?|v1/boards/|)([a-z0-9_\-]+)/jobs/(\d+)", url, re.I)
    if not m:
        # also handle job-boards.greenhouse.io/<board>/jobs/<id>
        m = re.search(r"job-boards\.greenhouse\.io/([a-z0-9_\-]+)/jobs/(\d+)", url, re.I)
    if not m:
        return None
    board, jid = m.group(1), m.group(2)
    api = f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{jid}"
    try:
        r = httpx.get(api, timeout=20)
        r.raise_for_status()
        j = r.json()
    except Exception as e:
        log.warning("greenhouse single fetch failed for %s: %s", url, e)
        return None
    return {
        "source": f"greenhouse:{board}",
        "external_id": str(j.get("id")),
        "title": j.get("title", ""),
        "company": (j.get("company") or {}).get("name") or board,
        "location": (j.get("location") or {}).get("name") or "",
        "url": j.get("absolute_url") or url,
        "description": _strip_html(j.get("content") or ""),
        "posted_at": None,
        "salary_min": None, "salary_max": None, "salary_currency": None,
        "is_remote": "remote" in ((j.get("location") or {}).get("name") or "").lower(),
        "seniority": None, "job_type": None,
    }


def _lever_single(url: str) -> dict | None:
    """jobs.lever.co/<slug>/<id>"""
    m = re.search(r"jobs\.lever\.co/([a-z0-9_\-]+)/([a-f0-9\-]+)", url, re.I)
    if not m:
        return None
    slug, jid = m.group(1), m.group(2)
    api = f"https://api.lever.co/v0/postings/{slug}/{jid}?mode=json"
    try:
        r = httpx.get(api, timeout=20)
        r.raise_for_status()
        j = r.json()
    except Exception as e:
        log.warning("lever single fetch failed for %s: %s", url, e)
        return None
    cat = j.get("categories") or {}
    desc_parts = [j.get("descriptionPlain") or "", j.get("additional") or ""]
    return {
        "source": f"lever:{slug}",
        "external_id": j.get("id", jid),
        "title": j.get("text", ""),
        "company": slug,
        "location": cat.get("location", "") or "",
        "url": j.get("hostedUrl") or j.get("applyUrl") or url,
        "description": " ".join(p for p in desc_parts if p),
        "posted_at": None,
        "salary_min": None, "salary_max": None, "salary_currency": None,
        "is_remote": "remote" in (cat.get("location", "") or "").lower(),
        "seniority": cat.get("commitment"),
        "job_type": cat.get("team"),
    }


def _linkedin_single(url: str) -> dict | None:
    """linkedin.com/jobs/view/<id>/ — render with Playwright (authenticated if creds set)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None
    from app.config import settings
    state = settings.data_dir / "linkedin_state.json"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(storage_state=str(state) if state.exists() else None)
        page = ctx.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1500)
            data = page.evaluate(
                """() => {
                    const t = document.querySelector('h1.t-24,h1');
                    const company = document.querySelector('a.topcard__org-name-link,.jobs-unified-top-card__company-name a,.topcard__flavor');
                    const loc = document.querySelector('.topcard__flavor--bullet,.jobs-unified-top-card__bullet');
                    const desc = document.querySelector('.show-more-less-html__markup,.jobs-description__container,.description__text');
                    return {
                        title: (t?.innerText || '').trim().slice(0, 200),
                        company: (company?.innerText || '').trim().slice(0, 150),
                        location: (loc?.innerText || '').trim().slice(0, 150),
                        description: (desc?.innerText || '').trim().slice(0, 20000),
                    };
                }"""
            )
        finally:
            browser.close()
    if not data or not data.get("title"):
        return None
    m = re.search(r"/jobs/view/(\d+)", url)
    ext_id = m.group(1) if m else url
    return {
        "source": "linkedin",
        "external_id": ext_id,
        "title": data["title"],
        "company": data.get("company", ""),
        "location": data.get("location", ""),
        "url": url.split("?")[0],
        "description": data.get("description", ""),
        "posted_at": None,
        "salary_min": None, "salary_max": None, "salary_currency": None,
        "is_remote": "remote" in (data.get("location", "")).lower(),
        "seniority": None, "job_type": None,
    }


def _generic_single(url: str) -> dict | None:
    """Last-resort: render the page with Playwright and pull whatever metadata is in
    OG tags + JSON-LD JobPosting schema. Works for many ATS pages out of the box."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None

    parsed = urlparse(url)
    company = parsed.netloc.replace("www.", "").split(".")[0]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )
        page = ctx.new_page()
        try:
            page.goto(url, wait_until="networkidle", timeout=45000)
        except Exception:
            pass
        try:
            data = page.evaluate(
                """() => {
                    const og = (p) => document.querySelector(`meta[property="og:${p}"]`)?.content;
                    let title = og('title') || document.querySelector('h1')?.innerText || document.title;
                    let desc = og('description') || document.querySelector('meta[name="description"]')?.content || '';
                    let location = '';
                    let company = '';
                    let posted = null;
                    // JSON-LD JobPosting
                    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
                        try {
                            const parsed = JSON.parse(s.textContent);
                            const items = Array.isArray(parsed) ? parsed : [parsed];
                            for (const it of items) {
                                if (it && (it['@type'] === 'JobPosting' || (Array.isArray(it['@type']) && it['@type'].includes('JobPosting')))) {
                                    title = it.title || title;
                                    desc = (it.description || desc).replace(/<[^>]+>/g, ' ').slice(0, 20000);
                                    company = (it.hiringOrganization && it.hiringOrganization.name) || company;
                                    const lo = it.jobLocation && (Array.isArray(it.jobLocation) ? it.jobLocation[0] : it.jobLocation);
                                    if (lo && lo.address) {
                                        location = [lo.address.addressLocality, lo.address.addressRegion, lo.address.addressCountry].filter(Boolean).join(', ');
                                    }
                                    posted = it.datePosted || null;
                                }
                            }
                        } catch (e) {}
                    }
                    return { title, desc, location, company, posted };
                }"""
            )
        finally:
            browser.close()

    if not data or not data.get("title"):
        return None
    return {
        "source": f"web:{company}",
        "external_id": url,
        "title": (data.get("title") or "")[:200],
        "company": (data.get("company") or company)[:150],
        "location": (data.get("location") or "")[:150],
        "url": url,
        "description": (data.get("desc") or "")[:20000],
        "posted_at": None,
        "salary_min": None, "salary_max": None, "salary_currency": None,
        "is_remote": "remote" in (data.get("location") or "").lower(),
        "seniority": None, "job_type": None,
    }


def fetch_single(url: str) -> dict | None:
    """Detect source from URL, fetch one job. Returns a normalised row or None."""
    if not url or not url.startswith(("http://", "https://")):
        return None
    if "greenhouse.io" in url:
        row = _greenhouse_single(url)
        if row:
            return row
    if "jobs.lever.co" in url:
        row = _lever_single(url)
        if row:
            return row
    if "linkedin.com/jobs/view" in url:
        row = _linkedin_single(url)
        if row:
            return row
    return _generic_single(url)
