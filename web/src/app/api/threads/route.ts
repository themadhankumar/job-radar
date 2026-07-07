import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";
import { getUsage } from "@/lib/studio";

export const runtime = "nodejs";

/** Create-or-fetch the Studio thread for a job. Returns thread id + full history + usage. */
export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const jobId = Number(body.jobId);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return NextResponse.json({ error: "Invalid job." }, { status: 400 });
  }

  const [job] = await db.select({ id: schema.jobs.id }).from(schema.jobs).where(eq(schema.jobs.id, jobId));
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const [resume] = await db.select().from(schema.resumes).where(eq(schema.resumes.userId, uid));
  if (!resume) {
    return NextResponse.json({ error: "Upload a resume in Settings first — Studio needs it for context." }, { status: 400 });
  }

  let [thread] = await db
    .select()
    .from(schema.resumeThreads)
    .where(and(eq(schema.resumeThreads.userId, uid), eq(schema.resumeThreads.jobId, jobId)));
  if (!thread) {
    [thread] = await db
      .insert(schema.resumeThreads)
      .values({ userId: uid, jobId })
      .onConflictDoNothing()
      .returning();
    if (!thread) {
      [thread] = await db
        .select()
        .from(schema.resumeThreads)
        .where(and(eq(schema.resumeThreads.userId, uid), eq(schema.resumeThreads.jobId, jobId)));
    }
  }

  const messages = await db
    .select({
      id: schema.resumeMessages.id,
      role: schema.resumeMessages.role,
      content: schema.resumeMessages.content,
      tokensIn: schema.resumeMessages.tokensIn,
      tokensOut: schema.resumeMessages.tokensOut,
    })
    .from(schema.resumeMessages)
    .where(eq(schema.resumeMessages.threadId, thread.id))
    .orderBy(asc(schema.resumeMessages.createdAt), asc(schema.resumeMessages.id));

  const usage = await getUsage(uid);
  return NextResponse.json({
    threadId: thread.id,
    messages,
    usage,
    resumeKind: resume.fileKind ?? "txt",
    hasOriginal: Boolean(resume.fileB64),
  });
}
