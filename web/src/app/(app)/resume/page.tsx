import { ResumeManager } from "@/components/resume-manager";

export const dynamic = "force-dynamic";

export default function ResumePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Resume</h1>
      <p className="t-muted mb-6 text-sm">
        Your base resume — the file Studio tailors and the matcher reads. Manage the parsed
        profile (skills, titles, experience) on the Profile tab.
      </p>
      <ResumeManager />
    </div>
  );
}
