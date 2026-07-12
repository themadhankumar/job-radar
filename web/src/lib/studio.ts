import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt } from "@/lib/crypto";
import { htmlToText } from "@/lib/text";

export const STUDIO_MODEL_BYOK = "claude-opus-4-8";
export const STUDIO_MODEL_SHARED = "claude-haiku-4-5";
/** Studio model by tier: BYOK users get the frontier model, shared users get Haiku. */
export function studioModel(byok: boolean): string {
  return byok ? STUDIO_MODEL_BYOK : STUDIO_MODEL_SHARED;
}

// Monthly caps for users on the shared server key. BYOK users are uncapped (usage still tracked).
export const SHARED_CAP_IN = 100_000;
export const SHARED_CAP_OUT = 20_000;

export type ChatMsg = { role: "user" | "assistant"; content: string };

export function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Resolve which API key to use for this user. */
export function resolveKey(user: { anthropicKeyEnc: string | null }): { key: string | null; byok: boolean } {
  if (user.anthropicKeyEnc) {
    try {
      return { key: decrypt(user.anthropicKeyEnc), byok: true };
    } catch {
      /* fall through to shared */
    }
  }
  return { key: process.env.ANTHROPIC_API_KEY ?? null, byok: false };
}

/** Liveness check for a pasted key: one tiny call. Returns false only on a clear
 *  auth failure (401/403); network/other errors fail open so a transient hiccup
 *  never rejects a good key. */
export async function validateKey(key: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: STUDIO_MODEL_SHARED, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
    });
    return res.status !== 401 && res.status !== 403;
  } catch {
    return true;
  }
}

export async function getUsage(userId: number): Promise<{ tokensIn: number; tokensOut: number }> {
  const [row] = await db
    .select()
    .from(schema.userUsage)
    .where(and(eq(schema.userUsage.userId, userId), eq(schema.userUsage.month, monthKey())));
  return { tokensIn: row?.tokensIn ?? 0, tokensOut: row?.tokensOut ?? 0 };
}

/** Returns an error string if a shared-key user is over cap, else null. */
export async function checkCap(userId: number, byok: boolean): Promise<string | null> {
  if (byok) return null;
  const u = await getUsage(userId);
  if (u.tokensIn >= SHARED_CAP_IN || u.tokensOut >= SHARED_CAP_OUT) {
    return `You've used this month's free Studio allowance on Claude Haiku 4.5. Add your Anthropic API key in Settings to switch to Opus 4.8 and keep going — the free tier resets on the 1st.`;
  }
  return null;
}

export async function recordUsage(userId: number, tokensIn: number, tokensOut: number) {
  await db
    .insert(schema.userUsage)
    .values({ userId, month: monthKey(), tokensIn, tokensOut })
    .onConflictDoUpdate({
      target: [schema.userUsage.userId, schema.userUsage.month],
      set: {
        tokensIn: sql`${schema.userUsage.tokensIn} + ${tokensIn}`,
        tokensOut: sql`${schema.userUsage.tokensOut} + ${tokensOut}`,
      },
    });
}

export type StreamResult = { text: string; tokensIn: number; tokensOut: number };

/**
 * Call the Anthropic Messages API with streaming.
 * Invokes onDelta for each text chunk; resolves with full text + usage.
 */
export async function streamAnthropic(opts: {
  apiKey: string;
  model?: string;
  system: string;
  messages: ChatMsg[];
  maxTokens?: number;
  onDelta: (chunk: string) => void;
}): Promise<StreamResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? STUDIO_MODEL_SHARED,
      max_tokens: opts.maxTokens ?? 2000,
      stream: true,
      system: opts.system,
      messages: opts.messages,
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`anthropic ${res.status}: ${detail.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let tokensIn = 0;
  let tokensOut = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt: any;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
        text += evt.delta.text;
        opts.onDelta(evt.delta.text);
      } else if (evt.type === "message_start") {
        tokensIn = evt.message?.usage?.input_tokens ?? 0;
      } else if (evt.type === "message_delta") {
        tokensOut = evt.usage?.output_tokens ?? tokensOut;
      } else if (evt.type === "error") {
        throw new Error(evt.error?.message ?? "stream error");
      }
    }
  }
  return { text, tokensIn, tokensOut };
}

/** Non-streaming call — used by export. */
export async function callAnthropic(opts: {
  apiKey: string;
  model?: string;
  system: string;
  messages: ChatMsg[];
  maxTokens?: number;
}): Promise<StreamResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? STUDIO_MODEL_SHARED,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      messages: opts.messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`anthropic ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  return {
    text,
    tokensIn: data.usage?.input_tokens ?? 0,
    tokensOut: data.usage?.output_tokens ?? 0,
  };
}

export function studioSystemPrompt(job: {
  title: string;
  companyName: string;
  location: string;
  description: string;
}, resumeText: string): string {
  return [
    "You are Resume Studio inside Job Radar, helping the user tailor their resume to one specific job posting.",
    "Be direct and specific. Quantify suggestions where the resume supports it. Never invent experience the user doesn't have.",
    "",
    `## Job posting`,
    `Title: ${job.title}`,
    `Company: ${job.companyName}`,
    `Location: ${job.location || "n/a"}`,
    `Description: ${htmlToText(job.description).slice(0, 8000) || "(no description available — reason from the title)"}`,
    "",
    `## User's base resume (extracted text)`,
    resumeText.slice(0, 12000),
  ].join("\n");
}

export const GAP_ANALYSIS_PROMPT =
  "Give me a gap analysis for this job: 1) overall fit in one sentence with a rough percentage, 2) my strongest matching points, 3) what's missing or weak, 4) the 3–5 things my resume should highlight or reword for this specific posting. Keep it tight.";

/** Draft answers for the recurring application-form screener questions. */
export function screenerPackPrompt(needsSponsorship: boolean): string {
  return [
    "Draft copy-pasteable answers for the screener questions this application will almost certainly ask. For each, give a tight, first-person answer grounded in my actual resume — never invent experience. Format as short labeled sections I can paste one at a time:",
    "1) Why " + "this company (2–3 sentences, specific to what they do)",
    "2) Why this role / why me (2–3 sentences)",
    "3) Work authorization / sponsorship: " + (needsSponsorship
      ? "I will require visa sponsorship now or in the future — phrase this truthfully but confidently and matter-of-factly (use any authorization details my resume mentions); give me one short version and one longer version."
      : "I am authorized to work without sponsorship — one short truthful phrasing."),
    "4) Salary expectation: if the posting shows a pay range, anchor to it; otherwise give me a sensible range for this title/location and a deflection phrasing for when a number is required.",
    "5) Availability / start date: a standard two-weeks phrasing.",
    "6) A 2–3 sentence 'describe your relevant experience' blurb tailored to this posting.",
    "Keep the whole thing scannable — no preamble.",
  ].join("\n");
}
