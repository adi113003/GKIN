# GKIN Truth Navigator — Weekly Report
**Date:** April 20, 2026

---

## Features Added This Week

### 1. Save & Export Analyses
Users can now persist and share their fact-checking results in three ways:

**Save to Library**
- Analyses are saved to browser `localStorage` with a cap of 20 entries
- A new **Library** tab in the input card lists all saved analyses as cards showing manipulation index (colour-coded), narrative cluster, article snippet, and date
- Each saved item can be loaded back (restoring the full analysis + article text) or deleted
- The Library tab label updates dynamically to show the count (e.g. `Library (3)`)

**Download JSON**
- One-click download of the full structured analysis as a `.json` file (`gkin-analysis-YYYY-MM-DD.json`)
- Includes all fields: claims, persuasion techniques, emotion scores, verification verdicts, reasoning trace, narrative cluster, and manipulation index

**Export PDF**
- Opens a clean, self-contained print window with a formatted analysis report
- Report includes: verdict + manipulation score, persuasion techniques with quoted spans, missing context, emotional framing breakdown, and all claims with fact-check verdicts
- User saves to PDF via the browser's native print dialog

---

### 2. URL Article Input (merged from `dev`)
- New **URL** tab alongside Paste Text / Audio / Screenshot / Compare
- Users can paste any article URL and fetch its text directly without copy-pasting
- Fetched article displays title, word count, and a preview textarea before analysis

---

## Branch & Merge Work
- Pulled latest changes from `origin/dev` into `main` (fast-forward, no conflicts)
- Migrated all work from `main` to personal `adithya` branch
- `adithya` is now 8 commits ahead of `origin/adithya` and ready to push

---

## Files Modified
| File | Changes |
|------|---------|
| `static/index.html` | Added Library tab, export bar, Save/JSON/PDF logic, merged URL tab from dev |
