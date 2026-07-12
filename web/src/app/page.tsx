import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Job Radar | Score Every Job Against Your Resume, With Visa Sponsorship Signals",
  description:
    "Job Radar is a free job search tool that scores every posting against your resume, shows real H1B visa sponsorship history, and tracks your referral contacts. Apply where you're most qualified, not everywhere.",
  openGraph: {
    title: "Job Radar | Score Every Job Against Your Resume",
    description:
      "A free job search tool that scores every posting against your resume, surfaces real visa sponsorship history, and tracks your referral contacts.",
    type: "website",
  },
};

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
          Apply where you&apos;re most qualified. Not everywhere.
        </h1>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <p className="t-muted max-w-md text-base leading-relaxed">
            Job Radar is a job search tool that scores every posting against your resume
            and gives you one honest match percentage. It ranks the roles you&apos;re actually
            qualified for and pins the jobs where you already know someone to the top.
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
            A pipeline pulls Greenhouse, Lever, Ashby, Workday, and LinkedIn into one place
            every two hours. It reads pay and experience, tags location, and rescores every
            posting against your profile, so your radar is current the moment you open it.
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
            Every resume match score opens into five weighted signals covering skills, role,
            work fit, experience, and industry, plus the exact keywords your resume is missing.
            You spend your time on the jobs you&apos;d actually get instead of guessing.
          </p>
        </div>
      </section>

      {/* 03 Tailor — copy left, studio right */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pt-32 sm:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Label n="03">Tailor</Label>
          <h2 className="text-2xl font-semibold tracking-tight">Your resume, rewritten per job. With receipts.</h2>
          <p className="t-muted mt-4 max-w-sm text-sm leading-relaxed">
            Every posting opens into a chat that already knows the job and your resume. You get
            gap analysis, screener answers with sponsorship phrasing built in, and a tailored
            resume export with a clear diff of every change before you send anything.
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
            Every job carries real USCIS petition history, so you can see whether the employer
            sponsors visas, how many approvals they filed, and how recently. If you need visa
            sponsorship, this is the filter that saves you a hundred dead end applications.
            No other job search tool surfaces it.
          </p>
        </div>
      </section>

      {/* 05 Referrals — copy left, fragment right */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pt-32 sm:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Label n="05">Referrals</Label>
          <h2 className="text-2xl font-semibold tracking-tight">Skip the line<br />where you know someone.</h2>
          <p className="t-muted mt-4 max-w-sm text-sm leading-relaxed">
            Track the people who can refer you, whether it&apos;s a friend, a former colleague,
            or family. The moment a role opens at their company, it jumps to the top of your radar,
            marked and ready. A warm referral beats a cold application every time, and this is the
            one opening you can&apos;t afford to miss.
          </p>
        </div>
        <ReferralFragment />
      </section>

      {/* 06 — two small fragments side by side, breaks the rhythm */}
      <section className="mx-auto max-w-5xl px-6 pt-32">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <Label n="06">Add by URL</Label>
            <h3 className="text-lg font-semibold tracking-tight">A recruiter sent you a link?</h3>
            <p className="t-muted mt-3 text-sm leading-relaxed">Paste it. Job Radar parses it, scores it against your resume, and gets it studio ready, even for boards that block scrapers.</p>
            <div className="mt-5"><AddUrlFragment /></div>
          </div>
          <div>
            <Label n="07">Daily digest</Label>
            <h3 className="text-lg font-semibold tracking-tight">One email at 6 PM. Not fifty tabs.</h3>
            <p className="t-muted mt-3 text-sm leading-relaxed">Your best new matches, ranked, delivered once a day. Stop refreshing job boards.</p>
            <div className="mt-5"><DigestFragment /></div>
          </div>
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="mx-auto mt-32 max-w-5xl px-6">
        <div className="surface overflow-hidden rounded-2xl px-8 py-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Apply smarter. Not more.</h2>
          <p className="t-muted mx-auto mt-3 max-w-md text-sm">Job Radar is free to use. Bring your own resume and see your first match scores and your shortlist in minutes.</p>
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
