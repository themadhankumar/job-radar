"use client";
import { useEffect, useState } from "react";

/* Hero instrument: the ScoreDial idiom, oversized, animating to its reading
   on mount. CSS transition on stroke-dashoffset — no JS animation loop. */
export function LandingDial({ target = 87 }: { target?: number }) {
  const [score, setScore] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setScore(target), 300);
    return () => clearTimeout(t);
  }, [target]);
  const r = 84;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-56 w-56">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" strokeWidth="8" className="stroke-[rgb(var(--hairline)/0.12)]" />
        <circle
          cx="100" cy="100" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
          className="stroke-[rgb(var(--accent))] transition-[stroke-dashoffset] duration-[1200ms] ease-[var(--ease)]"
          style={{ strokeDasharray: c, strokeDashoffset: c - (c * score) / 100, filter: "drop-shadow(0 0 12px rgb(var(--glow) / 0.5))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-data text-5xl score-hi tabular-nums">{score}%</span>
        <span className="t-muted mt-1 text-xs uppercase tracking-widest">match</span>
      </div>
    </div>
  );
}
