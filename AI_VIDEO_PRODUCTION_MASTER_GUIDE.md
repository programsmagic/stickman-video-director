# AI Video Production Studio — Master Repository Guide

> **Purpose:** Turn an existing software repository into a modular, extensible AI video-production studio that can create stickman explainers, 2D cartoons, 3D animation, educational visualizations, motion graphics, cinematic AI footage, narrated tutorials, Shorts and long-form YouTube videos.
>
> **Prepared:** 14 November 2026  
> **Primary agent environment:** Google Antigravity  
> **Design principle:** Add capabilities incrementally. Do not replace the existing application, overwrite its dependencies, or download every large model automatically.

---

## 0. Read this before installing anything

This guide is a technical blueprint and installation runbook. It is intentionally broad, but **not every component should be installed into one Python or Node environment**. Video-generation projects have conflicting CUDA, PyTorch, Python, Node and native-library requirements.

### Non-negotiable installation rules

1. **Inspect the existing repository first.** Identify its framework, package manager, Python version, Node version, current ComfyUI location, GPU, disk space, environment files and existing scripts.
2. **Do not overwrite** `package.json`, lockfiles, `pyproject.toml`, `requirements.txt`, `.env`, existing Docker files, model directories or user data without a reviewed migration.
3. Use isolated environments:
   - Python: one virtual environment per engine or service.
   - Node: one package workspace or separate packages with pinned versions.
   - ComfyUI: keep its own supported Python/PyTorch environment.
   - Large AI models: store outside source control.
4. Pin versions after a successful test. Do not blindly upgrade PyTorch, CUDA, Node or Remotion across the project.
5. Do not download multi-gigabyte model weights until a model is selected and the target storage/GPU has been checked.
6. Treat third-party repositories, scripts, model files and workflow JSON as untrusted until reviewed.
7. Never put API keys, cloud credentials, YouTube tokens or stream keys in Git.
8. Every generator must expose a common interface and produce a standard scene artifact so the orchestration layer can swap engines.
9. Start with a 10–15 second proof of concept, then 60–90 seconds, then long-form.
10. Preserve license notices and verify the license of code, model weights, datasets, fonts, music, sound effects and voice assets separately.

### Recommended initial strategy

Build the **deterministic production foundation first**:

- Remotion for React-based video composition and automated rendering.
- Motion Canvas for precise vector motion graphics.
- Manim Community for mathematics, science and technical explanations.
- Stickman video projects for character-led explainer videos.
- FFmpeg for media processing.
- ComfyUI as an optional AI image/video generation service.
- Blender for 3D and advanced 2D/3D scenes.
- Local or cloud TTS/ASR as pluggable audio services.

Use generative video selectively for shots where it adds value. Use code-driven animation for text, charts, diagrams, UI demonstrations and scenes requiring exact timing.

---

# 1. Product vision and supported output

The studio should be able to create:

| Production type | Best-fit engines | Typical use |
|---|---|---|
| Stickman storytelling | Remotion + stickman-video engine | Business, finance, history, life lessons |
| 2D cartoon animation | OpenToonz, Synfig, Krita, Remotion | Character stories and educational cartoons |
| Mathematical/scientific explainers | Manim Community | Mathematics, physics, engineering |
| Vector motion graphics | Motion Canvas, Remotion, GSAP | Typography, charts, diagrams, transitions |
| 3D animation | Blender, Three.js | Product demos, science, environments |
| AI cinematic footage | ComfyUI + selected video models | Documentary inserts, atmosphere, visual metaphors |
| Talking-head/avatar | Dedicated avatar model/service adapter | Training and presenter videos |
| Screen/tutorial videos | Remotion + screen recordings + FFmpeg | Software tutorials and walkthroughs |
| YouTube Shorts | Remotion + FFmpeg | Vertical 9:16 short-form |
| Long-form YouTube | All engines through scene timeline | 5–30+ minute videos |

## Output profiles

Use explicit presets. Do not infer dimensions from aspect-ratio labels alone.

| Profile | Resolution | FPS | Notes |
|---|---:|---:|---|
| YouTube landscape | 1920×1080 | 30 | Default 16:9 |
| YouTube 4K | 3840×2160 | 30 | Use only if source assets justify it |
| Shorts/Reels | 1080×1920 | 30 | 9:16 |
| Square | 1080×1080 | 30 | 1:1 |
| Preview | 1280×720 | 24 or 30 | Faster review render |

Use constant frame rate for final delivery unless the delivery platform/workflow requires otherwise. Store FPS, dimensions, codec, audio sample rate and pixel format in the project manifest.

---

# 2. Recommended architecture

## 2.1 High-level architecture

```text
User / Creator
    |
    v
Studio UI (existing frontend; add modules, do not replace)
    |
    v
Project API / Orchestrator
    |
    +--> Research & Source Agent
    +--> Script & Narrative Agent
    +--> Storyboard / Shot Planner
    +--> Visual Style Director
    |
    v
Canonical Project Manifest + Scene Timeline
    |
    +--> Stickman / 2D renderer
    +--> Manim renderer
    +--> Motion Canvas renderer
    +--> Remotion renderer
    +--> Blender renderer
    +--> ComfyUI / video-model adapter
    |
    v
Audio pipeline (TTS, recorded voice, ASR, music, SFX)
    |
    v
Media conform / FFmpeg
    |
    v
Quality assurance (visual, audio, timing, captions, licenses)
    |
    v
Final MP4 + captions + thumbnail + metadata + project archive
```

## 2.2 Suggested technology stack

| Layer | Recommended technology | Role |
|---|---|---|
| Existing frontend | Keep current framework | Project dashboard and review |
| API | FastAPI (if Python backend is appropriate) | Orchestration API |
| Queue | Redis + Celery or RQ | Background render jobs |
| Database | Existing database; PostgreSQL if new | Projects, jobs, assets, versions |
| File storage | Existing storage / local SSD / S3-compatible | Source and rendered assets |
| Video composition | Remotion | React compositions and rendering |
| Vector animation | Motion Canvas | Timeline-driven vector scenes |
| Technical animation | Manim Community | Exact diagrams and mathematical scenes |
| 3D | Blender | 3D scenes and rendering |
| AI workflows | ComfyUI | Graph-based model inference |
| Media processing | FFmpeg / ffprobe | Encode, mux, inspect, transform |
| TTS | Kokoro, Piper or hosted provider adapter | Narration |
| ASR | faster-whisper / Whisper | Transcription and alignment |
| Testing | pytest, Vitest/Jest, Playwright where useful | Unit, integration and UI tests |

**Do not introduce a new database, queue or frontend framework if the existing repository already has a suitable equivalent.**

## 2.3 Service boundaries

Keep these as independent modules/processes:

- `api`: project and job API.
- `orchestrator`: workflow state machine and retries.
- `renderer-remotion`: Node-based rendering worker.
- `renderer-motion-canvas`: TypeScript animation worker.
- `renderer-manim`: Python animation worker.
- `renderer-blender`: Blender background worker.
- `comfyui-adapter`: client for a separately managed ComfyUI server.
- `audio-worker`: TTS, transcription and audio processing.
- `media-worker`: FFmpeg assembly and encoding.
- `qa-worker`: technical and perceptual checks.

The web/API process must not hold a request open while a long render runs. Submit a job, return a job ID, and report progress separately.

---

# 3. Repository and tool catalogue

The following is a curated shortlist. Verify the current default branch, release, installation notes and license before pinning or deploying. A GitHub repository license applies to its code; model weights may have a different license.

