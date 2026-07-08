"use client";
import { useState } from "react";

export function SettingsForm(props: {
  digestEnabled: boolean;
  needsSponsorship: boolean;
  usOnly: boolean;
  hasKey: boolean;
  hasNotion: boolean;
  notionDatabaseId: string;
  usage: { tokensIn: number; tokensOut: number };
}) {
  const [digest, setDigest] = useState(props.digestEnabled);
  const [sponsor, setSponsor] = useState(props.needsSponsorship);
  const [usOnly, setUsOnly] = useState(props.usOnly);
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

  return (
    <div className="space-y-6">
      <section className="surface rounded-xl p-5">
        <h2 className="mb-3 text-sm font-semibold">Preferences</h2>
        <label className="flex cursor-pointer items-center justify-between py-2 text-sm">
          <span>Daily email digest at 6 PM<span className="t-muted block text-xs">New matches from the last 24 hours, delivered once a day.</span></span>
          <input type="checkbox" checked={digest} className="accent-[rgb(var(--accent))]"
            onChange={(e) => { setDigest(e.target.checked); save({ digestEnabled: e.target.checked }, "Digest preference"); }} />
        </label>
        <label className="flex cursor-pointer items-center justify-between py-2 text-sm">
          <span>I need visa sponsorship<span className="t-muted block text-xs">Shows employer sponsorship signals on job details.</span></span>
          <input type="checkbox" checked={sponsor} className="accent-[rgb(var(--accent))]"
            onChange={(e) => { setSponsor(e.target.checked); save({ needsSponsorship: e.target.checked }, "Sponsorship preference"); }} />
        </label>
        <label className="flex cursor-pointer items-center justify-between py-2 text-sm">
          <span>US roles only<span className="t-muted block text-xs">Hides clearly international postings everywhere — radar tabs, Suggested, and the email digest. Ambiguous locations (plain "Remote") stay visible.</span></span>
          <input type="checkbox" checked={usOnly} className="accent-[rgb(var(--accent))]"
            onChange={(e) => { setUsOnly(e.target.checked); save({ usOnly: e.target.checked }, "US-only preference"); }} />
        </label>
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
        <h2 className="mb-1 text-sm font-semibold">Studio usage this month</h2>
        <p className="t-muted text-xs">
          {props.usage.tokensIn.toLocaleString()} input · {props.usage.tokensOut.toLocaleString()} output tokens
          {!props.hasKey && " — shared key caps: 100,000 in / 20,000 out per month."}
        </p>
      </section>

      {saved && <p className="t-accent text-sm">{saved}</p>}
    </div>
  );
}
