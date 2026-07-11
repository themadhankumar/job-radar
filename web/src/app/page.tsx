import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Logo } from "@/components/logo";
import { LandingHeroTable, LandingSweepLog } from "@/components/landing-hero-table";
import { getSessionUser } from "@/lib/auth";

export const revalidate = 3600;

async function stats() {
  try {
    const r = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM jobs) AS jobs,
        (SELECT count(DISTINCT company_name) FROM jobs) AS companies,
        (SELECT count(*) FROM sponsors) AS sponsors
    `);
    const row = (r as unknown as { rows: Record<string, string>[] }).rows[0];
    return { jobs: Number(row.jobs), companies: Number(row.companies), sponsors: Number(row.sponsors) };
  } catch {
    return { jobs: 6600, companies: 900, sponsors: 137000 };
  }
}

const fmt = (n: number) => (n >= 1000 ? `${Math.floor(n / 100) / 10}k`.replace(".0k", "k") : String(n));

export default async function Landing() {
  const user = await getSessionUser();
  if (user) redirect("/radar");
  const s = await stats();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost h-8 px-3 text-xs">Sign in</Link>
          <Link href="/signup" className="btn-primary h-8 px-3 text-xs">Get started</Link>
        </div>
      </header>

      {/* Hero — headline over the product itself */}
      <section className="mx-auto max-w-5xl px-6 pt-16">
        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Every posting, scored against <span className="t-accent">your</span> resume.
        </h1>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <p className="t-muted max-w-md text-base leading-relaxed">
            Job Radar sweeps the boards every two hours and compresses each
            posting into one honest match % — with the five signals behind it.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/signup" className="btn-primary h-10 px-5 text-sm">Start scanning</Link>
          </div>
        </div>
        <div className="mt-10">
          <LandingHeroTable />
        </div>
        <div className="font-data t-muted mt-5 flex flex-wrap gap-x-8 gap-y-2 text-xs">
          <span><span className="t-accent">{fmt(s.jobs)}</span> postings swept</span>
          <span><span className="t-accent">{fmt(s.companies)}</span> companies watched</span>
          <span><span className="t-accent">{fmt(s.sponsors)}</span> H-1B sponsor records</span>
        </div>
      </section>

      {/* The sweep — pipeline made visible */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pt-28 sm:grid-cols-2">
        <div>
          <p className="font-data t-accent mb-3 text-xs uppercase tracking-widest">The sweep</p>
          <h2 className="text-2xl font-semibold tracking-tight">Runs while you sleep.<br />And while you don&apos;t.</h2>
          <p className="t-muted mt-4 max-w-sm text-sm leading-relaxed">
            A pipeline pulls Greenhouse, Lever, Ashby, Workday, and LinkedIn into one
            corpus, extracts pay and experience, tags geography, and rescores everything
            against your profile — every two hours, around the clock. A 6&nbsp;PM digest
            delivers the day&apos;s signal so you never doomscroll a board again.
          </p>
        </div>
        <LandingSweepLog />
      </section>

      {/* The studio — tailor + prove it */}
      <section className="mx-auto max-w-5xl px-6 pt-28">
        <p className="font-data t-accent mb-3 text-xs uppercase tracking-widest">The studio</p>
        <div className="grid gap-10 sm:grid-cols-2">
          <h2 className="text-2xl font-semibold tracking-tight">Your resume, rewritten per job. With receipts.</h2>
          <div className="t-muted space-y-4 text-sm leading-relaxed">
            <p>
              Every job opens into a chat that knows the posting and your resume. It runs
              a gap analysis, drafts your screener answers — sponsorship phrasing included —
              and exports a tailored .tex or .docx.
            </p>
            <p>
              Every export ships with a line-by-line diff, so you see exactly what changed
              before it leaves with your name on it. A low match % isn&apos;t a verdict either:
              it opens into five components with the exact terms you&apos;re missing.
            </p>
          </div>
        </div>
      </section>

      {/* Stance */}
      <section className="mx-auto max-w-5xl px-6 pt-28">
        <div className="max-w-2xl border-l-2 border-[rgb(var(--accent))] pl-6">
          <h2 className="text-2xl font-semibold tracking-tight">We don&apos;t auto-apply.</h2>
          <p className="t-muted mt-4 text-sm leading-relaxed">
            Tools that fire five hundred applications a week are why hiring is drowning
            in noise. Job Radar stops at signal and materials: it finds the right postings,
            proves the fit, and prepares your strongest version. The send button stays
            yours — because the application with your name on it should have your judgment in it.
          </p>
        </div>
      </section>

      {/* Build strip + footer */}
      <footer className="mt-28 border-t border-[rgb(var(--hairline)/0.10)]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-sm font-medium">Built solo, in the open.</p>
            <p className="t-muted font-data mt-1 text-xs">
              Next.js · Postgres · Python pipeline · Claude Opus &amp; Haiku
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://github.com/themadhankumar/job-radar" className="btn-ghost h-8 px-3 text-xs" target="_blank" rel="noreferrer">
              Read the source
            </a>
            <Link href="/signup" className="btn-primary h-8 px-3 text-xs">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
