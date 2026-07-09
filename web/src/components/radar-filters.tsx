"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, X } from "lucide-react";

type Preset = { id: number; name: string; params: Record<string, string> };

const LAST_KEY = "radar:lastFilters";

export function RadarFilters({ tab, q, days, status }: { tab: string; q: string; days: number; status: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(q);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saving, setSaving] = useState(false);
  const restored = useRef(false);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/radar?${next.toString()}`);
  }

  // auto-remember: restore last filters when arriving bare, persist on change
  useEffect(() => {
    if (!restored.current) {
      restored.current = true;
      if (params.toString() === "") {
        try {
          const saved = localStorage.getItem(LAST_KEY);
          if (saved) {
            router.replace(`/radar?${saved}`);
            return;
          }
        } catch { /* private mode etc. */ }
      }
    }
    try {
      localStorage.setItem(LAST_KEY, params.toString());
    } catch { /* ignore */ }
  }, [params, router]);

  // Debounced search — applies as you type, Enter still applies instantly.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const t = setTimeout(() => setParam("q", search), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    fetch("/api/presets").then((r) => r.json()).then((d) => setPresets(d.presets ?? [])).catch(() => {});
  }, []);

  async function savePreset() {
    const name = prompt('Name this preset (e.g. "US PM roles"):')?.trim();
    if (!name) return;
    setSaving(true);
    const current: Record<string, string> = {};
    for (const [k, v] of params.entries()) if (v) current[k] = v;
    const res = await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, params: current }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && data.preset) {
      setPresets((p) => [...p.filter((x) => x.name !== data.preset.name), data.preset]);
    } else if (data.error) {
      alert(data.error);
    }
  }

  async function deletePreset(id: number) {
    setPresets((p) => p.filter((x) => x.id !== id));
    await fetch("/api/presets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  function applyPreset(p: Preset) {
    router.push(`/radar?${new URLSearchParams(p.params).toString()}`);
    setSearch(p.params.q ?? "");
  }

  const isActive = (p: Preset) => {
    const cur = new URLSearchParams(params.toString());
    const mine = new URLSearchParams(p.params);
    cur.sort();
    mine.sort();
    return cur.toString() === mine.toString();
  };

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="surface flex rounded-md p-0.5">
          {(["tracked", "suggested", "global"] as const).map((t) => (
            <button key={t} onClick={() => setParam("tab", t === "tracked" ? "" : t)}
              className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-[rgb(var(--accent))] text-white dark:text-zinc-900" : "t-muted"}`}>
              {t}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setParam("q", search)}
          placeholder="Search title, company, location…"
          className="input max-w-xs"
        />
        <select value={String(days)} onChange={(e) => setParam("days", e.target.value)} className="input w-auto">
          <option value="0">Any date</option>
          <option value="1">Past day</option>
          <option value="7">Past week</option>
          <option value="14">Past 2 weeks</option>
          <option value="30">Past month</option>
          <option value="90">Past 3 months</option>
        </select>
        <select value={status} onChange={(e) => setParam("status", e.target.value)} className="input w-auto">
          <option value="">All statuses</option>
          {["new", "reviewing", "applied", "interviewing", "offer", "rejected", "skipped"].map((s) => (
            <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <button onClick={savePreset} disabled={saving} title="Save current filters as a preset" className="btn-ghost text-xs">
          <BookmarkPlus size={13} /> Save preset
        </button>
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="t-muted text-xs">Presets:</span>
          {presets.map((p) => (
            <span key={p.id}
              className={`chip inline-flex cursor-pointer items-center gap-1 text-xs ${isActive(p) ? "t-accent border-[rgb(var(--accent))]" : ""}`}>
              <button onClick={() => applyPreset(p)}>{p.name}</button>
              <button aria-label={`Delete preset ${p.name}`} onClick={() => deletePreset(p.id)} className="t-muted hover:text-red-400">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
