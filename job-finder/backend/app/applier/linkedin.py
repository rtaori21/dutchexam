"""LinkedIn Easy Apply automation via Playwright.

Safety gates:
- AUTO_APPLY_ENABLED must be true in .env
- LINKEDIN_EMAIL / LINKEDIN_PASSWORD must be set
- Reuses a stored auth state (cookies) so we log in only once
- Requires a tailored resume PDF (won't proceed without one)
- Captures a 'before-submit' screenshot; if SUBMIT_FOR_REAL=false, stops there
- Each call is invoked per-job by an explicit user action in the dashboard
"""

from __future__ import annotations
import logging
import os
from pathlib import Path
from app.config import settings

log = logging.getLogger(__name__)


def _state_path() -> Path:
    p = settings.data_dir / "linkedin_state.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _login(page) -> None:
    page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded", timeout=30000)
    if "feed" in page.url or "checkpoint" in page.url:
        return
    page.fill("input#username", settings.linkedin_email)
    page.fill("input#password", settings.linkedin_password)
    page.click("button[type='submit']")
    page.wait_for_load_state("networkidle", timeout=30000)
    if "checkpoint" in page.url or "challenge" in page.url:
        raise RuntimeError("LinkedIn requires manual MFA / captcha — log in once via your browser using the same email, then retry.")


def easy_apply(job_url: str, resume_pdf_path: str) -> dict:
    if not settings.auto_apply_enabled:
        return {"ok": False, "reason": "auto_apply disabled in .env (set AUTO_APPLY_ENABLED=true to enable)"}
    if not settings.linkedin_email or not settings.linkedin_password:
        return {"ok": False, "reason": "LINKEDIN_EMAIL/LINKEDIN_PASSWORD missing"}
    if not resume_pdf_path or not Path(resume_pdf_path).exists():
        return {"ok": False, "reason": f"resume PDF not found: {resume_pdf_path}"}

    submit_for_real = os.environ.get("SUBMIT_FOR_REAL", "false").lower() == "true"

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"ok": False, "reason": "Playwright not installed"}

    out_dir = settings.data_dir / "output" / "linkedin"
    out_dir.mkdir(parents=True, exist_ok=True)
    state = _state_path()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(storage_state=str(state) if state.exists() else None)
        page = ctx.new_page()

        try:
            if not state.exists():
                _login(page)
                ctx.storage_state(path=str(state))

            page.goto(job_url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1500)

            ea = page.locator("button:has-text('Easy Apply')").first
            if not ea.is_visible(timeout=5000):
                return {"ok": False, "reason": "Easy Apply button not found — this posting may require an external application"}
            ea.click()
            page.wait_for_timeout(800)

            # Walk through the multi-step modal: fill known fields, upload resume, click Next/Review.
            # We don't submit unless SUBMIT_FOR_REAL=true.
            for step in range(8):
                # Resume upload
                file_inputs = page.locator("input[type='file']")
                if file_inputs.count() and file_inputs.first.is_visible(timeout=1500):
                    file_inputs.first.set_input_files(str(resume_pdf_path))
                    page.wait_for_timeout(800)

                # Common phone/text questions
                phone = page.locator("input[id*='phoneNumber'], input[name*='phone']").first
                if phone and phone.is_visible(timeout=500):
                    try:
                        phone.fill(settings.alert_to or "+31 685249402")
                    except Exception:
                        pass

                next_btn = page.locator("button[aria-label='Continue to next step'], button:has-text('Next')").first
                review_btn = page.locator("button[aria-label='Review your application'], button:has-text('Review')").first
                submit_btn = page.locator("button[aria-label='Submit application'], button:has-text('Submit application')").first

                if submit_btn and submit_btn.is_visible(timeout=500):
                    pre = out_dir / f"prebmit_{abs(hash(job_url)) % 100000}.png"
                    page.screenshot(path=str(pre), full_page=True)
                    if submit_for_real:
                        submit_btn.click()
                        page.wait_for_timeout(2000)
                        post = out_dir / f"submitted_{abs(hash(job_url)) % 100000}.png"
                        page.screenshot(path=str(post), full_page=True)
                        ctx.storage_state(path=str(state))
                        return {"ok": True, "submitted": True, "screenshots": [str(pre), str(post)]}
                    return {"ok": True, "submitted": False, "reason": "stopped before submit (SUBMIT_FOR_REAL=false)", "screenshots": [str(pre)]}

                if review_btn and review_btn.is_visible(timeout=500):
                    review_btn.click()
                    page.wait_for_timeout(800)
                    continue
                if next_btn and next_btn.is_visible(timeout=500):
                    next_btn.click()
                    page.wait_for_timeout(800)
                    continue

                # If we reach here the form likely has a custom question we can't answer.
                shot = out_dir / f"stuck_{abs(hash(job_url)) % 100000}.png"
                page.screenshot(path=str(shot), full_page=True)
                return {
                    "ok": False,
                    "reason": "form needs manual input — open posting in your browser to answer custom questions",
                    "screenshots": [str(shot)],
                }
        except Exception as e:
            log.exception("easy_apply failed: %s", e)
            shot = out_dir / f"error_{abs(hash(job_url)) % 100000}.png"
            try:
                page.screenshot(path=str(shot), full_page=True)
            except Exception:
                pass
            return {"ok": False, "reason": str(e), "screenshots": [str(shot)]}
        finally:
            browser.close()

    return {"ok": False, "reason": "exhausted form steps without finding submit"}
