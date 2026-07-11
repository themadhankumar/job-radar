"use client";

/* App-level error boundary — replaces Next's raw white "Application error"
   page with something on-brand and recoverable. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="surface w-full max-w-sm rounded-2xl p-8 text-center">
        <span className="relative mx-auto mb-4 inline-flex h-8 w-8 opacity-70">
          <span className="absolute inset-0 rounded-full border-2 border-[rgb(var(--danger)/0.4)]" />
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--danger))]" />
        </span>
        <h1 className="mb-1 text-sm font-semibold">Signal lost</h1>
        <p className="t-muted mb-5 text-sm">Something broke on this page. Your data is fine.</p>
        <button className="btn-primary h-9 px-4 text-sm" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
