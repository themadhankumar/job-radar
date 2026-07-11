"""Daily email digest — new matched postings per user, sent via Resend.

Runs at 6 PM Central via GitHub Actions (23:00 UTC). For each user with the
digest enabled, collects jobs created since their last digest (fallback 24h)
that match their keywords/companies, and sends one clean email.

Env: DATABASE_URL, RESEND_API_KEY, DIGEST_FROM (e.g. "Job Radar <radar@yourdomain.com>"
or the sandbox sender "Job Radar <onboarding@resend.dev>"), APP_URL.
"""
from __future__ import annotations

import html
import os
import sys
from datetime import timedelta

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import requests

import db as dbm
from output import console

# Keep in sync with web/src/lib/score-tier.ts (recalibrated 2026-07-10
# against real post-rescore distribution: p99=49, p97=43, p95=40, p90=34).
SCORE_TIER_HI = 42
SCORE_TIER_MID = 30


def render_email(name: str, jobs: list[dict], app_url: str) -> str:
    rows = []
    for j in jobs[:25]:
        posted = j["posted_at"].strftime("%b %d") if j.get("posted_at") else ""
        score = j.get("score")
        badge = (
            f'<span style="float:right;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;'
            f'color:{"#059669" if score >= SCORE_TIER_HI else "#b45309" if score >= SCORE_TIER_MID else "#71717a"};'
            f'border:1px solid currentColor;">{round(score)}%</span>'
        ) if score is not None else ""
        rows.append(
            f"""<tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e4e4e7;">
                {badge}<a href="{html.escape(j['url'])}" style="color:#0f766e;font-weight:600;text-decoration:none;">{html.escape(j['title'])}</a>
                <div style="color:#71717a;font-size:13px;margin-top:2px;">
                  {html.escape(j['company_name'])}{' · ' + html.escape(j['location'][:60]) if j.get('location') else ''}{' · ' + posted if posted else ''}
                </div>
              </td>
            </tr>"""
        )
    more = f"<p style='color:#71717a;font-size:13px;'>…and {len(jobs) - 25} more on your radar.</p>" if len(jobs) > 25 else ""
    return f"""
    <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <p style="font-size:15px;color:#18181b;">Hi {html.escape(name)} — <strong>{len(jobs)} new matching {'role' if len(jobs) == 1 else 'roles'}</strong> appeared on your radar today.</p>
      <table style="width:100%;border:1px solid #e4e4e7;border-radius:12px;border-collapse:separate;border-spacing:0;overflow:hidden;">{''.join(rows)}</table>
      {more}
      <p style="margin-top:20px;"><a href="{html.escape(app_url)}/radar" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;">Open Job Radar</a></p>
      <p style="color:#a1a1aa;font-size:12px;margin-top:24px;">You get this once a day at 6 PM. Turn it off any time in Settings.</p>
    </div>"""


def main() -> int:
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        console.print("[yellow]RESEND_API_KEY not set — skipping digest.[/yellow]")
        return 0
    sender = os.environ.get("DIGEST_FROM", "Job Radar <onboarding@resend.dev>")
    app_url = os.environ.get("APP_URL", "http://localhost:3000")

    conn = dbm.connect()
    sent = 0
    for user in dbm.users_for_digest(conn):
        since = dbm.last_digest_at(conn, user["id"]) or (dbm.utcnow() - timedelta(hours=24))
        jobs = dbm.user_matched_jobs_since(conn, user["id"], since)
        if user.get("us_only"):
            jobs = [j for j in jobs if j.get("country") != "intl"]
        if not jobs:
            console.print(f"[dim]{user['email']}: nothing new, no email[/dim]")
            continue
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "from": sender,
                "to": [user["email"]],
                "subject": f"{len(jobs)} new {'role' if len(jobs) == 1 else 'roles'} on your radar",
                "html": render_email(user["name"], jobs, app_url),
            },
            timeout=25,
        )
        if resp.status_code in (200, 201):
            dbm.log_digest(conn, user["id"], len(jobs))
            sent += 1
            console.print(f"[green]{user['email']}: digest sent ({len(jobs)} jobs)[/green]")
        else:
            console.print(f"[red]{user['email']}: Resend error {resp.status_code} {resp.text[:150]}[/red]")
    conn.close()
    console.print(f"\n[bold]{sent} digest(s) sent.[/bold]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
