import { API_BASE } from "./api";

export type LocationFilter = {
  countries: string[];
  cities: string[];
  allow_remote: boolean;
  strict: boolean;
};

export type Roles = { primary: string[]; secondary: string[] };

export type ScraperCountry = { location: string; country_indeed: string };

export type Profile = {
  candidate: Record<string, string>;
  location_filter: LocationFilter;
  target_roles: Roles;
  resume_routing: { match: string[]; use: string }[];
  default_resume: string;
  filters: {
    exclude_titles: string[];
    exclude_companies: string[];
    min_seniority_keywords: string[];
  };
  scoring: { weights: Record<string, number>; must_have_any: string[] };
  scrapers: {
    jobspy: {
      sites: string[];
      site_intervals?: Record<string, number>;
      search_terms: string[];
      countries: ScraperCountry[];
      results_wanted: number;
      hours_old: number;
    };
  };
  available_countries: string[];
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

export const profileApi = {
  get: () => j<Profile>(`/profile`),
  patch: (body: Record<string, unknown>) =>
    j<Profile>(`/profile`, { method: "PATCH", body: JSON.stringify(body) }),
};

export type StatusEvent = {
  id: number;
  from_status: string | null;
  to_status: string;
  note: string;
  created_at: string;
};
export const eventsApi = {
  list: (jobId: number) =>
    j<StatusEvent[]>(`/jobs/${jobId}/events`),
};
