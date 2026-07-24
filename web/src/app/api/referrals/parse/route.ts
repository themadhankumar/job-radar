import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { resolveKey } from "@/lib/studio";
import { parseProfileText } from "@/lib/add-referral-profile";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Parse pasted LinkedIn profile text into a name + work history. Pure parse,
 * no DB write — the client reviews/edits the result before saving via
 * POST/PATCH /api/referrals.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim().slice(0, 20_000);
  if (text.length < 50) {
    return NextResponse.json({ error: "Paste more of the profile — that looks too short." }, { status: 400 });
  }

  const { key } = resolveKey(user);
  if (!key) {
    return NextResponse.json({ error: "No Anthropic key available — add the roles manually instead." }, { status: 400 });
  }

  const parsed = await parseProfileText(key, text);
  if (parsed.experiences.length === 0) {
    return NextResponse.json({ error: "Couldn't find any work history in that text — try pasting the Experience section, or add roles manually." }, { status: 422 });
  }
  return NextResponse.json({ ok: true, ...parsed });
}
