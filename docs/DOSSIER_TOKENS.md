# GKIN — "Dossier" design tokens (source of truth)

The approved visual reference is **`docs/redesign-dossier.html`** — match its look exactly.
This file is the canonical token list. Both the landing (`landing-src/`) and the analyzer
(`landing/src/Analyzer.tsx`) must use these.

## Palette (light case-file / analytical briefing)
| Token | Hex | Use |
|---|---|---|
| paper | `#F2ECDD` | page background |
| paper-2 | `#EAE2CE` | recessed wells, table-head fills, metadata cells |
| ink | `#1A1714` | primary text, heavy rules (1.5px) |
| ink-soft | `#403A33` | secondary text, captions |
| navy | `#1C2E4A` | nav strip, document-header accents, section numbers, rule accents, primary buttons |
| navy-soft | `#3A4D6E` | hover/secondary navy |
| rule-soft | `#B9AE93` | hairline rules on paper |
| **supported** | `#15633A` | verdict: SUPPORTED (semantic only) |
| **contradicted** | `#9B1C2E` | verdict: CONTRADICTED / "likely misleading" (semantic only) |
| **insufficient** | `#5B6472` | verdict: INSUFFICIENT (semantic only) |

**Color rule:** the three verdict colors are the ONLY non-neutral colors, and they appear
ONLY to carry verdict meaning. Everything else is paper / ink / navy.

## Typography
- **Headings / wordmark / section titles:** `Zilla Slab` (400/500/600/700) — the "slab".
- **Body:** `Source Serif 4` (opsz 8..60; 400/600).
- **Fielded metadata, labels, nav, numbers, tiers, dates:** `IBM Plex Mono` (400/500/600) — the signature.
- Google Fonts link (put in each `<head>`):
```
<link href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

## The GKIN nameplate (REQUIRED — teammate-mandated)
A **centered** masthead nameplate:
- "GKIN" in Zilla Slab 700, centered, `letter-spacing:.16em; text-indent:.16em` (keeps tracking optically centered), large (~48–56px desktop, ~40px mobile).
- A centered descriptor under a short hairline rule, in IBM Plex Mono, uppercase, `letter-spacing:.22em` (e.g. "Ground Knowledge · Media-Forensics Bureau").
- Above it, a centered navy utility nav strip (mono uppercase links) on the landing.

## Editorial devices (these are what make it NOT look AI — use them)
- Square corners only. **Hairline rules instead of shadows / floating cards.** No `box-shadow`, no `border-radius` beyond ~2px.
- Fielded document-header block (REF / DATE / SUBJECT / PREPARED FOR / ASSESSMENT) in mono.
- Decimal section numbering (1.0 Verdict, 2.0 Evidence, 3.0 Appendix/Details).
- Evidence as numbered FINDINGS in a ruled table: ASSESSMENT · grounded EVIDENCE sentence · SOURCE TIER.
- Calm ruled gauge for the manipulation index (a bordered track with a solid fill + tick marks) — NOT a glowing meter.
- Progressive disclosure (`<details>/<summary>`) for Layer-3 detail.
- Square verdict markers (filled = supported/contradicted, hollow = insufficient) — NOT rounded colored pills.

## HARD BANS (the AI tells the team rejected)
- No blue / indigo / violet / purple. No gradients (incl. gradient text). No background mesh or glow.
- No rounded floating cards with soft drop shadows. No colored rounded "pill" badges as the primary verdict device. No emoji / emoji-glyph icons.
- No ambient/decorative animation: no scan-lines, blinking "live" dots, pulse-slides, slow-spins. Respect `@media (prefers-reduced-motion: reduce)`.
- No sci-fi / hacker / spy copy: replace "AUTHENTICATE", "REGISTER AGENT", "Truth Navigator", "neural", "SCAN" with plain language ("Sign in", "Create account", "Analyze", "Evidence", "History").

## Quality bars
WCAG-AA contrast (≥4.5:1 body). `cursor:pointer` on clickables. Visible focus states. Responsive to 375px.
