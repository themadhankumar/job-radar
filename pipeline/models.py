"""Shared data model for job postings."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Job:
    source: str                     # greenhouse | lever | ashby | workday | linkedin
    company: str
    job_id: str
    title: str
    url: str
    location: str = ""
    posted_at: datetime | None = None   # timezone-aware UTC when known
    description: str = ""
    keywords_matched: list[str] = field(default_factory=list)

    @property
    def key(self) -> tuple[str, str, str]:
        return (self.source, self.company, self.job_id)
