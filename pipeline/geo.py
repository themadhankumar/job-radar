"""Country tagging for job locations — 'US', 'intl', or '' (unknown).

Pure regex/lookup; runs on every job that hasn't been tagged. Philosophy:
be confident before saying 'intl' (the US-only filter hides those), and let
ambiguous locations ("Remote", "") stay unknown so they're never hidden.
"""
from __future__ import annotations

import re

US_STATES = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
    "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
    "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
}
US_STATE_NAMES = {
    "alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware",
    "florida","georgia","hawaii","idaho","illinois","indiana","iowa","kansas","kentucky",
    "louisiana","maine","maryland","massachusetts","michigan","minnesota","mississippi",
    "missouri","montana","nebraska","nevada","new hampshire","new jersey","new mexico",
    "new york","north carolina","north dakota","ohio","oklahoma","oregon","pennsylvania",
    "rhode island","south carolina","south dakota","tennessee","texas","utah","vermont",
    "virginia","washington","west virginia","wisconsin","wyoming",
}
US_CITIES = {
    "new york city","nyc","san francisco","sf bay area","bay area","los angeles","seattle",
    "austin","chicago","boston","denver","atlanta","miami","dallas","houston","san diego",
    "san jose","portland","philadelphia","phoenix","minneapolis","detroit","nashville",
    "charlotte","raleigh","durham","salt lake city","pittsburgh","baltimore","washington dc",
    "menlo park","palo alto","mountain view","sunnyvale","cupertino","redmond","bellevue",
    "brooklyn","cambridge","boulder","irvine","santa monica","san mateo","oakland","sf",
}
US_PATTERNS = re.compile(
    r"\b(?:united states|u\.s\.a?\.?|usa|us[- ]?remote|remote[-–— ]+us(?:a)?\b|us only|"
    r"north america(?:s)?(?: - us)?)\b",
    re.I,
)
INTL_COUNTRIES = {
    "canada","united kingdom","uk","england","scotland","ireland","germany","france","spain",
    "portugal","italy","netherlands","belgium","sweden","norway","denmark","finland","poland",
    "czech","czechia","austria","switzerland","romania","hungary","greece","ukraine","estonia",
    "latvia","lithuania","india","china","japan","korea","south korea","singapore","hong kong",
    "taiwan","vietnam","thailand","philippines","indonesia","malaysia","australia",
    "new zealand","brazil","argentina","chile","colombia","peru","mexico","costa rica",
    "israel","turkey","uae","united arab emirates","saudi arabia","egypt","nigeria","kenya",
    "south africa","pakistan","bangladesh","sri lanka","nepal","serbia","croatia","bulgaria",
    "slovakia","slovenia",
}
INTL_CITIES = {
    "london","toronto","vancouver","montreal","ottawa","calgary","berlin","munich","hamburg",
    "paris","madrid","barcelona","lisbon","milan","rome","amsterdam","rotterdam","brussels",
    "stockholm","oslo","copenhagen","helsinki","warsaw","krakow","prague","vienna","zurich",
    "geneva","dublin","edinburgh","manchester","bengaluru","bangalore","hyderabad","mumbai",
    "pune","chennai","delhi","new delhi","gurgaon","gurugram","noida","kolkata","tokyo",
    "osaka","seoul","beijing","shanghai","shenzhen","taipei","sydney","melbourne","brisbane",
    "auckland","tel aviv","dubai","abu dhabi","sao paulo","mexico city","bogota","buenos aires",
    "santiago","lima","cairo","lagos","nairobi","istanbul","karachi","lahore","dhaka","manila",
    "jakarta","kuala lumpur","bangkok","ho chi minh","hanoi","emea","apac",
}


def classify_country(location: str) -> str:
    if not location or not location.strip():
        return ""
    loc = location.strip()
    low = loc.lower()

    # 1. explicit US signals (patterns, state names, city names)
    if US_PATTERNS.search(loc) or \
       any(re.search(r"\b" + re.escape(s) + r"\b", low) for s in US_STATE_NAMES) or \
       any(re.search(r"\b" + re.escape(c) + r"\b", low) for c in US_CITIES):
        return "US"

    # 2. explicit intl signals — beats ambiguous 2-letter codes ("Pune, IN")
    if any(re.search(r"\b" + re.escape(c) + r"\b", low) for c in INTL_COUNTRIES) or \
       any(re.search(r"\b" + re.escape(c) + r"\b", low) for c in INTL_CITIES):
        return "intl"

    # 3. bare uppercase state codes ("Remote, IN", "OH - Columbus")
    for tok in re.findall(r"\b[A-Z]{2}\b", loc):
        if tok in US_STATES:
            return "US"
    return ""


def tag_countries(conn) -> int:
    """Tag every job whose country hasn't been decided. Returns rows updated."""
    rows = conn.execute(
        "SELECT id, location FROM jobs WHERE country = '' AND location <> ''"
    ).fetchall()
    n = 0
    for r in rows:
        c = classify_country(r["location"])
        if c:
            conn.execute("UPDATE jobs SET country = %s WHERE id = %s", (c, r["id"]))
            n += 1
    conn.commit()
    return n
