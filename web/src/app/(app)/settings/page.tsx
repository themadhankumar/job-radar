import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { getUsage, resolveKey } from "@/lib/studio";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = (await getSessionUser())!;
  const usage = await getUsage(user.id);
  const { key: activeKey, byok } = resolveKey(user);
  const keyHint = byok && activeKey ? activeKey.slice(-4) : null;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="t-muted mb-6 text-sm">Signed in as {user.email}</p>
      <SettingsForm
        digestEnabled={user.digestEnabled}
        region={user.region ?? "us"}
        suggestedThreshold={user.suggestedThreshold ?? 35}
        digestSources={user.digestSources ?? ["greenhouse","lever","ashby","workday","linkedin"]}
        needsSponsorship={user.needsSponsorship}
        hasKey={Boolean(user.anthropicKeyEnc)}
        byok={byok}
        keyHint={keyHint}
        hasNotion={Boolean(user.notionTokenEnc)}
        notionDatabaseId={user.notionDatabaseId ?? ""}
        usage={usage}
      />
    </div>
  );
}
