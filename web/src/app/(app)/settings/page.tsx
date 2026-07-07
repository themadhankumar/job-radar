import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { getUsage } from "@/lib/studio";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = (await getSessionUser())!;
  const [resume] = await db
    .select({ filename: schema.resumes.filename, fileKind: schema.resumes.fileKind })
    .from(schema.resumes)
    .where(eq(schema.resumes.userId, user.id));
  const usage = await getUsage(user.id);
  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="t-muted mb-6 text-sm">Signed in as {user.email}</p>
      <SettingsForm
        digestEnabled={user.digestEnabled}
        needsSponsorship={user.needsSponsorship}
        hasKey={Boolean(user.anthropicKeyEnc)}
        hasNotion={Boolean(user.notionTokenEnc)}
        notionDatabaseId={user.notionDatabaseId ?? ""}
        resumeFilename={resume?.filename ?? null}
        resumeKind={resume?.fileKind ?? null}
        usage={usage}
      />
    </div>
  );
}
