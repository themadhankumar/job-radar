"use client";
import { useEffect, useState } from "react";

/* Linear-style product fragments: crafted UI slices, faded into the ink. */

const ROWS = [
  { score: 61, tier: "score-hi", role: "Technical Program Manager, Enterprise", company: "Anthropic", loc: "San Francisco, CA", posted: "2h" },
  { score: 57, tier: "score-hi", role: "Senior TPM, Robotics", company: "Figure", loc: "San Jose, CA", posted: "4h" },
  { score: 54, tier: "score-hi", role: "Product Manager, Core Models", company: "OpenAI", loc: "Remote, US", posted: "1d" },
  { score: 46, tier: "score-hi", role: "AI Data Product Manager", company: "Scale AI", loc: "New York, NY", posted: "1d" },
  { score: 38, tier: "score-mid", role: "Program Manager, Evaluation", company: "Samsara", loc: "Remote, US", posted: "2d" },
  { score: 29, tier: "score-low", role: "Data Operations Lead", company: "Mercor", loc: "San Francisco, CA", posted: "3d" },
];

const NAV = ["Radar", "Companies", "Referrals", "Roles", "Resume", "Profile", "Settings"];

/* Full app frame: sidebar + radar table, bottom-faded like Linear's hero shots. */
export function HeroAppFrame() {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    const timers = ROWS.map((_, i) => setTimeout(() => setVisible(i + 1), 400 + i * 160));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="relative">
      <div className="surface overflow-hidden rounded-xl shadow-[0_0_80px_rgb(var(--glow)/0.08)]">
        <div className="flex">
          {/* Sidebar */}
          <aside className="hidden w-40 shrink-0 border-r border-[rgb(var(--hairline)/0.10)] p-3 sm:block">
            <div className="mb-4 flex items-center gap-1.5 px-2 text-xs font-semibold">
              <span className="relative inline-flex h-3.5 w-3.5">
                <span className="absolute inset-0 rounded-full border-2 border-[rgb(var(--accent))]" />
                <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--accent))]" />
              </span>
              Job Radar
            </div>
            {NAV.map((n, i) => (
              <p key={n} className={`rounded px-2 py-1.5 text-[11px] font-medium ${i === 0 ? "t-accent bg-[rgb(var(--accent)/0.08)]" : "t-muted"}`}>{n}</p>
            ))}
          </aside>
          {/* Radar */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between border-b border-[rgb(var(--hairline)/0.10)] px-4 py-2.5">
              <div className="flex gap-1 text-[11px]">
                <span className="t-muted rounded px-2 py-0.5">Tracked</span>
                <span className="t-accent rounded bg-[rgb(var(--accent)/0.10)] px-2 py-0.5 font-medium">Suggested</span>
                <span className="t-muted rounded px-2 py-0.5">Global</span>
              </div>
              <span className="font-data t-muted text-[11px]">swept 2h ago</span>
            </div>
            <table className="w-full text-[13px]">
              <tbody>
                {ROWS.map((r, i) => (
                  <tr key={r.role} className="border-b border-[rgb(var(--hairline)/0.08)] transition-opacity duration-300 last:border-0" style={{ opacity: i < visible ? 1 : 0 }}>
                    <td className={`${r.tier} font-data w-12 py-2.5 pl-4 text-xs tabular-nums`}>{r.score}%</td>
                    <td className="max-w-0 truncate py-2.5 pr-3 font-medium">{r.role}</td>
                    <td className="t-muted hidden py-2.5 pr-3 md:table-cell">{r.company}</td>
                    <td className="t-muted hidden py-2.5 pr-3 text-xs lg:table-cell">{r.loc}</td>
                    <td className="t-muted py-2.5 pr-4 text-right text-xs">{r.posted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Linear-style bottom fade into the page */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgb(var(--bg))] to-transparent" />
    </div>
  );
}

/* Match drawer fragment: score arc + component bars + boost chips. */
const COMPONENTS: [string, number][] = [["Skills", 72], ["Role", 84], ["Work", 58], ["Experience", 65], ["Industry", 70]];

export function MatchFragment() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.4 });
    const el = document.getElementById("match-frag");
    if (el) io.observe(el);
    return () => io.disconnect();
  }, []);
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div id="match-frag" className="surface rounded-xl p-5">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
            <circle cx="32" cy="32" r={r} fill="none" strokeWidth="4" className="stroke-[rgb(var(--hairline)/0.12)]" />
            <circle cx="32" cy="32" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
              className="stroke-[rgb(var(--accent))] transition-[stroke-dashoffset] duration-[900ms] ease-[var(--ease)]"
              style={{ strokeDasharray: c, strokeDashoffset: on ? c - (c * 61) / 100 : c }} />
          </svg>
          <span className="score-hi font-data absolute inset-0 flex items-center justify-center text-sm">61</span>
        </div>
        <div>
          <p className="text-sm font-semibold">Technical Program Manager, Enterprise</p>
          <p className="t-muted text-xs">Anthropic · San Francisco, CA</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {COMPONENTS.map(([label, v], i) => (
          <div key={label} className="flex items-center gap-3">
            <span className="t-muted w-20 text-[11px]">{label}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[rgb(var(--hairline)/0.12)]">
              <div className="h-full rounded-full bg-[rgb(var(--muted)/0.7)] transition-[width] duration-700 ease-[var(--ease)]"
                style={{ width: on ? `${v}%` : "0%", transitionDelay: `${i * 90}ms` }} />
            </div>
            <span className="font-data t-muted w-7 text-right text-[11px]">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["evaluation pipelines", "RLHF", "data engine"].map((t) => (
          <span key={t} className="chip t-muted border-dashed text-[11px]">+ {t}</span>
        ))}
      </div>
    </div>
  );
}

