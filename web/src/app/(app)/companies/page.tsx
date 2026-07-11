"use client";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

type Company = { id: number; name: string; ats: string };
type Mine = { companyId: number; list: string };

export default function CompaniesPage() {
  const [all, setAll] = useState<Company[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [suggestions, setSuggestions] = useState<{ name: string; reason: string }[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  async function suggest() {
    setSuggesting(true);
    setMsg("");
    const res = await fetch("/api/companies/suggest", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSuggesting(false);
    if (!res.ok) { setMsg(data.error ?? "Suggestions failed — try again."); return; }
    setSuggestions(data.suggestions ?? []);
  }

  async function load() {
    const d = await fetch("/api/companies").then((r) => r.json());
    setAll(d.all ?? []);
    setMine(d.mine ?? []);
  }
  useEffect(() => { load(); }, []);

  const tracked = all.filter((c) => mine.some((m) => m.companyId === c.id));
  const available = all.filter((c) => !mine.some((m) => m.companyId === c.id));

  async function add(name: string, companyId?: number) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, companyId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(data.error ?? "Could not add that company."); return; }
    if (!companyId) setMsg(data.ats === "linkedin" ? `${name}: no public job board found — covered via the LinkedIn feed.` : `${name}: ${data.ats} board detected ✓${data.jobsFetched ? ` — ${data.jobsFetched} postings pulled into your radar now` : ""}`);
    else setMsg(data.jobsFetched ? `${name}: ${data.jobsFetched} new postings pulled into your radar now.` : `${name} added — postings appear after the next sweep (already-known ones are there now).`);
    setInput("");
    load();
  }

  async function remove(companyId: number) {
    await fetch("/api/companies", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Companies</h1>
      <p className="t-muted mb-6 text-sm">Your watchlist drives what the radar fetches. Add anything — the job board is detected automatically.</p>

      <div className="mb-6 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add a company (e.g. Databricks)"
          className="input" onKeyDown={(e) => e.key === "Enter" && input.trim() && add(input.trim())} />
        <button className="btn-primary" disabled={busy || !input.trim()} onClick={() => add(input.trim())}>
          {busy ? "Detecting…" : "Add"}
        </button>
      </div>
      {msg && <p className="t-accent -mt-4 mb-4 text-sm">{msg}</p>}

      <section className="surface mb-6 rounded-xl p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">✦ Suggest companies</h2>
            <p className="t-muted text-xs">Based on your resume profile and current watchlist.</p>
          </div>
          <button className="btn-ghost text-xs" disabled={suggesting} onClick={suggest}>
            {suggesting ? "Thinking…" : suggestions.length ? "Refresh" : "Suggest"}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="mt-3 space-y-2">
            {suggestions.map((sg) => (
              <div key={sg.name} className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--border))] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{sg.name}</p>
                  <p className="t-muted truncate text-xs">{sg.reason}</p>
                </div>
                <button className="btn-ghost shrink-0 text-xs" disabled={busy}
                  onClick={() => { add(sg.name); setSuggestions((x) => x.filter((y) => y.name !== sg.name)); }}>
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface mb-6 rounded-xl">
        <h2 className="t-muted border-b border-[rgb(var(--hairline)/0.10)] px-4 py-2.5 text-xs font-medium uppercase tracking-wide">
          Watching ({tracked.length})
        </h2>
        {tracked.length === 0 && <p className="t-muted p-4 text-sm">Nothing yet — add a company above or pick from the registry below.</p>}
        {tracked.map((c) => (
          <div key={c.id} className="flex items-center justify-between border-b border-[rgb(var(--hairline)/0.10)] px-4 py-2.5 last:border-0">
            <span className="text-sm font-medium">{c.name} <span className="chip t-muted ml-2">{c.ats}</span></span>
            <button aria-label={`Stop watching ${c.name}`} className="t-muted rounded p-1.5 transition-colors duration-150 hover:text-[rgb(var(--danger))]" onClick={() => remove(c.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>

      {available.length > 0 && (
        <section>
          <h2 className="t-muted mb-2 text-xs font-medium uppercase tracking-wide">From the shared registry</h2>
          <div className="flex flex-wrap gap-1.5">
            {available.map((c) => (
              <button key={c.id} className="chip t-muted border-dashed transition-colors duration-150 hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]" onClick={() => add(c.name, c.id)}>
                + {c.name}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
