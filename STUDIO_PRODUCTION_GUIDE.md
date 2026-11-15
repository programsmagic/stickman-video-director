# Programs Magic — AI Video Studio: Complete Production Guide

> **Purpose:** A complete technical and creative reference for the `video-generator-stickman` AI explainer studio. Covers how videos are planned, scripted, animated, rendered, and published — including every tool, skill, script, and rule currently in the repo. Hand this document to any developer or expert who needs to understand, audit, or improve the system.
>
> **Last Updated:** November 15, 2026
> **Channel:** `programs magic` (`UCLCtQnqfU9AAOc8AwgFXXIA`) — 1,920 subscribers
> **Mascot:** **Magi** (wizard hat, curious wide gaze, iconic yellow scarf)

---

## Table of Contents

1. [Studio Philosophy & Non-Negotiable Rules](#1-studio-philosophy--non-negotiable-rules)
2. [Visual Style Standards](#2-visual-style-standards)
3. [Complete Pipeline — End to End](#3-complete-pipeline--end-to-end)
4. [Repository Architecture](#4-repository-architecture)
5. [Core Animation Engine — How Videos Are Built](#5-core-animation-engine--how-videos-are-built)
   - 5.1 [The Render Script Pattern](#51-the-render-script-pattern)
   - 5.2 [Stickman Character System (IK + Spring Physics)](#52-stickman-character-system-ik--spring-physics)
   - 5.3 [Canvas Rendering (@napi-rs/canvas)](#53-canvas-rendering-napi-rscanvas)
   - 5.4 [Procedural Foley Audio](#54-procedural-foley-audio)
   - 5.5 [FFmpeg Assembly](#55-ffmpeg-assembly)
6. [Installed Skills — All 21](#6-installed-skills--all-21)
7. [Production Tools (projects/tools/)](#7-production-tools-projectstools)
8. [Episode Production Workflow (Step by Step)](#8-episode-production-workflow-step-by-step)
9. [Episode Catalog & Status](#9-episode-catalog--status)
10. [YouTube Publishing Pipeline](#10-youtube-publishing-pipeline)
11. [Quality Control System](#11-quality-control-system)
12. [Visual Analogy Library](#12-visual-analogy-library)
13. [Known Issues, Bugs & Fixes](#13-known-issues-bugs--fixes)
14. [Improvement Roadmap](#14-improvement-roadmap)

---

## 1. Studio Philosophy & Non-Negotiable Rules

These rules are enforced across **all agents and all scripts**. Breaking any of them produces unusable output.

### 1.1 Core Creative Rules

| # | Rule | Rationale |
|---|---|---|
| **R1** | **No slide decks, no bullet lists, no static text slides** | Static content loses viewers instantly. Every concept must be embodied as a physical analogy or interactive environment. |
| **R2** | **Character-first animation** | Magi must hold props, press buttons, look through lenses, and run across stages. If a character isn't doing something physical, it's wrong. |
| **R3** | **Every concept = a physical metaphor** | The 12,288-D supermarket for embeddings. The cocktail party flashlight for attention. The 64-chef kitchen for MoE. Never explain with text alone. |
| **R4** | **Manim-inspired mathematical structures** | 3D perspective grids, dynamic coordinate vectors, glowing attention heatmaps, and state machine loops for all data/math. |
| **R5** | **Procedural frame-aligned Foley** | Every physical action (typewriter keypress, buzzer beep, chalkboard tap, lightning strike) must have an exact PCM audio cue at the right frame. |
| **R6** | **No emoji or Unicode math in canvas** | `@napi-rs/canvas` with standard fonts cannot render `★`, `🍎`, `❌`, `➔`, `√`. Use geometric shapes or ASCII equivalents only. |
| **R7** | **Never publish automatically** | All publishing steps require a human approval step. The upload script prepares, the human confirms. |
| **R8** | **FFmpeg concat paths in single quotes** | In concat `.txt` list files, wrap paths as `file '/absolute/path/video.mp4'` to prevent path mangling. |

### 1.2 Technical Rules

- **IK function name**: `solve2BoneIK()` — not `solveIK2Bone` (this was a past bug)
- **IK coordinates**: arrays `[x, y]` — not objects `{x, y}`
- **Canvas fonts**: Only `CaveatHand` and `NotoSans` are registered; never use system emoji fonts
- **No secrets in Git**: `.env`, `token.json`, `client_secret*.json` are all gitignored
- **No model weights in Git**: Store on separate SSD; reference by path in scripts
- **Start small**: Always test a 10–15 second proof of concept before full-length renders

---

## 2. Visual Style Standards

### 2.1 Output Specification

| Property | Value |
|---|---|
| **Resolution** | 1280×720 (working), target 1920×1080 for future seasons |
| **Frame Rate** | 30 fps (constant) |
| **Audio** | 48 kHz stereo, PCM WAV intermediate, AAC in final MP4 |
| **Codec** | H.264 video, AAC audio |
| **Shorts** | 1080×1920 (9:16 vertical) |

### 2.2 HUD Layout (every frame)

```
+-----------------------------------------------------+
|  [Episode Title — CaveatHand 18-20px @ y=34]        |  <- Top banner
|  [Scene Action Label — NotoSans 20px @ y=74]        |  <- Action banner
|                                                      |
|              [MAIN ANIMATION CONTENT]                |
|                                                      |
+-----------------------------------------------------+
```

### 2.3 Color Palette

```javascript
const COLORS = {
  scarf:  '#E8B32A',   // Magi's signature yellow scarf
  red:    '#EC4338',
  green:  '#4CAF6A',
  blue:   '#3D7DD8',
  paper:  '#FFF4C7',
  glass:  '#E6F0F4',
  skin:   '#FFFFFF',
  navy:   '#2B3A55',
  brown:  '#9B6B43',
  gray:   '#B9BEC4',
  purple: '#6B4BD8',
};
const INK = '#1d1d1b';  // All strokes & outlines
```

### 2.4 Typography

| Font | Alias | Use |
|---|---|---|
| `Caveat.ttf` | `CaveatHand` | Episode title HUD, dialogue callouts, hand-written labels |
| `NotoSans.ttf` | `NotoSans` | Action banners, equation labels, structured on-screen text |

### 2.5 Narration

- **Voice Engine**: Google Gemini Studio (Bodi) — 48 kHz, warm neutral-male
- **Script Timing**: Narration WAV drives scene duration; `ffprobe` reads duration to compute `TOTAL_FRAMES`
- **TTS Request Format**: JSON request files stored alongside WAV in `renders_v2/narration/`

---

## 3. Complete Pipeline — End to End

```
RESEARCH & TOPIC SELECTION
        |
        v
SCRIPT WRITING & NARRATION DRAFT
        |  (approve before proceeding)
        v
STORYBOARD — SCENES MAPPED TO NARRATION TIMESTAMPS
        |
        v
TTS NARRATION GENERATION (Gemini Bodi)
        |
        v
PER-ACT RENDER SCRIPTS (render_actN_*.mjs)
  +-- Canvas frame generation (node-canvas)
  +-- 2-Bone IK character posing (stickman.mjs)
  +-- Procedural Foley PCM synthesis
  +-- FFmpeg: frames + SFX -> act MP4
  +-- Mix: narration + SFX -> stereo mix
        |
        v
SUBTITLE GENERATION (generate_ep02_subtitles.mjs)
  +-- Word-aligned SRT (219 cues for EP02)
        |
        v
THUMBNAIL RENDER (render_ep02_thumbnail.mjs)
  +-- 1280x720 PNG with CTR-optimized design
        |
        v
FEATURE ASSEMBLY (assemble_ep02_feature.mjs)
  +-- FFmpeg concat demuxer: Act1 + Act2 + ... + Act6 -> Final MP4
        |
        v
QA AUDIT (qa_controller.mjs)
  +-- ffprobe checks: duration, codec, audio streams, file integrity
        |  (PASS required before upload)
        v
YOUTUBE UPLOAD (upload_ep02.mjs)
  +-- OAuth2 (token.json)
  +-- Resumable upload (chunked, native Node fetch)
  +-- Thumbnail API
  +-- Captions API (SRT upload)
  +-- Schedule premiere time
        |
        v
PUBLISHED / SCHEDULED
```

---

## 4. Repository Architecture

```
video-generator-stickman/
|
+-- AGENTS.md                          <- Studio operational manual (agent rules)
+-- STUDIO_PRODUCTION_GUIDE.md         <- This file
+-- AI_VIDEO_PRODUCTION_MASTER_GUIDE.md <- Full system blueprint (1839 lines)
+-- package.json                       <- npm run scripts for all episode tasks
+-- .gitignore                         <- Excludes: node_modules, .env, token.json,
|                                         _archive/, .venv/, .DS_Store, *.tmp
|
+-- skills/  <->  .agents/skills/      <- 21 Antigravity skills (symlinked)
|   +-- directing-stickman-videos/     <- Primary character + IK skill
|   |   +-- SKILL.md
|   |   +-- assets/fonts/              <- Caveat.ttf, NotoSans.ttf
|   |   +-- node_modules/@napi-rs/canvas/  <- Canvas rendering engine
|   +-- remotion-*/                    <- 10 Remotion skills
|   +-- animejs-animation/
|   +-- threejs-animation/
|   +-- improve-animations/
|   +-- find-animation-opportunities/
|   +-- animation-performance/
|   +-- ad-creative/
|   +-- remotion-multimedia/
|   +-- viral-video-teardown-remake/
|
+-- projects/
|   +-- tools/                         <- Shared production toolbox
|   |   +-- stickman.mjs               <- 2-Bone IK engine + wobbly line renderer
|   |   +-- upload_ep02.mjs            <- YouTube API uploader (native Node, no npm)
|   |   +-- auth_youtube.mjs           <- OAuth2 local server (port 8085)
|   |   +-- render_shorts.mjs          <- Shorts pipeline
|   |   +-- captions.py                <- Python ASR subtitle helper
|   |
|   +-- ep08-how-ai-actually-works/    <- Episode 02 (AI explainer)
|   |   +-- renders_v2/
|   |   |   +-- narration/             <- act1.wav ... act6.wav + request.json
|   |   |   +-- render_act1_zoo.mjs
|   |   |   +-- render_act2_coordinates.mjs
|   |   |   +-- render_act3_attention.mjs
|   |   |   +-- render_act4_reasoning.mjs
|   |   |   +-- render_act5_moe.mjs
|   |   |   +-- render_act6_agents.mjs
|   |   |   +-- synthesize_audio.mjs
|   |   |   +-- generate_ep02_subtitles.mjs
|   |   |   +-- render_ep02_thumbnail.mjs
|   |   |   +-- assemble_ep02_feature.mjs
|   |   |   +-- qa_controller.mjs
|   |   +-- publishing/
|   |   |   +-- metadata.md            <- Full YouTube title, description, timestamps
|   |   +-- qa/
|   |   |   +-- report.md              <- QA pass/fail per-act
|   |   +-- project_manifest.json
|   |
|   +-- ep09-can-ai-become-conscious/  <- Episode 03
|   +-- ep07-history-of-ai/            <- Episode 01 (published)
|   +-- ep04-save-point/               <- Track B short
|   +-- ep-hurricane-category-explained/
|   +-- research/
|       +-- topics.csv                 <- Viral topic scoring sheet
|
+-- exports/                           <- Production-ready outputs only
|   +-- EP02-How-AI-Actually-Works-Final.mp4    (11m 39s)
|   +-- EP02-How-AI-Actually-Works-Final.en.srt (219 cues)
|   +-- EP02-thumbnail.png              (1280x720)
|   +-- EP02-Act1-AI-Zoo-Masterpiece.mp4
|   +-- EP02-Act2-Coordinates-Masterpiece.mp4
|   +-- EP02-Act3-Attention-Masterpiece.mp4
|   +-- EP02-Act4-Reasoning-Masterpiece.mp4
|   +-- EP02-Act5-MoE-Masterpiece.mp4
|   +-- EP02-Act6-Autonomous-Masterpiece.mp4
|   +-- EP07-The-Complete-History-of-AI.mp4     (7m 07s, published)
|   +-- EP09-Can-AI-Become-Conscious-Final.mp4  (5m 32s, ready)
|   +-- AI-SERIES-CATALOG.md
|   +-- SEASON-1-CATALOG.md
|   +-- YOUTUBE-UPLOADER-CHEATSHEET.md
|   +-- shorts/
|   |   +-- Short01-The-Strawberry-Trap-9x16.mp4    (40.5s)
|   |   +-- Short02-DeepSeek-MoE-Kitchen-9x16.mp4   (44.5s)
|   |   +-- Short03-Save-Point-Cheat-Code-9x16.mp4  (45.0s)
|   +-- _archive/                      <- Gitignored; old draft renders
|       +-- ep08-draft-renders/
|
+-- brand/                             <- Channel identity assets
```

---

## 5. Core Animation Engine — How Videos Are Built

> This studio uses **pure Node.js + `@napi-rs/canvas` + FFmpeg**. No browser. No React. No Remotion runtime is used for the main AI series. Each render script is a self-contained `.mjs` file.

### 5.1 The Render Script Pattern

Every `render_actN_*.mjs` follows this exact structure:

```javascript
// 1. IMPORTS
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { drawFigure, COLORS, INK, solve2BoneIK, spring } from '../../tools/stickman.mjs';

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require(
  path.resolve('skills/directing-stickman-videos/node_modules/@napi-rs/canvas')
);

// 2. REGISTER FONTS
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

// 3. CONSTANTS
const WIDTH = 1280, HEIGHT = 720, FPS = 30;
const VOICE = path.resolve('projects/ep08-how-ai-actually-works/renders_v2/narration/actN.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration ...`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);
const OUTPUT = path.resolve('exports/EP02-ActN-Name-Masterpiece.mp4');

// 4. PROCEDURAL FOLEY SYNTHESIS
// (Generate a PCM Float32Array of SFX, write as WAV, mix with narration)

// 5. FRAME RENDERING LOOP
const ffmpeg = spawn('ffmpeg', ['-f', 'rawvideo', '-pix_fmt', 'rgba', ...]);
for (let f = 0; f < TOTAL_FRAMES; f++) {
  const t = f / FPS;              // Time in seconds
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // --- DRAW BACKGROUND ---
  // --- DRAW HUD (title + action banner) ---
  // --- DRAW SCENE CONTENT (characters, props, math) ---
  //     using drawFigure(), solve2BoneIK(), spring() from stickman.mjs

  ffmpeg.stdin.write(canvas.toBuffer('raw'));  // Send raw RGBA to FFmpeg pipe
}
ffmpeg.stdin.end();
```

### 5.2 Stickman Character System (IK + Spring Physics)

**Location**: `projects/tools/stickman.mjs`

#### The Character Canvas

```
FIG = { width: 700, height: 1000, hipX: 350, hipY: 600, r: 78 }
```

The hip is always anchored at a fixed point so pose swaps never cause the character to jump.

#### `solve2BoneIK(origin, target, len1, len2, bendDirection)` — Analytical 2-Bone IK

This is the **most critical function in the codebase**. It places Magi's arms and legs.

```javascript
// CORRECT usage — arrays, not objects:
const [shoulder, elbow, hand] = solve2BoneIK(
  [shoulderX, shoulderY],      // origin:  [x, y] array
  [handTargetX, handTargetY],  // target:  [x, y] array
  upperArmLength,              // len1
  foreArmLength,               // len2
  1                            // bendDirection: 1=outward, -1=inward
);
// Returns [origin, joint, target] — all [x, y] arrays
// Draw: wobbly(ctx, [shoulder, elbow, hand], {width: 9, color: INK});
```

> COMMON BUGS TO AVOID:
> - Function is `solve2BoneIK` — NOT `solveIK2Bone`
> - Args are `[x, y]` arrays — NOT `{x, y}` objects
> - Returns `[origin, joint, target]` array — NOT an object

#### `wobbly(ctx, pts, opts)` — Hand-Drawn Line Renderer

Applies low-frequency wobble perpendicular to each stroke segment to simulate hand-drawn ink lines.

```javascript
wobbly(ctx, [[x1,y1], [x2,y2], [x3,y3]], {
  width: 6.5,          // stroke width
  color: INK,          // stroke color
  seed: 42,            // deterministic wobble (same seed = same wobble every frame)
  amp: 1.4,            // wobble amplitude
  close: false,        // close path?
  fill: '#FFF4C7',     // optional fill color
});
```

#### `spring(current, target, velocity, stiffness, damping)` — Spring Physics

```javascript
// Called every frame to animate smooth elastic motion
let pos = { x: 0, vel: 0 };
// In frame loop:
const [newPos, newVel] = spring(pos.x, targetX, pos.vel, 0.12, 0.75);
pos.x = newPos; pos.vel = newVel;
```

#### `drawFigure(ctx, pose)` — Full Character Renderer

Draws Magi's complete body from a pose specification:

```javascript
drawFigure(ctx, {
  hipX: 640, hipY: 480,
  torsoAngle: 0,          // degrees; 0=upright
  headTilt: -5,           // degrees; negative=tilt left
  look: 'right',          // 'left' | 'right' | 'forward'
  arms: {
    left:  { angle: -40, bent: 0.3 },   // angle from torso; bent 0-1
    right: { angle:  60, bent: 0.7 },
  },
  legs: {
    left:  { angle:  10, bent: 0.1 },
    right: { angle: -15, bent: 0.1 },
  },
  scarf: true,             // show yellow scarf
  hat:   true,             // show wizard hat
});
```

### 5.3 Canvas Rendering (`@napi-rs/canvas`)

**Package path**: `skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js`

This is a native Node.js binding to the Skia 2D graphics engine — the same engine used by Chrome.

**What it can render:**
- Filled and stroked paths, Bezier curves
- Text with registered system/custom fonts
- Images (PNG/JPEG loaded via `loadImage()`)
- Gradients, shadows, compositing modes

**What it CANNOT render:**
- Unicode emoji (`🍎`, `★`, `❌`) — use geometric shapes instead
- Math symbols (`sqrt`, `sum`, `inf`) — use ASCII or draw manually
- System fonts not explicitly registered via `GlobalFonts.registerFromPath()`

**Raw frame output**: Each frame is written as raw RGBA bytes to FFmpeg's stdin pipe using `canvas.toBuffer('raw')`. This avoids disk I/O for intermediate frames.

### 5.4 Procedural Foley Audio

Every render script synthesizes its own SFX as a 48 kHz PCM `Float32Array`, then writes a WAV header and passes it to FFmpeg.

#### WAV Header Builder

```javascript
function writeWAV(samples, rate) {
  const buf = Buffer.alloc(44 + samples.length * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length*4, 4);
  buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);     // chunk size
  buf.writeUInt16LE(3, 20);      // PCM float
  buf.writeUInt16LE(1, 22);      // 1 channel (mono SFX)
  buf.writeUInt32LE(rate, 24);   // sample rate: 48000
  buf.writeUInt32LE(rate*4, 28); // byte rate
  buf.writeUInt16LE(4, 32);      // block align
  buf.writeUInt16LE(32, 34);     // bits per sample
  buf.write('data', 36); buf.writeUInt32LE(samples.length*4, 40);
  samples.forEach((s, i) => buf.writeFloatLE(s, 44 + i*4));
  return buf;
}
```

#### Common SFX Patterns

```javascript
// Add a sound event at timestamp t0 (seconds), duration len (seconds)
const add = (t0, len, fn, gain = 0.3) => {
  const i0 = Math.round(t0 * rate);
  const count = Math.min(n - i0, Math.round(len * rate));
  for (let i = 0; i < count; i++) s[i0 + i] += fn(i / rate) * gain;
};

// CLANG hit: sin wave with exponential decay
add(34.0, 2.5, t => Math.sin(2*Math.PI*440*t) * Math.exp(-t*2.5), 0.65);

// WHOOSH: band-limited noise envelope
add(42.0, 1.5, t => noise() * Math.sin(t/1.5*Math.PI), 0.5);

// CHIME: harmonic partials
add(48.0, 1.2, t => (Math.sin(2*Math.PI*523*t) + Math.sin(2*Math.PI*659*t)*0.6) * Math.exp(-t*3), 0.5);

// AMBIENT HUM: noise + sub-tone
add(0, 36, t => (noise()*0.06 + Math.sin(2*Math.PI*120*t)*0.1) * Math.min(1,t*2), 0.25);
```

#### Final Audio Mix (FFmpeg amix)

```bash
ffmpeg -i narration.wav -i sfx.wav \
  -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.55[s];[v][s]amix=inputs=2:duration=first[out]" \
  -map "[out]" -ar 48000 -ac 1 mix.wav
```

### 5.5 FFmpeg Assembly

#### Frame Pipeline (render loop -> MP4)

```bash
ffmpeg \
  -f rawvideo -pix_fmt rgba -s 1280x720 -r 30 -i pipe:0 \
  -i mix.wav \
  -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p \
  -c:a aac -ar 48000 -b:a 192k \
  output.mp4
```

#### Feature Assembly (concat demuxer)

```
# concat_list.txt — MUST use single-quoted absolute paths
file '/Users/prashantmishra/Developer/video-generator-stickman/exports/EP02-Act1-AI-Zoo-Masterpiece.mp4'
file '/Users/prashantmishra/Developer/video-generator-stickman/exports/EP02-Act2-Coordinates-Masterpiece.mp4'
...
```

```bash
ffmpeg -f concat -safe 0 -i concat_list.txt -c copy EP02-Final.mp4
```

> IMPORTANT: Always use single-quoted absolute paths in the concat list file. Relative paths or unquoted paths cause silent failures on macOS.

---

## 6. Installed Skills — All 21

Skills live in `skills/` (symlinked to `.agents/skills/`). Each has a `SKILL.md` with YAML frontmatter and detailed instructions.

| # | Skill Name | Purpose | Used For |
|---|---|---|---|
| 1 | **`directing-stickman-videos`** | Character choreography, 2-bone IK poses, camera transitions, scene pacing. Contains the font files and `@napi-rs/canvas` node_modules. | **Primary skill — used in every episode render** |
| 2 | **`improve-animations`** | Audit existing motion and write prioritized implementation plans with exact evidence, scope, and verification steps. | EP02 animation quality review |
| 3 | **`find-animation-opportunities`** | Propose purposeful motion opportunities from a read-only codebase review. | Pre-production motion planning |
| 4 | **`animation-performance`** | Diagnose dropped frames, choose rendering paths, and profile checks for smooth web motion. | Performance debugging |
| 5 | **`animejs-animation`** | Advanced JavaScript animation library for complex, high-performance web animations. | Supplemental JS motion |
| 6 | **`threejs-animation`** | Keyframe animation, skeletal animation, morph targets, animation mixing. 3D WebGL scenes. | 3D visualization scenes |
| 7 | **`remotion-best-practices`** | 28 modular video rules: 3D Three.js integration, audio visualization, spring animations, timing, multi-scene layouts. | Remotion compositions |
| 8 | **`remotion-markup`** | Content, animation and effects best practices for Remotion. | Remotion scene markup |
| 9 | **`remotion-create`** | Rapid composition setup and project creation. | New Remotion projects |
| 10 | **`remotion-render`** | Frame rendering pipelines and export commands. | Rendering Remotion compositions |
| 11 | **`remotion-studio`** | Live preview studio for Remotion. | Development preview |
| 12 | **`remotion-captions`** | Transcribing, displaying and animating captions in Remotion. | Subtitle composition |
| 13 | **`remotion-docs`** | Search Remotion documentation. | Reference lookup |
| 14 | **`remotion-interactivity`** | Structure Remotion markup for interactivity. | Interactive video elements |
| 15 | **`remotion-license`** | License information, FAQs, terms, and pricing. | Commercial use compliance |
| 16 | **`remotion-maps`** | Map animation knowledge for Remotion. | Geographic visualizations |
| 17 | **`remotion-multimedia`** | Interacting with Mediabunny for media operations. | Media handling |
| 18 | **`remotion-saas`** | Build an app with Remotion. | SaaS video features |
| 19 | **`remotion-upgrade`** | Upgrade Remotion and related packages. | Dependency management |
| 20 | **`ad-creative`** | Create, iterate, and scale paid ad creative for Google Ads, Meta, LinkedIn, TikTok. | Channel growth / promotion |
| 21 | **`viral-video-teardown-remake`** | Install and use the official Viral Video Remake package (Beatra service). | Content repurposing |

> **Skills NOT yet created** (recommended next — see Section 14):
> `video-research-director`, `youtube-scriptwriter`, `storyboard-architect`, `thumbnail-designer`, `youtube-publisher`, `voiceover-director`, `subtitle-generator`

---

## 7. Production Tools (`projects/tools/`)

| Script | Language | Purpose |
|---|---|---|
| `stickman.mjs` | Node ESM | 2-Bone Analytical IK solver, wobbly line renderer, spring physics, `drawFigure()`, color constants |
| `upload_ep02.mjs` | Node ESM | YouTube Data API v3 resumable upload — zero npm deps, native `fetch` with chunked `Content-Range` headers |
| `auth_youtube.mjs` | Node ESM | OAuth2 local server on port 8085; opens browser consent screen; writes `token.json` |
| `render_shorts.mjs` | Node ESM | Renders all 3 Shorts (1080x1920) |
| `render_all_three_shorts.mjs` | Node ESM | Sequential shorts render coordinator |
| `captions.py` | Python | ASR subtitle generation helper (faster-whisper) |
| `upload_ep07.py` | Python | Python-based EP07 uploader (legacy) |

### npm Scripts (from `package.json`)

```bash
npm run render:ep02           # Assemble full EP02 feature film
npm run render:ep02:acts      # Render all 6 individual acts
npm run render:ep02:subtitles # Generate 219-cue word-aligned SRT
npm run render:ep02:thumb     # Render 1280x720 CTR thumbnail PNG
npm run qa:ep02               # Run QA audit (ffprobe all outputs)
npm run upload:ep02           # Upload to YouTube (OAuth required)
npm run auth:youtube          # Refresh YouTube OAuth token
```

---

## 8. Episode Production Workflow (Step by Step)

### Phase 1: Research & Script (Days 1-2)

1. **Topic selection** from `projects/research/topics.csv` (demand score x gap score = RPM tier)
2. **Deep research** — verify all technical claims against primary papers (see EP02 citations in Appendix B)
3. **Script draft** — Hook (0-15s must create tension), 5-6 acts, CTA
4. **Script approval** — human reviews before narration

### Phase 2: Narration Production (Day 2-3)

1. Send script to Gemini Studio Voice (Bodi) for TTS generation
2. Store WAVs in `projects/epNN-episode-name/renders_v2/narration/actN.wav`
3. Store request JSON alongside each WAV for reproducibility
4. Run `ffprobe` on each WAV to get exact duration -> determines frame count

### Phase 3: Storyboard & Scene Design (Day 3-4)

Each act must have:
- **Opening physical metaphor** that immediately visualizes the concept
- **Character action** — what is Magi doing in each second of the act?
- **Foley cues** — what sounds happen at which timestamps?
- **On-screen text** — HUD labels only (not explanatory body text)
- **Scene beats** mapped to narration timestamps

### Phase 4: Render Scripts (Days 4-7)

1. Create `render_actN_name.mjs` in `projects/epNN/renders_v2/`
2. Import `solve2BoneIK`, `drawFigure`, `spring`, `wobbly` from `../../tools/stickman.mjs`
3. Synthesize Foley PCM in the same script
4. Test with `node render_actN_name.mjs` — check output MP4 in VLC
5. Iterate until character animation feels alive and Foley is frame-perfect

### Phase 5: Subtitles (Day 7)

Run `generate_ep02_subtitles.mjs`:
- Reads narration WAVs
- Splits script into word-aligned chunks (target: 3-7 words per cue)
- Formats as `.srt` with millisecond precision
- Saves to `exports/EPxx-Title.en.srt`

### Phase 6: Thumbnail (Day 7)

Run `render_ep02_thumbnail.mjs`:
- 1280x720 PNG
- Large bold text hook visible at mobile thumbnail size
- Character pose that creates intrigue
- High contrast, 2-3 colors max

### Phase 7: Assembly (Day 7)

Run `assemble_ep02_feature.mjs`:
- Builds `concat_list.txt` with single-quoted absolute paths
- FFmpeg concat demuxer -> final MP4 (copy codec, no re-encode)

### Phase 8: QA (Day 7-8)

Run `qa_controller.mjs` — checks:

| Check | Expected |
|---|---|
| Container | MP4 |
| Video codec | h264 |
| Resolution | 1280x720 |
| Frame rate | 30 fps |
| Duration | matches storyboard ± 2s |
| Audio streams | >= 1 |
| Audio sample rate | 48000 Hz |
| File size | > 1 MB |
| All act MP4s | exist and pass |

**All checks must PASS before upload.**

### Phase 9: Upload & Schedule (Day 8)

```bash
npm run auth:youtube   # only needed if token.json is expired (> ~7 days)
npm run upload:ep02    # uploads, sets thumbnail, uploads captions, sets premiere
```

**Optimal schedule**: Tuesday 19:00 UTC (2:00 PM EST) for tech explainer audience across US, EU, and India.

---

## 9. Episode Catalog & Status

### AI Explainer Series (Track A)

| Ep | Internal ID | Title | Runtime | Status | YouTube |
|---|---|---|---|---|---|
| **01** | EP07 | How We Taught Sand to Think (Complete History of AI) | 7m 07s | Published | youtu.be/83wD-gYcQbc |
| **02** | EP08 v2 | How AI Actually Works (GPT, Gemini & DeepSeek) | 11m 39s | Scheduled Nov 17 | youtu.be/FP7hbC2qdms |
| **03** | EP09 | Can AI Ever Become Conscious? | 5m 32s | Master complete | Needs SRT + upload |
| **04** | EP10 | The Geometry of Thinking (Loss Landscapes & Backprop) | ~6m 00s | Pre-production | — |

### EP02 Act Breakdown

| Act | File | Duration | Core Scene |
|---|---|---|---|
| Act 1 | `EP02-Act1-AI-Zoo-Masterpiece.mp4` | 114.4s | AI Zoo: Words->Dials->Probabilities, 4 species terrariums |
| Act 2 | `EP02-Act2-Coordinates-Masterpiece.mp4` | 123.0s | Typewriter BPE trap, 12,288-D Supermarket, King-Man+Woman=Queen |
| Act 3 | `EP02-Act3-Attention-Masterpiece.mp4` | 121.3s | RNN straw amnesia, Q-K-V cocktail party, 96 flashlights, Softmax chute |
| Act 4 | `EP02-Act4-Reasoning-Masterpiece.mp4` | 111.8s | Fast auctioneer vs detective [think] scratchpad, GRPO |
| Act 5 | `EP02-Act5-MoE-Masterpiece.mp4` | 107.6s | 1,000-ton brain, 64 chefs (62 sleeping), DeepSeek-V3 95% savings |
| Act 6 | `EP02-Act6-Autonomous-Masterpiece.mp4` | 121.0s | Brain-in-jar uncaging, 4-step ReAct loop, sand-to-galaxy Turing finale |

### Track B: Viral "What If" Series

| Title | File | Status |
|---|---|---|
| What If You Had a Save Point in Real Life? | `EP04-What-If-You-Had-A-Save-Point-Final.mp4` | Complete |
| Every Hurricane Category Explained | Pre-production | Storyboard pending |
| What If You Could See Everyone's Salary? | `EP01-What-If-...Salary.mp4` | Complete |

---

## 10. YouTube Publishing Pipeline

### OAuth2 Flow

```
auth_youtube.mjs
  -> spawns local server on port 8085
  -> opens browser: accounts.google.com/o/oauth2/auth?...
  -> user clicks consent
  -> callback: ?code=XXXXXX
  -> exchanges code for access_token + refresh_token
  -> writes token.json (gitignored)
```

**Scopes required:**
- `youtube.upload` — upload videos
- `youtube` — set thumbnail, captions, metadata
- `youtube.force-ssl` — required for comment posting (not currently used)

### Upload Process (`upload_ep02.mjs`)

```
1. Read token.json -> refresh access_token if expired
2. POST /youtube/v3/videos?uploadType=resumable
   Body: { snippet, status } metadata
   -> Receive resumable upload URI
3. PUT {resumable_uri}
   Headers: Content-Range: bytes 0-{size-1}/{size}
   Body: entire MP4 file buffer
   -> Receive { id: "FP7hbC2qdms" }
4. POST /youtube/v3/thumbnails/set?videoId=...
   Body: PNG multipart/form-data
5. POST /youtube/v3/captions?part=snippet
   Body: SRT multipart/form-data
6. Console.log: watch URL, studio URL, premiere time
```

### Known API Constraints

| Issue | Fix |
|---|---|
| `invalidDescription` 400 error | Description cannot contain `<` or `>`. Replace `<think>` with `[think]` |
| `invalid_grant` OAuth error | Token expired; run `npm run auth:youtube` to re-authenticate |
| Comment posting 403 | `commentThreads.insert` requires additional scope; post pinned comment manually in Studio |
| Sandbox network block | All upload/auth commands require `BypassSandbox: true` in Antigravity |

---

## 11. Quality Control System

**Script**: `projects/ep08-how-ai-actually-works/renders_v2/qa_controller.mjs`

### QA Checklist

```
[ ] All 6 act MP4 files exist
[ ] Final feature MP4 exists
[ ] SRT file exists with >= 50 cues
[ ] Thumbnail PNG exists (1280x720)
[ ] ffprobe: video codec = h264
[ ] ffprobe: width = 1280, height = 720
[ ] ffprobe: r_frame_rate = 30/1
[ ] ffprobe: duration >= 600s (10 min) for feature
[ ] ffprobe: audio stream exists
[ ] ffprobe: sample_rate = 48000
[ ] File size > 10 MB (not truncated)
[ ] No black frame runs > 2s
[ ] Audio not clipping (peak < 0 dBFS)
```

### QA Report Location

`projects/ep08-how-ai-actually-works/qa/report.md` — human-readable pass/fail table

---

## 12. Visual Analogy Library

The studio's most powerful asset. Each concept maps to a proven physical metaphor:

| AI Concept | Visual Metaphor Used | Act |
|---|---|---|
| LLM prediction loop | 3-step recipe: Words->Numbers->Probabilities | Act 1 |
| ChatGPT vs Gemini vs DeepSeek | 4 species in glass terrariums (AI Zoo) | Act 1 |
| Tokenization / BPE | Antique typewriter trapping letters into sticky boxes; strawberry 'r' bug | Act 2 |
| Word embeddings | 12,288-dimensional supermarket: related words in same aisle | Act 2 |
| Semantic vector math | King - Man + Woman = Queen: sliding along gender/royal vectors | Act 2 |
| Self-attention mechanism | Cocktail party: Magi sweeping flashlight across a dark room | Act 3 |
| Q, K, V matrices | Librarian query card (Q) -> catalog key card (K) -> book value (V) | Act 3 |
| Multi-head attention | 96 flashlights sweeping simultaneously, each from a different angle | Act 3 |
| RNN memory limitation | Trying to drink an ocean through a straw; amnesia at sequence position 512 | Act 3 |
| Softmax normalization | A gravity chute redistributing weights so they sum to 1.0 | Act 3 |
| System 1 fast thinking | Magi as a speed-auctioneer buzzing wrong answers | Act 4 |
| System 2 chain-of-thought | Detective Magi at chalkboard: [think] scratchpad, backtracking | Act 4 |
| GRPO reinforcement learning | Each correct reasoning path wins tokens; wrong paths erased | Act 4 |
| Standard dense model | 1,000-ton panting steel brain smoking from overload | Act 5 |
| Mixture of Experts (MoE) | 64-chef kitchen: 62 sleep, 2 cook; router picks by dish type | Act 5 |
| DeepSeek-V3 efficiency | 671B total params / 37B active = 95% datacenter power savings | Act 5 |
| AI agent architecture | Brain in a jar -> uncaged -> picks up tools | Act 6 |
| ReAct loop | 4-panel loop: Think -> Act -> Observe -> Repeat | Act 6 |
| AGI horizon | Sand on a beach -> silicon -> microchip -> 3D expanding galaxy | Act 6 |
| Consciousness hard problem | Animatronic marionette theater with no audience (EP09) | — |
| Chinese Room | Architectural cutaway: mail slot, enormous rulebook, no understanding | — |
| Integrated Information Theory | Cerebellum assembly line (Phi~0) vs Cortex recurrent 3D web (Phi>0) | — |

---

## 13. Known Issues, Bugs & Fixes

| Bug | Root Cause | Status & Fix |
|---|---|---|
| `SyntaxError: does not provide export named 'solveIK2Bone'` | Function was renamed; old call sites not updated | Fixed — use `solve2BoneIK` |
| `Cannot read properties of undefined (reading 'x')` on IK | Passed `{x, y}` objects; function expects `[x, y]` arrays | Fixed — always use array pairs |
| `ERR_MODULE_NOT_FOUND @napi-rs/canvas` | Wrong relative path in import | Fixed — `path.resolve('skills/directing-stickman-videos/node_modules/@napi-rs/canvas')` |
| `invalidDescription` 400 on YouTube upload | `<think>` angle brackets in description | Fixed — replace with `[think]` in all descriptions |
| `invalid_grant` OAuth error | OAuth refresh token expires after ~7 days of inactivity | Fixed — `npm run auth:youtube` to re-auth |
| Comment POST 403 Forbidden | `commentThreads.insert` scope missing | Known — post pinned comment manually in Studio |
| Orphaned `,` entries in SRT | Regex split on commas created punctuation-only cues | Fixed — phrase chunker with `.filter()` to remove pure-punctuation |
| `git add -A: index.lock permission error` | Sandbox blocks `.git/index.lock` creation | Fixed — git commands run with `BypassSandbox: true` |
| `fetch failed: ENOTFOUND oauth2.googleapis.com` | Sandbox blocks outbound network | Expected — all upload/auth use `BypassSandbox: true` |
| FFmpeg concat: No such file | Unquoted paths in concat list | Fixed — wrap all paths in single quotes |
| Black frames at scene boundaries | Narration WAV shorter than expected; frame count off by 1 | Mitigation — use `Math.ceil()` for TOTAL_FRAMES, not `Math.floor()` |

---

## 14. Improvement Roadmap

### Immediate (Next Session)

| Priority | Task | Effort |
|---|---|---|
| HIGH | EP03 Publishing — Upload EP09 master with SRT + thumbnail; schedule Nov 24 | 2-3 hours |
| HIGH | EP02 Pinned Comment — Post manually in YouTube Studio | 5 min |
| MED | EP04 Storyboard — Geometry of Thinking: loss landscape foggy mountain hiker, gradient descent, backprop pulleys | 1 day |

### Animation Quality Improvements

| Improvement | Description | Complexity |
|---|---|---|
| **Lip sync** | Magi's mouth should open/close in sync with narration phonemes (sample narration amplitude at 60 Hz) | Medium |
| **Blink system** | Random eye blinks every 3-6s (currently eyes are static) | Low |
| **Weight shift** | Hips shift slightly L/R as Magi breathes (sinusoidal hip oscillation) | Low |
| **Look-at IK** | Head should track props/text the narrator is describing | Medium |
| **Secondary motion** | Scarf should trail behind arm swings (spring-physics trailing segment) | Medium |
| **Idle cycles** | Between speech beats, Magi should do subtle weight shifts, not freeze | Low |
| **Higher resolution** | Upgrade to 1920x1080 for Season 2 (requires font size adjustments) | Low |
| **Motion blur** | Add sub-frame motion blur on fast character movements | Medium |
| **Shadow system** | Drop shadows under character for grounding | Low |

### Production Skills to Create

Create these as `skills/<name>/SKILL.md` bundles:

```
skills/
+-- youtube-scriptwriter/     # Hook, chapters, CTA templates
+-- storyboard-architect/     # Script -> timed scene JSON
+-- thumbnail-designer/       # CTR brief + design direction
+-- youtube-publisher/        # Metadata, chapters, upload prep
+-- voiceover-director/       # TTS params, narration timing
+-- subtitle-generator/       # ASR alignment, SRT formatting
+-- video-research-director/  # Topic research, citations
```

### Pipeline Automation

| Feature | Description |
|---|---|
| **Model registry** | `models/registry.yaml` — document Gemini TTS (Bodi) voice parameters, canvas version, FFmpeg build |
| **Scene JSON format** | Standardize scene contracts so acts can be described declaratively, not imperatively |
| **Render queue** | Background job queue (Redis + BullMQ) for parallel act rendering |
| **Preview mode** | `--preview` flag: render at 10 fps / 320x180 for fast iteration |
| **Hot reload** | Watch mode: re-render current frame on script save during development |
| **EP03 SRT generator** | Adapt `generate_ep02_subtitles.mjs` for EP09 act narration WAVs |
| **Automated thumbnail A/B** | Generate 2-3 thumbnail variants per episode; upload all; track CTR in first 48h |

---

## Appendix A: Quick Reference Commands

```bash
# Check environment
node --version && ffmpeg -version && ffprobe -version

# Run a single act render (from repo root)
node projects/ep08-how-ai-actually-works/renders_v2/render_act1_zoo.mjs

# Probe a rendered act
ffprobe -v quiet -print_format json -show_format -show_streams \
  exports/EP02-Act1-AI-Zoo-Masterpiece.mp4

# Check final feature film duration
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 \
  exports/EP02-How-AI-Actually-Works-Final.mp4

# Refresh YouTube auth (opens browser)
node projects/tools/auth_youtube.mjs

# Upload EP02 to YouTube
node projects/tools/upload_ep02.mjs

# Git status
git log --oneline -5 && git status --short
```

---

## Appendix B: Academic Citations (EP02)

All claims in the AI series are grounded in peer-reviewed papers:

1. **Vaswani, A., et al. (2017)**. "Attention Is All You Need." NeurIPS. — Transformer architecture, Q/K/V attention
2. **Mikolov, T., et al. (2013)**. "Efficient Estimation of Word Representations in Vector Space." ICLR. — Word2Vec, King-Man+Woman=Queen
3. **Radford, A., et al. (2019)**. "Language Models are Unsupervised Multitask Learners." OpenAI. — GPT-2, BPE tokenization
4. **DeepSeek-AI (2024)**. "DeepSeek-V3 Technical Report." — MoE architecture, 671B/37B active, Multi-Head Latent Attention
5. **DeepSeek-AI (2025)**. "DeepSeek-R1: Incentivizing Reasoning via Reinforcement Learning (GRPO)." — Scratchpad, chain-of-thought training
6. **Yao, S., et al. (2022)**. "ReAct: Synergizing Reasoning and Acting in Language Models." ICLR 2023. — ReAct agent loop
7. **Chalmers, D. (1995)**. "Facing Up to the Problem of Consciousness." Journal of Consciousness Studies. — Hard vs Easy problem (EP03)
8. **Searle, J. (1980)**. "Minds, Brains, and Programs." Behavioral and Brain Sciences. — Chinese Room (EP03)
9. **Tononi, G. (2004)**. "An Information Integration Theory of Consciousness." BMC Neuroscience. — IIT, Phi (EP03)

---

*This document is the single source of truth for the Programs Magic AI Video Studio.*
*Keep it updated after every episode production cycle.*
