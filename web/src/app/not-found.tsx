import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="surface w-full max-w-sm rounded-2xl p-8 text-center">
        <span className="relative mx-auto mb-4 inline-flex h-8 w-8 opacity-60">
          <span className="absolute inset-0 rounded-full border-2 border-[rgb(var(--hairline)/0.25)]" />
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--accent)/0.7)]" />
        </span>
        <h1 className="mb-1 text-sm font-semibold">Nothing on the scope</h1>
        <p className="t-muted mb-5 text-sm">This page doesn&apos;t exist — the signal points elsewhere.</p>
        <Link href="/radar" className="btn-primary inline-flex h-9 items-center px-4 text-sm">Back to Radar</Link>
      </div>
    </div>
  );
}
