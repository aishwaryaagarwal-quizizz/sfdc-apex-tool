#!/usr/bin/env python3
"""
SFDC Apex Inventory Refresh — Python CLI
Run this from Terminal for scheduled or automated refreshes.
No CORS issues. Works as a cron job.

Install: pip install requests anthropic gspread oauth2client
Run:     python scripts/refresh_inventory.py
"""

import requests
import json
import re
import time
import csv
import os
from datetime import datetime

# ── CONFIG — edit these ────────────────────────────────────────────────
SF_INSTANCE   = "https://quizizz.my.salesforce.com"
SF_TOKEN      = "your_session_token_here"          # from Workbench → Info → Session Information
SF_VERSION    = "v66.0"
ANTHROPIC_KEY = "your_anthropic_key_here"          # from console.anthropic.com
SHEET_ID      = "your_google_sheet_id_here"        # from Google Sheets URL
SHEET_TAB     = "Full Inventory"
GAPI_KEY      = "your_google_api_key_here"         # from Google Cloud Console
OUTPUT_CSV    = "apex_inventory.csv"               # local backup CSV
BATCH_PAUSE   = 0.3                                # seconds between Claude API calls

# ── FETCH FROM SALESFORCE ─────────────────────────────────────────────
def fetch_apex():
    headers = {
        "Authorization": f"Bearer {SF_TOKEN}",
        "Content-Type": "application/json",
    }
    base = f"{SF_INSTANCE}/services/data/{SF_VERSION}/tooling/query?q="

    def query(soql):
        resp = requests.get(base + soql, headers=headers)
        resp.raise_for_status()
        return resp.json().get("records", [])

    print("Fetching Apex classes...")
    classes = query(
        "SELECT+Id,Name,Body,LastModifiedDate,LastModifiedById+FROM+ApexClass+WHERE+NamespacePrefix+=+null+LIMIT+500"
    )
    print(f"  {len(classes)} custom classes found")

    print("Fetching Apex triggers...")
    triggers = query(
        "SELECT+Id,Name,Body,TableEnumOrId,LastModifiedDate+FROM+ApexTrigger+WHERE+NamespacePrefix+=+null+LIMIT+200"
    )
    print(f"  {len(triggers)} triggers found")

    return (
        [dict(**c, ftype="ApexClass")  for c in classes],
        [dict(**t, ftype="ApexTrigger") for t in triggers],
    )

# ── LOCAL ANALYSIS ────────────────────────────────────────────────────
def analyse_locally(name, ftype, body):
    b = body.lower()
    is_test = "@istest" in b or "_test" in name.lower() or name.lower().startswith("test_")

    obj_map = {
        "opportunity": "Opportunity", "account": "Account", "contact": "Contact",
        "lead": "Lead", "contract": "Contract", "invoice__c": "Invoice__c",
        "subscription__c": "Subscription__c", "task": "Task",
        "sbqq__quoteline__c": "SBQQ__QuoteLine__c", "product2": "Product2",
    }
    objects = [v for k, v in obj_map.items() if k in b]

    gov_risks = []
    if re.search(r"for\s*\([^)]+\)\s*\{[^{}]*\[select", body, re.IGNORECASE | re.DOTALL):
        gov_risks.append("SOQL inside for loop")
    if re.search(r"for\s*\([^)]+\)\s*\{[^{}]*(insert|update|delete|upsert)\s", body, re.IGNORECASE | re.DOTALL):
        gov_risks.append("DML inside for loop")

    issues = list(gov_risks)
    if "system.debug" in b: issues.append("Debug statements")
    if "@future" in b: issues.append("@future — consider Queueable")

    score = max(2, min(10, round(8 - len(issues) * 1.2)))
    rating = "Good" if score >= 7 else ("Needs Work" if score >= 4 else "Poor")

    domain = "General"
    if any(x in b for x in ["stripe", "invoice", "payment", "overdue"]): domain = "Finance"
    elif any(x in b for x in ["subscription", "renewal", "onboarding"]): domain = "Customer Success"
    elif "lead" in b: domain = "Marketing"
    elif "sbqq" in b or ("quote" in b and "quoteline" in b): domain = "Quotes/CPQ"
    elif "opportunity" in b: domain = "Sales"

    can_flow = "Unlikely"
    if is_test: can_flow = "N/A"
    elif any(x in b for x in ["callout", "httprequest", "stripe"]): can_flow = "No"
    elif "batch" in name.lower(): can_flow = "Unlikely"
    elif ftype == "ApexTrigger" and len(body) < 700 and not gov_risks: can_flow = "Yes"
    elif ftype == "ApexTrigger": can_flow = "Probably"

    return {
        "is_test": is_test,
        "domain": domain,
        "objects": ", ".join(objects) or "See code",
        "quality_rating": rating,
        "quality_score": score,
        "quality_issues": "; ".join(issues) or "None",
        "governor_risk": "YES" if gov_risks else "No",
        "governor_issues": "; ".join(gov_risks) or "None",
        "can_be_flow": can_flow,
        "description": f"{ftype} handling automation for {', '.join(objects[:2]) or 'Salesforce'} records.",
        "flow_reason": "",
        "recommendations": "",
    }

