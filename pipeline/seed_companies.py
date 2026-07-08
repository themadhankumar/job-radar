"""Global company seed list.

These companies are swept on every pipeline run regardless of anyone's
watchlist, so their postings populate the Global and Suggested radars for all
users. A user can promote any of them into their own Tracked watchlist.

Each entry mirrors the `companies` table shape used by `fetch_company` in
main.py:
    greenhouse / lever / ashby -> {"name", "ats", "slug"}
    workday                    -> {"name", "ats", "tenant", "host", "site"}

All slugs below were validated against the live ATS APIs (Greenhouse board
meta endpoint / Ashby posting-api) at authoring time. If a board 404s or
renames, the pipeline logs "<name>: fetch failed" and continues — prune or fix
the entry here and it self-heals on the next run.

Curated toward Madhan's target space (AI data / ML / TPM), but this is just a
starting universe — add companies freely.
"""
from __future__ import annotations

SEED_COMPANIES: list[dict] = [
    # --- AI labs / foundation models ---
    {"name": "OpenAI", "ats": "ashby", "slug": "openai"},
    {"name": "Anthropic", "ats": "greenhouse", "slug": "anthropic"},
    {"name": "Cohere", "ats": "ashby", "slug": "cohere"},
    {"name": "Perplexity", "ats": "ashby", "slug": "perplexity"},
    {"name": "Together AI", "ats": "greenhouse", "slug": "togetherai"},
    {"name": "Writer", "ats": "ashby", "slug": "writer"},

    # --- AI data / annotation / labeling (closest to target roles) ---
    {"name": "Scale AI", "ats": "greenhouse", "slug": "scaleai"},
    {"name": "Snorkel AI", "ats": "greenhouse", "slug": "snorkelai"},
    {"name": "Labelbox", "ats": "greenhouse", "slug": "labelbox"},
    {"name": "Invisible Technologies", "ats": "greenhouse", "slug": "invisibletech"},
    {"name": "Turing", "ats": "greenhouse", "slug": "turing"},

    # --- Data / ML infrastructure ---
    {"name": "Databricks", "ats": "greenhouse", "slug": "databricks"},

    # --- Adjacent high-volume tech (broad PM/TPM discovery) ---
    {"name": "Ramp", "ats": "ashby", "slug": "ramp"},
    {"name": "Notion", "ats": "ashby", "slug": "Notion"},
    {"name": "Samsara", "ats": "greenhouse", "slug": "samsara"},
    {"name": "GitLab", "ats": "greenhouse", "slug": "gitlab"},
    {"name": "Discord", "ats": "greenhouse", "slug": "discord"},
    {"name": "Anduril Industries", "ats": "greenhouse", "slug": "andurilindustries"},
]
