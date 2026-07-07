import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").toLowerCase();
  const password = String(body.password ?? "");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Email or password doesn't match." }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ onboarded: user.onboarded });
}
