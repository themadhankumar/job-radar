"use client";
import { useEffect, useState } from "react";
import { Handshake, Info, Pencil, Trash2, X } from "lucide-react";
import { track } from "@/lib/track";

type Contact = {
  id: number;
  name: string;
  companyName: string;
  companyId: number | null;
  role: string | null;
  relationship: string;
  contactDetails: string | null;
  status: "not_asked" | "asked" | "referred" | "declined";
  warmth: "warm" | "cold" | null;
  notes: string | null;
};

type Company = { id: number; name: string };

const STATUSES = ["not_asked", "asked", "referred", "declined"] as const;
const STATUS_LABEL: Record<string, string> = { not_asked: "Not asked", asked: "Asked", referred: "Referred", declined: "Declined" };

const EMPTY_FORM = { id: 0, name: "", companyName: "", companyId: null as number | null, role: "", relationship: "", contactDetails: "", notes: "" };

export default function ReferralsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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
    setErr("");
    setOpen(true);
  }
  function startEdit(c: Contact) {
    setForm({ id: c.id, name: c.name, companyName: c.companyName, companyId: c.companyId, role: c.role ?? "", relationship: c.relationship, contactDetails: c.contactDetails ?? "", notes: c.notes ?? "" });
    setErr("");
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.companyName.trim() || !form.relationship.trim()) {
      setErr("Name, company, and relationship are required.");
      return;
    }
    setBusy(true);
    setErr("");
    const wasNew = !form.id;
    const match = companies.find((c) => c.name.toLowerCase() === form.companyName.trim().toLowerCase());
    const body = { ...form, companyId: match?.id ?? null };
    const res = await fetch("/api/referrals", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "Could not save — try again."); return; }
    if (wasNew) track("referral_add", { companyId: match?.id ?? null });
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
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-[rgb(var(--hairline)/0.10)] last:border-0">
                  <td className="px-5 py-3.5 font-medium">{c.name}{c.role && <span className="t-muted font-normal"> · {c.role}</span>}</td>
                  <td className="px-5 py-3.5">{c.companyName}</td>
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
              ))}
            </tbody>
          </table>
        </section>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="surface w-full max-w-md rounded-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{form.id ? "Edit contact" : "Add a referral contact"}</h2>
              <button aria-label="Close" onClick={() => setOpen(false)} className="t-muted hover:text-inherit"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name *" className="input w-full" autoFocus />
              <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="Company *" className="input w-full" list="referral-companies" />
              <datalist id="referral-companies">
                {companies.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
              <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Their role (optional)" className="input w-full" />
              <input value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))} placeholder="Relationship * (e.g. college friend, cousin)" className="input w-full" />
              <input value={form.contactDetails} onChange={(e) => setForm((f) => ({ ...f, contactDetails: e.target.value }))} placeholder="Contact details (email, phone, LinkedIn…)" className="input w-full" />
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
