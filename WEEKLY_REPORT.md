# GKIN Weekly Report — Claude Instructions

You are helping write a weekly progress report for **GKIN (Truth Navigator)**, a media-literacy and fake-news detection platform built as a CS343 project.

When asked to write the weekly report, produce a clean, professional document in the format below. Ask the team member for the date range and any specific accomplishments before writing if they are not provided.

---

## Project Overview (for context)

**GKIN — Truth Navigator** is a full-stack web application that analyzes articles, YouTube videos, screenshots, and audio for misinformation, manipulation tactics, and factual accuracy.

### Two Detection Systems Running in Parallel
| System | What it does |
|---|---|
| LLM Pipeline (Groq) | Chain-of-thought reasoning, claim verification, persuasion technique identification, emotional framing analysis |
| Classical ML Classifier | TF-IDF + Logistic Regression + DistilBERT trained on WELFake (72,073 articles) — binary real/fake label |

### Tech Stack
- **Backend:** Python, FastAPI, Groq API (Llama 3.3 70B, DeepSeek R1, Whisper)
- **Frontend:** React, Vite, Framer Motion, TypeScript
- **Database:** MongoDB (Motor async driver)
- **Auth:** JWT (python-jose, passlib/bcrypt)
- **ML:** scikit-learn, DistilBERT (HuggingFace), WELFake dataset
- **Hosting/Dev:** macOS + remote GPU box (96GB VRAM) for training

### Current Features (as of May 2026)
- Article text, URL, and YouTube video ingestion
- Auto-detection and translation of non-English content (47 languages)
- Manipulation index score (0–100) with animated gauge
- Emotional framing analysis (fear, anger, disgust, hope, guilt, ingroup framing)
- Persuasion technique identification with exact quotes from the article
- Claim-by-claim fact verification against live web search
- Missing context detection
- AI/human authorship detection
- Fake vs. real classification (ML model + LLM combined score with red flags and trust signals)
- Streaming AI chat assistant (Article Only / Web Research / Conspiracy modes)
- Auto-generated suggested questions after each scan
- Multi-article narrative comparison (up to 4 articles)
- Narrative forensics timeline
- User authentication (register / login / JWT)
- Recent investigations saved locally with one-click reload
- Purple/dark UI matching landing page aesthetic
- Separate landing page (`/`) and analyzer workspace (`/app`)

### Repository
GitHub: `https://github.com/adi113003/GKIN`  
Branch: `main`

### ML Model Results
| Variant | Accuracy |
|---|---|
| DistilBERT (source-stripped, full text) | 99.4% |
| Shuffled words (word-order ablation) | 56.2% |
| First 5 words only | 62.3% |
| First 25 words only | 94.1% |
| TF-IDF baseline | 97.1% |

The shuffle drop (99% → 56%) confirms the model uses word order / syntax, not just keywords. The 94% first-25-words score shows publisher lede style still contributes. The model is reading, but what it learned is "wire-service style vs. amateur-blog style" — honest framing for any paper.

---

## Weekly Report Template

Use this exact format when writing the report:

---

# GKIN — Weekly Progress Report
**Week of:** [DATE RANGE]  
**Prepared by:** [NAME]  
**Project:** GKIN Truth Navigator (CS343)

---

## Summary
[2–3 sentence high-level overview of the week — what was the focus, what shipped, where things stand.]

---

## Completed This Week

### Features Shipped
- [each feature with one sentence on what it does and why it matters]

### Bugs Fixed
- [each bug — what broke, what the root cause was, how it was fixed]

### Infrastructure / Build
- [deployment changes, repo updates, CI, static asset pipeline]

### ML / Research
- [training runs, dataset work, ablation experiments, findings]

---

## In Progress
- [work started but not yet merged/deployed — current status and ETA]

---

## Blockers
- [anything slowing progress, what is needed to unblock]

---

## Next Week
- [concrete planned tasks, in priority order]

---

## Notes for Team Lead
[Decisions that need sign-off, design questions, risks, or anything the lead should know.]

---

## How to Use This File

1. Open a new Claude conversation at **claude.ai** (no install needed)
2. Click the paperclip / attachment icon and upload this file, **or** paste its contents into the chat
3. Type something like:

   > *"Write this week's GKIN progress report. The dates are May 5–11. Here's what we did: [paste your rough notes or bullet points]."*

4. Claude will produce a complete, formatted report using the template above.

**Optional follow-up prompts:**
- "Make it more formal / more concise"
- "Add an executive summary paragraph at the top"
- "Add a risks and mitigations section"
- "Translate it into [language]"
- "Shorten to one page"
