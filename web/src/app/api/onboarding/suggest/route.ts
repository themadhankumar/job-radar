import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

export const maxDuration = 30;

export async function POST() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Suggestions aren't configured on this server yet." }, { status: 503 });
  const [resume] = await db.select().from(schema.resumes).where(eq(schema.resumes.userId, uid));
  if (!resume) return NextResponse.json({ error: "Upload a resume first, then try again." }, { status: 400 });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        messages: [{
          role: "user",
          content:
            "From this resume, suggest job-search settings. Reply ONLY with JSON: " +
            '{"keywords": [6-10 lowercase job-title/skill search phrases likely to appear in matching job titles], ' +
            '"companies": [5-8 company names that hire for these roles, real companies only]}.\n\nResume:\n' +
            resume.content.slice(0, 12000),
        }],
      }),
    });
    if (!res.ok) return NextResponse.json({ error: "Suggestion service is unavailable right now." }, { status: 502 });
    const data = await res.json();
    const raw = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("")
      .trim().replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(raw);
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10).map(String) : [];
    const companies = Array.isArray(parsed.companies) ? parsed.companies.slice(0, 8).map(String) : [];
    return NextResponse.json({ keywords, companies });
  } catch {
    return NextResponse.json({ error: "Couldn't generate suggestions — add keywords manually." }, { status: 502 });
  }
}
