"use client";
import { useEffect, useRef, useState } from "react";
import { Download, FileText, RefreshCw, Sparkles, Upload, X } from "lucide-react";
import type { ProfileData } from "@/db/schema";

type ResumeMeta = {
  filename: string;
  kind: string;
  updatedAt: string;
  chars: number;
  preview: string;
  hasOriginal: boolean;
};

const KIND_NOTE: Record<string, string> = {
  tex: "LaTeX source stored — Studio exports a tailored .tex with your formatting intact.",
  docx: "Original stored — Studio exports a tailored .docx with your formatting intact.",
  pdf: "Only extracted text is kept for PDFs — upload your .tex or .docx for format-preserving exports.",
  txt: "Plain text stored — Studio exports a clean tailored .docx.",
};

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

export function ResumeManager() {
  const [resume, setResume] = useState<ResumeMeta | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [edited, setEdited] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "upload" | "save" | "parse">("");
  const [msg, setMsg] = useState("");
  const [showText, setShowText] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(""), 4000);
  }

  async function load() {
    const res = await fetch("/api/profile");
    const data = await res.json().catch(() => ({}));
    setResume(data.resume ?? null);
    setProfile(data.profile?.data ?? null);
    setEdited(Boolean(data.profile?.edited));
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  function patch(p: Partial<ProfileData>) {
    setProfile((cur) => ({ ...(cur as ProfileData), ...p }));
    setDirty(true);
  }

  async function upload(file: File) {
    if (resume && !confirm(`Replace "${resume.filename}" as your base resume? Studio exports and match scores will use the new one.`)) return;
    setBusy("upload");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/resume", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return flash(data.error ?? "Upload failed — try again.");
    flash(
      data.profileUpdated
        ? "Resume replaced and profile re-parsed."
        : data.profileStale
          ? "Resume replaced. Your profile has hand edits, so it wasn't overwritten — use Re-parse if you want a fresh one."
          : "Resume replaced.",
    );
    setDirty(false);
    load();
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
    <div className="space-y-5">
      {/* base resume card */}
      <section className="surface rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText size={18} className="t-muted shrink-0" />
            {resume ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{resume.filename} <span className="chip ml-1">{resume.kind}</span></p>
                <p className="t-muted text-xs">
                  {resume.chars.toLocaleString()} characters extracted · updated {new Date(resume.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <p className="t-muted text-sm">No resume uploaded yet.</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {resume && (
              <a href="/api/resume/file" className="btn-ghost text-xs"><Download size={13} /> Download</a>
            )}
            <button className="btn-ghost text-xs" disabled={busy === "upload"} onClick={() => fileRef.current?.click()}>
              <Upload size={13} /> {busy === "upload" ? "Uploading…" : resume ? "Replace" : "Upload"}
            </button>
            <input ref={fileRef} type="file" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </div>
        </div>
        {resume && <p className="t-muted mt-3 text-xs">{KIND_NOTE[resume.kind] ?? ""}</p>}
        {resume && (
          <button className="t-accent mt-2 text-xs underline-offset-2 hover:underline" onClick={() => setShowText((s) => !s)}>
            {showText ? "Hide extracted text" : "Show extracted text (what the matcher and Studio actually see)"}
          </button>
        )}
        {resume && showText && (
          <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-xs leading-relaxed">
            {resume.preview}{resume.chars > resume.preview.length ? "\n…" : ""}
          </pre>
        )}
      </section>

      {/* parsed profile */}
      <section className="surface rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Parsed profile {edited && <span className="chip ml-1">hand-edited</span>}</h2>
            <p className="t-muted text-xs">Everything below feeds match scores and suggestions.</p>
          </div>
          {resume && (
            <button className="btn-ghost text-xs" disabled={busy === "parse"} onClick={reparse}>
              <RefreshCw size={13} className={busy === "parse" ? "animate-spin" : ""} /> {busy === "parse" ? "Parsing…" : "Re-parse"}
            </button>
          )}
        </div>

        {!profile ? (
          <div className="t-muted flex items-center gap-2 text-sm">
            <Sparkles size={14} />
            {resume ? "No profile yet — hit Re-parse to generate one from your resume." : "Upload a resume to generate your profile."}
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
      </section>

      {msg && <p className="t-accent text-sm">{msg}</p>}
    </div>
  );
}
