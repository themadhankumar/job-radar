"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";

type Phase = "url" | "paste" | "busy";

export function AddByUrl() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("url");
  const [url, setUrl] = useState("");
  const [jd, setJd] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  function reset() {
    setOpen(false);
    setPhase("url");
    setUrl("");
    setJd("");
    setNote("");
    setErr("");
  }

  async function submit(withPaste: boolean) {
    setErr("");
    setPhase("busy");
    try {
      const res = await fetch("/api/jobs/add-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withPaste ? { url, pastedJd: jd } : { url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Something went wrong — try again.");
        setPhase(withPaste ? "paste" : "url");
        return;
      }
      if (data.needsPaste) {
        setNote(data.reason ?? "Paste the job description below.");
        setPhase("paste");
        return;
      }
      reset();
      router.refresh();
    } catch {
      setErr("Network error — try again.");
      setPhase(withPaste ? "paste" : "url");
    }
  }

  return (
    <>
      <button className="btn-ghost h-8 px-3 text-xs" onClick={() => setOpen(true)}>
        <Link2 size={13} /> Add by URL
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={reset}>
          <div className="surface w-full max-w-md rounded-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-sm font-semibold">Add a job by URL</h2>
            <p className="t-muted mb-4 text-xs leading-relaxed">
              {phase === "paste"
                ? note
                : "Paste any posting link. Greenhouse, Lever, and Ashby parse instantly; other pages are read when possible. It lands on your Tracked tab — match % follows on the next sweep."}
            </p>
            <div className="space-y-3">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://boards.greenhouse.io/…"
                className="input w-full"
                disabled={phase !== "url"}
                onKeyDown={(e) => e.key === "Enter" && url.trim() && phase === "url" && submit(false)}
                autoFocus
              />
              {phase === "paste" && (
                <textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the full job description here…"
                  className="input min-h-40 w-full text-sm"
                  autoFocus
                />
              )}
              {err && <p className="t-danger text-xs">{err}</p>}
              <div className="flex justify-end gap-2">
                <button className="btn-ghost h-8 px-3 text-xs" onClick={reset}>Cancel</button>
                {phase === "paste" ? (
                  <button className="btn-primary h-8 px-3 text-xs" disabled={jd.trim().length < 100} onClick={() => submit(true)}>
                    Add job
                  </button>
                ) : (
                  <button className="btn-primary h-8 px-3 text-xs" disabled={phase === "busy" || !url.trim()} onClick={() => submit(false)}>
                    {phase === "busy" ? "Reading…" : "Add job"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
