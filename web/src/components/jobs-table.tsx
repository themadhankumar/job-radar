"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, ExternalLink, Handshake, X } from "lucide-react";
import { NewDot } from "./logo";
import { Studio } from "./studio";
import { track } from "@/lib/track";
import { htmlToText } from "@/lib/text";
import { getScoreTier, SCORE_TIER_HI, SCORE_TIER_MID } from "@/lib/score-tier";
import type { MatchComponents, IntentSignal } from "@/db/schema";

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
  otherLocations?: string[];
  components: MatchComponents | null;
  intentScore: number | null;
  intent: IntentSignal | null;
  referralContacts?: { name: string; relationship: string; warmth: string | null; status: string }[];
};

function pay(j: JobRow): string | null {
  if (j.payMin == null) return null;
  const f = (n: number) => (j.payPeriod === "hour" ? `$${n}` : `$${Math.round(n / 1000)}k`);
  const range = j.payMin === j.payMax ? f(j.payMin) : `${f(j.payMin)}–${f(j.payMax ?? j.payMin)}`;
  return j.payPeriod === "hour" ? `${range}/hr` : range;
}


function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="t-muted text-xs">—</span>;
  // Signal tiers: one hue, three intensities — high signal glows, weak signal recedes
  return <span className={`${getScoreTier(score)} text-[13px] tabular-nums`}>{score}%</span>;
}

