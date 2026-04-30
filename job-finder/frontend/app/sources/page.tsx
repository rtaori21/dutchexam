"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sourcesApi, type Source } from "@/lib/sources";
import { profileApi, type Profile } from "@/lib/profile";
import { obsApi } from "@/lib/observability";

const ALL_JOBSPY_SITES = ["linkedin", "indeed", "glassdoor", "google", "ziprecruiter"] as const;
const SITE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  google: "Google Jobs",
  ziprecruiter: "ZipRecruiter",
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString() : "never";
}

function StatusDot({ status }: { status: string }) {
  const color = status === "ok" ? "bg-success" : status === "error" ? "bg-danger" : "bg-muted";
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-2`} />;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setIntervalMin] = useState(15);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savingSites, setSavingSites] = useState(false);

  async function load() {
    try {
      const [s, p] = await Promise.all([sourcesApi.list(), profileApi.get()]);
      setSources(s);
      setProfile(p);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  async function add() {
    if (!name.trim() || !url.trim()) return;
    setBusy("add");
    setErr(null);
    try {
      await sourcesApi.create({ name: name.trim(), url: url.trim(), interval_min: interval });
      setName("");
      setUrl("");
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function scrapeNow(id: number) {
    setBusy(`scrape-${id}`);
    try {
      await sourcesApi.scrape(id);
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function toggle(s: Source) {
    setBusy(`toggle-${s.id}`);
    try {
      await sourcesApi.patch(s.id, { enabled: !s.enabled });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function setInterval(s: Source, mins: number) {
    setBusy(`int-${s.id}`);
    try {
      await sourcesApi.patch(s.id, { interval_min: mins });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this source?")) return;
    setBusy(`del-${id}`);
    try {
      await sourcesApi.remove(id);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function toggleBuiltin(site: string) {
    if (!profile) return;
    const enabled = new Set(profile.scrapers.jobspy.sites);
    if (enabled.has(site)) enabled.delete(site);
    else enabled.add(site);
    setSavingSites(true);
    try {
      await profileApi.patch({ sites: Array.from(enabled) });
      await load();
    } finally {
      setSavingSites(false);
    }
  }

  async function setBuiltinInterval(site: string, mins: number) {
    if (!profile) return;
    const cur = profile.scrapers.jobspy.site_intervals || {};
    const next = { ...cur, [site]: mins };
    setSavingSites(true);
    try {
      await profileApi.patch({ site_intervals: next });
      await load();
    } finally {
      setSavingSites(false);
    }
  }

  async function scrapeBuiltinNow(site: string) {
    setBusy(`builtin-${site}`);
    setErr(null);
    try {
      const r: any = await obsApi.scrapeBuiltin(site);
      const new_jobs = r?.new_jobs ?? 0;
      const seen = r?.rows_seen ?? 0;
      alert(`${site}: ${new_jobs} new (${seen} seen) — see Observability for details`);
    } catch (e: any) {
      setErr(`${site} scrape failed: ${e.message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted">
        <Link href="/" className="hover:text-text">← Back to feed</Link>
      </div>

      {/* Built-in scrapers */}
      <section className="card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Built-in scrapers (JobSpy)</h2>
            <p className="text-sm text-muted mt-1">
              Toggle which job boards run on every scheduled scrape pass (every 30 min). Hit "Run scrape now" on the feed for an on-demand pull.
            </p>
          </div>
        </div>
        {!profile ? (
          <div className="text-muted text-sm mt-3">Loading…</div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_JOBSPY_SITES.map((site) => {
              const on = profile.scrapers.jobspy.sites.includes(site);
              const interval = profile.scrapers.jobspy.site_intervals?.[site] ?? 30;
              return (
                <div
                  key={site}
                  className={`p-3 rounded border ${on ? "border-success bg-success/10" : "border-border"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{SITE_LABELS[site] || site}</span>
                    <button
                      onClick={() => toggleBuiltin(site)}
                      disabled={savingSites}
                      className={`text-xs px-2 py-0.5 rounded border ${on ? "border-success text-success" : "border-muted text-muted hover:text-text hover:border-accent"}`}
                    >
                      {on ? "ON" : "OFF"}
                    </button>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {site === "linkedin" && "Public scrape (rate-limited)"}
                    {site === "indeed" && "Most reliable, no rate limits"}
                    {site === "glassdoor" && "Decent coverage, includes ratings"}
                    {site === "google" && "Aggregator across many sites"}
                    {site === "ziprecruiter" && "US-focused, low NL coverage"}
                  </div>
                  <div className={`mt-2 flex items-center gap-1 ${on ? "" : "opacity-50"}`}>
                    <span className="text-[10px] text-muted mr-1">every</span>
                    {[5, 15, 30, 60, 120].map((p) => (
                      <button
                        key={p}
                        onClick={() => setBuiltinInterval(site, p)}
                        disabled={savingSites || !on}
                        className={`px-2 py-0.5 rounded border text-[10px] ${interval === p ? "border-accent text-accent" : "border-border text-muted hover:text-text"}`}
                      >
                        {p}m
                      </button>
                    ))}
                  </div>
                  {on && (
                    <button
                      onClick={() => scrapeBuiltinNow(site)}
                      disabled={busy === `builtin-${site}`}
                      className="btn btn-primary mt-2 w-full text-xs"
                    >
                      {busy === `builtin-${site}` ? "Scraping (1-3 min)…" : "Scrape now"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted mt-3">
          Each enabled site runs as its own scheduled job. Sites: {profile?.scrapers.jobspy.sites.join(", ") || "none"} ·{" "}
          Search terms ({profile?.scrapers.jobspy.search_terms.length || 0}): edit in <Link href="/settings" className="text-accent">Settings</Link>
        </p>
      </section>

      {/* Add a source */}
      <section className="card">
        <h2 className="text-lg font-semibold">Custom sources</h2>
        <p className="text-sm text-muted mt-1">
          Paste any career-page URL. Auto-detected:
          <br />
          <span className="font-mono text-xs">boards.greenhouse.io/&lt;company&gt;</span> · <span className="font-mono text-xs">jobs.lever.co/&lt;company&gt;</span> · <span className="font-mono text-xs">jobs.ashbyhq.com/&lt;company&gt;</span> · <span className="font-mono text-xs">linkedin.com/jobs/search/?keywords=…</span> (uses your saved login session)
          <br />
          Anything else falls back to a generic Playwright crawler.
        </p>
        <details className="text-xs text-muted mt-2">
          <summary className="cursor-pointer hover:text-text">💡 Tip: get LinkedIn jobs the moment they're posted</summary>
          <div className="mt-2 pl-4 space-y-1 leading-relaxed">
            <p>1. Go to LinkedIn → search for your role + location → click <strong>Date posted: Past hour</strong>.</p>
            <p>2. Copy the URL — should contain <code className="text-accent">f_TPR=r3600</code>.</p>
            <p>3. Paste here as a custom source. The first scrape will trigger a Playwright login (uses <code>LINKEDIN_EMAIL</code>/<code>LINKEDIN_PASSWORD</code> in <code>.env</code>); cookies are cached afterwards.</p>
            <p>4. Set the interval to 15 minutes. New jobs surface within the hour they're posted, and you'll be the first to apply.</p>
          </div>
        </details>

        <div className="mt-4 grid md:grid-cols-[1fr_2fr_120px_auto] gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Label (e.g. LinkedIn — last hour)"
            className="bg-bg border border-border rounded px-3 py-2 text-sm"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="bg-bg border border-border rounded px-3 py-2 text-sm font-mono"
          />
          <input
            type="number"
            value={interval}
            onChange={(e) => setIntervalMin(Number(e.target.value))}
            min={5}
            max={1440}
            className="bg-bg border border-border rounded px-3 py-2 text-sm"
            title="Polling interval (minutes)"
          />
          <button onClick={add} disabled={busy === "add"} className="btn btn-primary">
            {busy === "add" ? "Adding…" : "Add source"}
          </button>
        </div>
        {err && <div className="text-sm text-danger mt-2">{err}</div>}
      </section>

      <section className="space-y-2">
        {sources.length === 0 ? (
          <div className="card text-muted">
            No custom sources yet. Try <code className="font-mono text-xs">https://boards.greenhouse.io/adyen</code> to start.
          </div>
        ) : (
          sources.map((s) => (
            <article key={s.id} className="card flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusDot status={s.last_status} />
                  <span className="font-medium">{s.name}</span>
                  <span className="chip">{s.ats}</span>
                  {!s.enabled && <span className="chip text-warn border-warn">disabled</span>}
                </div>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-muted font-mono break-all hover:text-accent">
                  {s.url}
                </a>
                <div className="text-xs text-muted mt-1 flex items-center gap-2 flex-wrap">
                  <span>every</span>
                  <div className="flex gap-1">
                    {[5, 15, 30, 60].map((p) => (
                      <button
                        key={p}
                        onClick={() => setInterval(s, p)}
                        disabled={busy === `int-${s.id}`}
                        className={`px-2 py-0.5 rounded border text-[10px] ${s.interval_min === p ? "border-accent text-accent" : "border-border text-muted hover:text-text"}`}
                      >
                        {p}m
                      </button>
                    ))}
                  </div>
                  <span>· last: {fmt(s.last_scraped_at)} · jobs found: {s.last_jobs_found}</span>
                  {s.last_error && <span className="text-danger">· {s.last_error.slice(0, 100)}</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => scrapeNow(s.id)} disabled={busy === `scrape-${s.id}`} className="btn btn-primary">
                  {busy === `scrape-${s.id}` ? "Scraping…" : "Scrape now"}
                </button>
                <button onClick={() => toggle(s)} disabled={busy === `toggle-${s.id}`} className="btn">
                  {s.enabled ? "Disable" : "Enable"}
                </button>
                <button onClick={() => remove(s.id)} disabled={busy === `del-${s.id}`} className="btn btn-danger">
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
