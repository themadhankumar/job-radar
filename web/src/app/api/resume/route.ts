import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

export const runtime = "nodejs";

type Kind = "docx" | "pdf" | "tex" | "txt";

function kindOf(name: string): Kind | null {
  const n = name.toLowerCase();
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".tex")) return "tex";
  if (n.endsWith(".txt") || n.endsWith(".md")) return "txt";
  return null;
}

/** Rough LaTeX → text: drop comments/preamble noise, unwrap common commands. */
function latexToText(src: string): string {
  return src
    .replace(/(?<!\\)%.*$/gm, "")
    .replace(/\\(?:documentclass|usepackage|newcommand|renewcommand|definecolor|geometry|pagestyle|setlength|titleformat|titlespacing)\b(?:\[[^\]]*\]|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*/g, " ")
    .replace(/\\(?:begin|end)\{[^}]*\}/g, " ")
    .replace(/\\(?:href|url)\{([^}]*)\}(?:\{([^}]*)\})?/g, (_m, a, b) => b ?? a)
    .replace(/\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?/g, " ")
    .replace(/[{}~]/g, " ")
    .replace(/\\\\/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractText(file: File, kind: Kind, buf: Buffer): Promise<string> {
  if (kind === "docx") {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  if (kind === "txt") return buf.toString("utf8");
  if (kind === "tex") return latexToText(buf.toString("utf8"));
  const { extractText } = await import("unpdf");
  const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
  return text;
}

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000) {
    return NextResponse.json({ error: "Upload a resume under 5 MB." }, { status: 400 });
  }
  const kind = kindOf(file.name);
  if (!kind) return NextResponse.json({ error: "Use a .pdf, .docx, .tex, .txt, or .md file." }, { status: 415 });
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const content = (await extractText(file, kind, buf)).trim();
    if (content.length < 100) {
      return NextResponse.json({ error: "Couldn't read enough text from that file. Try a .docx, .pdf, .tex, or .txt export." }, { status: 422 });
    }
    // Keep the original for docx/tex so Studio exports can preserve formatting.
    const fileB64 = kind === "docx" || kind === "tex" ? buf.toString("base64") : null;
    await db
      .insert(schema.resumes)
      .values({ userId: uid, filename: file.name, content, fileB64, fileKind: kind })
      .onConflictDoUpdate({
        target: schema.resumes.userId,
        set: { filename: file.name, content, fileB64, fileKind: kind, updatedAt: new Date() },
      });
    return NextResponse.json({ ok: true, chars: content.length, kind });
  } catch {
    return NextResponse.json({ error: "Use a .pdf, .docx, .tex, .txt, or .md file." }, { status: 415 });
  }
}
