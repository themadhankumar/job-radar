"use client";
import { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

/* Shared type-ahead for adding companies. As the user types, it filters a
   provided registry live and shows matches; if nothing matches exactly, it
   offers to add the typed name as a custom company (which flows through ATS
   detection upstream). Used by both the Companies page and onboarding. */

export type RegistryItem = { id?: number; name: string; ats?: string };

export function CompanyTypeahead({
  registry,
  onPickRegistry,
  onAddCustom,
  busy = false,
  placeholder = "Add a company (e.g. Databricks)",
}: {
  registry: RegistryItem[];
  onPickRegistry: (item: RegistryItem) => void;
  onAddCustom: (name: string) => void;
  busy?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const query = q.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!query) return [];
    return registry
      .filter((r) => r.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [query, registry]);

  const exact = registry.some((r) => r.name.toLowerCase() === query);
  const showAddCustom = query.length > 0 && !exact;

  function pick(item: RegistryItem) {
    onPickRegistry(item);
    setQ("");
    setOpen(false);
  }
  function addCustom() {
    if (!q.trim()) return;
    onAddCustom(q.trim());
    setQ("");
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="input"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches.length === 1) pick(matches[0]);
              else if (showAddCustom) addCustom();
            }
          }}
        />
        <button className="btn-primary" disabled={busy || !q.trim()} onClick={() => (matches.length === 1 ? pick(matches[0]) : addCustom())}>
          {busy ? "Detecting…" : "Add"}
        </button>
      </div>

      {open && query.length > 0 && (matches.length > 0 || showAddCustom) && (
        <div className="surface absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg p-1 shadow-xl">
          {matches.map((m) => (
            <button
              key={m.id ?? m.name}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-[rgb(var(--surface-2))]"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(m)}
            >
              <span className="truncate font-medium">{m.name}</span>
              {m.ats && <span className="chip t-muted shrink-0 text-[11px]">{m.ats}</span>}
            </button>
          ))}
          {showAddCustom && (
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[rgb(var(--accent))] transition-colors duration-150 hover:bg-[rgb(var(--surface-2))]"
              onMouseDown={(e) => e.preventDefault()}
              onClick={addCustom}
            >
              <Plus size={14} className="shrink-0" />
              <span className="truncate">Add &ldquo;{q.trim()}&rdquo; — not in our list</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
