# Job Radar — Handover (v3)

_Last updated: 2026-07-09. This is the single source of truth for a fresh chat. Trust it over assumptions; if it conflicts with what Madhan says, his message wins — offer to update this file._

---

## 1. Who / what / why

- **Madhan** — TPM in clinical AI annotation at Optum/UHG (Minneapolis). On **F-1 STEM OPT ending July 2027**. Job-hunting for **AI Data PM / data-engine PM / TPM (AI-ML)** roles. **Needs a signed offer by Dec 2026** for the 2027 H-1B lottery. Technical (Python/SQL/JS, M4 MacBook Air 16GB).
- **GitHub** `themadhankumar`, repo `github.com/themadhankumar/job-radar`, local clone `~/Documents/GitHub/job-radar/`.
- **Job Radar** — self-hosted, multi-user job-search command center. Python pipeline sweeps job boards into **Neon Postgres** on **GitHub Actions** (2×/day) + a **local Mac launchd job** that adds LinkedIn. **Next.js 14** dashboard on **Vercel** (auto-deploys `main`). It's both Madhan's tool and a portfolio piece for exactly these roles.

---

## 2. Architecture (current)

```
GitHub Actions (cron 13:30 & 22:00 UTC)        Madhan's Mac (launchd, 07:00 & 19:00 local)
  python main.py --no-linkedin                   python main.py --no-notion  (adds LinkedIn)
        └──────────────┬──────────────────────────────┘
                       ▼
  fetch (watched + seed companies via ATS; LinkedIn locally)
   → enrich (pay/YoE: regex + Haiku fallback, capped) → geo tag (US/intl/'')
   → match engine (per-user 0–100 score, incremental) → (Notion push, off)
                       ▼
                 Neon Postgres  ◄────  web/ (Next.js on Vercel)
                       │                Radar (Tracked·Suggested·Global) · Companies
                       ▼                Roles · Resume · Profile · Settings · Studio
             digest.py (Resend — NOT configured, no-ops)
```

- **Models in code:** `claude-opus-4-8` (Resume Studio chat/export), `claude-haiku-4-5` (everything bulk: profile parse, pay/YoE fallback, company + role classification, company/role suggestions).
- **Pipeline auth:** shared `ANTHROPIC_API_KEY` (Actions secret / local `.env`). BYOK per-user keys are **Studio-only** (web).

---

## 3. What is LIVE on `main` right now

`main` tip = `270f627`. Live and deployed:

