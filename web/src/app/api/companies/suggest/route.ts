import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { resolveKey } from "@/lib/studio";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Suggest companies to track, based on the parsed profile and current watchlist. */
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
  const tracked = await db
    .select({ name: schema.companies.name })
    .from(schema.userCompanies)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.userCompanies.companyId))
    .where(eq(schema.userCompanies.userId, user.id));
  const trackedNames = tracked.map((t) => t.name);

  const context = profile
    ? JSON.stringify(profile.data)
    : (resume?.content ?? "").slice(0, 6000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content:
            "Suggest 10 companies this person should watch for job openings. Prioritize companies " +
            "similar to their current watchlist (competitors, same space) and companies known to hire " +
            "for their skills/roles. Prefer companies likely to use Greenhouse, Lever, or Ashby job boards " +
            "(startups and mid-size tech). Do NOT repeat the watchlist. Respond with ONLY JSON: " +
            '[{"name": "Exact Company Name", "reason": "one short line why"}]\n\n' +
            `Profile: ${context}\n\nCurrent watchlist: ${trackedNames.join(", ") || "(empty)"}`,
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
    const lower = new Set(trackedNames.map((n) => n.toLowerCase()));
    const suggestions = (JSON.parse(text) as { name?: unknown; reason?: unknown }[])
      .filter((s) => typeof s.name === "string" && s.name.trim() && !lower.has((s.name as string).trim().toLowerCase()))
      .slice(0, 10)
      .map((s) => ({ name: (s.name as string).trim().slice(0, 80), reason: String(s.reason ?? "").slice(0, 140) }));
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("company suggest:", err);
    return NextResponse.json({ error: "Couldn't generate suggestions — try again in a moment." }, { status: 502 });
  }
}
