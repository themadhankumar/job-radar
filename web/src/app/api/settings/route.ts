import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const set: Record<string, unknown> = {};
  if (typeof body.digestEnabled === "boolean") set.digestEnabled = body.digestEnabled;
  if (typeof body.needsSponsorship === "boolean") set.needsSponsorship = body.needsSponsorship;
  if (typeof body.usOnly === "boolean") set.usOnly = body.usOnly;
  if (typeof body.suggestedThreshold === "number" && Number.isFinite(body.suggestedThreshold)) {
    set.suggestedThreshold = Math.min(Math.max(Math.round(body.suggestedThreshold), 0), 100);
  }
  if (typeof body.anthropicKey === "string") {
    set.anthropicKeyEnc = body.anthropicKey.trim() ? encrypt(body.anthropicKey.trim()) : null;
  }
  if (typeof body.notionToken === "string") {
    set.notionTokenEnc = body.notionToken.trim() ? encrypt(body.notionToken.trim()) : null;
  }
  if (typeof body.notionDatabaseId === "string") set.notionDatabaseId = body.notionDatabaseId.trim() || null;
  if (Array.isArray(body.digestSources)) {
    const ALLOWED = ["greenhouse", "lever", "ashby", "workday", "linkedin"];
    const clean = [...new Set(body.digestSources)].filter((s) => ALLOWED.includes(s as string));
    // Empty would silently mute the digest entirely with no obvious cause; keep
    // at least all-on rather than persisting an empty filter.
    set.digestSources = clean.length ? clean : ALLOWED;
  }
  if (Object.keys(set).length === 0) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  await db.update(schema.users).set(set).where(eq(schema.users.id, uid));
  return NextResponse.json({ ok: true });
}
