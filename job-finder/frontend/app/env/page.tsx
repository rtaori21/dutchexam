"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { envApi, type EnvDoc, type EnvVar, type LLMUsage } from "@/lib/env_config";

function StatusChip({ isSet }: { isSet: boolean }) {
  return (
    <span className={`chip ${isSet ? "border-success text-success" : "border-muted text-muted"}`}>
      {isSet ? "set" : "not set"}
    </span>
  );
}

function Field({
  v,
  draft,
  onChange,
  reveal,
  setReveal,
}: {
  v: EnvVar;
  draft: string | undefined;
  onChange: (next: string) => void;
  reveal: boolean;
  setReveal: (n: boolean) => void;
}) {
  const isDirty = draft !== undefined;
  const display = isDirty ? draft! : v.value;

  if (v.type === "boolean") {
    const on = (display || v.default || "false").toLowerCase() === "true";
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? "true" : "false")} />
        {on ? "true" : "false"}
      </label>
    );
  }

  if (v.type === "select") {
    return (
      <select
        value={display || v.default}
        onChange={(e) => onChange(e.target.value)}
        className="bg-bg border border-border rounded px-3 py-2 text-sm"
      >
        {(v.options || []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }

  if (v.type === "secret") {
    return (
      <div className="flex gap-2">
        <input
          type={reveal || isDirty ? "text" : "password"}
          value={isDirty ? draft! : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={v.is_set ? `currently ${v.value}` : "(not set)"}
          className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm font-mono"
        />
        <button
          type="button"
          onClick={() => setReveal(!reveal)}
          className="btn"
          title={reveal ? "hide" : "show typed value"}
        >
          {reveal ? "hide" : "show"}
        </button>
      </div>
    );
  }

  if (v.type === "number" && (v.key === "SCRAPE_INTERVAL_MINUTES" || v.key === "SOURCE_INTERVAL_MINUTES")) {
    const presets = [5, 15, 30, 60, 120];
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="number"
          value={display}
          onChange={(e) => onChange(e.target.value)}
          placeholder={v.default || "(not set)"}
          className="w-24 bg-bg border border-border rounded px-3 py-2 text-sm font-mono"
        />
        <span className="text-xs text-muted">min</span>
        <div className="flex gap-1">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(String(p))}
              className={`text-xs px-2 py-1 rounded border ${String(p) === display ? "border-accent text-accent" : "border-border text-muted hover:text-text"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <input
      type={v.type === "number" ? "number" : v.type === "email" ? "email" : "text"}
      value={display}
      onChange={(e) => onChange(e.target.value)}
      placeholder={v.default || "(not set)"}
      className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono"
    />
  );
}


function fmtNum(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function UsagePanel({ usage }: { usage: LLMUsage | null }) {
  if (!usage) return null;
  const today = usage.today;
  const window_ = usage.window;
  return (
    <div className="card border-accent">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-wide">LLM usage</h2>
        <span className="text-xs text-muted">last {usage.days} days</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <div>
          <div className="text-xs text-muted">Today</div>
          <div className="text-2xl font-semibold">{today.calls}</div>
          <div className="text-xs text-muted mt-1">
            {fmtNum(today.prompt_tokens)} in · {fmtNum(today.completion_tokens)} out
            {today.errors > 0 && <span className="text-danger"> · {today.errors} err</span>}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Window total</div>
          <div className="text-2xl font-semibold">{window_.calls}</div>
          <div className="text-xs text-muted mt-1">
            {fmtNum(window_.prompt_tokens)} in · {fmtNum(window_.completion_tokens)} out
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-muted">Breakdown by purpose</div>
          <div className="text-xs mt-1 space-y-0.5">
            {Object.entries(usage.by_kind).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="text-muted">
                  {v.calls} calls · {fmtNum(v.prompt_tokens + v.completion_tokens)} tok
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {usage.recent.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted hover:text-text">recent {usage.recent.length} calls</summary>
          <div className="mt-2 space-y-1 font-mono">
            {usage.recent.slice(0, 10).map((r) => (
              <div key={r.id} className="flex gap-3">
                <span className="text-muted">{new Date(r.sent_at).toLocaleTimeString()}</span>
                <span>{r.backend}</span>
                <span className="text-accent">{r.kind}</span>
                <span className="text-muted">{r.prompt_tokens}+{r.completion_tokens} tok</span>
                <span className="text-muted">{r.duration_ms}ms</span>
                {r.error && <span className="text-danger truncate">{r.error.slice(0, 60)}</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}


export default function EnvPage() {
  const [doc, setDoc] = useState<EnvDoc | null>(null);
  const [usage, setUsage] = useState<LLMUsage | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function load() {
    const [d, u] = await Promise.all([envApi.get(), envApi.llmUsage(30).catch(() => null)]);
    setDoc(d);
    setUsage(u);
    setDrafts({});
  }
  useEffect(() => { load(); }, []);

  function setDraft(key: string, val: string) {
    setDrafts((d) => ({ ...d, [key]: val }));
  }
  function clearDraft(key: string) {
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  }

  async function save() {
    if (Object.keys(drafts).length === 0) return;
    setBusy("save");
    setMsg(null);
    try {
      const r = await envApi.patch(drafts);
      setMsg({ kind: "ok", text: `Saved ${r.written.length} field${r.written.length === 1 ? "" : "s"}. Settings reloaded — no restart needed.` });
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(null);
    }
  }

  async function runTest(kind: "llm" | "telegram" | "email") {
    setBusy(`test-${kind}`);
    setMsg(null);
    try {
      let r: any;
      if (kind === "llm") r = await envApi.testLLM();
      else if (kind === "telegram") r = await envApi.testTelegram();
      else r = await envApi.testEmail();
      const ok = r.ok ?? r.sent;
      setMsg({
        kind: ok ? "ok" : "err",
        text: ok
          ? kind === "llm" ? `LLM OK (${r.backend}). Sample: "${r.sample || "(empty)"}"` : `${kind} test sent`
          : kind === "llm" ? `LLM test failed: ${r.error}` : `${kind} test failed — see Observability page for the error`,
      });
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(null);
    }
  }

  const dirtyCount = useMemo(() => Object.keys(drafts).length, [drafts]);

  if (!doc) return <div className="card text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted">
        <Link href="/" className="hover:text-text">← Back to feed</Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Environment config</h1>
          <p className="text-sm text-muted mt-1">
            Edits go to <code className="text-accent font-mono text-xs">{doc.path}</code> and the live backend reloads them in place — no restart needed.
            Secrets stay masked except while you type a new value.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => runTest("llm")} disabled={busy?.startsWith("test")} className="btn">Test LLM</button>
          <button onClick={() => runTest("telegram")} disabled={busy?.startsWith("test")} className="btn">Test Telegram</button>
          <button onClick={() => runTest("email")} disabled={busy?.startsWith("test")} className="btn">Test Email</button>
        </div>
      </header>

      {msg && (
        <div className={`card ${msg.kind === "ok" ? "border-success" : "border-danger"}`}>
          <div className={`text-sm ${msg.kind === "ok" ? "text-success" : "text-danger"}`}>{msg.text}</div>
        </div>
      )}

      <UsagePanel usage={usage} />

      <div className="space-y-4">
        {doc.groups.map((g) => (
          <section key={g.group} className="card">
            <div className="mb-3">
              <h2 className="text-lg font-semibold">{g.group}</h2>
              {g.description && <p className="text-xs text-muted mt-1 leading-relaxed">{g.description}</p>}
            </div>
            <div className="space-y-3">
              {g.vars.map((v) => {
                const isDirty = drafts[v.key] !== undefined;
                return (
                  <div key={v.key} className="grid md:grid-cols-[200px_1fr_120px] gap-3 items-start">
                    <div className="pt-2">
                      <div className="font-mono text-sm">{v.key}</div>
                      {v.help && <div className="text-xs text-muted mt-1">{v.help}</div>}
                    </div>
                    <div>
                      <Field
                        v={v}
                        draft={drafts[v.key]}
                        onChange={(next) => setDraft(v.key, next)}
                        reveal={!!reveal[v.key]}
                        setReveal={(n) => setReveal((r) => ({ ...r, [v.key]: n }))}
                      />
                      {isDirty && (
                        <button onClick={() => clearDraft(v.key)} className="text-xs text-muted hover:text-text mt-1">
                          revert change
                        </button>
                      )}
                    </div>
                    <div className="pt-2">
                      <StatusChip isSet={v.is_set} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <div className="card flex items-center gap-3 shadow-xl">
          <span className="text-sm text-muted">
            {dirtyCount === 0 ? "No changes" : `${dirtyCount} pending change${dirtyCount === 1 ? "" : "s"}`}
          </span>
          <button
            onClick={save}
            disabled={busy === "save" || dirtyCount === 0}
            className="btn btn-primary"
          >
            {busy === "save" ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
