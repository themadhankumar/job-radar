"""Discover which ATS each target company uses by probing public endpoints.

Usage:
    python discover.py                     # probe the built-in target list
    python discover.py "Some Company"      # probe specific names
    python discover.py --slug snorkelai    # probe one exact slug on all ATSes

Prints a ready-to-paste YAML snippet for every hit. Companies with no hit
are almost certainly on a custom ATS (Epic, Mayo, UMN, Stanford Health,
Microsoft, Oracle Health…) — cover those via the LinkedIn searches in
config.yaml, or find their Workday tenant (see README).
"""
from __future__ import annotations

import argparse
import re
import sys
import time

import requests

from fetchers.common import make_session

TARGETS = [
    "Labelbox", "SuperAnnotate", "Scale AI", "Snorkel AI", "Surge AI",
    "Mercor", "Turing", "Invisible Technologies", "Abridge", "Innovaccer",
    "Tempus AI", "Tempus",
]

# Workday tenant candidates: (tenant, host, [site candidates])
WORKDAY_CANDIDATES = {
    "Optum / UHG": ("uhg", "wd1", ["External_Career_Site", "UHG", "External"]),
    "Athenahealth": ("athenahealth", "wd1", ["External", "athenahealth", "External_Career_Site"]),
    "Mass General Brigham": ("partners", "wd1", ["MGBExternal", "External", "PHS_External"]),
    "Duke Health": ("dukeuniversity", "wd1", ["External_Career_Site", "External", "Duke_Careers"]),
    "Cleveland Clinic": ("ccf", "wd1", ["External", "ClevelandClinic", "External_Career_Site"]),
}


def slug_variants(name: str) -> list[str]:
    base = re.sub(r"[^a-z0-9 ]", "", name.lower()).strip()
    nospace = base.replace(" ", "")
    hyphen = base.replace(" ", "-")
    first = base.split(" ")[0]
    variants = [nospace, hyphen, first, nospace.replace("ai", "") or nospace]
    seen, out = set(), []
    for v in variants:
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def probe_greenhouse(s, slug: str) -> bool:
    r = s.get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs", timeout=15)
    return r.status_code == 200 and "jobs" in r.json()


def probe_lever(s, slug: str) -> bool:
    r = s.get(f"https://api.lever.co/v0/postings/{slug}", params={"mode": "json"}, timeout=15)
    return r.status_code == 200 and isinstance(r.json(), list)


def probe_ashby(s, slug: str) -> bool:
    r = s.get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}", timeout=15)
    return r.status_code == 200 and "jobs" in r.json()


def probe_workday(s, tenant: str, host: str, site: str) -> int | None:
    url = f"https://{tenant}.{host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs"
    try:
        r = s.post(url, json={"appliedFacets": {}, "limit": 1, "offset": 0, "searchText": ""},
                   headers={"Accept": "application/json"}, timeout=15)
        if r.status_code == 200:
            return r.json().get("total")
    except requests.RequestException:
        pass
    return None


PROBES = [("greenhouse", probe_greenhouse), ("lever", probe_lever), ("ashby", probe_ashby)]


def discover(names: list[str]) -> None:
    s = make_session()
    print("Probing Greenhouse / Lever / Ashby …\n")
    snippets, misses = [], []

    for name in names:
        hit = None
        for slug in slug_variants(name):
            for ats, probe in PROBES:
                try:
                    if probe(s, slug):
                        hit = (ats, slug)
                        break
                except (requests.RequestException, ValueError):
                    continue
            if hit:
                break
            time.sleep(0.3)
        if hit:
            ats, slug = hit
            print(f"  ✓ {name:<28} → {ats} (slug: {slug})")
            snippets.append(f"  - name: {name}\n    ats: {ats}\n    slug: {slug}")
        else:
            print(f"  ✗ {name:<28} → no public board found")
            misses.append(name)

    print("\nProbing Workday tenants …\n")
    for name, (tenant, host, sites) in WORKDAY_CANDIDATES.items():
        found = False
        for site in sites:
            total = probe_workday(s, tenant, host, site)
            if total is not None:
                print(f"  ✓ {name:<28} → workday ({tenant}.{host} / {site}, {total} jobs)")
                snippets.append(
                    f"  - name: {name}\n    ats: workday\n    tenant: {tenant}\n"
                    f"    host: {host}\n    site: {site}"
                )
                found = True
                break
            time.sleep(0.3)
        if not found:
            print(f"  ✗ {name:<28} → tenant/site candidates failed (see README to find them)")
            misses.append(name)

    if snippets:
        print("\n" + "─" * 60)
        print("Paste into config.yaml under `companies:`\n")
        print("\n".join(snippets))
    if misses:
        print("\nNot found (likely custom ATS — cover via LinkedIn searches):")
        print("  " + ", ".join(misses))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("names", nargs="*", help="Company names to probe (default: built-in list)")
    parser.add_argument("--slug", help="Probe one exact slug against all three ATSes")
    args = parser.parse_args()

    if args.slug:
        s = make_session()
        for ats, probe in PROBES:
            try:
                ok = probe(s, args.slug)
            except (requests.RequestException, ValueError):
                ok = False
            print(f"  {ats:<12} {'✓ FOUND' if ok else '✗'}")
        sys.exit(0)

    discover(args.names or TARGETS)
