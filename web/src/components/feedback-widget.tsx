"use client";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircleMore, Paperclip, X } from "lucide-react";

const TYPES = [
  { key: "bug", label: "Bug" },
  { key: "idea", label: "Idea" },
  { key: "other", label: "Other" },
] as const;

const MAX_DIM = 1400;
async function downscaleImage(file: File): Promise<{ base64: string; mime: string; previewUrl: string }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return { base64: dataUrl.split(",")[1], mime: "image/jpeg", previewUrl: dataUrl };
}

export function FeedbackWidget({ loggedIn = false }: { loggedIn?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "idea" | "other">("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [image, setImage] = useState<{ base64: string; mime: string; previewUrl: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setOpen(false);
    setType("bug");
    setMessage("");
    setEmail("");
    setSent(false);
    setErr("");
    setImage(null);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("That's not an image."); return; }
    try {
      setImage(await downscaleImage(file));
    } catch {
      setErr("Couldn't read that image — try another.");
    }
  }

  async function submit() {
    if (!message.trim()) { setErr("Say a bit more first."); return; }
    setBusy(true);
    setErr("");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type, message, email: email || undefined, pagePath: pathname,
        imageB64: image?.base64, imageMime: image?.mime,
      }),
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
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
                {image ? (
                  <div className="relative mb-2 inline-block">
                    <img src={image.previewUrl} alt="Screenshot preview" className="h-16 rounded-md border border-[rgb(var(--border))] object-cover" />
                    <button aria-label="Remove screenshot" onClick={() => setImage(null)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))] shadow hover:text-[rgb(var(--danger))]">
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} className="chip t-muted mb-2 transition-colors duration-150 hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]">
                    <Paperclip size={12} /> Attach a screenshot
                  </button>
                )}
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
