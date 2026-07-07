"use client";
import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { NewDot } from "./logo";
import { Studio } from "./studio";
import { htmlToText } from "@/lib/text";

export type JobRow = {
  id: number;
  source: string;
  companyName: string;
  title: string;
  url: string;
  location: string;
  postedAt: string | null;
  createdAt: string;
  description: string;
  status: string;
  score: number | null;
  payMin: number | null;
  payMax: number | null;
  payPeriod: string | null;
  yoeMin: number | null;
  sponsorApprovals: number | null;
};

function pay(j: JobRow): string | null {
  if (j.payMin == null) return null;
  const f = (n: number) => (j.payPeriod === "hour" ? `$${n}` : `$${Math.round(n / 1000)}k`);
  const range = j.payMin === j.payMax ? f(j.payMin) : `${f(j.payMin)}–${f(j.payMax ?? j.payMin)}`;
  return j.payPeriod === "hour" ? `${range}/hr` : range;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="t-muted text-xs">—</span>;
  const tone = score >= 70 ? "text-[rgb(var(--accent))] border-[rgb(var(--accent))]" : score >= 40 ? "" : "opacity-60";
  return <span className={`chip font-mono ${tone}`}>{score}</span>;
}

const STATUSES = ["new", "reviewing", "applied", "interviewing", "offer", "rejected", "skipped"];

function ago(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function isFresh(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 48 * 3_600_000;
}

export function JobsTable({ jobs }: { jobs: JobRow[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [tab, setTab] = useState<"details" | "studio">("details");
  const [statuses, setStatuses] = useState<Record<number, string>>({});
  const open = jobs.find((j) => j.id === openId) ?? null;

  async function setStatus(jobId: number, status: string) {
    setStatuses((s) => ({ ...s, [jobId]: status }));
    await fetch("/api/jobs/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status }),
    });
  }

  return (
    <>
      <div className="surface overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[rgb(var(--border))] text-left">
              {["Match", "Role", "Company", "Pay", "Location", "Posted", "Status"].map((h) => (
                <th key={h} className="t-muted px-4 py-2.5 text-xs font-medium uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const st = statuses[j.id] ?? j.status;
              return (
                <tr key={j.id} onClick={() => { setOpenId(j.id); setTab("details"); }}
                  className="cursor-pointer border-b border-[rgb(var(--border))] last:border-0 hover:bg-[rgb(var(--border))]/30">
                  <td className="px-4 py-3"><ScoreBadge score={j.score} /></td>
                  <td className="max-w-md px-4 py-3 font-medium">
                    <span className="flex items-center">
                      {isFresh(j.createdAt) && st === "new" && <NewDot />}
                      <span className="truncate">{j.title}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{j.companyName}</td>
                  <td className="t-muted whitespace-nowrap px-4 py-3">{pay(j) ?? "—"}</td>
                  <td className="t-muted max-w-[200px] truncate px-4 py-3">{j.location || "—"}</td>
                  <td className="t-muted whitespace-nowrap px-4 py-3">{ago(j.postedAt)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <select value={st} onChange={(e) => setStatus(j.id, e.target.value)}
                      className="rounded-md border border-[rgb(var(--border))] bg-transparent px-2 py-1 text-xs">
                      {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-30" onClick={() => setOpenId(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <aside onClick={(e) => e.stopPropagation()}
            className="surface absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-y-0 border-r-0 p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold leading-snug">{open.title}</h2>
                <p className="t-muted text-sm">{open.companyName} · {open.location || "Location not listed"}</p>
              </div>
              <button aria-label="Close" onClick={() => setOpenId(null)} className="btn-ghost h-8 w-8 shrink-0 p-0"><X size={15} /></button>
            </div>
            <div className="mb-4 flex gap-1 border-b border-[rgb(var(--border))]">
              {(["details", "studio"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-sm capitalize ${tab === t
                    ? "border-b-2 border-[rgb(var(--accent))] font-medium"
                    : "t-muted hover:text-inherit"}`}>
                  {t === "studio" ? "✦ Studio" : "Details"}
                </button>
              ))}
            </div>

            {tab === "studio" ? (
              <div className="min-h-0 flex-1"><Studio jobId={open.id} /></div>
            ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              {open.score != null && <span className="chip t-accent border-[rgb(var(--accent))]">match {open.score}</span>}
              {pay(open) && <span className="chip">{pay(open)}</span>}
              {open.yoeMin != null && <span className="chip">{open.yoeMin}+ yrs</span>}
              <span className="chip t-muted">via {open.source}</span>
              <span className="chip t-muted">posted {ago(open.postedAt)}</span>
            </div>
            <div className="surface mb-4 rounded-lg p-3 text-sm">
              <p className="t-muted mb-1 text-xs font-medium uppercase tracking-wide">H-1B sponsorship signal</p>
              {open.sponsorApprovals != null && open.sponsorApprovals > 0 ? (
                <p><span className="t-accent font-medium">{open.sponsorApprovals.toLocaleString()}</span> approvals in the last 3 fiscal years (USCIS Employer Data Hub).</p>
              ) : (
                <p className="t-muted">No USCIS record found under this exact name — could mean no sponsorship history, a different legal entity name, or the data isn&apos;t imported yet.</p>
              )}
            </div>
            <a href={open.url} target="_blank" rel="noreferrer" className="btn-primary mb-6 w-full">
              Open posting <ExternalLink size={14} />
            </a>
            <div className="surface rounded-lg p-4">
              <p className="t-muted mb-2 text-xs font-medium uppercase tracking-wide">Description preview</p>
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {open.description ? htmlToText(open.description).slice(0, 1200) : "This source doesn't include a description — open the posting for details."}
              </p>
            </div>
            <p className="t-muted mt-4 text-xs">Open the ✦ Studio tab to tailor your resume to this job.</p>
            </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
