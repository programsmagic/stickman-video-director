# Programs Magic — AI Video Studio Master Blueprint

**Project:** `video-generator-stickman`  
**Channel:** Programs Magic  
**Mascot:** Magi — wizard hat, curious wide gaze, signature yellow scarf  
**Source baseline:** Programs Magic — AI Video Studio: Complete Production Guide, supplied 15 November 2026  
**Purpose:** Evolve the working studio into a premium, reliable animation and video-production system without breaking its existing pipeline.

---

## 0. Executive direction

Programs Magic already has a functioning production foundation: Node.js render scripts, a reusable Magi character system, analytical two-bone inverse kinematics, spring motion, `@napi-rs/canvas`, procedural Foley, FFmpeg assembly, narration, subtitles, thumbnails, QA, and YouTube upload preparation.

**The strategy is to evolve this engine—not replace it.** Keep the current Canvas renderer as the primary 2D character/explainer engine. Add specialist renderers only when they solve a real creative requirement. Do not replace the existing pipeline with Remotion or perform a bulk rewrite.

### North star

> Make complex ideas feel simple through memorable physical storytelling, beautiful animation, clear visual hierarchy, excellent sound, and precise timing.

### Non-negotiable outcomes

1. **Clarity:** A viewer understands what is happening without pausing or rereading.
2. **Purposeful animation:** Every movement communicates an action, relationship, cause, comparison, or emotional beat.
3. **Premium craft:** Consistent character design, clean composition, smooth motion, controlled lighting/shadows, typography, transitions, and sound.
4. **Narrative continuity:** Props, characters, camera direction, and visual metaphors remain coherent.
5. **Technical reliability:** Reproducible renders, validated media, deterministic timing, and recoverable production steps.
6. **Human approval:** Research claims, scripts, final creative output, and publishing are reviewed by a person.
7. **Backward compatibility:** Existing episode scripts continue to work while new capabilities are introduced.

---

## 1. Existing project baseline — preserve this

The following is taken from the supplied project guide. Treat it as the documented baseline, not a guarantee that every path or dependency is identical on every machine. Inspect the live repository before changing anything.

### 1.1 Current architecture

- Main engine: pure Node.js ES modules (`.mjs`) plus `@napi-rs/canvas` and FFmpeg.
- Character utility: `projects/tools/stickman.mjs`.
- Character functions documented: `drawFigure()`, `solve2BoneIK()`, `spring()`, and `wobbly()`.
- IK contract: `solve2BoneIK()` accepts `[x, y]` arrays and returns `[origin, joint, target]`.
- Rendering: canvas frames streamed as raw RGBA to FFmpeg.
- Character: Magi, wizard hat, curious eyes, yellow scarf.
- Audio: narration WAV plus procedural 48 kHz PCM Foley; FFmpeg mixing and encoding.
- Narration: Google Gemini Studio voice identified in the guide as “Bodi.”
- Post-production: subtitles, thumbnails, act assembly, QA, YouTube OAuth/upload tools.
- Publishing: human approval is mandatory; no unattended publishing.
- Fonts documented: `CaveatHand` and `NotoSans`.
- Existing output baseline: 1280×720, 30 fps, H.264, 48 kHz audio; Shorts 1080×1920.
- The guide documents 1920×1080 as the future-season target.

### 1.2 Documented repository map

```text
video-generator-stickman/
├── AGENTS.md
├── STUDIO_PRODUCTION_GUIDE.md
├── AI_VIDEO_PRODUCTION_MASTER_GUIDE.md
├── package.json
├── .gitignore
├── skills/                       # symlinked to .agents/skills/
│   ├── directing-stickman-videos/
│   ├── improve-animations/
│   ├── find-animation-opportunities/
│   ├── animation-performance/
│   ├── animejs-animation/
│   ├── threejs-animation/
│   ├── remotion-*/                # Remotion skill family
│   ├── ad-creative/
│   └── viral-video-teardown-remake/
├── projects/
│   ├── tools/
│   │   ├── stickman.mjs
│   │   ├── upload_ep02.mjs
│   │   ├── auth_youtube.mjs
│   │   ├── render_shorts.mjs
│   │   └── captions.py
│   ├── ep08-how-ai-actually-works/
│   ├── ep09-can-ai-become-conscious/
│   ├── ep07-history-of-ai/
│   ├── ep04-save-point/
│   ├── ep-hurricane-category-explained/
│   └── research/
├── exports/
└── brand/
```

Do not move or rename existing episode scripts as part of the initial upgrade. Existing scripts may rely on these paths.

### 1.3 Existing 21 Antigravity skills

Preserve and audit these before installing replacements or duplicates:

