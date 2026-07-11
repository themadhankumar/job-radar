import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");
  if (next.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  }
  await db
    .update(schema.users)
    .set({ passwordHash: await bcrypt.hash(next, 10) })
    .where(eq(schema.users.id, user.id));
  return NextResponse.json({ ok: true });
}
