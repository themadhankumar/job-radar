import { ResumeManager } from "@/components/resume-manager";

export const dynamic = "force-dynamic";

export default function ResumePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Resume</h1>
      <p className="t-muted mb-6 text-sm">
        Your base resume and the profile parsed from it. Match scores, Studio, and suggestions all read from this — correct anything that parsed wrong.
      </p>
      <ResumeManager />
    </div>
  );
}
