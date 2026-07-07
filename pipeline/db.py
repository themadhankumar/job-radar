"""Postgres layer shared by the fetch pipeline and the digest job."""
from __future__ import annotations

import os
from datetime import datetime, timezone

import psycopg
from psycopg.rows import dict_row

from models import Job


def connect() -> psycopg.Connection:
    url = os.environ["DATABASE_URL"]
    return psycopg.connect(url, row_factory=dict_row)


def watched_companies(conn) -> list[dict]:
    """Companies at least one user is watching."""
    return conn.execute(
        """SELECT DISTINCT c.* FROM companies c
           JOIN user_companies uc ON uc.company_id = c.id"""
    ).fetchall()


def all_include_keywords(conn) -> list[str]:
    rows = conn.execute(
        "SELECT DISTINCT keyword FROM user_keywords WHERE kind = 'include' ORDER BY keyword"
    ).fetchall()
    return [r["keyword"] for r in rows]


def insert_jobs(conn, jobs: list[Job], company_id: int | None = None) -> int:
    """Insert jobs, skipping ones already seen. Returns count of new rows."""
    new = 0
    with conn.cursor() as cur:
        for j in jobs:
            cur.execute(
                """INSERT INTO jobs (source, company_id, company_name, ext_id, title, url,
                                     location, description, posted_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (source, company_name, ext_id) DO NOTHING""",
                (j.source, company_id, j.company, j.job_id, j.title[:500], j.url,
                 j.location[:500], j.description[:20000], j.posted_at),
            )
            new += cur.rowcount
    conn.commit()
    return new


def users_for_notion(conn) -> list[dict]:
    return conn.execute(
        """SELECT id, name, email, notion_token_enc, notion_database_id
           FROM users WHERE notion_token_enc IS NOT NULL AND notion_database_id IS NOT NULL"""
    ).fetchall()


def users_for_digest(conn) -> list[dict]:
    return conn.execute(
        "SELECT id, name, email FROM users WHERE digest_enabled AND onboarded"
    ).fetchall()


def user_matched_jobs_since(conn, user_id: int, since: datetime) -> list[dict]:
    """Jobs created since `since` that match the user's keywords and companies.

    Tracked-company ATS jobs match on title OR description; global/LinkedIn
    jobs match on title only (mirrors the dashboard query).
    """
    return conn.execute(
        """
        WITH kw AS (
          SELECT keyword, kind FROM user_keywords WHERE user_id = %(uid)s
        ),
        mine AS (
          SELECT c.id, lower(c.name) AS lname FROM user_companies uc
          JOIN companies c ON c.id = uc.company_id WHERE uc.user_id = %(uid)s
        )
        SELECT j.* FROM jobs j
        WHERE j.created_at > %(since)s
          AND (
            (
              (j.company_id IN (SELECT id FROM mine) OR lower(j.company_name) IN (SELECT lname FROM mine))
              AND EXISTS (SELECT 1 FROM kw WHERE kind='include'
                          AND (j.title ILIKE '%%'||keyword||'%%' OR j.description ILIKE '%%'||keyword||'%%'))
            )
            OR (
              j.source = 'linkedin'
              AND EXISTS (SELECT 1 FROM kw WHERE kind='include' AND j.title ILIKE '%%'||keyword||'%%')
            )
          )
          AND NOT EXISTS (SELECT 1 FROM kw WHERE kind='exclude' AND j.title ILIKE '%%'||keyword||'%%')
        ORDER BY j.posted_at DESC NULLS LAST
        LIMIT 100
        """,
        {"uid": user_id, "since": since},
    ).fetchall()


def last_digest_at(conn, user_id: int) -> datetime | None:
    row = conn.execute(
        "SELECT max(sent_at) AS last FROM digest_log WHERE user_id = %s", (user_id,)
    ).fetchone()
    return row["last"] if row and row["last"] else None


def log_digest(conn, user_id: int, count: int) -> None:
    conn.execute("INSERT INTO digest_log (user_id, job_count) VALUES (%s, %s)", (user_id, count))
    conn.commit()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
