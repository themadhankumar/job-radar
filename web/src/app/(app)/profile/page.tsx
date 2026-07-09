import { ProfileManager } from "@/components/profile-manager";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="mb-1 text-xl font-semibold">Profile</h1>
      <p className="t-muted mb-6 text-sm">
        Your skills, titles, and experience — parsed from your resume and editable here. Match
        scores, Studio, and role suggestions all read from this, so correct anything that parsed wrong.
      </p>
      <ProfileManager />
    </div>
  );
}
