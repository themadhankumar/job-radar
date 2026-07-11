import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { resolveKey } from "@/lib/studio";
import { parseJobUrl, extractJobMeta, type ParsedJob } from "@/lib/add-url";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Add a single job by URL.
 * Body: { url: string, pastedJd?: string }
 * - ATS links (Greenhouse/Lever/Ashby) parse via their public APIs.
 * - Hostile domains (LinkedIn/Workday/…) and unreadable pages return
 *   { needsPaste: true, reason } — the client re-submits with pastedJd.
 * - Jobs land with source='manual' + a user_job_status row, which pins
 *   them to the adder's Tracked tab. Match % arrives on the next sweep.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? "").trim().slice(0, 2000);
  const pastedJd = String(body.pastedJd ?? "").trim().slice(0, 50_000);
  if (!url) return NextResponse.json({ error: "Paste a job posting URL." }, { status: 400 });

  let job: ParsedJob;
  if (pastedJd) {
    if (pastedJd.length < 100) {
      return NextResponse.json({ error: "That description looks too short — paste the full posting." }, { status: 400 });
    }
    job = { title: "", companyName: "", location: "", description: pastedJd, url, postedAt: null };
  } else {
    const result = await parseJobUrl(url);
    if (result.kind === "needs-paste") {
      return NextResponse.json({ needsPaste: true, reason: result.reason });
    }
    job = result.job;
  }

  // Backfill title/company/location via Haiku when the source didn't provide them.
  if (!job.title || !job.companyName) {
    const { key } = resolveKey(user);
    if (key) {
      const meta = await extractJobMeta(key, job.description, url);
      job.title = job.title || meta.title;
      job.companyName = job.companyName || meta.companyName;
      job.location = job.location || meta.location;
    }
  }
  if (!job.title) {
    try { job.title = "Role at " + new URL(url).hostname.replace(/^www\./, ""); } catch { job.title = "Untitled role"; }
  }
  if (!job.companyName) {
    try { job.companyName = new URL(url).hostname.replace(/^www\./, "").split(".")[0]; } catch { job.companyName = "unknown"; }
  }

  // Upsert on (source, company_name, ext_id); ext_id = the URL for manual adds.
  const [row] = await db
    .insert(schema.jobs)
    .values({
      source: "manual",
      companyId: null,
      companyName: job.companyName,
      extId: url,
      title: job.title,
      url: job.url || url,
      location: job.location,
      description: job.description,
      postedAt: job.postedAt ?? new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.jobs.source, schema.jobs.companyName, schema.jobs.extId],
      set: { title: job.title, description: job.description, location: job.location },
    })
    .returning({ id: schema.jobs.id });

  // Pin to this user's Tracked tab (and mark it as being looked at).
  await db
    .insert(schema.userJobStatus)
    .values({ userId: user.id, jobId: row.id, status: "reviewing" })
    .onConflictDoNothing({ target: [schema.userJobStatus.userId, schema.userJobStatus.jobId] });

  return NextResponse.json({
    ok: true,
    jobId: row.id,
    title: job.title,
    companyName: job.companyName,
    note: "Added to Tracked. Match % appears after the next pipeline sweep.",
  });
}
