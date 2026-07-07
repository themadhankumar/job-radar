# Job Radar

A self-hosted job-search command center. A Python pipeline sweeps company job boards on a schedule (Greenhouse, Lever, Ashby, Workday, plus LinkedIn's guest feed), stores everything in Postgres, and a Next.js dashboard turns it into a personal radar: tracked-company matches, a global feed, statuses, filters, a daily 6 PM email digest, and optional per-user Notion sync. Multi-user — friends can sign up, onboard with their own resume/keywords/companies, and get their own radar.

## Architecture

```
GitHub Actions (2x daily)          Your Mac (launchd, optional)
  pipeline/main.py --no-linkedin     pipeline/main.py  (adds LinkedIn)
        │                                   │
        └────────────┬──────────────────────┘
                     ▼
              Neon Postgres  ◄────────  web/ (Next.js on Vercel)
                     │                    auth · onboarding · radar UI
                     ▼                    companies · settings (BYOK)
  GitHub Actions (6 PM Central)
  pipeline/digest.py ──► Resend ──► daily email digest
                     │
                     └──► per-user Notion push (optional)
```

- **`pipeline/`** — Python fetchers + Postgres writer. ATS boards run on GitHub Actions; LinkedIn runs locally (datacenter IPs get blocked).
- **`web/`** — Next.js 14 dashboard. Email+password auth (JWT cookie), 4-step onboarding, tracked/global tabs, status tracking, encrypted BYOK Anthropic keys and Notion tokens (AES-256-GCM).
- **Matching** — jobs from your watched companies match your include-keywords against title *or* description; the global LinkedIn feed matches title only; exclude-keywords always win.

## Deploy (once, ~20 minutes)

1. **Neon** — create a free project at neon.tech, copy the pooled connection string.
2. **Migrate** — locally: `cd web && npm install && DATABASE_URL=<neon-url> npm run db:migrate` (seeds the 14 verified companies).
3. **Vercel** — import the repo, set **Root Directory to `web/`**, add env vars:
   - `DATABASE_URL` — the Neon string
   - `AUTH_SECRET` — `openssl rand -hex 32`
   - `ENCRYPTION_KEY` — `openssl rand -hex 32` (32-byte hex; encrypts stored API keys)
   - `ANTHROPIC_API_KEY` — shared fallback key for resume chats (Phase 3)
4. **GitHub Actions secrets** (repo → Settings → Secrets → Actions):
   - `DATABASE_URL`, `ENCRYPTION_KEY` — same values as above
   - `RESEND_API_KEY` — free account at resend.com
   - `DIGEST_FROM` — e.g. `Job Radar <onboarding@resend.dev>` (sandbox) or a verified domain sender
   - `APP_URL` — your Vercel URL, e.g. `https://job-radar.vercel.app`
5. **Sign up** in the deployed app and run onboarding. Trigger the `radar-pipeline` workflow manually once to backfill.

> Resend sandbox note: `onboarding@resend.dev` can only email the address that owns the Resend account. Verify a domain (free) to deliver digests to other users.

## Local LinkedIn runner (optional but recommended)

```bash
cd pipeline && python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp ../web/.env.example .env   # set DATABASE_URL + ENCRYPTION_KEY (same as prod)
.venv/bin/python main.py      # full run including LinkedIn
```
Automate at noon daily: edit paths in `ops/com.madhankumar.jobradar.plist`, then
`cp ops/com.madhankumar.jobradar.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/com.madhankumar.jobradar.plist`

## Notion sync (optional, per user)

1. Create an integration at notion.so/my-integrations, copy the secret.
2. Create a database with properties: `Title` (title), `Company` (select), `Status` (select), `Source` (select), `URL` (url), `Location` (text), `Posted date` (date).
3. On the database page: ••• → Connections → add your integration.
4. Paste the secret + database ID into **Settings** in the dashboard. New matches push automatically each pipeline run.

## Schedules (UTC crons)

| Workflow | Cron | Central time |
|---|---|---|
| `radar-pipeline` | 13:30 & 22:00 | ~8:30 AM & ~5 PM |
| `daily-digest` | 23:00 | 6 PM (CDT) / 5 PM (CST) |

## Phase 2 features (live)

- **Match scores** — every fetched job is scored 0–100 against your resume (TF-IDF cosine + keyword hits + freshness). "Suggested" is the default radar sort; scores refresh each pipeline run.
- **Pay & YoE** — extracted from descriptions by regex; if `ANTHROPIC_API_KEY` is set as a GitHub Actions secret, ambiguous postings get one cheap Haiku pass (capped at 40/run).
- **H-1B sponsorship signal** — the job drawer shows an employer's USCIS approvals over the last 3 fiscal years. Import data once:
  1. Download fiscal-year CSVs from the [USCIS H-1B Employer Data Hub](https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub)
  2. `cd pipeline && DATABASE_URL=<neon-url> python h1b_import.py ~/Downloads/h1b_fy2025.csv ~/Downloads/h1b_fy2024.csv`
- **Resume-aware onboarding** — "Suggest from my resume" fills keywords + companies via Haiku (needs `ANTHROPIC_API_KEY` on Vercel).

## Roadmap

- **Phase 3 — Resume Studio**: per-job persistent AI chats that tailor your base resume (Opus 4.8 by default, BYOK or shared key), gap analysis, tailored .docx export.

## Dev

```bash
# web
cd web && npm install && npm run dev            # needs DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY
# pipeline
cd pipeline && python main.py --no-linkedin --no-notion
python digest.py                                 # needs RESEND_API_KEY to actually send
```
