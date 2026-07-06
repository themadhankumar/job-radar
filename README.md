# Job Radar 📡

A local-first job-posting monitor. Polls ATS public APIs (Greenhouse, Lever,
Ashby, Workday) plus LinkedIn guest search, filters by configurable keywords /
location / recency, dedupes against a local SQLite state, prints a clean
terminal table, and pushes new matches into a Notion database.

Built for an AI Data PM / Data Engine PM / TPM (AI-ML) job search with a
hard offer deadline — every run surfaces **only jobs you haven't seen before**.

```
config.yaml ──► fetchers (greenhouse / lever / ashby / workday / linkedin)
                    │
                    ▼
              filters.py (include/exclude keywords, location, recency)
                    │
                    ▼
              state.py (SQLite dedupe — new jobs only)
                    │
            ┌───────┴────────┐
            ▼                ▼
     terminal table    Notion database
```

## Quick start

```bash
git clone https://github.com/themadhankumar/job-radar.git
cd job-radar
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 1. Verify which ATS each target company actually uses
python discover.py
#    → paste the printed YAML into config.yaml under `companies:`

# 2. Dry run (no state written, no Notion)
python main.py --dry-run --no-notion

# 3. Real run
python main.py
```

## Configuration (`config.yaml`)

| Section | What it controls |
|---|---|
| `filters.include_keywords` | Job matches if ANY appears in title/description |
| `filters.exclude_keywords` | Job dropped if ANY appears |
| `filters.require_title_match` | Flip to `true` if descriptions cause noise |
| `filters.locations_allow` | Substring match; empty list = all locations |
| `filters.posted_within_days` | Recency cutoff (when the ATS reports a date) |
| `companies` | ATS boards to poll (`ats: greenhouse\|lever\|ashby\|workday`) |
| `linkedin.searches` | Supplementary guest-search queries |

### Finding a Workday tenant

Open the company's careers site and look at a job URL:

```
https://uhg.wd1.myworkdayjobs.com/en-US/External_Career_Site/job/...
        ▲    ▲                        ▲
     tenant host                    site
```

Put those three values in `config.yaml`. `discover.py` also probes common
candidates for the healthcare tenants automatically.

Companies with **no public board** (Epic, Mayo Clinic, UMN, Stanford Health
Care, Cleveland Clinic, Microsoft, Oracle Health use custom portals) are
covered by the LinkedIn searches — tune those queries in `config.yaml`.

## Notion setup (~3 minutes)

1. Go to <https://www.notion.so/my-integrations> → **New integration** →
   name it `Job Radar`, workspace = yours, capabilities: *Insert content* +
   *Read content*. Copy the **Internal Integration Secret**.
2. `cp .env.example .env` and paste the token as `NOTION_TOKEN`.
3. Create the database — two options:
   - **Automatic**: open (or create) a Notion page to hold the tracker, click
     `••• → Copy link`, grab the 32-char ID at the end of the URL, then:
     ```bash
     python notion_sync.py --create-db <PAGE_ID>
     ```
     It prints the `NOTION_DATABASE_ID` — add it to `.env`.
   - **Manual**: create a database with properties **Title** (title),
     **Company** (select), **URL** (url), **Location** (text),
     **Posted date** (date), **Keywords matched** (multi-select),
     **Source** (select), **Status** (select: New / Reviewing / Applied /
     Interviewing / Offer / Rejected / Skipped). Copy its ID from the URL.
4. **Connect the integration to the database**: open the database page →
   `••• → Connections → Job Radar`. (Skipping this causes 404s.)

## Scheduling

### Option A — macOS launchd (runs LinkedIn too)

```bash
cp ops/com.madhankumar.jobradar.plist ~/Library/LaunchAgents/
# Edit the plist if your repo path isn't ~/job-radar
launchctl load ~/Library/LaunchAgents/com.madhankumar.jobradar.plist
# Test immediately:
launchctl start com.madhankumar.jobradar
tail -f state/run.log
```

Unload with `launchctl unload ~/Library/LaunchAgents/com.madhankumar.jobradar.plist`.
(launchd beats cron on modern macOS — cron jobs silently skip when the lid
is closed and need Full Disk Access grants.)

### Option B — GitHub Actions (free, daily, no laptop needed)

Already wired in `.github/workflows/daily.yml` (14:30 UTC daily + manual
trigger). To activate:

1. Repo → **Settings → Secrets and variables → Actions** → add
   `NOTION_TOKEN` and `NOTION_DATABASE_ID`.
2. Repo → **Settings → Actions → General → Workflow permissions** →
   *Read and write permissions* (so the run can commit `state/seen_jobs.db`).
3. Actions tab → run **job-radar-daily** manually once to verify.

Notes:
- Actions runs skip LinkedIn (`--no-linkedin`) — datacenter IPs get blocked
  fast. Run LinkedIn locally.
- The state DB is committed back to the repo after each run. **If you use
  both schedulers, `git pull` before local runs** to avoid duplicate
  notifications / conflicts. Simplest: pick one scheduler.

## CLI reference

```
python main.py [--config config.yaml] [--no-linkedin] [--no-notion] [--dry-run]
python discover.py ["Company Name" ...] [--slug exact-slug]
python notion_sync.py --create-db <PARENT_PAGE_ID>
```

## Etiquette & reliability

- All fetchers use modest pacing (0.5s between Workday pages, 3–6s random
  sleep between LinkedIn pages) and a browser User-Agent.
- One failing board never kills the run — errors are printed and skipped.
- Greenhouse/Lever return full descriptions (deep keyword matching);
  Ashby's public API returns titles/locations only, so matching there is
  title-driven.
