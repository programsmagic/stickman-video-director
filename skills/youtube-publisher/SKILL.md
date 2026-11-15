---
name: youtube-publisher
description: Manages YouTube Data API v3 publishing packages, resumable video uploads, metadata sanitization (preventing angle-bracket errors), chapter timestamps, and optimal release scheduling.
---

# YouTube Publisher

## Objective
Coordinate video publishing, metadata generation, and scheduled release execution via the YouTube Data API v3.

## Publishing Checklist
1. **Metadata Kit Preparation**:
   - Save complete title options, description, timestamps, and academic citations in `publishing/metadata.md`.
2. **Angle-Bracket Description Guard**:
   - The YouTube Data API rejects descriptions containing `<` or `>` with an `invalidDescription` 400 error.
   - Always replace tags like `<think>` with `[think]` before calling the API.
3. **Resumable Multipart Upload**:
   - Use chunked `Content-Range` headers for resilient network transfer.
   - Attach thumbnail PNG and word-aligned SRT subtitle track during upload.
4. **Optimal Release Timing**:
   - Preferred global tech audience window: **Tuesday at 19:00 UTC (2:00 PM EST)**.
   - Premiere scheduling requires human confirmation. Never publish unattended.