1. `directing-stickman-videos` — primary Magi choreography, IK, camera and scene direction.
2. `improve-animations` — animation audit and prioritized improvement plans.
3. `find-animation-opportunities` — read-only discovery of purposeful motion.
4. `animation-performance` — motion performance diagnosis and profiling.
5. `animejs-animation` — supplemental JavaScript animation.
6. `threejs-animation` — 3D keyframe, skeletal and morph animation.
7. `remotion-best-practices` — Remotion composition guidance.
8. `remotion-markup` — Remotion scene markup.
9. `remotion-create` — Remotion project/composition setup.
10. `remotion-render` — Remotion frame rendering and export.
11. `remotion-studio` — Remotion preview workflow.
12. `remotion-captions` — caption workflows.
13. `remotion-docs` — Remotion documentation lookup.
14. `remotion-interactivity` — Remotion interactivity structure.
15. `remotion-license` — Remotion licensing and terms.
16. `remotion-maps` — map animation knowledge.
17. `remotion-multimedia` — Mediabunny/media operations.
18. `remotion-saas` — Remotion application patterns.
19. `remotion-upgrade` — Remotion dependency upgrades.
20. `ad-creative` — paid ad creative.
21. `viral-video-teardown-remake` — viral video analysis/remake workflow.

Future skills already proposed in the project guide: `video-research-director`, `youtube-scriptwriter`, `storyboard-architect`, `thumbnail-designer`, `youtube-publisher`, `voiceover-director`, and `subtitle-generator`.

---

## 2. Creative quality standard

### 2.1 The “understand it instantly” rule

Every scene must answer:

1. **What am I looking at?** The main subject is immediately recognizable.
2. **What is happening?** The action or change is visually obvious.
3. **Why does it matter?** The scene connects to narration and the larger explanation.

If a paragraph of text is required to understand the animation, redesign the metaphor.

### 2.2 Physical metaphor first

Continue the studio's strongest rule: explain abstract ideas through familiar physical experiences. Examples documented in the project guide:

- Embeddings → a supermarket with semantic aisles.
- Attention → a cocktail party and a moving flashlight.
- Mixture of Experts → a kitchen with specialist chefs and a router.
- ReAct → Think → Act → Observe → Repeat as a physical loop.
- Tokenization → a typewriter grouping letters into tokens.

Every new metaphor must be familiar to a non-specialist, visually distinct, demonstrable through action, technically fair, and explainable in one sentence.

### 2.3 Scene hierarchy

When a frame becomes crowded, prioritize:
1. Main action / primary character or object.
2. The key relationship being explained.
3. One supporting label or value.
4. Background decoration.

Never let HUD elements, particles, grids, or props obscure the main action.

### 2.4 Character-first, not character-only

Magi should introduce a problem, manipulate props, react to results, direct attention, transition between metaphors, and provide scale/emotion. In technical sequences, the mathematical system can be the main subject while Magi points, observes, or interacts at the edge of the composition.

### 2.5 Visual consistency

Keep the documented identity:

```js
const COLORS = {
  scarf:  '#E8B32A', red: '#EC4338', green: '#4CAF6A',
  blue: '#3D7DD8', paper: '#FFF4C7', glass: '#E6F0F4',
  skin: '#FFFFFF', navy: '#2B3A55', brown: '#9B6B43',
  gray: '#B9BEC4', purple: '#6B4BD8'
};
const INK = '#1d1d1b';
```

Use `CaveatHand` for personality and `NotoSans` for structured information. Use only a small, intentional subset of the palette per scene, with stable semantic color meanings.

---

## 3. Premium video output specification

The existing guide documents 1280×720 at 30 fps as the working output and 1920×1080 as the future target. The following is the recommended standard for new episodes. Benchmark render time, storage, and actual machine capacity before applying it to every project.

### 3.1 Delivery profiles

| Profile | Resolution | Frame rate | Use |
|---|---:|---:|---|
| Fast preview | 640×360 or 960×540 | 15–30 fps | Blocking, timing, layout |
| Standard preview | 1280×720 | 30 fps | Full scene review |
| Main episode master | 1920×1080 | 30 fps constant | Primary long-form delivery |
| High-motion insert | 1920×1080 | 60 fps only when justified | Fast motion where 60 fps improves clarity |
| Shorts master | 1080×1920 | 30 fps constant | Vertical Shorts |
| Optional UHD master | 3840×2160 | 30 fps | Only after a measured 4K benchmark |

**4K is not automatically premium.** Clean art direction, antialiasing, composition, stable motion, and excellent audio matter more than an upscaled pixel count. Render natively at the target resolution when practical. Do not upscale low-resolution raster assets and call that native 4K.