## 3.1 Stickman and script-to-video

### A. `nispa/stickman-video`
- Repository: https://github.com/nispa/stickman-video
- License stated by repository: MIT.
- Purpose: stick-figure explainer videos from a topic, script, SRT or YouTube link.
- Built on Remotion; includes character actions, props, title effects, sound cues, voiceover timing and render checks.
- Useful for: finance, business, education, history and faceless YouTube explainers.
- Requirements stated by project: Node.js LTS, Python 3.9+, `numpy`, `scipy`, `pillow`; optional `faster-whisper`, `youtube-transcript-api`, FFmpeg.
- Note: its README describes a Claude Code skill. Antigravity uses the open Agent Skills format; inspect and adapt its `SKILL.md` rather than assuming its original installation path works unchanged.
- Start: inspect repository and scripts first; do not install into the main application blindly.

### B. `kaomei/stickman-video-director`
- Repository: https://github.com/kaomei/stickman-video-director
- License stated by repository: MIT.
- Purpose: script-to-stickman video workflow for faceless channels, with styles, storyboard/visual generation, voiceover, captions and SFX automation.
- Inspect the `skills/`, `scripts/`, `tests/` and README files.
- Treat this as a candidate engine/skill to evaluate against `nispa/stickman-video`, not as a dependency that must be installed alongside it.
- Run its documented examples and compare render quality, maintainability and output control before choosing.

### Stickman selection criteria
- Can the character maintain consistent proportions and identity?
- Are actions, poses and props editable?
- Can scene timing be anchored to narration?
- Are there reusable action cycles and transition primitives?
- Can it render 16:9 and 9:16?
- Does it support transparent assets or compositing?
- Are the generated audio assets genuinely original/licensed?
- Can the output be inspected and deterministically re-rendered?

## 3.2 Educational animation and motion graphics

### A. Manim Community
- Repository: https://github.com/ManimCommunity/manim
- Documentation: https://docs.manim.community/
- Purpose: programmatic mathematical, scientific and technical animation.
- Best for: equations, graphs, vectors, geometry, algorithms, data structures and engineering explanations.
- Install package: `manim` in an isolated Python environment.
- Community edition is distinct from the original 3Blue1Brown `manim`/ManimGL project. Do not mix their instructions.

### B. Motion Canvas
- Repository: https://github.com/motion-canvas/motion-canvas
- Documentation: https://motioncanvas.io/
- Purpose: TypeScript generator-based animation library and editor for informative vector animations synchronized with voiceover.
- Best for: diagrams, charts, labels, animated explanations and timeline-driven graphics.
- Use a separate package/workspace; follow the current official project creation instructions.

### C. Remotion
- Repository: https://github.com/remotion-dev/remotion
- Documentation: https://www.remotion.dev/docs/
- Purpose: create videos with React components and render them programmatically.
- Best for: templated videos, captions, scenes, data-driven graphics, stickman composition and automated production.
- Current project creation guide: `npx create-video@latest`.
- Existing projects: use the official installation-in-existing-projects guide.
- Important: Remotion has a separate license model. Check https://www.remotion.dev/license before commercial deployment and keep all `remotion` and `@remotion/*` package versions aligned.

### D. Blender
- Repository: https://github.com/blender/blender
- Website: https://www.blender.org/
- Purpose: 3D modeling, rigging, animation, Grease Pencil 2D/3D drawing, simulation, compositing and rendering.
- Best for: 3D explainers, environments, product visualization, camera animation and advanced character scenes.
- Blender is GPL-licensed; review add-on and asset licenses independently.
- Prefer the official installer/build for normal use. Use background mode for render workers after a test scene works.

### E. OpenToonz
- Repository: https://github.com/opentoonz/opentoonz
- Purpose: traditional 2D animation production.
- Best for: frame-by-frame and cut-out animation pipelines.
- Use when a project needs a dedicated 2D animation editor rather than programmatic graphics.

### F. Synfig
- Repository: https://github.com/synfig/synfig
- Purpose: 2D vector animation and bone-based movement.
- Best for: reusable vector characters and motion.

### G. Krita
- Repository: https://github.com/KDE/krita
- Purpose: illustration, concept art, character sheets and frame-by-frame drawing.
- Best for: designing visual assets and hand-drawn frames.

### H. Three.js
- Repository: https://github.com/mrdoob/three.js
- Documentation: https://threejs.org/docs/
- Purpose: browser-based 3D graphics and interactive scenes.
- Best for: interactive 3D explainers and lightweight WebGL visualizations.
- Use only when a browser-rendered 3D scene adds value; do not use it as a replacement for Blender in every 3D workflow.

### I. GSAP
- Repository: https://github.com/greensock/GSAP
- Website: https://gsap.com/
- Purpose: timeline and interface animation.
- Best for: typography, transitions and web-based motion graphics.
- Verify the current license/terms for the version and plugins being used.

## 3.3 AI video generation models

### A. Wan family
- Official repository: https://github.com/Wan-Video/Wan2.2
- Use: text-to-video, image-to-video and cinematic generative footage.
- Integrations: ComfyUI and other supported inference stacks.
- Treat model size, quantization, resolution, frame count and VRAM as a combined planning problem.
- Do not assume a large model will fit a 12GB GPU without quantization/offloading or a compatible optimized workflow.

### B. LTX family
- Current development repository/model family: https://github.com/Lightricks/LTX-2
- Legacy LTX-Video repository: https://github.com/Lightricks/LTX-Video
- Documentation: https://docs.ltx.io/
- The legacy LTX-Video repository indicates that newer LTX-2.x development has moved to the LTX-2 repository. Do not start a new integration against the legacy repo without a reason.
- Use: video generation, keyframe/control workflows and synchronized audio/video capabilities where supported by the selected model release.
- Check the model-weight license separately from the code license.

### C. HunyuanVideo
- Repository: https://github.com/Tencent-Hunyuan/HunyuanVideo
- Use: high-quality video generation research and inference.
- The original repository documents very high VRAM requirements for its large model configurations (for example, tens of GB of GPU memory). It is not a realistic default local target for a 12GB GPU.
- Investigate newer variants and official release repositories before choosing an implementation.
- Prefer cloud GPU or optimized/quantized workflows when required.

### D. CogVideo
- Repository: https://github.com/THUDM/CogVideo
- Use: research and experimentation with video diffusion models.
- Verify current model support, requirements and license before adopting.

### E. Mochi
- Repository: https://github.com/genmoai/models
- Use: open video-generation research.
- Verify maintenance state, model requirements and license before integrating.

### F. SkyReels
- Repository: https://github.com/SkyworkAI/SkyReels-V2
- Use: long-video generation research and related workflows.
- Verify current releases and hardware requirements before adoption.

### Model adoption policy
Do not install every model. Maintain a model registry with:
- model ID and release/tag;
- source repository and official model card;
- model-weight license;
- supported task (T2V, I2V, V2V, audio/video);
- minimum and recommended VRAM;
- Python/PyTorch/CUDA compatibility;
- supported resolution, FPS and frame count;
- quantization/offload options;
- ComfyUI workflow compatibility;
- test prompt and expected output;
- known limitations and last verification date.

## 3.4 ComfyUI and video workflow ecosystem

### A. ComfyUI
- Repository: https://github.com/Comfy-Org/ComfyUI
- Documentation: https://docs.comfy.org/
- Desktop: https://www.comfy.org/download
- Purpose: graph-based AI inference and workflow orchestration.
- Recommended for: image generation, video generation, conditioning, upscaling and model experiments.
- Windows/NVIDIA: official desktop app or official portable package are the simplest starting points. Check the current official README for supported Python/PyTorch/CUDA versions. Do not reuse an unrelated Python environment.
- API: use its documented prompt/workflow API and monitor queue/history/output endpoints. Keep workflow JSON versioned in this repository.

