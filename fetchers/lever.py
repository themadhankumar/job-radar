"""Lever public postings API.

GET https://api.lever.co/v0/postings/{slug}?mode=json
"""
from __future__ import annotations

from datetime import datetime, timezone

import requests

from models import Job
from .common import DEFAULT_TIMEOUT, make_session

API = "https://api.lever.co/v0/postings/{slug}"


def fetch(company: str, slug: str, session: requests.Session | None = None) -> list[Job]:
    s = session or make_session()
    resp = s.get(API.format(slug=slug), params={"mode": "json"}, timeout=DEFAULT_TIMEOUT)
    resp.raise_for_status()
    jobs: list[Job] = []
    for j in resp.json():
        cats = j.get("categories") or {}
        location = cats.get("location") or ""
        workplace = (j.get("workplaceType") or "").lower()
        if workplace == "remote" and "remote" not in location.lower():
            location = f"{location} (Remote)".strip()
        posted = None
        if j.get("createdAt"):
            posted = datetime.fromtimestamp(j["createdAt"] / 1000, tz=timezone.utc)
        jobs.append(
            Job(
                source="lever",
                company=company,
                job_id=str(j.get("id")),
                title=j.get("text", "") or "",
                url=j.get("hostedUrl", "") or "",
                location=location,
                posted_at=posted,
                description=j.get("descriptionPlain", "") or j.get("description", "") or "",
            )
        )
    return jobs
