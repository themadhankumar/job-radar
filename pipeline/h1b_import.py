"""Import USCIS H-1B Employer Data Hub files into the sponsors table.

Handles USCIS quirks (UTF-16, tab-separated, 7 approval + 7 denial columns)
and uses COPY for bulk insert — the whole run finishes in seconds instead of
tens of minutes with row-by-row INSERTs.
"""
from __future__ import annotations

import csv
import io
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


def open_uscis(path: str):
    with open(path, "rb") as f:
        head = f.read(2)
    if head in (b"\xff\xfe", b"\xfe\xff"):
        return open(path, encoding="utf-16", newline="")
    return open(path, encoding="utf-8-sig", errors="replace", newline="")


def pick_employer(row: dict) -> str:
    for k, v in row.items():
        kl = (k or "").lower()
        if "employer" in kl and "name" in kl:
            return (v or "").strip()
        if kl.strip() == "petitioner name":
            return (v or "").strip()
    return ""


def pick_fy(row: dict) -> int | None:
    for k, v in row.items():
        if "fiscal" in (k or "").lower() and "year" in (k or "").lower():
            try:
                return int(str(v).strip()[:4])
            except (ValueError, TypeError):
                return None
    return None


def _sum(row: dict, want: str) -> int:
    total = 0
    for k, v in row.items():
        if want in (k or "").lower():
            try:
                total += int(float(str(v).replace(",", "").strip() or 0))
            except (ValueError, TypeError):
                continue
    return total


def _clean(s: str) -> str:
    """Strip tabs/newlines so COPY sees exactly the fields we want."""
    return (s or "").replace("\t", " ").replace("\n", " ").replace("\r", " ")


def main(paths: list[str]) -> int:
    conn = dbm.connect()
    for path in paths:
        rows_read = 0
        agg: dict[tuple[str, int], dict] = {}
        print(f"reading {path}...", flush=True)
        with open_uscis(path) as f:
            for row in csv.DictReader(f, delimiter="\t"):
                rows_read += 1
                employer = pick_employer(row)
                fy = pick_fy(row)
                if not employer or not fy:
                    continue
                approvals = _sum(row, "approval")
                denials = _sum(row, "denial")
                if approvals == 0 and denials == 0:
                    continue
                key = (norm(employer), fy)
                if not key[0]:
                    continue
                slot = agg.setdefault(key, {"employer": employer[:200], "approvals": 0, "denials": 0})
                slot["approvals"] += approvals
                slot["denials"] += denials
        years = sorted({fy for (_, fy) in agg})
        print(f"  parsed {rows_read} rows -> {len(agg)} employer-year records (FY {years}). writing...", flush=True)

        with conn.cursor() as cur:
            # scratch table, load via COPY, then upsert into sponsors
            cur.execute("""
                CREATE TEMP TABLE _sponsors_stage (
                    employer TEXT, norm TEXT, fiscal_year INTEGER,
                    approvals INTEGER, denials INTEGER
                ) ON COMMIT DROP
            """)
            buf = io.StringIO()
            for (n, fy), v in agg.items():
                buf.write(f"{_clean(v['employer'])}\t{_clean(n)}\t{fy}\t{v['approvals']}\t{v['denials']}\n")
            buf.seek(0)
            with cur.copy("COPY _sponsors_stage FROM STDIN") as copy:
                copy.write(buf.getvalue())
            for fy in years:
                cur.execute("DELETE FROM sponsors WHERE fiscal_year = %s", (fy,))
            cur.execute("""
                INSERT INTO sponsors (employer, norm, fiscal_year, approvals, denials)
                SELECT employer, norm, fiscal_year, approvals, denials FROM _sponsors_stage
                ON CONFLICT (norm, fiscal_year) DO UPDATE
                SET approvals = sponsors.approvals + EXCLUDED.approvals,
                    denials = sponsors.denials + EXCLUDED.denials
            """)
        conn.commit()
        print(f"  ✓ {path} done", flush=True)
    conn.close()
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    sys.exit(main(sys.argv[1:]))