# ── CLAUDE AI ANALYSIS ────────────────────────────────────────────────
def analyse_with_claude(name, ftype, body):
    prompt = f"""Analyse this Salesforce Apex {ftype} named "{name}" and return ONLY valid JSON:
{{
  "description": "2-3 sentence plain English description",
  "domain": "one of: Sales, Marketing, Customer Success, Quotes/CPQ, Finance, Service, Operations, General",
  "objects": ["array of Salesforce objects"],
  "qualityRating": "Good, Needs Work, or Poor",
  "qualityScore": 1-10,
  "qualityIssues": ["array of issues or empty"],
  "canBeFlow": "Yes, Probably, Unlikely, or No",
  "flowReason": "one sentence",
  "hasGovernorRisk": true or false,
  "governorIssues": ["array of risks or empty"],
  "recommendations": ["array of improvements"]
}}

Code (first 2500 chars):
{body[:2500]}"""

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-6",
            "max_tokens": 1000,
            "messages": [{"role": "user", "content": prompt}],
        },
    )
    resp.raise_for_status()
    text = "".join(b.get("text", "") for b in resp.json().get("content", []))
    start, end = text.find("{"), text.rfind("}") + 1
    if start < 0 or end <= start:
        raise ValueError("No JSON in response")
    result = json.loads(text[start:end])

    objs = result.get("objects", [])
    gov_issues = result.get("governorIssues", [])
    q_issues = result.get("qualityIssues", [])
    recs = result.get("recommendations", [])

    return {
        "is_test": "@istest" in body.lower() or "_test" in name.lower(),
        "domain": result.get("domain", "General"),
        "objects": ", ".join(objs) if isinstance(objs, list) else str(objs),
        "quality_rating": result.get("qualityRating", ""),
        "quality_score": result.get("qualityScore", 0),
        "quality_issues": "; ".join(q_issues) if isinstance(q_issues, list) else str(q_issues),
        "governor_risk": "YES" if result.get("hasGovernorRisk") else "No",
        "governor_issues": "; ".join(gov_issues) if isinstance(gov_issues, list) else str(gov_issues),
        "can_be_flow": result.get("canBeFlow", ""),
        "description": result.get("description", ""),
        "flow_reason": result.get("flowReason", ""),
        "recommendations": "; ".join(recs) if isinstance(recs, list) else str(recs),
    }

# ── WRITE TO GOOGLE SHEETS ────────────────────────────────────────────
def write_to_sheets(rows):
    headers = [
        "Name", "Type", "Is Test Class", "Domain", "Description", "Objects Affected",
        "Quality Rating", "Quality Score", "Quality Issues", "Governor Risk",
        "Governor Issues", "Can Be Flow?", "Flow Notes", "Lines of Code",
        "Last Modified", "Change Status", "Last Analysed",
    ]
    values = [headers] + [[
        r["name"], r["ftype"], "Yes" if r.get("is_test") else "No", r.get("domain", ""),
        r.get("description", ""), r.get("objects", ""),
        r.get("quality_rating", ""), r.get("quality_score", ""), r.get("quality_issues", ""),
        r.get("governor_risk", ""), r.get("governor_issues", ""),
        r.get("can_be_flow", ""), r.get("flow_reason", ""),
        r.get("lines_of_code", ""), r.get("last_modified", ""),
        r.get("change_status", ""), datetime.now().strftime("%Y-%m-%d"),
    ] for r in rows]

    tab = SHEET_TAB.replace(" ", "%20")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{tab}!A1:Q{len(values)}?valueInputOption=RAW&key={GAPI_KEY}"
    resp = requests.put(url, json={"values": values, "majorDimension": "ROWS"})
    resp.raise_for_status()
    print(f"  ✓ Google Sheet updated — {len(rows)} rows written")