- **Phases 1–4** (auth/onboarding/radar/companies/settings, pay+YoE extraction, H-1B sponsor signals, Notion sync coded-not-configured, digest coded-not-configured, Resume Studio with Opus chat + `.tex`/`.docx` export, profile foundation, match engine, filter presets, US-only setting).
- **Seed companies** (`pipeline/seed_companies.py`) — 18 validated AI/ML/data companies swept every run so Global/Suggested have jobs beyond any watchlist. (PR #9)
- **Suggested threshold = 20%** (down from 70), Suggested always sorted score-desc. (PR #8)
- **Pipeline efficiency** — `match.py` scores only **new** (unscored) `(user, job)` pairs, `LOOKBACK_DAYS = 15`, batched `executemany` writes; `db.insert_jobs` batched. Web **invalidates a user's scores** on profile edit / re-parse / resume replace so they recompute next run. (PR #10)
- **Radar tabs are mutually exclusive** — Tracked = watchlist companies; Suggested = non-tracked ∧ score ≥ 20 (dismissible); Global = non-tracked ∧ score < 20 (role-matched, score-desc). Date filter **defaults to 30 days**, has a "Past 3 months" option. (PR #11)
- **Per-tab role keywords** — `user_keywords.scope` column ('tracked'|'global'), migration **`0006` applied to Neon**. Keywords API (`/api/keywords`). Radar reads scoped keywords (Global mirrors Tracked until Global-specific roles are set). **Currently the roles manager still renders inside Settings** (only the base half of the roles work merged — see §4). (PR #12, partial)

---

## 4. PENDING / not yet on `main` (important — merge these)

These were built and pushed but are **NOT** in `main`:

1. **`roles-manager` branch @ `03b96d8`** — the dedicated **Roles** nav page + **✦ Suggest roles** (Haiku), the dedicated **Profile** nav page (skills/titles/industries/YoE split out of the Resume tab), and **Roles removed from Settings**. Only the earlier commit (`531ef56`, roles-in-Settings + migration) reached `main` via PR #12. **Action: open a NEW PR `roles-manager` → `main` and merge it.** No migration needed (`0006` already applied). This is the biggest pending item.
2. **`pipeline-timeout-60` branch** — raises Actions `timeout-minutes` 25 → 60. **`main` still has 25.** The one-time seed backfill was done via the local run, so incremental Actions runs fit under 25 for now, but this should be merged (or re-applied) to be safe.
3. **`linkedin-launchd` branch (PR4 files)** — updated `ops/com.madhankumar.jobradar.plist` (correct `~/Documents/GitHub/job-radar` paths, 2×/day), `ops/README.md`, `pipeline/.env.example`. `main` still has the OLD plist (wrong paths). The local launchd job is already running on Madhan's Mac from the branch files, but they're not version-controlled in `main` yet. **Action: merge it.**
4. **14-day radar default** — Madhan chose 14 days; `main` still defaults to **30** (the 14-day tweak was never committed — lost in a branch shuffle). Small one-line change in `radar/page.tsx` (`? 14`) to re-apply.

---

## 5. TODO / backlog (roughly prioritized)

1. **Merge the pending branches** in §4 (roles/profile PR first, then timeout, then launchd; re-apply 14-day).
2. **New-user cold start (matching):** a freshly-onboarded user's jobs aren't scored until the next scheduled pipeline run (up to ~12h). Score them at onboarding, or auto-trigger a run, so match % shows immediately. (Ties into PR5.)
3. **LinkedIn is local-only / single-feed:** LinkedIn runs only from Madhan's Mac launchd (residential IP; datacenter IPs blocked, so it can't run on Actions). It writes shared jobs (no `company_id`) into Neon for all users, but there's no per-user LinkedIn scraping and it depends on Madhan's Mac being awake. Known architectural limit — revisit if multi-user grows.
4. **PR5 — UI "Refresh now" button:** trigger the pipeline via GitHub `workflow_dispatch` (already enabled in `pipeline.yml`) with a warning modal + status-based progress bar (queued→running→done; no true %). Needs a repo-scoped **fine-grained** GitHub token (Actions: read+write) in Vercel env (`GH_DISPATCH_TOKEN`). Decision pending on who can trigger — leaning "any logged-in user with a global cooldown," since per-run API cost is small/capped and the main cost is Actions minutes (free if repo is public).
5. **Two dead watchlist slugs:** Innovaccer (`innovaccer`) and Tempus AI (`tempus`) 404 on Greenhouse (moved ATS / renamed). Fix via `pipeline/discover.py`. Also **reword** the misleading pipeline log `"tagged N countries"` → `"tagged N job locations"`.
6. **Mobile nav crowding:** sidebar is now 6 items (Radar, Companies, Roles, Resume, Profile, Settings) — fine on desktop, tight on the mobile bottom bar. Consider grouping or a "More" menu.
7. **Resend** (email digest): account + domain verify + `RESEND_API_KEY`, `DIGEST_FROM`, `APP_URL` secrets; then check one digest.
8. **Notion**: database + token in Settings (sync stays one-way).
9. **DST-aware digest cron** (23:00 UTC drifts to 5 PM Central in winter).
10. **Match-weight / boost-chip tuning** against real data; extend the GENERIC denylist in `match.py`.

---

## 6. Things to remember (hard-won this session)

**Security — rotate these (both appeared in screenshots):**
- **Neon DB password** (`neondb_owner`) — reset in Neon, update `pipeline/.env` + Vercel.
- **GitHub PAT** — still a classic full-access token; rotate to fine-grained repo-scoped. (Standing item — keep nagging.)

**Git workflow gotchas (all bit us this session):**
- Run `git` from the **repo root**, not `web/` (paths like `web/...` double up otherwise).
- **zsh does not treat `#` as an inline comment** by default — never paste a command with a trailing `# comment`; it becomes arguments.
- `db:migrate` runs from **`web/`** (`package.json` is there): `cd web && DATABASE_URL='...' npm run db:migrate`.
- The agent's sandbox **leaves a stale `.git/index.lock`** the Mac can't ignore — if git says "another process," `rm -f .git/index.lock`. (Do git **writes** on Madhan's side, not the sandbox.)
- Paths containing `(app)` must be **quoted** in git/shell.
- `DATABASE_URL` must start `postgresql://` (one p) and end `?sslmode=require`.
- **`ENCRYPTION_KEY` is NOT needed** for the local `main.py --no-notion` run (only used by Notion push, read lazily). Local `.env` needs just `DATABASE_URL` + `ANTHROPIC_API_KEY`.
- **Partial-merge trap:** a PR merged only its first commit once; later commits pushed to the same branch sat unmerged. Verify with `git ls-tree -r --name-only origin/main | grep <file>` — don't assume a branch is fully merged.
- Build in **reviewable PRs off `main`**; never base a PR on another feature branch. Madhan merges via the GitHub UI; nothing hits `main` without his go.

**Code specifics to preserve:**
- `next.config.mjs`: `serverComponentsExternalPackages: ["pg", "mammoth"]`; PDFs parse via **`unpdf`** (not pdf-parse). New deps: `jszip`, `docx`.
- No `accept` attribute on file inputs (macOS grays out `.tex`).
- Null-safe SQL for LinkedIn jobs (**NULL `company_id`** — `NOT IN` with NULL silently drops rows; already handled, don't regress).
- Enrichment capped: `MAX_HAIKU_PER_RUN = 40`, `LIMIT 500`. Company classify cap 40/run. Match `MAX_JOBS = 4000`.
- Migrations: idempotent `web/drizzle/000N_*.sql` (`IF NOT EXISTS`) **and** matching `web/src/db/schema.ts` update; apply with `npm run db:migrate`.
- Agent sandbox can reach `api.anthropic.com`, `github.com`, and (via web_fetch) public **ATS APIs** (Greenhouse board-meta `/v1/boards/{slug}`, Lever `?limit=1`, Ashby) — useful to **validate company slugs** before adding to `seed_companies.py`. It CANNOT push git or read Actions logs (Azure blob blocked — diagnose via the `/actions/runs` + `/jobs` API or local repro).

---

## 7. Key decisions locked in

- Match % replaced the old TF-IDF score; one number per job, components explain it.
- Suggested = global corpus ≥ 20%, tracked companies + dismissed excluded, score-desc, no keyword gate.
- Global = the non-tracked remainder **below** 20%, role-matched, score-desc. Tracked / Suggested / Global are **mutually exclusive**.
- Roles are **per-tab** (Tracked vs Global), managed on their own page; Global mirrors Tracked roles until Global-specific ones are set. **Suggested has no role list** — it's pure resume-match.
- Radar date default **14 days** (currently live as 30 — re-apply). Freshness = `posted_at`; `created_at` = when we ingested (drives the 15-day scoring window). Old-but-open reqs are normal; daily runs keep it fresh going forward.
- Incremental scoring: only new pairs scored; profile/resume change invalidates a user's scores server-side.
- LinkedIn local-only; searched with `location=United States`. US-only setting hides confidently-`intl` jobs (conservative).
- Ship pattern: **migrate Neon first → merge PR → smoke-test production.**

---

## 8. Immediate next steps for a fresh chat

1. Confirm with Madhan whether he merged the pending PRs in §4 (especially the roles/profile PR `roles-manager → main`). If not, that's step one.
2. Then likely: PR5 (refresh button) and/or the new-user cold-start scoring, plus the small cleanups (dead slugs, log wording, 14-day default).
3. When meaningful progress happens, offer to regenerate this `handover.md`.
