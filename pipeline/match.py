"""Profile-match engine — per-user match percentage (0–100) with components.

Blend (weights sum to 1.0):
    30%  skills     profile skills found in the posting
    25%  role       closeness of the job title to titles held / targeted
    20%  work       resume↔posting TF-IDF cosine (from score.py)
    15%  exp        job's required YoE vs the user's YoE
    10%  industry   company's classified industry vs the user's background

Candidates are ALL recent jobs (not just keyword matches) so the Suggested tab
can surface similar roles the user didn't explicitly search for. Companies are
classified once by Haiku and cached in company_profiles; without an API key
the industry component scores neutral. Pure python otherwise.

Components (plus the top "missing" skill terms that would raise the score) are
stored as JSONB alongside the score for the drawer's breakdown UI.
"""
from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from datetime import timedelta

import requests

from score import STOP, similarity, tokens

WEIGHTS = {"skills": 0.30, "role": 0.25, "work": 0.20, "exp": 0.15, "industry": 0.10}
LOOKBACK_DAYS = 15
MAX_JOBS = 4000
CLASSIFY_CAP = 40  # new companies classified per run
CLASSIFY_MODEL = "claude-haiku-4-5"

WORD_CACHE: dict[str, re.Pattern] = {}


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def _contains(text_lower: str, term: str) -> bool:
    """Word-ish match: 'sql' shouldn't hit 'mysqli', but 'ci/cd' and 'c++' must work."""
    t = term.lower().strip()
    if not t:
        return False
    pat = WORD_CACHE.get(t)
    if pat is None:
        pat = re.compile(r"(?<![a-z0-9])" + re.escape(t) + r"(?![a-z0-9])")
        WORD_CACHE[t] = pat
    return bool(pat.search(text_lower))


def skills_score(profile_skills: list[str], text_lower: str) -> tuple[float, list[str]]:
    matched = [s for s in profile_skills if _contains(text_lower, s)]
    return min(1.0, len(matched) / 8.0), matched


ABBREV = {
    "tpm": ["technical", "program", "manager"],
    "pm": ["product", "manager"],
    "pgm": ["program", "manager"],
    "swe": ["software", "engineer"],
    "sde": ["software", "engineer"],
    "sre": ["site", "reliability", "engineer"],
    "em": ["engineering", "manager"],
    "ds": ["data", "scientist"],
    "de": ["data", "engineer"],
    "sr": ["senior"],
    "jr": ["junior"],
    "mgr": ["manager"],
    "eng": ["engineer"],
}


def title_tokens(text: str) -> set[str]:
    out: set[str] = set()
    for t in tokens(text):
        out.update(ABBREV.get(t, [t]))
    return out


def role_score(user_titles: list[str], job_title: str) -> float:
    jt = title_tokens(job_title)
    if not jt or not user_titles:
        return 0.0
    best = 0.0
    for t in user_titles:
        ut = title_tokens(t)
        if not ut:
            continue
        overlap = len(jt & ut)
        j = overlap / len(jt | ut)                    # jaccard
        c = overlap / min(len(jt), len(ut))           # containment ("TPM" ⊂ "Senior TPM, AI")
        best = max(best, 0.5 * j + 0.5 * c)
    return min(1.0, best)


def exp_score(user_yoe: float | None, job_yoe_min) -> float:
    if user_yoe is None or job_yoe_min is None:
        return 0.65  # unknown → neutral-ish
    slack = user_yoe - float(job_yoe_min)
    if slack < 0:
        return max(0.0, 1.0 + slack / 5.0)            # underqualified: -0.2/yr short
    if slack <= 4:
        return 1.0
    return max(0.4, 1.0 - (slack - 4) / 10.0)         # heavily overqualified tapers


def industry_score(user_industries: list[str], company: tuple[str, list[str]] | None) -> float:
    if company is None:
        return 0.5
    if not user_industries:
        return 0.65
    industry, tags = company
    theirs = {industry.lower(), *(t.lower() for t in tags)} - {""}
    mine = {i.lower() for i in user_industries}
    for m in mine:
        for t in theirs:
            if m in t or t in m:
                return 1.0
    return 0.35


GENERIC = set(
    "role team work years experience skills strong ability including across help "
    "build building looking join company position candidates ideal every needs preferred manage".split()
)


def missing_terms(doc_tokens: list[str], idf: dict[str, float], known: set[str], top: int = 5) -> list[str]:
    """The posting's most distinctive terms the profile doesn't cover — boost chips."""
    tf = Counter(doc_tokens)
    scored = sorted(
        ((t, f * idf.get(t, 1.0)) for t, f in tf.items()
         if len(t) >= 3 and t not in STOP and not t.isdigit() and idf.get(t, 0) > 1.4),
        key=lambda x: -x[1],
    )
    out: list[str] = []
    for t, _ in scored:
        t = t.strip("./-")
        if len(t) < 3 or t in GENERIC or t in out:
            continue
        if any(t in k or k in t for k in known):
            continue
        out.append(t)
        if len(out) >= top:
            break
    return out


