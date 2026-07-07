"""Greenhouse public job board API.

GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
"""
from __future__ import annotations

import requests

from models import Job
from .common import DEFAULT_TIMEOUT, make_session, parse_iso

API = "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"


def fetch(company: str, slug: str, session: requests.Session | None = None) -> list[Job]:
    s = session or make_session()
    resp = s.get(API.format(slug=slug), params={"content": "true"}, timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    jobs: list[Job] = []
    for j in resp.json().get("jobs", []):
        posted = parse_iso(j.get("first_published") or j.get("updated_at"))
        jobs.append(
            Job(
                source="greenhouse",
                company=company,
                job_id=str(j.get("id")),
                title=j.get("title", "") or "",
                url=j.get("absolute_url", "") or "",
                location=((j.get("location") or {}).get("name") or ""),
                posted_at=posted,
                description=j.get("content", "") or "",
            )
        )
    return jobs
