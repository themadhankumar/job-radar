import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

/** Hide a job from the Suggested tab permanently. */
export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const { jobId } = await req.json().catch(() => ({}));
  if (!Number.isInteger(jobId)) return NextResponse.json({ error: "Bad job." }, { status: 400 });
  await db.insert(schema.userDismissedJobs).values({ userId: uid, jobId }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const { jobId } = await req.json().catch(() => ({}));
  await db
    .delete(schema.userDismissedJobs)
    .where(and(eq(schema.userDismissedJobs.userId, uid), eq(schema.userDismissedJobs.jobId, Number(jobId))));
  return NextResponse.json({ ok: true });
}