### 3.2 H.264 starting profile

```bash
-c:v libx264 \
-preset slow \
-crf 16 \
-pix_fmt yuv420p \
-r 30 \
-fps_mode cfr \
-movflags +faststart
```

Test CRF 16–18 against actual scenes and file size. Lower CRF means higher quality and larger files. Use `slow` for final exports if render time permits; faster presets are acceptable for previews. Keep final frame rate constant. Do not blindly stream-copy concatenated acts unless codec, profile, pixel format, frame rate, time base, audio layout, and encoding settings match. Re-encode the assembled master if compatibility is uncertain.

### 3.3 Audio delivery

Existing baseline: 48 kHz audio, PCM WAV intermediates, AAC final audio. Recommended starting point for new work:

- 48 kHz sample rate.
- AAC-LC, 256–320 kb/s stereo final audio.
- Approximately -14 LUFS integrated loudness as a YouTube-oriented starting target; preserve program dynamics and use listening tests.
- Approximately -1 dBTP true-peak ceiling.
- No clipped narration or Foley.
- Narration intelligible on laptop speakers and headphones.
- Foley supports action without competing with speech.
- Music, if used, is licensed or original and sits below narration.

Measure loudness first:

```bash
ffmpeg -i input.wav \
  -af loudnorm=I=-14:TP=-1:LRA=11:print_format=summary \
  -f null -
```

For final normalization, use a measured two-pass workflow or the exact measured values from pass one. Do not copy measurements from another episode.

Keep separate stems during production: `narration.wav`, `foley.wav`, optional `music.wav`, and `final_mix.wav`. Preserve independent editability. Create a stereo final master where the sound design benefits from it, check mono compatibility, and avoid forcing stereo where the source is genuinely mono.

---

## 4. Animation direction and motion language

Premium animation is not “everything moves all the time.” It is controlled movement with clear intent.

### 4.1 Motion principles

- **Anticipation:** prepare before a major action.
- **Clear action:** the viewer can identify the movement.
- **Follow-through:** flexible elements continue after the main body stops.
- **Ease-in/ease-out:** movement accelerates and decelerates naturally.
- **Staging:** frame the action so it reads clearly.
- **Timing:** important actions have enough time to register.
- **Secondary motion:** scarf, hat, hands, props, and facial features react to the main movement.
- **Consistency:** prop position and state remain coherent.
- **Controlled exaggeration:** improve readability without changing meaning.

Avoid random bouncing, constant camera movement, excessive particles/glows, unmotivated zooms, transitions that hide the concept, and text motion that competes with reading.

### 4.2 Magi animation upgrades

Implement incrementally using the existing `stickman.mjs` API:

| Upgrade | Expected behaviour | Priority |
|---|---|---|
| Blink system | Natural deterministic blinks | High |
| Idle cycle | Breathing and subtle weight shifts during pauses | High |
| Look-at targeting | Head/eyes track the active prop or event | High |
| Scarf follow-through | Spring-driven trailing motion during turns/gestures | High |
| Gesture library | Reusable point, hold, lift, push, pull, inspect, react, walk | High |
| Expression library | Curious, confused, surprised, pleased, concerned, focused | High |
| Foot planting | Feet do not slide during stationary gestures | Medium |
| Lip-sync | Mouth timing driven by phonemes or a reliable approximation | Medium |
| Motion blur | Optional sub-frame blur for fast movement only | Medium |
| Shadow/grounding | Consistent contact shadows and prop grounding | Medium |

Do not implement all at once. Add one capability, render a 10–15 second test, inspect it frame by frame, and keep it only if it improves the result.

### 4.3 Proposed reusable action vocabulary

The following is a design suggestion, not an existing API. Inspect current exports before implementing:

```js
const actions = {
  idle:       { /* subtle breathing and weight shift */ },
  pointAt:    { target: 'prop-or-anchor' },
  inspect:    { target: 'object', lean: 'forward' },
  pickUp:     { target: 'object' },
  hold:       { target: 'object', hand: 'right' },
  push:       { target: 'object' },
  pull:       { target: 'object' },
  explain:    { gesture: 'open-palm' },
  react:      { expression: 'surprised' },
  celebrate:  { gesture: 'both-arms-up' }
};
```

Keep the existing IK solver and pose contract intact.

### 4.4 Camera grammar

- Wide shot: establish environment and spatial relationships.
- Medium shot: Magi interacting with a prop.
- Close-up: important detail, mechanism, or reaction.
- Insert: precise diagram, equation, or object detail.
- Tracking move: follow a subject only when movement matters.
- Push-in: emphasize a reveal or realization.
- Pull-back: reveal the larger system.

