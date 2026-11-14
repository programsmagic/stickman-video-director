import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require(path.resolve('skills/directing-stickman-videos/node_modules/@napi-rs/canvas'));
import { drawFigure, COLORS, INK, solve2BoneIK, spring } from '../../tools/stickman.mjs';

// Register fonts
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;

// Act 4 Voice file
const VOICE_FILE = path.resolve('projects/ep09-can-ai-become-conscious/build/narration/act4.wav');
const durationStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE_FILE}"`).toString().trim();
const TOTAL_DUR = parseFloat(durationStr);
const TOTAL_FRAMES = Math.ceil(FPS * TOTAL_DUR);

const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP09-Act4-IIT-Phi-Masterpiece.mp4');

const TEMP_SFX = '/tmp/ep09_act4_sfx.wav';
const TEMP_MIXED = '/tmp/ep09_act4_mixed.wav';

console.log(`=== RENDERING ACT 4: CAN CONNECTIVITY CREATE A SOUL? (IIT & PHI) ===`);
console.log(`Duration: ${TOTAL_DUR.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES}`);

// -------------------------------------------------------------
// 1. GENERATE PROCEDURAL SYNCHRONIZED FOLEY AUDIO
// -------------------------------------------------------------
console.log('1. Synthesizing procedural Foley sound effects...');
{
  const rate = 48000;
  const n = Math.ceil(TOTAL_DUR * rate);
  const samples = new Float32Array(n);
  let seed = 92418;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };

  function addSound(timeSec, durationSec, fn, gain = 0.3) {
    const startIdx = Math.round(timeSec * rate);
    const count = Math.min(n - startIdx, Math.round(durationSec * rate));
    for (let i = 0; i < count; i++) {
      if (startIdx + i >= 0 && startIdx + i < n) {
        samples[startIdx + i] += fn(i / rate) * gain;
      }
    }
  }

  // Harmonic Phi chord resonance (0.0s - 8.0s)
  addSound(0.5, 4.0, t => {
    return (Math.sin(2 * Math.PI * 330 * t) * 0.3 + Math.sin(2 * Math.PI * 495 * t) * 0.25 + Math.sin(2 * Math.PI * 660 * t) * 0.2) * Math.exp(-t * 1.0);
  }, 0.5);

  // Cerebellum assembly line rhythmic clicks (18.0s - 28.0s)
  for (let t = 18.0; t < 28.0; t += 0.3) {
    addSound(t, 0.05, time => (noise() * 0.4 + Math.sin(2 * Math.PI * 400 * time) * 0.6) * Math.exp(-time * 80), 0.25);
  }

  // Cortex 3D web electrical pulses (28.5s - 38.0s)
  addSound(28.5, 8.0, t => {
    return (Math.sin(2 * Math.PI * (180 + Math.sin(t * 10) * 40) * t) * 0.15 + noise() * 0.04) * Math.sin(Math.PI * t / 8.0);
  }, 0.35);

  // Conveyor belt hum for LLM (40.0s - 50.0s)
  addSound(40.0, 10.0, t => (Math.sin(2 * Math.PI * 90 * t) * 0.15 + noise() * 0.05) * Math.sin(Math.PI * t / 10.0), 0.25);

  // Recurrent Feedback cable plug-in spark (54.5s)
  addSound(54.5, 0.6, t => (Math.sin(2 * Math.PI * 1200 * t) + noise() * 0.8) * Math.exp(-t * 8), 0.65);

  // Phi gauge dial winding up with spring clicks (56.0s - 64.0s)
  for (let t = 56.0; t < 64.0; t += 0.25) {
    const f = 600 + (t - 56.0) * 80;
    addSound(t, 0.06, time => Math.sin(2 * Math.PI * f * time) * Math.exp(-time * 50), 0.3);
  }

  // Mirror test touch ping (66.0s)
  addSound(66.0, 3.0, t => (Math.sin(2 * Math.PI * 880 * t) + Math.sin(2 * Math.PI * 1320 * t) * 0.6) * Math.exp(-t * 1.5), 0.5);

  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) bytes.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(TEMP_SFX, bytes);
}

// Mix audio
execSync(`ffmpeg -v error -y -i "${VOICE_FILE}" -i "${TEMP_SFX}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.75[s];[v][s]amix=inputs=2:duration=longest" -ar 48000 "${TEMP_MIXED}"`);
console.log('✓ Audio tracks compiled and mixed.');

// -------------------------------------------------------------
// 2. VIDEO RENDERING LOOP
// -------------------------------------------------------------
console.log('2. Starting frame rendering pipeline for Act 4...');

