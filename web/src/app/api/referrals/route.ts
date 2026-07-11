import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

const STATUSES = new Set(["not_asked", "asked", "referred", "declined"]);
const WARMTHS = new Set(["warm", "cold"]);

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const contacts = await db
    .select()
    .from(schema.referralContacts)
    .where(eq(schema.referralContacts.userId, uid))
    .orderBy(desc(schema.referralContacts.createdAt));
  return NextResponse.json({ contacts });
}

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 100);
  const companyName = String(body.companyName ?? "").trim().slice(0, 100);
  const relationship = String(body.relationship ?? "").trim().slice(0, 60);
  if (!name || !companyName || !relationship) {
    return NextResponse.json({ error: "Name, company, and relationship are required." }, { status: 400 });
  }
  const role = body.role ? String(body.role).trim().slice(0, 100) : null;
  const contactDetails = body.contactDetails ? String(body.contactDetails).trim().slice(0, 300) : null;
  const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null;
  const status = STATUSES.has(body.status) ? body.status : "not_asked";
  const warmth = WARMTHS.has(body.warmth) ? body.warmth : null;
  const companyId = body.companyId ? Number(body.companyId) : null;

  const [row] = await db
    .insert(schema.referralContacts)
    .values({ userId: uid, name, companyName, companyId, role, relationship, contactDetails, status, warmth, notes })
    .returning();
  return NextResponse.json({ ok: true, contact: row });
}

export async function PATCH(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "Missing contact id." }, { status: 400 });

  const name = String(body.name ?? "").trim().slice(0, 100);
  const companyName = String(body.companyName ?? "").trim().slice(0, 100);
  const relationship = String(body.relationship ?? "").trim().slice(0, 60);
  if (!name || !companyName || !relationship) {
    return NextResponse.json({ error: "Name, company, and relationship are required." }, { status: 400 });
  }
  const role = body.role ? String(body.role).trim().slice(0, 100) : null;
  const contactDetails = body.contactDetails ? String(body.contactDetails).trim().slice(0, 300) : null;
  const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null;
  const status = STATUSES.has(body.status) ? body.status : "not_asked";
  const warmth = WARMTHS.has(body.warmth) ? body.warmth : null;
  const companyId = body.companyId ? Number(body.companyId) : null;

  const [row] = await db
    .update(schema.referralContacts)
    .set({ name, companyName, companyId, role, relationship, contactDetails, status, warmth, notes, updatedAt: new Date() })
    .where(and(eq(schema.referralContacts.id, id), eq(schema.referralContacts.userId, uid)))
    .returning();
  if (!row) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  return NextResponse.json({ ok: true, contact: row });
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
