"use client";
import { useEffect, useState } from "react";
import { Handshake, Info, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { track } from "@/lib/track";

type Experience = {
  companyName: string;
  companyId: number | null;
  role: string;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
};

type Contact = {
  id: number;
  name: string;
  experiences: Experience[];
  relationship: string;
  contactDetails: string | null;
  status: "not_asked" | "asked" | "referred" | "declined";
  warmth: "warm" | "cold" | null;
  notes: string | null;
};

type Company = { id: number; name: string };

const STATUSES = ["not_asked", "asked", "referred", "declined"] as const;
const STATUS_LABEL: Record<string, string> = { not_asked: "Not asked", asked: "Asked", referred: "Referred", declined: "Declined" };

const EMPTY_EXPERIENCE: Experience = { companyName: "", companyId: null, role: "", isCurrent: false, startDate: "", endDate: "" };
const EMPTY_FORM = { id: 0, name: "", experiences: [{ ...EMPTY_EXPERIENCE }] as Experience[], relationship: "", contactDetails: "", notes: "" };

/** Current experience (or most recent) for the table's Company column. */
function primaryExperience(experiences: Experience[]): Experience | null {
  if (experiences.length === 0) return null;
  return experiences.find((e) => e.isCurrent) ?? experiences[0];
}

export default function ReferralsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [profileText, setProfileText] = useState("");
  const [parsing, setParsing] = useState(false);

  async function load() {
    const [c, co] = await Promise.all([
      fetch("/api/referrals").then((r) => r.json()),
      fetch("/api/companies").then((r) => r.json()),
    ]);
    setContacts(c.contacts ?? []);
    setCompanies(co.all ?? []);
  }
  useEffect(() => { load(); }, []);

  function startAdd() {
    setForm(EMPTY_FORM);
    setProfileText("");
    setErr("");
    setOpen(true);
  }
  function startEdit(c: Contact) {
    setForm({
      id: c.id,
      name: c.name,
      experiences: c.experiences.length ? c.experiences : [{ ...EMPTY_EXPERIENCE }],
      relationship: c.relationship,
      contactDetails: c.contactDetails ?? "",
      notes: c.notes ?? "",
    });
    setProfileText("");
    setErr("");
    setOpen(true);
  }

  function updateExperience(i: number, fields: Partial<Experience>) {
    setForm((f) => ({ ...f, experiences: f.experiences.map((e, idx) => (idx === i ? { ...e, ...fields } : e)) }));
  }
  function addExperience() {
    setForm((f) => ({ ...f, experiences: [...f.experiences, { ...EMPTY_EXPERIENCE }] }));
  }
  function removeExperience(i: number) {
    setForm((f) => ({ ...f, experiences: f.experiences.filter((_, idx) => idx !== i) }));
  }

  async function parseProfile() {
    if (profileText.trim().length < 50) { setErr("Paste more of the profile — that looks too short."); return; }
    setParsing(true);
    setErr("");
    const res = await fetch("/api/referrals/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: profileText }),
    });
    const data = await res.json().catch(() => ({}));
    setParsing(false);
    if (!res.ok) { setErr(data.error ?? "Couldn't parse that — add the roles manually instead."); return; }
    setForm((f) => ({
      ...f,
      name: f.name || data.name || "",
      experiences: data.experiences.map((e: Experience) => ({
        companyName: e.companyName,
        companyId: companies.find((c) => c.name.toLowerCase() === e.companyName.toLowerCase())?.id ?? null,
        role: e.role,
        isCurrent: e.isCurrent,
        startDate: e.startDate,
        endDate: e.endDate,
      })),
    }));
  }

  async function save() {
    const experiences = form.experiences.filter((e) => e.companyName.trim());
    if (!form.name.trim() || !form.relationship.trim() || experiences.length === 0) {
      setErr("Name, relationship, and at least one employer are required.");
      return;
    }
    setBusy(true);
    setErr("");
    const wasNew = !form.id;
    const resolved = experiences.map((e) => ({
      ...e,
      companyId: companies.find((c) => c.name.toLowerCase() === e.companyName.trim().toLowerCase())?.id ?? null,
    }));
    const body = { ...form, experiences: resolved };
    const res = await fetch("/api/referrals", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "Could not save — try again."); return; }
    if (wasNew) track("referral_add", { companyId: resolved[0]?.companyId ?? null });
    setOpen(false);
    load();
  }

  async function remove(id: number) {
    setContacts((cs) => cs.filter((c) => c.id !== id));
    await fetch("/api/referrals", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  }

  async function patch(id: number, fields: Partial<Contact>) {
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, ...fields } : c)));
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    await fetch("/api/referrals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, ...fields }),
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="mb-1.5 text-2xl font-semibold tracking-tight">Referrals</h1>
        <button className="btn-primary h-8 px-3 text-xs" onClick={startAdd}>+ Add contact</button>
      </div>
      <p className="t-muted mb-8 text-sm">
        People who can refer you in. Matched postings on the Radar are pinned to the top and marked <Handshake size={12} className="inline t-ok" />.
      </p>

      {contacts.length === 0 ? (
        <div className="surface rounded-xl p-8 text-center">
          <p className="t-muted text-sm">No referral contacts yet — add the people who can get you in the door.</p>
        </div>
      ) : (
        <section className="surface overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgb(var(--border))] text-left">
                <th className="t-muted px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.08em]">Name</th>
                <th className="t-muted px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.08em]">Company</th>
                <th className="t-muted px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.08em]">Relationship</th>
                <th className="t-muted px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.08em]">
                  <span className="inline-flex items-center gap-1">
                    Warmth
                    <span title="Warm = they know you and would gladly refer you. Cold = a distant or one-time connection — worth asking, but not a sure thing.">
                      <Info size={11} />
                    </span>
                  </span>
                </th>
                <th className="t-muted px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.08em]">Status</th>
                <th className="px-2" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const primary = primaryExperience(c.experiences);
                const moreCount = c.experiences.length - (primary ? 1 : 0);
                return (
                <tr key={c.id} className="border-b border-[rgb(var(--hairline)/0.10)] last:border-0">
                  <td className="px-5 py-3.5 font-medium">{c.name}{primary?.role && <span className="t-muted font-normal"> · {primary.role}</span>}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span>{primary?.companyName ?? "—"}</span>
                      {c.experiences.filter((e) => e !== primary).map((e, i) => (
                        <span key={i} className="t-muted text-xs">{e.companyName}{i < moreCount - 1 ? "," : ""}</span>
                      ))}
                    </div>
                  </td>
                  <td className="t-muted px-5 py-3.5">{c.relationship}</td>
                  <td className="px-5 py-3.5">
                    <select value={c.warmth ?? ""} onChange={(e) => patch(c.id, { warmth: (e.target.value || null) as Contact["warmth"] })}
                      className={`rounded-full border border-transparent bg-[rgb(var(--surface-2))] px-2.5 py-1 text-xs transition-colors duration-150 hover:border-[rgb(var(--border))] ${c.warmth === "warm" ? "t-ok" : c.warmth === "cold" ? "t-muted" : "t-muted"}`}>
                      <option value="">—</option>
                      <option value="warm">Warm</option>
                      <option value="cold">Cold</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5">
                    <select value={c.status} onChange={(e) => patch(c.id, { status: e.target.value as Contact["status"] })}
                      className="t-muted rounded-full border border-transparent bg-[rgb(var(--surface-2))] px-2.5 py-1 text-xs transition-colors duration-150 hover:border-[rgb(var(--border))] hover:text-[rgb(var(--text))]">
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1">
                      <button aria-label={`Edit ${c.name}`} className="t-muted rounded p-1.5 transition-colors duration-150 hover:text-[rgb(var(--accent))]" onClick={() => startEdit(c)}><Pencil size={14} /></button>
                      <button aria-label={`Remove ${c.name}`} className="t-muted rounded p-1.5 transition-colors duration-150 hover:text-[rgb(var(--danger))]" onClick={() => remove(c.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="surface max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{form.id ? "Edit contact" : "Add a referral contact"}</h2>
              <button aria-label="Close" onClick={() => setOpen(false)} className="t-muted hover:text-inherit"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name *" className="input w-full" autoFocus />
              <input value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))} placeholder="Relationship * (e.g. college friend, cousin)" className="input w-full" />
              <input value={form.contactDetails} onChange={(e) => setForm((f) => ({ ...f, contactDetails: e.target.value }))} placeholder="Contact details (email, phone, LinkedIn…)" className="input w-full" />

              <div className="surface-2 rounded-lg p-3">
                <p className="t-muted mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em]">Paste LinkedIn profile (optional)</p>
                <textarea value={profileText} onChange={(e) => setProfileText(e.target.value)}
                  placeholder="Copy their name and Experience section from LinkedIn and paste it here…"
                  className="input min-h-20 w-full text-sm" />
                <button type="button" className="btn-ghost mt-2 inline-flex h-7 items-center gap-1.5 px-2.5 text-xs" disabled={parsing} onClick={parseProfile}>
                  <Sparkles size={12} /> {parsing ? "Parsing…" : "Parse work history"}
                </button>
              </div>

              <div className="space-y-2">
                <p className="t-muted text-[11px] font-medium uppercase tracking-[0.08em]">Employers *</p>
                {form.experiences.map((e, i) => (
                  <div key={i} className="space-y-1.5 rounded-lg border border-[rgb(var(--border))] p-2">
                    <div className="flex gap-1.5">
                      <input value={e.companyName} onChange={(ev) => updateExperience(i, { companyName: ev.target.value })}
                        placeholder="Company *" className="input h-8 min-w-0 flex-[3] text-sm" list="referral-companies" />
                      <input value={e.role} onChange={(ev) => updateExperience(i, { role: ev.target.value })}
                        placeholder="Role" className="input h-8 min-w-0 flex-[2] text-sm" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input value={e.startDate} onChange={(ev) => updateExperience(i, { startDate: ev.target.value })}
                        placeholder="Start (e.g. Mar 2022)" className="input h-8 w-28 text-sm" />
                      <input value={e.endDate} onChange={(ev) => updateExperience(i, { endDate: ev.target.value })}
                        placeholder="End" disabled={e.isCurrent} className="input h-8 w-28 text-sm disabled:opacity-50" />
                      <label className="t-muted flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={e.isCurrent} onChange={(ev) => updateExperience(i, { isCurrent: ev.target.checked, endDate: ev.target.checked ? "" : e.endDate })} />
                        Current
                      </label>
                      <button type="button" aria-label="Remove role" className="t-muted ml-auto rounded p-1 hover:text-[rgb(var(--danger))]" onClick={() => removeExperience(i)}><X size={13} /></button>
                    </div>
                  </div>
                ))}
                <datalist id="referral-companies">
                  {companies.map((c) => <option key={c.id} value={c.name} />)}
                </datalist>
                <button type="button" className="btn-ghost h-7 px-2.5 text-xs" onClick={addExperience}>+ Add role</button>
              </div>

              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="input min-h-16 w-full text-sm" />
              {err && <p className="t-danger text-xs">{err}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button className="btn-ghost h-8 px-3 text-xs" onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn-primary h-8 px-3 text-xs" disabled={busy} onClick={save}>{busy ? "Saving…" : form.id ? "Save" : "Add contact"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