### B. Video Helper Suite
- Repository: https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite
- Purpose: load video, inspect frames/audio, combine frames and export video from ComfyUI workflows.
- Install only into the ComfyUI custom-nodes directory and its Python environment.

### C. Wan Video Wrapper
- Repository: https://github.com/kijai/ComfyUI-WanVideoWrapper
- Purpose: Wan model workflows and nodes for ComfyUI.
- Pin a tested commit; custom nodes can change quickly and may have strict dependency requirements.

### D. ComfyUI Manager
- Repository: https://github.com/Comfy-Org/ComfyUI-Manager
- Purpose: discover/install/manage custom nodes and workflows.
- Treat third-party nodes as executable code. Review repository ownership, dependencies and install scripts.

### E. DiffSynth-Studio
- Repository: https://github.com/modelscope/DiffSynth-Studio
- Purpose: model training/inference workflows for diffusion models, including supported video workflows.
- Candidate for advanced research; not required for the first prototype.

### ComfyUI operating rule
Run ComfyUI as a separate service. The main application calls it through a thin adapter. Do not import ComfyUI's internal Python modules directly into the main API unless there is a compelling, tested reason.

## 3.5 Audio, narration, transcription and sound

### A. Kokoro
- Repository: https://github.com/hexgrad/kokoro
- Purpose: lightweight open-weight text-to-speech model.
- Use: narration and voiceover experiments.
- Check voice/model license and language coverage before commercial use.

### B. Piper
- Repository: https://github.com/rhasspy/piper
- Purpose: local neural TTS.
- Use: offline narration and low-latency local voice generation.
- Check the current maintained repository/fork and individual voice model licenses.

### C. Coqui TTS
- Repository: https://github.com/coqui-ai/TTS
- Purpose: TTS research and voice-generation toolkit.
- Check maintenance status and model/voice licenses before adoption.

### D. Whisper
- Repository: https://github.com/openai/whisper
- Purpose: speech recognition and transcription.

### E. faster-whisper
- Repository: https://github.com/SYSTRAN/faster-whisper
- Purpose: optimized Whisper inference.
- Use: voiceover transcription, subtitle generation and word/segment timing.

### F. Demucs
- Repository: https://github.com/facebookresearch/demucs
- Purpose: music/vocal source separation.
- Use only where separation is lawful and the source audio is authorized.

### G. FFmpeg
- Website: https://ffmpeg.org/
- Downloads: https://ffmpeg.org/download.html
- Purpose: media probing, transcoding, scaling, frame-rate conversion, audio mixing, subtitles, concat and final encoding.
- Use `ffprobe` for all media metadata checks.
- FFmpeg build configuration and codec choices can affect licensing obligations. Use a trusted build and review the relevant license.

### Audio workflow
1. Generate or record narration.
2. Transcribe narration to timestamped segments.
3. Review pronunciation and names.
4. Build the scene timeline from narration segments.
5. Generate or select licensed music and SFX.
6. Mix voice, music and effects with ducking.
7. Check clipping, loudness, silence and sync.
8. Export a final audio master and mux it with video.

Do not clone a real person's voice without permission. Do not use copyrighted music or sound effects without rights.

## 3.6 Video editing and media utilities

| Tool | Repository / website | Use |
|---|---|---|
| FFmpeg | https://ffmpeg.org/ | Encoding, filters, audio/video mux |
| MoviePy | https://github.com/Zulko/moviepy | Python-based editing and composition |
| OpenTimelineIO | https://github.com/AcademySoftwareFoundation/OpenTimelineIO | Editorial timeline interchange |
| Blender VSE | https://www.blender.org/ | Video sequence editing and compositing |
| DaVinci Resolve | https://www.blackmagicdesign.com/products/davinciresolve | Professional finishing; proprietary, free and paid editions |

Prefer FFmpeg for deterministic media operations and Remotion/Motion Canvas for programmatic scenes. Use a full nonlinear editor for human finishing when needed.

---

# 4. Antigravity agent skills

Google Antigravity's current skill convention uses directory bundles with a required `SKILL.md` file and optional scripts/references/examples. The default workspace path is:

```text
.agents/skills/<skill-name>/SKILL.md
```

Antigravity also supports global skills under the user's Gemini configuration directory. Confirm the current official documentation for the Antigravity app/CLI surface in use:

- https://antigravity.google/docs/skills
- https://agentskills.io/

## 4.1 Skill design principles

- One skill = one well-defined responsibility.
- The YAML frontmatter must contain a clear `description`.
- Keep instructions concise and move large reference material into `references/`.
- Scripts should have `--help`, validation, clear errors and safe defaults.
- Skills must not silently delete or overwrite files.
- Require human approval before external publishing, paid API calls, cloud GPU launches or destructive operations.
- Skills should return structured artifacts, not only prose.
- Each skill must describe inputs, outputs, dependencies, failure handling and acceptance criteria.

## 4.2 Recommended skill catalogue

Create these workspace skills:

| Skill directory | Responsibility |
|---|---|
| `video-research-director` | Research topic, source facts and source citations |
| `youtube-scriptwriter` | Hook, narrative, chapters, CTA and narration |
| `storyboard-architect` | Convert script into timed scenes and shot plans |
| `visual-style-director` | Choose animation style and visual language |
| `stickman-animation` | Stickman poses, actions, props and scene recipes |
| `manim-explainer` | Scientific/math/technical animation |
| `motion-graphics` | Typography, diagrams, charts and transitions |
| `remotion-video` | React-based composition and render |
| `blender-scene-builder` | 3D scene and camera animation |
| `comfyui-video-generator` | Select and execute ComfyUI workflows |
| `character-consistency` | Character references and continuity |
| `voiceover-director` | TTS, voice recording and narration timing |
| `subtitle-generator` | ASR, subtitle cleanup and SRT/VTT |
| `sound-design` | Music, ambience, SFX and mixing |
| `video-editor` | Scene assembly, transitions and final encode |
| `thumbnail-designer` | Thumbnail brief and image asset generation |
| `youtube-publisher` | Metadata, chapters and upload preparation |
| `video-quality-controller` | Visual/audio/technical QA |
| `model-registry-manager` | Model metadata, license and hardware compatibility |
| `render-operations` | Job queue, retries, logs and resource management |

## 4.3 Skill directory template

```text
.agents/
└── skills/
    ├── video-research-director/
    │   ├── SKILL.md
    │   ├── references/
    │   ├── examples/
    │   └── scripts/
    ├── storyboard-architect/
    │   ├── SKILL.md
    │   ├── references/
    │   ├── examples/
    │   └── scripts/
    ├── comfyui-video-generator/
    │   ├── SKILL.md
    │   ├── references/
    │   ├── examples/
    │   └── scripts/
    └── video-quality-controller/
        ├── SKILL.md
        ├── references/
        ├── examples/
        └── scripts/
```

## 4.4 Example complete skill: storyboard architect

Save as `.agents/skills/storyboard-architect/SKILL.md`:

