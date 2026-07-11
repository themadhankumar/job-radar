import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Logo } from "@/components/logo";
import { LandingDial } from "@/components/landing-dial";
import { getSessionUser } from "@/lib/auth";

export const revalidate = 3600; // live stats refresh hourly

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
    return { jobs: 6600, companies: 900, sponsors: 50000 };
  }
}

const fmt = (n: number) =>
  n >= 1000 ? `${Math.floor(n / 100) / 10}k`.replace(".0k", "k") : String(n);

export default async function Landing() {
  const user = await getSessionUser();
  if (user) redirect("/radar");
  const s = await stats();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost h-8 px-3 text-xs">Sign in</Link>
          <Link href="/signup" className="btn-primary h-8 px-3 text-xs">Get started</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-5xl items-center gap-12 px-6 pb-20 pt-14 sm:grid-cols-[1.2fr_1fr]">
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Your job search,<br />on radar.
          </h1>
          <p className="t-muted mt-5 max-w-md text-base leading-relaxed">
            Job Radar sweeps the boards every two hours, scores every posting
            against your actual resume on five signals, and tailors your
            materials per job. You see one number — and why.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link href="/signup" className="btn-primary h-10 px-5 text-sm">Start scanning</Link>
            <a href="#how" className="btn-ghost h-10 px-5 text-sm">How it works</a>
          </div>
          <div className="font-data t-muted mt-10 flex flex-wrap gap-x-8 gap-y-2 text-xs">
            <span><span className="t-accent">{fmt(s.jobs)}</span> postings swept</span>
            <span><span className="t-accent">{fmt(s.companies)}</span> companies</span>
            <span>sweeps every <span className="t-accent">2h</span></span>
          </div>
        </div>
        <div className="flex justify-center">
          <LandingDial target={87} />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="mb-8 text-sm font-semibold uppercase tracking-widest t-muted">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Sweep", "A pipeline pulls Greenhouse, Lever, Ashby, Workday, and LinkedIn into one corpus — every two hours, around the clock."],
            ["Score", "Five weighted signals — skills, role, work history, experience fit, industry — compress each posting into one honest match %."],
            ["Tailor", "A per-job studio chat rewrites your resume for the posting, drafts your screener answers, and shows a diff of every change."],
          ].map(([title, body], i) => (
            <div key={title} className="surface rounded-xl p-5">
              <span className="font-data t-accent text-xs">0{i + 1}</span>
              <h3 className="mb-2 mt-1 text-sm font-semibold">{title}</h3>
              <p className="t-muted text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature bento */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="mb-8 text-sm font-semibold uppercase tracking-widest t-muted">The instrument panel</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="surface rounded-xl p-5 sm:col-span-2">
            <h3 className="mb-2 text-sm font-semibold">One number, fully explained</h3>
            <p className="t-muted text-sm leading-relaxed">
              Every match % opens into its five components with the exact terms your
              resume is missing — so a low score is a to-do list, not a verdict.
            </p>
          </div>
          <div className="surface rounded-xl p-5">
            <h3 className="mb-2 text-sm font-semibold">H-1B sponsor signals</h3>
            <p className="t-muted text-sm leading-relaxed">
              Real USCIS approval data on <span className="font-data">{fmt(s.sponsors)}</span> employers, inline on every job.
            </p>
          </div>
          <div className="surface rounded-xl p-5">
            <h3 className="mb-2 text-sm font-semibold">Add any job by URL</h3>
            <p className="t-muted text-sm leading-relaxed">
              Paste a link from a recruiter DM — parsed, scored, and studio-ready.
            </p>
          </div>
          <div className="surface rounded-xl p-5">
            <h3 className="mb-2 text-sm font-semibold">Resume diff on every export</h3>
            <p className="t-muted text-sm leading-relaxed">
              See exactly what the tailoring changed, line by line, before you send it.
            </p>
          </div>
          <div className="surface rounded-xl p-5">
            <h3 className="mb-2 text-sm font-semibold">A 6 PM digest</h3>
            <p className="t-muted text-sm leading-relaxed">
              The day&apos;s new matches in one email, ranked by match %. No doomscrolling boards.
            </p>
          </div>
        </div>
      </section>

      {/* Stance */}
      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">We don&apos;t auto-apply.</h2>
        <p className="t-muted mx-auto mt-4 max-w-xl text-base leading-relaxed">
          Tools that fire five hundred applications a week are why hiring is drowning in noise.
          Job Radar stops at signal and materials: it finds the right postings, proves the fit,
          and prepares your strongest version. The send button stays yours — because the
          application with your name on it should have your judgment in it.
        </p>
      </section>

      {/* Build strip + footer */}
      <footer className="border-t border-[rgb(var(--hairline)/0.10)]">
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
