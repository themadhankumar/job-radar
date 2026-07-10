"use client";
import { useState } from "react";
import { Sparkles, X } from "lucide-react";

type Scope = "tracked" | "global";
type Kind = "include" | "exclude";
type KW = { id: number; keyword: string; kind: Kind; scope: Scope };
type Suggestion = { role: string; reason: string };

export function RolesManager({ initial }: { initial: KW[] }) {
  const [items, setItems] = useState<KW[]>(initial);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const group = (scope: Scope, kind: Kind) =>
    items.filter((i) => i.scope === scope && i.kind === kind);

  async function add(scope: Scope, kind: Kind, raw: string) {
    const keyword = raw.trim().toLowerCase();
    if (!keyword) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, scope, kind }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error ?? "Couldn't add that.");
      return;
    }
    setItems((p) => (p.some((i) => i.id === data.id) ? p : [...p, { id: data.id, keyword: data.keyword, kind, scope }]));
  }

  async function remove(id: number) {
    setItems((p) => p.filter((i) => i.id !== id));
    await fetch("/api/keywords", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function suggest() {
    setSuggesting(true);
    setErr("");
    const res = await fetch("/api/roles/suggest", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSuggesting(false);
    if (!res.ok) {
      setErr(data.error ?? "Couldn't suggest roles.");
      return;
    }
    setSuggestions(data.suggestions ?? []);
  }

  async function accept(scope: Scope, role: string) {
    setSuggestions((p) => p.filter((s) => s.role !== role));
    await add(scope, "include", role);
  }

  return (
    <div>
      {err && <p className="t-danger mb-3 text-sm">{err}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Tracked roles" subtitle="Filters jobs from your watchlist companies" scope="tracked" group={group} add={add} remove={remove} busy={busy} />
        <Panel title="Global roles" subtitle="Filters discovery across all other companies" scope="global" group={group} add={add} remove={remove} busy={busy} />
      </div>
      <p className="t-muted mt-2 text-xs">
        Global falls back to your Tracked roles until you add Global-specific ones. The Suggested
        tab is driven by your resume match, not these keywords.
      </p>

      <div className="mt-6">
        <button onClick={suggest} disabled={suggesting} className="btn-ghost text-sm">
          <Sparkles size={14} /> {suggesting ? "Thinking…" : "Suggest roles"}
        </button>
        {suggestions.length > 0 && (
          <ul className="mt-3 space-y-2">
            {suggestions.map((s) => (
              <li key={s.role} className="surface flex items-center justify-between gap-3 rounded-lg p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium capitalize">{s.role}</p>
                  <p className="t-muted text-xs">{s.reason}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => accept("tracked", s.role)} className="btn-ghost text-xs">+ Tracked</button>
                  <button onClick={() => accept("global", s.role)} className="btn-ghost text-xs">+ Global</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Panel({
  title, subtitle, scope, group, add, remove, busy,
}: {
  title: string;
  subtitle: string;
  scope: Scope;
  group: (scope: Scope, kind: Kind) => KW[];
  add: (scope: Scope, kind: Kind, raw: string) => void;
  remove: (id: number) => void;
  busy: boolean;
}) {
  return (
    <div className="surface rounded-xl p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="t-muted mb-3 text-xs">{subtitle}</p>
      <ChipList
        label="Match roles"
        items={group(scope, "include")}
        onAdd={(k) => add(scope, "include", k)}
        onRemove={remove}
        busy={busy}
        placeholder="e.g. data product manager"
      />
      <div className="mt-3">
        <ChipList
          label="Exclude titles containing"
          items={group(scope, "exclude")}
          onAdd={(k) => add(scope, "exclude", k)}
          onRemove={remove}
          busy={busy}
          placeholder="e.g. senior director"
        />
      </div>
    </div>
  );
}

function ChipList({
  label, items, onAdd, onRemove, busy, placeholder,
}: {
  label: string;
  items: KW[];
  onAdd: (keyword: string) => void;
  onRemove: (id: number) => void;
  busy: boolean;
  placeholder: string;
}) {
  const [val, setVal] = useState("");
  return (
    <div>
      <p className="t-muted mb-1.5 text-xs font-medium">{label}</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {items.length === 0 && <span className="t-muted text-xs">None yet.</span>}
        {items.map((i) => (
          <span key={i.id} className="chip inline-flex items-center gap-1 text-xs">
            {i.keyword}
            <button aria-label={`Remove ${i.keyword}`} onClick={() => onRemove(i.id)} className="t-muted transition-colors duration-150 hover:text-[rgb(var(--danger))]">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd(val);
            setVal("");
          }
        }}
        disabled={busy}
        placeholder={placeholder}
        className="input w-full text-sm"
      />
    </div>
  );
}
