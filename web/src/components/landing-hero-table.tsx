"use client";
import { useEffect, useState } from "react";

/* The product IS the hero: a crafted slice of the real radar table with
   true glow tiers, sweeping in row by row. JSX (not a screenshot) so it
   stays crisp, themed, and animatable. */

const ROWS = [
  { score: 61, tier: "score-hi", role: "Technical Program Manager, Enterprise", company: "Anthropic", loc: "San Francisco, CA", posted: "2h" },
  { score: 57, tier: "score-hi", role: "Senior TPM, Robotics", company: "Figure", loc: "San Jose, CA", posted: "4h" },
  { score: 54, tier: "score-hi", role: "Product Manager, Core Models", company: "OpenAI", loc: "Remote, US", posted: "1d" },
  { score: 46, tier: "score-hi", role: "AI Data Product Manager", company: "Scale AI", loc: "New York, NY", posted: "1d" },
  { score: 38, tier: "score-mid", role: "Program Manager, Evaluation", company: "Samsara", loc: "Remote, US", posted: "2d" },
  { score: 29, tier: "score-low", role: "Data Operations Lead", company: "Mercor", loc: "San Francisco, CA", posted: "3d" },
];

export function LandingHeroTable() {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    const timers = ROWS.map((_, i) => setTimeout(() => setVisible(i + 1), 400 + i * 180));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="surface overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-[rgb(var(--hairline)/0.10)] px-4 py-2.5">
        <span className="t-muted text-[11px] font-medium uppercase tracking-widest">Suggested · above your 35% bar</span>
        <span className="font-data t-muted text-[11px]">swept 2h ago</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {ROWS.map((r, i) => (
            <tr
              key={r.role}
              className="border-b border-[rgb(var(--hairline)/0.08)] transition-opacity duration-300 last:border-0"
              style={{ opacity: i < visible ? 1 : 0 }}
            >
              <td className={`${r.tier} font-data w-14 py-3 pl-4 text-[13px] tabular-nums`}>{r.score}%</td>
              <td className="max-w-0 truncate py-3 pr-3 font-medium">{r.role}</td>
              <td className="t-muted hidden py-3 pr-3 sm:table-cell">{r.company}</td>
              <td className="t-muted hidden py-3 pr-3 text-xs md:table-cell">{r.loc}</td>
              <td className="t-muted py-3 pr-4 text-right text-xs">{r.posted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Mono sweep feed — Resend shows the code, we show the pipeline. */
const LOG = [
  "13:30:02  sweep started (147 boards)",
  "13:30:41  Anthropic: 183 fetched, 3 new",
  "13:31:07  OpenAI: 96 fetched, 1 new",
  "13:31:52  LinkedIn: 6 queries, 24 new",
  "13:32:38  enrich: pay + YoE extracted",
  "13:33:14  geo: country tags applied",
  "13:34:55  match: 1,546 postings scored",
  "13:34:56  sweep complete · next in 2h",
];

export function LandingSweepLog() {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        LOG.forEach((_, i) => setTimeout(() => setVisible(i + 1), i * 260));
        io.disconnect();
      }
    }, { threshold: 0.4 });
    const el = document.getElementById("sweep-log");
    if (el) io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div id="sweep-log" className="surface rounded-xl bg-[rgb(var(--surface-2))] p-4">
      <div className="font-data space-y-1.5 text-xs leading-relaxed">
        {LOG.map((line, i) => (
          <p key={line} className="transition-opacity duration-200" style={{ opacity: i < visible ? 1 : 0 }}>
            <span className="t-muted">{line.slice(0, 8)}</span>
            <span className={i >= LOG.length - 2 ? "t-accent" : ""}>{line.slice(8)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
