# Job Radar — STATUS.md

> Single source of truth for current state, in-flight work, and next steps.
> **Last updated: 2026-07-12.** Replace this file at the end of each working session.

## Who Madhan is and what this is

Madhan: TPM in clinical AI annotation at Optum/UHG (Minneapolis), F-1 STEM OPT ending July 2027. Job hunting for AI Data PM / data-engine PM / TPM (AI-ML) roles; needs a signed offer by Dec 2026 for the 2027 H-1B lottery. Technical (Python/SQL/JS, M4 MacBook Air 16GB). GitHub `themadhankumar`, repo **public** at `github.com/themadhankumar/job-radar`, local clone at `~/Documents/GitHub/job-radar/`, prod at **job-radar-jade.vercel.app**.

Job Radar is a self-hosted, multi-user job-search command center: Python pipeline sweeps ATS boards + LinkedIn into Neon Postgres on GitHub Actions (2x daily) + a local LinkedIn runner, Next.js 14 dashboard on Vercel (auto-deploys `main`). It is simultaneously Madhan's daily-use tool and his portfolio piece for exactly the roles he's targeting.

**`main` tip: `0277991`.** Only `main` is live. A stale merged `landing-v4-desaturate` branch is pending cleanup.

## Current architecture

```
GitHub Actions (2x daily)              Mac (launchd, ~/jobradar-runner)
  pipeline/main.py --no-linkedin         pipeline/main.py (adds LinkedIn)
        └──────────────┬──────────────────────┘
                       ▼
  fetch → extract pay/YoE → geo-tag → 5-signal match → optional Notion push
                       ▼
                Neon Postgres ◄──── web/ (Next.js 14 on Vercel)
                       │             landing (public) · auth · onboarding+tour
                       ▼             radar · companies · referrals · roles
   digest.py (daily) → Resend        resume studio · profile · settings
```

## Feature set (all built, merged, live)

