import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-errors";
import { rateLimit, clientIp, RATE_LIMITED } from "@/lib/rate-limit";

const Body = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  if (!(await rateLimit(`signup:${clientIp(req)}`, 5, 3600))) {
    return NextResponse.json(RATE_LIMITED, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check your name, email, and password (8+ characters)." }, { status: 400 });
  }
  const { name, email, password } = parsed.data;
  try {
    const [user] = await db
      .insert(schema.users)
      .values({ name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 11) })
      .returning({ id: schema.users.id });
    await createSession(user.id);
    return NextResponse.json({ onboarded: false });
  } catch (e: unknown) {
    return authErrorResponse(e, "signup");
  }
}