Every camera move must have a reason. Do not zoom merely to make a scene feel busy.

---

## 5. Make explanations easier to understand

### 5.1 One-scene / one-idea rule

Each scene should primarily communicate one new idea. If multiple unfamiliar terms are introduced, split the scene or establish them sequentially.

Recommended progression:
1. **Hook:** show a surprising result or problem.
2. **Question:** make the viewer wonder why it happened.
3. **Physical analogy:** introduce a familiar object or situation.
4. **Mechanism:** animate the steps one at a time.
5. **Connection:** map the analogy back to the real concept.
6. **Takeaway:** reinforce the one sentence the viewer should remember.

### 5.2 Narration-to-animation synchronization

Narration WAV duration is the documented timing source. Continue measuring WAV duration and deriving frame counts from it, but add explicit beat markers to storyboards. Each beat should define:

- Start and end time.
- Spoken phrase or sentence.
- Visual subject.
- Character action.
- Prop state before and after.
- Camera framing.
- Essential on-screen label, if any.
- Foley event and timestamp.
- Transition to the next beat.

Do not trigger a new animation for every spoken word. Animate meaningful phrases and causal changes.

### 5.3 Text and equations

- Avoid paragraphs on screen.
- Use short labels and key values.
- Reveal equations in steps: inputs, operation, result.
- Keep text away from the main action.
- Use consistent alignment, baseline, line spacing, and safe margins.
- Check readability at phone size.
- The supplied guide documents unsupported emoji/Unicode math limitations in the canvas renderer. Draw symbols with paths or use verified registered fonts.

### 5.4 Accessibility

Use readable synchronized captions, strong contrast, and do not communicate meaning by color alone. Give important visual changes enough dwell time. Avoid rapid flashing and startling effects. Explain specialist terms in plain language when first needed.

---

## 6. Architecture evolution: universal scene format + renderer adapters

This is the most important engineering upgrade. Current episode scripts are self-contained and working. Do not convert them all at once.

### 6.1 Target architecture

```text
Research + Script + Narration
            |
            v
     Storyboard / Scene JSON
            |
            v
       Scene Validator
            |
            v
     Renderer Dispatcher
       /     |      \
  Canvas   Manim   3D / AI Video
   Engine  Adapter   Adapters
       \     |      /
            v
     Common Media Outputs
            |
            v
   FFmpeg Post-Production
            |
            v
  Captions + Thumbnail + QA
            |
            v
    Human Approval Gate
            |
            v
      YouTube Publisher
```

### 6.2 Renderer responsibilities

| Renderer | Best use | Recommendation |
|---|---|---|
| Existing Node + `@napi-rs/canvas` | Magi, hand-drawn scenes, props, 2D explainers | Keep as primary renderer |
| Manim | Equations, vectors, coordinate systems, mathematical transformations | Add as specialist renderer |
| Three.js | Spatial 3D, camera movement, 3D objects/environments | Use selectively |
| Blender | High-end 3D assets, lighting, simulations, cinematic shots | Optional specialist pipeline |
| ComfyUI + licensed image/video models | Concept art, backgrounds, selected cinematic inserts | Add behind an asset-generation boundary and review gate |
| Remotion | Timelines, templates, data-driven layouts, captions, social packaging | Optional composition/export layer, not a replacement |

Do not install every renderer immediately. Add one only when it solves a concrete visual requirement and can output reliable compatible media.

### 6.3 Proposed scene JSON contract

This is a proposed schema, not an existing file. Begin with `schemaVersion: "1.0"`:

```json
{
  "schemaVersion": "1.0",
  "episodeId": "epNN-example",
  "sceneId": "scene-001",
  "title": "The first demonstration",
  "renderer": "canvas",
  "duration": 8.0,
  "fps": 30,
  "resolution": { "width": 1920, "height": 1080 },
  "narration": { "asset": "narration/act1.wav", "start": 0.0, "end": 8.0 },
  "camera": { "shot": "medium", "movement": "static" },
  "visual": {
    "metaphor": "A familiar physical demonstration",
    "background": "studio-paper",
    "characters": [{ "id": "magi", "action": "inspect", "target": "main-prop", "expression": "curious" }],
    "props": [{ "id": "main-prop", "type": "custom", "state": "closed" }]
  },
  "beats": [
    { "at": 0.0, "action": "establish", "description": "Show the prop and Magi" },
    { "at": 2.0, "action": "reveal", "description": "Open the prop" }
  ],
  "labels": [],
  "audio": [{ "asset": "sfx/soft-whoosh.wav", "at": 2.0, "gain": 0.25 }],
  "transitionOut": { "type": "match-cut", "duration": 0.35 }
}
```