- **Auth**: email+password, bcrypt-11, JWT cookie (httpOnly/secure/sameSite=lax), zod validation, pg-backed rate limiting (login 10/15min IP+email, signup 5/hr IP, forgot 3/hr email + 10/hr IP; migration 0009). Password reset + change-password flows.
- **Onboarding**: resume upload → roles (keywords) → companies → sponsorship, then **product tour**. Replayable from Settings via `/tour`. Keyword chips now **auto-suggest from the uploaded resume** (Haiku) with role-neutral fallback; the old hardcoded niche list is gone.
- **Radar** (Tracked/Suggested/Global): 5-component match % (skills .30 / role .25 / TF-IDF work .20 / experience .15 / industry .10), drawer with weighted component bars + missing-term chips, dismissible jobs, status lifecycle, filter presets, US-only toggle, add-by-URL. **Referral jobs pinned to top** with handshake badge + drawer contact list.
- **Score tiers**: recalibrated to hi=42 / mid=30 (real distribution: min 5 / avg 22 / max ~60-71, p90=34 p95=40 p99=49). Suggested threshold is a Settings slider, default 35% (migration 0007). `score-tier.ts` and `pipeline/digest.py` must stay in sync.
- **Resume Studio**: per-job Opus 4.8 chat (streaming SSE), gap analysis, screener answers, tailored `.tex`/`.docx` export with LCS diff view. Shared-key caps 100k in / 20k out monthly; BYOK uncapped + tracked.
- **Resume tab**: file card, download original, confirmed replace, extracted-text preview. **Profile parse errors now surface** a `profileError` flash (was silently swallowed).
- **Profile tab**: Haiku-parsed editable skills/titles/industries/seniority/yoe/summary; hand-edits never clobbered, explicit Re-parse only.
- **Companies**: watchlist, ✦ Suggest companies (Haiku), 🤝 referral badge, **type-ahead search** with "add if not in list" (shared `CompanyTypeahead`, also in onboarding).
- **Referrals** (`/referrals`): CRUD contacts (name, company, company_id, role, relationship, contact_details, status, warmth, notes; migration 0010). Warm/cold + status lifecycle inline selects. Matched to jobs/companies via `norm_employer()`.
- **H-1B sponsor signals**: USCIS petition history inline on every job (`sponsors` table).
- **Feedback widget**: floating bubble on app pages + landing, Bug/Idea/Other, optional email for anon, **screenshot attach** (client downscale to 1400px JPEG), instant Resend email (migrations 0011/0012). HTML-escaped.
- **Per-source digest filter**: choose which boards (Greenhouse/Lever/Ashby/Workday/LinkedIn) email you (migration 0013, `users.digest_sources` text[], defaults all; can't disable the last one). Wired into `digest.py`.
- **Landing page** (`/`): public, Linear-grade, quality-over-quantity positioning ("Apply where you're most qualified. Not everywhere."), 7 feature sections (sweep/score/tailor/sponsor/referrals/add-by-url/digest), SEO title + meta + OG tags. No "we don't auto-apply" stance section (removed by Madhan's call). No em-dashes in visible copy.
- **UI**: near-black `8 8 11`, violet rationed to scores/primary/focus/active-nav only. Linear is the locked reference. Spacing pass done (roomier rows/cards/margins).
- **README**: story-first, portfolio-grade, all 7 features, architecture diagram, "design decisions I'd call out" section, setup in `<details>` folds.

## Migrations: through 0013, all applied to Neon

0007 suggested_threshold · 0008 password_reset · 0009 auth_rate_limit · 0010 referrals · 0011 feedback · 0012 feedback_image · 0013 digest_sources.

## Security posture (audited this session)

- **IDOR clean** — every per-user route scopes by userId (threads, export, status, dismiss, referrals, presets, resume, profile, feedback). Verified.
- `companies/detect` now requires a session (was unauth'd).
- Feedback email HTML-escaped.
- Security headers in `next.config.mjs` (X-Frame-Options DENY, nosniff, Referrer-Policy, HSTS, Permissions-Policy). Full CSP deliberately deferred (Next inline scripts).
- `global-error.tsx` added.
- No secrets in the public repo; `web/.env` gitignored.
- LinkedIn launchd fixed (runs from `~/jobradar-runner` outside TCC, Python 3.11 venv, git pull before each run, 7:00/19:00 local).

## Blockers before a PUBLIC launch (Madhan's side — cannot be done by Claude)

1. **Resend domain verification** — HARD BLOCKER. Until done, password-reset / feedback / digest emails only reach the Resend account owner's inbox; real strangers can't recover passwords. Add a domain in Resend, set DNS (SPF/DKIM/MX), then set `DIGEST_FROM` to `radar@<domain>` in Vercel + Actions.
2. **Rotate the classic GitHub PAT → fine-grained** (repo-scoped, Contents R/W). It's only the Mac's git push credential (nothing else depends on it). Create fine-grained token → `git credential-osxkeychain erase` → push to re-store → delete classic.
3. **Set `FEEDBACK_NOTIFY_EMAIL`** in Vercel (recipient inbox; no domain needed).
4. **Confirm Neon password rotation** propagated to Vercel + Actions.

## Verify on prod (Claude is blind without a browser)

- **Empty-profile bug**: hit **Re-parse** on the Profile tab — the `user_profiles` row is empty (`byok: true` in DB but no profile row); parse-on-upload was failing silently. Now surfaces errors; confirm it populates and scores light up.
- Onboard a throwaway account with a **non-tech resume** and confirm keyword chips reflect it (the exact bug fixed this session).
- Type-ahead company search: type a partial name, confirm filter + "add if not in list".
- Toggle digest sources in Settings, confirm save.
- Studio `.tex` export + diff with real Opus; add-by-URL LinkedIn paste-fallback; screener pack; feedback + screenshot.
- Product tour end-to-end (signup flow + `/tour` replay); optional-key save.
- **Sign up a second throwaway account** to confirm IDOR isolation (human confirmation of the code audit).
- Visual QA: near-black theme, spacing, tour, referrals, new landing copy (esp. the "Skip the line / where you know someone" line break).

## Backlog / horizon

- **Referral-ask draft** (1-click personalized message the user sends to a contact) — designed and scoped this session, then Madhan chose to skip for now. Reusable if revisited: Opus via `callAnthropic`, warmth-aware prompt, drafts-not-sends, reuses BYOK/cap/usage. Would need `referralContacts` agg to carry contact `id` into the drawer.
- Add Referrals to the landing HeroAppFrame nav parity was done; a dedicated ReferralFragment exists.
- Stale `landing-v4-desaturate` branch cleanup.
- Untracked local tooling in the tree (`.agents/`, `.claude/`, `brag-output/`, `skills-lock.json`) — Madhan said he'd gitignore; not yet actually ignored. Worth adding to `.gitignore`.
- Notion sync (coded, one-way, per-user token in Settings).
- DST-aware digest cron.
- `/brag` launch-video Claude Code skill (portfolio polish; needs Node 22+, FFmpeg, `npx hyperframes doctor`; add `brag-output/` to gitignore first).

## Key learnings / locked decisions

- **Match % replaced the old raw score**; one number, five components explain it. Tiers reflect real percentiles, not round numbers. `score-tier.ts` ↔ `digest.py` must stay in sync.
- **Quality over volume is the positioning** (vs. Tsenta's auto-apply/volume model). Landing copy, README, and feature emphasis all lead with precision + referrals. This is the portfolio wedge.
- **Referrals is the second differentiator** but a lighter feature than match — copy leads match-first, referrals as the sharp second beat.
- **Violet stays rationed**; near-black + single accent (Linear) is locked.
- **`MAX_JOBS` high** (20,000); low values leave top companies unscored (newest-first selection).
- **macOS TCC blocks launchd** from `~/Documents`; runner lives in `~/jobradar-runner`.
- **`NODE_ENV=` prefix** on builds (Madhan's `.zshrc` exports `NODE_ENV=production`, which drops devDependencies incl. Tailwind).
- **No `accept` attribute on file inputs** (macOS grays out `.tex`).
- **null-safe SQL** for LinkedIn jobs (NULL company_id; `NOT IN` with NULL silently drops rows).
- **unpdf, not pdf-parse.**
- **Desktop Commander**: `write_file` reliable for whole files; `edit_block` unreliable — prefer inline-Python string-replace via `start_process` (assert count==1 then replace). DC server occasionally hangs (esp. multi-line git commit messages); restart the Claude desktop app to recover, use single-line commit messages.

## How to work in this repo

- Vercel auto-deploys `main`. Ship pattern: **migrate Neon first → merge → smoke-test prod.**
- Migrations: idempotent `web/drizzle/000N_*.sql` (IF NOT EXISTS style) + matching `web/src/db/schema.ts`, run `npm run db:migrate` (DATABASE_URL is in `web/.env`, gitignored).
- **Madhan authorized Claude to merge branches directly to `main`** (git creds, push access). Claude CANNOT open/approve GitHub PRs (`gh` not authed; GitHub blocks self-approval). Workflow: branch → stage specific files (never `git add -A`, stray tooling files exist) → single-line commit → merge `--no-ff` → push → delete branch.
- Models in code: `claude-opus-4-8` (Studio + any interactive gen), `claude-haiku-4-5` (all bulk/background).

## Behavioral preferences

- **Always ask "artifact or plain text?" before creating any artifact/file deliverable** (repo edits during an approved build are the task, not artifacts).
- Discuss/define design before building when asked; use tappable questions for decisions.
- Concise responses, minimal lists. Push back at least once on first proposals. Don't over-caveat.
- Diagnose with evidence (check repo/API/DB state) before guessing. When things break: acknowledge, fix, move on.
- Never commit secrets; keep reminding about the PAT rotation until done.
