"""SQLite-backed dedupe state: each run only surfaces never-before-seen jobs."""
from __future__ import annotations

import sqlite3
from pathlib import Path

from models import Job

SCHEMA = """
CREATE TABLE IF NOT EXISTS seen_jobs (
    source     TEXT NOT NULL,
    company    TEXT NOT NULL,
    job_id     TEXT NOT NULL,
    title      TEXT,
    url        TEXT,
    first_seen TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (source, company, job_id)
);
"""


class State:
    def __init__(self, path: str = "state/seen_jobs.db"):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def is_new(self, job: Job) -> bool:
        cur = self.conn.execute(
            "SELECT 1 FROM seen_jobs WHERE source=? AND company=? AND job_id=?",
            job.key,
        )
        return cur.fetchone() is None

    def mark_seen(self, job: Job) -> None:
        self.conn.execute(
            "INSERT OR IGNORE INTO seen_jobs (source, company, job_id, title, url) "
            "VALUES (?, ?, ?, ?, ?)",
            (*job.key, job.title, job.url),
        )

    def commit(self) -> None:
        self.conn.commit()

    def count(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM seen_jobs").fetchone()[0]

    def close(self) -> None:
        self.conn.commit()
        self.conn.close()