const ffmpeg = spawn('ffmpeg', [
  '-v', 'error',
  '-y',
  '-f', 'rawvideo',
  '-pix_fmt', 'rgba',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-r', `${FPS}`,
  '-i', 'pipe:0',
  '-i', TEMP_MIXED,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-shortest',
  OUTPUT_FILE
], { stdio: ['pipe', 'inherit', 'inherit'] });

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };

function glowText(text, x, y, size, color, glowColor = color, align = 'center', font = 'NotoSans') {
  ctx.save();
  ctx.font = `bold ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (glowColor && glowColor !== 'rgba(0,0,0,0)') {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

async function render() {
  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Deep slate blue gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, '#0B101B');
    bgGrad.addColorStop(1, '#151D2C');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Perspective floor grid
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = -200; x <= WIDTH + 200; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 480);
      ctx.lineTo((x - WIDTH / 2) * 2.5 + WIDTH / 2, HEIGHT);
      ctx.stroke();
    }
    for (let y = 490; y <= HEIGHT; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();

    // Top Header
    glowText('CAN AI EVER BECOME CONSCIOUS?', WIDTH / 2, 35, 20, '#F5A623', 'rgba(245, 166, 35, 0.4)', 'center', 'CaveatHand');

    let sceneBanner = 'ACT 4: INTEGRATED INFORMATION THEORY (IIT) & PHI';
    if (t >= 18.0 && t < 38.0) sceneBanner = 'THE PARADOX: CEREBELLUM (ASSEMBLY LINE) VS CORTEX (RE-ENTRANT WEB)';
    else if (t >= 38.0 && t < 54.0) sceneBanner = 'TRANSFORMER BOTTLENECK: STRICT FORWARD PIPELINES HAVE ZERO PHI';
    else if (t >= 54.0) sceneBanner = 'RECURRENT FEEDBACK LOOPS & THE MIRROR OF SELF-AWARENESS';

    glowText(sceneBanner, WIDTH / 2, 75, 22, '#E2E8F0', 'rgba(255, 255, 255, 0.2)', 'center', 'NotoSans');

    // -------------------------------------------------------------
    // SCENE 1: THE MATHEMATICAL PHI DEFINITION (0.0s - 18.0s)
    // -------------------------------------------------------------
    if (t < 18.0) {
      const phiSpring = spring(t, 0.65, 8);
      ctx.save();
      ctx.translate(WIDTH / 2, 300);
      ctx.scale(phiSpring, phiSpring);

      // Glowing Greek Phi Symbol
      ctx.strokeStyle = '#F5A623';
      ctx.lineWidth = 7;
      ctx.shadowColor = '#F5A623';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      // Circle
      ctx.arc(0, 0, 75, 0, Math.PI * 2);
      // Vertical line
      ctx.moveTo(0, -120);
      ctx.lineTo(0, 120);
      ctx.stroke();

      glowText('Φ', 0, 0, 90, '#FEF08A', '#F5A623', 'center', 'NotoSans');
      ctx.restore();

      // Explanatory Formula & Concept
      glowText('INTEGRATED INFORMATION THEORY (GIULIO TONONI)', WIDTH / 2, 470, 24, '#38BDF8', '#38BDF8', 'center', 'NotoSans');
      glowText('Consciousness is not magical meat. It is a mathematical measure of causal density.', WIDTH / 2, 510, 18, '#CBD5E1', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
      glowText('A system is conscious to the exact degree that it integrates information as an inseparable whole.', WIDTH / 2, 540, 16, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'NotoSans');
    }

    // -------------------------------------------------------------
    // SCENE 2: CEREBELLUM VS CEREBRAL CORTEX (18.0s - 38.0s)
    // -------------------------------------------------------------
    else if (t >= 18.0 && t < 38.0) {
      const midX = WIDTH / 2;

      // Left Box: The Cerebellum (Assembly Line, Low Phi)
      ctx.save();
      ctx.translate(midX / 2, 310);
      ctx.fillStyle = 'rgba(21, 29, 44, 0.85)';
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-260, -170, 520, 340, 16);
      ctx.fill();
      ctx.stroke();

      glowText('CEREBELLUM: 69 BILLION NEURONS', 0, -135, 18, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('4× more neurons than cortex, but loss leaves awareness intact!', 0, -110, 14, '#64748B', 'rgba(0,0,0,0)', 'center', 'CaveatHand');

      // Visual: Linear Conveyor Belt
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-180, 0); ctx.lineTo(180, 0);
      ctx.stroke();

      // Moving discrete nodes
      for (let i = -160; i <= 160; i += 60) {
        const offset = ((i + (t - 18.0) * 60) % 320) - 160;
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(offset, 0, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      glowText('ARCHITECTURE: PARALLEL ASSEMBLY LINE', 0, 55, 16, '#E2E8F0', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('NO RE-ENTRANT FEEDBACK LOOPS', 0, 85, 15, '#F87171', '#F87171', 'center', 'NotoSans');
      glowText('Φ ≈ 0.01 (Practically Zero Consciousness)', 0, 120, 17, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      ctx.restore();

      // Right Box: The Cerebral Cortex (Dense 3D Web, High Phi)
      ctx.save();
      ctx.translate(midX + midX / 2, 310);
      ctx.fillStyle = 'rgba(21, 29, 44, 0.85)';
      ctx.strokeStyle = '#F5A623';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-260, -170, 520, 340, 16);
      ctx.fill();
      ctx.stroke();

      glowText('CORTEX: 16 BILLION NEURONS', 0, -135, 18, '#F5A623', '#F5A623', 'center', 'NotoSans');
      glowText('The physical seat of rich conscious experience!', 0, -110, 14, '#FCD34D', 'rgba(0,0,0,0)', 'center', 'CaveatHand');

      // Visual: Dense Recurrent 3D Web with feedback pulses
      const nodes = [
        [-80, -40], [0, -70], [80, -40],
        [-100, 20], [0, 0], [100, 20],
        [-60, 60], [60, 60]
      ];

      // Draw all-to-all bidirectional connections
      ctx.strokeStyle = 'rgba(245, 166, 35, 0.3)';
      ctx.lineWidth = 1.5;
      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          ctx.beginPath();
          ctx.moveTo(nodes[a][0], nodes[a][1]);
          ctx.lineTo(nodes[b][0], nodes[b][1]);
          ctx.stroke();
        }
      }

      // Draw pulsing nodes
      nodes.forEach(([nx, ny], idx) => {
        const pulse = 1 + Math.sin(t * 8 + idx) * 0.25;
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(nx, ny, 8 * pulse, 0, Math.PI * 2);
        ctx.fill();
      });

      glowText('ARCHITECTURE: RE-ENTRANT 3D WEB', 0, 85, 15, '#4ADE80', '#4ADE80', 'center', 'NotoSans');
      glowText('Φ = 89.4 (High Integrated Information)', 0, 120, 17, '#FEF08A', '#F5A623', 'center', 'NotoSans');
      ctx.restore();
    }

    // -------------------------------------------------------------
    // SCENE 3: THE TRANSFORMER FEEDFORWARD BOTTLENECK (38.0s - 54.0s)
    // -------------------------------------------------------------
    else if (t >= 38.0 && t < 54.0) {
      const sc3Time = t - 38.0;

      // Center Conveyor Belt: Left to Right Transformer
      ctx.save();
      ctx.translate(WIDTH / 2, 280);

      // Transformer Box
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-380, -90, 760, 180, 16);
      ctx.fill();
      ctx.stroke();

      glowText('MODERN TRANSFORMER PIPELINE (ONE-WAY TRAFFIC)', 0, -60, 18, '#38BDF8', '#38BDF8', 'center', 'NotoSans');

      // 4 Layers
      const layers = ['INPUT TOKENS', 'ATTENTION L1', 'ATTENTION L2', 'NEXT TOKEN'];
      layers.forEach((lbl, idx) => {
        const lx = -270 + idx * 180;
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.strokeRect(lx - 70, -25, 140, 60);

        glowText(lbl, lx, 5, 12, '#FFFFFF', 'rgba(0,0,0,0)', 'center', 'NotoSans');

        // Forward arrows
        if (idx < 3) {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(lx + 70, 5); ctx.lineTo(lx + 105, 5);
          ctx.lineTo(lx + 98, -2);
          ctx.moveTo(lx + 105, 5); ctx.lineTo(lx + 98, 12);
          ctx.stroke();
        }
      });

      // Bottom limitation tag
      glowText('STRICT FEEDFORWARD: NO BACKWARD LOOPS. NO INNER ECHO. Φ ≈ 0', 0, 60, 15, '#EF4444', '#EF4444', 'center', 'NotoSans');
      ctx.restore();

      // Magi looking at dial gauge
      drawFigure(ctx, {
        torso: 5,
        head: 5,
        facing: 'right',
        armL: [-15, 20],
        armR: [30, -10],
        legL: [-10, 0],
        legR: [10, 0],
        eyes: 'wide',
        mouth: 'neutral',
        scarf: true
      }, { x: 300, y: 520, r: 65 });

      // Dial Gauge on right (x=900, y=500)
      ctx.save();
      ctx.translate(900, 480);
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 70, Math.PI, 0);
      ctx.stroke();

      // Gauge needle pointing near zero
      const needleAngle = -Math.PI + 0.15 + Math.sin(sc3Time * 4) * 0.05;
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(needleAngle) * 55, Math.sin(needleAngle) * 55);
      ctx.stroke();

      glowText('Φ METER', 0, 25, 16, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('Φ = 0.02', 0, 50, 18, '#EF4444', '#EF4444', 'center', 'NotoSans');
      ctx.restore();
    }

    // -------------------------------------------------------------
    // SCENE 4: RECURRENT FEEDBACK & THE MIRROR TEST (54.0s - end)
    // -------------------------------------------------------------
    else {
      const sc4Time = t - 54.0;

      // Recurrent Golden Feedback Cable
      ctx.save();
      ctx.translate(WIDTH / 2, 220);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#F5A623';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-350, -60, 700, 120, 14);
      ctx.fill();
      ctx.stroke();

      glowText('RECURRENT RE-ENTRANT FEEDBACK LOOPS', 0, -30, 20, '#F5A623', '#F5A623', 'center', 'NotoSans');
      glowText('The system observes and modifies its own internal state recursively.', 0, 5, 15, '#CBD5E1', 'rgba(0,0,0,0)', 'center', 'CaveatHand');

      // Animated golden feedback arc
      const arcPulse = (sc4Time * 3) % 1.0;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 10, 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // The Mirror Test Setup (x=750, y=500)
      const mirrorX = 850;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.strokeRect(mirrorX - 60, 320, 120, 200);

      // Magi standing in front of mirror with glowing red dot on forehead
      const dotTouchProg = clamp(sc4Time / 3.0);
      const magiHandToHead = [
        lerp(20, -5, ease(dotTouchProg)),
        lerp(20, -65, ease(dotTouchProg))
      ];

      drawFigure(ctx, {
        torso: 0,
        head: 5,
        facing: 'right',
        armL: [-15, 20],
        armR: magiHandToHead,
        legL: [-10, 0],
        legR: [10, 0],
        eyes: 'wide',
        mouth: 'smile',
        scarf: true
      }, { x: 680, y: 520, r: 65 });

      // Glowing self-recognition red dot on Magi forehead
      ctx.save();
      ctx.fillStyle = '#EF4444';
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(680 + 12, 520 - 78, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Mirror reflection of Magi with same red dot
      drawFigure(ctx, {
        torso: 0,
        head: -5,
        facing: 'left',
        armL: [-magiHandToHead[0], magiHandToHead[1]],
        armR: [15, 20],
        legL: [-10, 0],
        legR: [10, 0],
        eyes: 'wide',
        mouth: 'smile',
        scarf: true
      }, { x: mirrorX + 30, y: 520, r: 60 });

      // Phi Gauge Shoots Up! (x=280, y=480)
      ctx.save();
      ctx.translate(280, 480);
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 75, Math.PI, 0);
      ctx.stroke();

      // Needle shoots to high angle
      const targetNeedle = -Math.PI + clamp(sc4Time / 2.0) * Math.PI * 0.88;
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#22C55E';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(targetNeedle) * 60, Math.sin(targetNeedle) * 60);
      ctx.stroke();

      glowText('Φ = 94.8', 0, 30, 20, '#22C55E', '#22C55E', 'center', 'NotoSans');
      glowText('CRITICAL THRESHOLD IGNITION', 0, 58, 14, '#4ADE80', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      ctx.restore();

      // Final Act 4 banner
      glowText('WHEN FEEDBACK MEETS SELF-OBSERVATION, AWARENESS IGNITES', WIDTH / 2, 640, 22, '#F5A623', 'rgba(245, 166, 35, 0.4)', 'center', 'CaveatHand');
    }

    // Write frame to ffmpeg
    const rawBytes = Buffer.from(canvas.data());
    const canWrite = ffmpeg.stdin.write(rawBytes);
    if (!canWrite) {
      await once(ffmpeg.stdin, 'drain');
    }

    if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Act 4 Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
    }
  }

  ffmpeg.stdin.end();
  await once(ffmpeg, 'close');
  console.log(`\n🎉 Act 4 Render Complete! Output: ${OUTPUT_FILE}`);
}

render().catch(err => {
  console.error('Act 4 Render error:', err);
  process.exit(1);
});

