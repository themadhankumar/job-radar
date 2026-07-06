"""Ashby public job board API.

GET https://api.ashbyhq.com/posting-api/job-board/{slug}
Note: this endpoint returns titles/locations but not full descriptions,
so keyword matching for Ashby companies is effectively title-based.
"""
from __future__ import annotations

import requests

from models import Job
from .common import DEFAULT_TIMEOUT, make_session, parse_iso

API = "https://api.ashbyhq.com/posting-api/job-board/{slug}"


def fetch(company: str, slug: str, session: requests.Session | None = None) -> list[Job]:
    s = session or make_session()
    resp = s.get(API.format(slug=slug), timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    jobs: list[Job] = []
    for j in resp.json().get("jobs", []):
        locs = [j.get("location") or ""]
        for sec in j.get("secondaryLocations") or []:
            if isinstance(sec, dict) and sec.get("location"):
                locs.append(sec["location"])
        location = "; ".join(x for x in locs if x)
        if j.get("isRemote") and "remote" not in location.lower():
            location = f"Remote; {location}".strip("; ")
        jobs.append(
            Job(
                source="ashby",
                company=company,
                job_id=str(j.get("id")),
                title=j.get("title", "") or "",
                url=j.get("jobUrl", "") or j.get("applyUrl", "") or "",
                location=location,
                posted_at=parse_iso(j.get("publishedAt")),
                description=j.get("descriptionPlain", "") or "",
            )
        )
    return jobs
