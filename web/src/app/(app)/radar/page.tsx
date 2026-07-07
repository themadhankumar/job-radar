import { and, desc, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { JobsTable, type JobRow } from "@/components/jobs-table";
import { RadarFilters } from "@/components/radar-filters";

export const dynamic = "force-dynamic";

type Search = { tab?: string; q?: string; days?: string; status?: string; sort?: string };

export default async function RadarPage({ searchParams }: { searchParams: Search }) {
  const user = (await getSessionUser())!;
  const tab = searchParams.tab === "global" ? "global" : "tracked";
  const q = (searchParams.q ?? "").trim();
  const days = Math.min(Math.max(parseInt(searchParams.days ?? "0") || 0, 0), 90);
  const statusFilter = searchParams.status ?? "";
  const sort = searchParams.sort === "created" ? "created" : "posted";

  const keywords = await db.select().from(schema.userKeywords).where(eq(schema.userKeywords.userId, user.id));
  const include = keywords.filter((k) => k.kind === "include").map((k) => k.keyword);
  const exclude = keywords.filter((k) => k.kind === "exclude").map((k) => k.keyword);

  const myCompanies = await db
    .select({ id: schema.userCompanies.companyId, name: schema.companies.name })
    .from(schema.userCompanies)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.userCompanies.companyId))
    .where(eq(schema.userCompanies.userId, user.id));

  const conds: SQL[] = [];
  if (tab === "tracked") {
    if (myCompanies.length === 0) {
      return (
        <Shell tab={tab} q={q} days={days} status={statusFilter}>
          <Empty text="Add companies to your watchlist to light up this radar." />
        </Shell>
      );
    }
    const ids = myCompanies.map((c) => c.id);
    const names = myCompanies.map((c) => c.name.toLowerCase());
    conds.push(
      or(
        inArray(schema.jobs.companyId, ids),
        inArray(sql`lower(${schema.jobs.companyName})`, names),
      )!,
    );
  }
  if (include.length > 0 && tab === "tracked") {
    conds.push(
      or(...include.map((k) => sql`(${schema.jobs.title} ILIKE ${"%" + k + "%"} OR ${schema.jobs.description} ILIKE ${"%" + k + "%"})`))!,
    );
  }
  if (include.length > 0 && tab === "global") {
    conds.push(or(...include.map((k) => sql`${schema.jobs.title} ILIKE ${"%" + k + "%"}`))!);
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
    })
    .from(schema.jobs)
    .leftJoin(
      sql`${schema.userJobStatus} AS ujs`,
      sql`ujs.job_id = ${schema.jobs.id} AND ujs.user_id = ${user.id}`,
    )
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(
      sort === "created" ? desc(schema.jobs.createdAt) : sql`${schema.jobs.postedAt} DESC NULLS LAST`,
    )
    .limit(200);

  let jobs: JobRow[] = rows.map((r) => ({
    ...r,
    status: r.status ?? "new",
    postedAt: r.postedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
  if (statusFilter) jobs = jobs.filter((j) => j.status === statusFilter);

  return (
    <Shell tab={tab} q={q} days={days} status={statusFilter}>
      {jobs.length === 0 ? (
        <Empty text={tab === "tracked" ? "No matches yet. The pipeline refreshes on schedule — or broaden your keywords in Settings." : "Nothing in the global feed matches your filters yet."} />
      ) : (
        <JobsTable jobs={jobs} />
      )}
    </Shell>
  );
}

function Shell({ children, ...filters }: { children: React.ReactNode; tab: string; q: string; days: number; status: string }) {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Radar</h1>
      <p className="t-muted mb-6 text-sm">Open roles across your watchlist, newest signal first.</p>
      <RadarFilters {...filters} />
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="surface mt-4 rounded-xl p-12 text-center">
      <p className="t-muted text-sm">{text}</p>
    </div>
  );
}
