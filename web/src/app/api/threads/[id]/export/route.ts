import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { callAnthropic, checkCap, recordUsage, resolveKey, studioSystemPrompt } from "@/lib/studio";
import {
  buildCleanDocx,
  docxParagraphs,
  editDocx,
  stripJsonFences,
  type CleanResume,
} from "@/lib/resume-export";

export const runtime = "nodejs";
export const maxDuration = 60;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Produce a job-tailored resume file. Format depends on what the user originally uploaded. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const threadId = Number(params.id);

  const [thread] = await db
    .select()
    .from(schema.resumeThreads)
    .where(and(eq(schema.resumeThreads.id, threadId), eq(schema.resumeThreads.userId, user.id)));
  if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

  const { key, byok } = resolveKey(user);
  if (!key) return NextResponse.json({ error: "No API key available — add yours in Settings." }, { status: 503 });
  const capError = await checkCap(user.id, byok);
  if (capError) return NextResponse.json({ error: capError }, { status: 429 });

  const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, thread.jobId));
  const [resume] = await db.select().from(schema.resumes).where(eq(schema.resumes.userId, user.id));
  if (!job || !resume) return NextResponse.json({ error: "Missing job or resume." }, { status: 400 });

  // Recent Studio discussion steers the rewrite.
  const history = await db
    .select({ role: schema.resumeMessages.role, content: schema.resumeMessages.content })
    .from(schema.resumeMessages)
    .where(eq(schema.resumeMessages.threadId, threadId))
    .orderBy(asc(schema.resumeMessages.createdAt), asc(schema.resumeMessages.id));
  const discussion = history
    .slice(-8)
    .map((m) => `${m.role}: ${m.content === "__gap_analysis__" ? "(requested gap analysis)" : m.content}`)
    .join("\n")
    .slice(0, 6000);

  const system = studioSystemPrompt(job, resume.content);
  const guardrails =
    "Tailor the resume toward this job. Reword, reorder, and emphasize — but NEVER invent employers, titles, dates, degrees, or skills not present in the base resume. Incorporate any direction from the discussion below.\n\nDiscussion so far:\n" +
    (discussion || "(none)");
  const base = `${job.companyName}-${job.title}`;

  try {
    /* ------------------------------------------------------------- .tex */
    if (resume.fileKind === "tex" && resume.fileB64) {
      const original = Buffer.from(resume.fileB64, "base64").toString("utf8");
      const result = await callAnthropic({
        apiKey: key,
        system,
        maxTokens: 8000,
        messages: [{
          role: "user",
          content:
            guardrails +
            "\n\nBelow is my resume's LaTeX source. Return the COMPLETE revised .tex file — identical preamble, packages, custom commands, and structure; change only the content text. Reply with ONLY the LaTeX source, no fences, no commentary.\n\n" +
            original.slice(0, 40000),
        }],
      });
      await recordUsage(user.id, result.tokensIn, result.tokensOut);
      const tex = result.text.trim().replace(/^```(?:latex|tex)?/i, "").replace(/```$/, "").trim();
      if (!tex.includes("\\documentclass")) throw new Error("model did not return latex");
      return new Response(tex, {
        headers: {
          "Content-Type": "application/x-tex; charset=utf-8",
          "Content-Disposition": `attachment; filename="resume-${slug(base)}.tex"`,
          "X-Tokens-In": String(result.tokensIn),
          "X-Tokens-Out": String(result.tokensOut),
        },
      });
    }

    /* ------------------------------------------------------------ .docx */
    if (resume.fileKind === "docx" && resume.fileB64) {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(Buffer.from(resume.fileB64, "base64"));
      const xml = await zip.file("word/document.xml")!.async("string");
      const paras = docxParagraphs(xml).filter((p) => p.text.trim().length > 0);
      const numbered = paras.map((p) => `[${p.index}] ${p.text}`).join("\n").slice(0, 30000);
      const result = await callAnthropic({
        apiKey: key,
        system,
        maxTokens: 6000,
        messages: [{
          role: "user",
          content:
            guardrails +
            '\n\nBelow are my resume\'s paragraphs, each with an index. Return ONLY JSON: {"replacements": [{"i": <index>, "text": "<full new paragraph text>"}]} for paragraphs you would change. Keep replacement text similar in length to the original (formatting must not overflow). Do not include unchanged paragraphs. Never change the paragraph containing my name or contact info.\n\n' +
            numbered,
        }],
      });
      await recordUsage(user.id, result.tokensIn, result.tokensOut);
      const parsed = JSON.parse(stripJsonFences(result.text));
      const map = new Map<number, string>();
      for (const r of parsed.replacements ?? []) {
        if (Number.isInteger(r.i) && typeof r.text === "string") map.set(r.i, r.text);
      }
      if (map.size === 0) throw new Error("no replacements returned");
      const buf = await editDocx(resume.fileB64, map);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="resume-${slug(base)}.docx"`,
          "X-Tokens-In": String(result.tokensIn),
          "X-Tokens-Out": String(result.tokensOut),
        },
      });
    }

    /* --------------------------------------- .pdf / .txt → clean rebuild */
    const result = await callAnthropic({
      apiKey: key,
      system,
      maxTokens: 6000,
      messages: [{
        role: "user",
        content:
          guardrails +
          '\n\nRewrite my resume tailored to this job. Return ONLY JSON: {"name": "...", "contact": "one line: email · phone · location · links", "sections": [{"heading": "...", "items": [{"title": "...", "subtitle": "company · dates", "bullets": ["..."], "text": "optional plain text instead of bullets"}]}]}. Use the same facts as my base resume.',
      }],
    });
    await recordUsage(user.id, result.tokensIn, result.tokensOut);
    const clean = JSON.parse(stripJsonFences(result.text)) as CleanResume;
    if (!clean?.name || !Array.isArray(clean.sections)) throw new Error("bad resume json");
    const buf = await buildCleanDocx(clean);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="resume-${slug(base)}.docx"`,
        "X-Tokens-In": String(result.tokensIn),
        "X-Tokens-Out": String(result.tokensOut),
      },
    });
  } catch (err) {
    console.error("studio export:", err);
    return NextResponse.json({ error: "Export failed — try again, or re-upload your resume in Settings." }, { status: 502 });
  }
}
