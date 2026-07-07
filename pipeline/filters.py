"""Keyword, location, and recency filtering."""
from __future__ import annotations

import html
import re
from datetime import datetime, timedelta, timezone

from models import Job

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def normalize(text: str) -> str:
    """Strip HTML tags/entities, collapse whitespace, lowercase."""
    text = html.unescape(text or "")
    text = _TAG_RE.sub(" ", text)
    return _WS_RE.sub(" ", text).lower().strip()


def match_job(job: Job, filters: dict) -> tuple[bool, list[str]]:
    """Return (matches, keywords_matched)."""
    title = normalize(job.title)
    desc = normalize(job.description)
    fields = {"title": title, "description": desc}
    match_fields = filters.get("match_fields") or ["title", "description"]
    haystack = " \n ".join(fields[f] for f in match_fields if f in fields)

    include = [k.lower() for k in filters.get("include_keywords") or []]
    matched = [k for k in include if k in haystack]
    if include and not matched:
        return False, []

    if filters.get("require_title_match") and include and not any(k in title for k in include):
        return False, []

    for k in filters.get("exclude_keywords") or []:
        k = k.lower()
        if k in title or k in desc:
            return False, []

    allow = [loc.lower() for loc in filters.get("locations_allow") or []]
    if allow:
        loc = normalize(job.location)
        # Blank locations are kept (often remote roles omit location).
        if loc and not any(a in loc for a in allow):
            return False, []

    days = filters.get("posted_within_days")
    if days and job.posted_at:
        cutoff = datetime.now(timezone.utc) - timedelta(days=int(days))
        if job.posted_at < cutoff:
            return False, []

    return True, matched
