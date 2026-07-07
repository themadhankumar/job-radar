import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

export const runtime = "nodejs";

async function extractText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  if (name.endsWith(".txt") || name.endsWith(".md")) return buf.toString("utf8");
  if (name.endsWith(".pdf")) {
    const { extractText } = await import("unpdf");
    const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
    return text;
  }
  throw new Error("unsupported");
}

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000) {
    return NextResponse.json({ error: "Upload a resume under 5 MB." }, { status: 400 });
  }
  try {
    const content = (await extractText(file)).trim();
    if (content.length < 100) {
      return NextResponse.json({ error: "Couldn't read enough text from that file. Try a .docx, .pdf, or .txt export." }, { status: 422 });
    }
    await db
      .insert(schema.resumes)
      .values({ userId: uid, filename: file.name, content })
      .onConflictDoUpdate({
        target: schema.resumes.userId,
        set: { filename: file.name, content, updatedAt: new Date() },
      });
    return NextResponse.json({ ok: true, chars: content.length });
  } catch {
    return NextResponse.json({ error: "Use a .pdf, .docx, .txt, or .md file." }, { status: 415 });
  }
}
