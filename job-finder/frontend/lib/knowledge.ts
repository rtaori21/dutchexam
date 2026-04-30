import { API_BASE } from "./api";

export const KNOWLEDGE_KINDS = ["project", "cover_template", "qa", "note", "link", "summary"] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

export type KnowledgeItem = {
  id: number;
  kind: KnowledgeKind;
  title: string;
  body: string;
  url: string;
  tags: string;
  include_in_llm: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ResumeFile = { filename: string; size_bytes: number; updated_at: string };

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => r.statusText)}`);
  return r.json();
}

export const kbApi = {
  listResumes: () => j<ResumeFile[]>(`/knowledge/resumes`),
  readResume: (filename: string) => j<{ filename: string; body: string }>(`/knowledge/resumes/${encodeURIComponent(filename)}`),
  writeResume: (filename: string, body: string) =>
    j<{ filename: string }>(`/knowledge/resumes/${encodeURIComponent(filename)}`, {
      method: "PUT",
      body: JSON.stringify({ body }),
    }),
  deleteResume: (filename: string) =>
    j<{ ok: boolean }>(`/knowledge/resumes/${encodeURIComponent(filename)}`, { method: "DELETE" }),

  list: (kind?: KnowledgeKind) =>
    j<KnowledgeItem[]>(`/knowledge/items${kind ? `?kind=${kind}` : ""}`),
  create: (body: Partial<KnowledgeItem> & { kind: KnowledgeKind; title: string }) =>
    j<KnowledgeItem>(`/knowledge/items`, { method: "POST", body: JSON.stringify(body) }),
  patch: (id: number, body: Partial<KnowledgeItem>) =>
    j<KnowledgeItem>(`/knowledge/items/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => j<{ ok: boolean }>(`/knowledge/items/${id}`, { method: "DELETE" }),
};
