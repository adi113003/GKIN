# GKIN Truth Navigator — New Features (Weekly Report)

## Overview

Two major feature additions landed this week on top of the existing text-analysis pipeline.

---

## 1. Audio / Video / Screenshot Analysis
**Commit:** `502d5fd` — April 15, 2026  
**Author:** Adithya Asokan

### What was added

#### Audio & Video Transcription
- New tab in the UI: **Audio / Video**
- Users can drag-and-drop or browse for a media file (MP3, WAV, MP4, M4A, WEBM, OGG — up to 25 MB)
- Backend endpoint `POST /transcribe` uses **Groq Whisper large-v3** to transcribe the file to text
- The transcript is automatically fed into the full analysis pipeline — no extra steps for the user

#### Screenshot / Image Analysis
- New tab in the UI: **Screenshot**
- Users can upload a PNG, JPG, or WEBP image of a news article (up to 3 MB)
- Backend endpoint `POST /analyze-image` uses **Llama 3.2 Vision (90B)** to OCR all visible text from the image
- Extracted text is passed directly into the same analysis pipeline

### Why it matters
Users can now analyze news from any format — not just copy-pasted text. A screenshot of a tweet, a podcast clip, or a video news segment can all be fact-checked with one upload.

---

## 2. URL Input & Analysis
**Commit:** `8a54eb0` — April 20, 2026  
**Author:** Nghiem Pham

### What was added

#### Backend — `POST /fetch-url`
- New endpoint that accepts a URL and uses **Trafilatura** to fetch and extract clean article text
- Strips ads, navigation, and boilerplate — returns only article body + title
- Capped at 3,000 words to stay within LLM context limits
- Runs extraction in an async thread pool so the server stays non-blocking

#### Frontend — URL tab
- New **URL** tab added to the input card (between "Paste text" and "Audio / Video")
- User pastes any news URL and clicks **Analyze URL** (or presses Enter)
- After fetching, a status card appears in the same tab showing:
  - Extracted article title (or hostname if title is unavailable)
  - Word count (e.g. "1,842 words extracted")
  - A collapsible **View extracted text** toggle for inspection
- The user stays on the URL tab throughout — no jarring tab switches
- The full analysis pipeline runs silently and results appear below as usual

### Why it matters
Removes the friction of copy-pasting. Users can paste a URL directly from their browser and get a full manipulation analysis in seconds.

---

## Tech Stack Changes

| Component | Before | After |
|-----------|--------|-------|
| Input formats | Plain text only | Text · URL · Audio/Video · Screenshot |
| New backend endpoints | — | `POST /fetch-url`, `POST /transcribe`, `POST /analyze-image` |
| New dependencies | — | `trafilatura`, `python-multipart` (already used) |
| New models | — | Whisper large-v3 (audio), Llama 3.2 Vision 90B (image) |

---

## How to Run (Updated Setup)

```bash
pip install fastapi uvicorn groq pandas python-multipart duckduckgo-search trafilatura
export GROQ_API_KEY="your_key"
python server.py
```
