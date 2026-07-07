"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Send, Sparkles } from "lucide-react";

type Msg = { id?: number; role: "user" | "assistant"; content: string };
type ThreadInfo = {
  threadId: number;
  messages: { id: number; role: "user" | "assistant"; content: string; tokensIn: number; tokensOut: number }[];
  usage: { tokensIn: number; tokensOut: number };
  resumeKind: string;
  hasOriginal: boolean;
};

const GAP_LABEL = "__gap_analysis__";

function exportHint(kind: string, hasOriginal: boolean): string {
  if (kind === "tex" && hasOriginal) return "Exports a tailored .tex — recompile for a pixel-perfect PDF.";
  if (kind === "docx" && hasOriginal) return "Exports your .docx with tailored content, formatting intact.";
  return "Exports a clean tailored .docx. Upload a .tex or .docx in Settings for format-preserving exports.";
}

export function Studio({ jobId }: { jobId: number }) {
  const [thread, setThread] = useState<ThreadInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [threadTokens, setThreadTokens] = useState({ in: 0, out: 0 });
  const [exporting, setExporting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const bootstrappedRef = useRef(false);

  const scrollDown = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  const streamTurn = useCallback(async (threadId: number, body: object) => {
    setStreaming(true);
    setPartial("");
    let acc = "";
    try {
      const res = await fetch(`/api/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Request failed — try again.");
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          let evt: any;
          try { evt = JSON.parse(line.slice(5)); } catch { continue; }
          if (evt.type === "delta") {
            acc += evt.text;
            setPartial(acc);
          } else if (evt.type === "done") {
            setThreadTokens((t) => ({ in: t.in + (evt.tokensIn ?? 0), out: t.out + (evt.tokensOut ?? 0) }));
          } else if (evt.type === "error") {
            setError(evt.message ?? "Something went wrong.");
          }
        }
      }
      if (acc) setMsgs((m) => [...m, { role: "assistant", content: acc }]);
    } catch {
      setError("Connection dropped — try again.");
    } finally {
      setPartial("");
      setStreaming(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Couldn't open Studio.");
        return;
      }
      const t = data as ThreadInfo;
      setThread(t);
      setMsgs(t.messages.filter((m) => m.content !== GAP_LABEL));
      setThreadTokens({
        in: t.messages.reduce((s, m) => s + m.tokensIn, 0),
        out: t.messages.reduce((s, m) => s + m.tokensOut, 0),
      });
      if (t.messages.length === 0 && !bootstrappedRef.current) {
        bootstrappedRef.current = true;
        streamTurn(t.threadId, { bootstrap: true });
      }
    })();
    return () => { cancelled = true; };
  }, [jobId, streamTurn]);

  useEffect(scrollDown, [msgs, partial]);

  async function send() {
    const text = input.trim();
    if (!text || !thread || streaming) return;
    setInput("");
    setError(null);
    setMsgs((m) => [...m, { role: "user", content: text }]);
    await streamTurn(thread.threadId, { content: text });
  }

  async function exportResume() {
    if (!thread || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/threads/${thread.threadId}/export`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Export failed.");
        return;
      }
      const tin = Number(res.headers.get("X-Tokens-In") ?? 0);
      const tout = Number(res.headers.get("X-Tokens-Out") ?? 0);
      setThreadTokens((t) => ({ in: t.in + tin, out: t.out + tout }));
      const dispo = res.headers.get("Content-Disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(dispo)?.[1] ?? "resume-tailored";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (error && !thread) return <p className="t-muted p-4 text-sm">{error}</p>;
  if (!thread) return <p className="t-muted p-4 text-sm">Opening Studio…</p>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {msgs.map((m, i) => (
          <div key={m.id ?? `local-${i}`}
            className={m.role === "user"
              ? "ml-8 rounded-lg bg-[rgb(var(--accent))]/10 p-3 text-sm"
              : "surface rounded-lg p-3 text-sm"}>
            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
          </div>
        ))}
        {partial && (
          <div className="surface rounded-lg p-3 text-sm">
            <p className="whitespace-pre-wrap leading-relaxed">{partial}<span className="animate-pulse">▍</span></p>
          </div>
        )}
        {streaming && !partial && (
          <p className="t-muted flex items-center gap-1.5 p-1 text-xs"><Sparkles size={12} className="animate-pulse" /> Analyzing fit against your resume…</p>
        )}
        {error && thread && <p className="text-sm text-red-500">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 border-t border-[rgb(var(--border))] pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="t-muted text-xs" title="Tokens used in this thread (Opus 4.8)">
            {threadTokens.in.toLocaleString()} in · {threadTokens.out.toLocaleString()} out
          </span>
          <button onClick={exportResume} disabled={exporting || streaming} className="btn-ghost text-xs"
            title={exportHint(thread.resumeKind, thread.hasOriginal)}>
            <Download size={13} /> {exporting ? "Tailoring…" : `Export tailored ${thread.resumeKind === "tex" && thread.hasOriginal ? ".tex" : ".docx"}`}
          </button>
        </div>
        <div className="flex gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask for rewrites, bullet ideas, gap fixes…"
            className="input resize-none" disabled={streaming} />
          <button onClick={send} disabled={streaming || !input.trim()} aria-label="Send" className="btn-primary shrink-0 px-3">
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