```markdown
---
name: storyboard-architect
description: Converts an approved video script into a production-ready storyboard with timed scenes, narration anchors, visual directions, assets, camera instructions, animation engine selection and acceptance criteria.
---

# Storyboard Architect

## Objective
Create a structured, renderable storyboard. Do not return only a prose summary.

## Inputs
- Approved script and source references
- Target duration, aspect ratio, resolution and FPS
- Target audience and visual style preferences
- Available animation engines and model registry
- Existing character and brand assets

## Process
1. Read the entire approved script.
2. Split it into narrative beats and chapters.
3. Estimate scene durations from narration length and intended pauses.
4. Assign each scene a visual purpose.
5. Choose the simplest reliable engine:
   - Manim for mathematical/scientific precision.
   - Motion Canvas for vector explanations.
   - Remotion for text, charts, captions and compositing.
   - Stickman engine for character-led storytelling.
   - Blender for 3D.
   - ComfyUI for generative footage.
6. Define character references, props, background and camera.
7. Specify narration, on-screen text, SFX and transitions.
8. Add a fallback if an AI-generated scene fails.
9. Validate total duration, scene IDs and asset references.
10. Save storyboard JSON and a human-readable Markdown preview.

## Rules
- Every scene must advance the explanation.
- Never invent factual claims or statistics.
- Keep on-screen text short and readable.
- Avoid using AI-generated footage for text that must be exact.
- Preserve character identity across scenes.
- Record the source for factual visuals.
- Never publish automatically.

## Outputs
- `storyboard.json`
- `storyboard.md`
- `asset_manifest.json`
- `qa/storyboard_validation.json`

## Acceptance criteria
- All scene IDs are unique.
- All scenes have positive duration.
- Narration is assigned or explicitly marked as silent.
- Every scene has an engine and fallback.
- Scene durations sum to the target within an explicit tolerance.
- Aspect ratio and FPS are explicit.
```

## 4.5 Example complete skill: video quality controller

Save as `.agents/skills/video-quality-controller/SKILL.md`:

```markdown
---
name: video-quality-controller
description: Audits generated videos for resolution, frame rate, duration, audio sync, clipping, silence, missing frames, subtitle timing, black frames and scene continuity before delivery.
---

# Video Quality Controller

## Inputs
- Final MP4
- Project manifest
- Expected duration, FPS, dimensions and audio profile
- Subtitle file, if present
- Scene render report

## Checks
1. Probe media with ffprobe.
2. Verify codec, dimensions, FPS, duration and audio streams.
3. Decode the entire file to detect corrupt frames.
4. Detect unexpected black/frozen sections.
5. Check audio peak and clipping.
6. Check silence and voice/music balance.
7. Validate subtitle timestamps and file syntax.
8. Compare expected and actual duration.
9. Verify output filename and project ID.
10. Generate a QA report with pass/fail/warning.

## Safety
- Never delete the source render.
- Write reports to a new QA folder.
- Do not claim perceptual quality is guaranteed by metadata checks.
- Mark subjective review items for human approval.

## Outputs
- `qa/report.json`
- `qa/report.md`
- `qa/ffprobe.json`
- `qa/thumbnail-contact-sheet.jpg`

## Acceptance criteria
- All mandatory technical checks pass.
- Warnings are visible and actionable.
- Failed renders are not marked publish-ready.
```

## 4.6 Prompt to ask Antigravity to create all skills

After placing this guide in the repository, ask Antigravity:

> Read `AI_VIDEO_PRODUCTION_MASTER_GUIDE.md` completely. Inspect the existing repository before making changes. Implement the Antigravity skills listed in Section 4 under `.agents/skills/`. Use the provided complete skill examples as quality references. Each skill must have valid YAML frontmatter, clear trigger description, input/output contracts, step-by-step procedures, safety rules and acceptance criteria. Create supporting reference files and scripts only where they are genuinely needed. Do not install dependencies or download models yet. Do not overwrite existing files. Report every created file and any conflict.

---

# 5. Canonical project structure

Adapt this structure to the existing repository. It is a target architecture, not an instruction to move existing files immediately.

```text
existing-repository/
├── AI_VIDEO_PRODUCTION_MASTER_GUIDE.md
├── README.md
├── .agents/
│   └── skills/
│       ├── video-research-director/
│       ├── youtube-scriptwriter/
│       ├── storyboard-architect/
│       ├── visual-style-director/
│       ├── stickman-animation/
│       ├── manim-explainer/
│       ├── motion-graphics/
│       ├── remotion-video/
│       ├── blender-scene-builder/
│       ├── comfyui-video-generator/
│       ├── character-consistency/
│       ├── voiceover-director/
│       ├── subtitle-generator/
│       ├── sound-design/
│       ├── video-editor/
│       ├── thumbnail-designer/
│       ├── youtube-publisher/
│       ├── video-quality-controller/
│       ├── model-registry-manager/
│       └── render-operations/
├── apps/
│   └── studio-ui/                  # Existing frontend, if applicable
├── services/
│   ├── api/
│   ├── orchestrator/
│   ├── renderer-remotion/
│   ├── renderer-motion-canvas/
│   ├── renderer-manim/
│   ├── renderer-blender/
│   ├── comfyui-adapter/
│   ├── audio-worker/
│   ├── media-worker/
│   └── qa-worker/
├── packages/
│   ├── schemas/
│   ├── timeline/
│   ├── asset-manager/
│   ├── renderer-sdk/
│   └── shared-config/
├── workflows/
│   ├── comfyui/
│   ├── remotion/
│   ├── manim/
│   ├── motion-canvas/
│   └── blender/
├── models/
│   ├── registry.yaml
│   └── README.md                   # Weights stored outside Git
├── assets/
│   ├── characters/
│   ├── backgrounds/
│   ├── fonts/
│   ├── music/
│   ├── sound-effects/
│   └── brand/
├── projects/
│   └── example-project/
│       ├── brief/
│       ├── research/
│       ├── script/
│       ├── storyboard/
│       ├── assets/
│       ├── scenes/
│       ├── audio/
│       ├── renders/
│       ├── qa/
│       └── final/
├── infra/
│   ├── docker/
│   ├── scripts/
│   └── monitoring/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
│   ├── architecture/
│   ├── operations/
│   └── licenses/
└── .gitignore
```

### Storage rules

- Do not commit model weights, raw footage, caches, temporary renders or generated videos.
- Store small test fixtures only when redistribution is permitted.
- Keep project assets in managed storage and record checksums.
- Add generated outputs to `.gitignore`, not source code.
- Keep model files on a separate SSD or model volume where possible.
- Keep an asset manifest recording source, author, license, attribution and checksum.

---

# 6. Canonical data contracts

All engines must consume and produce a shared format. This is the key to making the studio extensible.

## 6.1 Project manifest example

```json
{
  "schema_version": "1.0",
  "project_id": "ai-explained-001",
  "title": "How Artificial Intelligence Works",
  "language": "en",
  "target": {
    "platform": "youtube",
    "aspect_ratio": "16:9",
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "target_duration_seconds": 90
  },
  "style": {
    "mode": "mixed",
    "visual_theme": "clean-editorial",
    "character_pack": "default-stickman"
  },
  "audio": {
    "voice": "en-neutral-01",
    "sample_rate": 48000,
    "music_enabled": true,
    "captions": true
  },
  "engines": {
    "stickman": "remotion-stickman",
    "technical": "manim",
    "motion_graphics": "motion-canvas",
    "generative_video": "comfyui",
    "three_d": "blender"
  },
  "approval": {
    "research": "pending",
    "script": "pending",
    "storyboard": "pending",
    "final_video": "pending",
    "publish": "manual"
  }
}
```

## 6.2 Scene contract

