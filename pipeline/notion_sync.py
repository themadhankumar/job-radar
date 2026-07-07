"""Push new job postings into a Notion database.

Also usable as a one-time setup CLI to create the database:
    python notion_sync.py --create-db <PARENT_PAGE_ID>

Schema: Company (select), Title (title), URL (url), Location (rich text),
Posted date (date), Keywords matched (multi-select), Status (select),
Source (select).
"""
from __future__ import annotations

import argparse
import os
import sys

import requests

from models import Job

API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def _truncate(text: str, limit: int = 1900) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


def push_job(job: Job, token: str, database_id: str) -> bool:
    props = {
        "Title": {"title": [{"text": {"content": _truncate(job.title or "Untitled")}}]},
        "Company": {"select": {"name": _truncate(job.company or "Unknown", 90).replace(",", " ")}},
        "Status": {"select": {"name": "New"}},
        "Source": {"select": {"name": job.source}},
    }
    if job.url:
        props["URL"] = {"url": job.url}
    if job.location:
        props["Location"] = {"rich_text": [{"text": {"content": _truncate(job.location)}}]}
    if job.posted_at:
        props["Posted date"] = {"date": {"start": job.posted_at.date().isoformat()}}
    if job.keywords_matched:
        props["Keywords matched"] = {
            "multi_select": [{"name": k.replace(",", " ")[:90]} for k in job.keywords_matched]
        }

    resp = requests.post(
        f"{API}/pages",
        headers=_headers(token),
        json={"parent": {"database_id": database_id}, "properties": props},
        timeout=25,
    )
    if resp.status_code != 200:
        print(f"  [notion] failed for '{job.title}': {resp.status_code} {resp.text[:200]}",
              file=sys.stderr)
        return False
    return True


def push_jobs(jobs: list[Job], token: str, database_id: str) -> int:
    ok = 0
    for job in jobs:
        ok += push_job(job, token, database_id)
    return ok


def create_database(token: str, parent_page_id: str) -> str:
    body = {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": "Job Radar"}}],
        "properties": {
            "Title": {"title": {}},
            "Company": {"select": {}},
            "URL": {"url": {}},
            "Location": {"rich_text": {}},
            "Posted date": {"date": {}},
            "Keywords matched": {"multi_select": {}},
            "Source": {"select": {}},
            "Status": {
                "select": {
                    "options": [
                        {"name": "New", "color": "blue"},
                        {"name": "Reviewing", "color": "yellow"},
                        {"name": "Applied", "color": "orange"},
                        {"name": "Interviewing", "color": "purple"},
                        {"name": "Offer", "color": "green"},
                        {"name": "Rejected", "color": "red"},
                        {"name": "Skipped", "color": "gray"},
                    ]
                }
            },
        },
    }
    resp = requests.post(f"{API}/databases", headers=_headers(token), json=body, timeout=25)
    resp.raise_for_status()
    return resp.json()["id"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Notion setup helper")
    parser.add_argument("--create-db", metavar="PARENT_PAGE_ID",
                        help="Create the Job Radar database under this Notion page")
    args = parser.parse_args()

    token = os.environ.get("NOTION_TOKEN")
    if not token:
        sys.exit("Set NOTION_TOKEN in your environment (or .env) first.")

    if args.create_db:
        db_id = create_database(token, args.create_db.replace("-", ""))
        print(f"Created database. Add this to your .env:\nNOTION_DATABASE_ID={db_id}")
    else:
        parser.print_help()
