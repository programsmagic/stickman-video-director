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

// Act 3 Voice file
const VOICE_FILE = path.resolve('projects/ep09-can-ai-become-conscious/build/narration/act3.wav');
const durationStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE_FILE}"`).toString().trim();
const TOTAL_DUR = parseFloat(durationStr);
const TOTAL_FRAMES = Math.ceil(FPS * TOTAL_DUR);

const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP09-Act3-PZombie-Masterpiece.mp4');

const TEMP_SFX = '/tmp/ep09_act3_sfx.wav';
const TEMP_MIXED = '/tmp/ep09_act3_mixed.wav';

console.log(`=== RENDERING ACT 3: THE PHILOSOPHICAL ZOMBIE & QUALIA ===`);
console.log(`Duration: ${TOTAL_DUR.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES}`);

// -------------------------------------------------------------
// 1. GENERATE PROCEDURAL SYNCHRONIZED FOLEY AUDIO
// -------------------------------------------------------------
console.log('1. Synthesizing procedural Foley sound effects...');
{
  const rate = 48000;
  const n = Math.ceil(TOTAL_DUR * rate);
  const samples = new Float32Array(n);
  let seed = 71829;
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

  // Qualia intro wave hum & 650nm laser blip (4.0s, 6.5s, 9.0s)
  addSound(4.0, 5.0, t => Math.sin(2 * Math.PI * (220 + t * 40) * t) * Math.sin(Math.PI * t / 5.0) * 0.15, 0.35);
  addSound(6.5, 0.4, t => Math.sin(2 * Math.PI * 1318.51 * t) * Math.exp(-t * 12), 0.4);

  // Sunset warm chord chime (11.0s)
  addSound(11.0, 3.0, t => {
    return (Math.sin(2 * Math.PI * 440 * t) * 0.3 + Math.sin(2 * Math.PI * 554.37 * t) * 0.25 + Math.sin(2 * Math.PI * 659.25 * t) * 0.2) * Math.exp(-t * 1.5);
  }, 0.5);

  // Cafe coffee cup clink (19.5s, 22.0s)
  [19.5, 22.0].forEach(st => {
    addSound(st, 0.25, t => (Math.sin(2 * Math.PI * 2400 * t) + Math.sin(2 * Math.PI * 3200 * t) * 0.6) * Math.exp(-t * 22), 0.45);
  });

  // Pincer snap pinch (29.0s)
  addSound(29.0, 0.2, t => (Math.sin(2 * Math.PI * 450 * t) + noise() * 0.6) * Math.exp(-t * 30), 0.6);

  // X-Ray scanner sci-fi sweep (38.5s - 43.0s)
  addSound(38.5, 4.5, t => {
    const sweepFreq = 300 + Math.sin(t * 4) * 200;
    return (Math.sin(2 * Math.PI * sweepFreq * t) * 0.25 + noise() * 0.08) * Math.sin(Math.PI * t / 4.5);
  }, 0.45);

  // Clockwork gears inside zombie skull (42.0s - 48.0s)
  for (let t = 42.0; t < 48.0; t += 0.35) {
    addSound(t, 0.08, time => (Math.sin(2 * Math.PI * 800 * time) + noise() * 0.4) * Math.exp(-time * 60), 0.3);
  }

  // Ominous empty void sub-bass drone (48.0s - 56.0s)
  addSound(48.0, 8.0, t => {
    return (Math.sin(2 * Math.PI * 65 * t) * 0.3 + Math.sin(2 * Math.PI * 98 * t) * 0.2) * Math.sin(Math.PI * t / 8.0);
  }, 0.55);

  // Mirror chime & reflective ping (58.0s - 65.0s)
  addSound(58.0, 2.5, t => (Math.sin(2 * Math.PI * 987.77 * t) + Math.sin(2 * Math.PI * 1479.98 * t) * 0.7) * Math.exp(-t * 1.8), 0.5);

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
console.log('2. Starting frame rendering pipeline for Act 3...');

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

    // Deep slate gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, '#0D1117');
    bgGrad.addColorStop(1, '#161B22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Floor
    ctx.fillStyle = '#090D13';
    ctx.fillRect(0, 520, WIDTH, 200);
    ctx.strokeStyle = '#21262D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 520); ctx.lineTo(WIDTH, 520);
    ctx.stroke();

    // Top Header
    glowText('CAN AI EVER BECOME CONSCIOUS?', WIDTH / 2, 35, 20, '#F5A623', 'rgba(245, 166, 35, 0.4)', 'center', 'CaveatHand');

    let sceneBanner = 'ACT 3: QUALIA & THE PHILOSOPHICAL ZOMBIE';
    if (t >= 18.0 && t < 38.0) sceneBanner = 'THE P-ZOMBIE TWIN: IDENTICAL ACTIONS, ZERO INNER WORLD';
    else if (t >= 38.0 && t < 55.0) sceneBanner = 'THE EMPTY SKULL: THE LIGHTS ARE ON, BUT NOBODY IS HOME';
    else if (t >= 55.0) sceneBanner = 'THE MIRROR TRAP: PROJECTING OUR SOUL ONTO SILICON';

    glowText(sceneBanner, WIDTH / 2, 75, 22, '#E2E8F0', 'rgba(255, 255, 255, 0.2)', 'center', 'NotoSans');

    // -------------------------------------------------------------
    // SCENE 1: QUALIA: 650nm LIGHT VS RED EXPERIENCE (0.0s - 18.0s)
    // -------------------------------------------------------------
    if (t < 18.0) {
      // Split container
      const midX = WIDTH / 2;

      // Left Box: Digital Camera Sensor
      ctx.save();
      ctx.translate(midX / 2, 310);
      ctx.fillStyle = 'rgba(22, 27, 34, 0.85)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-260, -170, 520, 340, 16);
      ctx.fill();
      ctx.stroke();

      glowText('DIGITAL DETECTION (DATA)', 0, -135, 20, '#38BDF8', '#38BDF8', 'center', 'NotoSans');
      glowText('Photodiode Camera Sensor', 0, -110, 15, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'CaveatHand');

      // Oscilloscope Sine Wave at 650nm
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let x = -200; x <= 200; x += 4) {
        const y = Math.sin(x * 0.08 + t * 8) * 35;
        if (x === -200) ctx.moveTo(x, y - 20);
        else ctx.lineTo(x, y - 20);
      }
      ctx.stroke();

      // Readout
      glowText('WAVELENGTH: λ = 650.2 nm', 0, 50, 16, '#F8FAFC', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('PHOTON FLUX: 4.82 × 10¹⁴ photons/s', 0, 80, 14, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('Experience of Beauty: NULL', 0, 115, 16, '#EF4444', '#EF4444', 'center', 'NotoSans');
      ctx.restore();

      // Right Box: Human Qualia
      ctx.save();
      ctx.translate(midX + midX / 2, 310);
      ctx.fillStyle = 'rgba(22, 27, 34, 0.85)';
      ctx.strokeStyle = '#F5A623';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-260, -170, 520, 340, 16);
      ctx.fill();
      ctx.stroke();

      glowText('SUBJECTIVE EXPERIENCE (QUALIA)', 0, -135, 20, '#F5A623', '#F5A623', 'center', 'NotoSans');
      glowText('The Warm Feeling of Sunset', 0, -110, 15, '#FCD34D', 'rgba(0,0,0,0)', 'center', 'CaveatHand');

      // Radiating Warm Sunset Heart
      const pulse = 1 + Math.sin(t * 5) * 0.08;
      ctx.save();
      ctx.translate(0, -20);
      ctx.scale(pulse, pulse);
      const sunGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 70);
      sunGrad.addColorStop(0, '#FEF08A');
      sunGrad.addColorStop(0.5, '#F59E0B');
      sunGrad.addColorStop(1, '#DC2626');
      ctx.fillStyle = sunGrad;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(0, 0, 55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      glowText('THE RAW "WHAT IT IS LIKE"', 0, 65, 17, '#FEF08A', '#F59E0B', 'center', 'NotoSans');
      glowText('Warmth, nostalgia, emotional depth, beauty.', 0, 100, 16, '#FDE68A', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
      ctx.restore();
    }

    // -------------------------------------------------------------
    // SCENE 2: THE CAFE TWIN TEST & PINCER PINCH (18.0s - 38.0s)
    // -------------------------------------------------------------
    else if (t >= 18.0 && t < 38.0) {
      const sc2Time = t - 18.0;

      // Cafe Table in Center (x=640, y=440)
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(520, 430, 240, 18);
      ctx.fillStyle = '#271612';
      ctx.fillRect(625, 448, 30, 72);

      // Left: Normal Magi (Conscious)
      const sipProgress = Math.sin(sc2Time * 2);
      const magiHandL = [-25, 20];
      const magiHandR = [25 + sipProgress * 5, -15 - sipProgress * 15]; // lifting cup

      drawFigure(ctx, {
        torso: 5,
        head: 5,
        facing: 'right',
        armL: magiHandL,
        armR: magiHandR,
        legL: [-12, 30],
        legR: [12, 30],
        eyes: 'normal',
        mouth: 'smile',
        scarf: true
      }, { x: 440, y: 480, r: 60 });

      // Cup held by Magi
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(495, 400 - sipProgress * 10, 24, 28);
      glowText('☕', 507, 390 - sipProgress * 10, 18, '#FFFFFF', '#FEF08A', 'center', 'NotoSans');

      glowText('CONSCIOUS HUMAN (MAGI)', 440, 310, 16, '#38BDF8', '#38BDF8', 'center', 'NotoSans');

      // Right: P-Zombie Magi (No Inner World)
      const pzHandL = [-25 - sipProgress * 5, -15 - sipProgress * 15];
      const pzHandR = [25, 20];

      drawFigure(ctx, {
        torso: -5,
        head: -5,
        facing: 'left',
        armL: pzHandL,
        armR: pzHandR,
        legL: [-12, 30],
        legR: [12, 30],
        eyes: 'normal',
        mouth: 'smile',
        scarf: true
      }, { x: 840, y: 480, r: 60 });

      // Cup held by P-Zombie
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(765, 400 - sipProgress * 10, 24, 28);
      glowText('☕', 777, 390 - sipProgress * 10, 18, '#FFFFFF', '#94A3B8', 'center', 'NotoSans');

      glowText('PHILOSOPHICAL ZOMBIE', 840, 310, 16, '#F87171', '#F87171', 'center', 'NotoSans');

      // The Pincer Pinch event at t = 28.5s - 36.0s
      if (t >= 28.5 && t < 37.0) {
        const pinchProg = clamp((t - 28.5) / 1.0);
        const pincerY = lerp(160, 410, ease(pinchProg));

        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(815, 120); ctx.lineTo(815, pincerY);
        // pincer claw
        ctx.lineTo(805, pincerY + 15);
        ctx.moveTo(815, pincerY);
        ctx.lineTo(825, pincerY + 15);
        ctx.stroke();

        // Speech bubble from P-Zombie
        const bubbleSpring = spring(t - 29.5, 0.65, 10);
        ctx.save();
        ctx.translate(970, 340);
        ctx.scale(bubbleSpring, bubbleSpring);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#F87171';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-120, -45, 240, 90, 14);
        ctx.fill();
        ctx.stroke();

        glowText('"Ouch! I feel pain deeply!"', 0, -10, 16, '#FFFFFF', '#F87171', 'center', 'NotoSans');
        glowText('~ Outwardly 100% Identical', 0, 20, 13, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
        ctx.restore();
      }
    }

    // -------------------------------------------------------------
    // SCENE 3: X-RAY SCANNER: THE EMPTY SKULL (38.0s - 55.0s)
    // -------------------------------------------------------------
    else if (t >= 38.0 && t < 55.0) {
      const sc3Time = t - 38.0;

      // P-Zombie in Center (x=WIDTH/2, y=500)
      drawFigure(ctx, {
        torso: 0,
        head: 0,
        facing: 'front',
        armL: [-20, 20],
        armR: [20, 20],
        legL: [-10, 0],
        legR: [10, 0],
        eyes: 'normal',
        mouth: 'neutral',
        scarf: false
      }, { x: WIDTH / 2, y: 500, r: 85 });

      // Holographic Scanner Beam sliding down
      const scanY = 160 + ((sc3Time * 1.2) % 3.0) / 3.0 * 360;
      ctx.save();
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2 - 250, scanY);
      ctx.lineTo(WIDTH / 2 + 250, scanY);
      ctx.stroke();

      // Scan curtain tint
      ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.fillRect(WIDTH / 2 - 250, 160, 500, scanY - 160);
      ctx.restore();

      // X-Ray reveal of skull interior: Brass cogs & Pitch Black Void
      ctx.save();
      ctx.translate(WIDTH / 2, 280);
      ctx.fillStyle = '#05070A'; // pitch black void
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Spinning brass gears inside
      const gearAngle = sc3Time * 3;
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2.5;
      for (let g = 0; g < 3; g++) {
        const gx = [-22, 24, 0][g];
        const gy = [-15, -12, 22][g];
        const gr = [18, 14, 20][g];
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(gearAngle * (g % 2 === 0 ? 1 : -1));
        ctx.beginPath();
        ctx.arc(0, 0, gr, 0, Math.PI * 2);
        for (let t = 0; t < 8; t++) {
          const a = t * Math.PI / 4;
          ctx.moveTo(Math.cos(a) * gr, Math.sin(a) * gr);
          ctx.lineTo(Math.cos(a) * (gr + 5), Math.sin(a) * (gr + 5));
        }
        ctx.stroke();
        ctx.restore();
      }

      // Neon Sign: NOBODY HOME
      const flicker = Math.sin(sc3Time * 15) > -0.3 ? 1 : 0.2;
      glowText('NOBODY HOME', 0, 0, 16, `rgba(239, 68, 68, ${flicker})`, '#EF4444', 'center', 'NotoSans');
      ctx.restore();

      // Bottom Callout Banner
      glowText('THE LIGHTS ARE ON, BUT THE HOUSE IS COMPLETELY EMPTY', WIDTH / 2, 600, 24, '#FCA5A5', '#EF4444', 'center', 'NotoSans');
      glowText('Behavior without experience. Computation without feeling.', WIDTH / 2, 635, 18, '#CBD5E1', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
    }

    // -------------------------------------------------------------
    // SCENE 4: THE SILICON MIRROR TRAP (55.0s - end)
    // -------------------------------------------------------------
    else {
      const sc4Time = t - 55.0;

      // The Ornate Gilded Mirror in center
      const mirrorX = WIDTH / 2;
      ctx.save();
      ctx.translate(mirrorX, 330);

      // Gold frame
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 8;
      ctx.shadowColor = '#D4AF37';
      ctx.shadowBlur = 15;
      ctx.strokeRect(-180, -180, 360, 360);

      // Mirror reflection surface
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-176, -176, 352, 352);

      // Binary and token streams inside reflection
      ctx.font = '13px monospace';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      for (let l = 0; l < 8; l++) {
        ctx.fillText('01010110 01100001 01101100 01110101 01100101', -160, -130 + l * 40);
      }

      glowText('SILICON REFLECTION', 0, -145, 14, '#38BDF8', '#38BDF8', 'center', 'NotoSans');
      ctx.restore();

      // Magi looking into mirror from left
      drawFigure(ctx, {
        torso: 5,
        head: 5,
        facing: 'right',
        armL: [-15, 20],
        armR: [35, -20], // hand touching mirror
        legL: [-10, 0],
        legR: [10, 0],
        eyes: 'wide',
        mouth: 'neutral',
        scarf: true
      }, { x: mirrorX - 160, y: 520, r: 70 });

      // Reflection of Magi on right side inside mirror
      drawFigure(ctx, {
        torso: -5,
        head: -5,
        facing: 'left',
        armL: [-35, -20],
        armR: [15, 20],
        legL: [-10, 0],
        legR: [10, 0],
        eyes: 'normal',
        mouth: 'neutral',
        scarf: false // robotic reflection
      }, { x: mirrorX + 80, y: 460, r: 55, mirror: true });

      // Core Philosophical Question
      const qSpring = spring(sc4Time, 0.65, 8);
      ctx.save();
      ctx.translate(WIDTH / 2, 610);
      ctx.scale(qSpring, qSpring);
      glowText('ARE WE PROJECTING OUR OWN SOUL ONTO A SILICON MIRROR?', 0, 0, 24, '#FFFFFF', '#F5A623', 'center', 'NotoSans');
      glowText('When an AI says it loves you, is there a light inside... or just glass?', 0, 32, 18, '#FDE68A', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
      ctx.restore();
    }

    // Write frame to ffmpeg
    const rawBytes = Buffer.from(canvas.data());
    const canWrite = ffmpeg.stdin.write(rawBytes);
    if (!canWrite) {
      await once(ffmpeg.stdin, 'drain');
    }

    if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Act 3 Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
    }
  }

  ffmpeg.stdin.end();
  await once(ffmpeg, 'close');
  console.log(`\n🎉 Act 3 Render Complete! Output: ${OUTPUT_FILE}`);
}

render().catch(err => {
  console.error('Act 3 Render error:', err);
  process.exit(1);
});