```json
{
  "scene_id": "scene-001",
  "order": 1,
  "duration_seconds": 8.0,
  "narration": {
    "text": "Artificial intelligence learns patterns from data.",
    "start_seconds": 0.0,
    "end_seconds": 7.5
  },
  "visual": {
    "engine": "motion-canvas",
    "style": "minimal-vector",
    "description": "Show data points flowing into a simple neural network.",
    "reference_assets": [],
    "characters": [],
    "props": ["neural-network-diagram"]
  },
  "camera": {
    "movement": "slow-push-in",
    "framing": "wide"
  },
  "on_screen_text": [
    {
      "text": "LEARNING FROM DATA",
      "start_seconds": 1.0,
      "end_seconds": 5.5
    }
  ],
  "audio_cues": [
    {
      "type": "sfx",
      "asset": "soft-data-whoosh",
      "at_seconds": 2.0
    }
  ],
  "transition_out": "crossfade",
  "fallback": {
    "engine": "remotion",
    "description": "Render a static vector diagram with animated arrows."
  },
  "sources": [],
  "status": "planned"
}
```

## 6.3 Engine adapter interface

Every renderer should implement the equivalent of:

```python
from typing import Protocol, Any

class Renderer(Protocol):
    name: str

    def validate(self, scene: dict[str, Any]) -> list[str]:
        """Return validation errors; empty list means valid."""

    def estimate(self, scene: dict[str, Any]) -> dict[str, Any]:
        """Estimate render cost, time and resource requirements."""

    def render(self, scene: dict[str, Any], output_dir: str) -> dict[str, Any]:
        """Render the scene and return output asset metadata."""

    def healthcheck(self) -> dict[str, Any]:
        """Return availability, version and hardware information."""
```

Use an adapter registry so the orchestrator can select engines by scene type and capability. Never hard-code every engine call into the API route.

---

# 7. Installation and setup runbook

## 7.1 Phase 0 — inspect the existing repository

Run these commands from the repository root.

### Windows PowerShell

```powershell
Get-Location
git status --short
git branch --show-current
git log -1 --oneline
Get-ChildItem -Force

node --version
npm --version
python --version
py --list
git --version
ffmpeg -version
ffprobe -version
nvidia-smi
```

Some commands may not be installed; record that rather than attempting an immediate global install.

Inspect:
- `package.json` and its lockfile;
- Python project files and lockfiles;
- current frontend/backend architecture;
- existing ComfyUI installation and model paths;
- current GPU driver and VRAM;
- free disk space;
- environment variables and `.env.example` (never print secrets);
- existing build/test commands.

Create a baseline report before changing anything.

### macOS / Linux

```bash
pwd
git status --short
git branch --show-current
git log -1 --oneline
find . -maxdepth 2 -type f | sort | head -300

node --version
npm --version
python3 --version
git --version
ffmpeg -version
ffprobe -version
```

## 7.2 Phase 1 — install shared media tools

### Windows

Install FFmpeg from a trusted build linked by the official FFmpeg download page:
https://ffmpeg.org/download.html

Then verify:

```powershell
ffmpeg -version
ffprobe -version
```

Install Git and a supported Node.js LTS release if missing. Do not change an existing Node version without checking the repository's engines and lockfile.

### macOS

```bash
brew install ffmpeg git
```

Install Node using the existing project's preferred version manager and `.nvmrc`/`.node-version` if present.

### Ubuntu

```bash
sudo apt update
sudo apt install -y git ffmpeg
```

## 7.3 Phase 2 — create isolated Python environments

Use `uv` or Python `venv`. Do not install all video libraries into the system Python.

Example for a Manim worker:

```bash
# From the repository root
python -m venv .venv-manim

# Windows PowerShell
.venv-manim\Scripts\Activate.ps1

# macOS/Linux
source .venv-manim/bin/activate

python -m pip install --upgrade pip
python -m pip install manim
manim --version
```

If PowerShell blocks activation, use the environment's interpreter directly:

```powershell
.\.venv-manim\Scripts\python.exe -m pip install manim
```

For production, record exact package versions in a lockfile after a successful build. Manim may require native dependencies; follow its official platform-specific installation documentation.

## 7.4 Phase 3 — create a Remotion project

If the existing repository already has a compatible React/Node application, use Remotion's official instructions for installing into an existing project. Do not scaffold a second app unnecessarily.

For a separate renderer package:

```bash
npx create-video@latest
```

Select a suitable starter and install the dependencies. Then:

```bash
npm run dev
```

Check the official docs for rendering commands and agent skills:
- https://www.remotion.dev/docs/
- https://www.remotion.dev/docs/ai/skills

Keep `remotion` and all `@remotion/*` packages on the same exact version. Check commercial licensing before using Remotion in a commercial service.

## 7.5 Phase 4 — Motion Canvas

Follow the official starter instructions:
https://motioncanvas.io/

Keep Motion Canvas in its own Node workspace/package. Test:
- one animated title;
- one chart;
- one diagram;
- one voiceover-synchronized scene;
- export to a video format accepted by the media pipeline.

Do not clone the Motion Canvas monorepo unless developing the Motion Canvas tool itself. For normal production, create a project using its documented project generator.

## 7.6 Phase 5 — ComfyUI

For Windows with NVIDIA:
- Prefer the official ComfyUI desktop app for the initial setup.
- The official Windows portable build is another option.
- Follow the current official README for the correct CUDA/PyTorch/Python build.
- Start with a small image workflow before attempting video models.
- Keep ComfyUI and custom-node dependencies isolated.

Official resources:
- https://github.com/Comfy-Org/ComfyUI
- https://docs.comfy.org/
- https://www.comfy.org/download

For a manual installation, follow the official repository instructions rather than copying a PyTorch command from an old tutorial. CUDA/PyTorch requirements change over time.

### Custom nodes to evaluate

Install one at a time, with a restart and smoke test after each:

```text
ComfyUI-Manager
ComfyUI-VideoHelperSuite
ComfyUI-WanVideoWrapper
```

Repositories:
- https://github.com/Comfy-Org/ComfyUI-Manager
- https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite
- https://github.com/kijai/ComfyUI-WanVideoWrapper

Do not install every node pack. Each custom node is executable code and can introduce dependency conflicts.

### ComfyUI API integration

Use the documented API and queue workflow:
1. Save a known-good workflow JSON.
2. Replace only explicitly defined input nodes/values.
3. Submit the workflow to the ComfyUI server.
4. Store the returned prompt/job ID.
5. Poll or subscribe to job progress.
6. Retrieve outputs and metadata.
7. Copy/link outputs into the project asset store.
8. Run QA.

Never assume a workflow JSON from an old version remains compatible with the current custom nodes.

## 7.7 Phase 6 — Manim

Official docs:
- https://docs.manim.community/
- https://github.com/ManimCommunity/manim

After installing in its isolated environment, create a minimal test scene:

```python
from manim import *

class FirstScene(Scene):
    def construct(self):
        title = Text("AI Video Studio")
        circle = Circle()
        self.play(Write(title))
        self.play(title.animate.to_edge(UP))
        self.play(Create(circle))
        self.wait(1)
```

Run:

```bash
manim -pql first_scene.py FirstScene
```

Use the appropriate output quality/profile for previews and final renders. Add LaTeX only when mathematical typesetting is needed.

## 7.8 Phase 7 — Blender

Install Blender from:
https://www.blender.org/download/

Verify:
- Blender launches;
- a test scene renders;
- background rendering works;
- the renderer can locate fonts and textures;
- the render output can be consumed by FFmpeg.

Example background render:

