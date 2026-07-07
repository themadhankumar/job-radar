export function Logo({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className="relative inline-flex" style={{ width: size, height: size }}>
        <span className="absolute inset-0 rounded-full border-2 border-[rgb(var(--accent))]" />
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--accent))]" />
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--accent))] animate-radar-ping" />
      </span>
      Job Radar
    </span>
  );
}

export function NewDot() {
  return (
    <span className="relative mr-1.5 inline-flex h-1.5 w-1.5 shrink-0">
      <span className="absolute inline-flex h-full w-full rounded-full bg-[rgb(var(--accent))] animate-radar-ping" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" />
    </span>
  );
}
