"use client";
import { useState } from "react";

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200 ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg))] ${
        checked
          ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent))]"
          : "border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]"
      }`}
    >
      <span
        className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white transition-[left,box-shadow] duration-200 ease-[var(--ease)] ${
          checked ? "left-[18px] shadow-[0_0_8px_rgb(var(--glow)/0.6)]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[rgb(var(--hairline)/0.10)] py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        <p className="t-muted text-xs">{hint}</p>
      </div>
      {children}
    </div>
  );
}

export function SettingsForm(props: {
  digestEnabled: boolean;
  needsSponsorship: boolean;
  usOnly: boolean;
  suggestedThreshold: number;
  hasKey: boolean;
  hasNotion: boolean;
  notionDatabaseId: string;
  usage: { tokensIn: number; tokensOut: number };
}) {
  const [digest, setDigest] = useState(props.digestEnabled);
  const [sponsor, setSponsor] = useState(props.needsSponsorship);
  const [usOnly, setUsOnly] = useState(props.usOnly);
  const [threshold, setThreshold] = useState(props.suggestedThreshold);
  const [apiKey, setApiKey] = useState("");
  const [notionToken, setNotionToken] = useState("");
  const [notionDb, setNotionDb] = useState(props.notionDatabaseId);
  const [saved, setSaved] = useState("");

  async function save(body: Record<string, unknown>, label: string) {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaved(res.ok ? `${label} saved` : "Could not save — try again");
    setTimeout(() => setSaved(""), 2500);
  }

  const CAP_IN = 100_000;
  const CAP_OUT = 20_000;
  const pctIn = Math.min(100, Math.round((props.usage.tokensIn / CAP_IN) * 100));
  const pctOut = Math.min(100, Math.round((props.usage.tokensOut / CAP_OUT) * 100));

  return (
    <div className="space-y-6">
      <section className="surface rounded-xl p-5">
        <h2 className="mb-1 text-sm font-semibold">Preferences</h2>
        <div>
          <Row label="Daily email digest at 6 PM" hint="New matches from the last 24 hours, delivered once a day.">
            <Switch checked={digest} onChange={(v) => { setDigest(v); save({ digestEnabled: v }, "Digest preference"); }} />
          </Row>
          <Row label="I need visa sponsorship" hint="Shows employer sponsorship signals on job details.">
            <Switch checked={sponsor} onChange={(v) => { setSponsor(v); save({ needsSponsorship: v }, "Sponsorship preference"); }} />
          </Row>
          <Row label="US roles only" hint='Hides clearly international postings everywhere — radar tabs, Suggested, and the email digest. Ambiguous locations (plain "Remote") stay visible.'>
            <Switch checked={usOnly} onChange={(v) => { setUsOnly(v); save({ usOnly: v }, "US-only preference"); }} />
          </Row>
          <div className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Suggested match bar</p>
                <p className="t-muted text-xs">Jobs need at least this match % to appear on the Suggested tab.</p>
              </div>
              <span className="score-mid w-12 shrink-0 text-right text-sm">{threshold}%</span>
            </div>
            <input type="range" min={10} max={90} step={5} value={threshold}
              className="mt-3 w-full accent-[rgb(var(--accent))]"
              onChange={(e) => setThreshold(Number(e.target.value))}
              onMouseUp={() => save({ suggestedThreshold: threshold }, "Suggested threshold")}
              onTouchEnd={() => save({ suggestedThreshold: threshold }, "Suggested threshold")} />
          </div>
        </div>
      </section>

      <section className="surface rounded-xl p-5">
        <h2 className="mb-1 text-sm font-semibold">Anthropic API key {props.hasKey && <span className="chip t-accent ml-2">configured</span>}</h2>
        <p className="t-muted mb-3 text-xs">Powers your resume tailoring chats. Stored encrypted. Leave empty to use the shared key with usage caps.</p>
        <div className="flex gap-2">
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-…" className="input" />
          <button className="btn-ghost" onClick={() => { save({ anthropicKey: apiKey }, "API key"); setApiKey(""); }}>Save</button>
        </div>
      </section>

      <section className="surface rounded-xl p-5">
        <h2 className="mb-1 text-sm font-semibold">Notion sync {props.hasNotion && <span className="chip t-accent ml-2">configured</span>}</h2>
        <p className="t-muted mb-3 text-xs">New matches are pushed to your Notion database, and status changes follow. Optional.</p>
        <div className="space-y-2">
          <input type="password" value={notionToken} onChange={(e) => setNotionToken(e.target.value)} placeholder="Notion integration secret" className="input" />
          <div className="flex gap-2">
            <input value={notionDb} onChange={(e) => setNotionDb(e.target.value)} placeholder="Notion database ID" className="input" />
            <button className="btn-ghost" onClick={() => { save({ notionToken, notionDatabaseId: notionDb }, "Notion settings"); setNotionToken(""); }}>Save</button>
          </div>
        </div>
      </section>

      <section className="surface rounded-xl p-5">
        <h2 className="mb-3 text-sm font-semibold">Studio usage this month</h2>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="t-muted">Input</span>
              <span className="font-data t-muted">{props.usage.tokensIn.toLocaleString()}{!props.hasKey && ` / ${CAP_IN.toLocaleString()}`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--hairline)/0.12)]">
              <div className="h-full rounded-full bg-[rgb(var(--accent))]" style={{ width: props.hasKey ? "100%" : `${pctIn}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="t-muted">Output</span>
              <span className="font-data t-muted">{props.usage.tokensOut.toLocaleString()}{!props.hasKey && ` / ${CAP_OUT.toLocaleString()}`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--hairline)/0.12)]">
              <div className="h-full rounded-full bg-[rgb(var(--accent))]" style={{ width: props.hasKey ? "100%" : `${pctOut}%` }} />
            </div>
          </div>
          {props.hasKey && <p className="t-muted text-xs">Using your own key — uncapped, tracked for reference only.</p>}
        </div>
      </section>

      {saved && <p className="t-accent text-sm transition-opacity duration-200 ease-[var(--ease)]">{saved}</p>}
    </div>
  );
}
