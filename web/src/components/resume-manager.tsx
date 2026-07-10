"use client";
import { useEffect, useRef, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";

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

export function ResumeManager() {
  const [resume, setResume] = useState<ResumeMeta | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<"" | "upload">("");
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
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

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
        ? "Resume replaced and profile re-parsed — see the Profile tab."
        : data.profileStale
          ? "Resume replaced. Your profile has hand edits, so it wasn't overwritten — use Re-parse on the Profile tab if you want a fresh one."
          : "Resume replaced.",
    );
    load();
  }

  if (!loaded) return <p className="t-muted text-sm">Loading…</p>;

  return (
    <div className="space-y-5">
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
          <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[rgb(var(--hairline)/0.10)] bg-[rgb(var(--surface-2))] p-3 text-xs leading-relaxed">
            {resume.preview}{resume.chars > resume.preview.length ? "\n…" : ""}
          </pre>
        )}
      </section>

      {msg && <p className="t-accent text-sm">{msg}</p>}
    </div>
  );
}
