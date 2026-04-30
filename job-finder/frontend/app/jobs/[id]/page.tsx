"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { api, type Job, type Bundle } from "@/lib/api";
import { eventsApi, type StatusEvent } from "@/lib/profile";
import { diffLines } from "@/lib/diff";

const STATUSES = ["new", "approved", "rejected", "applied", "screening", "interview", "offer", "lost"];

function ScoreBadge({ label, score, color }: { label: string; score: number | null; color: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{score ?? "—"}</div>
    </div>
  );
}

function DiffView({ base, tailored }: { base: string; tailored: string }) {
  const lines = diffLines(base, tailored);
  return (
    <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
      {lines.map((l, i) => (
        <div
          key={i}
          className={
            l.type === "add"
              ? "bg-success/10 text-success"
              : l.type === "del"
                ? "bg-danger/10 text-danger line-through"
                : "text-muted"
          }
        >
          <span className="select-none mr-2">{l.type === "add" ? "+" : l.type === "del" ? "-" : " "}</span>
          {l.text || " "}
        </div>
      ))}
    </pre>
  );
}

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const jobId = Number(id);
  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"resume" | "diff" | "cover" | "talking" | "outreach">("resume");

  async function load() {
    const [j, ev, b] = await Promise.all([
      api.job(jobId),
      eventsApi.list(jobId),
      api.bundle(jobId).catch(() => null),
    ]);
    setJob(j);
    setNotes(j.notes || "");
    setEvents(ev);
    setBundle(b);
  }
  useEffect(() => { load(); }, [jobId]);

  // While the auto-tailor background task is generating the bundle, poll
  // the bundle endpoint every 5s so the UI flips from "Tailoring…" to the
  // tabbed viewer the moment the artefacts land — without manual refresh.
  const tailorInProgress =
    job?.status === "approved" && bundle && !bundle.tailored_resume_md;
  useEffect(() => {
    if (!tailorInProgress) return;
    const t = setInterval(async () => {
      try {
        const b = await api.bundle(jobId);
        setBundle(b);
        if (b.tailored_resume_md) clearInterval(t);
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [tailorInProgress, jobId]);

  async function setStatus(s: string) {
    setBusy("status");
    await api.setStatus(jobId, s);
    await load();
    setBusy(null);
  }
  async function saveNotes() {
    setBusy("notes");
    await api.setNotes(jobId, notes);
    await load();
    setBusy(null);
  }
  async function tailor() {
    setBusy("tailor");
    try {
      await api.tailor(jobId);
      await load();
    } catch (e: any) {
      alert(`Tailor failed: ${e.message}`);
    } finally {
      setBusy(null);
    }
  }
  async function autoApply() {
    setBusy("apply");
    try {
      const r = await api.apply(jobId);
      alert(JSON.stringify(r, null, 2));
    } catch (e: any) {
      alert(`Apply unavailable: ${e.message}`);
    }
    setBusy(null);
  }

  function copy(t: string) { navigator.clipboard.writeText(t); }

  if (!job) return <div className="card text-muted">Loading…</div>;

  const emails = job.recruiter_emails ? job.recruiter_emails.split(",").filter(Boolean) : [];
  const handles = job.recruiter_linkedin ? job.recruiter_linkedin.split(",").filter(Boolean) : [];
  const tailored = bundle?.tailored_resume_md || "";
  const baseMd = bundle?.base_resume_md || "";

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted">
        <Link href="/" className="hover:text-text">← Back to feed</Link>
      </div>

      <header className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{job.title}</h1>
            <div className="text-muted mt-1">
              {job.company} · {job.location || "n/a"} · <span className="chip">{job.source}</span>
              {job.salary_min || job.salary_max ? (
                <>
                  {" · 💰 "}
                  {(job.salary_currency || "EUR")}{" "}
                  {job.salary_min ? Math.round(job.salary_min).toLocaleString() : "?"}–
                  {job.salary_max ? Math.round(job.salary_max).toLocaleString() : "?"}
                </>
              ) : null}
            </div>
            {job.match_reasoning && <div className="text-sm text-muted mt-2 italic">heuristic: {job.match_reasoning}</div>}
            {job.llm_reasoning && <div className="text-sm text-accent mt-1 italic">LLM: {job.llm_reasoning}</div>}
          </div>
          <div className="flex gap-6">
            <ScoreBadge label="Heuristic" score={job.match_score} color="text-warn" />
            <ScoreBadge label="LLM fit" score={job.llm_score} color="text-accent" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={job.url} target="_blank" rel="noreferrer" className="btn">Open posting ↗</a>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              disabled={busy === "status"}
              className={`btn ${job.status === s ? "btn-primary" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      {/* Recruiter contacts */}
      {(emails.length || handles.length) > 0 && (
        <section className="card">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Recruiter contacts</h2>
          <div className="flex flex-wrap gap-2">
            {emails.map((e) => (
              <button key={e} onClick={() => copy(e)} className="chip border-accent text-accent" title="copy">
                ✉️ {e}
              </button>
            ))}
            {handles.map((h) => (
              <a key={h} href={h} target="_blank" rel="noreferrer" className="chip border-accent text-accent">
                🔗 {h.replace(/.*linkedin\.com\//, "")}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Description</h2>
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed max-h-[60vh] overflow-auto">{job.description || "(no description scraped)"}</pre>
        </div>

        <div className="space-y-4">
          {/* Tailored bundle */}
          <div className="card">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Tailored bundle</h2>
              <div className="flex gap-2 flex-wrap">
                <button onClick={tailor} disabled={busy === "tailor"} className="btn btn-primary">
                  {busy === "tailor" ? "Generating…" : bundle?.tailored_resume_md ? "Re-tailor" : "Tailor now"}
                </button>
                {bundle?.resume_pdf_exists && (
                  <a href={`http://localhost:8787/api/jobs/${jobId}/resume.pdf`} target="_blank" rel="noreferrer" className="btn">PDF ↗</a>
                )}
                <button onClick={autoApply} disabled={busy === "apply"} className="btn">Easy Apply</button>
              </div>
            </div>
            {tailorInProgress ? (
              <div className="flex items-center gap-3 text-sm bg-bg border border-border rounded p-3">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-warn animate-pulse" />
                <div>
                  <div className="font-medium">Tailoring with the LLM…</div>
                  <div className="text-xs text-muted mt-0.5">
                    Generating tailored resume + cover letter + talking points + recruiter outreach. Usually 30–60s.
                  </div>
                </div>
              </div>
            ) : !bundle?.tailored_resume_md ? (
              <div className="text-xs text-muted">No bundle yet. Click "Tailor now" or set status to <em>approved</em> to auto-generate.</div>
            ) : (
              <>
                <div className="flex gap-1 mb-3 flex-wrap">
                  {(["resume", "diff", "cover", "talking", "outreach"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`text-xs px-2 py-1 rounded border ${tab === t ? "border-accent text-accent" : "border-border text-muted hover:text-text"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="bg-bg border border-border rounded p-3 max-h-[60vh] overflow-auto">
                  {tab === "resume" && (
                    <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{tailored}</pre>
                  )}
                  {tab === "diff" && (
                    baseMd
                      ? <DiffView base={baseMd} tailored={tailored} />
                      : <div className="text-xs text-muted">Base resume snapshot missing — re-tailor to populate.</div>
                  )}
                  {tab === "cover" && (
                    <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">{bundle.cover_letter_md}</pre>
                  )}
                  {tab === "talking" && (
                    <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">{bundle.talking_points_md}</pre>
                  )}
                  {tab === "outreach" && (
                    <div className="space-y-2">
                      <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">{bundle.outreach_md}</pre>
                      <button onClick={() => copy(bundle.outreach_md || "")} className="btn">Copy message</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full bg-bg border border-border rounded p-2 text-sm"
              placeholder="Recruiter contact, referral, reasons to pursue…"
            />
            <button onClick={saveNotes} disabled={busy === "notes"} className="btn mt-2">
              {busy === "notes" ? "Saving…" : "Save notes"}
            </button>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Status timeline</h2>
            {events.length === 0 ? (
              <div className="text-xs text-muted">No events yet.</div>
            ) : (
              <ol className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="text-sm flex items-start gap-3">
                    <span className="text-xs text-muted whitespace-nowrap mt-0.5">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                    <span>
                      {e.from_status ? (
                        <>
                          <span className="text-muted">{e.from_status}</span>
                          <span className="text-muted mx-1">→</span>
                        </>
                      ) : null}
                      <span className="font-medium">{e.to_status}</span>
                      {e.note && <span className="text-muted ml-2 italic">{e.note}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card text-xs text-muted space-y-1">
            <div>Discovered: {new Date(job.discovered_at).toLocaleString()}</div>
            {job.posted_at && <div>Posted: {new Date(job.posted_at).toLocaleString()}</div>}
            {job.alerted_at && <div>Alerted: {new Date(job.alerted_at).toLocaleString()}</div>}
            <div>External ID: <code>{job.external_id}</code></div>
          </div>
        </div>
      </section>
    </div>
  );
}