function ScoreDial({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const tier = getScoreTier(score);
  const arcOpacity = score >= SCORE_TIER_HI ? 1 : score >= SCORE_TIER_MID ? 0.55 : 0.3;
  return (
    <div className="relative h-16 w-16 shrink-0" title={`${score}% match`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--hairline) / 0.15)" strokeWidth="4" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--accent))" strokeWidth="4"
          strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} opacity={arcOpacity} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center ${tier} text-[15px]`}>{score}</span>
    </div>
  );
}

const COMPONENT_META: { key: keyof Omit<MatchComponents, "missing">; label: string; weight: number }[] = [
  { key: "skills", label: "Skills", weight: 30 },
  { key: "role", label: "Role", weight: 25 },
  { key: "work", label: "Work similarity", weight: 20 },
  { key: "exp", label: "Experience fit", weight: 15 },
  { key: "industry", label: "Industry", weight: 10 },
];

function MatchBreakdown({ c }: { c: MatchComponents }) {
  return (
    <div className="mb-4 rounded-lg border border-[rgb(var(--border))] p-3">
      <p className="t-muted mb-2 text-xs font-medium uppercase tracking-wide">Why this match</p>
      <div className="space-y-1.5">
        {COMPONENT_META.map(({ key, label, weight }) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgb(var(--hairline)/0.12)]">
              <div className="h-full rounded-full bg-[rgb(var(--accent))]" style={{ width: `${Math.round((c[key] ?? 0) * 100)}%` }} />
            </div>
            <span className="t-muted font-data w-16 shrink-0 text-right text-[11px]">{Math.round((c[key] ?? 0) * 100)}% · {weight}w</span>
          </div>
        ))}
      </div>
      {c.missing?.length > 0 && (
        <div className="mt-3">
          <p className="t-muted mb-1.5 text-xs">Terms in this posting your profile doesn't cover — add real ones to your resume or profile to raise the match:</p>
          <div className="flex flex-wrap gap-1.5">
            {c.missing.map((m) => <span key={m} className="chip border-dashed text-xs transition-colors duration-150 hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]">+ {m}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

function ghostLabel(level: string): string {
  return level === "ghost" ? "Likely ghost job" : "Possible low hiring intent";
}

function IntentNote({ intent }: { intent: IntentSignal }) {
  if (intent.level === "ok") return null;
  const strong = intent.level === "ghost";
  return (
    <div className={`mb-4 rounded-lg border p-3 text-sm ${strong ? "border-[rgb(var(--danger)/0.35)]" : "border-[rgb(var(--border))]"}`}>
      <p className={`mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${strong ? "text-[rgb(var(--danger))]" : "t-muted"}`}>
        <AlertTriangle size={13} /> {ghostLabel(intent.level)}
      </p>
      <p className="t-muted">
        Signs of low hiring intent{intent.reasons.length ? `: ${intent.reasons.join("; ")}` : ""}. May be an evergreen or
        pipeline-building req kept open to collect resumes — worth a closer look before investing time.
      </p>
    </div>
  );
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

const SORTABLE: Record<string, { key: string; defaultDir: "asc" | "desc" }> = {
  Match: { key: "match", defaultDir: "desc" },
  Company: { key: "company", defaultDir: "asc" },
  Pay: { key: "pay", defaultDir: "desc" },
  Location: { key: "location", defaultDir: "asc" },
  Posted: { key: "posted", defaultDir: "desc" },
};

export function JobsTable({ jobs, tab: radarTab = "tracked", sort = "match", dir = "desc" }: { jobs: JobRow[]; tab?: string; sort?: string; dir?: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function onSort(label: string) {
    const col = SORTABLE[label];
    if (!col) return;
    const nextDir = sort === col.key ? (dir === "desc" ? "asc" : "desc") : col.defaultDir;
    const next = new URLSearchParams(params.toString());
    if (col.key === "match") next.delete("sort"); else next.set("sort", col.key);
    if (nextDir === col.defaultDir) next.delete("dir"); else next.set("dir", nextDir);
    router.push(`/radar?${next.toString()}`);
  }

  const [hidden, setHidden] = useState<Set<number>>(new Set());

  async function dismiss(jobId: number) {
    track("job_dismiss", { jobId });
    setHidden((h) => new Set(h).add(jobId));
    await fetch("/api/jobs/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
  }

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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] table-fixed text-sm">
          <colgroup>
            <col className="w-[7%]" /><col className="w-[31%]" /><col className="w-[15%]" /><col className="w-[8%]" />
            <col className="w-[15%]" /><col className="w-[8%]" /><col className="w-[12%]" />
            {radarTab === "suggested" && <col className="w-[4%]" />}
          </colgroup>
          <thead>
            <tr className="border-b border-[rgb(var(--border))] text-left">
              {["Match", "Role", "Company", "Pay", "Location", "Posted", "Status"].map((h) => {
                const col = SORTABLE[h];
                const active = col && sort === col.key;
                return (
                  <th key={h}
                    onClick={() => onSort(h)}
                    title={col ? `Sort by ${h.toLowerCase()}` : undefined}
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                    className={`t-muted px-4 py-3.5 text-[11px] font-medium uppercase tracking-[0.08em] ${col ? "cursor-pointer select-none transition-colors duration-150 hover:text-[rgb(var(--accent))]" : ""} ${active ? "t-accent" : ""}`}>
                    <span className="inline-flex items-center gap-1">
                      {h}
                      {active && (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                    </span>
                  </th>
                );
              })}
              {radarTab === "suggested" && <th className="px-2" />}
            </tr>
          </thead>
          <tbody>
            {jobs.filter((j) => !hidden.has(j.id)).map((j) => {
              const st = statuses[j.id] ?? j.status;
              const referrals = j.referralContacts ?? [];
              const hasReferral = referrals.length > 0;
              const warmest = referrals.some((r) => r.warmth === "warm") ? "warm" : referrals.some((r) => r.warmth === "cold") ? "cold" : null;
              return (
                <tr key={j.id} onClick={() => { setOpenId(j.id); setTab("details"); track("job_view", { jobId: j.id, score: j.score, tab: radarTab }); }}
                  className={`group cursor-pointer border-b border-[rgb(var(--hairline)/0.10)] transition-colors duration-150 last:border-0 hover:bg-[rgb(var(--surface))] ${hasReferral ? "bg-[rgb(var(--ok)/0.05)] shadow-[inset_2px_0_0_rgb(var(--ok))]" : ""}`}>
                  <td className="px-4 py-4 transition-shadow duration-150 group-hover:shadow-[inset_2px_0_0_rgb(var(--accent))]"><ScoreBadge score={j.score} /></td>
                  <td className="px-4 py-4 font-medium">
                    <span className="flex items-center">
                      {isFresh(j.createdAt) && st === "new" && <NewDot />}
                      <span className="truncate">{j.title}</span>
                      {j.intent && j.intent.level !== "ok" && (
                        <span title={ghostLabel(j.intent.level)}
                          className={`ml-1.5 inline-flex shrink-0 items-center ${j.intent.level === "ghost" ? "text-[rgb(var(--danger))]" : "t-muted"}`}>
                          <AlertTriangle size={12} />
                        </span>
                      )}
                      {hasReferral && (
                        <span title={`Referral: ${referrals.map((r) => r.name).join(", ")}`}
                          className={`ml-1.5 inline-flex shrink-0 items-center ${warmest === "warm" ? "t-ok" : "t-muted"}`}>
                          <Handshake size={13} />
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="truncate px-4 py-4" title={j.companyName}>{j.companyName}</td>
                  <td className="t-muted truncate px-4 py-4">{pay(j) ?? "—"}</td>
                  <td className="t-muted truncate px-4 py-4" title={[j.location, ...(j.otherLocations ?? [])].filter(Boolean).join(" · ")}>
                    {j.location || "—"}{j.otherLocations?.length ? <span className="t-accent"> +{j.otherLocations.length}</span> : null}
                  </td>
                  <td className="t-muted truncate px-4 py-4">{ago(j.postedAt)}</td>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <select value={st} onChange={(e) => setStatus(j.id, e.target.value)}
                      className="t-muted rounded-full border border-transparent bg-[rgb(var(--surface-2))] px-2.5 py-1 text-xs transition-colors duration-150 hover:border-[rgb(var(--border))] hover:text-[rgb(var(--text))]">
                      {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </td>
                  {radarTab === "suggested" && (
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <button aria-label="Don't suggest this job again" title="Don't suggest again"
                        onClick={() => dismiss(j.id)} className="t-muted transition-colors duration-150 hover:text-[rgb(var(--danger))]">
                        <X size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-30" onClick={() => setOpenId(null)}>
          <div className="animate-fade-in absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
          <aside onClick={(e) => e.stopPropagation()}
            className="animate-drawer-in absolute inset-y-0 right-0 flex w-full max-w-lg flex-col rounded-l-2xl border-l border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold leading-snug">{open.title}</h2>
                <p className="t-muted text-sm">{open.companyName} · {open.location || "Location not listed"}</p>
              </div>
              {open.score != null && <ScoreDial score={open.score} />}
              <button aria-label="Close" onClick={() => setOpenId(null)} className="btn-ghost h-8 w-8 shrink-0 p-0"><X size={15} /></button>
            </div>
            <div className="mb-4 flex gap-1 border-b border-[rgb(var(--border))]">
              {(["details", "studio"] as const).map((t) => (
                <button key={t} onClick={() => { setTab(t); if (t === "studio") track("studio_open", { jobId: open.id }); }}
                  className={`px-3 py-1.5 text-sm capitalize transition-colors duration-150 ${tab === t
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
              {pay(open) && <span className="chip">{pay(open)}</span>}
              {open.yoeMin != null && <span className="chip">{open.yoeMin}+ yrs</span>}
              <span className="chip t-muted">via {open.source}</span>
              <span className="chip t-muted">posted {ago(open.postedAt)}</span>
            </div>
            {open.referralContacts && open.referralContacts.length > 0 && (
              <div className="surface mb-4 rounded-lg border-[rgb(var(--ok)/0.35)] p-3 text-sm">
                <p className="t-ok mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide"><Handshake size={13} /> Referral available</p>
                <div className="space-y-1.5">
                  {open.referralContacts.map((r, i) => (
                    <p key={i} className="text-sm">
                      <span className="font-medium">{r.name}</span>
                      <span className="t-muted"> · {r.relationship}{r.warmth ? ` · ${r.warmth}` : ""}{r.status !== "not_asked" ? ` · ${r.status.replace("_", " ")}` : ""}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
            {open.intent && <IntentNote intent={open.intent} />}
            <div className="surface mb-4 rounded-lg p-3 text-sm">
              <p className="t-muted mb-1 text-xs font-medium uppercase tracking-wide">H-1B sponsorship signal</p>
              {open.sponsorApprovals != null && open.sponsorApprovals > 0 ? (
                <p><span className="t-accent font-medium">{open.sponsorApprovals.toLocaleString()}</span> approvals in the last 3 fiscal years (USCIS Employer Data Hub).</p>
              ) : (
                <p className="t-muted">No USCIS record found under this exact name — could mean no sponsorship history, a different legal entity name, or the data isn&apos;t imported yet.</p>
              )}
            </div>
            <a href={open.url} target="_blank" rel="noreferrer" onClick={() => track("job_apply_click", { jobId: open.id })} className="btn-primary mb-6 w-full">
              Open posting <ExternalLink size={14} />
            </a>
            <div className="surface rounded-lg p-4">
              {open.components && <MatchBreakdown c={open.components} />}
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