### 6.4 Schema rules

- Validate required fields before rendering.
- Reject negative durations, invalid frame rates, missing assets, unknown renderers, and out-of-range timestamps.
- Use stable IDs for scenes, characters, props, and audio events.
- Use seconds as the canonical timeline unit; convert to frames in one shared utility.
- Put renderer-specific options in a namespace such as `rendererOptions`.
- Keep paths relative to the episode root; resolve and validate safely.
- Version the schema and write migrations when it changes.
- Keep legacy render scripts operational until each episode is deliberately migrated.

### 6.5 Migration sequence

1. Add schema and validator without changing existing rendering.
2. Create one new 10–15 second schema-driven scene using Canvas.
3. Compare it with a hand-authored scene for timing, quality, and maintainability.
4. Add a Manim adapter for one math-heavy scene.
5. Add a 3D adapter only if a real episode needs it.
6. Add AI-generated assets only after style and licensing controls exist.
7. Migrate one episode at a time, never in a bulk rewrite.

---

## 7. Tooling and installation strategy

### 7.1 Install only when needed

| Tool | Purpose | Priority |
|---|---|---|
| Node.js / npm | Existing production engine | Existing; verify version |
| FFmpeg / ffprobe | Encoding, muxing, probing, audio | Required |
| Python virtual environment | Isolate specialist tools | Required for Python additions |
| Manim | Mathematical animation | Phase 2 |
| ComfyUI | Image/video generation workflows | Phase 3 |
| Blender | 3D creation/rendering | Optional, only if needed |
| Remotion | Template-based composition | Optional |
| Three.js | 3D scene rendering in JS | Optional |

### 7.2 Repository inspection before installation

Run from the repository root and save output in a dated audit note:

```bash
pwd
git status --short
git log --oneline -5
node --version
npm --version
ffmpeg -version
ffprobe -version
find . -maxdepth 3 -type f | sort
cat package.json
```

Also inspect `AGENTS.md`, both production guides, `projects/tools/stickman.mjs`, one known-good episode's render scripts, `.gitignore`, current skill symlinks, and relevant `SKILL.md` files. Do not overwrite or auto-format these before a clean Git checkpoint.

### 7.3 Python environment isolation

For specialist Python renderers, use a dedicated environment instead of changing system Python:

```bash
python3 -m venv .venv-video
source .venv-video/bin/activate
python -m pip install --upgrade pip
```

Windows PowerShell:

