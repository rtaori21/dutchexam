"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obsApi, sourceLabel, timeAgo, timeUntil, type ScrapeRun, type SchedulerJob } from "@/lib/observability";

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "running" ? "bg-warn animate-pulse" :
    status === "ok" ? "bg-success" :
    status === "partial" ? "bg-warn" :
    status === "error" ? "bg-danger" : "bg-muted";
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
}

function summary(r: ScrapeRun): string {
  if (r.status === "running") return "running…";
  if (r.status === "error") return r.error?.slice(0, 60) || "error";
  const parts: string[] = [];
  if (r.new_jobs > 0) parts.push(`${r.new_jobs} new`);
  if (r.updated_jobs > 0) parts.push(`${r.updated_jobs} updated`);
  if (r.alerts_sent > 0) parts.push(`${r.alerts_sent} alerts`);
  if (parts.length === 0) parts.push("no new jobs");
  parts.push(`(${r.rows_seen} seen)`);
  return parts.join(" · ");
}

function nicifyLabel(label: string): string {
  // jobspy:linkedin etc. comes through as "Linkedin" — convert to friendly
  if (label.toLowerCase() === "linkedin") return "LinkedIn";
  if (label.includes(":")) {
    // greenhouse:Adyen etc
    return sourceLabel(label.toLowerCase());
  }
  return label;
}

export default function ActivityStrip() {
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);

  async function load() {
    try {
      const [r, j] = await Promise.all([obsApi.scrapes(7, 30), obsApi.schedulerJobs()]);
      setRuns(r);
      setJobs(j);
    } catch {
      // Silent — header dot already surfaces backend failure
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5_000); // refresh every 5s for "running" updates
    return () => clearInterval(t);
  }, []);

  const upcoming = jobs
    .filter((j) => j.id.startsWith("jobspy:") || j.id === "sources")
    .sort((a, b) => (a.next_run || "").localeCompare(b.next_run || ""))
    .slice(0, 4);

  return (
    <section className="card">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
          Recent scrape activity
        </h2>
        <Link href="/observability" className="text-xs text-accent hover:underline">
          full audit log →
        </Link>
      </div>

      {runs.length === 0 ? (
        <div className="text-sm text-muted">
          No scrapes yet. The first scheduled run is staggered to start ~30s after backend boot. Or hit "Run scrape now" below.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {runs.slice(0, 6).map((r) => (
            <li key={r.id} className="flex items-center gap-3 text-sm">
              <StatusDot status={r.status} />
              <span className="font-medium min-w-[140px] truncate">{nicifyLabel(r.label)}</span>
              <span className={r.new_jobs > 0 ? "text-success" : r.status === "running" ? "text-warn" : "text-muted"}>
                {summary(r)}
              </span>
              <span className="text-muted text-xs ml-auto whitespace-nowrap">
                {r.duration_s != null ? `${r.duration_s.toFixed(1)}s · ` : ""}
                {timeAgo(r.started_at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {upcoming.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted">
          <span className="font-medium uppercase tracking-wide">next scheduled</span>
          {" — "}
          {upcoming.map((u, idx) => (
            <span key={u.id}>
              {idx > 0 && <span className="mx-1">·</span>}
              <span className="font-mono">{u.id}</span> {timeUntil(u.next_run)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
