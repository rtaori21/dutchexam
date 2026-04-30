"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obsApi, sourceLabel, type DuplicateCluster } from "@/lib/observability";
import { api } from "@/lib/api";

export default function DuplicatesPage() {
  const [clusters, setClusters] = useState<DuplicateCluster[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  async function load() { setClusters(await obsApi.duplicates()); }
  useEffect(() => { load(); }, []);

  async function rejectExceptBest(cluster: DuplicateCluster) {
    setBusy(cluster.jobs[0].id);
    const keepId = cluster.jobs[0].id;
    for (const j of cluster.jobs) {
      if (j.id === keepId) continue;
      await api.setStatus(j.id, "rejected", "duplicate of #" + keepId);
    }
    await load();
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted">
        <Link href="/" className="hover:text-text">← Back to feed</Link>
      </div>
      <header>
        <h1 className="text-2xl font-semibold">Duplicates</h1>
        <p className="text-sm text-muted mt-1">
          Same posting found across multiple sources, grouped by company + normalized title + city. Keep the highest-scoring entry; reject the rest.
        </p>
      </header>
      {clusters.length === 0 ? (
        <div className="card text-muted">No duplicate clusters detected.</div>
      ) : (
        clusters.map((c) => (
          <section key={c.canonical_key} className="card">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="font-medium">
                {c.jobs[0].title} <span className="text-muted">— {c.jobs[0].company}, {c.jobs[0].location}</span>
              </div>
              <button onClick={() => rejectExceptBest(c)} disabled={busy === c.jobs[0].id} className="btn btn-danger">
                Reject all but the best ({c.count - 1})
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {c.jobs.map((j, idx) => (
                <Link key={j.id} href={`/jobs/${j.id}`} className={`block border rounded p-3 hover:border-accent ${idx === 0 ? "border-success" : "border-border"}`}>
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    {idx === 0 && <span className="chip border-success text-success">best</span>}
                    <span className="chip">{sourceLabel(j.source)}</span>
                    <span className="chip">{j.status}</span>
                    {j.match_score != null && <span className="text-warn">H{j.match_score}</span>}
                    {j.llm_score != null && <span className="text-accent">L{j.llm_score}</span>}
                  </div>
                  <div className="text-xs text-muted mt-1 break-all">{j.url}</div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
