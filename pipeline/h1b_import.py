"""Import USCIS H-1B Employer Data Hub CSVs into the sponsors table.

Get the data (free, no login):
  https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub
  → "Data Hub Files" → download the CSV for each fiscal year you want
  (FY2024 + FY2025 is plenty for a current signal).

Run:
  python h1b_import.py path/to/h1b_fy2025.csv [more.csv ...]

Idempotent — re-importing a year replaces that year's rows. Employer names are
normalized identically to the norm_employer() SQL function so dashboard
lookups by company name hit.
"""
from __future__ import annotations

import csv
import re
import sys

import db as dbm

SUFFIXES = re.compile(
    r"\b(incorporated|corporation|technologies|technology|solutions|services|"
    r"holdings|group|inc|llc|llp|ltd|corp|co|plc|usa|us)\b"
)
NON_ALNUM = re.compile(r"[^a-z0-9]+")


def norm(name: str) -> str:
    s = SUFFIXES.sub("", (name or "").lower())
    return NON_ALNUM.sub(" ", s).strip()


def pick(row: dict, *candidates: str) -> str:
    """USCIS renames columns across years; match loosely."""
    lowered = {k.lower().strip().replace("_", " "): v for k, v in row.items()}
    for c in candidates:
        for k, v in lowered.items():
            if c in k:
                return v or ""
    return ""


def main(paths: list[str]) -> int:
    conn = dbm.connect()
    for path in paths:
        rows = 0
        agg: dict[tuple[str, int], dict] = {}
        with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
            for row in csv.DictReader(f):
                employer = pick(row, "employer (petitioner) name", "employer name", "petitioner name", "employer")
                fy_raw = pick(row, "fiscal year")
                if not employer or not fy_raw:
                    continue
                try:
                    fy = int(str(fy_raw).strip()[:4])
                except ValueError:
                    continue
                appr = sum(_int(pick(row, "initial approval", "new employment approval")) for _ in [0]) + _int(pick(row, "continuing approval", "continuation approval"))
                den = _int(pick(row, "initial denial", "new employment denial")) + _int(pick(row, "continuing denial", "continuation denial"))
                key = (norm(employer), fy)
                if not key[0]:
                    continue
                slot = agg.setdefault(key, {"employer": employer.strip()[:200], "approvals": 0, "denials": 0})
                slot["approvals"] += appr
                slot["denials"] += den
                rows += 1
        years = sorted({fy for (_, fy) in agg})
        for fy in years:
            conn.execute("DELETE FROM sponsors WHERE fiscal_year = %s AND norm = ANY(%s)",
                         (fy, [n for (n, y) in agg if y == fy]))
        for (n, fy), v in agg.items():
            conn.execute(
                """INSERT INTO sponsors (employer, norm, fiscal_year, approvals, denials)
                   VALUES (%s,%s,%s,%s,%s)
                   ON CONFLICT (norm, fiscal_year) DO UPDATE
                   SET approvals = sponsors.approvals + EXCLUDED.approvals,
                       denials = sponsors.denials + EXCLUDED.denials""",
                (v["employer"], n, fy, v["approvals"], v["denials"]),
            )
        conn.commit()
        print(f"{path}: {rows} rows -> {len(agg)} employer-year records (FY {years})")
    conn.close()
    return 0


def _int(v: str) -> int:
    try:
        return int(float(str(v).replace(",", "").strip() or 0))
    except ValueError:
        return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    sys.exit(main(sys.argv[1:]))
