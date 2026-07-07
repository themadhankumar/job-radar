import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);
export const SESSION_COOKIE = "jr_session";

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function getSessionUserId(): Promise<number | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.uid === "number" ? payload.uid : null;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, uid));
  return user ?? null;
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE);
}
