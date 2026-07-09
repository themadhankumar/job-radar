import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { resolveKey } from "@/lib/studio";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Suggest adjacent role keywords, based on the parsed profile and current roles. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const { key } = resolveKey(user);
  if (!key) return NextResponse.json({ error: "No API key available — add yours in Settings." }, { status: 503 });

  const profile = await getProfile(user.id);
  const [resume] = await db
    .select({ content: schema.resumes.content })
    .from(schema.resumes)
    .where(eq(schema.resumes.userId, user.id));
  if (!profile && !resume) {
    return NextResponse.json({ error: "Upload a resume first — suggestions are based on it." }, { status: 400 });
  }
  const current = await db
    .select({ keyword: schema.userKeywords.keyword })
    .from(schema.userKeywords)
    .where(and(eq(schema.userKeywords.userId, user.id), eq(schema.userKeywords.kind, "include")));
  const currentRoles = [...new Set(current.map((c) => c.keyword))];

  const context = profile ? JSON.stringify(profile.data) : (resume?.content ?? "").slice(0, 6000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content:
            "Suggest 10 job-role titles/keywords this person should track for openings. Include " +
            "variations and adjacent roles they might not have thought of (e.g. neighboring titles, " +
            "seniority variants, related functions). Each should be 2-5 words, lowercase, phrased " +
            "like it would appear in a job title. Do NOT repeat their current roles. Respond with " +
            'ONLY JSON: [{"role": "role keyword", "reason": "one short line why"}]\n\n' +
            `Profile: ${context}\n\nCurrent roles: ${currentRoles.join(", ") || "(none)"}`,
        }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim()
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();
    const lower = new Set(currentRoles.map((r) => r.toLowerCase()));
    const suggestions = (JSON.parse(text) as { role?: unknown; reason?: unknown }[])
      .filter((s) => typeof s.role === "string" && s.role.trim() && !lower.has((s.role as string).trim().toLowerCase()))
      .slice(0, 10)
      .map((s) => ({ role: (s.role as string).trim().toLowerCase().slice(0, 80), reason: String(s.reason ?? "").slice(0, 140) }));
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("role suggest:", err);
    return NextResponse.json({ error: "Couldn't generate suggestions — try again in a moment." }, { status: 502 });
  }
}
