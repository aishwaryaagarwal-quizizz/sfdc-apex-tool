# SFDC Apex Tool

A standalone web tool for Salesforce admins to manage, analyse, and debug Apex code and Flows — no technical setup required beyond a browser.

Built for **Quizizz RevOps** but works with any Salesforce org.

---

## What it does

### 📋 Inventory
- Fetches all custom Apex classes and triggers from your Salesforce org via the Tooling API
- Analyses each file: description, objects/fields affected, quality rating, governor limit risks, Flow replacement recommendation, business domain
- Detects what changed since the last run — only re-analyses new and modified files
- Syncs results to a Google Sheet automatically

### 🔍 Debugger & Optimiser
- Paste any Apex class, trigger, or Flow XML
- Describe what it should do and any errors you're seeing
- Get a full diagnosis: bugs with severity ratings, exact fixes with code snippets, optimisation suggestions, testing notes, and Flow replacement assessment

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/sfdc-apex-tool.git
cd sfdc-apex-tool
npm install
npm start
```

Or deploy to GitHub Pages:

```bash
npm run build
# then push the build/ folder to your gh-pages branch
```

### 2. Configure in the app (Settings tab)

**Salesforce connection:**
- Instance URL: `https://yourorg.my.salesforce.com`
- Session token: get from Workbench → Info → Session Information → copy `SessionId`
- Tokens expire after a few hours — refresh when you get a 401 error

**Anthropic API key:**
- Get from [console.anthropic.com](https://console.anthropic.com) → API Keys
- Required for full AI analysis. Without it, local pattern-matching analysis is used instead.
- Stored in your browser's localStorage only — never sent anywhere except Anthropic's API directly

**Google Sheets:**
- Sheet ID: the long string in your Sheet's URL
- API key: Google Cloud Console → Sheets API → Credentials
- The Sheet must be shared or your API key must have write access

---

## How the Salesforce connection works

The tool uses the **Tooling API** — the same API Workbench uses. It fetches only your custom code:

```
SELECT Id, Name, Body, LastModifiedDate FROM ApexClass WHERE NamespacePrefix = null
SELECT Id, Name, Body, LastModifiedDate FROM ApexTrigger WHERE NamespacePrefix = null
```

Managed package classes (2,477 in the Quizizz org) are excluded automatically — they have a `NamespacePrefix` and are not your code.

> **Note on CORS:** Salesforce restricts cross-origin requests from browsers. If the fetch fails, use the Python script alternative below.

---

## Python script alternative (no CORS issues)

If the browser fetch is blocked by CORS, run this from your Terminal:

```bash
pip install requests anthropic gspread oauth2client
python scripts/refresh_inventory.py
```

Edit `scripts/refresh_inventory.py` to set your credentials.

---

## Column reference (Google Sheet)

| Column | Description |
|---|---|
| Name | Class or trigger name |
| Type | ApexClass or ApexTrigger |
| Is Test Class | Yes/No |
| Domain | Sales, Finance, Customer Success, etc. |
| Description | Plain English summary |
| Objects Affected | Salesforce objects referenced |
| Key Fields | Fields referenced |
| Quality Rating | Good / Needs Work / Poor |
| Quality Score | 1–10 |
| Quality Issues | Specific problems found |
| Strengths | Good practices observed |
| Governor Risk | YES or No |
| Governor Issues | Specific limit risks |
| Can Be Flow? | Yes / Probably / Unlikely / No |
| Flow Notes | Why or why not |
| Lines of Code | Raw line count |
| Last Modified | Date from Salesforce |
| Change Status | New / Changed / Unchanged |
| Last Analysed | Date this tool ran |

---

## Project structure

```
src/
  pages/
    InventoryPage.js   — inventory refresh UI and logic
    DebuggerPage.js    — code analysis and debugging UI
    SettingsPage.js    — configuration UI
  components/
    UI.js              — shared components (cards, buttons, badges etc.)
  utils/
    api.js             — Salesforce, Claude, and Google Sheets API calls
  App.js               — routing and layout
scripts/
  refresh_inventory.py — Python CLI alternative for scheduled runs
```

---

## Deployment to GitHub Pages

1. In `package.json`, set `"homepage": "https://your-org.github.io/sfdc-apex-tool"`
2. Install gh-pages: `npm install --save-dev gh-pages`
3. Add to scripts: `"deploy": "gh-pages -d build"`
4. Run: `npm run build && npm run deploy`

---

## Credentials security

All credentials (Salesforce token, Anthropic key, Google API key) are stored in your browser's `localStorage` only. Nothing is stored on any server. The tool makes API calls directly from your browser to Salesforce, Anthropic, and Google — there is no backend.

---

## Contributing

Built with React. No backend required. PRs welcome.
