"use client";
import { useState } from "react";
import { Handshake } from "lucide-react";
import {
  HeroAppFrame, MatchFragment, StudioFragment, SponsorFragment, AddUrlFragment, DigestFragment,
} from "@/components/landing-fragments";

type Slide = { eyebrow: string; title: string; body: string; visual: React.ReactNode };

/* Small standalone mock — no landing fragment exists for Referrals yet since
   it shipped after the landing page was built. Mirrors the real jobs-table
   row styling (handshake badge, ok-tinted left edge) rather than inventing a
   new visual language for one slide. */
function ReferralMini() {
  return (
    <div className="surface overflow-hidden rounded-xl">
      <div className="flex items-center justify-between gap-3 bg-[rgb(var(--ok)/0.05)] px-4 py-3 shadow-[inset_2px_0_0_rgb(var(--ok))]">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            Senior TPM, Platform <Handshake size={13} className="t-ok shrink-0" />
          </p>
          <p className="t-muted text-xs">Databricks · matched to your contact Priya · college friend</p>
        </div>
        <span className="chip t-ok shrink-0 border-[rgb(var(--ok)/0.35)]">Referral</span>
      </div>
    </div>
  );
}

function useSlides(): Slide[] {
  return [
    {
      eyebrow: "01 · Sweep & score",
      title: "Every posting, already scored.",
      body: "Your radar sweeps Greenhouse, Lever, Ashby, Workday, and LinkedIn every two hours and scores each posting against your resume — no more tab-hopping between job boards.",
      visual: <HeroAppFrame />,
    },
    {
      eyebrow: "02 · Score breakdown",
      title: "One number. Five reasons.",
      body: "Every match % opens into its five weighted signals — skills, role, work similarity, experience, industry — plus the exact terms your resume is missing.",
      visual: <MatchFragment />,
    },
    {
      eyebrow: "03 · Resume Studio",
      title: "Tailor your resume, per job.",
      body: "Open any posting into a chat that knows the job and your resume — gap analysis, screener answers, and a tailored export with a line-by-line diff of every change.",
      visual: <StudioFragment />,
    },
    {
      eyebrow: "04 · Sponsor signals",
      title: "Know who sponsors, before you apply.",
      body: "Every job carries real USCIS H-1B petition history — whether the employer sponsors, how many approvals, how recently. Saves you dead-end applications.",
      visual: <SponsorFragment />,
    },
    {
      eyebrow: "05 · A few extras",
      title: "Add by URL, a daily digest, and your referrals.",
      body: "Paste any posting link to add it instantly. Get one email at 6 PM instead of fifty tabs. And if you've got a contact at a company, log them under Referrals — matched postings jump straight to the top of your radar.",
      visual: (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <AddUrlFragment />
            <DigestFragment />
          </div>
          <ReferralMini />
        </div>
      ),
    },
  ];
}

export function ProductTour({ onDone, doneLabel = "Open my radar" }: { onDone: () => void; doneLabel?: string }) {
  const slides = useSlides();
  const [i, setI] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const total = slides.length + 1;
  const onKeySlide = i === slides.length;

  async function saveKeyAndFinish() {
    if (!apiKey.trim()) { onDone(); return; }
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anthropicKey: apiKey }),
    }).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(onDone, 900);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex gap-1.5">
          {Array.from({ length: total }).map((_, d) => (
            <span key={d} className={`h-1.5 w-6 rounded-full ${d <= i ? "bg-[rgb(var(--accent))]" : "bg-[rgb(var(--border))]"}`} />
          ))}
        </div>
        <button className="t-muted text-xs hover:text-[rgb(var(--text))]" onClick={onDone}>Skip tour</button>
      </div>

      {!onKeySlide ? (
        <section>
          <p className="font-data t-muted mb-2 text-xs">{slides[i].eyebrow}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{slides[i].title}</h1>
          <p className="t-muted mt-3 max-w-lg text-sm leading-relaxed">{slides[i].body}</p>
          <div className="mt-6">{slides[i].visual}</div>
          <div className="mt-8 flex justify-between">
            <button className="btn-ghost" onClick={() => (i > 0 ? setI(i - 1) : onDone())}>{i > 0 ? "Back" : "Skip tour"}</button>
            <button className="btn-primary" onClick={() => setI(i + 1)}>Next</button>
          </div>
        </section>
      ) : (
        <section>
          <p className="font-data t-muted mb-2 text-xs">06 · Optional</p>
          <h1 className="text-2xl font-semibold tracking-tight">One more thing — totally optional.</h1>
          <p className="t-muted mt-3 max-w-lg text-sm leading-relaxed">
            Resume Studio runs out of the box on a shared key, capped at 100k input / 20k output tokens a month across everyone. Add your own Anthropic API key — now or later in Settings — to remove that cap. Nothing is locked without one; this just raises the ceiling.
          </p>
          <div className="surface mt-6 rounded-xl p-5">
            {saved ? (
              <p className="t-ok text-sm font-medium">Key saved — you're uncapped.</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-… (optional)" className="input" />
                </div>
                <p className="t-muted mt-2 text-xs">Stored encrypted. You can add or change this later in Settings.</p>
              </>
            )}
          </div>
          <div className="mt-8 flex justify-between">
            <button className="btn-ghost" onClick={() => setI(i - 1)} disabled={saved}>Back</button>
            <button className="btn-primary" disabled={saving || saved} onClick={saveKeyAndFinish}>
              {saving ? "Saving…" : saved ? "Done" : apiKey.trim() ? "Save & finish" : doneLabel}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
