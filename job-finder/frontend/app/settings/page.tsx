"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { profileApi, type Profile } from "@/lib/profile";

function ChipMultiselect({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const set = useMemo(() => new Set(selected), [selected]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = set.has(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() =>
              onChange(on ? selected.filter((x) => x !== o) : [...selected, o])
            }
            className={`chip ${on ? "border-accent text-accent" : ""}`}
          >
            {on ? "✓ " : ""}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function ListEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm"
        />
        <button onClick={add} className="btn">Add</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="chip flex items-center gap-2">
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-muted hover:text-danger"
              aria-label={`remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setProfile(await profileApi.get());
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const next = await profileApi.patch(patch);
      // Profile shape from PATCH is the full underlying YAML; re-fetch to get
      // the API-shaped object including available_countries.
      await load();
      setMsg("Saved.");
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <div className="card text-muted">Loading…</div>;

  const lf = profile.location_filter;
  const roles = profile.target_roles;
  const js = profile.scrapers.jobspy;

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted">
        <Link href="/" className="hover:text-text">← Back to feed</Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted mt-1">
          Edit countries, cities, search terms, and matcher weights. Saved to{" "}
          <code>config/search_profile.yml</code>. Changes apply to the next scrape pass —
          existing jobs aren't re-scored automatically.
        </p>
        {msg && <div className="text-success text-sm mt-2">{msg}</div>}
        {err && <div className="text-danger text-sm mt-2">{err}</div>}
      </header>

      {/* Locations */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Where you'll work</h2>
        <p className="text-xs text-muted">
          Jobs outside these countries/cities are filtered out unless they're remote and
          "Allow remote" is on. Strict mode also drops postings with no detectable location.
        </p>

        <div>
          <div className="text-sm font-medium mb-2">Countries</div>
          <ChipMultiselect
            options={profile.available_countries}
            selected={lf.countries}
            onChange={(countries) => save({ location_filter: { ...lf, countries } })}
          />
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Cities (matched as substrings of the job's location)</div>
          <ListEditor
            values={lf.cities}
            placeholder="e.g. Amsterdam"
            onChange={(cities) => save({ location_filter: { ...lf, cities } })}
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lf.allow_remote}
              onChange={(e) =>
                save({ location_filter: { ...lf, allow_remote: e.target.checked } })
              }
            />
            Allow remote postings (any region)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lf.strict}
              onChange={(e) => save({ location_filter: { ...lf, strict: e.target.checked } })}
            />
            Strict mode (drop unknown locations)
          </label>
        </div>
      </section>

      {/* Roles */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Roles you're targeting</h2>
        <p className="text-xs text-muted">
          Primary titles get the full match score; secondary titles get 60% of it.
          Scraper search terms are what the system actually queries on LinkedIn/Indeed.
        </p>

        <div>
          <div className="text-sm font-medium mb-2">Primary titles (full match score)</div>
          <ListEditor
            values={roles.primary}
            placeholder="e.g. Director Data Science"
            onChange={(primary) => save({ target_roles: { ...roles, primary } })}
          />
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Secondary titles (partial match)</div>
          <ListEditor
            values={roles.secondary}
            placeholder="e.g. Lead Data Scientist"
            onChange={(secondary) => save({ target_roles: { ...roles, secondary } })}
          />
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Scraper search terms (LinkedIn/Indeed query strings)</div>
          <ListEditor
            values={js.search_terms}
            placeholder="e.g. Head of AI"
            onChange={(search_terms) => save({ search_terms })}
          />
        </div>
      </section>

      {/* Filters */}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Excludes</h2>
        <div>
          <div className="text-sm font-medium mb-2">Title blocklist (any of these → drop)</div>
          <ListEditor
            values={profile.filters.exclude_titles}
            placeholder="e.g. Junior"
            onChange={(exclude_titles) =>
              save({ filters: { ...profile.filters, exclude_titles } })
            }
          />
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Company blocklist</div>
          <ListEditor
            values={profile.filters.exclude_companies}
            placeholder="e.g. Crypto-Co"
            onChange={(exclude_companies) =>
              save({ filters: { ...profile.filters, exclude_companies } })
            }
          />
        </div>
      </section>

      {/* Scoring */}
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Match scoring weights</h2>
        <p className="text-xs text-muted">
          Total adds up to 100. Higher weight on a dimension makes it count more.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(profile.scoring.weights).map(([k, v]) => (
            <label key={k} className="text-sm">
              <span className="text-muted">{k}</span>
              <input
                type="number"
                value={v}
                min={0}
                max={100}
                onChange={(e) => {
                  const next = { ...profile.scoring.weights, [k]: Number(e.target.value) };
                  save({ scoring: { ...profile.scoring, weights: next } });
                }}
                className="ml-2 w-20 bg-bg border border-border rounded px-2 py-1"
              />
            </label>
          ))}
        </div>
      </section>

      <div className="text-xs text-muted text-right">
        {saving ? "Saving…" : "Auto-saves on every change"}
      </div>
    </div>
  );
}
