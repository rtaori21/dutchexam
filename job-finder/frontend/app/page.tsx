"use client";

import { Suspense, useEffect, useState, useTransition, useDeferredValue } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { api, type Job, type Stats, type SalaryHistogram, type TailorRetry } from "@/lib/api";
import { sourceLabel } from "@/lib/observability";
import ActivityStrip from "@/components/ActivityStrip";

const STATUS_FILTERS = ["all", "new", "approved", "rejected", "applied", "screening", "interview", "offer", "lost"] as const;
const STATUSES = ["new", "approved", "rejected", "applied", "screening", "interview", "offer", "lost"];

function scoreColor(s: number | null) {
  if (s == null) return "text-muted";
  if (s >= 80) return "text-success";
  if (s >= 60) return "text-warn";
  return "text-muted";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "border-accent text-accent",
    approved: "border-success text-success",
    rejected: "border-muted text-muted line-through",
    applied: "border-warn text-warn",
    screening: "border-warn text-warn",
    interview: "border-success text-success",
    offer: "border-success text-success font-semibold",
    lost: "border-danger text-danger",
  };
  return <span className={`chip ${map[status] ?? ""}`}>{status}</span>;
}

function FeedInner() {
  const sp = useSearchParams();
  const router = useRouter();

  // URL is the source of truth — links to /?status=approved now actually filter.
  const statusFilter = sp.get("status") || "new";
  const minScore = Number(sp.get("min_score") || 50);
  const urlQ = sp.get("q") || "";

  const [searchInput, setSearchInput] = useState(urlQ);
  const debouncedQ = useDeferredValue(searchInput);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<Stats | null>(null);
  const [salaries, setSalaries] = useState<SalaryHistogram | null>(null);
  const [tailorQueue, setTailorQueue] = useState<TailorRetry[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, startScrape] = useTransition();
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);

  function pushParam(k: string, v: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (v == null || v === "") next.delete(k);
    else next.set(k, v);
    const qs = next.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  // Sync the search input back into the URL when it stops changing.
  useEffect(() => {
    if (debouncedQ === urlQ) return;
    const t = setTimeout(() => pushParam("q", debouncedQ || null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  // Refetch whenever any URL param changes
  async function refresh() {
    setLoading(true);
    try {
      const [jobsRes, statsRes, salRes, queue] = await Promise.all([
        api.jobs({
          status: statusFilter === "all" ? undefined : statusFilter,
          min_score: minScore,
          q: urlQ || undefined,
          limit: 200,
        }),
        api.stats(),
        api.salaries().catch(() => null),
        api.tailorQueue().catch(() => []),
      ]);
      setJobs(jobsRes);
      setStats(statsRes);
      setSalaries(salRes);
      setTailorQueue(queue);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function submitImport() {
    if (!importUrl.trim()) return;
    setImportBusy(true);
    setImportMsg(null);
    try {
      const r = await api.importUrl(importUrl.trim());
      if (r.ok && r.imported) {
        setImportMsg(`Imported #${r.job_id}: ${r.title} @ ${r.company} (score ${r.score})`);
        setImportUrl("");
        refresh();
      } else if (r.ok && r.already_exists) {
        setImportMsg(`Already in DB as #${r.job_id} (status=${r.status}, score=${r.score})`);
      } else if (r.ok === false && r.preview) {
        setImportMsg(`Filtered out: ${r.reason} — preview: ${r.preview.title} @ ${r.preview.company} (${r.preview.location})`);
      } else {
        setImportMsg("Imported");
      }
    } catch (e: any) {
      setImportMsg(`Import failed: ${e.message}`);
    } finally {
      setImportBusy(false);
    }
  }

  async function runTailorQueueNow() {
    try {
      const r = await api.tailorQueueRunNow();
      setScrapeMsg(`Tailor retry: ${r.succeeded} succeeded, ${r.failed} failed of ${r.attempted}`);
    } catch (e: any) {
      setScrapeMsg(`Retry failed: ${e.message}`);
    }
    refresh();
  }
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, minScore, urlQ]);

  async function setStatus(id: number, status: string) {
    await api.setStatus(id, status);
    refresh();
  }

  function toggleSelected(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function selectAllVisible() {
    setSelected(new Set(jobs.map((j) => j.id)));
  }
  function clearSelection() {
    setSelected(new Set());
  }
  async function bulkSetStatus(status: string) {
    if (selected.size === 0) return;
    if (status === "rejected" && !confirm(`Reject ${selected.size} job${selected.size === 1 ? "" : "s"}?`)) return;
    const ids = Array.from(selected);
    setScrapeMsg(`Updating ${ids.length}…`);
    try {
      const r = await api.bulkStatus(ids, status);
      setScrapeMsg(`Updated ${r.updated}, skipped ${r.skipped}, invalid ${r.invalid}`);
    } catch (e: any) {
      setScrapeMsg(`Bulk update failed: ${e.message}`);
    }
    clearSelection();
    refresh();
  }

  function triggerScrape() {
    setScrapeMsg("Scraping…");
    startScrape(async () => {
      try {
        const r = await api.scrape();
        setScrapeMsg(`Found ${r.new_jobs} new (${r.rows_seen} seen, ${r.alerts_sent} alerts)`);
      } catch {
        setScrapeMsg("Scrape failed — check backend logs");
      }
      refresh();
    });
  }

  async function deepScore() {
    setScrapeMsg("Running LLM deep score on top 20…");
    startScrape(async () => {
      try {
        const r = await api.deepScore(20);
        setScrapeMsg(`LLM scored ${r.scored} of ${r.candidates} candidates`);
      } catch (e: any) {
        setScrapeMsg(`Deep score failed: ${e.message}`);
      }
      refresh();
    });
  }

  async function sendDigest() {
    try {
      const r = await api.digestSend();
      setScrapeMsg(r.sent ? "Digest sent to Telegram" : "Telegram not configured (TELEGRAM_BOT_TOKEN missing)");
    } catch (e: any) {
      setScrapeMsg(`Digest failed: ${e.message}`);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card">
          <div className="text-xs text-muted">Total</div>
          <div className="text-2xl font-semibold">{stats?.total ?? "—"}</div>
        </div>
        <div className="card">
          <div className="text-xs text-muted">New (24h)</div>
          <div className="text-2xl font-semibold text-accent">{stats?.new_today ?? "—"}</div>
        </div>
        <div className="card">
          <div className="text-xs text-muted">Approved</div>
          <div className="text-2xl font-semibold">{stats?.by_status?.approved ?? 0}</div>
        </div>
        <div className="card">
          <div className="text-xs text-muted">Applied+</div>
          <div className="text-2xl font-semibold">{stats?.applied_total ?? 0}</div>
        </div>
        <div className="card">
          <div className="text-xs text-muted">Avg score</div>
          <div className="text-2xl font-semibold">
            {stats?.avg_score != null ? Math.round(stats.avg_score) : "—"}
          </div>
        </div>
      </section>

      <ActivityStrip />

      {tailorQueue.length > 0 && (
        <section className="card border-warn">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-block w-2 h-2 rounded-full bg-warn animate-pulse" />
            <span className="text-sm">
              <strong>{tailorQueue.length}</strong> tailor{tailorQueue.length === 1 ? "" : "s"} pending retry
              {tailorQueue.some((q) => q.exhausted) && (
                <span className="text-danger ml-2">
                  ({tailorQueue.filter((q) => q.exhausted).length} exhausted)
                </span>
              )}
            </span>
            <span className="text-xs text-muted">
              {tailorQueue
                .slice(0, 3)
                .map((q) => `#${q.job_id} (attempt ${q.attempts}/${q.max_attempts})`)
                .join(" · ")}
              {tailorQueue.length > 3 && ` · +${tailorQueue.length - 3} more`}
            </span>
            <button onClick={runTailorQueueNow} className="btn btn-primary ml-auto text-xs">
              Retry now
            </button>
          </div>
        </section>
      )}

      {salaries && salaries.sample_size > 0 && (
        <section className="card">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
              Salary spread ({salaries.sample_size} jobs with data, median {salaries.currency}{" "}
              {Math.round(salaries.median_min || 0).toLocaleString()}–
              {Math.round(salaries.median_max || 0).toLocaleString()})
            </h2>
          </div>
          <div className="flex items-end gap-2 h-24">
            {salaries.buckets.map((b) => {
              const max = Math.max(1, ...salaries.buckets.map((x) => x.count));
              const h = (b.count / max) * 100;
              return (
                <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-accent/40 rounded-t" style={{ height: `${h}%` }} title={`${b.count} jobs`} />
                  <div className="text-[10px] text-muted">{b.label}</div>
                  <div className="text-[10px] text-text">{b.count}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-wrap gap-2 items-center">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by title, company, or location…"
          className="bg-panel border border-border rounded px-3 py-1.5 text-sm w-72"
        />
        {searchInput && (
          <button onClick={() => setSearchInput("")} className="btn">Clear</button>
        )}
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => pushParam("status", s)}
            className={`btn ${statusFilter === s ? "btn-primary" : ""}`}
          >
            {s} {s !== "all" && stats?.by_status?.[s] ? `(${stats.by_status[s]})` : ""}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <label className="text-sm text-muted">
            Min score
            <input
              type="number"
              value={minScore}
              onChange={(e) => pushParam("min_score", String(Number(e.target.value) || 0))}
              className="ml-2 w-16 bg-panel border border-border rounded px-2 py-1 text-text"
              min={0}
              max={100}
            />
          </label>
          <button onClick={() => setShowImport((v) => !v)} className="btn">
            {showImport ? "Cancel" : "+ Import URL"}
          </button>
          <button onClick={deepScore} disabled={scraping} className="btn">LLM score top 20</button>
          <button onClick={sendDigest} className="btn">Send digest now</button>
          <button onClick={triggerScrape} disabled={scraping} className="btn btn-primary">
            {scraping ? "Scraping…" : "Run scrape now"}
          </button>
        </div>
      </section>

      {scrapeMsg && <div className="text-sm text-muted">{scrapeMsg}</div>}

      {showImport && (
        <section className="card border-accent">
          <h2 className="text-sm font-semibold mb-2">Import a single job by URL</h2>
          <p className="text-xs text-muted mb-3">
            Paste any job posting URL (LinkedIn / Greenhouse / Lever / Ashby / Workday / company career page).
            The system fetches it once, scores it against your profile, and adds it to the feed if it passes the filters.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitImport()}
              placeholder="https://..."
              className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm font-mono"
              autoFocus
            />
            <button onClick={submitImport} disabled={importBusy || !importUrl.trim()} className="btn btn-primary">
              {importBusy ? "Fetching…" : "Import"}
            </button>
          </div>
          {importMsg && <div className="text-sm text-muted mt-2">{importMsg}</div>}
        </section>
      )}

      {selected.size > 0 && (
        <section className="card sticky top-0 z-20 flex items-center gap-3 flex-wrap shadow-xl border-accent">
          <span className="font-medium">{selected.size} selected</span>
          <button onClick={() => bulkSetStatus("rejected")} className="btn btn-danger">Reject</button>
          <button onClick={() => bulkSetStatus("approved")} className="btn btn-success">Approve</button>
          <button onClick={() => bulkSetStatus("applied")} className="btn">Mark applied</button>
          <select
            onChange={(e) => { if (e.target.value) bulkSetStatus(e.target.value); e.target.value = ""; }}
            defaultValue=""
            className="bg-panel border border-border rounded px-2 py-1.5 text-sm"
          >
            <option value="">More statuses…</option>
            {STATUSES.filter(s => !["rejected","approved","applied"].includes(s)).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="text-muted ml-auto text-sm">
            <button onClick={selectAllVisible} className="hover:text-text">select all visible</button>
            {" · "}
            <button onClick={clearSelection} className="hover:text-text">clear</button>
          </span>
        </section>
      )}

      <section className="space-y-2">
        {loading && jobs.length === 0 ? (
          <div className="card text-muted">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="card text-muted">
            No jobs match. Try lowering Min score, switching to <em>all</em>, clearing the search, or running a scrape.
          </div>
        ) : (
          jobs.map((j) => (
            <article
              key={j.id}
              className={`card flex flex-col md:flex-row md:items-center gap-3 ${selected.has(j.id) ? "border-accent" : ""}`}
            >
              <input
                type="checkbox"
                checked={selected.has(j.id)}
                onChange={() => toggleSelected(j.id)}
                className="h-4 w-4 accent-[var(--color-accent)] mt-1 md:mt-0"
                aria-label={`Select ${j.title}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/jobs/${j.id}`} className="text-lg font-medium hover:text-accent truncate">
                    {j.title}
                  </Link>
                  <StatusBadge status={j.status} />
                  {j.is_remote && <span className="chip">remote</span>}
                  <span className="chip">{sourceLabel(j.source)}</span>
                  {j.recruiter_emails && (
                    <span className="chip border-accent text-accent">✉️ recruiter</span>
                  )}
                </div>
                <div className="text-sm text-muted mt-1">
                  {j.company} · {j.location || "n/a"}
                  {j.salary_min || j.salary_max ? (
                    <>
                      {" · 💰 "}
                      {(j.salary_currency || "EUR")} {j.salary_min ? Math.round(j.salary_min).toLocaleString() : "?"}
                      {"–"}
                      {j.salary_max ? Math.round(j.salary_max).toLocaleString() : "?"}
                    </>
                  ) : null}
                </div>
                {j.match_reasoning && <div className="text-xs text-muted mt-1 italic">heuristic: {j.match_reasoning}</div>}
                {j.llm_reasoning && <div className="text-xs text-accent mt-1 italic">LLM: {j.llm_reasoning}</div>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className={`text-2xl font-semibold ${scoreColor(j.match_score)}`}>{j.match_score ?? "—"}</div>
                {j.llm_score != null && (
                  <div className="text-xs text-accent">LLM {j.llm_score}</div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <a href={j.url} target="_blank" rel="noreferrer" className="btn">Open ↗</a>
                <button onClick={() => setStatus(j.id, "approved")} className="btn btn-success">Approve</button>
                <button onClick={() => setStatus(j.id, "rejected")} className="btn btn-danger">Reject</button>
                <select
                  value={j.status}
                  onChange={(e) => setStatus(j.id, e.target.value)}
                  className="bg-panel border border-border rounded px-2 py-1.5 text-sm"
                  title="Update status"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Link href={`/jobs/${j.id}`} className="btn btn-primary">Review</Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="card text-muted">Loading…</div>}>
      <FeedInner />
    </Suspense>
  );
}