```powershell
py -3 -m venv .venv-video
.\.venv-video\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

Install only packages required by the selected adapter, pin versions, and record them in a dedicated requirements file. Do not mix ComfyUI and Manim environments unless compatibility is proven.

### 7.4 Models and assets

- Keep model weights out of Git.
- Store large checkpoints and generated media on a designated drive.
- Reference assets by configurable path, not machine-specific absolute paths.
- Record model name/version, license, source, generation settings, and checksum where practical.
- Check disk space before downloading large models.
- Do not download model weights automatically during setup.
- Review commercial-use restrictions for models, datasets, fonts, music, and third-party assets.

### 7.5 Reproducible environment manifest

Record Node/npm, `@napi-rs/canvas`, FFmpeg build, Python versions per environment, renderer versions, font files/licenses, AI model identifiers/licenses, output profile, and encoding settings. Verify versions rather than assuming they match another machine.

---

## 8. AI-assisted production: controlled use

### 8.1 Appropriate uses

Use generative tools for background plates, environment/prop concept exploration, selected cinematic inserts, textures/material references, storyboard thumbnails, ideation, and approved voice generation. Image-to-video should be used only when generated motion genuinely improves a scene.

### 8.2 Do not delegate blindly

Do not rely on generative video for Magi's defining identity, exact equations/labels, important technical diagrams, exact causal sequences, object continuity, or factual visualizations that could misrepresent a mechanism. Use deterministic Canvas, Manim, or 3D rendering for exact elements.

### 8.3 Character consistency pack

Maintain approved front, side, and three-quarter views of Magi; neutral, curious, surprised, confused, focused, and happy expressions; scarf/hat references; line weight, palette, proportions, props, and environment style. Check generated assets against this pack. Generated variants must not silently redefine the mascot.

### 8.4 Generated asset metadata

Record prompt, negative prompt if used, model/version, seed if available, dimensions/frame rate, input references, license review, human approval, episode ID, and scene ID.

---

## 9. Sound design standard

Sound is part of the animation, not an afterthought. Preserve the frame-aligned procedural Foley system.

Every event needs a visible cause, timestamp, suitable duration/envelope, controlled gain, mix priority relative to narration, and a clean fade or decay.

Build a restrained library:
- UI/information: subtle clicks, ticks, soft chimes.
- Physical interaction: taps, grabs, paper, wood, metal.
- Motion: short whooshes, swishes, cloth movement.
- Reveals: warm chime or controlled impact.
- Environment: quiet ambience that does not mask narration.

Do not use a loud whoosh for every transition. Check for clipping/crackling, sudden loudness jumps, narration intelligibility, Foley sync, truncated tails, distracting stereo placement, and mono compatibility. Listen on headphones and laptop speakers.

---

## 10. Typography, captions, and layout

### 10.1 Typography

Continue with `CaveatHand` for personality and `NotoSans` for structured information. Register fonts explicitly in the canvas runtime. Use a consistent scale for episode/scene title, main concept label, secondary value/annotation, and rare technical footnote. Pixel sizes must be tested at delivery resolution and phone playback size.

### 10.2 Captions

- Prefer short phrase groups and 1–2 lines.
- Use a consistent bottom safe area.
- Do not cover faces, props, equations, or important action.
- Maintain contrast, punctuation, and accurate timing.
- Validate SRT timestamps against the final assembled video, not only source narration WAVs.

### 10.3 Safe areas

Design for desktop and mobile. Keep essential information away from edges and platform UI overlays. Create separate landscape and vertical compositions when needed; do not blindly crop a 16:9 scene into 9:16 if the action becomes unreadable.

---

## 11. Quality assurance: technical + visual + educational

The current QA controller checks media integrity and key stream properties. Extend it to cover creative quality too.

### 11.1 Automated technical checks

Every final master must pass:
- File exists and is non-empty.
- Video/audio streams exist.
- Expected dimensions, frame rate, codec, and pixel format.
- Expected audio sample rate and channel layout.
- Duration within approved tolerance.
- No unexpected timestamp discontinuities.
- No black-frame run beyond configured threshold.
- No frozen-frame run beyond configured threshold, except intentional holds.
- No clipping; loudness and true peak measured.
- Subtitle exists and timestamps fit final runtime.
- Thumbnail exists at approved dimensions.
- Acts exist and are in intended order.
- Full-file decode succeeds.

Useful inspection commands:

```bash
# Stream/container report
ffprobe -v error -show_format -show_streams -of json input.mp4

# Full decode test
ffmpeg -v error -i input.mp4 -f null -

# Black-frame detection; inspect intentional dark scenes
ffmpeg -i input.mp4 -vf "blackdetect=d=2:pix_th=0.10" -an -f null -

# Freeze detection; inspect intentional holds
ffmpeg -i input.mp4 -vf "freezedetect=n=-50dB:d=2" -an -f null -

