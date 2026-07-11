import { NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail, emailConfigured } from "@/lib/email";
import { rateLimit, clientIp, RATE_LIMITED } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "Enter your email." }, { status: 400 });
  }
  const [emailOk, ipOk] = await Promise.all([
    rateLimit(`forgot:${email}`, 3, 3600),
    rateLimit(`forgot-ip:${clientIp(req)}`, 10, 3600),
  ]);
  if (!emailOk || !ipOk) {
    return NextResponse.json(RATE_LIMITED, { status: 429 });
  }
  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "Email isn't configured on this server yet (RESEND_API_KEY / DIGEST_FROM)." },
      { status: 503 },
    );
  }
  try {
    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    if (user) {
      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      // Invalidate any previous tokens, then store only the hash
      await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, user.id));
      await db.insert(schema.passwordResetTokens).values({
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      const appUrl = (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
      const link = `${appUrl}/reset?token=${token}`;
      const sent = await sendEmail(
        email,
        "Reset your Job Radar password",
        `<p>Someone requested a password reset for this account.</p>
         <p><a href="${link}">Reset your password</a> — this link expires in 1 hour.</p>
         <p>If this wasn't you, you can ignore this email.</p>`,
      );
      if (!sent) {
        return NextResponse.json(
          { error: "Couldn't send the email — check the server logs and Resend config." },
          { status: 502 },
        );
      }
    }
    // Same response whether or not the account exists (no enumeration)
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[forgot]", e);
    return NextResponse.json({ error: "Unexpected server error — details are in the server logs." }, { status: 500 });
  }
}
