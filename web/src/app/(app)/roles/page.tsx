import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { RolesManager } from "@/components/roles-manager";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = (await getSessionUser())!;
  const keywords = await db
    .select({
      id: schema.userKeywords.id,
      keyword: schema.userKeywords.keyword,
      kind: schema.userKeywords.kind,
      scope: schema.userKeywords.scope,
    })
    .from(schema.userKeywords)
    .where(eq(schema.userKeywords.userId, user.id));
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Roles</h1>
      <p className="t-muted mb-6 text-sm">
        The roles and keywords that drive your radars — separately for your watchlist (Tracked)
        and discovery (Global).
      </p>
      <RolesManager initial={keywords} />
    </div>
  );
}
