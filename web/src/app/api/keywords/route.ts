import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

export const runtime = "nodejs";

const SCOPES = ["tracked", "global"] as const;
const KINDS = ["include", "exclude"] as const;
type Scope = (typeof SCOPES)[number];
type Kind = (typeof KINDS)[number];
const MAX_PER_GROUP = 40;

/** All of a user's role keywords, flat — the client groups by scope + kind. */
export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const keywords = await db
    .select({
      id: schema.userKeywords.id,
      keyword: schema.userKeywords.keyword,
      kind: schema.userKeywords.kind,
      scope: schema.userKeywords.scope,
    })
    .from(schema.userKeywords)
    .where(eq(schema.userKeywords.userId, uid));
  return NextResponse.json({ keywords });
}

/** Add one keyword to a (scope, kind) list. Idempotent on the word. */
export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const keyword = String(body.keyword ?? "").trim().toLowerCase();
  const scope = body.scope as Scope;
  const kind = body.kind as Kind;
  if (!keyword || keyword.length > 80) {
    return NextResponse.json({ error: "Enter a role or keyword (max 80 chars)." }, { status: 400 });
  }
  if (!SCOPES.includes(scope) || !KINDS.includes(kind)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const group = await db
    .select({ id: schema.userKeywords.id, keyword: schema.userKeywords.keyword })
    .from(schema.userKeywords)
    .where(
      and(
        eq(schema.userKeywords.userId, uid),
        eq(schema.userKeywords.scope, scope),
        eq(schema.userKeywords.kind, kind),
      ),
    );
  const dup = group.find((g) => g.keyword === keyword);
  if (dup) return NextResponse.json({ ok: true, id: dup.id, keyword, scope, kind });
  if (group.length >= MAX_PER_GROUP) {
    return NextResponse.json({ error: `Up to ${MAX_PER_GROUP} per list.` }, { status: 400 });
  }

  const [row] = await db
    .insert(schema.userKeywords)
    .values({ userId: uid, keyword, kind, scope })
    .returning({ id: schema.userKeywords.id });
  return NextResponse.json({ ok: true, id: row.id, keyword, scope, kind });
}

/** Remove one keyword by id (scoped to the signed-in user). */
export async function DELETE(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  await db
    .delete(schema.userKeywords)
    .where(and(eq(schema.userKeywords.id, id), eq(schema.userKeywords.userId, uid)));
  return NextResponse.json({ ok: true });
}