# ── WRITE CSV BACKUP ──────────────────────────────────────────────────
def write_csv(rows):
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys(), extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"  ✓ CSV backup saved to {OUTPUT_CSV}")

# ── TIMESTAMP CACHE ───────────────────────────────────────────────────
TS_FILE = ".apex_timestamps.json"

def load_timestamps():
    if os.path.exists(TS_FILE):
        with open(TS_FILE) as f:
            return json.load(f)
    return {}

def save_timestamps(ts):
    with open(TS_FILE, "w") as f:
        json.dump(ts, f, indent=2)

# ── MAIN ──────────────────────────────────────────────────────────────
def main():
    print("\n🔄  SFDC Apex Inventory Refresh")
    print("=" * 50)

    # 1. Fetch
    classes, triggers = fetch_apex()
    all_files = classes + triggers
    print(f"\n✓ Total: {len(all_files)} files ({len(classes)} classes + {len(triggers)} triggers)")

    # 2. Diff
    prev_ts = load_timestamps()
    new_count = changed_count = 0
    for f in all_files:
        prev = prev_ts.get(f["Name"])
        if not prev:
            f["change_status"] = "New"; new_count += 1
        elif prev != f.get("LastModifiedDate"):
            f["change_status"] = "Changed"; changed_count += 1
        else:
            f["change_status"] = "Unchanged"

    print(f"✓ {new_count} new · {changed_count} changed · {len(all_files)-new_count-changed_count} unchanged")

    # 3. Analyse
    print(f"\nAnalysing {len(all_files)} files...")
    results = []
    use_claude = bool(ANTHROPIC_KEY and ANTHROPIC_KEY != "your_anthropic_key_here")

    for i, f in enumerate(all_files):
        name = f["Name"]
        body = f.get("Body") or ""
        ftype = f["ftype"]
        status = f["change_status"]

        print(f"  [{i+1}/{len(all_files)}] {status[:1]} {name}", end=" ... ", flush=True)

        if use_claude and body:
            try:
                analysis = analyse_with_claude(name, ftype, body)
                print(f"{analysis['quality_rating']} · {analysis['domain']}")
            except Exception as e:
                print(f"(Claude failed: {e}) using local")
                analysis = analyse_locally(name, ftype, body)
        else:
            analysis = analyse_locally(name, ftype, body)
            print(f"{analysis['quality_rating']} · {analysis['domain']}")

        results.append({
            "name": name,
            "ftype": ftype,
            "lines_of_code": len(body.splitlines()),
            "last_modified": f.get("LastModifiedDate", "")[:10],
            "change_status": status,
            **analysis,
        })

        if use_claude and body:
            time.sleep(BATCH_PAUSE)

    # Save timestamps
    new_ts = {**prev_ts, **{f["Name"]: f.get("LastModifiedDate", "") for f in all_files}}
    save_timestamps(new_ts)

    # 4. Write outputs
    print(f"\nWriting outputs...")
    write_csv(results)

    if SHEET_ID and SHEET_ID != "your_google_sheet_id_here" and GAPI_KEY and GAPI_KEY != "your_google_api_key_here":
        try:
            write_to_sheets(results)
        except Exception as e:
            print(f"  ✗ Sheet write failed: {e}")
    else:
        print("  ℹ Skipping Sheet sync — configure SHEET_ID and GAPI_KEY to enable")

    # Summary
    good = sum(1 for r in results if r["quality_rating"] == "Good")
    risks = sum(1 for r in results if r["governor_risk"] == "YES")
    flows = sum(1 for r in results if r["can_be_flow"] in ["Yes", "Probably"])

    print(f"\n{'='*50}")
    print(f"✅  Done — {len(results)} files analysed")
    print(f"   Good quality:    {good}")
    print(f"   Governor risks:  {risks}")
    print(f"   Flow candidates: {flows}")
    print(f"   New files:       {new_count}")
    print(f"   Changed:         {changed_count}")

if __name__ == "__main__":
    main()
