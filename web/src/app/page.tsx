import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Logo } from "@/components/logo";
import { LandingSweepLog } from "@/components/landing-hero-table";
import {
  HeroAppFrame, MatchFragment, StudioFragment,
  SponsorFragment, AddUrlFragment, DigestFragment, ReferralFragment,
} from "@/components/landing-fragments";
import { getSessionUser } from "@/lib/auth";
import { FeedbackWidget } from "@/components/feedback-widget";

export const revalidate = 3600;

async function stats() {
  try {
    const r = await db.execute(sql`
      SELECT (SELECT count(*) FROM jobs) AS jobs,
             (SELECT count(DISTINCT company_name) FROM jobs) AS companies,
             (SELECT count(*) FROM sponsors) AS sponsors`);
    const row = (r as unknown as { rows: Record<string, string>[] }).rows[0];
    return { jobs: Number(row.jobs), companies: Number(row.companies), sponsors: Number(row.sponsors) };
  } catch {
    return { jobs: 6600, companies: 900, sponsors: 137000 };
  }
}
const fmt = (n: number) => (n >= 1000 ? `${Math.floor(n / 100) / 10}k`.replace(".0k", "k") : String(n));

/* Section label: index in mono-muted, name in text, arrow muted. Violet is
   NOT used here anymore — it's reserved for scores. */
function Label({ n, children }: { n: string; children: React.ReactNode }) {
  return <p className="font-data t-muted mb-3 text-xs">{n} <span className="text-[rgb(var(--text))]">{children}</span> <span className="opacity-40">→</span></p>;
}

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

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16">
        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Every posting, scored against your resume.
        </h1>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <p className="t-muted max-w-md text-base leading-relaxed">
            Job Radar sweeps the boards every two hours and compresses each posting
            into one honest match % — with the five signals behind it.
          </p>
          <Link href="/signup" className="btn-primary h-10 px-5 text-sm">Start scanning</Link>
        </div>
        <div className="mt-10"><HeroAppFrame /></div>
        <div className="font-data t-muted mt-5 flex flex-wrap gap-x-8 gap-y-2 text-xs">
          <span><span className="text-[rgb(var(--text))]">{fmt(s.jobs)}</span> postings swept</span>
          <span><span className="text-[rgb(var(--text))]">{fmt(s.companies)}</span> companies watched</span>
          <span><span className="text-[rgb(var(--text))]">{fmt(s.sponsors)}</span> H-1B sponsor records</span>
        </div>
      </section>

      {/* 01 Sweep — offset: copy narrow-left, log wide-right */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pt-32 sm:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Label n="01">Sweep</Label>
          <h2 className="text-2xl font-semibold tracking-tight">Runs while you sleep.<br />And while you don&apos;t.</h2>
          <p className="t-muted mt-4 max-w-sm text-sm leading-relaxed">
            A pipeline pulls Greenhouse, Lever, Ashby, Workday, and LinkedIn into one
            corpus, extracts pay and experience, tags geography, and rescores everything
            against your profile — every two hours, around the clock.
          </p>
        </div>
        <LandingSweepLog />
      </section>

      {/* 02 Score — fragment left, copy right */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pt-32 sm:grid-cols-2">
        <MatchFragment />
        <div className="sm:order-first">
          <Label n="02">Score</Label>
          <h2 className="text-2xl font-semibold tracking-tight">One number.<br />Five reasons. Zero mystery.</h2>
          <p className="t-muted mt-4 max-w-sm text-sm leading-relaxed">
            Every match % opens into its five weighted components with the exact terms your
            resume is missing. A low score is a to-do list, not a verdict.
          </p>
        </div>
      </section>

      {/* 03 Tailor — copy left, studio right */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pt-32 sm:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Label n="03">Tailor</Label>
          <h2 className="text-2xl font-semibold tracking-tight">Your resume, rewritten per job. With receipts.</h2>
          <p className="t-muted mt-4 max-w-sm text-sm leading-relaxed">
            Every job opens into a chat that knows the posting and your resume. Gap analysis,
            screener answers — sponsorship phrasing included — and a tailored .tex or .docx
            export with a line-by-line diff of every change.
          </p>
        </div>
        <StudioFragment />
      </section>

      {/* 04 Sponsor — the differentiator, given real weight */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pt-32 sm:grid-cols-2">
        <SponsorFragment />
        <div className="sm:order-first">
          <Label n="04">Sponsor signals</Label>
          <h2 className="text-2xl font-semibold tracking-tight">Know who sponsors<br />before you apply.</h2>
          <p className="t-muted mt-4 max-w-sm text-sm leading-relaxed">
            Every job carries real USCIS H-1B petition history — whether the employer
            sponsors, how many approvals, how recently. If you need a visa, this is the
            filter that saves you a hundred dead-end applications. No other job tool has it.
          </p>
        </div>
      </section>

      {/* 05 Referrals — copy left, fragment right */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pt-32 sm:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Label n="05">Referrals</Label>
          <h2 className="text-2xl font-semibold tracking-tight">A warm intro beats<br />a cold application.</h2>
          <p className="t-muted mt-4 max-w-sm text-sm leading-relaxed">
            Log the people who can refer you — a friend, a former colleague, family. When a
            posting from their company hits your radar, it&apos;s pinned to the top and marked,
            so you never miss the one job you actually have a way into.
          </p>
        </div>
        <ReferralFragment />
      </section>

      {/* 06 — two small fragments side by side, breaks the rhythm */}
      <section className="mx-auto max-w-5xl px-6 pt-32">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <Label n="06">Add by URL</Label>
            <h3 className="text-lg font-semibold tracking-tight">A recruiter DM&apos;d you a link?</h3>
            <p className="t-muted mt-3 text-sm leading-relaxed">Paste it. Parsed, scored, and studio-ready — even from boards that block scrapers.</p>
            <div className="mt-5"><AddUrlFragment /></div>
          </div>
          <div>
            <Label n="07">Daily digest</Label>
            <h3 className="text-lg font-semibold tracking-tight">One email at 6 PM. Not fifty tabs.</h3>
            <p className="t-muted mt-3 text-sm leading-relaxed">The day&apos;s new matches, ranked, in your inbox. Stop refreshing job boards.</p>
            <div className="mt-5"><DigestFragment /></div>
          </div>
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="mx-auto mt-32 max-w-5xl px-6">
        <div className="surface overflow-hidden rounded-2xl px-8 py-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Put your search on radar.</h2>
          <p className="t-muted mx-auto mt-3 max-w-md text-sm">Free to use. Bring your own resume. See your first scores in minutes.</p>
          <Link href="/signup" className="btn-primary mt-6 inline-flex h-11 items-center px-6 text-sm">Get started</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-20 border-t border-[rgb(var(--hairline)/0.10)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="t-muted font-data mt-2 text-xs">Next.js · Postgres · Python pipeline · Claude Opus &amp; Haiku</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <Link href="/login" className="t-muted hover:text-[rgb(var(--text))]">Sign in</Link>
            <Link href="/signup" className="t-muted hover:text-[rgb(var(--text))]">Get started</Link>
            <a href="https://github.com/themadhankumar/job-radar" target="_blank" rel="noreferrer" className="t-muted hover:text-[rgb(var(--text))]">Source</a>
          </div>
        </div>
      </footer>
      <FeedbackWidget />
    </div>
  );
}
