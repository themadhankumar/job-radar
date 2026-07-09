import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { getUsage } from "@/lib/studio";
import { SettingsForm } from "@/components/settings-form";
import { RolesManager } from "@/components/roles-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = (await getSessionUser())!;
  const usage = await getUsage(user.id);
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
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="t-muted mb-6 text-sm">Signed in as {user.email}</p>
      <SettingsForm
        digestEnabled={user.digestEnabled}
        usOnly={user.usOnly}
        needsSponsorship={user.needsSponsorship}
        hasKey={Boolean(user.anthropicKeyEnc)}
        hasNotion={Boolean(user.notionTokenEnc)}
        notionDatabaseId={user.notionDatabaseId ?? ""}
        usage={usage}
      />
      <RolesManager initial={keywords} />
    </div>
  );
}
