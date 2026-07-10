import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (!token) {
    return NextResponse.json({ error: "Missing reset token — use the link from your email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  try {
    const [row] = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.tokenHash, tokenHash));
    if (!row || row.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired — request a new one." },
        { status: 400 },
      );
    }
    const [user] = await db
      .update(schema.users)
      .set({ passwordHash: await bcrypt.hash(password, 11) })
      .where(eq(schema.users.id, row.userId))
      .returning({ id: schema.users.id, onboarded: schema.users.onboarded });
    // Single-use: clear all tokens for this user
    await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, row.userId));
    await createSession(user.id);
    return NextResponse.json({ onboarded: user.onboarded });
  } catch (e) {
    console.error("[reset]", e);
    return NextResponse.json({ error: "Unexpected server error — details are in the server logs." }, { status: 500 });
  }
}
