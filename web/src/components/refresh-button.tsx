"use client";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Run = {
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  event: string;
} | null;

type Status = {
  configured: boolean;
  cooldownMin?: number;
  cooldownRemainingSec?: number;
  run?: Run;
};

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function RefreshButton() {
  const router = useRouter();
  const [st, setSt] = useState<Status | null>(null);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Poll status; keep polling every 12s while a run is active. When a run we
  // were watching completes, refresh the page data so new jobs appear.
  const load = useCallback(
    async (watching = false) => {
      try {
        const res = await fetch("/api/pipeline/status", { cache: "no-store" });
        if (!res.ok) return;
        const data: Status = await res.json();
        setSt(data);
        const active = data.run && data.run.status !== "completed";
        if (active) {
          timer.current = setTimeout(() => load(true), 12000);
        } else if (watching) {
          setNote(data.run?.conclusion === "success" ? "Done — data refreshed." : "Run finished; check Actions.");
          router.refresh();
        }
      } catch {
        /* transient network error — next poll or reload recovers */
      }
    },
    [router],
  );

  useEffect(() => {
    load();
    return () => clearTimeout(timer.current);
  }, [load]);

  const trigger = async () => {
    setModal(false);
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/pipeline/refresh", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNote("Queued…");
        timer.current = setTimeout(() => load(true), 6000);
      } else if (res.status === 429 && data.cooldownRemainingSec) {
        setNote(`Available in ${Math.ceil(data.cooldownRemainingSec / 60)}m`);
      } else {
        setNote(data.error ?? "Could not start refresh");
      }
    } catch {
      setNote("Could not start refresh");
    }
    setBusy(false);
  };

  if (!st || st.configured === false) return null;

  const run = st.run ?? null;
  const active = !!run && run.status !== "completed";
  const cooldown = st.cooldownRemainingSec ?? 0;
  const disabled = busy || active || cooldown > 0;
  const label = active ? (run!.status === "queued" ? "Queued…" : "Running…") : "Refresh now";

  return (
    <div className="flex items-center gap-3">
      <span className="t-muted hidden text-xs sm:inline">
        {note || (run && run.status === "completed" ? `Last run ${ago(run.updatedAt)}` : "")}
      </span>
      <button
        className="btn-ghost h-8 px-3 text-xs"
        disabled={disabled}
        title={cooldown > 0 && !active ? `Available in ${Math.ceil(cooldown / 60)}m` : "Sweep all boards for new jobs"}
        onClick={() => setModal(true)}
      >
        <RefreshCw size={13} className={active ? "animate-spin" : ""} />
        {label}
      </button>
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
          <div className="surface w-full max-w-sm rounded-xl p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-sm font-semibold">Run a full refresh?</h2>
            <p className="t-muted mb-4 text-xs leading-relaxed">
              This sweeps every board and rescoring takes ~10–20 minutes. It uses shared API credits, and everyone
              shares one refresh per {st.cooldownMin ?? 30} minutes.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost h-8 px-3 text-xs" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn-primary h-8 px-3 text-xs" onClick={trigger}>Refresh</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
