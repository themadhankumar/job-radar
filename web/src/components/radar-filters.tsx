"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function RadarFilters({ tab, q, days, status, sort }: { tab: string; q: string; days: number; status: string; sort: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(q);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/radar?${next.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="surface flex rounded-md p-0.5">
        {(["tracked", "suggested", "global"] as const).map((t) => (
          <button key={t} onClick={() => setParam("tab", t === "tracked" ? "" : t)}
            className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-[rgb(var(--accent))] text-white dark:text-zinc-900" : "t-muted"}`}>
            {t}
          </button>
        ))}
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && setParam("q", search)}
        placeholder="Search title, company, location…"
        className="input max-w-xs"
      />
      <select value={days || ""} onChange={(e) => setParam("days", e.target.value)} className="input w-auto">
        <option value="">Any date</option>
        <option value="1">Past day</option>
        <option value="7">Past week</option>
        <option value="14">Past 2 weeks</option>
        <option value="30">Past month</option>
      </select>
      <select value={sort === "suggested" ? "" : sort} onChange={(e) => setParam("sort", e.target.value)} className="input w-auto">
        <option value="">Suggested</option>
        <option value="posted">Newest posted</option>
        <option value="created">Newest found</option>
      </select>
      <select value={status} onChange={(e) => setParam("status", e.target.value)} className="input w-auto">
        <option value="">All statuses</option>
        {["new", "reviewing", "applied", "interviewing", "offer", "rejected", "skipped"].map((s) => (
          <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
        ))}
      </select>
    </div>
  );
}
