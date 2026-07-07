"""LinkedIn guest jobs endpoint (supplementary source).

GET https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search
Returns HTML fragments (25 cards per page). Parsed with BeautifulSoup.
Polite rate limiting: random 3-6s sleep between pages.
"""
from __future__ import annotations

import random
import re
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

from models import Job
from .common import DEFAULT_TIMEOUT, make_session

SEARCH_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
PAGE_SIZE = 25
_URN_RE = re.compile(r"(\d+)$")


def _job_id_from_card(card) -> str:
    urn = card.get("data-entity-urn") or ""
    if not urn:
        inner = card.find(attrs={"data-entity-urn": True})
        urn = inner.get("data-entity-urn") if inner else ""
    m = _URN_RE.search(urn or "")
    return m.group(1) if m else ""


def _text(node) -> str:
    return node.get_text(strip=True) if node else ""


def fetch(
    keywords: str,
    location: str = "United States",
    posted_within_days: int | None = None,
    remote_only: bool = False,
    pages: int = 3,
    session: requests.Session | None = None,
) -> list[Job]:
    s = session or make_session()
    jobs: dict[str, Job] = {}

    for page in range(pages):
        params = {"keywords": keywords, "location": location, "start": page * PAGE_SIZE}
        if posted_within_days:
            params["f_TPR"] = f"r{posted_within_days * 86400}"
        if remote_only:
            params["f_WT"] = "2"

        resp = s.get(SEARCH_URL, params=params, timeout=DEFAULT_TIMEOUT)
        if resp.status_code != 200 or not resp.text.strip():
            break

        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.select("li")
        if not cards:
            break

        added = 0
        for li in cards:
            card = li.select_one("div.base-card") or li
            job_id = _job_id_from_card(card)
            title = _text(li.select_one("h3.base-search-card__title"))
            if not job_id or not title:
                continue
            link = li.select_one("a.base-card__full-link")
            url = (link.get("href") or "").split("?")[0] if link else ""
            company = _text(li.select_one("h4.base-search-card__subtitle"))
            loc = _text(li.select_one("span.job-search-card__location"))
            posted_at = None
            time_tag = li.find("time")
            if time_tag and time_tag.get("datetime"):
                try:
                    posted_at = datetime.strptime(time_tag["datetime"], "%Y-%m-%d").replace(
                        tzinfo=timezone.utc
                    )
                except ValueError:
                    pass
            if job_id not in jobs:
                jobs[job_id] = Job(
                    source="linkedin",
                    company=company or "Unknown",
                    job_id=job_id,
                    title=title,
                    url=url,
                    location=loc,
                    posted_at=posted_at,
                )
                added += 1

        if added == 0:
            break
        time.sleep(random.uniform(3.0, 6.0))  # polite pacing between pages

    return list(jobs.values())
