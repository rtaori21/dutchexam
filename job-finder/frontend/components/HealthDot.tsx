"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obsApi, type Health } from "@/lib/observability";

export default function HealthDot() {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await obsApi.health();
        if (alive) setH(r);
      } catch {
        if (alive) setH(null);
      }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const color = !h ? "bg-muted" : h.overall === "ok" ? "bg-success" : h.overall === "warn" ? "bg-warn" : "bg-danger";
  const tip = !h
    ? "Backend unreachable"
    : `LLM ${h.llm.ok ? "ok" : "down"}, ${h.sources_total} sources (${h.sources_error} errored), Telegram ${h.telegram_configured ? "on" : "off"}`;

  return (
    <Link href="/observability" title={tip} className="flex items-center gap-1.5 text-xs text-muted hover:text-text">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span>{!h ? "—" : h.overall}</span>
    </Link>
  );
}
