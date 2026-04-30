"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { kbApi, KNOWLEDGE_KINDS, type KnowledgeItem, type KnowledgeKind, type ResumeFile } from "@/lib/knowledge";

const KIND_LABELS: Record<KnowledgeKind, string> = {
  project: "Projects",
  cover_template: "Cover templates",
  qa: "Interview Q&A",
  note: "Notes",
  link: "Profile links",
  summary: "Summaries",
};
const KIND_PLACEHOLDERS: Record<KnowledgeKind, { title: string; body: string }> = {
  project: { title: "TomTom Official MCP", body: "What you built, scope, scale, your role, outcome…" },
  cover_template: { title: "Senior Manager (technical)", body: "Reusable opening + closing. The LLM remixes per JD." },
  qa: { title: "Tell me about a time you led a team through ambiguity", body: "STAR: Situation / Task / Action / Result + Reflection" },
  note: { title: "Salary research — Booking.com Sr Mgr", body: "Free-form note to remember anything." },
  link: { title: "GitHub", body: "Optional description", },
  summary: { title: "30s elevator pitch", body: "" },
};


function ResumesTab() {
  const [files, setFiles] = useState<ResumeFile[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  async function reload() { setFiles(await kbApi.listResumes()); }
  async function loadFile(name: string) {
    setOpen(name);
    setBusy("load");
    const r = await kbApi.readResume(name);
    setBody(r.body);
    setBusy(null);
  }
  async function save() {
    if (!open) return;
    setBusy("save");
    await kbApi.writeResume(open, body);
    await reload();
    setBusy(null);
  }
  async function createNew() {
    const name = newName.endsWith(".md") ? newName : `${newName}.md`;
    if (!name || name.length < 4) return;
    setBusy("create");
    await kbApi.writeResume(name, `# ${name.replace(".md", "")}\n\n## Summary\n\n## Experience\n\n## Education\n\n## Skills\n`);
    setNewName("");
    await reload();
    await loadFile(name);
    setBusy(null);
  }
  async function remove(name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    await kbApi.deleteResume(name);
    if (open === name) { setOpen(null); setBody(""); }
    await reload();
  }
  useEffect(() => { reload(); }, []);

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4">
      <div className="space-y-2">
        <div className="card">
          <h3 className="text-sm font-semibold mb-2">Files</h3>
          {files.length === 0 ? <div className="text-xs text-muted">No resumes yet.</div> : (
            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.filename} className="flex items-center justify-between gap-2">
                  <button onClick={() => loadFile(f.filename)} className={`text-sm text-left flex-1 truncate hover:text-accent ${open === f.filename ? "text-accent" : ""}`}>
                    {f.filename}
                  </button>
                  <button onClick={() => remove(f.filename)} className="text-muted hover:text-danger text-xs">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold mb-2">New resume</h3>
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="director_ai.md" className="flex-1 bg-bg border border-border rounded px-2 py-1 text-sm" />
            <button onClick={createNew} disabled={busy === "create"} className="btn">+</button>
          </div>
        </div>
      </div>
      <div className="card">
        {!open ? (
          <div className="text-muted">Select a resume on the left to edit, or create one.</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold font-mono">{open}</h3>
              <button onClick={save} disabled={busy === "save"} className="btn btn-primary">{busy === "save" ? "Saving…" : "Save"}</button>
            </div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={28} className="w-full bg-bg border border-border rounded p-3 font-mono text-xs" />
          </>
        )}
      </div>
    </div>
  );
}


function KbItemsTab({ kind }: { kind: KnowledgeKind }) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [editing, setEditing] = useState<Partial<KnowledgeItem> | null>(null);

  async function load() { setItems(await kbApi.list(kind)); }
  useEffect(() => { load(); setEditing(null); }, [kind]);

  async function save() {
    if (!editing || !editing.title) return;
    if (editing.id) {
      await kbApi.patch(editing.id, editing);
    } else {
      await kbApi.create({
        kind,
        title: editing.title,
        body: editing.body || "",
        url: editing.url || "",
        tags: editing.tags || "",
        include_in_llm: editing.include_in_llm ?? true,
      });
    }
    setEditing(null);
    await load();
  }
  async function remove(id: number) {
    if (!confirm("Delete?")) return;
    await kbApi.remove(id);
    await load();
  }

  const placeholder = KIND_PLACEHOLDERS[kind];

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4">
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">{KIND_LABELS[kind]}</h3>
          <button onClick={() => setEditing({ kind, title: "", body: "", include_in_llm: true })} className="btn btn-primary">+ New</button>
        </div>
        {items.length === 0 ? <div className="text-xs text-muted">None yet — add one to seed the LLM context.</div> : (
          <ul className="space-y-1">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-2">
                <button onClick={() => setEditing(it)} className={`text-sm text-left flex-1 truncate hover:text-accent ${editing?.id === it.id ? "text-accent" : ""}`}>
                  {it.title || <span className="italic text-muted">(untitled)</span>}
                  {!it.include_in_llm && <span className="ml-1 text-xs text-muted">(off)</span>}
                </button>
                <button onClick={() => remove(it.id)} className="text-muted hover:text-danger text-xs">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        {!editing ? (
          <div className="text-muted">Select an item or click <em>+ New</em>. Items with "include in LLM" enabled are added to the cached context for resume tailoring and match scoring.</div>
        ) : (
          <div className="space-y-3">
            <input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder={`Title (${placeholder.title})`} className="w-full bg-bg border border-border rounded px-3 py-2" />
            {(kind === "link" || kind === "project") && (
              <input value={editing.url || ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://…" className="w-full bg-bg border border-border rounded px-3 py-2 font-mono text-sm" />
            )}
            <textarea value={editing.body || ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={kind === "qa" ? 14 : 10} placeholder={placeholder.body} className="w-full bg-bg border border-border rounded p-3 text-sm font-mono" />
            <input value={editing.tags || ""} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} placeholder="Tags (comma-separated, optional)" className="w-full bg-bg border border-border rounded px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.include_in_llm ?? true} onChange={(e) => setEditing({ ...editing, include_in_llm: e.target.checked })} />
              Include in LLM context (uses this when tailoring resumes / scoring matches)
            </label>
            <div className="flex gap-2">
              <button onClick={save} className="btn btn-primary">{editing.id ? "Save" : "Create"}</button>
              <button onClick={() => setEditing(null)} className="btn">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export default function KnowledgePage() {
  const [tab, setTab] = useState<"resume" | KnowledgeKind>("resume");
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted">
        <Link href="/" className="hover:text-text">← Back to feed</Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold">Knowledge base</h1>
        <p className="text-sm text-muted mt-1">
          Your resumes, projects, cover-letter templates, interview Q&A, and notes — all in one place.
          Items marked "include in LLM" are added to the model's cached context when tailoring resumes and scoring matches.
        </p>
      </header>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab("resume")} className={`btn ${tab === "resume" ? "btn-primary" : ""}`}>Resumes</button>
        {KNOWLEDGE_KINDS.map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`btn ${tab === k ? "btn-primary" : ""}`}>{KIND_LABELS[k]}</button>
        ))}
      </div>
      {tab === "resume" ? <ResumesTab /> : <KbItemsTab kind={tab} />}
    </div>
  );
}
