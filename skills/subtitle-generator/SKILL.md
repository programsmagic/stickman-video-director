---
name: subtitle-generator
description: Generates, formats, and validates word-aligned SubRip (.srt) caption files with millisecond accuracy, phrase chunking, and automated punctuation guards.
---

# Subtitle Generator

## Objective
Produce accessible, clean, perfectly timed English subtitle files (`.en.srt`) matching the spoken narration across all acts of an episode.

## Quality Standards
1. **Phrase Chunking**:
   - Each cue should display 3 to 7 words (1 to 2 lines max).
   - Never display a single comma or pure punctuation symbol on its own line.
2. **Punctuation Safeguards**:
   - Filter out orphan commas, quotes, and punctuation artifacts that can occur during regex tokenization.
3. **Timing Precision**:
   - Timestamps formatted as `HH:MM:SS,mmm --> HH:MM:SS,mmm`.
   - Cues must not overlap or extend past the video's total duration.
4. **Validation**:
   - Verify cue count (e.g., EP02 has 219 precision cues across 11m 39s).
