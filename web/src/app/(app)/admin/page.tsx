import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

async function q<T = Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<T[]> {
  try {
    const r = (await db.execute(query)) as unknown as { rows?: T[] };
    return (r.rows ?? (r as unknown as T[])) ?? [];
  } catch (e) {
    console.error("[admin]", e);
    return [];
  }
}

const n = (v: unknown): number => Number(v ?? 0);
const sumName = (rows: { name: string; n: number }[], name: string): number =>
  Number(rows.find((r) => r.name === name)?.n ?? 0);

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="surface rounded-xl p-4">
      <div className="t-muted text-xs">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      {sub ? <div className="t-muted mt-0.5 text-xs">{sub}</div> : null}
    </div>
  );
}

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!isAdmin(user?.email)) notFound();

  const [totals] = await q<{ users: number; users_7d: number; events: number; events_7d: number }>(sql`
    SELECT
      (SELECT count(*) FROM users)::int AS users,
      (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days')::int AS users_7d,
      (SELECT count(*) FROM events)::int AS events,
      (SELECT count(*) FROM events WHERE created_at > now() - interval '7 days')::int AS events_7d
  `);

  const signups = await q<{ day: string; n: number }>(sql`
    SELECT to_char(date_trunc('day', created_at), 'MM-DD') AS day, count(*)::int AS n
    FROM users WHERE created_at > now() - interval '30 days'
    GROUP BY date_trunc('day', created_at) ORDER BY date_trunc('day', created_at)
  `);

  const byName = await q<{ name: string; n: number }>(sql`
    SELECT name, count(*)::int AS n FROM events
    WHERE created_at > now() - interval '30 days'
    GROUP BY name ORDER BY n DESC
  `);

  const perUser = await q<{
    id: number; email: string; name: string; joined: string;
    page_views: number; job_views: number; applies: number; studio: number; last_active: string | null;
  }>(sql`
    SELECT u.id, u.email, u.name, to_char(u.created_at, 'YYYY-MM-DD') AS joined,
      count(*) FILTER (WHERE e.name = 'page_view')::int AS page_views,
      count(*) FILTER (WHERE e.name = 'job_view')::int AS job_views,
      count(*) FILTER (WHERE e.name = 'job_apply_click')::int AS applies,
      count(*) FILTER (WHERE e.name = 'studio_open')::int AS studio,
      to_char(max(e.created_at), 'YYYY-MM-DD HH24:MI') AS last_active
    FROM users u LEFT JOIN events e ON e.user_id = u.id
    GROUP BY u.id ORDER BY max(e.created_at) DESC NULLS LAST, u.created_at DESC
  `);

  const topJobs = await q<{ title: string; company: string; views: number }>(sql`
    SELECT j.title, j.company_name AS company, count(*)::int AS views
    FROM events e JOIN jobs j ON j.id = (e.props->>'jobId')::int
    WHERE e.name = 'job_view' AND e.created_at > now() - interval '30 days'
    GROUP BY j.id, j.title, j.company_name ORDER BY views DESC LIMIT 10
  `);

  const feedback = await q<{ type: string; message: string; path: string | null; day: string }>(sql`
    SELECT type, message, page_path AS path, to_char(created_at, 'YYYY-MM-DD') AS day
    FROM feedback ORDER BY created_at DESC LIMIT 8
  `);

  const scoreCorr = await q<{ tier: string; ord: number; views: number; applies: number }>(sql`
    WITH tagged AS (
      SELECT e.name,
        CASE WHEN s.score >= 42 THEN 'High (42+)'
             WHEN s.score >= 30 THEN 'Mid (30-41)'
             ELSE 'Low (<30)' END AS tier,
        CASE WHEN s.score >= 42 THEN 3 WHEN s.score >= 30 THEN 2 ELSE 1 END AS ord
      FROM events e
      JOIN user_job_scores s ON s.user_id = e.user_id AND s.job_id = (e.props->>'jobId')::int
      WHERE e.name IN ('job_view', 'job_apply_click') AND e.props->>'jobId' ~ '^[0-9]+$'
    )
    SELECT tier, ord,
      count(*) FILTER (WHERE name = 'job_view')::int AS views,
      count(*) FILTER (WHERE name = 'job_apply_click')::int AS applies
    FROM tagged GROUP BY tier, ord ORDER BY ord DESC
  `);

  const funnel = await q<{ status: string; n: number }>(sql`
    SELECT status, count(*)::int AS n FROM user_job_status GROUP BY status
  `);
  const fmap: Record<string, number> = {};
  for (const f of funnel) fmap[f.status] = n(f.n);
  const STAGE_ORDER = ["reviewing", "applied", "interviewing", "offer", "rejected", "skipped"];
  const stages = STAGE_ORDER.filter((k) => (fmap[k] ?? 0) > 0).map((k) => ({ label: k, n: fmap[k] ?? 0 }));
  const fmax = Math.max(1, ...stages.map((st) => st.n));
  const appBase = (fmap.applied ?? 0) + (fmap.interviewing ?? 0) + (fmap.offer ?? 0) + (fmap.rejected ?? 0);
  const ivRate = appBase ? Math.round((((fmap.interviewing ?? 0) + (fmap.offer ?? 0)) / appBase) * 100) : 0;
  const offerRate = appBase ? Math.round(((fmap.offer ?? 0) / appBase) * 100) : 0;

  const W = 520, H = 60, gap = 3;
  const max = Math.max(1, ...signups.map((s) => n(s.n)));
  const bw = signups.length ? (W - gap * (signups.length - 1)) / signups.length : W;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <p className="t-muted mt-1 text-sm">Product usage across all users. Last 30 days unless noted.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total users" value={n(totals?.users)} sub={`+${n(totals?.users_7d)} this week`} />
        <Stat label="Events (all time)" value={n(totals?.events)} sub={`${n(totals?.events_7d)} this week`} />
        <Stat label="Job views (30d)" value={sumName(byName, "job_view")} />
        <Stat label="Apply clicks (30d)" value={sumName(byName, "job_apply_click")} />
      </div>

      <section className="surface mt-4 rounded-xl p-5">
        <div className="t-muted text-xs font-medium uppercase tracking-wide">Signups &middot; last 30 days</div>
        {signups.length ? (
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 w-full" style={{ height: 60 }}>
            {signups.map((s, i) => {
              const h = (n(s.n) / max) * (H - 4);
              return <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={1} fill="rgb(var(--accent))" />;
            })}
          </svg>
        ) : (
          <p className="t-muted mt-3 text-sm">No signups in range.</p>
        )}
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="surface rounded-xl p-5">
          <div className="t-muted text-xs font-medium uppercase tracking-wide">Score &rarr; apply-click &middot; does match predict clicks?</div>
          <div className="mt-4 space-y-3">
            {scoreCorr.length ? scoreCorr.map((t) => {
              const rate = t.views ? (t.applies / t.views) * 100 : 0;
              return (
                <div key={t.tier}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{t.tier}</span>
                    <span className="t-muted text-xs tabular-nums">{n(t.applies)}/{n(t.views)} &middot; {rate.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded bg-[rgb(var(--surface-2))]">
                    <div className="h-full rounded bg-[rgb(var(--accent))]" style={{ width: `${Math.min(100, rate)}%` }} />
                  </div>
                </div>
              );
            }) : <p className="t-muted text-sm">No scored views yet.</p>}
          </div>
          <p className="t-muted mt-4 text-xs">Apply-click rate by match tier. Higher tiers clicking more = the score ranks the right jobs.</p>
        </section>

        <section className="surface rounded-xl p-5">
          <div className="t-muted text-xs font-medium uppercase tracking-wide">Application pipeline &middot; current status</div>
          <div className="mt-4 space-y-2.5">
            {stages.length ? stages.map((st) => (
              <div key={st.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize">{st.label}</span>
                  <span className="tabular-nums">{st.n}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded bg-[rgb(var(--surface-2))]">
                  <div className="h-full rounded bg-[rgb(var(--accent))]" style={{ width: `${(st.n / fmax) * 100}%` }} />
                </div>
              </div>
            )) : <p className="t-muted text-sm">No applications tracked yet.</p>}
          </div>
          <div className="t-muted mt-4 flex gap-5 text-xs">
            <span>Interview rate <span className="font-medium text-[rgb(var(--text))]">{ivRate}%</span></span>
            <span>Offer rate <span className="font-medium text-[rgb(var(--text))]">{offerRate}%</span></span>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="surface rounded-xl p-5">
          <div className="t-muted text-xs font-medium uppercase tracking-wide">Events by type &middot; 30d</div>
          <div className="mt-3 space-y-2">
            {byName.length ? byName.map((e) => (
              <div key={e.name} className="flex items-center justify-between text-sm">
                <span className="font-mono text-[13px]">{e.name}</span>
                <span className="tabular-nums">{n(e.n).toLocaleString()}</span>
              </div>
            )) : <p className="t-muted text-sm">No events yet.</p>}
          </div>
        </section>

        <section className="surface rounded-xl p-5">
          <div className="t-muted text-xs font-medium uppercase tracking-wide">Most-viewed jobs &middot; 30d</div>
          <div className="mt-3 space-y-2">
            {topJobs.length ? topJobs.map((j, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{j.title} <span className="t-muted">&middot; {j.company}</span></span>
                <span className="shrink-0 tabular-nums">{n(j.views)}</span>
              </div>
            )) : <p className="t-muted text-sm">No job views yet.</p>}
          </div>
        </section>
      </div>

      <section className="surface mt-4 overflow-hidden rounded-xl">
        <div className="t-muted border-b border-[rgb(var(--border))] px-5 py-3 text-xs font-medium uppercase tracking-wide">
          Users &middot; {perUser.length}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="t-muted text-left text-xs">
              <tr>
                <th className="px-5 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Joined</th>
                <th className="px-3 py-2 text-right font-medium">Views</th>
                <th className="px-3 py-2 text-right font-medium">Jobs</th>
                <th className="px-3 py-2 text-right font-medium">Applies</th>
                <th className="px-3 py-2 text-right font-medium">Studio</th>
                <th className="px-5 py-2 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody>
              {perUser.map((u) => (
                <tr key={u.id} className="border-t border-[rgb(var(--border))]">
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{u.name}</div>
                    <div className="t-muted text-xs">{u.email}</div>
                  </td>
                  <td className="t-muted px-3 py-2.5">{u.joined}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{n(u.page_views)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{n(u.job_views)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{n(u.applies)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{n(u.studio)}</td>
                  <td className="t-muted px-5 py-2.5">{u.last_active ?? "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {feedback.length > 0 && (
        <section className="surface mt-4 rounded-xl p-5">
          <div className="t-muted text-xs font-medium uppercase tracking-wide">Recent feedback</div>
          <div className="mt-3 space-y-3">
            {feedback.map((f, i) => (
              <div key={i} className="text-sm">
                <span className="rounded bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-xs">{f.type}</span>{" "}
                <span>{f.message}</span>
                <span className="t-muted text-xs"> &middot; {f.day}{f.path ? ` \u00b7 ${f.path}` : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
