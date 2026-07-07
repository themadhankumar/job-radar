import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

const Body = z.object({
  keywords: z.array(z.string().min(1).max(80)).min(1).max(40),
  excludeKeywords: z.array(z.string().min(1).max(80)).max(40).default([]),
  needsSponsorship: z.boolean(),
  companies: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1).max(80),
        ats: z.enum(["greenhouse", "lever", "ashby", "linkedin"]).optional(),
        slug: z.string().max(120).optional(),
        list: z.enum(["dream", "watch"]).default("watch"),
      }),
    )
    .max(60),
});

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid onboarding data." }, { status: 400 });
  const { keywords, excludeKeywords, needsSponsorship, companies } = parsed.data;

  await db.delete(schema.userKeywords).where(eq(schema.userKeywords.userId, uid));
  await db.insert(schema.userKeywords).values([
    ...keywords.map((k) => ({ userId: uid, keyword: k.toLowerCase(), kind: "include" as const })),
    ...excludeKeywords.map((k) => ({ userId: uid, keyword: k.toLowerCase(), kind: "exclude" as const })),
  ]);

  for (const c of companies) {
    let companyId = c.id;
    if (!companyId) {
      const [row] = await db
        .insert(schema.companies)
        .values({ name: c.name, ats: c.ats ?? "linkedin", slug: c.slug })
        .onConflictDoUpdate({ target: schema.companies.name, set: { name: c.name } })
        .returning({ id: schema.companies.id });
      companyId = row.id;
    }
    await db
      .insert(schema.userCompanies)
      .values({ userId: uid, companyId, list: c.list })
      .onConflictDoNothing();
  }

  await db.update(schema.users).set({ needsSponsorship, onboarded: true }).where(eq(schema.users.id, uid));
  return NextResponse.json({ ok: true });
}
