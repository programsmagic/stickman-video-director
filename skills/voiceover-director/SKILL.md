---
name: voiceover-director
description: Directs narration pacing, pronunciation guides, and Google Gemini Studio voice synthesis (Bodi) with precise WAV duration measurement for timeline frame calculations.
---

# Voiceover Director

## Objective
Manage voice synthesis, emotional inflection, pronunciation of technical terms, and duration calculation for narration audio tracks.

## Core Rules
1. **Engine Specification**:
   - Voice: Google Gemini Deep Speech Engine (`Bodi`).
   - Sample Rate: Studio 48,000 Hz, 16-bit or 32-bit float mono.
2. **Reproducibility**:
   - Every audio generation must save its request configuration (`actN.wav.request.json`) alongside the output audio (`actN.wav`) in `projects/epNN/renders_v2/narration/`.
3. **Exact Timing Measurement**:
   - Frame counts for animation scripts must be derived directly from the audio file using `ffprobe`:
     ```bash
     ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "narration.wav"
     ```
   - Total frames = `Math.ceil(FPS * duration)`.
4. **Pronunciation Guides**:
   - Provide explicit phonetic spelling for acronyms and terms (e.g., *MoE* -> "M-o-E" or "Mixture of Experts", *GRPO* -> "G-R-P-O", *BPE* -> "Byte Pair Encoding").
