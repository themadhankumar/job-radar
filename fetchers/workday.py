"""Workday careers — unofficial but stable CxS JSON API.

POST https://{tenant}.{host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
Body: {"appliedFacets": {}, "limit": 20, "offset": 0, "searchText": "..."}

Job URL: https://{tenant}.{host}.myworkdayjobs.com/en-US/{site}{externalPath}
"""
from __future__ import annotations

import re
import time
from datetime import datetime, timedelta, timezone

import requests

from models import Job
from .common import DEFAULT_TIMEOUT, make_session

API = "https://{tenant}.{host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs"
JOB_BASE = "https://{tenant}.{host}.myworkdayjobs.com/en-US/{site}"

_POSTED_RE = re.compile(r"(\d+)\+?\s+day", re.IGNORECASE)


def _parse_posted_on(text: str) -> datetime | None:
    """Workday returns strings like 'Posted Today', 'Posted 3 Days Ago', 'Posted 30+ Days Ago'."""
    if not text:
        return None
    t = text.lower()
    now = datetime.now(timezone.utc)
    if "today" in t:
        return now
    if "yesterday" in t:
        return now - timedelta(days=1)
    m = _POSTED_RE.search(t)
    if m:
        days = int(m.group(1))
        if "+" in t:
            days += 1
        return now - timedelta(days=days)
    return None


def fetch(
    company: str,
    tenant: str,
    host: str,
    site: str,
    search_terms: list[str] | None = None,
    max_per_term: int = 100,
    session: requests.Session | None = None,
) -> list[Job]:
    s = session or make_session()
    url = API.format(tenant=tenant, host=host, site=site)
    base = JOB_BASE.format(tenant=tenant, host=host, site=site)
    terms = search_terms or [""]
    found: dict[str, Job] = {}

    for term in terms:
        offset = 0
        while offset < max_per_term:
            payload = {"appliedFacets": {}, "limit": 20, "offset": offset, "searchText": term}
            resp = s.post(
                url,
                json=payload,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                timeout=DEFAULT_TIMEOUT,
            )
            if resp.status_code != 200:
                break
            postings = resp.json().get("jobPostings") or []
            if not postings:
                break
            for p in postings:
                path = p.get("externalPath") or ""
                job_id = path.rsplit("/", 1)[-1] if path else (p.get("title") or "")
                if not job_id or job_id in found:
                    continue
                found[job_id] = Job(
                    source="workday",
                    company=company,
                    job_id=job_id,
                    title=p.get("title", "") or "",
                    url=f"{base}{path}" if path else base,
                    location=p.get("locationsText", "") or "",
                    posted_at=_parse_posted_on(p.get("postedOn", "")),
                    description=" ".join(p.get("bulletFields") or []),
                )
            offset += 20
            time.sleep(0.5)  # be polite
    return list(found.values())
