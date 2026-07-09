"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import type { ProfileData } from "@/db/schema";

function ChipEditor(props: {
  label: string;
  values: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (!props.values.some((x) => x.toLowerCase() === v.toLowerCase())) props.onChange([...props.values, v]);
    setDraft("");
  }
  return (
    <div>
      <p className="t-muted mb-1.5 text-xs font-medium uppercase tracking-wide">{props.label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {props.values.map((v) => (
          <span key={v} className="chip inline-flex items-center gap-1">
            {v}
            <button aria-label={`Remove ${v}`} onClick={() => props.onChange(props.values.filter((x) => x !== v))}
              className="t-muted hover:text-red-400"><X size={11} /></button>
          </span>
        ))}
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={props.placeholder}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); } }}
          onBlur={commit}
          className="input h-7 w-40 text-xs" />
      </div>
    </div>
  );
}

export function ProfileManager() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [hasResume, setHasResume] = useState(false);
  const [edited, setEdited] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "parse">("");
  const [msg, setMsg] = useState("");

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(""), 4000);
  }

  async function load() {
    const res = await fetch("/api/profile");
    const data = await res.json().catch(() => ({}));
    setProfile(data.profile?.data ?? null);
    setEdited(Boolean(data.profile?.edited));
    setHasResume(Boolean(data.resume));
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  function patch(p: Partial<ProfileData>) {
    setProfile((cur) => ({ ...(cur as ProfileData), ...p }));
    setDirty(true);
  }

  async function save() {
    if (!profile) return;
    setBusy("save");
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: profile }),
    });
    setBusy("");
    if (!res.ok) return flash("Save failed — try again.");
    setDirty(false);
    setEdited(true);
    flash("Profile saved — scores refresh on the next sweep.");
  }

  async function reparse() {
    if (edited && !confirm("Re-parsing replaces your hand edits with a fresh parse of the stored resume. Continue?")) return;
    setBusy("parse");
    const res = await fetch("/api/profile", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return flash(data.error ?? "Parse failed — try again.");
    setProfile(data.data);
    setEdited(false);
    setDirty(false);
    flash("Profile re-parsed from your resume.");
  }

  if (!loaded) return <p className="t-muted text-sm">Loading…</p>;

  return (
    <section className="surface rounded-xl p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Parsed profile {edited && <span className="chip ml-1">hand-edited</span>}</h2>
          <p className="t-muted text-xs">Everything below feeds match scores and suggestions.</p>
        </div>
        {hasResume && (
          <button className="btn-ghost text-xs" disabled={busy === "parse"} onClick={reparse}>
            <RefreshCw size={13} className={busy === "parse" ? "animate-spin" : ""} /> {busy === "parse" ? "Parsing…" : "Re-parse"}
          </button>
        )}
      </div>

      {!profile ? (
        <div className="t-muted flex items-center gap-2 text-sm">
          <Sparkles size={14} />
          {hasResume ? "No profile yet — hit Re-parse to generate one from your resume." : "Upload a resume on the Resume tab to generate your profile."}
        </div>
      ) : (
        <div className="space-y-4">
          <ChipEditor label="Skills" values={profile.skills} placeholder="add skill ⏎"
            onChange={(v) => patch({ skills: v })} />
          <ChipEditor label="Titles" values={profile.titles} placeholder="add title ⏎"
            onChange={(v) => patch({ titles: v })} />
          <ChipEditor label="Industries" values={profile.industries} placeholder="add industry ⏎"
            onChange={(v) => patch({ industries: v })} />
          <div className="flex flex-wrap gap-4">
            <label className="text-xs">
              <span className="t-muted mb-1.5 block font-medium uppercase tracking-wide">Years of experience</span>
              <input type="number" min={0} max={60} step={0.5} className="input w-28"
                value={profile.yoe ?? ""} placeholder="e.g. 2"
                onChange={(e) => patch({ yoe: e.target.value === "" ? null : Math.max(0, Math.min(60, parseFloat(e.target.value))) })} />
            </label>
            <label className="min-w-40 text-xs">
              <span className="t-muted mb-1.5 block font-medium uppercase tracking-wide">Seniority</span>
              <select className="input" value={profile.seniority}
                onChange={(e) => patch({ seniority: e.target.value })}>
                {["", "intern", "junior", "mid", "senior", "staff", "manager", "director", "exec"].map((s) => (
                  <option key={s} value={s}>{s || "—"}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs">
            <span className="t-muted mb-1.5 block font-medium uppercase tracking-wide">Summary</span>
            <textarea className="input min-h-20 w-full" value={profile.summary} rows={3}
              onChange={(e) => patch({ summary: e.target.value })} />
          </label>
          <div className="flex items-center gap-3">
            <button className="btn-primary text-sm" disabled={!dirty || busy === "save"} onClick={save}>
              {busy === "save" ? "Saving…" : "Save profile"}
            </button>
            {dirty && <span className="t-muted text-xs">Unsaved changes</span>}
          </div>
        </div>
      )}

      {msg && <p className="t-accent mt-3 text-sm">{msg}</p>}
    </section>
  );
}
