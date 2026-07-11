import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { rateLimit, clientIp, RATE_LIMITED } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const TYPES = new Set(["bug", "idea", "other"]);
const TYPE_LABEL: Record<string, string> = { bug: "Bug", idea: "Idea", other: "Other" };

export async function POST(req: Request) {
  const ip = clientIp(req);
  // Generous but bounded — legit dogfooding won't hit this, spam bursts will.
  const allowed = await rateLimit(`feedback:${ip}`, 10, 3600);
  if (!allowed) return NextResponse.json(RATE_LIMITED, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim().slice(0, 2000);
  if (!message) return NextResponse.json({ error: "Say a bit more first." }, { status: 400 });
  const type = TYPES.has(body.type) ? body.type : "other";
  const pagePath = body.pagePath ? String(body.pagePath).slice(0, 200) : null;
  const email = body.email ? String(body.email).trim().slice(0, 200) : null;

  // Client already downscales before sending; this is a hard server-side
  // backstop (~3MB decoded) against anything that slips through.
  let imageB64: string | null = null;
  let imageMime: string | null = null;
  if (typeof body.imageB64 === "string" && typeof body.imageMime === "string" && body.imageMime.startsWith("image/")) {
    if (body.imageB64.length > 4_000_000) {
      return NextResponse.json({ error: "Screenshot is too large — try a smaller crop." }, { status: 400 });
    }
    imageB64 = body.imageB64;
    imageMime = body.imageMime;
  }

  const user = await getSessionUser();

  const [row] = await db
    .insert(schema.feedback)
    .values({ userId: user?.id ?? null, email, type, message, pagePath, imageB64, imageMime })
    .returning({ id: schema.feedback.id });

  const notifyTo = process.env.FEEDBACK_NOTIFY_EMAIL;
  if (notifyTo) {
    const from = user ? `${user.name} <${user.email}>` : email ? email : "anonymous visitor";
    const ext = imageMime === "image/png" ? "png" : "jpg";
    await sendEmail(
      notifyTo,
      `[Job Radar] ${TYPE_LABEL[type]} feedback`,
      `<p><strong>${TYPE_LABEL[type]}</strong> from ${esc(from)}${pagePath ? ` on <code>${esc(pagePath)}</code>` : ""}</p><p>${esc(message).replace(/\n/g, "<br/>")}</p>${imageB64 ? "<p>(screenshot attached)</p>" : ""}`,
      imageB64 ? [{ filename: `screenshot.${ext}`, content: imageB64 }] : undefined,
    ).catch((e) => console.error("[feedback email]", e));
  }

  return NextResponse.json({ ok: true, id: row.id });
}