/* Studio fragment: chat exchange + export diff. */
export function StudioFragment() {
  return (
    <div className="surface space-y-3 rounded-xl p-5">
      <div className="ml-auto max-w-[85%] rounded-lg bg-[rgb(var(--accent)/0.12)] px-3 py-2 text-[13px]">
        Tailor my resume for this posting — emphasize the annotation platform work.
      </div>
      <div className="max-w-[85%] rounded-lg bg-[rgb(var(--surface-2))] px-3 py-2 text-[13px]">
        Done. I led with the clinical annotation pipeline, quantified the reviewer
        throughput gain, and moved the ML-platform migration up. Diff below.
      </div>
      <div className="font-data rounded-lg border border-[rgb(var(--hairline)/0.12)] bg-[rgb(var(--surface-2))] p-3 text-[11px] leading-relaxed">
        <p className="t-muted mb-1.5">resume-anthropic-tpm.tex · <span className="text-[rgb(var(--ok))]">+6</span> <span className="text-[rgb(var(--danger))]">−4</span></p>
        <p className="rounded-sm bg-[rgb(var(--danger)/0.08)] px-1 text-[rgb(var(--danger))] opacity-70">− Managed data annotation workflows</p>
        <p className="rounded-sm bg-[rgb(var(--ok)/0.10)] px-1 text-[rgb(var(--ok))]">+ Built the clinical annotation engine scoring 40k charts/mo</p>
        <p className="rounded-sm bg-[rgb(var(--ok)/0.10)] px-1 text-[rgb(var(--ok))]">+ Cut specialist review time 38% via HITL routing</p>
      </div>
    </div>
  );
}

/* H-1B sponsor fragment: the signal no competitor has. */
export function SponsorFragment() {
  return (
    <div className="surface rounded-xl p-5">
      <div className="mb-3 flex items-center justify-between border-b border-[rgb(var(--hairline)/0.10)] pb-3">
        <div>
          <p className="text-sm font-semibold">AI Data Product Manager</p>
          <p className="t-muted text-xs">Scale AI · New York, NY</p>
        </div>
        <span className="font-data score-hi text-sm">46%</span>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="t-muted">Sponsors H-1B</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--ok)/0.3)] px-2 py-0.5 text-[rgb(var(--ok))]">
            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--ok))]" /> Yes
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="t-muted">Approvals (last 3 FY)</span>
          <span className="font-data">1,204</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="t-muted">Most recent</span>
          <span className="font-data">FY2025</span>
        </div>
      </div>
      <p className="t-muted mt-3 border-t border-[rgb(var(--hairline)/0.10)] pt-3 text-[11px] leading-relaxed">
        Pulled from USCIS petition data — inline on every job, before you spend an hour applying.
      </p>
    </div>
  );
}

/* Add-by-URL fragment: paste → parsed. */
export function AddUrlFragment() {
  return (
    <div className="surface rounded-xl p-5">
      <p className="t-muted mb-2 text-[11px] uppercase tracking-widest">Add a job by URL</p>
      <div className="input flex items-center text-xs">
        <span className="truncate font-data t-muted">linkedin.com/jobs/view/tpm-anthropic…</span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--ok))]" />
        <span className="t-muted">Parsed · scored · <span className="score-hi font-data">54%</span> · ready in Studio</span>
      </div>
    </div>
  );
}

/* Digest fragment: the 6 PM email. */
const DIGEST = [
  ["61%", "TPM, Enterprise", "Anthropic"],
  ["57%", "Senior TPM, Robotics", "Figure"],
  ["54%", "PM, Core Models", "OpenAI"],
];
export function DigestFragment() {
  return (
    <div className="surface overflow-hidden rounded-xl">
      <div className="border-b border-[rgb(var(--hairline)/0.10)] px-4 py-3">
        <p className="text-sm font-semibold">3 new roles on your radar</p>
        <p className="t-muted text-xs">Today · 6:00 PM · ranked by match</p>
      </div>
      <div>
        {DIGEST.map(([score, role, co]) => (
          <div key={role} className="flex items-center gap-3 border-b border-[rgb(var(--hairline)/0.08)] px-4 py-2.5 text-[13px] last:border-0">
            <span className="font-data score-hi w-10 text-xs">{score}</span>
            <span className="flex-1 truncate font-medium">{role}</span>
            <span className="t-muted text-xs">{co}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Referral fragment: a matched posting floated to the top, handshake-marked. */
export function ReferralFragment() {
  return (
    <div className="surface overflow-hidden rounded-xl">
      <div className="border-b border-[rgb(var(--hairline)/0.10)] px-4 py-2.5">
        <p className="t-muted text-[11px] uppercase tracking-widest">Your radar · referral pinned to top</p>
      </div>
      <div className="flex items-center justify-between gap-3 bg-[rgb(var(--ok)/0.05)] px-4 py-3 text-[13px] shadow-[inset_2px_0_0_rgb(var(--ok))]">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium">
            Senior TPM, Platform
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="t-ok shrink-0"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></svg>
          </p>
          <p className="t-muted text-xs">Databricks · Priya (college friend) · warm</p>
        </div>
        <span className="chip t-ok shrink-0 border-[rgb(var(--ok)/0.35)] text-[11px]">Referral</span>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 text-[13px] opacity-50">
        <span className="truncate font-medium">Staff PM, Data Platform</span>
        <span className="font-data score-mid text-xs">38%</span>
      </div>
    </div>
  );
}
