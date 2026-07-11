import Link from "next/link";

/* Empty state idiom: a quiet radar scope mark, one line of copy, one action.
   The mark is the Logo's ring without the ping — still, because nothing is
   being swept; the accent dot stays as the "signal will appear here" promise. */
export function EmptyState({
  line,
  actionHref,
  actionLabel,
}: {
  line: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="surface mt-4 flex flex-col items-center gap-3 rounded-xl px-6 py-14 text-center">
      <span className="relative inline-flex h-8 w-8 opacity-60">
        <span className="absolute inset-0 rounded-full border-2 border-[rgb(var(--hairline)/0.25)]" />
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--accent)/0.7)]" />
      </span>
      <p className="t-muted max-w-md text-sm">{line}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="t-accent text-sm underline-offset-4 hover:underline">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