# Loudness measurement
ffmpeg -i input.mp4 -af loudnorm=I=-14:TP=-1:LRA=11:print_format=summary -f null -
```

Make thresholds configurable. Review false positives instead of treating every detector result as an automatic failure.

### 11.2 Human visual QA

- [ ] Opening hook is immediately understandable.
- [ ] Magi's proportions, scarf, hat, and identity remain consistent.
- [ ] Character motion is smooth with believable follow-through.
- [ ] Hands contact props correctly; feet do not visibly slide.
- [ ] Props do not teleport, flicker, or change shape unexpectedly.
- [ ] Camera movement supports the action.
- [ ] Transitions preserve spatial and narrative continuity.
- [ ] Text is legible on a phone.
- [ ] No clutter or accidental overlaps.
- [ ] Important concepts are visually demonstrated.
- [ ] Each scene has enough time to be understood.
- [ ] No accidental black frames, repeated frames, or rendering artifacts.
- [ ] Color and line weight remain consistent.
- [ ] Final frame and audio tail end cleanly.

### 11.3 Educational QA

- [ ] Analogy is familiar to a general audience.
- [ ] Analogy is technically fair and does not imply a false equivalence.
- [ ] Mechanism is shown step by step.
- [ ] New terminology is introduced only when needed.
- [ ] Narration and visual action explain the same thing at the same time.
- [ ] Viewer can state the main takeaway in one sentence.
- [ ] Claims are checked against reliable primary sources.
- [ ] Uncertainty and simplifications are acknowledged.

### 11.4 Approval gates

Use explicit statuses:

`DRAFT → SCRIPT_APPROVED → STORYBOARD_APPROVED → ASSETS_APPROVED → RENDERED → TECH_QA_PASS → CREATIVE_QA_PASS → HUMAN_APPROVED → READY_TO_PUBLISH → PUBLISHED`

No upload or scheduling step may bypass human approval. Preserve the existing manual publishing policy.

---

## 12. Episode and asset organization

Keep the existing episode-per-project structure unless repository inspection shows a compelling reason to change it. The following is a proposed extension, not an instruction to move existing files:

```text
projects/epNN-episode-name/
├── research/
├── script/
├── storyboard/
│   ├── scenes.json
│   └── storyboard-review.md
├── assets/
│   ├── generated/
│   ├── approved/
│   └── references/
├── renders_v2/
│   ├── narration/
│   ├── previews/
│   ├── acts/
│   └── final/
├── subtitles/
├── publishing/
├── qa/
│   ├── technical-report.json
│   ├── creative-review.md
│   └── report.md
└── project_manifest.json
```

Existing paths may be relied upon by scripts. Migrate only with verified path updates and regression tests. Suggested names: `epNN_sceneNN_description.ext`, `epNN_actNN_preview.mp4`, `epNN_actNN_master.mp4`, `epNN_final_master_1080p.mp4`, `epNN_thumbnail_v01.png`, `epNN_captions_en.srt`. Keep temporary frames, caches, and drafts out of production exports.

---

## 13. Skills to add — priority order

Create these only after checking whether equivalent skills already exist:

| Priority | Skill | Responsibility | Required output |
|---|---|---|---|
| P0 | `storyboard-architect` | Script/narration to scene beats and scene JSON | Validated storyboard |
| P0 | `youtube-scriptwriter` | Hook, clear explanations, narrative arc, accurate CTA | Research-linked script |
| P0 | `video-research-director` | Research and claim verification | Source ledger and fact-check |
| P1 | `voiceover-director` | Voice direction, pacing, pronunciation, retakes | Approved narration plan |
| P1 | `subtitle-generator` | Timed captions and SRT validation | Synced captions |
| P1 | `thumbnail-designer` | Mobile-first concept and variants | Approved thumbnail brief/assets |
| P1 | `youtube-publisher` | Metadata and upload preparation | Review-ready publishing package |
| P2 | `visual-continuity-supervisor` | Character, prop, color, camera continuity | Continuity report |
| P2 | `animation-quality-director` | Motion, staging, timing, polish | Prioritized animation review |
| P2 | `render-qa-engineer` | Automated technical/media QA | Machine-readable QA report |

Every skill should define purpose, trigger conditions, inputs/outputs, project rules, workflow, validation, repo-grounded examples, failure handling, and must not invent paths or commands.

---

## 14. Implementation roadmap

### Phase 0 — Protect the working studio

1. Inspect repository and Git status.
2. Confirm all 21 skills and symlinks.
3. Confirm Node, Canvas, FFmpeg, and Python versions.
4. Run a known-good render or short test.
5. Save baseline output metadata and a short reference clip.
6. Create a Git checkpoint.

**Exit condition:** Existing workflow still works and can be restored.

### Phase 1 — Premium 1080p foundation

1. Benchmark current renderer at 720p and 1080p.
2. Verify antialiasing, fonts, stroke widths, shadows, and text layout at 1080p.
3. Standardize 1080p/30 fps master profile.
4. Improve audio mix to clean stereo delivery where appropriate.
5. Add loudness, clipping, black-frame, freeze-frame, and decode checks.
6. Add human creative-review checklist.
7. Produce one 10–15 second quality benchmark scene and compare on mobile/desktop.

**Exit condition:** One short scene meets the visual, audio, and technical quality bar at 1080p.

### Phase 2 — Magi motion system

1. Add blink and idle cycles.
2. Add look-at targeting.
3. Add scarf follow-through.
4. Add reusable gestures and expressions.
5. Add foot planting and contact checks.
6. Add lip-sync after core motion is stable.
7. Build a reusable motion test reel.

**Exit condition:** Magi feels alive without distracting from the explanation.

### Phase 3 — Scene schema and validator

1. Introduce versioned scene JSON.
2. Validate schema and asset references.
3. Add Canvas renderer adapter.
4. Create one new scene using the adapter.
5. Keep old render scripts operational.
6. Add a migration guide.

**Exit condition:** A new scene can be authored declaratively and rendered by the current engine.

### Phase 4 — Specialist renderers

1. Add Manim for one math-heavy sequence.
2. Compare quality, render time, and editability.
3. Add Three.js or Blender only for a justified 3D requirement.
4. Add ComfyUI for controlled asset generation, not as the source of all visuals.
5. Define media contracts and color/frame-rate handling between renderers.

**Exit condition:** Each renderer demonstrably improves a real scene and integrates reliably.

### Phase 5 — Production automation

1. Add storyboard generation assistance.
2. Add a render queue only when volume justifies it.
3. Add preview rendering and caching.
4. Add automated thumbnail variants.
5. Add publishing-package validation.
6. Keep final upload behind manual approval.

**Exit condition:** Repetitive work is automated without reducing creative control.

---

## 15. First proof-of-quality project

Before changing a full episode, create one 10–15 second benchmark scene: Magi demonstrates a simple cause-and-effect mechanism using one physical prop.

It must include:
- Clear opening composition.
- Magi entering or reacting.
- One readable prop interaction.
- Anticipation, action, and follow-through.
- A camera move only if it helps.
- One or two frame-aligned Foley events.
- Short narration segment.
- One concise on-screen label at most.
- Clean transition or end pose.

Render a 1280×720 preview and a 1920×1080/30 fps final with 48 kHz audio. Review at full desktop size, phone size, with audio, muted, and frame-by-frame around contact/transitions. Do not proceed until this test is visibly better than the current baseline.

---

## 16. Operating rules for Antigravity / coding agents

### Before editing

- Read `AGENTS.md`, production guides, this blueprint, `package.json`, and relevant skills.
- Inspect actual source files before assuming exports or signatures.
- Check Git status; do not overwrite uncommitted work.
- Identify all importers before changing an interface.
- Record baseline commands and expected output.

### While editing

- Preserve `solve2BoneIK()` and its `[x, y]` contract unless a tested compatibility layer is added.
- Do not rename scripts or move assets without a migration plan.
- Do not replace Canvas with Remotion.
- Do not add dependencies unless needed.
- Do not download model weights during normal code setup.
- Never commit secrets, OAuth tokens, or client-secret files.
- Keep model files and large generated assets outside Git.
- Prefer small modules and testable adapters over a large rewrite.
- Make output paths configurable; avoid machine-specific absolute paths.
- Keep asset license records.

### After editing

- Run the smallest relevant test.
- Render a short preview.
- Run `ffprobe` and full decode validation.
- Inspect visual output, not just exit codes.
- Compare against baseline.
- Update docs and skill instructions.
- Report exactly what changed, what was tested, and what remains unverified.

### Forbidden shortcuts

- Do not claim a render is premium without reviewing the actual output.
- Do not treat 4K upscaling as a substitute for clean source assets.
- Do not use generated text for exact equations or labels.
- Do not auto-publish.
- Do not remove working functionality to simplify architecture.
- Do not claim a tool is installed until its executable/version is verified.

---

## 17. Definition of “premium”

| Area | Premium standard |
|---|---|
| Story | Strong hook, clear progression, satisfying payoff |
| Explanation | Each complex idea has an understandable visual demonstration |
| Character | Magi is consistent, expressive, purposeful |
| Animation | Smooth, intentional, well-timed, with follow-through |
| Composition | Clear focal point, balanced spacing, no clutter |
| Graphics | Crisp lines, clean shapes, consistent color and typography |
| Camera | Deliberate framing and motivated movement |
| Transitions | Smooth, meaningful, not overused |
| Audio | Clear narration, controlled Foley, balanced mix, no clipping |
| Captions | Accurate, synchronized, readable |
| Technical | Correct dimensions, frame rate, codecs, streams, full decode |
| Continuity | No unexplained changes in character, prop, camera, or scene state |
| Accuracy | Claims and visual models checked against reliable sources |
| Packaging | Strong thumbnail, title, description, chapters, metadata |
| Approval | Human has watched and approved the final export |

---

## 18. Immediate action checklist

- [ ] Read current `AGENTS.md` and production guides.
- [ ] Inspect actual repository tree and `package.json`.
- [ ] Verify all 21 documented skills and symlinks.
- [ ] Verify renderer and FFmpeg versions.
- [ ] Check Git status and create a safe checkpoint.
- [ ] Benchmark a 10–15 second scene at 1080p.
- [ ] Compare against current 720p baseline.
- [ ] Add technical QA without changing existing render flow.
- [ ] Add human visual/educational QA.
- [ ] Implement one Magi animation improvement at a time.
- [ ] Prototype scene JSON with current Canvas renderer.
- [ ] Add Manim when the first math-heavy scene is ready.
- [ ] Add AI video generation only for approved, appropriate shots.
- [ ] Keep publishing approval manual.

---

## 19. Source and confidence notes

Project-specific details in this blueprint are derived from the supplied **Programs Magic — AI Video Studio: Complete Production Guide**. Repository paths, script names, skill list, episode catalog, output settings, and known issues must be re-verified against the live repo before implementation.

Recommended quality targets, architecture evolution, renderer roles, QA additions, and roadmap are design recommendations—not claims that those upgrades are already installed. Any new path, schema, action name, skill, or command is a proposed design unless explicitly identified as existing project baseline.

**Keep this document updated after each major architecture change and production cycle.**
