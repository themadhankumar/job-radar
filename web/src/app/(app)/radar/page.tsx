import { and, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { JobsTable, type JobRow } from "@/components/jobs-table";
import { RadarFilters } from "@/components/radar-filters";
import { RefreshButton } from "@/components/refresh-button";
import { EmptyState } from "@/components/empty-state";
import { AddByUrl } from "@/components/add-by-url";

export const dynamic = "force-dynamic";

type Search = { tab?: string; q?: string; days?: string; status?: string; sort?: string; dir?: string };

const SORT_KEYS = ["match", "posted", "created", "pay", "company", "location"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  match: "desc", posted: "desc", created: "desc", pay: "desc", company: "asc", location: "asc",
};

export default async function RadarPage({ searchParams }: { searchParams: Search }) {
  const user = (await getSessionUser())!;
  const tab = ["global", "suggested"].includes(searchParams.tab ?? "") ? (searchParams.tab as "global" | "suggested") : "tracked";
  const q = (searchParams.q ?? "").trim();
  // Default to the last 14 days when no date filter is set; an explicit days=0
  // (the "Any date" option) widens it to everything.
  const days =
    searchParams.days === undefined
      ? 14
      : Math.min(Math.max(parseInt(searchParams.days) || 0, 0), 90);
  const statusFilter = searchParams.status ?? "";
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(searchParams.sort ?? "") ? (searchParams.sort as SortKey) : "match";
  const dir: "asc" | "desc" = searchParams.dir === "asc" || searchParams.dir === "desc" ? searchParams.dir : DEFAULT_DIR[sort];
  const d = sql.raw(dir === "asc" ? "ASC" : "DESC");
  const threshold = user.suggestedThreshold ?? 35;
  const orderExpr =
    sort === "posted"
        ? sql`${schema.jobs.postedAt} ${d} NULLS LAST`
        : sort === "created"
          ? sql`${schema.jobs.createdAt} ${d}`
          : sort === "pay"
            ? sql`(CASE WHEN ${schema.jobs.payPeriod} = 'hour' THEN COALESCE(${schema.jobs.payMax}, ${schema.jobs.payMin}) * 2080 ELSE COALESCE(${schema.jobs.payMax}, ${schema.jobs.payMin}) END) ${d} NULLS LAST`
            : sort === "company"
              ? sql`lower(${schema.jobs.companyName}) ${d}`
              : sort === "location"
                ? sql`NULLIF(lower(${schema.jobs.location}), '') ${d} NULLS LAST`
                : sql`sc.score ${d} NULLS LAST, ${schema.jobs.postedAt} DESC NULLS LAST`;

  // Referral rows always float to the top, independent of sort/score — a warm
  // contact beats a slightly-higher match %. json_agg carries the matched
  // contacts through so the drawer can show who to ping.
  const referralAgg = sql`COALESCE((
    SELECT json_agg(json_build_object('name', rc.name, 'relationship', rc.relationship, 'warmth', rc.warmth, 'status', rc.status))
    FROM referral_contacts rc
    WHERE rc.user_id = ${user.id} AND norm_employer(rc.company_name) = norm_employer(${schema.jobs.companyName})
  ), '[]'::json)`;
  const orderExprWithReferrals = sql`(CASE WHEN json_array_length(${referralAgg}) > 0 THEN 0 ELSE 1 END) ASC, ${orderExpr}`;

  const keywords = await db.select().from(schema.userKeywords).where(eq(schema.userKeywords.userId, user.id));
  const pick = (scope: "tracked" | "global", kind: "include" | "exclude") =>
    keywords.filter((k) => k.scope === scope && k.kind === kind).map((k) => k.keyword);
  const trackedInclude = pick("tracked", "include");
  const trackedExclude = pick("tracked", "exclude");
  const globalInclude = pick("global", "include");
  const globalExclude = pick("global", "exclude");
  // Global mirrors Tracked roles until the user sets Global-specific ones.
  const include = tab === "global" ? (globalInclude.length ? globalInclude : trackedInclude) : trackedInclude;
  const exclude = tab === "global" ? (globalExclude.length ? globalExclude : trackedExclude) : trackedExclude;

  const myCompanies = await db
    .select({ id: schema.userCompanies.companyId, name: schema.companies.name })
    .from(schema.userCompanies)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.userCompanies.companyId))
    .where(eq(schema.userCompanies.userId, user.id));

  const conds: SQL[] = [];
  if (user.usOnly) conds.push(sql`${schema.jobs.country} <> 'intl'`);
  if (tab === "tracked") {
    // Watchlist jobs (filtered by keywords) OR jobs this user added by URL —
    // manual adds are pinned here regardless of watchlist/keywords, otherwise
    // they'd be invisible in every tab until scored.
    const manualCond = sql`(${schema.jobs.source} = 'manual' AND ujs.status IS NOT NULL)`;
    let watchCond: SQL | null = null;
    if (myCompanies.length > 0) {
      const ids = myCompanies.map((c) => c.id);
      const names = myCompanies.map((c) => c.name.toLowerCase());
      watchCond = or(
        inArray(schema.jobs.companyId, ids),
        inArray(sql`lower(${schema.jobs.companyName})`, names),
      )!;
      if (include.length > 0) {
        watchCond = sql`(${watchCond} AND ${or(...include.map((k) => sql`(${schema.jobs.title} ILIKE ${"%" + k + "%"} OR ${schema.jobs.description} ILIKE ${"%" + k + "%"})`))})`;
      }
    }
    conds.push(watchCond ? sql`(${watchCond} OR ${manualCond})` : manualCond);
  }
  if (include.length > 0 && tab === "global") {
    conds.push(or(...include.map((k) => sql`${schema.jobs.title} ILIKE ${"%" + k + "%"}`))!);
  }
  if (tab === "suggested") {
    conds.push(sql`sc.score >= ${threshold}`);
    conds.push(sql`NOT EXISTS (SELECT 1 FROM user_dismissed_jobs d WHERE d.user_id = ${user.id} AND d.job_id = ${schema.jobs.id})`);
    if (myCompanies.length > 0) {
      const ids = myCompanies.map((c) => c.id);
      const names = myCompanies.map((c) => c.name.toLowerCase());
      conds.push(sql`(${schema.jobs.companyId} IS NULL OR ${schema.jobs.companyId} NOT IN ${ids})`);
      conds.push(sql`lower(${schema.jobs.companyName}) NOT IN ${names}`);
    }
  }
  if (tab === "global") {
    // Keep the three tabs disjoint: Global excludes watchlist companies (they
    // live in Tracked) and anything that clears the Suggested bar (score >= the user's threshold).
    // Manual adds this user pinned live in Tracked, not here.
    conds.push(sql`NOT (${schema.jobs.source} = 'manual' AND ujs.status IS NOT NULL)`);
    if (myCompanies.length > 0) {
      const ids = myCompanies.map((c) => c.id);
      const names = myCompanies.map((c) => c.name.toLowerCase());
      conds.push(sql`(${schema.jobs.companyId} IS NULL OR ${schema.jobs.companyId} NOT IN ${ids})`);
      conds.push(sql`lower(${schema.jobs.companyName}) NOT IN ${names}`);
    }
    conds.push(sql`(sc.score IS NULL OR sc.score < ${threshold})`);
  }
  for (const k of exclude) {
    conds.push(sql`${schema.jobs.title} NOT ILIKE ${"%" + k + "%"}`);
  }
  if (q) {
    conds.push(
      or(
        sql`${schema.jobs.title} ILIKE ${"%" + q + "%"}`,
        sql`${schema.jobs.companyName} ILIKE ${"%" + q + "%"}`,
        sql`${schema.jobs.location} ILIKE ${"%" + q + "%"}`,
      )!,
    );
  }
  if (days > 0) {
    conds.push(gte(schema.jobs.postedAt, sql`now() - make_interval(days => ${days})`));
  }

  const rows = await db
    .select({
      id: schema.jobs.id,
      source: schema.jobs.source,
      companyName: schema.jobs.companyName,
      title: schema.jobs.title,
      url: schema.jobs.url,
      location: schema.jobs.location,
      postedAt: schema.jobs.postedAt,
      createdAt: schema.jobs.createdAt,
      description: sql<string>`left(${schema.jobs.description}, 1500)`,
      status: sql<string | null>`ujs.status`,
      score: sql<number | null>`sc.score`,
      components: sql<import("@/db/schema").MatchComponents | null>`sc.components`,
      payMin: schema.jobs.payMin,
      payMax: schema.jobs.payMax,
      payPeriod: schema.jobs.payPeriod,
      yoeMin: schema.jobs.yoeMin,
      sponsorApprovals: sql<number | null>`(SELECT sum(s.approvals)::int FROM sponsors s WHERE s.norm = norm_employer(${schema.jobs.companyName}) AND s.fiscal_year >= extract(year from now())::int - 3)`,
      referralContacts: sql<{ name: string; relationship: string; warmth: string | null; status: string }[]>`${referralAgg}`,
    })
    .from(schema.jobs)
    .leftJoin(
      sql`${schema.userJobStatus} AS ujs`,
      sql`ujs.job_id = ${schema.jobs.id} AND ujs.user_id = ${user.id}`,
    )
    .leftJoin(
      sql`user_job_scores AS sc`,
      sql`sc.job_id = ${schema.jobs.id} AND sc.user_id = ${user.id}`,
    )
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(orderExprWithReferrals)
    .limit(200);

  // Surface the cap: a silent LIMIT hides rows with no signal that anything
  // is missing (Suggested alone can exceed 200 now).
  let totalMatching: number | null = null;
  if (rows.length === 200) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.jobs)
      .leftJoin(
        sql`${schema.userJobStatus} AS ujs`,
        sql`ujs.job_id = ${schema.jobs.id} AND ujs.user_id = ${user.id}`,
      )
      .leftJoin(
        sql`user_job_scores AS sc`,
        sql`sc.job_id = ${schema.jobs.id} AND sc.user_id = ${user.id}`,
      )
      .where(conds.length ? and(...conds) : undefined);
    totalMatching = n;
  }

  let jobs: JobRow[] = rows.map((r) => ({
    ...r,
    status: r.status ?? "new",
    score: r.score === null ? null : Math.round(Number(r.score)),
    postedAt: r.postedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
  if (statusFilter) jobs = jobs.filter((j) => j.status === statusFilter);

  // Collapse duplicate postings of the same role (LinkedIn reposts one job per
  // city). Keep the first row in the current sort order as the representative
  // and fold the other locations into it.
  const seen = new Map<string, JobRow>();
  const grouped: JobRow[] = [];
  for (const j of jobs) {
    const key = `${j.companyName.toLowerCase().trim()}|${j.title.toLowerCase().trim()}`;
    const first = seen.get(key);
    if (first) {
      if (j.location && j.location !== first.location) (first.otherLocations ??= []).push(j.location);
    } else {
      seen.set(key, j);
      grouped.push(j);
    }
  }
  jobs = grouped;

  return (
    <Shell tab={tab} q={q} days={days} status={statusFilter}>
      {jobs.length === 0 ? (
        tab === "tracked" ? (
          myCompanies.length === 0 ? (
            <EmptyState line="Your watchlist is empty — nothing on the scope yet." actionHref="/companies" actionLabel="Add companies to watch" />
          ) : (
            <EmptyState line="No matches from your watchlist yet — the radar sweeps on schedule." actionHref="/roles" actionLabel="Broaden your roles" />
          )
        ) : tab === "suggested" ? (
          <EmptyState line={`Nothing above your ${threshold}% match bar yet.`} actionHref="/settings" actionLabel="Lower the bar in Settings" />
        ) : (
          <EmptyState line="Nothing in the global feed matches these filters." />
        )
      ) : (
        <>
          <JobsTable jobs={jobs} tab={tab} sort={sort} dir={dir} />
          {totalMatching !== null && totalMatching > 200 && (
            <p className="t-muted mt-3 text-center text-xs">
              Showing the top 200 of <span className="font-data">{totalMatching.toLocaleString()}</span> matches — narrow the filters to see the rest.
            </p>
          )}
        </>
      )}
    </Shell>
  );
}

function Shell({ children, ...filters }: { children: React.ReactNode; tab: string; q: string; days: number; status: string }) {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Radar</h1>
        <div className="flex items-center gap-2">
          <AddByUrl />
          <RefreshButton />
        </div>
      </div>
      <p className="t-muted mb-6 text-sm">Open roles across your watchlist, newest signal first.</p>
      <RadarFilters {...filters} />
      {children}
    </div>
  );
}