def classify_companies(conn, names: list[str], api_key: str) -> int:
    """One Haiku call per batch of ≤20 companies → industry + tags, cached."""
    done = 0
    for i in range(0, len(names), 20):
        batch = names[i : i + 20]
        try:
            resp = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
                json={
                    "model": CLASSIFY_MODEL,
                    "max_tokens": 1000,
                    "messages": [{
                        "role": "user",
                        "content": (
                            "For each company, give its primary industry and 3-5 short tags "
                            '(sector, domain, product type). Respond with ONLY JSON: '
                            '[{"name": "...", "industry": "...", "tags": ["..."]}]\n\n'
                            + "\n".join(batch)
                        ),
                    }],
                },
                timeout=45,
            )
            resp.raise_for_status()
            text = "".join(b.get("text", "") for b in resp.json().get("content", []))
            text = re.sub(r"^```json|^```|```$", "", text.strip(), flags=re.M).strip()
            for row in json.loads(text):
                name, industry = str(row.get("name", "")), str(row.get("industry", ""))[:80]
                tags = [str(t)[:40] for t in row.get("tags", []) if isinstance(t, str)][:6]
                if not name:
                    continue
                conn.execute(
                    """INSERT INTO company_profiles (name_norm, industry, tags)
                       VALUES (%s, %s, %s)
                       ON CONFLICT (name_norm) DO UPDATE
                         SET industry = EXCLUDED.industry, tags = EXCLUDED.tags, updated_at = NOW()""",
                    (_norm(name), industry, tags),
                )
                done += 1
            conn.commit()
        except Exception as e:  # noqa: BLE001 — classification is best-effort
            print(f"  company classification batch failed: {e}")
    return done


def compute_matches(conn, lookback_days: int = LOOKBACK_DAYS) -> int:
    """Score all recent jobs for every onboarded user. Returns rows written."""
    import db as dbm

    since = dbm.utcnow() - timedelta(days=lookback_days)
    jobs = conn.execute(
        """SELECT id, title, left(description, 4000) AS description, company_name,
                  yoe_min, posted_at, created_at
           FROM jobs WHERE created_at > %s
           ORDER BY created_at DESC LIMIT %s""",
        (since, MAX_JOBS),
    ).fetchall()
    if not jobs:
        return 0

    users = conn.execute(
        """SELECT u.id, r.content AS resume, p.data AS profile
           FROM users u
           LEFT JOIN resumes r ON r.user_id = u.id
           LEFT JOIN user_profiles p ON p.user_id = u.id
           WHERE u.onboarded"""
    ).fetchall()

    # classify companies not yet cached (best-effort, capped)
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    norms = {_norm(j["company_name"]): j["company_name"] for j in jobs}
    cached = {r["name_norm"]: (r["industry"], r["tags"]) for r in conn.execute(
        "SELECT name_norm, industry, tags FROM company_profiles"
    ).fetchall()}
    unknown = [display for n, display in norms.items() if n and n not in cached]
    if api_key and unknown:
        classified = classify_companies(conn, unknown[:CLASSIFY_CAP], api_key)
        if classified:
            cached = {r["name_norm"]: (r["industry"], r["tags"]) for r in conn.execute(
                "SELECT name_norm, industry, tags FROM company_profiles"
            ).fetchall()}

    # shared corpus stats
    docs = [tokens((j["title"] or "") + " " + (j["description"] or "")) for j in jobs]
    df: Counter = Counter()
    for d in docs:
        df.update(set(d))
    n = len(docs)
    idf = {t: 1.0 + math.log(n / (1 + c)) for t, c in df.items()}

    score_sql = (
        "INSERT INTO user_job_scores (user_id, job_id, score, components) "
        "VALUES (%s,%s,%s,%s) "
        "ON CONFLICT (user_id, job_id) DO UPDATE SET "
        "score = EXCLUDED.score, components = EXCLUDED.components, computed_at = NOW()"
    )
    batch: list[tuple] = []
    for u in users:
        profile = u["profile"] or {}
        kws = [r["keyword"] for r in conn.execute(
            "SELECT keyword FROM user_keywords WHERE user_id=%s AND kind='include'", (u["id"],)
        ).fetchall()]
        skills = profile.get("skills") or kws
        titles = (profile.get("titles") or []) + kws
        yoe = profile.get("yoe")
        industries = profile.get("industries") or []
        known = {s.lower() for s in skills}
        resume_toks = Counter(tokens((u["resume"] or "")[:20000]))
        if not skills and not resume_toks:
            continue

        # Incremental: only score jobs this user hasn't been scored against yet.
        # A profile or resume change clears the user's rows (see web invalidation),
        # so those recompute here on the next run; steady-state only touches new jobs.
        scored = {r["job_id"] for r in conn.execute(
            "SELECT job_id FROM user_job_scores WHERE user_id=%s", (u["id"],)
        ).fetchall()}

        for j, dtoks in zip(jobs, docs):
            if j["id"] in scored:
                continue
            text = (j["title"] or "") + " " + (j["description"] or "")
            tl = text.lower()
            s_skills, _ = skills_score(skills, tl)
            s_role = role_score(titles, j["title"] or "")
            s_work = min(similarity(resume_toks, text, idf) * 2.5, 1.0) if resume_toks else 0.0
            s_exp = exp_score(yoe, j["yoe_min"])
            s_ind = industry_score(industries, cached.get(_norm(j["company_name"])))
            score = round(100 * (
                WEIGHTS["skills"] * s_skills + WEIGHTS["role"] * s_role
                + WEIGHTS["work"] * s_work + WEIGHTS["exp"] * s_exp
                + WEIGHTS["industry"] * s_ind
            ))
            components = {
                "skills": round(s_skills, 2), "role": round(s_role, 2), "work": round(s_work, 2),
                "exp": round(s_exp, 2), "industry": round(s_ind, 2),
                "missing": missing_terms(dtoks, idf, known) if score >= 40 else [],
            }
            batch.append((u["id"], j["id"], score, json.dumps(components)))

    if batch:
        with conn.cursor() as cur:
            cur.executemany(score_sql, batch)
    conn.commit()
    return len(batch)
