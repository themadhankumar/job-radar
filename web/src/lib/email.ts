/**
 * Minimal Resend sender via REST — no SDK dependency.
 * Requires RESEND_API_KEY and DIGEST_FROM (same names the pipeline digest uses).
 * Returns false when unconfigured or on send failure; caller decides how to surface it.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.DIGEST_FROM);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.DIGEST_FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[email]", res.status, await res.text().catch(() => ""));
    }
    return res.ok;
  } catch (e) {
    console.error("[email]", e);
    return false;
  }
}
