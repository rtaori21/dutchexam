import { API_BASE } from "./api";

export type Source = {
  id: number;
  name: string;
  url: string;
  ats: string;
  board_token: string | null;
  enabled: boolean;
  interval_min: number;
  last_scraped_at: string | null;
  last_status: string;
  last_error: string;
  last_jobs_found: number;
  created_at: string;
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

export const sourcesApi = {
  list: () => j<Source[]>(`/sources`),
  create: (body: { name: string; url: string; interval_min?: number }) =>
    j<Source>(`/sources`, { method: "POST", body: JSON.stringify(body) }),
  patch: (id: number, body: Partial<Pick<Source, "name" | "enabled" | "interval_min">>) =>
    j<Source>(`/sources/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => j<{ ok: boolean }>(`/sources/${id}`, { method: "DELETE" }),
  scrape: (id: number) => j<Record<string, unknown>>(`/sources/${id}/scrape`, { method: "POST" }),
};
