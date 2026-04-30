import { API_BASE } from "./api";

export type EnvVar = {
  key: string;
  type: "text" | "url" | "email" | "number" | "secret" | "boolean" | "select";
  options?: string[];
  default: string;
  help: string;
  is_secret: boolean;
  value: string; // masked if secret
  is_set: boolean;
};

export type EnvGroup = {
  group: string;
  description: string;
  vars: EnvVar[];
};

export type EnvDoc = { groups: EnvGroup[]; path: string };

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => r.statusText)}`);
  return r.json();
}

export type LLMUsageBucket = {
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  errors: number;
};
export type LLMUsageRecent = {
  id: number;
  backend: string;
  model: string;
  kind: string;
  prompt_tokens: number;
  completion_tokens: number;
  duration_ms: number;
  error: string;
  sent_at: string;
};
export type LLMUsage = {
  today: LLMUsageBucket;
  window: LLMUsageBucket;
  days: number;
  by_kind: Record<string, LLMUsageBucket>;
  by_backend: Record<string, LLMUsageBucket>;
  recent: LLMUsageRecent[];
};

export const envApi = {
  get: () => j<EnvDoc>(`/env`),
  patch: (values: Record<string, string>, unset: string[] = []) =>
    j<{ ok: boolean; written: string[]; unset: string[]; live_settings_reloaded: boolean }>(
      `/env`,
      { method: "PATCH", body: JSON.stringify({ values, unset }) }
    ),
  testLLM: () => j<{ ok: boolean; backend: string; sample?: string; error?: string }>(`/env/test/llm`, { method: "POST" }),
  testTelegram: () => j<{ sent: boolean }>(`/env/test/telegram`, { method: "POST" }),
  testEmail: () => j<{ sent: boolean }>(`/env/test/email`, { method: "POST" }),
  llmUsage: (days = 30) => j<LLMUsage>(`/env/llm-usage?days=${days}`),
};
