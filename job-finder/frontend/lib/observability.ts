import { API_BASE } from "./api";

export type ScrapeRun = {
  id: number;
  kind: "jobspy" | "source" | "rescrape";
  label: string;
  source_id: number | null;
  started_at: string;
  finished_at: string | null;
  duration_s: number | null;
  rows_seen: number;
  new_jobs: number;
  updated_jobs: number;
  alerts_sent: number;
  status: "ok" | "error" | "partial" | "running";
  error: string;
  breakdown: Record<string, number>;
};

export type SchedulerJob = {
  id: string;
  next_run: string | null;
  trigger: string;
};

export function timeAgo(iso: string): string {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${Math.round(sec)}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

export function timeUntil(iso: string | null): string {
  if (!iso) return "—";
  const sec = Math.max(0, (new Date(iso).getTime() - Date.now()) / 1000);
  if (sec < 60) return `in ${Math.round(sec)}s`;
  if (sec < 3600) return `in ${Math.round(sec / 60)}m`;
  if (sec < 86400) return `in ${Math.round(sec / 3600)}h`;
  return `in ${Math.round(sec / 86400)}d`;
}

export type DailyRollup = {
  date: string;
  new_jobs: number;
  runs: number;
  errors: number;
  by_label: Record<string, number>;
};

export type Notification = {
  id: number;
  channel: "telegram" | "email";
  kind: "alert" | "digest" | "test";
  subject: string;
  body: string;
  status: "sent" | "failed" | "skipped";
  error: string;
  sent_at: string;
};

export type Health = {
  overall: "ok" | "warn" | "error";
  db: { ok: boolean };
  llm: { ok: boolean; backend: string; sample?: string; error?: string };
  telegram_configured: boolean;
  email_configured: boolean;
  last_scrape: { kind: string; label: string; started_at: string; status: string; new_jobs: number } | null;
  sources_total: number;
  sources_error: number;
  last_notification: { channel: string; kind: string; subject: string; status: string; sent_at: string } | null;
  last_alert_at: string | null;
};

export type DuplicateCluster = {
  canonical_key: string;
  count: number;
  jobs: {
    id: number;
    title: string;
    company: string;
    location: string;
    source: string;
    url: string;
    match_score: number | null;
    llm_score: number | null;
    status: string;
  }[];
};

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => r.statusText)}`);
  return r.json();
}

export const obsApi = {
  scrapes: (days = 30, limit = 500) => j<ScrapeRun[]>(`/observability/scrapes?days=${days}&limit=${limit}`),
  daily: (days = 30) => j<DailyRollup[]>(`/observability/scrapes/daily?days=${days}`),
  notifications: (days = 30, channel?: string) =>
    j<Notification[]>(`/observability/notifications?days=${days}${channel ? `&channel=${channel}` : ""}`),
  health: () => j<Health>(`/observability/health`),
  duplicates: () => j<DuplicateCluster[]>(`/jobs/duplicates`),
  schedulerJobs: () => j<SchedulerJob[]>(`/observability/jobs`),
  scrapeBuiltin: (site: string) => j<Record<string, unknown>>(`/sources/builtin/${site}/scrape`, { method: "POST" }),
};

// Friendly source labels for UI display
export function sourceLabel(s: string): string {
  if (!s) return "(unknown)";
  if (s === "linkedin") return "LinkedIn";
  if (s === "indeed") return "Indeed";
  if (s === "glassdoor") return "Glassdoor";
  if (s === "google") return "Google Jobs";
  if (s.startsWith("greenhouse:")) return `${s.split(":")[1]} (Greenhouse)`;
  if (s.startsWith("lever:")) return `${s.split(":")[1]} (Lever)`;
  if (s.startsWith("ashby:")) return `${s.split(":")[1]} (Ashby)`;
  if (s.startsWith("web:")) return `${s.split(":")[1]} (career page)`;
  return s;
}
