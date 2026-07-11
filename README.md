# Job Radar

**A job-search command center that scores every posting against your resume, tailors your application per role, and tells you who sponsors visas — before you spend an hour applying.**

🔗 **Live:** [job-radar-jade.vercel.app](https://job-radar-jade.vercel.app) *(free — sign up with your own resume to see your radar)*

---

Modern job search is a firehose. Hundreds of postings a week across a dozen boards, no way to tell a 90%-fit role from a long shot without reading each one, and — if you need visa sponsorship — no way to know which employers even sponsor until you've already applied. Job Radar collapses that into a single surface: one honest **match %** per job, fully explained, with the tailoring and sponsorship signals sitting right next to it.

It's built to do one thing well and stop there. It finds the right roles and prepares your strongest application — but the **send** button stays human. No auto-submission, no CAPTCHA evasion, no spraying 500 applications a week. That's a deliberate line: the tools that automate applying are why hiring is drowning in noise, and being on the right side of that is worth more than the convenience.

## What it does

**Sweeps every two hours.** A Python pipeline pulls Greenhouse, Lever, Ashby, and Workday boards plus LinkedIn's guest feed into one corpus, extracts pay and years-of-experience, tags geography, and rescores everything against your profile — around the clock, so the radar is current whenever you open it.

**Scores each posting five ways.** Every job gets a 0–100 match built from five weighted signals — skills (30%), role title (25%), résumé↔posting work similarity via TF-IDF cosine (20%), experience fit (15%), and industry (10%). The score opens into its full breakdown plus the exact terms your résumé is missing, so a low match reads as a to-do list, not a verdict.

**Tailors your résumé per job.** Any posting opens into a persistent AI chat that already knows the job description and your résumé — gap analysis, screener-question answers (sponsorship phrasing included), and a tailored `.tex` or `.docx` export with a line-by-line diff of every change. Powered by Claude Opus for the chat, Haiku for all the cheap background work.

**Surfaces H-1B sponsorship, inline.** Every job carries real USCIS petition history — whether the employer sponsors, how many approvals, how recently — pulled from the government's Employer Data Hub. If you need a visa, this is the filter that saves you a hundred dead-end applications. No other job tool has it.

**Tracks your referrals.** Log the people who can refer you — a friend, a former colleague, family. When a posting from their company hits the radar, it's pinned to the top and marked, so you never miss the one job you actually have a way into.

**Plus the quality-of-life layer:** add any job by URL (parsed and scored instantly, even from boards that block scrapers), a single ranked email digest at 6 PM instead of fifty open tabs, saved filter presets, a US-only toggle, and optional one-way Notion sync.

## How it's built

```
GitHub Actions (every 2h)              Your machine (launchd, optional)
  pipeline/main.py --no-linkedin         pipeline/main.py  (adds LinkedIn)
        │                                       │
        └──────────────┬──────────────────────-┘
                        ▼
   fetch → extract pay/YoE → geo-tag → 5-signal match → optional Notion push
                        ▼
                 Neon Postgres  ◄────────  web/ (Next.js 14 on Vercel)
                        │                    landing · auth · onboarding + tour
                        ▼                    radar · companies · referrals
   GitHub Actions (6 PM Central)             resume studio · profile · settings
   pipeline/digest.py ──► Resend ──► daily ranked email digest
```

- **`web/`** — Next.js 14 (App Router, RSC), Tailwind, Drizzle ORM. Email+password auth over a JWT cookie, encrypted at-rest storage (AES-256-GCM) for per-user Anthropic keys and Notion tokens, Postgres-backed rate limiting, 13 idempotent SQL migrations. Streaming SSE for the resume chat.
- **`pipeline/`** — Python fetchers + a pluggable matcher. ATS boards run on GitHub Actions; the LinkedIn fetcher runs locally because datacenter IPs get blocked. The scoring layer is designed so a real embedding backend can replace the TF-IDF similarity function without touching callers.
- **Model routing** — Claude Opus 4.x for the interactive résumé studio; Claude Haiku for all bulk work (profile parsing, company classification, pay/YoE extraction). Users bring their own key or fall back to a shared key with monthly caps.

## A few design decisions I'd call out

Building this solo meant every product and engineering call was mine to make. A few I'd defend in an interview:

- **One number, fully explained — not a black box.** Early versions showed a raw score; it was meaningless without context. Replacing it with a five-component breakdown (and the specific missing keywords) turned the score from a judgment into an actionable diff. The tier thresholds were then recalibrated against the *actual* score distribution in the database, not assumed cutoffs — the real data clustered far lower than intuition suggested.
- **Stop at signal, not submission.** The obvious "next feature" is auto-apply. I deliberately didn't build it — it's a short-term convenience that degrades the whole hiring ecosystem, and the differentiated value is in *discovery and preparation*, not volume.
- **Sponsorship as a first-class signal.** For a huge slice of job-seekers, "does this company sponsor?" is the single most important filter and no mainstream tool surfaces it. Wiring USCIS data inline was a small data-engineering lift for outsized user value — the kind of asymmetric bet worth looking for.
- **Ship pattern that can't corrupt prod.** Migrate the database first, then merge, then smoke-test against production — schema and app never drift, and a bad migration never ships behind working code.

*Built by [Madhan Kumar Manoharan](https://github.com/themadhankumar) — a technical program manager who wanted a job-search tool sharp enough to use daily and honest enough to show a hiring manager.*

---

## Run it yourself

<details>
<summary><strong>Deploy (once, ~20 minutes)</strong></summary>

1. **Neon** — create a free project at [neon.tech](https://neon.tech), copy the pooled connection string.
2. **Migrate** — `cd web && npm install && DATABASE_URL=<neon-url> npm run db:migrate` (seeds a starter set of verified companies).
3. **Vercel** — import the repo, set **Root Directory to `web/`**, add env vars:
   - `DATABASE_URL` — the Neon string
   - `AUTH_SECRET` — `openssl rand -hex 32`
   - `ENCRYPTION_KEY` — `openssl rand -hex 32` (32-byte hex; encrypts stored API keys)
   - `ANTHROPIC_API_KEY` — shared fallback key for résumé chats
   - `FEEDBACK_NOTIFY_EMAIL` — where in-app feedback lands (any inbox)
4. **GitHub Actions secrets** (repo → Settings → Secrets → Actions):
   - `DATABASE_URL`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY` — same values as above
   - `RESEND_API_KEY` — free account at [resend.com](https://resend.com)
   - `DIGEST_FROM` — `Job Radar <radar@yourdomain.com>` (verify a domain in Resend so mail reaches everyone, not just the account owner)
   - `APP_URL` — your Vercel URL
5. **Sign up** in the deployed app, complete onboarding, and trigger the `radar-pipeline` workflow once to backfill.

</details>

<details>
<summary><strong>Local LinkedIn runner (optional but recommended)</strong></summary>

The LinkedIn fetcher runs locally because datacenter IPs get blocked.

```bash
cd pipeline && python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp ../web/.env.example .env   # set DATABASE_URL + ENCRYPTION_KEY (same as prod)
.venv/bin/python main.py      # full run including LinkedIn
```

Automate it with the launchd plist in `ops/` (edit the paths, then `launchctl load`). Note: the agent must run from a directory **outside** `~/Documents` — macOS TCC blocks launchd access there.

</details>

<details>
<summary><strong>H-1B sponsorship data import</strong></summary>

1. Download fiscal-year CSVs from the [USCIS H-1B Employer Data Hub](https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub).
2. `cd pipeline && DATABASE_URL=<neon-url> python h1b_import.py ~/Downloads/h1b_fy2025.csv ~/Downloads/h1b_fy2024.csv`

</details>

<details>
<summary><strong>Notion sync (optional, per user)</strong></summary>

1. Create an integration at [notion.so/my-integrations](https://www.notion.so/my-integrations), copy the secret.
2. Create a database with properties: `Title` (title), `Company` (select), `Status` (select), `Source` (select), `URL` (url), `Location` (text), `Posted date` (date).
3. On the database page: ••• → Connections → add your integration.
4. Paste the secret + database ID into **Settings**. New matches push automatically each pipeline run.

</details>

<details>
<summary><strong>Local development</strong></summary>

```bash
# web
cd web && npm install && npm run dev            # needs DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY
# pipeline
cd pipeline && python main.py --no-linkedin --no-notion
python digest.py                                 # needs RESEND_API_KEY to actually send
```

</details>

## Stack

Next.js 14 · React · TypeScript · Tailwind · Drizzle ORM · Neon Postgres · Python · GitHub Actions · Vercel · Resend · Claude (Opus + Haiku) · USCIS H-1B data
