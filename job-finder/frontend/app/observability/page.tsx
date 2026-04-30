"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obsApi, sourceLabel, type ScrapeRun, type DailyRollup, type Notification, type Health } from "@/lib/observability";

function fmt(d: string | null) { return d ? new Date(d).toLocaleString() : "—"; }

function StatusPill({ status }: { status: string }) {
  const cls = status === "ok" || status === "sent"
    ? "border-success text-success"
    : status === "error" || status === "failed"
      ? "border-danger text-danger"
      : "border-warn text-warn";
  return <span className={`chip ${cls}`}>{status}</span>;
}

function DailyChart({ daily }: { daily: DailyRollup[] }) {
  const max = Math.max(1, ...daily.map((d) => d.new_jobs));
  return (
    <div className="flex items-end gap-1 h-28">
      {daily.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.new_jobs} new, ${d.runs} runs, ${d.errors} errors`}>
          <div className="w-full bg-accent/30 rounded-t" style={{ height: `${(d.new_jobs / max) * 100}%` }} />
          {d.errors > 0 && <div className="w-full bg-danger/40" style={{ height: `${(d.errors / max) * 100}%` }} />}
          <div className="text-[9px] text-muted">{d.date.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

export default function ObservabilityPage() {
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<"scrapes" | "telegram" | "email">("scrapes");
  const [scrapes, setScrapes] = useState<ScrapeRun[]>([]);
  const [daily, setDaily] = useState<DailyRollup[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [openBody, setOpenBody] = useState<number | null>(null);

  async function load() {
    const channel = tab === "telegram" || tab === "email" ? tab : undefined;
    const [s, d, n, h] = await Promise.all([
      obsApi.scrapes(days),
      obsApi.daily(days),
      obsApi.notifications(days, channel),
      obsApi.health(),
    ]);
    setScrapes(s); setDaily(d); setNotifications(n); setHealth(h);
  }
  useEffect(() => { load(); }, [days, tab]);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Observability</h1>
          <p className="text-sm text-muted mt-1">Audit log of every scrape and Telegram/email send. Last {days} days.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Window
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="ml-2 bg-panel border border-border rounded px-2 py-1">
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
        </div>
      </div>

      {health && (
        <section className="grid md:grid-cols-5 gap-3">
          <div className="card">
            <div className="text-xs text-muted">Overall</div>
            <div className={`text-2xl font-bold ${health.overall === "ok" ? "text-success" : health.overall === "warn" ? "text-warn" : "text-danger"}`}>{health.overall}</div>
          </div>
          <div className="card">
            <div className="text-xs text-muted">LLM ({health.llm.backend})</div>
            <div className={`text-2xl font-bold ${health.llm.ok ? "text-success" : "text-danger"}`}>{health.llm.ok ? "ok" : "down"}</div>
            {health.llm.error && <div className="text-xs text-danger mt-1">{health.llm.error.slice(0, 80)}</div>}
          </div>
          <div className="card">
            <div className="text-xs text-muted">Sources</div>
            <div className="text-2xl font-bold">
              {health.sources_total - health.sources_error}<span className="text-muted text-base">/{health.sources_total}</span>
            </div>
            {health.sources_error > 0 && <div className="text-xs text-danger mt-1">{health.sources_error} errored</div>}
          </div>
          <div className="card">
            <div className="text-xs text-muted">Telegram</div>
            <div className={`text-2xl font-bold ${health.telegram_configured ? "text-success" : "text-muted"}`}>
              {health.telegram_configured ? "on" : "off"}
            </div>
            {health.last_alert_at && <div className="text-xs text-muted mt-1">last alert: {fmt(health.last_alert_at)}</div>}
          </div>
          <div className="card">
            <div className="text-xs text-muted">Email</div>
            <div className={`text-2xl font-bold ${health.email_configured ? "text-success" : "text-muted"}`}>
              {health.email_configured ? "on" : "off"}
            </div>
          </div>
        </section>
      )}

      {daily.length > 0 && (
        <section className="card">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Daily new jobs ({daily.reduce((sum, d) => sum + d.new_jobs, 0)} total · {daily.reduce((sum, d) => sum + d.runs, 0)} runs · {daily.reduce((sum, d) => sum + d.errors, 0)} errors)
          </h2>
          <DailyChart daily={daily} />
        </section>
      )}

      <div className="flex gap-2">
        {(["scrapes", "telegram", "email"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? "btn-primary" : ""}`}>
            {t === "scrapes" ? `Scrapes (${scrapes.length})` : t === "telegram" ? `Telegram (${notifications.length})` : `Email (${notifications.length})`}
          </button>
        ))}
      </div>

      {tab === "scrapes" && (
        <section className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted text-left">
              <tr>
                <th className="py-2">Started</th>
                <th>Kind</th>
                <th>Source</th>
                <th>Rows</th>
                <th>New</th>
                <th>Updated</th>
                <th>Alerts</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {scrapes.length === 0 ? (
                <tr><td colSpan={10} className="py-4 text-muted">No scrape runs in window. Click "Run scrape now" on the feed or wait for the scheduler.</td></tr>
              ) : scrapes.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="py-2 whitespace-nowrap">{fmt(r.started_at)}</td>
                  <td><span className="chip">{r.kind}</span></td>
                  <td className="font-mono text-xs">{r.label}</td>
                  <td>{r.rows_seen}</td>
                  <td className="text-success">{r.new_jobs}</td>
                  <td>{r.updated_jobs}</td>
                  <td>{r.alerts_sent}</td>
                  <td className="text-muted">{r.duration_s != null ? `${r.duration_s.toFixed(1)}s` : "—"}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td className="text-danger text-xs max-w-md truncate">{r.error || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {scrapes.some((r) => Object.keys(r.breakdown).length) && (
            <div className="mt-4 text-xs text-muted">
              <strong>Breakdown by source:</strong>{" "}
              {Object.entries(
                scrapes.flatMap((r) => Object.entries(r.breakdown))
                  .reduce<Record<string, number>>((acc, [k, v]) => ({ ...acc, [k]: (acc[k] || 0) + v }), {})
              ).map(([k, v]) => `${sourceLabel(k)}: ${v}`).join(" · ") || "—"}
            </div>
          )}
        </section>
      )}

      {(tab === "telegram" || tab === "email") && (
        <section className="card">
          {notifications.length === 0 ? (
            <div className="text-muted text-sm">
              No {tab} sends in window. {tab === "telegram" && !health?.telegram_configured ? "Telegram not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env" : ""}
              {tab === "email" && !health?.email_configured ? "Email not configured — set SMTP_USER and SMTP_PASSWORD in .env" : ""}
            </div>
          ) : notifications.map((n) => (
            <article key={n.id} className="border-b border-border py-3 last:border-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted">{fmt(n.sent_at)}</span>
                <span className="chip">{n.kind}</span>
                <StatusPill status={n.status} />
                <span className="font-medium truncate">{n.subject || "(no subject)"}</span>
                <button onClick={() => setOpenBody(openBody === n.id ? null : n.id)} className="ml-auto text-xs text-accent hover:underline">
                  {openBody === n.id ? "hide body" : "show body"}
                </button>
              </div>
              {n.error && <div className="text-xs text-danger mt-1">{n.error}</div>}
              {openBody === n.id && (
                <pre className="mt-2 text-xs whitespace-pre-wrap bg-bg p-3 rounded border border-border max-h-[40vh] overflow-auto">{n.body}</pre>
              )}
            </article>
          ))}
        </section>
      )}

      <div className="text-xs text-muted">
        <Link href="/" className="hover:text-text">← Back to feed</Link>
      </div>
    </div>
  );
}
