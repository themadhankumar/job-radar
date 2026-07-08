import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

const ALLOWED = new Set(["tab", "q", "days", "status", "sort"]);

function cleanParams(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (ALLOWED.has(k) && typeof v === "string" && v.length <= 100 && v) out[k] = v;
    }
  }
  return out;
}

export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const presets = await db
    .select({ id: schema.filterPresets.id, name: schema.filterPresets.name, params: schema.filterPresets.params })
    .from(schema.filterPresets)
    .where(eq(schema.filterPresets.userId, uid))
    .orderBy(asc(schema.filterPresets.createdAt));
  return NextResponse.json({ presets });
}

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 40);
  if (!name) return NextResponse.json({ error: "Name the preset." }, { status: 400 });
  const count = await db.select({ id: schema.filterPresets.id }).from(schema.filterPresets).where(eq(schema.filterPresets.userId, uid));
  if (count.length >= 12) return NextResponse.json({ error: "Preset limit reached (12) — delete one first." }, { status: 400 });
  const params = cleanParams(body.params);
  const [row] = await db
    .insert(schema.filterPresets)
    .values({ userId: uid, name, params })
    .onConflictDoUpdate({ target: [schema.filterPresets.userId, schema.filterPresets.name], set: { params } })
    .returning({ id: schema.filterPresets.id, name: schema.filterPresets.name, params: schema.filterPresets.params });
  return NextResponse.json({ ok: true, preset: row });
}

export async function DELETE(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  await db
    .delete(schema.filterPresets)
    .where(and(eq(schema.filterPresets.userId, uid), eq(schema.filterPresets.id, Number(id))));
  return NextResponse.json({ ok: true });
}
