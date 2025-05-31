#!/usr/bin/env python3
"""
home_assistant_prs.py
---------------------
Fetch pull-request metadata from github.com/home-assistant/core
"""

import csv
import os
import time
import requests

OWNER = "home-assistant"
REPO = "core"
START_PR = 144309
END_PR = 145919
#END_PR   = 144308           # inclusive
OUTFILE  = f"home_assistant_prs_{START_PR}_{END_PR}.csv"

FIELDS = [
    "number",
    "state",
    "created_at",
    "closed_at",
    "merged_at",
    "labels",
    "author_login",
]

GH_API = "https://api.github.com"
HEADERS = {"Authorization": ""}


def fetch_pr(pr_number: int) -> dict | None:
    print(f"Fetching PR #{pr_number}…")
    """Return raw PR JSON for a single pull request (None if 404)."""
    url = f"{GH_API}/repos/{OWNER}/{REPO}/pulls/{pr_number}"
    print(url)
    r = requests.get(url, headers=HEADERS)
    print(r.status_code)

    if r.status_code == 404:
        return None          # PR number not used yet
    r.raise_for_status()
    #print content


    return r.json()


def extract_fields(raw: dict) -> dict:
    """Pick out the required attributes in flat form."""
    # labels → semicolon-separated string of label names
    label_names = ";".join(l["name"] for l in raw.get("labels", []))
    return {
        "number":       raw["number"],
        "state":        raw["state"],
        "created_at":   raw["created_at"],
        "closed_at":    raw.get("closed_at"),
        "merged_at":    raw.get("merged_at"),
        "labels":       label_names,
        "author_login": raw["user"]["login"],
    }


def main() -> None:
    rows = []
    for num in range(START_PR, END_PR + 1):
        try:
            pr = fetch_pr(num)
            if pr:
                rows.append(extract_fields(pr))
            else:
                print(f"#{num}: 404 (skipped)")
        except requests.HTTPError as e:
            # 403 → rate-limit; 5xx → transient
            print(f"#{num}: {e}.  잠시 대기 후 재시도…")
            time.sleep(15)
            continue        # 다시 loop 진입

        # GitHub API 5 k requests/hour → 살짝 여유
        time.sleep(0.2)     # ~300 req/min == 18 k/hr (token 기준 OK)

    # --- save --------------------------------------------------------
    with open(OUTFILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"✅  Saved {len(rows):,} rows → {OUTFILE}")


if __name__ == "__main__":
    main()