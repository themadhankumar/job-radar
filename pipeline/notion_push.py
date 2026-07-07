"""Push matched job rows (DB dicts) into a user's Notion database."""
from __future__ import annotations

import sys

import requests

API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json"}


def push_for_user(jobs: list[dict], token: str, database_id: str) -> int:
    ok = 0
    for j in jobs:
        props = {
            "Title": {"title": [{"text": {"content": (j["title"] or "Untitled")[:1900]}}]},
            "Company": {"select": {"name": (j["company_name"] or "Unknown")[:90].replace(",", " ")}},
            "Status": {"select": {"name": "New"}},
            "Source": {"select": {"name": j["source"]}},
        }
        if j.get("url"):
            props["URL"] = {"url": j["url"]}
        if j.get("location"):
            props["Location"] = {"rich_text": [{"text": {"content": j["location"][:1900]}}]}
        if j.get("posted_at"):
            props["Posted date"] = {"date": {"start": j["posted_at"].date().isoformat()}}
        resp = requests.post(
            f"{API}/pages", headers=_headers(token),
            json={"parent": {"database_id": database_id}, "properties": props}, timeout=25,
        )
        if resp.status_code == 200:
            ok += 1
        else:
            print(f"  [notion] {resp.status_code} for '{j['title']}'", file=sys.stderr)
    return ok
