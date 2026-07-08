import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUserId } from "@/lib/auth";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  tex: "application/x-tex; charset=utf-8",
};

/** Download the stored base resume — original bytes for docx/tex, extracted text otherwise. */
export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const [resume] = await db.select().from(schema.resumes).where(eq(schema.resumes.userId, uid));
  if (!resume) return NextResponse.json({ error: "No resume uploaded." }, { status: 404 });

  if (resume.fileB64 && (resume.fileKind === "docx" || resume.fileKind === "tex")) {
    const buf = Buffer.from(resume.fileB64, "base64");
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[resume.fileKind],
        "Content-Disposition": `attachment; filename="${resume.filename.replace(/[^\w.\- ]/g, "_")}"`,
      },
    });
  }
  // pdf/txt uploads only keep extracted text
  return new Response(resume.content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="resume-extracted.txt"`,
    },
  });
}
