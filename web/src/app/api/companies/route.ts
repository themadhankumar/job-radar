import { NextResponse } from "next/server";

export const maxDuration = 60;
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";
import { detectAts, fetchBoard } from "@/lib/ats";

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const all = await db
    .select({ id: schema.companies.id, name: schema.companies.name, ats: schema.companies.ats })
    .from(schema.companies)
    .orderBy(asc(schema.companies.name));
  const mine = await db
    .select({ companyId: schema.userCompanies.companyId, list: schema.userCompanies.list })
    .from(schema.userCompanies)
    .where(eq(schema.userCompanies.userId, uid));
  return NextResponse.json({ all, mine });
}

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const list = body.list === "dream" ? "dream" : "watch";
  if (!name || name.length > 80) return NextResponse.json({ error: "Enter a company name." }, { status: 400 });

  const existingId = body.companyId ? Number(body.companyId) : null;
  let companyId = existingId;
  let ats: string | null = null;
  let slug: string | null = null;
  if (!companyId) {
    const hit = await detectAts(name);
    ats = hit?.ats ?? "linkedin";
    const [row] = await db
      .insert(schema.companies)
      .values({ name, ats: (hit?.ats ?? "linkedin") as "greenhouse" | "lever" | "ashby" | "linkedin", slug: hit?.slug })
      .onConflictDoUpdate({ target: schema.companies.name, set: { name } })
      .returning({ id: schema.companies.id, ats: schema.companies.ats, slug: schema.companies.slug });
    companyId = row.id;
    ats = row.ats;
    slug = row.slug;
  } else {
    const [row] = await db
      .select({ ats: schema.companies.ats, slug: schema.companies.slug, name: schema.companies.name })
      .from(schema.companies)
      .where(eq(schema.companies.id, companyId));
    ats = row?.ats ?? null;
    slug = row?.slug ?? null;
  }
  await db.insert(schema.userCompanies).values({ userId: uid, companyId: companyId!, list }).onConflictDoNothing();

  // Instant fetch so the radar reflects the add immediately (JSON-API boards only;
  // Workday/LinkedIn wait for the scheduled pipeline).
  let jobsFetched = 0;
  if (slug && ats && ["greenhouse", "lever", "ashby"].includes(ats)) {
    try {
      const postings = (await fetchBoard(ats, slug)).filter((p) => p.extId && p.title && p.url);
      if (postings.length > 0) {
        const inserted = await db
          .insert(schema.jobs)
          .values(
            postings.map((p) => ({
              source: ats!,
              companyId,
              companyName: name,
              extId: p.extId,
              title: p.title,
              url: p.url,
              location: p.location,
              description: p.description,
              postedAt: p.postedAt,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: schema.jobs.id });
        jobsFetched = inserted.length;
      }
    } catch (err) {
      console.error("fetch-on-add:", err);
    }
  }
  return NextResponse.json({ ok: true, companyId, ats, jobsFetched });
}

export async function DELETE(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const { companyId } = await req.json().catch(() => ({}));
  await db
    .delete(schema.userCompanies)
    .where(and(eq(schema.userCompanies.userId, uid), eq(schema.userCompanies.companyId, Number(companyId))));
  return NextResponse.json({ ok: true });
}