```bash
blender -b example.blend -o //renders/frame_ -F PNG -f 1
```

For animation ranges, use `-a` after setting the scene's frame range. Validate the command against the installed Blender version.

## 7.9 Phase 8 — TTS and transcription

Install these into separate audio-worker environments and test model/voice licenses.

Example:

```bash
python -m venv .venv-audio
```

Then install only the selected TTS/ASR libraries using their official current instructions. Avoid installing multiple large speech stacks until a voice has been selected.

Initial candidates:
- Kokoro: https://github.com/hexgrad/kokoro
- Piper: https://github.com/rhasspy/piper
- Whisper: https://github.com/openai/whisper
- faster-whisper: https://github.com/SYSTRAN/faster-whisper

Test:
- English pronunciation;
- numbers, abbreviations and technical terms;
- narration duration;
- segment timestamps;
- audio sample rate;
- CPU/GPU compatibility;
- commercial use rights.

---

# 8. Hardware and model deployment strategy

## 8.1 Hardware-aware planning

The current known development target includes an NVIDIA RTX 5070-class GPU with 12GB VRAM. Confirm the exact device using `nvidia-smi`; never rely only on a remembered hardware specification.

A 12GB GPU is suitable for many development tasks, but large video diffusion models can exceed its memory capacity.

| Workload | 12GB-class GPU guidance |
|---|---|
| Remotion | Primarily CPU/browser rendering; GPU helps browser compositing |
| Manim | Mostly CPU/render pipeline; GPU use depends on scene and renderer |
| Stickman | Usually practical; rendering is largely deterministic graphics |
| FFmpeg | CPU encode is available; hardware codecs depend on driver/build |
| Blender | Good for moderate scenes; optimize textures, samples and scene complexity |
| Image diffusion | Depends on model, resolution, quantization and memory optimization |
| Large video diffusion | Often needs offloading, quantization, reduced settings or cloud GPU |
| Hunyuan large configuration | Not a default local workload; original repo documents 45–60GB+ VRAM configurations |

## 8.2 Model execution tiers

Implement three tiers:

- `local-light`: small models, CPU-friendly tasks, local animation and previews.
- `local-gpu`: supported local GPU models with strict VRAM checks.
- `cloud-gpu`: high-memory models and high-quality generation.

The router should inspect:
- available VRAM;
- system RAM;
- free disk;
- model requirements;
- resolution/frame count;
- estimated runtime;
- cloud budget/approval.

If the local model cannot fit, return a clear resource error and offer a cloud route. Do not silently switch to a paid endpoint.

## 8.3 Cloud GPU providers to evaluate

- RunPod: https://www.runpod.io/
- Vast.ai: https://vast.ai/
- Modal: https://modal.com/
- Replicate: https://replicate.com/

Build provider adapters. Keep credentials in a secret manager or environment variables. Require explicit approval before launching paid GPU instances. Implement shutdown/idle timeout and budget alerts.

---

# 9. End-to-end production workflow

## Stage 1 — brief and research
Inputs:
- topic;
- audience;
- target platform;
- target duration;
- language;
- factual accuracy requirements;
- style preferences;
- sources or references.

Outputs:
- `brief.json`;
- `research.md`;
- `sources.json`;
- fact-check checklist.

Rules:
- cite claims and distinguish fact from interpretation;
- do not invent data or citations;
- record source URLs and retrieval dates;
- identify copyright-sensitive source material.

## Stage 2 — script
Outputs:
- `script.md`;
- `narration.txt`;
- `chapters.json`;
- `script_approval.json`.

Script should include:
- first 5–15 second hook;
- clear explanation and logical progression;
- examples and analogies;
- transitions;
- recap;
- CTA only when appropriate.

## Stage 3 — storyboard
Outputs:
- `storyboard.json`;
- `storyboard.md`;
- `asset_manifest.json`;
- scene-level engine assignment.

Human review should happen before expensive generation.

## Stage 4 — asset generation
Create:
- character reference sheets;
- backgrounds;
- diagrams;
- icons;
- scene images;
- props;
- music and sound effects.

Record source/license/attribution for every external asset.

## Stage 5 — scene rendering
Render scenes independently. Use deterministic engines for exact text and diagrams. Use generative video only for visual material where nondeterminism is acceptable.

Every scene should output:
- video file or image sequence;
- audio if generated;
- scene metadata;
- engine/version;
- source workflow;
- generation settings;
- QA status.

## Stage 6 — voice and sound
Generate/record voiceover, transcribe it, align scene timings, add music and SFX, and mix audio.

## Stage 7 — assembly
Use FFmpeg or Remotion to:
- normalize frame size/FPS;
- conform scene clips;
- add transitions;
- combine voice/music/SFX;
- add captions;
- render the final master.

## Stage 8 — quality assurance
Run automated checks and human review. Do not mark a video publish-ready solely because FFmpeg exited successfully.

## Stage 9 — delivery
Deliver:
- final MP4;
- thumbnail;
- title and description;
- tags where useful;
- chapters;
- SRT/VTT captions;
- source/asset credits;
- project manifest;
- QA report.

Publishing should require a separate explicit approval.

---

# 10. Video quality assurance

## 10.1 Technical checks

Use `ffprobe` to inspect output:

```bash
ffprobe -v error \
  -show_entries format=duration,size,bit_rate \
  -show_entries stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels \
  -of json final.mp4
```

Check:
- correct dimensions and aspect ratio;
- expected frame rate;
- duration within tolerance;
- video and audio streams exist;
- audio sample rate/channels;
- file can decode from beginning to end;
- no unexpected black/frozen sections;
- no clipping or excessive silence;
- captions are valid and synchronized.

## 10.2 Example Python validation

```python
import json
import subprocess
from pathlib import Path

def probe_video(path: str) -> dict:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries",
            "format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
            "-of", "json", path,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)

def validate_video(path: str, width=1920, height=1080) -> list[str]:
    errors = []
    file_path = Path(path)

    if not file_path.exists():
        return [f"Missing file: {path}"]

    info = probe_video(str(file_path))
    streams = info.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)

    if video is None:
        errors.append("No video stream found.")
    else:
        if video.get("width") != width:
            errors.append(f"Expected width {width}, got {video.get('width')}.")
        if video.get("height") != height:
            errors.append(f"Expected height {height}, got {video.get('height')}.")

    if audio is None:
        errors.append("No audio stream found.")

    duration = float(info.get("format", {}).get("duration", 0))
    if duration <= 0:
        errors.append("Invalid or zero duration.")

    return errors

if __name__ == "__main__":
    issues = validate_video("final.mp4")
    print("\\n".join(issues) if issues else "Basic media validation passed.")
```

This is a basic metadata check, not a full perceptual QA system.

## 10.3 Human review checklist

- Does the opening communicate the topic immediately?
- Is narration clear and natural?
- Are visuals relevant to the spoken explanation?
- Is character identity consistent?
- Are diagrams correct?
- Is text legible on mobile?
- Are cuts and transitions intentional?
- Is the pacing appropriate?
- Are captions accurate?
- Are music and effects balanced?
- Are factual claims supported?
- Are assets licensed?
- Does the ending feel complete?

---

# 11. Model and asset registry

Create `models/registry.yaml` and keep model metadata here. Do not put actual weight files in Git.

Example:

