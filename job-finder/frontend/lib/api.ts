export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8787/api";

export type Job = {
  id: number;
  source: string;
  external_id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  posted_at: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  is_remote: boolean;
  seniority: string | null;
  job_type: string | null;
  match_score: number | null;
  match_reasoning: string;
  suggested_resume: string | null;
  llm_score: number | null;
  llm_reasoning: string;
  recruiter_emails: string;
  recruiter_linkedin: string;
  talking_points: string;
  recruiter_message: string;
  status: string;
  notes: string;
  discovered_at: string;
  updated_at: string;
  alerted_at: string | null;
};

export type Bundle = {
  job_id: number;
  base_resume_md: string | null;
  tailored_resume_md: string | null;
  cover_letter_md: string | null;
  talking_points_md: string | null;
  outreach_md: string | null;
  resume_pdf_exists: boolean;
};

export type SalaryHistogram = {
  currency: string;
  buckets: { label: string; count: number; low: number; high: number }[];
  median_min: number | null;
  median_max: number | null;
  sample_size: number;
};

export type Stats = {
  total: number;
  by_status: Record<string, number>;
  new_today: number;
  applied_total: number;
  avg_score: number | null;
};

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  jobs: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
    return j<Job[]>(`/jobs?${qs}`);
  },
  job: (id: number) => j<Job>(`/jobs/${id}`),
  stats: () => j<Stats>(`/stats`),
  setStatus: (id: number, status: string, note = "") =>
    j<Job>(`/jobs/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, note }) }),
  setNotes: (id: number, notes: string) =>
    j<Job>(`/jobs/${id}/notes`, { method: "PATCH", body: JSON.stringify({ notes }) }),
  scrape: () => j<Record<string, unknown>>(`/scrape/run`, { method: "POST" }),
  tailor: (id: number) => j<Record<string, string>>(`/jobs/${id}/tailor`, { method: "POST" }),
  apply: (id: number) => j<Record<string, unknown>>(`/jobs/${id}/apply`, { method: "POST" }),
  bundle: (id: number) => j<Bundle>(`/jobs/${id}/bundle`),
  deepScore: (top_n = 20) => j<Record<string, number>>(`/jobs/deep-score?top_n=${top_n}`, { method: "POST" }),
  salaries: () => j<SalaryHistogram>(`/stats/salaries`),
  digestPreview: () => j<{ text: string }>(`/digest/preview`, { method: "POST" }),
  digestSend: () => j<{ sent: boolean; length: number }>(`/digest/send`, { method: "POST" }),
  bulkStatus: (ids: number[], status: string, note = "") =>
    j<{ requested: number; updated: number; skipped: number; invalid: number }>(
      `/jobs/bulk-status`,
      { method: "POST", body: JSON.stringify({ ids, status, note }) }
    ),
  importUrl: (url: string) =>
    j<{
      ok: boolean;
      imported?: boolean;
      already_exists?: boolean;
      job_id?: number;
      status?: string;
      score?: number;
      title?: string;
      company?: string;
      reason?: string;
      preview?: { title: string; company: string; location: string };
    }>(`/jobs/import-url`, { method: "POST", body: JSON.stringify({ url }) }),
  tailorQueue: () => j<TailorRetry[]>(`/tailor-queue`),
  tailorQueueRunNow: () => j<{ attempted: number; succeeded: number; failed: number }>(`/tailor-queue/run`, { method: "POST" }),
  tailorQueueReset: (job_id: number) => j<{ ok: boolean }>(`/tailor-queue/${job_id}/reset`, { method: "POST" }),
};

export type TailorRetry = {
  id: number;
  job_id: number;
  attempts: number;
  max_attempts: number;
  last_error: string;
  last_attempt_at: string | null;
  next_attempt_at: string;
  exhausted: boolean;
};
