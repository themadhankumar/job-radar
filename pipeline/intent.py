"""Ghost-job intent scoring.

This is NOT a match signal. Match answers "does this job fit the user"; intent
answers "does this posting look like a real, active opening." We can never *know*
a req is a ghost (internal fills / pipeline-building are invisible from outside),
so this is a probabilistic signal surfaced as a soft caveat, never a hard filter.

Signals (cheap tier — available at first sight of a job):
  - evergreen   Haiku flags perpetual / talent-pool / pipeline-building language
  - generic     bare role title with no level, team, or domain
  - stale       posted_at far in the past even though just swept (e.g. an old req
                pulled in when a company's board is first added)

Deferred tier (not here yet — needs last_seen_at history to accrue):
  - reposts, company-level req duration, zombie reqs left open indefinitely.

Score is 0-100, higher = more ghost-like. Without an API key the evergreen
signal is skipped and scoring degrades to the two heuristics (conservative).
"""
from __future__ import annotations

import json
import os
import re

import requests

MODEL = "claude-haiku-4-5"
LOOKBACK_DAYS = 30
MAX_JOBS = 600          # cost cap per run; scored once (intent_score IS NULL)
BATCH = 15
STALE_DAYS = 45         # posted_at older than this at first sight starts to count

# Weights (transparent, additive, capped at 100).
W_EVERGREEN = 55
W_GENERIC = 15
W_STALE_MAX = 25

GHOST_AT = 60
WATCH_AT = 30

SENIORITY = r"(?:senior|sr\.?|staff|principal|lead|junior|jr\.?|entry[ -]?level|associate|mid[ -]?level|distinguished)"
GENERIC_ROLES = {
    "software engineer", "software developer", "product manager", "data scientist",
    "data engineer", "program manager", "project manager", "business analyst",
    "full stack engineer", "fullstack engineer", "backend engineer", "frontend engineer",
    "account executive", "sales manager", "marketing manager", "operations manager",
    "engineering manager", "product designer", "ux designer", "recruiter", "consultant",
    "developer", "engineer", "analyst",
}


def _is_generic(title: str) -> bool:
    t = (title or "").strip().lower()
    t = re.sub(r"[\(\[].*?[\)\]]", "", t)                 # drop "(Remote)", "[US]"
    t = re.sub(rf"^{SENIORITY}\s+", "", t).strip()        # strip one leading seniority word
    t = re.sub(r"\s+(i{1,3}|iv|v|\d)$", "", t).strip()    # drop trailing level numerals
    t = re.sub(r"[^a-z ]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t in GENERIC_ROLES


def _stale_points(age_days: int | None) -> tuple[float, str | None]:
    if age_days is None or age_days <= STALE_DAYS:
        return 0.0, None
    pts = min(W_STALE_MAX, (age_days - STALE_DAYS) / 4.0)
    return pts, f"posted {age_days}d ago"


def _evergreen_batch(rows: list[dict], api_key: str) -> dict[int, tuple[bool, str]]:
    """Ask Haiku which postings read as evergreen / pipeline-building. Best-effort."""
    payload = [
        {"i": r["id"], "title": r["title"][:160],
         "desc": re.sub(r"\s+", " ", (r["description"] or ""))[:900]}
        for r in rows
    ]
    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            json={
                "model": MODEL,
                "max_tokens": 1200,
                "messages": [{
                    "role": "user",
                    "content": (
                        "You screen job postings for hiring intent. For each posting, decide if it "
                        "reads like an EVERGREEN / pipeline-building / talent-community posting (kept "
                        "open to collect resumes, not a specific active opening) rather than a real, "
                        "specific active req. Signals: 'always looking', 'join our talent community', "
                        "'future opportunities', 'general application', no specific team/scope/duties, "
                        "one generic listing standing in for many roles. A detailed posting with a "
                        "specific team, scope, and responsibilities is NOT evergreen.\n"
                        'Respond with ONLY JSON: [{"i": <id>, "evergreen": true|false, '
                        '"reason": "<=8 words"}]\n\n'
                        + json.dumps(payload)
                    ),
                }],
            },
            timeout=45,
        )
        resp.raise_for_status()
        text = "".join(b.get("text", "") for b in resp.json().get("content", []))
        text = re.sub(r"^```json|^```|```$", "", text.strip(), flags=re.M).strip()
        out: dict[int, tuple[bool, str]] = {}
        for row in json.loads(text):
            jid = int(row.get("i"))
            out[jid] = (bool(row.get("evergreen")), str(row.get("reason", ""))[:60])
        return out
    except Exception as e:  # noqa: BLE001 — evergreen signal is best-effort
        print(f"  intent evergreen batch failed: {e}")
        return {}


def score_intent(conn, lookback_days: int = LOOKBACK_DAYS) -> int:
    """Score hiring intent for recent, not-yet-scored jobs. Returns rows written."""
    import db as dbm
    from datetime import timedelta

    now = dbm.utcnow()
    since = now - timedelta(days=lookback_days)
    jobs = conn.execute(
        """SELECT id, title, left(description, 4000) AS description, posted_at
           FROM jobs
           WHERE intent_score IS NULL AND created_at > %s
           ORDER BY created_at DESC LIMIT %s""",
        (since, MAX_JOBS),
    ).fetchall()
    if not jobs:
        return 0

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    updates: list[tuple] = []

    for i in range(0, len(jobs), BATCH):
        chunk = jobs[i : i + BATCH]
        ev = _evergreen_batch(chunk, api_key) if api_key else {}
        for r in chunk:
            age_days = (now - r["posted_at"]).days if r["posted_at"] else None
            score = 0.0
            reasons: list[str] = []

            eg, eg_reason = ev.get(r["id"], (False, ""))
            if eg:
                score += W_EVERGREEN
                reasons.append(eg_reason or "reads like an evergreen posting")

            generic = _is_generic(r["title"])
            if generic:
                score += W_GENERIC
                reasons.append("generic title, no level or team")

            sp, sr = _stale_points(age_days)
            if sp > 0:
                score += sp
                reasons.append(sr)

            score = round(min(100.0, score), 1)
            level = "ghost" if score >= GHOST_AT else "watch" if score >= WATCH_AT else "ok"
            detail = {
                "score": score, "level": level, "reasons": reasons,
                "evergreen": eg, "generic_title": generic, "age_days": age_days,
                "checked_at": now.isoformat(),
            }
            updates.append((score, json.dumps(detail), r["id"]))

    if updates:
        with conn.cursor() as cur:
            cur.executemany(
                "UPDATE jobs SET intent_score = %s, intent = %s WHERE id = %s",
                updates,
            )
        conn.commit()
    return len(updates)
