"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";

type Suggested = { id: number; name: string; ats: string };
type Picked = { id?: number; name: string; ats?: string; slug?: string; list: "dream" | "watch" };

const DEFAULT_KEYWORDS = [
  "ai data product manager", "data operations", "annotation",
  "technical program manager", "ml platform", "human in the loop",
  "data engine", "evaluation",
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // step 1 — resume
  const [resumeName, setResumeName] = useState("");
  // step 2 — keywords
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  // step 3 — companies
  const [suggested, setSuggested] = useState<Suggested[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [companyInput, setCompanyInput] = useState("");
  const [suggestedFromResume, setSuggestedFromResume] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);
  // step 4 — sponsorship
  const [needsSponsorship, setNeedsSponsorship] = useState(false);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => setSuggested(d.all ?? []))
      .catch(() => {});
  }, []);

  async function uploadResume(file: File) {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/resume", { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Upload failed.");
      return;
    }
    setResumeName(file.name);
  }

  function addKeyword() {
    const k = kwInput.trim().toLowerCase();
    if (k && !keywords.includes(k)) setKeywords([...keywords, k]);
    setKwInput("");
  }

  function toggleSuggested(c: Suggested) {
    setPicked((p) =>
      p.some((x) => x.id === c.id) ? p.filter((x) => x.id !== c.id) : [...p, { id: c.id, name: c.name, list: "watch" }],
    );
  }

  async function addCustomCompany() {
    const name = companyInput.trim();
    if (!name || picked.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
    setDetecting(true);
    setError("");
    const res = await fetch("/api/companies/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const { hit } = await res.json();
    setDetecting(false);
    setPicked([...picked, { name, ats: hit?.ats ?? "linkedin", slug: hit?.slug, list: "watch" }]);
    setCompanyInput("");
  }

  async function finish() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, excludeKeywords: [], needsSponsorship, companies: picked }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not save. Try again.");
      return;
    }
    router.push("/radar");
    router.refresh();
  }

  const steps = ["Resume", "Roles", "Companies", "Details"];

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="surface w-full max-w-lg rounded-xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full ${i <= step ? "bg-[rgb(var(--accent))]" : "bg-[rgb(var(--border))]"}`} />
            ))}
          </div>
        </div>

        {step === 0 && (
          <section>
            <h1 className="text-xl font-semibold">Upload your resume</h1>
            <p className="t-muted mb-4 mt-1 text-sm">It becomes the baseline for match scores and per-job tailoring. PDF, DOCX, TXT, or MD.</p>
            <label className="surface flex cursor-pointer flex-col items-center rounded-lg border-dashed p-8 text-sm hover:border-[rgb(var(--accent))]">
              <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
              {resumeName ? <span className="t-accent font-medium">✓ {resumeName}</span> : <span className="t-muted">{busy ? "Reading…" : "Click to choose a file"}</span>}
            </label>
            <div className="mt-6 flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(1)}>Skip for now</button>
              <button className="btn-primary" disabled={!resumeName} onClick={() => setStep(1)}>Continue</button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="text-xl font-semibold">What roles are you hunting?</h1>
            <p className="t-muted mb-4 mt-1 text-sm">Jobs matching any of these keywords surface on your radar.</p>
            {resumeName && (
              <button className="btn-ghost mb-3 text-[rgb(var(--accent))]" disabled={busy}
                onClick={async () => {
                  setBusy(true); setError("");
                  const r = await fetch("/api/onboarding/suggest", { method: "POST" });
                  const d = await r.json(); setBusy(false);
                  if (!r.ok) { setError(d.error ?? "No suggestions available."); return; }
                  setKeywords((k) => [...new Set([...k, ...d.keywords])]);
                  if (d.companies?.length) setSuggestedFromResume(d.companies);
                }}>
                {busy ? "Reading your resume…" : "✦ Suggest from my resume"}
              </button>
            )}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {DEFAULT_KEYWORDS.filter((k) => !keywords.includes(k)).map((k) => (
                <button key={k} className="chip t-muted hover:border-[rgb(var(--accent))]" onClick={() => setKeywords([...keywords, k])}>+ {k}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={kwInput} onChange={(e) => setKwInput(e.target.value)} placeholder="Add your own keyword"
                className="input" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())} />
              <button className="btn-ghost" onClick={addKeyword}>Add</button>
            </div>
            {keywords.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <button key={k} className="chip border-[rgb(var(--accent))] t-accent" onClick={() => setKeywords(keywords.filter((x) => x !== k))}>{k} ✕</button>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(0)}>Back</button>
              <button className="btn-primary" disabled={keywords.length === 0} onClick={() => setStep(2)}>Continue</button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-xl font-semibold">Companies to watch</h1>
            <p className="t-muted mb-4 mt-1 text-sm">Pick from the shared registry or add your own — the ATS is detected automatically.</p>
            <div className="mb-3 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {suggested.map((c) => {
                const on = picked.some((p) => p.id === c.id);
                return (
                  <button key={c.id} className={`chip ${on ? "border-[rgb(var(--accent))] t-accent" : "t-muted hover:border-[rgb(var(--accent))]"}`} onClick={() => toggleSuggested(c)}>
                    {on ? "✓ " : "+ "}{c.name}
                  </button>
                );
              })}
            </div>
            {suggestedFromResume.filter((n) => !picked.some((p) => p.name.toLowerCase() === n.toLowerCase())).length > 0 && (
              <div className="mb-3">
                <p className="t-muted mb-1.5 text-xs">From your resume:</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedFromResume.filter((n) => !picked.some((p) => p.name.toLowerCase() === n.toLowerCase())).map((n) => (
                    <button key={n} className="chip t-accent border-[rgb(var(--accent))]/40 hover:border-[rgb(var(--accent))]"
                      onClick={() => { setCompanyInput(n); }}>✦ {n}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input value={companyInput} onChange={(e) => setCompanyInput(e.target.value)} placeholder="Add a company (e.g. Databricks)"
                className="input" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomCompany())} />
              <button className="btn-ghost" disabled={detecting} onClick={addCustomCompany}>{detecting ? "Detecting…" : "Add"}</button>
            </div>
            {picked.filter((p) => !p.id).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {picked.filter((p) => !p.id).map((p) => (
                  <button key={p.name} className="chip border-[rgb(var(--accent))] t-accent" onClick={() => setPicked(picked.filter((x) => x.name !== p.name))}>
                    {p.name} · {p.ats === "linkedin" ? "via LinkedIn" : p.ats} ✕
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary" disabled={picked.length === 0} onClick={() => setStep(3)}>Continue</button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="text-xl font-semibold">One last thing</h1>
            <label className="surface mt-4 flex cursor-pointer items-start gap-3 rounded-lg p-4">
              <input type="checkbox" checked={needsSponsorship} onChange={(e) => setNeedsSponsorship(e.target.checked)} className="mt-0.5 accent-[rgb(var(--accent))]" />
              <span>
                <span className="block text-sm font-medium">I need visa sponsorship (H-1B or similar)</span>
                <span className="t-muted block text-sm">Your radar will surface each employer&apos;s sponsorship track record.</span>
              </span>
            </label>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            <div className="mt-6 flex justify-between">
              <button className="btn-ghost" onClick={() => setStep(2)}>Back</button>
              <button className="btn-primary" disabled={busy} onClick={finish}>{busy ? "Setting up…" : "Open my radar"}</button>
            </div>
          </section>
        )}
        {error && step !== 3 && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