```yaml
schema_version: "1.0"

models:
  - id: wan-video
    category: video-generation
    repository: https://github.com/Wan-Video/Wan2.2
    tasks: [text-to-video, image-to-video]
    execution: [local-gpu, cloud-gpu]
    enabled: false
    weights_downloaded: false
    license_review: pending
    tested: false
    notes: "Select a specific official checkpoint and workflow before enabling."

  - id: ltx
    category: video-generation
    repository: https://github.com/Lightricks/LTX-2
    tasks: [video-generation]
    execution: [local-gpu, cloud-gpu]
    enabled: false
    weights_downloaded: false
    license_review: pending
    tested: false
    notes: "Use current LTX-2.x documentation; legacy LTX-Video repo is not the primary new-project target."

  - id: manim-community
    category: animation
    repository: https://github.com/ManimCommunity/manim
    tasks: [technical-animation, mathematics, diagrams]
    execution: [local-cpu, local-gpu]
    enabled: true
    tested: false

  - id: remotion
    category: video-composition
    repository: https://github.com/remotion-dev/remotion
    tasks: [composition, captions, templates, rendering]
    execution: [local-cpu, cloud]
    enabled: true
    tested: false
    license_review: pending
```

Registry fields should include:
- exact model/repository revision;
- model-weight license URL;
- code license;
- source and download URL;
- file size/checksum;
- supported tasks;
- hardware requirements;
- tested environment;
- test result;
- enabled/disabled state.

---

# 12. Security, privacy and licensing

## Security

- Run model servers on localhost or a private network by default.
- Do not expose ComfyUI or worker ports publicly without authentication and network controls.
- Validate uploaded files and limit size/duration.
- Restrict FFmpeg input paths to approved project storage to reduce arbitrary-file access risks.
- Run third-party scripts in a sandbox/container where possible.
- Pin dependencies and scan for known vulnerabilities.
- Store secrets outside source control.
- Log job IDs and status, not secret values.
- Require approval before external publishing or paid inference.
- Do not execute workflow-supplied shell commands.

## Licensing

Review these separately:
1. Source-code license.
2. Model-weight license.
3. Training-data terms where relevant.
4. Voice model and individual voice license.
5. Font license.
6. Music and SFX license.
7. Stock footage/image license.
8. Third-party plugin/custom-node license.
9. Commercial SaaS/API terms.

A project described as open-source does not automatically make its model weights or generated assets unrestricted for commercial use. Keep a `docs/licenses/THIRD_PARTY_NOTICES.md` and an asset-level license manifest.

## Copyright and content integrity

- Do not copy another creator's video, script or distinctive character design.
- Use reference material to understand a style, not to reproduce protected assets.
- Cite source material when summarizing or adapting factual content.
- Use original or properly licensed music and sound effects.
- Obtain permission for voice cloning and likeness use.
- Keep a human approval gate for sensitive or factual documentary content.

---

# 13. Phased implementation plan

## Phase 0 — repository audit
Deliverables:
- current architecture report;
- dependency inventory;
- GPU/disk report;
- integration plan;
- no destructive changes.

## Phase 1 — deterministic video MVP
Install/test:
- FFmpeg;
- Remotion;
- one stickman workflow;
- Manim;
- basic TTS/recorded voice path.

Acceptance:
- create a 15-second 1080p MP4;
- captions and audio work;
- render is repeatable;
- QA report is generated.

## Phase 2 — modular animation
Add:
- Motion Canvas;
- scene contracts;
- engine adapter interface;
- asset registry;
- scene preview/contact sheet.

Acceptance:
- same storyboard can route different scenes to different engines.

## Phase 3 — ComfyUI integration
Add:
- ComfyUI adapter;
- one tested image workflow;
- one tested video workflow;
- queue/progress/output handling;
- VRAM and disk checks.

Acceptance:
- generative footage can be inserted into a deterministic timeline.

## Phase 4 — 3D and advanced video models
Add:
- Blender worker;
- selected Wan/LTX workflow;
- optional cloud GPU provider;
- model registry and license review.

Acceptance:
- local/cloud execution is explicit and cost-controlled.

## Phase 5 — complete studio
Add:
- dashboard;
- script/storyboard review;
- scene-level regeneration;
- render queue;
- final QA;
- export bundle and YouTube metadata.

Acceptance:
- produce a 3–5 minute explainer end-to-end with approval gates.

## Phase 6 — long-form production
Add:
- chapter-aware scene generation;
- character/asset continuity;
- batch rendering;
- recovery/retry;
- project templates;
- render monitoring and cost reports.

Acceptance:
- produce 8–15 minute content without one monolithic render job.

---

# 14. First proof-of-concept project

Use this topic:

**"How Artificial Intelligence Actually Works"**

Target:
- 60–90 seconds;
- 1920×1080;
- 30 FPS;
- English narration;
- clean, modern educational visual style.

Required scenes:
1. Opening hook with a stickman character.
2. Data entering a computer.
3. A simple neural-network diagram built with Manim or Motion Canvas.
4. A cinematic AI visual generated through ComfyUI (optional).
5. Animated labels and a short example.
6. Recap and ending.

Required outputs:
```text
projects/ai-explained-001/
├── brief.json
├── research.md
├── sources.json
├── script.md
├── narration.txt
├── storyboard.json
├── storyboard.md
├── asset_manifest.json
├── scenes/
├── audio/
├── renders/
├── final/
│   ├── video.mp4
│   ├── captions.srt
│   ├── thumbnail.png
│   └── youtube-metadata.md
└── qa/
    ├── report.json
    └── report.md
```

Do not begin with a 10-minute video. First prove that scene planning, voice timing, rendering and QA work end-to-end.

---

# 15. Repository installation checklist

Use this as a staged checklist. Do not mark an item complete until a test has passed.

## Audit
- [ ] Confirm repository root and current Git status.
- [ ] Inventory existing frontend/backend and package managers.
- [ ] Record Python, Node, FFmpeg and GPU versions.
- [ ] Check available disk and model storage.
- [ ] Identify existing ComfyUI installation and shared model paths.
- [ ] Create a backup/branch before structural changes.

## Core media
- [ ] Install/verify FFmpeg and ffprobe.
- [ ] Test one H.264 MP4 encode.
- [ ] Test audio muxing.
- [ ] Test subtitle burn-in or sidecar subtitle export.

## Animation
- [ ] Create a Remotion test composition.
- [ ] Render one 10-second video.
- [ ] Install Manim in isolated environment.
- [ ] Render one technical scene.
- [ ] Create one Motion Canvas test project.
- [ ] Test stickman-video.
- [ ] Evaluate stickman-video-director.
- [ ] Select one stickman engine for the first MVP.

## AI video
- [ ] Confirm ComfyUI version and Python environment.
- [ ] Confirm ComfyUI API is reachable locally.
- [ ] Test a small image workflow.
- [ ] Install VideoHelperSuite only if needed.
- [ ] Test one selected video model workflow.
- [ ] Record VRAM use and generation time.
- [ ] Review model-weight license.
- [ ] Decide local vs cloud execution.

## Audio
- [ ] Select one TTS engine.
- [ ] Generate a short narration sample.
- [ ] Transcribe the narration.
- [ ] Verify timestamps and pronunciation.
- [ ] Add licensed music/SFX.
- [ ] Test voice/music mixing.

## Orchestration and QA
- [ ] Define project and scene JSON schemas.
- [ ] Implement renderer adapter interface.
- [ ] Add job IDs and progress tracking.
- [ ] Add retries and timeouts.
- [ ] Add QA report generation.
- [ ] Add human approval gates.
- [ ] Produce the 60–90 second proof of concept.

## Release
- [ ] Check all licenses and attribution.
- [ ] Verify no secrets are committed.
- [ ] Verify model weights and generated media are ignored by Git.
- [ ] Document environment setup.
- [ ] Tag a known-good version.

