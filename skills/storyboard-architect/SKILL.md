---
name: storyboard-architect
description: Converts approved video scripts into production-ready scene beats and versioned scene JSON (schema 1.0) with physical metaphors, character poses, IK targets, camera framing, and frame-aligned Foley cues.
---

# Storyboard Architect

## Objective
Transform an approved video script and narration timestamps into a renderable, structured storyboard using the canonical **Programs Magic Scene JSON Schema (1.0)**.

## Core Rules
1. **Physical Metaphor First**: Every complex idea must have a tangible, physical counterpart (e.g., embeddings = supermarket aisles; attention = cocktail party flashlight).
2. **One Idea Per Scene**: If multiple new technical terms appear, sequence them across separate visual beats.
3. **Character Purpose**: Magi must actively manipulate props, point, or react—never stand statically.
4. **Frame-Aligned Foley**: Every physical contact or reveal must have an exact millisecond/frame audio timestamp.

## Inputs
- Approved episode script and narration audio (`actN.wav`)
- Total duration derived via `ffprobe`
- Target resolution (1280x720 or 1920x1080) and frame rate (30 fps)
- Mascot pose library (`MAGI_POSES` from `projects/tools/stickman.mjs`)

## Output Schema (`schemaVersion: "1.0"`)
```json
{
  "schemaVersion": "1.0",
  "episodeId": "ep02-how-ai-actually-works",
  "sceneId": "act1-scene01-zoo-marquee",
  "title": "The Modern AI Zoo",
  "renderer": "canvas",
  "duration": 36.0,
  "fps": 30,
  "resolution": { "width": 1280, "height": 720 },
  "narration": { "asset": "narration/act1.wav", "start": 0.0, "end": 35.8 },
  "camera": { "shot": "wide", "movement": "static" },
  "visual": {
    "metaphor": "Carnival neon marquee with orbiting tech billboards",
    "background": "#0F172A",
    "characters": [{ "id": "magi", "pose": "explain", "x": 640, "y": 500 }],
    "props": ["marquee-lights", "orbiting-billboards"]
  },
  "beats": [
    { "at": 0.0, "action": "establish", "description": "Neon marquee sign flickers on with ambient hum" },
    { "at": 2.0, "action": "billboards_pop", "description": "ChatGPT, Gemini, Claude billboards drop into orbit" },
    { "at": 34.0, "action": "magi_wrench_hit", "description": "Magi strikes server rack with giant wrench (CLANG)" }
  ],
  "audio": [
    { "type": "sfx", "asset": "neon_hum", "at": 0.0, "gain": 0.25 },
    { "type": "sfx", "asset": "wrench_clang", "at": 34.0, "gain": 0.65 }
  ],
  "transitionOut": { "type": "whoosh_cut", "duration": 0.4 }
}
```

## Validation
Always run the schema validator before handing off to render scripts:
```bash
node projects/tools/scene_validator.mjs <storyboard.json>
```
