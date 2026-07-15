# Job Radar

Self-hosted, multi-user job-search command center. A Python pipeline sweeps ATS
boards + LinkedIn into Neon Postgres; a Next.js dashboard reads that same
database. Two independent runtimes, one shared source of truth (the DB) —
they never call each other directly, and there is no shared code between them.

## Architecture

```
GitHub Actions (every 2h)          Mac, launchd (~/jobradar-runner)
  pipeline/main.py --no-linkedin     pipeline/main.py (adds LinkedIn)
        └──────────────┬─────────────────────┘
                        ▼
   fetch (greenhouse/lever/ashby/workday/linkedin_guest)
        → extract pay/YoE (Haiku)  → geo-tag → 5-signal match → ghost-intent score
                        ▼
                 Neon Postgres  ◄────────  web/ (Next.js 14, App Router, on Vercel)
                        │                    landing · auth · onboarding+tour
                        ▼                    radar · companies · referrals · studio
   GitHub Actions (6 PM Central, DST-gated)
   pipeline/digest.py ──► Resend ──► one ranked email per user
```

- `pipeline/` — Python. `main.py` orchestrates: `fetchers/*` pull postings,
  `extract.py` fills pay/YoE via Haiku, `geo.py` tags country, `match.py`
  computes the 5-component score (imports TF-IDF helpers from `score.py`),
  `intent.py` flags likely-ghost postings. `digest.py` is a separate entry
  point (own cron) that reads scored jobs and emails via Resend.
- `web/` — Next.js 14 App Router + RSC, Tailwind, Drizzle ORM over `pg`.
  Email+password auth (JWT cookie), AES-256-GCM-encrypted per-user Anthropic
  keys / Notion tokens (`web/src/lib/crypto.ts`), Postgres-backed rate
  limiting, streaming SSE for the Resume Studio chat.
- The two sides communicate **only through Neon Postgres** — no RPC between
  pipeline and web; `schema.ts` and the pipeline's raw SQL describe the same
  tables independently.

## Stack

Next.js 14 · React 18 · TypeScript · Tailwind · Drizzle ORM · Neon Postgres (`pg`) ·
Python 3.12 · GitHub Actions · Vercel · Resend · Claude (Opus 4.8 + Haiku 4.5) ·
USCIS H-1B Employer Data Hub.

## How it runs

- **Pipeline (ATS boards)**: GitHub Actions, `.github/workflows/pipeline.yml`,
  cron every 2 hours, `python main.py --no-linkedin` (public repo → free
  Actions minutes; LinkedIn is skipped here because datacenter IPs get blocked).
- **Pipeline (LinkedIn)**: runs locally only, via launchd
  (`ops/com.madhankumar.jobradar.plist`, `ops/README.md`), 07:00/19:00 local,
  full `python main.py` from `~/jobradar-runner` — must live outside
  `~/Documents` or macOS TCC blocks launchd file access. Writes to the same
  Neon DB, so LinkedIn jobs just appear in the dashboard (no `company_id` →
  they surface in Suggested/Global, never Tracked).
- **Digest**: GitHub Actions, `.github/workflows/digest.yml`, two crons
  (23:00 UTC / 00:00 UTC) with an in-job hour gate so exactly one fires at
  6 PM America/Chicago regardless of DST — `python digest.py`.
- **Web**: Vercel, auto-deploys on push to `main`. No staging environment —
  ship pattern is **migrate Neon first → merge → smoke-test prod**, so schema
  and app code never drift out of order.
- Local dev: `cd web && npm run dev` (needs `DATABASE_URL`, `AUTH_SECRET`,
  `ENCRYPTION_KEY`); `cd pipeline && python main.py --no-linkedin --no-notion`.

## Model routing

- `claude-opus-4-8` — Resume Studio chat for BYOK users only
  (`web/src/lib/studio.ts: STUDIO_MODEL_BYOK`).
- `claude-haiku-4-5` — everything else: Studio chat for shared-key (free-tier)
  users, profile parsing, résumé/company/role suggestions, pay/YoE extraction,
  ghost-intent classification (`web/src/lib/studio.ts: STUDIO_MODEL_SHARED`,
  `web/src/lib/profile.ts`, `web/src/lib/add-url.ts`, `pipeline/extract.py`,
  `pipeline/match.py`, `pipeline/intent.py`).
- Shared-key users are capped monthly (100k in / 20k out); BYOK users are
  uncapped but still tracked in `user_usage`.

## Hard invariants — check these before touching either side

1. **Score tiers must match across languages.** `SCORE_TIER_HI` / `SCORE_TIER_MID`
   are hardcoded twice: `web/src/lib/score-tier.ts` (TypeScript, drives radar
   glow/dim/mute) and `pipeline/digest.py` (Python, drives digest email
   color). Both files carry a comment pointing at the other. **If you change
   one, change the other in the same commit** — a drift makes the digest
   email and the live dashboard disagree about what counts as a strong match.
2. **Every Drizzle migration must match `schema.ts`.** `web/drizzle/000N_*.sql`
   files are applied in filename order by `web/scripts/migrate.mjs`
   (`npm run db:migrate`), and must be idempotent (`IF NOT EXISTS` style —
   the same migration can safely re-run). `web/src/db/schema.ts` must reflect
   the *cumulative* result of every migration that has run against prod. A
   migration that isn't mirrored in `schema.ts` (or vice versa) makes Drizzle's
   compile-time types lie about what's actually in Neon.
3. **Migrate before merge, always.** Because Vercel auto-deploys `main` and
   there's no staging DB, a migration must be applied to Neon *before* the
   app code that depends on it ships, so old and new app code both run
   against a schema they understand.
4. **The 5-signal match weights are duplicated by description, not code.**
   `pipeline/match.py: WEIGHTS` (skills .30/role .25/work .20/exp .15/industry
   .10) is the source of truth; README and UI copy describing the breakdown
   must stay consistent with it if it's ever recalibrated.

## Don't

- Don't add a migration without updating `schema.ts` in the same change (or
  vice versa) — see invariant 2.
- Don't change `SCORE_TIER_HI`/`SCORE_TIER_MID` in only one of
  `score-tier.ts` / `digest.py` — see invariant 1.
- Don't merge web app code that depends on a new column/table before that
  migration has actually run against Neon.
- Don't have the pipeline call web API routes, or the web app call into
  `pipeline/`, to share logic — the only integration point is Postgres.
- Don't run LinkedIn fetches on GitHub Actions — datacenter IPs get blocked;
  LinkedIn only runs from the local launchd job.
- Don't use `git add -A` / `git add .` in this repo — untracked local tooling
  (`.agents/`, `.claude/`, `brag-output/`) lives alongside tracked files;
  stage specific paths.
- Don't write non-idempotent SQL in a new migration — migrations may be
  re-run (`npm run db:migrate` re-applies all files each time).
- Don't assume `company_id` is non-null on `jobs` — LinkedIn rows have none;
  use null-safe SQL (`NOT IN` with a NULL in the set silently drops rows).
- Don't build auto-apply / auto-submission features — a deliberate product
  boundary (see README), not a missing feature.
- Don't hardcode a different Claude model into a new call site — reuse the
  constants in `studio.ts` (web) or the per-module `MODEL`/`HAIKU_MODEL`
  constants (pipeline) so routing stays centralized.
