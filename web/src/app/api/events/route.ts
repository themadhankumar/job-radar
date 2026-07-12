import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

/** Record one product-analytics event. Fire-and-forget from the client. */
const NAME_RE = /^[a-z][a-z0-9_]{1,39}$/;

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  const { name, props } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || !NAME_RE.test(name)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const safeProps =
    props && typeof props === "object" && !Array.isArray(props)
      ? (props as Record<string, unknown>)
      : {};

  try {
    await db.insert(schema.events).values({ userId: uid, name, props: safeProps });
  } catch (e) {
    // Best-effort: a failed insert must never surface to the user.
    console.error("[events]", e);
  }
  return NextResponse.json({ ok: true });
}
