# Job Finder

A self-hosted job-search automation system. It continuously scrapes LinkedIn, Indeed, Glassdoor, and any career page you point it at, scores every posting against your profile, drafts tailored resumes and cover letters via an LLM, and gives you a single web dashboard to triage, apply, and track outcomes.

Runs entirely on your laptop. No SaaS, no monthly fees. Designed for a senior individual job-hunter who wants to maximise quality of applications and speed of response on new postings, while keeping every input — resume, profile, scoring rules, contact templates — in one editable place.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Feature overview](#feature-overview)
- [System architecture](#system-architecture)
- [Stack](#stack)
- [Quickstart](#quickstart)
- [First-time setup walkthrough](#first-time-setup-walkthrough)
- [How it works in detail](#how-it-works-in-detail)
- [Dashboard pages](#dashboard-pages)
- [Configuration reference](#configuration-reference)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Operations](#operations)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Repository layout](#repository-layout)

---

## Why this exists

Job boards optimise for the boards, not for the candidate. They surface noisy results, encourage one-click bulk applies that lower your hit rate, and never tell you when a fresh, perfect-fit posting drops. Recruiters and ATS systems use AI to filter you; this gives you AI on your side to filter them.

Concretely the system aims to:

1. **Be first to apply.** New postings hit your dashboard within minutes of being posted. Every applied moment after that lowers your odds.
2. **Filter aggressively.** Your time is the bottleneck. Strict location, role, and seniority filters keep your queue at a few dozen real candidates per day, not a thousand.
3. **Make every application high-effort cheap.** A single click moves a job to *approved* and the system spends ~$0.001 of LLM tokens to produce a tailored resume, cover letter, three talking points, and a recruiter outreach message — under a minute, end to end.
4. **Track everything.** Status, applied date, interview cadence, score, source, and audit history of every scrape and notification — visible in one place.
5. **Keep your truth source local.** Your resume variants, projects, interview Q&A bank, and search profile all live in plain Markdown / YAML on your filesystem. The LLM uses them as context — you control them, not a SaaS provider.

---

## Feature overview

### Discovery (scrapers)

| Source kind | Mechanism | Default interval |
|---|---|---|
| **LinkedIn (public)** | JobSpy scraper, anonymous | every 30 min |
| **Indeed** | JobSpy scraper, anonymous | every 60 min |
| **Glassdoor** | JobSpy scraper, anonymous | every 120 min |
| **Google Jobs / ZipRecruiter** | JobSpy, off by default | configurable |
| **LinkedIn (authenticated)** | Playwright with your saved login session, scrapes any LinkedIn search URL | per-source |
| **Greenhouse boards** | Public JSON API (`boards-api.greenhouse.io`) | per-source |
| **Lever boards** | Public JSON API (`api.lever.co/v0/postings`) | per-source |
| **Ashby boards** | Public GraphQL endpoint | per-source |
| **Workday / SmartRecruiters / custom** | Generic Playwright crawler — extracts job links from rendered DOM | per-source |

Each enabled built-in site runs as its own scheduled APScheduler job, so LinkedIn can poll every 15 min while Glassdoor polls every 2 hours — independent timers.

Custom company sources are user-added URLs. Paste any career page URL and the system auto-detects the ATS and uses the most efficient scraper. Each source has its own polling interval (default 15 min) editable from the dashboard.

### Matching and scoring

- **Heuristic matcher** — fast, deterministic. Hard-filters on title blocklist, required domain keywords, and a strict country/city/remote whitelist. Scores remaining jobs 0–100 across four weighted dimensions: title match, location match, seniority signal, keyword density.
- **Strict location filter** — the matcher will not score jobs outside your configured countries / cities unless they are remote and `allow_remote` is on. This is what keeps your queue from filling with US postings when you want NL only.
- **LLM deep scoring** — runs daily on the top 20 heuristic matches. Sends the JD plus your profile to the configured LLM and gets back a `0-100 fit score` plus a one-paragraph reasoning. Catches semantic mismatches the keyword matcher misses (e.g. "AI Director" titles that turn out to be sales roles, "Senior Manager" that's actually IC).

### Tailored content (LLM-driven)

When you mark a job *approved*, a background task runs that produces:

- **Tailored resume** — re-orders bullets, injects JD keywords, keeps facts truthful, outputs Markdown.
- **PDF rendering** — Markdown → HTML → A4 PDF via Playwright.
- **Cover letter** — three short paragraphs, ~220 words, references concrete proof points from the resume.
- **Three talking points** — for the screening call, each connecting a proof point to a JD requirement.
- **Recruiter outreach** — 80–110 word message you can paste into email or LinkedIn DM.

All artefacts persist to `data/output/job_NNNNN/` and render as tabs on the job's detail page, including a side-by-side diff against the base resume.

### Auto-apply (gated)

LinkedIn Easy Apply via Playwright. Disabled by default. When enabled it logs in once with your credentials, caches cookies, and walks the Easy Apply modal. Stops at the pre-submit step and screenshots the form unless `SUBMIT_FOR_REAL=true` env var is set, so you always have a chance to inspect before pressing Submit.

### Notifications

- **Telegram bot** — instant alerts plus twice-daily digests at 08:00 and 20:00 Europe/Amsterdam. Digest summarises new matches, jobs awaiting review, and status changes from the last 12 hours.
- **Email (SMTP)** — same payloads via Gmail (App Password) or any SMTP server. Optional.
- **Audit log** — every notification (including skipped/failed sends) is recorded in the `notifications` table and visible on the Observability page.

### Dashboard

A Next.js 15 app at `localhost:3737` with these pages:

- **Feed** — searchable, filterable list of all jobs with inline approve/reject/status, scores, salary, recruiter chips, source labels.
- **Sources** — built-in scraper toggles + per-site intervals + custom company URLs.
- **Knowledge** — resume editor and CRUD for projects, cover-letter templates, interview Q&A, notes, profile links. Items flagged "include in LLM" are added to the model's context.
- **Settings** — countries, cities, role lists, scraper search terms, scoring weights, blocklists.
- **Env** — every `.env` value editable in the UI with masked secrets, presets for intervals, and Test buttons for LLM / Telegram / Email.
- **Observability** — last 30 days of scrapes (per-site breakdown) + Telegram/email log with full message bodies + system health.
- **Duplicates** — clusters of the same job posted across multiple sources, with a one-click "reject all but the best" action.
- **Job detail** — full description, status timeline, tailored bundle viewer (resume / diff / cover / talking points / outreach), notes editor.
- **Header health dot** — green/yellow/red, polls every 30 s, links to the Observability page.

### Knowledge base

A central place to author the inputs the system uses for matching and tailoring:

- Multiple **resume variants** (manager / principal_ds / data_scientist / data_engineer by default; create your own).
- **Projects** — your concrete proof points with metrics; the LLM cites these in cover letters and talking points.
- **Cover letter templates** — reusable openers/closers the LLM remixes per JD.
- **Interview Q&A bank** — STAR stories accumulated over time, available to the LLM for talking-point generation.
- **Notes**, **profile links**, **summaries** — free-form context.

Items can be toggled in/out of the LLM context per-item, so you can keep private notes that never leave your laptop.

### Salary and contacts

- **Salary parser** — regex extraction from JDs (handles `EUR 100k–140k`, `€80,000-110,000`, `$120k to $160k`, etc.) with LLM fallback when keyword hints are present.
- **Salary histogram** — bucketed chart on the Feed page showing the spread of detected salaries with median.
- **Recruiter contacts** — emails (filtered against generics like `info@`/`careers@`) and LinkedIn handles extracted from JDs. Surface as one-click copy chips on the job detail page.

### Scheduler control

- Per-site intervals for each built-in JobSpy source.
- Per-source intervals for each user-added custom company URL.
- One-click `5m / 15m / 30m / 60m / 120m` presets on every interval.
- Hot reload — interval changes take effect immediately, no backend restart.

### Persistence and portability

- All state lives on your filesystem: SQLite database, generated resume PDFs, LinkedIn cookies, search profile, knowledge items.
- Bind-mounted in Docker so `docker compose down` never deletes anything.
- Migrating to a new laptop is "copy the project folder".

---

## System architecture

```
                    +-------------------------------------------------+
                    |                  Next.js 15 dashboard            |
                    |                http://localhost:3737             |
                    +-------------------+------------------------------+
                                        |
                                        | REST + JSON
                                        v
+--------------------------+   +---------+----------+   +----------------------+
|  APScheduler (in-proc)   |   |   FastAPI (8787)   |   |   SQLite (data/)     |
|  - jobspy:linkedin       |-->|  /api/jobs         |-->|   jobs               |
|  - jobspy:indeed         |   |  /api/sources      |   |   applications       |
|  - jobspy:glassdoor      |   |  /api/profile      |   |   status_events      |
|  - sources (every 1 min) |   |  /api/knowledge    |   |   company_sources    |
|  - digest (08, 20 cron)  |   |  /api/observability|   |   scrape_runs        |
|  - deep_score (07:30)    |   |  /api/env          |   |   notifications      |
+--------------------------+   |  ...               |   |   knowledge_items    |
                               +---------+----------+   +----------------------+
                                         |
              +--------------+-----------+-----------+----------------+
              |              |                       |                |
              v              v                       v                v
       +-------------+  +-----------+         +-------------+  +-------------+
       |  Scrapers   |  | Matcher   |         |   Tailor    |  |  Notifier   |
       |             |  |           |         |             |  |             |
       | JobSpy      |  | heuristic |         | LLM client  |  | Telegram    |
       | Greenhouse  |  | LLM deep  |         | PDF render  |  | Email/SMTP  |
       | Lever       |  +-----------+         | Markdown    |  +------+------+
       | Ashby       |                        +------+------+         |
       | LinkedIn    |                               |                |
       |   (auth +   |                               v                |
       |    public)  |                +--------------+--------------+  |
       | Playwright  |                |       LLM backends          |  |
       +-------------+                | Ollama / Groq / Anthropic   |  |
                                      +-----------------------------+  |
                                                                       v
                                                              +-----------------+
                                                              |  Audit log      |
                                                              | (notifications  |
                                                              |  table)         |
                                                              +-----------------+
```

The whole system is one process per service:

- **Backend** — FastAPI on port 8787. APScheduler runs in-process; no separate worker.
- **Frontend** — Next.js dev / standalone server on port 3737, bundled with the API base URL at build time.

There is no message queue, no Redis, no Postgres. SQLite handles everything fine for one user's job search.

---

## Stack

### Backend

- **Python 3.10+** with **FastAPI** for REST endpoints
- **SQLAlchemy 2.0** + **SQLite** for persistence (auto-migrating column adds)
- **APScheduler** for the recurring jobs (per-site scrape, custom-source poller, daily digest, daily deep-score)
- **Playwright** (Chromium, headless) for authenticated LinkedIn scraping, generic career-page crawling, PDF rendering, and Easy Apply
- **python-jobspy** for LinkedIn / Indeed / Glassdoor / Google / ZipRecruiter
- **httpx** for the Greenhouse / Lever / Ashby JSON APIs and for the Ollama / Groq / OpenAI-compatible LLM calls
- **anthropic** SDK for Claude (with prompt caching)
- **PyYAML**, **pydantic-settings**, **python-dotenv**

### Frontend

- **Next.js 15** App Router, TypeScript, Tailwind CSS
- No external UI library — Tailwind primitives only, dark theme, ~10 components total
- Standalone build for Docker (~150 MB final image)

### Storage

- **SQLite** at `data/jobs.db` for all relational state
- **Filesystem** at `data/output/job_NNNNN/` for tailored Markdown + PDF artefacts
- **Filesystem** at `resumes/*.md` for base resume variants
- **Filesystem** at `config/*.yml` for the search profile and company list
- **Filesystem** at `data/linkedin_state.json` for cached LinkedIn cookies

### Deployment

- **Docker Compose** for production-like local deployment (multi-arch: works on Apple Silicon and Intel/AMD)
- **Native Python venv + npm** for development with hot-reload

---

## Quickstart

### Option A — Docker (recommended for portability)

```bash
cd job-finder
./scripts/docker-up.sh
```

That single command:

1. Verifies Docker is installed and running
2. Creates `data/`, `resumes/`, `config/` on the host if missing
3. Copies `backend/.env.example` → `backend/.env` if missing
4. `docker compose build` (first run pulls ~1 GB and takes 3–5 minutes)
5. `docker compose up -d`
6. Prints the URLs

Open **http://localhost:3737** for the dashboard. Backend Swagger is at **http://localhost:8787/docs**.

To stop, run `docker compose down`. Your data persists on the host in `./data/`, `./resumes/`, `./config/`, `./backend/.env` — these are bind-mounted, not container-internal, so nothing is lost on `down`.

To migrate to a new laptop, copy the `job-finder/` folder, install Docker on the target, and run `./scripts/docker-up.sh`. Your job history, knowledge base, scoring rules, and LinkedIn cookies all come along.

**Useful operations:**

```bash
docker compose up -d --build      # apply code changes
docker compose down               # stop (data persists)
docker compose logs -f backend    # tail backend logs
docker compose logs -f frontend   # tail frontend logs
docker compose exec backend bash  # shell into backend container
docker compose ps                 # status
```

### Option B — Native Python + Node (faster iteration)

Requires Python 3.10+ and Node 22+.

```bash
cd job-finder
./scripts/run.sh
```

First run creates `backend/.venv`, installs the backend (`pip install -e backend`), installs the frontend (`npm install`), copies `backend/.env.example` → `backend/.env`, and starts both servers with hot reload. Open `http://localhost:3737`.

You will also need to install Playwright Chromium once after the venv is created:

```bash
source backend/.venv/bin/activate
playwright install chromium
```

---

## First-time setup walkthrough

### 1. Start the system

```bash
cd job-finder
./scripts/docker-up.sh    # or ./scripts/run.sh for native
```

Open http://localhost:3737. The header health dot should be green within a minute (DB initialised, scheduler running, no LLM configured yet so it will read "warn" until step 2).

### 2. Configure the LLM

Open **`/env`**. You have three options:

| Backend | Cost | Setup |
|---|---|---|
| **Ollama** (local) | Free, runs on your hardware | Install [Ollama](https://ollama.com), then `ollama pull llama3.1:8b`. In `/env` set `LLM_BACKEND=ollama` and `OLLAMA_HOST=http://localhost:11434` (or `http://host.docker.internal:11434` if running in Docker). |
| **Groq** (cloud) | Free tier, no credit card | Sign up at [console.groq.com](https://console.groq.com), generate an API key. In `/env` set `LLM_BACKEND=openai`, paste your key into `OPENAI_API_KEY`. |
| **Anthropic** (cloud, paid) | Best quality, costs cents per tailor | Get a key at [console.anthropic.com](https://console.anthropic.com). In `/env` set `LLM_BACKEND=anthropic` and paste your key into `ANTHROPIC_API_KEY`. |

Click **Save changes** at the bottom. The backend hot-reloads — no restart needed. Click **Test LLM** at the top of the page; you should see a green "LLM OK" banner.

For most users, Groq is the easiest start. The free tier handles ~30 requests per minute, which is more than enough for a personal job search.

### 3. Configure search criteria

Open **`/settings`**. Edit:

- **Countries** — the system filters out jobs outside these unless they are remote. Default: Netherlands. Click any country chip to add/remove.
- **Cities** — extra location keywords matched against the job's location field. Default: 9 Dutch cities.
- **Allow remote** — keep on if you want any-location remote postings.
- **Strict mode** — when on, jobs with no detectable location are dropped. Recommended.
- **Primary titles** — get full title-match score. Edit this to match what you actually want.
- **Secondary titles** — get 60% of the score (lower priority).
- **Scraper search terms** — what the system actually queries on LinkedIn / Indeed / Glassdoor.
- **Excludes** — title keywords and company names you never want to see.
- **Scoring weights** — fine-tune the four-dimension heuristic.

Edits auto-save to `config/search_profile.yml`. Existing scored jobs are not re-scored; new scrapes use the new rules. To force a re-score with the new rules, hit `POST /api/jobs/rescore`.

### 4. Author your resume(s) and knowledge base

Open **`/knowledge`**.

- **Resumes tab** — the file editor for `resumes/*.md`. The system seeds `manager.md` from your existing CV (if you copied one in) plus three skeleton variants. Edit each in Markdown. The matcher routes each scraped job to the right base resume via `search_profile.yml -> resume_routing`.
- **Projects tab** — add concrete proof points with metrics. The LLM cites these when tailoring cover letters and talking points.
- **Cover templates tab** — reusable openings and closings.
- **Interview Q&A tab** — accumulate STAR stories over time. They become talking-point ammunition during prep.
- **Notes / Profile links / Summaries** — free-form context.

Tick **"Include in LLM"** on items you want the LLM to consider when tailoring. Untick on private notes you want to keep local-only.

### 5. Configure alerts (optional)

Open **`/env`** again and scroll to:

- **Email** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`. For Gmail, use a [Google App Password](https://support.google.com/accounts/answer/185833), not your regular password. Set `ALERT_TO` to where you want notifications.
- **Telegram** — talk to [@BotFather](https://t.me/BotFather), `/newbot`, save the token into `TELEGRAM_BOT_TOKEN`. Send any message to your new bot, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the `chat.id` into `TELEGRAM_CHAT_ID`.

Both are optional — the dashboard works fine without them. Use **Test Telegram** / **Test Email** to verify.

### 6. Add your first scraping sources

Open **`/sources`**.

**Built-in scrapers** are already on by default (LinkedIn, Indeed, Glassdoor every 30/60/120 min). Toggle individual sites or change intervals with the preset buttons.

**Custom sources** — paste any of these and the system auto-detects:

- `https://boards.greenhouse.io/<company>` (e.g. Adyen, Mollie, Miro)
- `https://jobs.lever.co/<company>` (e.g. bunq)
- `https://jobs.ashbyhq.com/<company>` (e.g. Mistral, Anthropic)
- Any Workday / SmartRecruiters / custom careers page (uses generic Playwright)
- `https://www.linkedin.com/jobs/search/?keywords=...&f_TPR=r3600` (authenticated LinkedIn — see step 7)

Each source polls on its own interval. Hit **Scrape now** to test immediately.

### 7. (Optional) Authenticated LinkedIn scraping

For maximum freshness, configure LinkedIn login in `/env`:

```
LINKEDIN_EMAIL=your@email.com
LINKEDIN_PASSWORD=...
```

Then on `/sources`, paste a search URL with the `f_TPR=r3600` parameter (Date posted: Past hour):

```
https://www.linkedin.com/jobs/search/?keywords=AI%20Manager&location=Netherlands&f_TPR=r3600
```

Save with a 15-min interval. The first scrape triggers a Playwright login and caches cookies in `data/linkedin_state.json`; subsequent polls reuse the session. Because you are using your real session, no rate limit applies.

To create such a URL:
1. Go to LinkedIn, search for your role + location.
2. Click "Date posted" → "Past hour".
3. Copy the URL from the address bar.
4. Paste it into the custom source form on `/sources`.

### 8. Run your first scrape

On **`/`** (the Feed page), click **Run scrape now**. You will see a status message like *Found 12 new (276 seen, 4 alerts)*. Refresh — your new jobs appear sorted by heuristic score.

Click any job for the detail page. Use the inline status dropdown on each card to set a status. Set a job to **approved** and a tailored bundle starts generating in the background — check back in 30–60 seconds for the resume / cover / talking points / outreach tabs.

---

## How it works in detail

### The scrape pipeline

Each scraper produces a list of normalised job dicts:

```python
{
  "source": "linkedin" | "greenhouse:adyen" | ...,
  "external_id": "<id from source>",
  "title": "Senior Machine Learning Scientist",
  "company": "Adyen",
  "location": "Amsterdam, Netherlands",
  "url": "https://...",
  "description": "...",
  "salary_min": 80000.0,
  "salary_max": 110000.0,
  "salary_currency": "EUR",
  "is_remote": false,
  ...
}
```

Each row goes through:

1. **Heuristic match score** — `app/matcher/heuristic.py`. Hard-filter on title blocklist, required domain keywords, location filter. Score on title primary/secondary, location, seniority, keyword density.
2. **Filtered out** (score 0) — not persisted.
3. **Enrichment** — `app/scrapers/enrich.py`. Salary regex parse + LLM fallback when keywords present. Recruiter email + LinkedIn handle extraction.
4. **Canonical key** — `app/scrapers/canonical.py`. Normalises `(company, title, city)` into a string key used by the duplicate finder.
5. **Upsert** — by `(source, external_id)`. Existing rows get score and salary fields updated; new rows trigger a `StatusEvent("new")` and may fire an alert if score >= `ALERT_MIN_SCORE`.
6. **Audit row** — every scrape pass writes a `ScrapeRun` row with rows seen, new jobs, updated jobs, alerts sent, duration, status, error, and per-source breakdown.

### The matcher in depth

```
score = title_match + location_match + seniority_match + keyword_density   (max 100)

  title_match     : 40 if any of profile.target_roles.primary appears in title
                  : 24 if any of profile.target_roles.secondary appears in title
                  :  0 otherwise

  location_match  : 25 if remote and remote_ok
                  : 25 if any city in profile.location_filter.cities matches
                  : 25 if any country (with aliases) matches
                  :  0 if strict mode and none match -> filtered out
                  : 25 if not strict and no location info

  seniority_match : 25 if any seniority keyword in title (senior, staff, principal, lead, manager, director, head, vp, chief)
                  : 12 if seniority keyword only in description
                  :  0 otherwise

  keyword_density : min(10, count_of_must_have_any_in(title+desc) * 2)
```

The *strict* location filter is what makes this matcher actually useful — without it, JobSpy returns thousands of US/UK results for any senior role, and weighted scoring alone cannot push them out of the top results. The hard filter just drops them.

### LLM deep scoring

After the heuristic prefilter, the daily 07:30 cron picks the top 20 unscored jobs (heuristic >= 40) and sends each to the configured LLM with this system prompt (abbreviated):

> Score 0–100 where 90–100 is dream fit, 70–89 strong, 50–69 borderline, 30–49 weak, 0–29 not a fit. Look for traps: titles that sound technical but are sales/marketing/product, or seniority mismatches.

The model returns JSON `{score, reasoning}`. The reasoning paragraph is shown in italics on every job card and on the detail page. In practice the LLM frequently corrects the heuristic — it will downscore a "Senior Data Analyst — Risk" from 58 to 30 with reason *"Wrong function, not a technical leadership role"* and upscore "Head of Engineering — Adyen Protect" to 90 with *"Strong fit for Head of AI or Engineering Manager AI roles"*.

You can also trigger this on demand from the Feed page: **LLM score top 20** button.

### The tailor bundle

When a job moves to `approved`, the FastAPI route schedules a `BackgroundTask` that:

1. Reads the routed base resume from `resumes/<version>.md`.
2. Snapshots a copy at `data/output/job_NNNNN/resume.base.md` (so the diff viewer stays accurate even if you later edit the base).
3. Calls `tailor_resume(jd, base)` → tailored Markdown.
4. Calls `write_cover_letter(jd, tailored)` → cover letter.
5. Calls `write_talking_points(jd, tailored)` → 3 bullets.
6. Calls `write_outreach_message(title, company, jd)` → recruiter DM.
7. Renders `resume.md` to `resume.pdf` via Playwright (headless Chromium prints A4).
8. Writes `talking_points` and `recruiter_message` back to the `jobs` row.

Total cost on Groq with Llama 3.3 70B: ~6 LLM calls, all within the free tier rate limit. Total wall-clock: 30–90 seconds depending on backend.

The detail-page bundle viewer has tabs:

- **resume** — the tailored Markdown
- **diff** — line-level LCS diff against the base, additions in green, deletions in red strikethrough
- **cover** — letter Markdown
- **talking** — 3 bullets
- **outreach** — copy-paste recruiter message

There is also a **PDF ↗** link that downloads the rendered file directly.

### Notifications and digest

Two paths fire alerts:

- **Per-scrape alerts** — when a scrape pass discovers new jobs scoring >= `ALERT_MIN_SCORE` (default 70), one batched message lists all of them. Sent via Telegram and Email if configured.
- **Twice-daily digest** — APScheduler cron at 08:00 and 20:00 Europe/Amsterdam. Builds three sections: new matches in last 12 h, jobs awaiting your decision, status changes in last 12 h. Sent via Telegram only (the digest is verbose; email would be too noisy).

Every send (including failed and skipped) is logged to the `notifications` table with the full body, so the Observability page can show you exactly what was (or would have been) sent.

### Per-site scheduling

Each enabled built-in JobSpy site is its own APScheduler job — `jobspy:linkedin`, `jobspy:indeed`, `jobspy:glassdoor` — with its own interval pulled from `search_profile.yml -> scrapers.jobspy.site_intervals`. Toggling a site or changing its interval in the dashboard:

1. PATCHes `/api/profile` with the new value.
2. Profile YAML is rewritten atomically.
3. The PATCH handler calls `app.scheduler.reschedule()`.
4. `reschedule()` removes all `jobspy:*` jobs from APScheduler and re-adds them based on the current profile.

Effective in seconds. No restart.

### Custom company sources

A `CompanySource` row holds:
- name, url, ats type, board token (auto-detected)
- enabled flag, interval_min, last_scraped_at, last_status, last_error, last_jobs_found

A separate APScheduler job runs every 1 minute and iterates all enabled sources, skipping ones whose individual `interval_min` has not yet elapsed. This way you can have 10 sources at varying intervals without 10 separate scheduler entries.

### Duplicate detection

The canonical key for each job is computed as:

```
canonical_key = normalize_company(company) + "|" + normalize_title(title) + "|" + normalize_city(location)
```

Where `normalize_*` strips noise tokens (Inc/Ltd/AG; senior/junior/lead/manager; etc.) and lowercases. Jobs sharing a canonical key are clustered by the `/duplicates` page. The "Reject all but the best" action keeps the highest-heuristic-scoring entry and rejects the rest with a status note `duplicate of #N`.

### Auto-apply (LinkedIn Easy Apply)

`app/applier/linkedin.py` automates Easy Apply via Playwright:

1. Loads cached cookies from `data/linkedin_state.json` (or logs in fresh using `LINKEDIN_EMAIL`/`LINKEDIN_PASSWORD`).
2. Navigates to the job URL.
3. Clicks "Easy Apply".
4. Walks up to 8 modal steps, filling phone fields and uploading the tailored PDF resume.
5. At the Submit step, takes a pre-submit screenshot and saves it to `data/output/linkedin/`.
6. If `SUBMIT_FOR_REAL=true`, clicks Submit and saves a confirmation screenshot. Otherwise stops there.

Two safety gates: `AUTO_APPLY_ENABLED=true` in `.env` to enable at all, and `SUBMIT_FOR_REAL=true` env var on the request to actually press Submit. By default the Apply button on the job detail produces a screenshot only — you inspect, then re-trigger with the env var set if it looks right. This is intentional: bulk Easy Apply trips LinkedIn's anti-automation and lowers your hit rate anyway.

---

## Dashboard pages

### Feed (`/`)

Searchable, filterable list of every job in the database.

- **Search bar** — debounced text search across title, company, location.
- **Status chips** — `all / new (N) / approved / rejected / applied / screening / interview / offer / lost` with counts. URL-driven, so bookmarkable and link-shareable.
- **Min score** — heuristic score floor.
- **Stat cards** — Total / New (24 h) / Approved / Applied+ / Avg score.
- **Salary spread** — bucketed histogram of detected salaries with median (only renders when `sample_size > 0`).
- **Job rows** — title, status badge, source label, salary, scores, LLM reasoning, recruiter chip, and inline actions (Open / Approve / Reject / status dropdown / Review).
- **Toolbar buttons** — `LLM score top 20`, `Send digest now`, `Run scrape now`.

### Sources (`/sources`)

Two sections:

- **Built-in scrapers** — five toggleable cards (LinkedIn / Indeed / Glassdoor / Google Jobs / ZipRecruiter), each with an interval preset row (`5m / 15m / 30m / 60m / 120m`).
- **Custom sources** — add a URL with a label and interval; auto-detects Greenhouse / Lever / Ashby / LinkedIn-search / generic. Existing source cards have inline interval presets and Disable / Delete actions.

There is a collapsible "Tip: get LinkedIn jobs the moment they're posted" section explaining the `f_TPR=r3600` trick.

### Knowledge (`/knowledge`)

Seven tabs:

- **Resumes** — file editor for `resumes/*.md`. Create / read / update / delete files.
- **Projects / Cover templates / Interview Q&A / Notes / Profile links / Summaries** — DB-backed CRUD, each with a markdown body, optional URL, tags, and an "Include in LLM" toggle.

Items flagged `include_in_llm` are added as cached prompt blocks when the LLM tailor or matcher runs.

### Settings (`/settings`)

Dashboard-driven editor for `config/search_profile.yml`:

- Countries (chip multiselect across 15 EU countries with aliases)
- Cities (free-form list)
- Allow remote / strict mode toggles
- Primary / secondary roles
- Scraper search terms
- Title and company blocklists
- Scoring weights

Auto-saves on every change.

### Env (`/env`)

The full `.env` editor.

- Grouped by section (LLM / Email / Telegram / Schedule / LinkedIn).
- Inline help text for every key.
- Secrets shown masked (`gsk_••••••••vmtv` lets you verify without exposing).
- `set / not set` chip on every field.
- Per-field dirty tracking — only edited fields are sent on save.
- Interval presets for `SCRAPE_INTERVAL_MINUTES` and `SOURCE_INTERVAL_MINUTES`.
- **Test LLM / Test Telegram / Test Email** buttons that exercise the configured backend immediately.
- Saves trigger backend hot-reload of `Settings` and APScheduler reschedule — no container restart.

### Observability (`/observability`)

The audit dashboard.

- **Health cards** — Overall / LLM / Sources / Telegram / Email status.
- **Daily new-jobs chart** — bar chart with error overlay for the selected window (7 / 14 / 30 / 90 days).
- **Scrapes tab** — per-run audit table with kind, source label, rows seen, new, updated, alerts, duration, status, error, and aggregate breakdown by source.
- **Telegram tab** — full message log with subject, status (sent/failed/skipped), error, and a "show body" toggle that reveals the exact text sent (or that would have been sent).
- **Email tab** — same for email.

### Duplicates (`/duplicates`)

Clusters of jobs sharing a canonical key. Each cluster shows the "best" job (highest heuristic score, green border) plus its duplicates with friendly source labels. The "Reject all but the best" button moves the duplicates to status `rejected` with a note linking to the kept entry.

### Job detail (`/jobs/<id>`)

Full single-job view.

- Header: title, company, location, salary, source chip, both heuristic and LLM scores with reasoning paragraphs, full status button row.
- Recruiter contacts panel (when present) — copy-on-click email chips and clickable LinkedIn links.
- **Description** — left column, scrollable.
- **Tailored bundle** — right column with `Tailor now / Re-tailor / PDF / Easy Apply` buttons. When generated, tabs for resume / diff / cover / talking / outreach.
- **Notes** — free-form editor.
- **Status timeline** — every status transition with timestamps.
- **Metadata** — discovered, posted, alerted timestamps; external ID.

### Header health dot

Always visible top-right. Polls `/api/observability/health` every 30 s.

- **Green** — DB ok, LLM ok, no source errors.
- **Yellow** — at least one source erroring on its last run.
- **Red** — DB unreachable or LLM down.

Click to jump to `/observability` for details.

---

## Configuration reference

### Environment variables (`backend/.env`)

All of these are editable from the **`/env`** page in the dashboard.

| Group | Key | Default | Notes |
|---|---|---|---|
| **LLM** | `LLM_BACKEND` | `ollama` | `ollama` / `openai` / `anthropic` |
| | `OLLAMA_HOST` | `http://localhost:11434` | Use `http://host.docker.internal:11434` from Docker |
| | `OLLAMA_MODEL` | `llama3.1:8b` | Any Ollama model tag |
| | `OPENAI_API_KEY` | — | Used for Groq / OpenAI / OpenRouter |
| | `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` | Groq is OpenAI-compatible |
| | `OPENAI_MODEL` | `llama-3.3-70b-versatile` | Free on Groq |
| | `ANTHROPIC_API_KEY` | — | For Claude |
| | `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Or `claude-opus-4-7` etc. |
| **Email** | `SMTP_HOST` | `smtp.gmail.com` | |
| | `SMTP_PORT` | `587` | TLS |
| | `SMTP_USER` | — | Gmail address |
| | `SMTP_PASSWORD` | — | Use an App Password, not your real password |
| | `ALERT_FROM` | (defaults to `SMTP_USER`) | |
| | `ALERT_TO` | — | Where alerts go |
| **Telegram** | `TELEGRAM_BOT_TOKEN` | — | From @BotFather |
| | `TELEGRAM_CHAT_ID` | — | From `/getUpdates` after messaging your bot |
| **Schedule** | `ALERT_MIN_SCORE` | `70` | Heuristic score below which alerts are suppressed |
| | `SCRAPE_INTERVAL_MINUTES` | `30` | Default for built-in JobSpy sites without per-site override |
| | `SOURCE_INTERVAL_MINUTES` | `15` | Default for new custom company sources |
| **DB** | `DATABASE_URL` | (auto: `sqlite:///<repo>/data/jobs.db`) | Override only if you want a different DB location |
| **LinkedIn** | `LINKEDIN_EMAIL` | — | Required for authenticated LinkedIn scraping and Easy Apply |
| | `LINKEDIN_PASSWORD` | — | |
| | `AUTO_APPLY_ENABLED` | `false` | Must be `true` to enable Easy Apply |
| **One-shot** | `SUBMIT_FOR_REAL` | `false` | Process env only — required at request time for Easy Apply to actually press Submit |

### Search profile (`config/search_profile.yml`)

All of these are editable from `/settings` and `/sources` in the dashboard. The file is round-tripped through PyYAML on save, so comments are not preserved.

```yaml
candidate:
  name: "..."
  email: "..."
  phone: "..."
  location: "..."
  linkedin: "..."
  visa_status: "..."

location_filter:
  countries: [Netherlands]
  cities: [Amsterdam, Rotterdam, Utrecht, ...]
  allow_remote: true
  strict: true

target_roles:
  primary: [...]    # full title-match score
  secondary: [...]  # 60% of full

resume_routing:
  - match: [manager, director, head, vp, lead]
    use: manager.md
  - match: [principal, staff, ...]
    use: principal_ds.md
  ...
default_resume: manager.md

filters:
  exclude_titles: [Junior, Intern, ...]
  exclude_companies: []
  min_seniority_keywords: [senior, staff, principal, ...]

scoring:
  weights:
    title_match: 40
    location_match: 25
    seniority_match: 25
    keyword_density: 10
  must_have_any: [data, ai, ml, analytics, ...]

scrapers:
  jobspy:
    sites: [linkedin, indeed, glassdoor]
    site_intervals:
      linkedin: 30
      indeed: 60
      glassdoor: 120
    search_terms: [...]
    countries:
      - location: Netherlands
        country_indeed: Netherlands
    results_wanted: 25
    hours_old: 24
```

### Companies (`config/companies.yml`)

A reference list (currently informational, used as documentation; the `/sources` dashboard is the source of truth for what gets polled).

### Resumes (`resumes/*.md`)

Plain Markdown files. Each is a base CV variant. The `resume_routing` rules in the search profile pick which one is used as the starting point for each job's tailor based on title keywords. Defaults:

- `manager.md` — the comprehensive one, default for management roles
- `principal_ds.md` — emphasises individual-contributor technical depth
- `data_scientist.md` — for senior IC DS / ML / AI engineering
- `data_engineer.md` — for senior data platform / engineering roles

Add your own with any filename. Edit existing ones from `/knowledge` → Resumes tab.

---

## API reference

The backend exposes a JSON REST API on port 8787. Full Swagger docs at `http://localhost:8787/docs`.

### Jobs

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/jobs?status=&min_score=&q=&source=&limit=&offset=` | List jobs with filters |
| GET | `/api/jobs/{id}` | Single job |
| PATCH | `/api/jobs/{id}/status` | Update status; auto-tailors on transition to `approved` |
| PATCH | `/api/jobs/{id}/notes` | Update notes field |
| GET | `/api/jobs/{id}/events` | Status timeline |
| GET | `/api/jobs/{id}/bundle` | Tailored content bundle (resume / cover / talking / outreach) |
| GET | `/api/jobs/{id}/resume.pdf` | Download tailored resume PDF |
| POST | `/api/jobs/{id}/tailor` | Generate the bundle synchronously |
| POST | `/api/jobs/{id}/apply` | Trigger LinkedIn Easy Apply (gated) |
| GET | `/api/jobs/duplicates` | Clusters of jobs sharing canonical key |
| POST | `/api/jobs/rescore` | Re-run heuristic matcher over every persisted job |
| POST | `/api/jobs/deep-score?top_n=20` | Run LLM deep score on top N |

### Sources

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/sources` | List custom company sources |
| POST | `/api/sources` | Add a new source by URL |
| PATCH | `/api/sources/{id}` | Update name/enabled/interval |
| DELETE | `/api/sources/{id}` | Remove |
| POST | `/api/sources/{id}/scrape` | Manually trigger a scrape |

### Profile

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/profile` | Current `search_profile.yml` parsed + list of available countries |
| PATCH | `/api/profile` | Patch any patchable section (location_filter, roles, sites, site_intervals, etc.) |

### Knowledge

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/knowledge/resumes` | List resume files |
| GET | `/api/knowledge/resumes/{filename}` | Read a resume |
| PUT | `/api/knowledge/resumes/{filename}` | Write a resume |
| DELETE | `/api/knowledge/resumes/{filename}` | Delete a resume |
| GET | `/api/knowledge/items?kind=` | List knowledge items |
| POST | `/api/knowledge/items` | Create |
| PATCH | `/api/knowledge/items/{id}` | Update |
| DELETE | `/api/knowledge/items/{id}` | Remove |

### Observability

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/observability/health` | Aggregated system status (used by the header dot) |
| GET | `/api/observability/scrapes?days=30` | Scrape audit log |
| GET | `/api/observability/scrapes/daily?days=30` | Daily rollup for charting |
| GET | `/api/observability/notifications?days=30&channel=` | Notification log with bodies |
| GET | `/api/observability/jobs` | Current APScheduler state |

### Env

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/env` | Current `.env` (secrets masked) plus the schema |
| PATCH | `/api/env` | Write keys; hot-reloads `Settings` and reschedules |
| POST | `/api/env/test/llm` | Hit the configured LLM with a tiny prompt |
| POST | `/api/env/test/telegram` | Send a test Telegram message |
| POST | `/api/env/test/email` | Send a test email |

### Stats

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/stats` | Total / by_status / new_today / applied_total / avg_score |
| GET | `/api/stats/salaries` | Bucketed histogram of detected salaries |

### Digest

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/digest/preview` | Build the digest text without sending |
| POST | `/api/digest/send` | Build and send via Telegram |

### Scrape

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/scrape/run` | Manually trigger a JobSpy scrape pass across all enabled sites |

---

## Data model

SQLite tables (defined in `backend/app/db/models.py`):

### `jobs`

The central table. One row per discovered job posting.

Key columns:
- `source`, `external_id` (unique together) — dedupe key within a source
- `title`, `company`, `location`, `url`, `description`
- `posted_at`, `salary_min/max/currency`, `is_remote`, `seniority`, `job_type`
- `match_score`, `match_reasoning`, `suggested_resume`
- `llm_score`, `llm_reasoning`
- `recruiter_emails`, `recruiter_linkedin` (comma-separated)
- `talking_points`, `recruiter_message` (markdown, populated by tailor bundle)
- `canonical_key` (for cross-source dedupe)
- `status` — one of `new / approved / rejected / applied / screening / interview / offer / lost`
- `notes`
- `discovered_at`, `updated_at`, `alerted_at`

### `applications`

Per-applied-job record (currently lightly used; the `jobs.status` field is the primary source of truth for application state).

### `status_events`

Audit log of every status transition. One row per change with `from_status`, `to_status`, optional `note`, `created_at`.

### `company_sources`

User-added career page sources. `(name, url, ats, board_token, enabled, interval_min, last_scraped_at, last_status, last_error, last_jobs_found)`.

### `scrape_runs`

Per-scrape audit row. `(kind, label, source_id, started_at, finished_at, duration_s, rows_seen, new_jobs, updated_jobs, alerts_sent, status, error, breakdown_json)`. Drives the Observability page.

### `notifications`

Audit row for every Telegram/email send. `(channel, kind, subject, body, status, error, sent_at)`. Drives the Telegram and Email tabs on Observability.

### `knowledge_items`

User-authored knowledge. `(kind, title, body, url, tags, include_in_llm, sort_order, created_at, updated_at)`. Drives the Knowledge page.

### Migrations

Forward-only column additions are handled by `_migrate()` in `backend/app/db/session.py` — runs at startup, idempotent. New columns are listed in the `_MIGRATIONS` dict; existing tables are altered via `ALTER TABLE ... ADD COLUMN` only when the column is missing. Renames and drops would need a manual migration; we don't have any of those.

---

## Operations

### Where data lives

Everything that matters is on the host filesystem under the project root:

```
job-finder/
├── backend/.env             secrets, gitignored, mounted into container
├── config/                  search profile + companies.yml, mounted
├── resumes/                 base CV variants, mounted
└── data/
    ├── jobs.db              SQLite database
    ├── output/              generated tailored resumes / PDFs / cover letters
    │   └── job_NNNNN/
    │       ├── resume.md
    │       ├── resume.base.md
    │       ├── resume.pdf
    │       ├── cover_letter.md
    │       ├── talking_points.md
    │       └── outreach.md
    └── linkedin_state.json  cached login cookies (only created if you log in)
```

### Backups

The whole `data/` directory plus `backend/.env` is everything you need to back up. A simple `tar czf job-finder-backup-$(date +%F).tar.gz data/ backend/.env` works.

To restore on a new machine:

```bash
cd job-finder
tar xzf job-finder-backup-2026-04-30.tar.gz
./scripts/docker-up.sh
```

### Logs

Native:
- Backend prints to stdout (uvicorn). The `./scripts/run.sh` launcher streams both backend and frontend logs.

Docker:
- `docker compose logs -f backend` and `docker compose logs -f frontend`

The Observability page is the structured view of operational state — better than logs for "did the scraper run?" or "what did Telegram receive?".

### Health checks

- Backend exposes `GET /api/health` (cheap, just a timestamp) and `GET /api/observability/health` (full status).
- The Docker compose file has a healthcheck on the backend service that polls `/api/health` every 30 s.
- The dashboard polls health every 30 s and updates the header dot.

### Rotating LLM keys

If you ever leak an API key (e.g. paste it into a chat for setup help), rotate it:

- **Groq** — console.groq.com → API Keys → revoke and regenerate.
- **Anthropic** — console.anthropic.com → API Keys → revoke and regenerate.

Update via `/env` in the dashboard, save, the backend hot-reloads.

### Updating after code changes

Native: stop `./scripts/run.sh` (Ctrl-C), restart it. Hot reload should catch most edits without restart.

Docker: `docker compose up -d --build`.

### Managing the database

The SQLite DB at `data/jobs.db` is a regular file. Inspect with:

```bash
sqlite3 data/jobs.db
.tables
SELECT count(*), status FROM jobs GROUP BY status;
```

To start fresh: stop the backend, delete `data/jobs.db`, restart. Schema is recreated on boot.

---

## Security notes

- **`backend/.env` is gitignored** and bind-mounted from the host into the Docker container. Secrets never bake into the image.
- **The dashboard binds to `localhost`** by default in both Docker (port mapping is `localhost:3737`) and native modes. Do not expose it to the public internet — it has no auth layer.
- **CORS is permissive** for any localhost origin so the dashboard at `:3737` can hit the API at `:8787`.
- **Secrets are masked** in `/api/env` GET responses (only first/last four chars exposed). The frontend never receives the full secret, and a "type a new value" pattern means saves don't accidentally clobber masked values.
- **LinkedIn cookies** persist at `data/linkedin_state.json`. Treat that file as a credential — anyone with it can act as you on LinkedIn.
- **PDFs and tailored markdown** in `data/output/` may contain personal information from your resume. They are not encrypted at rest.
- **Easy Apply is double-gated**: the `AUTO_APPLY_ENABLED=true` env var to enable at all, and per-request `SUBMIT_FOR_REAL=true` to actually press Submit. Default behaviour is screenshot-only.
- **No telemetry**, no outbound calls except to the configured LLM endpoint, the configured SMTP / Telegram endpoints, and the public job APIs you have explicitly added.

---

## Troubleshooting

### "LLM down" / yellow header dot

Open `/env`, click **Test LLM**. The error message tells you what is wrong. Common causes:

- Ollama backend selected but Ollama is not running on the host. Run `ollama serve`.
- Ollama backend in Docker but `OLLAMA_HOST=http://localhost:11434` instead of `http://host.docker.internal:11434`.
- Groq key revoked or rate-limited. Generate a new key at console.groq.com.
- Wrong model name. Groq's free Llama is `llama-3.3-70b-versatile`; Anthropic's IDs include the date suffix like `claude-sonnet-4-6` (no date) or `claude-opus-4-7` (no date).

### LinkedIn login fails / hits a captcha

The system tries a fresh login when there are no cached cookies. LinkedIn often shows a "verify it's you" challenge for new IPs. Workaround: log in once via your browser using the same email, then retry. The cookies the browser sets are not used by Playwright, but logging in once *seems* to lower the risk of the challenge for the next 24 h.

If you hit a persistent captcha, run Playwright with a visible browser to solve it manually:

```bash
docker compose exec backend python - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(headless=False)
    ctx = b.new_context()
    page = ctx.new_page()
    page.goto("https://www.linkedin.com/login")
    input("Log in in the browser, then press Enter...")
    ctx.storage_state(path="/app/data/linkedin_state.json")
PY
```

(This requires the container to be able to open a display; on a Mac that means installing XQuartz. In practice, running this on the host outside Docker is simpler.)

### "Easy Apply button not found"

The job is not Easy Apply — it routes to an external application form. Open the job manually and apply via the company's site, then move the status to `applied` in the dashboard.

### JobSpy LinkedIn returns 0 results

Public LinkedIn scraping rate-limits aggressively, especially from a fresh IP. Mitigations:

- Rotate your home IP (mobile hotspot, VPN with EU exit).
- Use the **authenticated** LinkedIn scraper instead — paste a `linkedin.com/jobs/search/?...&f_TPR=r3600` URL into Sources. Uses your real session, no rate limit.
- Reduce JobSpy's LinkedIn frequency to every 60+ minutes.

### "Telegram not configured"

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `/env`. To get the chat_id:

1. Talk to [@BotFather](https://t.me/BotFather), `/newbot`, save the token.
2. Send any message to your new bot from your personal Telegram account.
3. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser.
4. Copy `result[0].message.chat.id` (a number) into `TELEGRAM_CHAT_ID`.

### Jobs scored 0 are missing

The matcher hard-filters score-0 jobs and does not persist them. This is intentional — they would otherwise overwhelm the feed. If you want to relax filters, edit `/settings`:

- Lower the `must_have_any` keyword set (or remove it).
- Untick **Strict mode** in location filter.
- Trim the `exclude_titles` blocklist.

Then trigger `POST /api/jobs/rescore` if you want existing rows re-evaluated (note: existing rows are filtered earlier so adjustments only affect new scrapes).

### `.env` edits don't seem to take effect

The `/env` save handler hot-reloads the live `Settings` singleton and reschedules APScheduler jobs. If a particular setting still seems stale, restart the backend manually:

- Native: Ctrl-C in `./scripts/run.sh` and re-run.
- Docker: `docker compose restart backend`.

A few settings that bind at process start (e.g. log level, env file path itself) genuinely require a restart.

---

## Roadmap

Implemented to date:

- Phase 1 — scraper + DB + API + dashboard + email/Telegram alerts + scheduler
- Phase 2 — company-portal scrapers (Greenhouse / Lever / Ashby JSON; generic Playwright fallback); user-managed source list; per-source intervals
- Phase 3 — free LLM (Ollama / Groq) + Anthropic; resume + cover-letter tailoring; auto PDF render
- Phase 4 — gated LinkedIn Easy Apply via Playwright (saved auth state, screenshot evidence, double-gate)
- Phase 5 — country/role list editor (Settings page); strict location filter; status timeline; inline status update on feed
- Phase 6 — salary parser; recruiter contact extraction; LLM deep match scoring; auto-tailor on approve; resume diff viewer; salary histogram; twice-daily Telegram digest
- Phase 7 — observability (scrape audit + notification log + system health); knowledge base (resumes + projects + Q&A + cover + notes); duplicate finder; per-site interval control
- Phase 8 — full `.env` editor in dashboard; Docker Compose deployment; multi-arch container images

Likely next:

- WhatsApp via Twilio (in addition to Telegram)
- Visa-sponsorship detector (regex + LLM check on JD, surfaces a chip on the card)
- "Remind me to follow up" loop (auto Telegram nudge 7 days after status `applied`)
- Browser extension for one-click save from any career page
- A/B tracking of resume variants (which version got more interviews)
- Calendar export (`.ics`) for status `interview`
- Authenticated session reuse for Indeed and Glassdoor (currently public-only)

---

## Repository layout

```
job-finder/
├── README.md                       this file
├── docker-compose.yml              two-service stack (backend + frontend)
├── Dockerfile.backend              Python + Playwright + uvicorn
├── Dockerfile.frontend             Node + Next standalone build
├── .dockerignore
├── scripts/
│   ├── run.sh                      native launcher (venv + npm)
│   ├── docker-up.sh                Docker launcher
│   └── docker-backend-entrypoint.sh   first-boot env seeder
├── backend/
│   ├── pyproject.toml
│   ├── .env.example                template (gitignored .env is the live one)
│   └── app/
│       ├── main.py                 FastAPI entrypoint, lifespan, router registration
│       ├── config.py               pydantic-settings + .env reader
│       ├── profile_loader.py       YAML read + atomic write
│       ├── scheduler.py            APScheduler setup, per-site jobs, reschedule()
│       ├── api/
│       │   ├── routes.py           /api/jobs, /api/stats, /api/digest, /api/scrape
│       │   ├── sources.py          /api/sources CRUD + manual trigger
│       │   ├── profile.py          /api/profile GET + PATCH
│       │   ├── knowledge.py        /api/knowledge resumes + items
│       │   ├── observability.py    /api/observability scrapes + notifications + health
│       │   └── env_config.py       /api/env GET + PATCH + tests
│       ├── db/
│       │   ├── models.py           SQLAlchemy declaratives
│       │   └── session.py          engine + auto-migrate
│       ├── scrapers/
│       │   ├── jobspy_scraper.py   wraps python-jobspy
│       │   ├── runner.py           JobSpy orchestrator + ScrapeRun audit
│       │   ├── source_runner.py    custom-source orchestrator + per-source scheduling
│       │   ├── greenhouse.py       Greenhouse JSON API
│       │   ├── lever.py            Lever JSON API
│       │   ├── ashby.py            Ashby GraphQL endpoint
│       │   ├── linkedin_auth.py    authenticated Playwright LinkedIn scraper
│       │   ├── generic_playwright.py    fallback DOM crawler
│       │   ├── enrich.py           salary + contacts enrichment
│       │   └── canonical.py        duplicate-detection key
│       ├── matcher/
│       │   ├── heuristic.py        deterministic score
│       │   └── llm.py              LLM deep score
│       ├── tailor/
│       │   ├── claude.py           tailor_resume + write_cover_letter
│       │   ├── bundle.py           full bundle assembly + persistence
│       │   └── pdf.py              Markdown → A4 PDF via Playwright
│       ├── notifier/
│       │   ├── email.py            SMTP send with Notification audit
│       │   ├── telegram.py         Bot API send with Notification audit
│       │   ├── dispatch.py         per-job alert dispatcher
│       │   └── digest.py           twice-daily summary
│       ├── applier/
│       │   └── linkedin.py         Easy Apply via Playwright (gated)
│       ├── llm/
│       │   ├── client.py           backend router (anthropic / openai / ollama)
│       │   ├── ollama.py
│       │   ├── openai_compat.py
│       │   └── anthropic_provider.py
│       └── parsers/
│           ├── salary.py           regex + LLM fallback
│           └── contacts.py         email + LinkedIn extraction + outreach drafter
├── frontend/
│   ├── package.json
│   ├── next.config.mjs             standalone output, env injection
│   ├── tailwind.config.ts
│   ├── lib/
│   │   ├── api.ts                  jobs / stats / scrape / tailor / apply
│   │   ├── sources.ts              custom-source CRUD client
│   │   ├── profile.ts              profile + status events
│   │   ├── knowledge.ts            resumes + items client
│   │   ├── observability.ts        scrapes / notifications / health / duplicates
│   │   ├── env_config.ts           /env client
│   │   └── diff.ts                 LCS line diff for the bundle viewer
│   ├── components/
│   │   └── HealthDot.tsx           header indicator
│   └── app/
│       ├── layout.tsx              header + nav + health dot
│       ├── globals.css             Tailwind + dark theme
│       ├── page.tsx                Feed
│       ├── sources/page.tsx        Sources
│       ├── settings/page.tsx       Settings
│       ├── env/page.tsx            Env editor
│       ├── knowledge/page.tsx      Knowledge base
│       ├── observability/page.tsx  Observability
│       ├── duplicates/page.tsx     Duplicates
│       └── jobs/[id]/page.tsx      Job detail
├── config/
│   ├── search_profile.yml          live config
│   └── companies.yml               reference list
├── resumes/
│   ├── manager.md
│   ├── principal_ds.md
│   ├── data_scientist.md
│   └── data_engineer.md
└── data/                           runtime state (gitignored)
    ├── jobs.db
    ├── output/
    └── linkedin_state.json
```

---

## Credits

Built on top of:

- [JobSpy](https://github.com/speedyapply/JobSpy) — multi-board scraper
- [Playwright](https://playwright.dev) — browser automation
- [FastAPI](https://fastapi.tiangolo.com), [SQLAlchemy](https://www.sqlalchemy.org), [APScheduler](https://apscheduler.readthedocs.io)
- [Next.js](https://nextjs.org) + [Tailwind CSS](https://tailwindcss.com)
- [Anthropic Claude](https://www.anthropic.com) / [Groq](https://console.groq.com) / [Ollama](https://ollama.com)
- The [career-ops](https://github.com/santifer/career-ops) project, whose evaluation rubric and resume-tailoring approach informed this system's design.

License: MIT (see LICENSE if added).
