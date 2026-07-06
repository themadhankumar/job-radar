"""Job Radar — orchestrator.

Usage:
    python main.py                 # full run: ATS + LinkedIn + Notion
    python main.py --no-linkedin   # skip LinkedIn (recommended on GitHub Actions)
    python main.py --no-notion     # terminal output only
    python main.py --dry-run       # don't record state or push to Notion
"""
from __future__ import annotations

import argparse
import os
import sys

import yaml

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fetchers import ashby, greenhouse, lever, linkedin_guest, workday
from fetchers.common import make_session
from filters import match_job
from models import Job
from output import console, print_jobs
from state import State


def load_config(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def fetch_company(company: dict, session) -> list[Job]:
    ats = (company.get("ats") or "").lower()
    name = company.get("name", "?")
    if ats == "greenhouse":
        return greenhouse.fetch(name, company["slug"], session)
    if ats == "lever":
        return lever.fetch(name, company["slug"], session)
    if ats == "ashby":
        return ashby.fetch(name, company["slug"], session)
    if ats == "workday":
        return workday.fetch(
            name,
            tenant=company["tenant"],
            host=company.get("host", "wd1"),
            site=company["site"],
            search_terms=company.get("search_terms"),
            session=session,
        )
    console.print(f"[yellow]Skipping {name}: unknown ats '{ats}'[/yellow]")
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description="Job Radar")
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--no-linkedin", action="store_true")
    parser.add_argument("--no-notion", action="store_true")
    parser.add_argument("--dry-run", action="store_true",
                        help="Don't write state or push to Notion")
    args = parser.parse_args()

    cfg = load_config(args.config)
    filters = cfg.get("filters") or {}
    session = make_session()
    all_jobs: list[Job] = []

    # ---- ATS fetchers ----
    for company in cfg.get("companies") or []:
        name = company.get("name", "?")
        try:
            jobs = fetch_company(company, session)
            console.print(f"[dim]{name}: {len(jobs)} postings fetched[/dim]")
            all_jobs.extend(jobs)
        except Exception as exc:  # noqa: BLE001 — one bad board shouldn't kill the run
            console.print(f"[red]{name}: fetch failed ({exc})[/red]")

    # ---- LinkedIn (supplementary) ----
    li = cfg.get("linkedin") or {}
    skip_li = args.no_linkedin or os.environ.get("JOBRADAR_SKIP_LINKEDIN")
    if li.get("enabled") and not skip_li:
        days = filters.get("posted_within_days")
        for query in li.get("searches") or []:
            try:
                jobs = linkedin_guest.fetch(
                    keywords=query,
                    location=li.get("location", "United States"),
                    posted_within_days=days,
                    remote_only=bool(li.get("remote_only")),
                    pages=int(li.get("pages_per_search", 3)),
                    session=session,
                )
                console.print(f"[dim]LinkedIn '{query}': {len(jobs)} postings fetched[/dim]")
                all_jobs.extend(jobs)
            except Exception as exc:  # noqa: BLE001
                console.print(f"[red]LinkedIn '{query}': fetch failed ({exc})[/red]")

    # ---- Filter ----
    matched: list[Job] = []
    seen_keys = set()
    for job in all_jobs:
        if job.key in seen_keys:
            continue
        seen_keys.add(job.key)
        ok, keywords = match_job(job, filters)
        if ok:
            job.keywords_matched = keywords
            matched.append(job)

    # ---- Dedupe against state ----
    state = State(cfg.get("state_db", "state/seen_jobs.db"))
    new_jobs = [j for j in matched if state.is_new(j)]

    console.print(
        f"\nFetched [bold]{len(all_jobs)}[/bold] postings → "
        f"[bold]{len(matched)}[/bold] matched filters → "
        f"[bold green]{len(new_jobs)}[/bold green] new "
        f"(state has {state.count()} previously seen)\n"
    )
    print_jobs(new_jobs)

    if not args.dry_run:
        for j in new_jobs:
            state.mark_seen(j)
        state.commit()

    # ---- Notion ----
    notion_cfg = cfg.get("notion") or {}
    token = os.environ.get("NOTION_TOKEN")
    db_id = os.environ.get("NOTION_DATABASE_ID")
    if new_jobs and notion_cfg.get("enabled") and not args.no_notion and not args.dry_run:
        if token and db_id:
            from notion_sync import push_jobs
            pushed = push_jobs(new_jobs, token, db_id)
            console.print(f"[green]Pushed {pushed}/{len(new_jobs)} to Notion.[/green]")
        else:
            console.print("[yellow]Notion enabled but NOTION_TOKEN / NOTION_DATABASE_ID "
                          "not set — skipping push.[/yellow]")

    state.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
