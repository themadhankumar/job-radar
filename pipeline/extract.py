"""Extract pay ranges and minimum years-of-experience from job descriptions.

Regex-first (free, covers most US postings). If ANTHROPIC_API_KEY is set,
descriptions that regex can't parse get one cheap Haiku pass, capped per run.
"""
from __future__ import annotations

import json
import os
import re

import requests

MONEY = r"\$\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*([kK])?"
RANGE_RE = re.compile(MONEY + r"\s*(?:-|–|—|to)\s*" + MONEY)
SINGLE_RE = re.compile(MONEY)
HOURLY_HINT = re.compile(r"(?:per\s+hour|/\s*(?:hr|hour)|hourly)", re.I)
YEARLY_HINT = re.compile(r"(?:per\s+(?:year|annum)|/\s*(?:yr|year)|annual|salary)", re.I)
YOE_RE = re.compile(
    r"(\d{1,2})\s*(?:\+|or more|plus)?\s*(?:-\s*\d{1,2}\s*)?years?(?:['’]s)?\s+(?:of\s+)?"
    r"(?:relevant\s+|professional\s+|industry\s+|work(?:ing)?\s+|hands[- ]on\s+)*experience",
    re.I,
)

MAX_HAIKU_PER_RUN = 40
HAIKU_MODEL = "claude-haiku-4-5"


def _num(raw: str, k: str | None) -> int:
    n = float(raw.replace(",", ""))
    if k:
        n *= 1000
    return int(n)


def extract_pay(text: str) -> tuple[int | None, int | None, str | None]:
    if not text:
        return None, None, None
    m = RANGE_RE.search(text)
    if m:
        lo, hi = _num(m.group(1), m.group(2)), _num(m.group(3), m.group(4))
    else:
        m = SINGLE_RE.search(text)
        if not m:
            return None, None, None
        lo = hi = _num(m.group(1), m.group(2))
    window = text[max(0, m.start() - 80): m.end() + 80]
    if lo <= 500 and HOURLY_HINT.search(window):
        return lo, hi, "hour"
    if lo <= 500 and not YEARLY_HINT.search(window):
        return None, None, None  # ambiguous small number: skip rather than guess
    if lo < 500:
        return None, None, None
    if lo < 10_000:  # "$120" style shorthand next to salary words -> assume thousands
        lo, hi = lo * 1000, hi * 1000
    if hi < lo:
        lo, hi = hi, lo
    if not (20_000 <= lo <= 2_000_000):
        return None, None, None
    return lo, hi, "year"


def extract_yoe(text: str) -> int | None:
    if not text:
        return None
    hits = [int(m.group(1)) for m in YOE_RE.finditer(text)]
    hits = [h for h in hits if 0 < h <= 20]
    return min(hits) if hits else None


def haiku_extract(description: str, api_key: str) -> dict | None:
    """One-shot structured extraction for descriptions regex couldn't parse."""
    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={
                "model": HAIKU_MODEL,
                "max_tokens": 200,
                "messages": [{"role": "user", "content":
                    "Extract from this job posting. Reply ONLY with JSON: "
                    '{"pay_min": int|null, "pay_max": int|null, "pay_period": "year"|"hour"|null, "yoe_min": int|null}. '
                    "Annual USD amounts as full integers. null when not stated.\n\n"
                    + description[:6000]}],
            },
            timeout=30,
        )
        if resp.status_code != 200:
            return None
        raw = "".join(b.get("text", "") for b in resp.json().get("content", []))
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except Exception:  # noqa: BLE001 — enrichment must never break the run
        return None


def enrich_new_jobs(conn) -> int:
    """Fill pay/yoe for un-enriched jobs. Returns number processed."""
    rows = conn.execute(
        "SELECT id, description FROM jobs WHERE NOT enriched ORDER BY id DESC LIMIT 500"
    ).fetchall()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    haiku_budget = MAX_HAIKU_PER_RUN if api_key else 0
    done = 0
    for r in rows:
        desc = r["description"] or ""
        lo, hi, period = extract_pay(desc)
        yoe = extract_yoe(desc)
        if lo is None and yoe is None and len(desc) > 200 and haiku_budget > 0:
            data = haiku_extract(desc, api_key)
            haiku_budget -= 1
            if data:
                lo, hi = data.get("pay_min"), data.get("pay_max")
                period = data.get("pay_period")
                yoe = data.get("yoe_min")
        conn.execute(
            "UPDATE jobs SET pay_min=%s, pay_max=%s, pay_period=%s, yoe_min=%s, enriched=TRUE WHERE id=%s",
            (lo, hi, period, yoe, r["id"]),
        )
        done += 1
    conn.commit()
    return done
