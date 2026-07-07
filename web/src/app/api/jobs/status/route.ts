import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

const STATUSES = ["new", "reviewing", "applied", "interviewing", "offer", "rejected", "skipped"] as const;
type Status = (typeof STATUSES)[number];

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const { jobId, status } = await req.json().catch(() => ({}));
  if (!jobId || !STATUSES.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  await db
    .insert(schema.userJobStatus)
    .values({ userId: uid, jobId: Number(jobId), status: status as Status })
    .onConflictDoUpdate({
      target: [schema.userJobStatus.userId, schema.userJobStatus.jobId],
      set: { status: status as Status, updatedAt: new Date() },
    });
  return NextResponse.json({ ok: true });
}
