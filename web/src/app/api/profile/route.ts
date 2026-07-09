import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { getProfile, invalidateUserScores, normalizeProfile, parseResumeProfile, upsertProfile } from "@/lib/profile";
import { resolveKey } from "@/lib/studio";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const [resume] = await db
    .select({
      filename: schema.resumes.filename,
      fileKind: schema.resumes.fileKind,
      updatedAt: schema.resumes.updatedAt,
      content: schema.resumes.content,
      hasOriginal: schema.resumes.fileB64,
    })
    .from(schema.resumes)
    .where(eq(schema.resumes.userId, user.id));
  const profile = await getProfile(user.id);
  return NextResponse.json({
    resume: resume
      ? {
          filename: resume.filename,
          kind: resume.fileKind ?? "txt",
          updatedAt: resume.updatedAt,
          chars: resume.content.length,
          preview: resume.content.slice(0, 2500),
          hasOriginal: Boolean(resume.hasOriginal),
        }
      : null,
    profile: profile ? { data: profile.data, edited: profile.edited, updatedAt: profile.updatedAt } : null,
  });
}

/** Save hand-edited profile. */
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.data) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const data = normalizeProfile(body.data);
  await upsertProfile(user.id, data, true);
  await invalidateUserScores(user.id);
  return NextResponse.json({ ok: true, data });
}

/** Re-parse the profile from the stored resume, overwriting edits deliberately. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const [resume] = await db.select().from(schema.resumes).where(eq(schema.resumes.userId, user.id));
  if (!resume) return NextResponse.json({ error: "Upload a resume first." }, { status: 400 });
  const { key } = resolveKey(user);
  if (!key) return NextResponse.json({ error: "No API key available — add yours in Settings." }, { status: 503 });
  try {
    const profile = await parseResumeProfile(key, resume.content);
    await upsertProfile(user.id, profile, false);
    await invalidateUserScores(user.id);
    return NextResponse.json({ ok: true, data: profile });
  } catch (err) {
    console.error("profile re-parse:", err);
    return NextResponse.json({ error: "Couldn't parse the resume — try again in a moment." }, { status: 502 });
  }
}
