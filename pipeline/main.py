"""Job Radar pipeline — fetches postings for every watched company into Postgres.

Usage:
    python main.py                 # full run: ATS + LinkedIn + per-user Notion push
    python main.py --no-linkedin   # skip LinkedIn (recommended on GitHub Actions)
    python main.py --no-notion     # skip Notion pushes
"""
from __future__ import annotations

import argparse
import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

if not os.environ.get("DATABASE_URL"):
    sys.exit(
        "DATABASE_URL is not set. On GitHub Actions, add it (and ENCRYPTION_KEY) under "
        "Settings → Secrets and variables → Actions."
    )

import db as dbm
from crypto_util import decrypt
from fetchers import ashby, greenhouse, lever, linkedin_guest, workday
from fetchers.common import make_session
from output import console

MAX_LINKEDIN_SEARCHES = 15
MAX_WORKDAY_TERMS = 6


def fetch_company(company: dict, search_terms: list[str], session):
    ats = company["ats"]
    name = company["name"]
    if ats == "greenhouse":
        return greenhouse.fetch(name, company["slug"], session)
    if ats == "lever":
        return lever.fetch(name, company["slug"], session)
    if ats == "ashby":
        return ashby.fetch(name, company["slug"], session)
    if ats == "workday":
        return workday.fetch(
            name, tenant=company["tenant"], host=company["host"] or "wd1",
            site=company["site"], search_terms=search_terms[:MAX_WORKDAY_TERMS],
            session=session,
        )
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description="Job Radar pipeline")
    parser.add_argument("--no-linkedin", action="store_true")
    parser.add_argument("--no-notion", action="store_true")
    args = parser.parse_args()

    conn = dbm.connect()
    run_started = dbm.utcnow()
    session = make_session()
    keywords = dbm.all_include_keywords(conn)

    # Watched companies (per-user watchlists) + the global seed universe, which
    # is swept every run so Global/Suggested have jobs beyond anyone's watchlist.
    from seed_companies import SEED_COMPANIES
    companies = dbm.watched_companies(conn)
    seeded = dbm.upsert_seed_companies(conn, SEED_COMPANIES)
    by_id = {c["id"]: c for c in companies}
    for c in seeded:
        by_id.setdefault(c["id"], c)
    companies = list(by_id.values())
    total_new = 0

    # ---- ATS boards ----
    linkedin_only_companies = []
    for c in companies:
        if c["ats"] == "linkedin":
            linkedin_only_companies.append(c)
            continue
        try:
            jobs = fetch_company(c, keywords, session)
            new = dbm.insert_jobs(conn, jobs, company_id=c["id"])
            total_new += new
            console.print(f"[dim]{c['name']}: {len(jobs)} fetched, {new} new[/dim]")
        except Exception as exc:  # noqa: BLE001 — one board never kills the run
            console.print(f"[red]{c['name']}: fetch failed ({exc})[/red]")

    # ---- LinkedIn (global feed + custom-portal companies) ----
    skip_li = args.no_linkedin or os.environ.get("JOBRADAR_SKIP_LINKEDIN")
    if not skip_li:
        searches = list(keywords[:MAX_LINKEDIN_SEARCHES])
        for c in linkedin_only_companies:
            if keywords:
                searches.append(f"{c['name']} {keywords[0]}")
        for query in searches[:MAX_LINKEDIN_SEARCHES + 8]:
            try:
                jobs = linkedin_guest.fetch(keywords=query, posted_within_days=7, pages=2, session=session)
                new = dbm.insert_jobs(conn, jobs)
                total_new += new
                console.print(f"[dim]LinkedIn '{query}': {len(jobs)} fetched, {new} new[/dim]")
            except Exception as exc:  # noqa: BLE001
                console.print(f"[red]LinkedIn '{query}': fetch failed ({exc})[/red]")

    console.print(f"\n[bold green]{total_new} new postings[/bold green] stored this run.")

    # ---- Enrichment + scoring ----
    from extract import enrich_new_jobs
    from geo import tag_countries
    from match import compute_matches
    enriched = enrich_new_jobs(conn)
    tagged = tag_countries(conn)
    scored = compute_matches(conn)
    console.print(f"[dim]enriched {enriched} jobs, tagged {tagged} countries, refreshed {scored} profile-match scores[/dim]")

    # ---- Per-user Notion push ----
    if not args.no_notion and total_new > 0:
        from notion_push import push_for_user
        for user in dbm.users_for_notion(conn):
            try:
                token = decrypt(user["notion_token_enc"])
                jobs = dbm.user_matched_jobs_since(conn, user["id"], run_started)
                if jobs:
                    ok = push_for_user(jobs, token, user["notion_database_id"])
                    console.print(f"[green]Notion → {user['email']}: {ok}/{len(jobs)} pushed[/green]")
            except Exception as exc:  # noqa: BLE001
                console.print(f"[red]Notion push failed for {user['email']}: {exc}[/red]")

    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
