import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ProfileData } from "@/db/schema";

const PARSE_MODEL = "claude-haiku-4-5";

export const EMPTY_PROFILE: ProfileData = {
  skills: [],
  titles: [],
  industries: [],
  seniority: "",
  yoe: null,
  summary: "",
};

const strArr = (v: unknown, maxItems: number, maxLen = 60): string[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, maxLen);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
};

export function normalizeProfile(raw: unknown): ProfileData {
  const r = (raw ?? {}) as Record<string, unknown>;
  const yoeNum = typeof r.yoe === "number" ? r.yoe : typeof r.yoe === "string" ? parseFloat(r.yoe) : NaN;
  return {
    skills: strArr(r.skills, 40),
    titles: strArr(r.titles, 10, 80),
    industries: strArr(r.industries, 8),
    seniority: typeof r.seniority === "string" ? r.seniority.trim().slice(0, 40) : "",
    yoe: Number.isFinite(yoeNum) && yoeNum >= 0 && yoeNum <= 60 ? Math.round(yoeNum * 10) / 10 : null,
    summary: typeof r.summary === "string" ? r.summary.trim().slice(0, 600) : "",
  };
}

/** One Haiku call: resume text → structured profile. Throws on failure. */
export async function parseResumeProfile(apiKey: string, resumeText: string): Promise<ProfileData> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: PARSE_MODEL,
      max_tokens: 1200,
      messages: [{
        role: "user",
        content:
          'Parse this resume into JSON. Respond with ONLY the JSON object, no fences:\n' +
          '{"skills": ["specific tools, technologies, and competencies, 15-35 items"], ' +
          '"titles": ["job titles held or clearly targeted"], ' +
          '"industries": ["industries worked in, e.g. healthcare, fintech"], ' +
          '"seniority": "one of: intern|junior|mid|senior|staff|manager|director|exec", ' +
          '"yoe": <total years of professional experience as a number, from the earliest full-time role to now; exclude internships>, ' +
          '"summary": "2-3 sentence professional summary in third person"}\n\nResume:\n' +
          resumeText.slice(0, 14000),
      }],
    }),
  });
  if (!res.ok) throw new Error(`profile parse ${res.status}`);
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
  const profile = normalizeProfile(JSON.parse(text));
  if (profile.skills.length === 0 && profile.titles.length === 0) throw new Error("empty parse");
  return profile;
}

export async function getProfile(userId: number) {
  const [row] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
  return row ?? null;
}

export async function upsertProfile(userId: number, data: ProfileData, edited: boolean) {
  await db
    .insert(schema.userProfiles)
    .values({ userId, data, edited, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.userProfiles.userId,
      set: { data, edited, updatedAt: new Date() },
    });
}

/**
 * Drop a user's cached match scores so the pipeline recomputes them from
 * scratch on its next run. Call whenever the inputs to scoring change — a
 * profile edit/re-parse or a resume replace. The pipeline scores incrementally
 * (only jobs without a score row), so clearing here is what triggers a rescore.
 */
export async function invalidateUserScores(userId: number) {
  await db.delete(schema.userJobScores).where(eq(schema.userJobScores.userId, userId));
}