---

# 16. Exact Antigravity implementation prompt

Copy the following prompt into Antigravity after adding this guide to the existing repository:

```text
You are the lead architect and implementation engineer for an AI Video Production Studio.

Read AI_VIDEO_PRODUCTION_MASTER_GUIDE.md completely.

IMPORTANT: This is an existing repository. Do not replace it with a new scaffold.

STEP 1 — AUDIT
- Inspect the complete repository structure.
- Read the existing README, package manifests, lockfiles, Python manifests, environment examples, Docker files and current scripts.
- Inspect installed tools and versions without exposing secrets.
- Check GPU, VRAM, available RAM and disk space.
- Identify existing ComfyUI and model directories.
- Run existing tests/build commands if safe.
- Produce docs/architecture/REPOSITORY_AUDIT.md.
- Do not modify application files during this step.

STEP 2 — DESIGN
- Map the guide's architecture to the existing repository.
- Reuse existing frameworks and services wherever possible.
- Identify conflicts, missing dependencies and optional components.
- Create a migration plan with file-by-file changes.
- Separate core requirements from optional AI model dependencies.
- Do not download model weights.
- Do not launch paid cloud services.

STEP 3 — SKILLS
- Create the Antigravity workspace skills under .agents/skills/.
- Follow the official SKILL.md YAML frontmatter format.
- Make every skill focused, actionable and testable.
- Add reference files and scripts only when needed.
- Include input/output contracts, safety rules and acceptance criteria.
- Reuse and adapt third-party skills only after reviewing their source and license.

STEP 4 — CORE FOUNDATION
- Implement the canonical project and scene schemas.
- Implement renderer adapter interfaces.
- Implement the project/job lifecycle.
- Implement local FFmpeg/ffprobe media inspection.
- Add structured logging and error handling.
- Add tests for all new functionality.
- Preserve existing functionality.

STEP 5 — FIRST RENDERER
- Integrate the simplest compatible deterministic renderer first.
- Prefer the existing project stack; use Remotion for React video composition if appropriate.
- Add one Manim worker only if its environment can be isolated cleanly.
- Do not install every model or custom node.

STEP 6 — COMFYUI
- Integrate ComfyUI through its HTTP/API boundary.
- Do not import ComfyUI internals into the main application.
- Add connection health checks, queue tracking, timeouts and output retrieval.
- Do not install custom nodes until their compatibility is verified.

STEP 7 — VALIDATION
- Build and test a 10–15 second sample video.
- Validate resolution, FPS, duration, video/audio streams and decoding.
- Produce a QA report.
- Report any manual steps that remain.

SAFETY AND CHANGE CONTROL
- Never overwrite existing files without showing the planned change.
- Never delete existing user data or model files.
- Never change existing package versions without a compatibility reason.
- Never commit secrets or large model weights.
- Require explicit approval for paid APIs, cloud GPU launches, publishing or destructive actions.
- If an installation fails, stop and diagnose instead of trying random dependency upgrades.

FINAL REPORT
List:
1. Existing architecture discovered.
2. Files created/modified.
3. Skills created.
4. Dependencies installed and exact versions.
5. Repositories integrated and pinned revisions.
6. Tests executed and results.
7. Sample video location.
8. GPU/disk usage.
9. License items needing review.
10. Remaining blockers and recommended next steps.
```

---

# 17. Official references and source links

Use official documentation and repository READMEs as the final authority for installation commands and compatibility. Repository branches evolve, so verify the latest release before pinning.

## Antigravity and agent skills
- Antigravity Agent Skills: https://antigravity.google/docs/skills
- Agent Skills open standard: https://agentskills.io/
- Antigravity Codelab: https://codelabs.developers.google.com/getting-started-with-antigravity-skills

## Animation and composition
- Manim Community: https://github.com/ManimCommunity/manim
- Manim installation: https://docs.manim.community/en/stable/installation.html
- Motion Canvas: https://github.com/motion-canvas/motion-canvas
- Motion Canvas docs: https://motioncanvas.io/
- Remotion: https://github.com/remotion-dev/remotion
- Remotion docs: https://www.remotion.dev/docs/
- Remotion license: https://www.remotion.dev/license
- Blender: https://github.com/blender/blender
- OpenToonz: https://github.com/opentoonz/opentoonz
- Synfig: https://github.com/synfig/synfig
- Krita: https://github.com/KDE/krita
- Three.js: https://github.com/mrdoob/three.js
- GSAP: https://gsap.com/

## Stickman
- Stickman Video: https://github.com/nispa/stickman-video
- Stickman Video Director: https://github.com/kaomei/stickman-video-director

## AI video and ComfyUI
- Wan 2.2: https://github.com/Wan-Video/Wan2.2
- LTX-2: https://github.com/Lightricks/LTX-2
- Legacy LTX-Video: https://github.com/Lightricks/LTX-Video
- HunyuanVideo: https://github.com/Tencent-Hunyuan/HunyuanVideo
- CogVideo: https://github.com/THUDM/CogVideo
- Mochi models: https://github.com/genmoai/models
- SkyReels V2: https://github.com/SkyworkAI/SkyReels-V2
- ComfyUI: https://github.com/Comfy-Org/ComfyUI
- ComfyUI docs: https://docs.comfy.org/
- Video Helper Suite: https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite
- Wan Video Wrapper: https://github.com/kijai/ComfyUI-WanVideoWrapper
- ComfyUI Manager: https://github.com/Comfy-Org/ComfyUI-Manager
- DiffSynth-Studio: https://github.com/modelscope/DiffSynth-Studio

## Audio and media
- Kokoro: https://github.com/hexgrad/kokoro
- Piper: https://github.com/rhasspy/piper
- Coqui TTS: https://github.com/coqui-ai/TTS
- Whisper: https://github.com/openai/whisper
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- Demucs: https://github.com/facebookresearch/demucs
- FFmpeg: https://ffmpeg.org/
- FFmpeg downloads: https://ffmpeg.org/download.html
- MoviePy: https://github.com/Zulko/moviepy
- OpenTimelineIO: https://github.com/AcademySoftwareFoundation/OpenTimelineIO

## Cloud GPU
- RunPod: https://www.runpod.io/
- Vast.ai: https://vast.ai/
- Modal: https://modal.com/
- Replicate: https://replicate.com/

---

# 18. Final engineering recommendation

Do not attempt to install the entire ecosystem in one command. Build a stable core and add engines as isolated capabilities.

**Recommended first production stack:**

1. Antigravity skills for planning and orchestration.
2. Remotion for composition and reusable YouTube video templates.
3. `nispa/stickman-video` and `kaomei/stickman-video-director` as competing stickman candidates; choose one after a render comparison.
4. Manim Community for precise educational visuals.
5. Motion Canvas for vector motion graphics.
6. ComfyUI for optional image/video generation.
7. Wan or current LTX model workflows after hardware and license validation.
8. Blender for 3D scenes.
9. Kokoro or Piper for narration, plus faster-whisper for transcription.
10. FFmpeg for final media assembly and technical validation.

The most important design decision is the **canonical storyboard and renderer adapter layer**. If those are implemented correctly, the studio can add new models, repositories, animation techniques and AI providers without redesigning the whole application.

**Definition of success:** one topic enters the studio, becomes a fact-checked script, a reviewed storyboard, a set of independently rendered scenes, synchronized narration, a quality-checked MP4 and a complete export package—with the creator retaining control over expensive generation and publishing.
