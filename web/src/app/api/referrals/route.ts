import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

const STATUSES = new Set(["not_asked", "asked", "referred", "declined"]);
const WARMTHS = new Set(["warm", "cold"]);

type ExperienceInput = {
  companyName?: unknown;
  companyId?: unknown;
  role?: unknown;
  isCurrent?: unknown;
  startDate?: unknown;
  endDate?: unknown;
};

function cleanExperiences(raw: unknown) {
  const list = Array.isArray(raw) ? (raw as ExperienceInput[]) : [];
  return list
    .map((e) => ({
      companyName: String(e.companyName ?? "").trim().slice(0, 100),
      companyId: e.companyId ? Number(e.companyId) : null,
      role: e.role ? String(e.role).trim().slice(0, 100) : null,
      isCurrent: Boolean(e.isCurrent),
      startDate: e.startDate ? String(e.startDate).trim().slice(0, 40) : null,
      endDate: e.endDate ? String(e.endDate).trim().slice(0, 40) : null,
    }))
    .filter((e) => e.companyName);
}

async function attachExperiences<T extends { id: number }>(contacts: T[]) {
  if (contacts.length === 0) return contacts.map((c) => ({ ...c, experiences: [] }));
  const ids = contacts.map((c) => c.id);
  const rows = await db
    .select()
    .from(schema.referralExperiences)
    .where(inArray(schema.referralExperiences.contactId, ids))
    .orderBy(desc(schema.referralExperiences.isCurrent), desc(schema.referralExperiences.id));
  const byContact = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byContact.get(r.contactId) ?? [];
    list.push(r);
    byContact.set(r.contactId, list);
  }
  return contacts.map((c) => ({ ...c, experiences: byContact.get(c.id) ?? [] }));
}

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const contacts = await db
    .select()
    .from(schema.referralContacts)
    .where(eq(schema.referralContacts.userId, uid))
    .orderBy(desc(schema.referralContacts.createdAt));
  return NextResponse.json({ contacts: await attachExperiences(contacts) });
}

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 100);
  const relationship = String(body.relationship ?? "").trim().slice(0, 60);
  const experiences = cleanExperiences(body.experiences);
  if (!name || !relationship || experiences.length === 0) {
    return NextResponse.json({ error: "Name, relationship, and at least one employer are required." }, { status: 400 });
  }
  const contactDetails = body.contactDetails ? String(body.contactDetails).trim().slice(0, 300) : null;
  const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null;
  const status = STATUSES.has(body.status) ? body.status : "not_asked";
  const warmth = WARMTHS.has(body.warmth) ? body.warmth : null;

  const [row] = await db
    .insert(schema.referralContacts)
    .values({ userId: uid, name, relationship, contactDetails, status, warmth, notes })
    .returning();
  const expRows = await db
    .insert(schema.referralExperiences)
    .values(experiences.map((e) => ({ ...e, contactId: row.id })))
    .returning();
  return NextResponse.json({ ok: true, contact: { ...row, experiences: expRows } });
}

export async function PATCH(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "Missing contact id." }, { status: 400 });

  const name = String(body.name ?? "").trim().slice(0, 100);
  const relationship = String(body.relationship ?? "").trim().slice(0, 60);
  const experiences = cleanExperiences(body.experiences);
  if (!name || !relationship || experiences.length === 0) {
    return NextResponse.json({ error: "Name, relationship, and at least one employer are required." }, { status: 400 });
  }
  const contactDetails = body.contactDetails ? String(body.contactDetails).trim().slice(0, 300) : null;
  const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null;
  const status = STATUSES.has(body.status) ? body.status : "not_asked";
  const warmth = WARMTHS.has(body.warmth) ? body.warmth : null;

  const [row] = await db
    .update(schema.referralContacts)
    .set({ name, relationship, contactDetails, status, warmth, notes, updatedAt: new Date() })
    .where(and(eq(schema.referralContacts.id, id), eq(schema.referralContacts.userId, uid)))
    .returning();
  if (!row) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  await db.delete(schema.referralExperiences).where(eq(schema.referralExperiences.contactId, id));
  const expRows = await db
    .insert(schema.referralExperiences)
    .values(experiences.map((e) => ({ ...e, contactId: id })))
    .returning();
  return NextResponse.json({ ok: true, contact: { ...row, experiences: expRows } });
}

export async function DELETE(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  await db
    .delete(schema.referralContacts)
    .where(and(eq(schema.referralContacts.id, Number(id)), eq(schema.referralContacts.userId, uid)));
  return NextResponse.json({ ok: true });
}
