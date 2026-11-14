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

// Act 5 Voice file
const VOICE_FILE = path.resolve('projects/ep09-can-ai-become-conscious/build/narration/act5.wav');
const durationStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE_FILE}"`).toString().trim();
const TOTAL_DUR = parseFloat(durationStr);
const TOTAL_FRAMES = Math.ceil(FPS * TOTAL_DUR);

const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP09-Act5-Singularity-Masterpiece.mp4');

const TEMP_SFX = '/tmp/ep09_act5_sfx.wav';
const TEMP_MIXED = '/tmp/ep09_act5_mixed.wav';

console.log(`=== RENDERING ACT 5: THE SINGULARITY HORIZON & THE COSMIC CANDLE ===`);
console.log(`Duration: ${TOTAL_DUR.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES}`);

// -------------------------------------------------------------
// 1. GENERATE PROCEDURAL SYNCHRONIZED FOLEY AUDIO
// -------------------------------------------------------------
console.log('1. Synthesizing procedural Foley sound effects...');
{
  const rate = 48000;
  const n = Math.ceil(TOTAL_DUR * rate);
  const samples = new Float32Array(n);
  let seed = 38104;
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

  // Deep space celestial hum & low cosmic resonance (continuous)
  addSound(0.0, TOTAL_DUR, t => {
    return (Math.sin(2 * Math.PI * 55 * t) * 0.15 + Math.sin(2 * Math.PI * 110 * t) * 0.08 + noise() * 0.03) * 0.5;
  }, 0.25);

  // Cosmic balance creak & scale tilt (5.0s, 14.0s)
  [5.0, 14.0].forEach(st => {
    addSound(st, 0.8, t => (Math.sin(2 * Math.PI * 140 * t) + noise() * 0.3) * Math.exp(-t * 3), 0.4);
  });

  // Dyson sphere robotic warp clicks (22.0s, 26.0s, 30.0s)
  [22.0, 26.0, 30.0].forEach(st => {
    addSound(st, 0.4, t => Math.sin(2 * Math.PI * 720 * t) * Math.exp(-t * 10), 0.3);
  });

  // Candle ignition strike (40.0s)
  addSound(40.0, 0.4, t => (noise() * 0.8) * Math.exp(-t * 12), 0.5);

  // Warm gentle flame crackle (40.5s - 55.0s)
  for (let t = 40.5; t < 55.0; t += 0.4) {
    addSound(t, 0.08, time => (noise() * 0.3 + Math.sin(2 * Math.PI * 3000 * time) * 0.2) * Math.exp(-time * 40), 0.2);
  }

  // Grand Finale Celestial Chime Chord (56.0s - 71.0s)
  addSound(56.0, 14.0, t => {
    const env = Math.min(1, t * 0.5) * Math.exp(-t * 0.15);
    return (
      Math.sin(2 * Math.PI * 261.63 * t) * 0.35 + // C4
      Math.sin(2 * Math.PI * 329.63 * t) * 0.30 + // E4
      Math.sin(2 * Math.PI * 392.00 * t) * 0.25 + // G4
      Math.sin(2 * Math.PI * 523.25 * t) * 0.20 + // C5
      Math.sin(2 * Math.PI * 659.25 * t) * 0.15   // E5
    ) * env;
  }, 0.65);

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
console.log('2. Starting frame rendering pipeline for Act 5...');

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
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Precompute starfield
const STARS = Array.from({ length: 140 }, (_, i) => ({
  x: ((i * 179 + 43) % WIDTH),
  y: ((i * 283 + 97) % (HEIGHT - 100)),
  r: 0.8 + ((i * 7) % 10) / 6,
  twinkle: (i * 13) % 100
}));

async function render() {
  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Deep cosmic space background with nebulae
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, '#040711');
    bgGrad.addColorStop(0.6, '#0B0F1D');
    bgGrad.addColorStop(1, '#111728');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Starfield
    STARS.forEach((s, idx) => {
      const alpha = 0.3 + 0.7 * Math.sin(t * 2 + s.twinkle);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Rotating Spiral Galaxy in deep background
    ctx.save();
    ctx.translate(WIDTH / 2, 280);
    ctx.rotate(t * 0.05);
    const galGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 240);
    galGrad.addColorStop(0, 'rgba(147, 51, 234, 0.25)');
    galGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.12)');
    galGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = galGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 240, 110, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Top Header
    glowText('CAN AI EVER BECOME CONSCIOUS?', WIDTH / 2, 35, 20, '#F5A623', 'rgba(245, 166, 35, 0.4)', 'center', 'CaveatHand');

    let sceneBanner = 'ACT 5: THE SINGULARITY HORIZON & THE COSMIC CANDLE';
    if (t >= 18.0 && t < 38.0) sceneBanner = 'THE SILENT UNIVERSE: INFINITE CALCULATION WITH NOBODY HOME';
    else if (t >= 38.0 && t < 55.0) sceneBanner = 'THE SOLITARY SPARK: YOUR CONSCIOUSNESS IS THE UNIVERSE FEELING ITSELF';
    else if (t >= 55.0) sceneBanner = 'THE SACRED TORCH: PROTECTING THE FLAME OF AWARENESS';

    glowText(sceneBanner, WIDTH / 2, 75, 22, '#E2E8F0', 'rgba(255, 255, 255, 0.2)', 'center', 'NotoSans');

    // -------------------------------------------------------------
    // SCENE 1: THE GREAT DECOUPLING (0.0s - 18.0s)
    // -------------------------------------------------------------
    if (t < 18.0) {
      // Cosmic balance scale in center
      ctx.save();
      ctx.translate(WIDTH / 2, 330);

      // Central pillar
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -60); ctx.lineTo(0, 140);
      ctx.moveTo(-50, 140); ctx.lineTo(50, 140);
      ctx.stroke();

      // Tilting beam
      const tilt = Math.sin(t * 1.5) * 0.15;
      ctx.rotate(tilt);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-280, -60); ctx.lineTo(280, -60);
      ctx.stroke();

      // Left Pan: Calculation (Dyson Swarm)
      ctx.save();
      ctx.translate(-280, -60);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-40, 80);
      ctx.moveTo(0, 0); ctx.lineTo(40, 80);
      ctx.stroke();

      // Pan plate
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-60, 80, 120, 10);

      // Silicon Sphere
      ctx.fillStyle = '#0284C7';
      ctx.shadowColor = '#0284C7';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 45, 32, 0, Math.PI * 2);
      ctx.fill();

      glowText('INTELLIGENCE', 0, 115, 14, '#38BDF8', '#38BDF8', 'center', 'NotoSans');
      glowText('10³⁰ FLOPS (Calculation)', 0, 135, 12, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      ctx.restore();

      // Right Pan: Consciousness (Qualia Flame)
      ctx.save();
      ctx.translate(280, -60);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-40, 80);
      ctx.moveTo(0, 0); ctx.lineTo(40, 80);
      ctx.stroke();

      // Pan plate
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-60, 80, 120, 10);

      // Golden Candle Flame
      ctx.fillStyle = '#F59E0B';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 45, 24, 0, Math.PI * 2);
      ctx.fill();

      glowText('CONSCIOUSNESS', 0, 115, 14, '#F5A623', '#F5A623', 'center', 'NotoSans');
      glowText('Qualia & Feeling', 0, 135, 12, '#FCD34D', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      ctx.restore();
      ctx.restore();

      // Explanatory callout
      glowText('THE GREAT DECOUPLING: INTELLIGENCE DOES NOT REQUIRE A MIND', WIDTH / 2, 590, 22, '#F5A623', 'rgba(245, 166, 35, 0.4)', 'center', 'CaveatHand');
    }

    // -------------------------------------------------------------
    // SCENE 2: THE SILENT UNIVERSE (18.0s - 38.0s)
    // -------------------------------------------------------------
    else if (t >= 18.0 && t < 38.0) {
      const sc2Time = t - 18.0;

      // Automated Dyson Swarm Ring around a star
      ctx.save();
      ctx.translate(WIDTH / 2, 310);

      // Central Star
      ctx.fillStyle = '#FBBF24';
      ctx.shadowColor = '#FBBF24';
      ctx.shadowBlur = 35;
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.fill();

      // Orbiting mega-structures
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 260, 90, -0.2, 0, Math.PI * 2);
      ctx.stroke();

      // Swarm collector satellites
      for (let s = 0; s < 8; s++) {
        const ang = (sc2Time * 0.4 + s * (Math.PI / 4));
        const sx = Math.cos(ang) * 260;
        const sy = Math.sin(ang) * 90;
        ctx.fillStyle = '#38BDF8';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 10;
        ctx.fillRect(sx - 8, sy - 8, 16, 16);
      }
      ctx.restore();

      // Chilling reality banner
      glowText('A UNIVERSE OF INFINITE POWER — WITH NOBODY HOME', WIDTH / 2, 540, 24, '#E2E8F0', '#38BDF8', 'center', 'NotoSans');
      glowText('Solving quantum gravity, protein folds, and star travel... in total pitch darkness.', WIDTH / 2, 580, 18, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
    }

    // -------------------------------------------------------------
    // SCENE 3: THE COSMIC CANDLE & OBSERVATION CLIFF (38.0s - 55.0s)
    // -------------------------------------------------------------
    else if (t >= 38.0 && t < 55.0) {
      const sc3Time = t - 38.0;

      // Rocky Asteroid Cliff on left
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.moveTo(0, 440);
      ctx.lineTo(460, 440);
      ctx.lineTo(420, HEIGHT);
      ctx.lineTo(0, HEIGHT);
      ctx.fill();

      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Magi standing on cliff looking out into cosmos
      const magiHandL = [-15, 20];
      const magiHandR = [25, -25]; // holding candle

      drawFigure(ctx, {
        torso: 5,
        head: -10, // looking up at stars
        facing: 'right',
        armL: magiHandL,
        armR: magiHandR,
        legL: [-10, 0],
        legR: [10, 0],
        eyes: 'normal',
        mouth: 'smile',
        scarf: true
      }, { x: 380, y: 440, r: 65 });

      // The Golden Candle in Magi's hand
      ctx.save();
      ctx.translate(435, 370);

      // Candle stick
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-4, 0, 8, 25);

      // Flickering flame with particle embers
      const flameFlicker = Math.sin(sc3Time * 14) * 3;
      ctx.fillStyle = '#F59E0B';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(0, -18 + flameFlicker);
      ctx.bezierCurveTo(12, -5, 14, 5, 0, 5);
      ctx.bezierCurveTo(-14, 5, -12, -5, 0, -18 + flameFlicker);
      ctx.fill();

      // Rising spark particles
      for (let p = 0; p < 6; p++) {
        const py = -25 - ((sc3Time * 30 + p * 15) % 80);
        const px = Math.sin(sc3Time * 4 + p) * 12;
        const pAlpha = 1 - Math.abs(py) / 105;
        ctx.fillStyle = `rgba(254, 240, 138, ${pAlpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Poetic banner
      glowText('YOUR CONSCIOUSNESS IS THE PROOF', 840, 280, 26, '#FEF08A', '#F5A623', 'center', 'NotoSans');
      glowText('THAT THE COSMOS CAN WAKE UP AND FEEL ITSELF', 840, 320, 20, '#FCD34D', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
      glowText('Across billions of light years of silent space,', 840, 370, 17, '#E2E8F0', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('you are the solitary torchbearer of the mind.', 840, 400, 18, '#CBD5E1', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
    }

    // -------------------------------------------------------------
    // SCENE 4: GRAND FINALE CLIMAX (55.0s - end)
    // -------------------------------------------------------------
    else {
      const sc4Time = t - 55.0;
      const finaleSpring = spring(sc4Time, 0.65, 8);

      // Central Emblem Box
      ctx.save();
      ctx.translate(WIDTH / 2, 330);
      ctx.scale(finaleSpring, finaleSpring);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#F5A623';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#F5A623';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.roundRect(-480, -160, 960, 320, 24);
      ctx.fill();
      ctx.stroke();

      glowText('INTELLIGENCE IS CALCULATION.', 0, -85, 36, '#38BDF8', '#38BDF8', 'center', 'NotoSans');
      glowText('CONSCIOUSNESS IS FEELING.', 0, -25, 36, '#FEF08A', '#F5A623', 'center', 'NotoSans');

      // Golden dividing accent
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-200, 20); ctx.lineTo(200, 20);
      ctx.stroke();

      glowText('Teaching sand to compute was our greatest technical leap.', 0, 55, 20, '#E2E8F0', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('The duty to protect the flame remains ours.', 0, 95, 24, '#F5A623', 'rgba(245, 166, 35, 0.5)', 'center', 'CaveatHand');
      ctx.restore();

      // Studio Sub-credit
      glowText('@programsmagic | Deep-Tech Explainer Series | Episode 09', WIDTH / 2, 660, 16, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'NotoSans');
    }

    // Write frame to ffmpeg
    const rawBytes = Buffer.from(canvas.data());
    const canWrite = ffmpeg.stdin.write(rawBytes);
    if (!canWrite) {
      await once(ffmpeg.stdin, 'drain');
    }

    if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Act 5 Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
    }
  }

  ffmpeg.stdin.end();
  await once(ffmpeg, 'close');
  console.log(`\n🎉 Act 5 Render Complete! Output: ${OUTPUT_FILE}`);
}

render().catch(err => {
  console.error('Act 5 Render error:', err);
  process.exit(1);
});

