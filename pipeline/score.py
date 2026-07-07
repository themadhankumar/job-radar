"""Per-user match scores (0–100), stored in user_job_scores.

Blend:  55% resume↔job TF-IDF cosine · 30% keyword hits · 15% freshness.
Pure python — no model downloads, identical results everywhere. Designed so a
real embedding backend can replace `similarity()` later without touching callers.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from datetime import timedelta

STOP = set(
    "a an the and or of to in for with on at by from as is are was were be been "
    "this that these those you your we our us they their it its will can may "
    "must should would about into over under more most other such than then "
    "who whom which what when where how all any both each few not no nor only "
    "own same so too very s t don now do does did have has had having he she "
    "his her hers him if because while during before after above below again "
    "further once here there why but out up down off between through".split()
)
TOKEN = re.compile(r"[a-z][a-z0-9+#./-]{1,}")


def tokens(text: str) -> list[str]:
    return [t for t in TOKEN.findall(text.lower()) if t not in STOP and len(t) > 1]


def similarity(resume_tokens: Counter, job_text: str, idf: dict[str, float]) -> float:
    """TF-IDF cosine between resume and one job document."""
    jt = Counter(tokens(job_text))
    if not jt or not resume_tokens:
        return 0.0
    dot = 0.0
    for term, jf in jt.items():
        rf = resume_tokens.get(term)
        if rf:
            w = idf.get(term, 1.0)
            dot += (rf * w) * (jf * w)
    r_norm = math.sqrt(sum((f * idf.get(t, 1.0)) ** 2 for t, f in resume_tokens.items()))
    j_norm = math.sqrt(sum((f * idf.get(t, 1.0)) ** 2 for t, f in jt.items()))
    return dot / (r_norm * j_norm) if r_norm and j_norm else 0.0


def compute_scores(conn, lookback_days: int = 45) -> int:
    """Score every user's matched jobs from the last `lookback_days`."""
    import db as dbm

    users = conn.execute(
        """SELECT u.id, r.content AS resume FROM users u
           LEFT JOIN resumes r ON r.user_id = u.id WHERE u.onboarded"""
    ).fetchall()
    total = 0
    since = dbm.utcnow() - timedelta(days=lookback_days)
    for u in users:
        jobs = dbm.user_matched_jobs_since(conn, u["id"], since)
        if not jobs:
            continue
        kws = [r["keyword"] for r in conn.execute(
            "SELECT keyword FROM user_keywords WHERE user_id=%s AND kind='include'", (u["id"],)
        ).fetchall()]

        # corpus idf across this user's candidate jobs
        docs = [tokens((j["title"] or "") + " " + (j["description"] or "")[:4000]) for j in jobs]
        df: Counter = Counter()
        for d in docs:
            df.update(set(d))
        n = len(docs) or 1
        idf = {t: 1.0 + math.log(n / (1 + c)) for t, c in df.items()}
        resume_toks = Counter(tokens((u["resume"] or "")[:20000]))

        now = dbm.utcnow()
        for j, dtoks in zip(jobs, docs):
            text = (j["title"] or "") + " " + (j["description"] or "")[:4000]
            sim = similarity(resume_toks, text, idf) if resume_toks else 0.0
            tl = text.lower()
            kw = (sum(1 for k in kws if k in tl) / len(kws)) if kws else 0.0
            age_days = (now - (j["posted_at"] or j["created_at"])).days
            fresh = max(0.0, 1.0 - age_days / 30.0)
            score = round(100 * (0.55 * min(sim * 2.5, 1.0) + 0.30 * kw + 0.15 * fresh), 1)
            conn.execute(
                """INSERT INTO user_job_scores (user_id, job_id, score)
                   VALUES (%s,%s,%s)
                   ON CONFLICT (user_id, job_id)
                   DO UPDATE SET score = EXCLUDED.score, computed_at = NOW()""",
                (u["id"], j["id"], score),
            )
            total += 1
    conn.commit()
    return total
