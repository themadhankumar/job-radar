"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircleMore, X } from "lucide-react";

const TYPES = [
  { key: "bug", label: "Bug" },
  { key: "idea", label: "Idea" },
  { key: "other", label: "Other" },
] as const;

export function FeedbackWidget({ loggedIn = false }: { loggedIn?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "idea" | "other">("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  function reset() {
    setOpen(false);
    setType("bug");
    setMessage("");
    setEmail("");
    setSent(false);
    setErr("");
  }

  async function submit() {
    if (!message.trim()) { setErr("Say a bit more first."); return; }
    setBusy(true);
    setErr("");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message, email: email || undefined, pagePath: pathname }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Couldn't send — try again.");
      return;
    }
    setSent(true);
    setTimeout(reset, 1800);
  }

  return (
    <>
      <button
        aria-label="Send feedback"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-white shadow-lg transition-all duration-200 hover:brightness-105 hover:shadow-[0_0_20px_rgb(var(--glow)/0.4)] sm:bottom-6 sm:right-6"
      >
        {open ? <X size={18} /> : <MessageCircleMore size={18} />}
      </button>

      {open && (
        <div className="animate-fade-in fixed bottom-20 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm sm:bottom-24 sm:right-6">
          <div className="surface rounded-2xl p-4 shadow-2xl">
            {sent ? (
              <p className="t-ok py-4 text-center text-sm font-medium">Thanks — got it.</p>
            ) : (
              <>
                <p className="mb-3 text-sm font-semibold">Report a bug, or tell me what you'd want</p>
                <div className="mb-3 flex gap-1.5">
                  {TYPES.map((t) => (
                    <button key={t.key} onClick={() => setType(t.key)}
                      className={`chip transition-colors duration-150 ${type === t.key ? "border-[rgb(var(--accent))] text-[rgb(var(--accent))]" : "t-muted"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={type === "bug" ? "What broke, and where?" : type === "idea" ? "What would help?" : "What's on your mind?"}
                  className="input mb-2 min-h-24 w-full text-sm"
                  autoFocus
                />
                {!loggedIn && (
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email (optional, if you want a reply)"
                    className="input mb-2 w-full text-sm"
                  />
                )}
                {err && <p className="t-danger mb-2 text-xs">{err}</p>}
                <div className="flex justify-end gap-2">
                  <button className="btn-ghost h-8 px-3 text-xs" onClick={reset}>Cancel</button>
                  <button className="btn-primary h-8 px-3 text-xs" disabled={busy} onClick={submit}>
                    {busy ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
