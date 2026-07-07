import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";
import { detectAts } from "@/lib/ats";

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
  if (!companyId) {
    const hit = await detectAts(name);
    ats = hit?.ats ?? "linkedin";
    const [row] = await db
      .insert(schema.companies)
      .values({ name, ats: (hit?.ats ?? "linkedin") as "greenhouse" | "lever" | "ashby" | "linkedin", slug: hit?.slug })
      .onConflictDoUpdate({ target: schema.companies.name, set: { name } })
      .returning({ id: schema.companies.id, ats: schema.companies.ats });
    companyId = row.id;
    ats = row.ats;
  }
  await db.insert(schema.userCompanies).values({ userId: uid, companyId: companyId!, list }).onConflictDoNothing();
  return NextResponse.json({ ok: true, companyId, ats });
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
