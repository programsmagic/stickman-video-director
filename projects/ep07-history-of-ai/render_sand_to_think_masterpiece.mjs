import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, GlobalFonts } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

// Fonts
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const DURATION = 34.22;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const AUDIO_VOICE = path.resolve('projects/test-b1-comparison/narration.wav');
const OUTPUT_FILE = path.resolve('exports/EP07-How-We-Taught-Sand-To-Think-Masterpiece.mp4');
const TEMP_VIDEO = '/tmp/sand_masterpiece_temp.mp4';
const TEMP_SFX = '/tmp/sand_masterpiece_sfx.wav';
const TEMP_MIXED = '/tmp/sand_masterpiece_audio.wav';

// Math Helpers
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOutBack = t => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// -------------------------------------------------------------
// 1. PROCEDURAL FOLEY SOUND DESIGN (34.22s)
// -------------------------------------------------------------
console.log('1. Generating rich Foley audio track...');
{
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const samples = new Float32Array(n);
  let seed = 38192;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };

  function addSound(timeSec, durationSec, fn, gain = 0.35) {
    const startIdx = Math.round(timeSec * rate);
    const count = Math.min(n - startIdx, Math.round(durationSec * rate));
    for (let i = 0; i < count; i++) samples[startIdx + i] += fn(i / rate) * gain;
  }

  // S1: Phone screen gentle chime (t = 0.5s)
  addSound(0.5, 0.8, t => Math.sin(2 * Math.PI * 1318.5 * t) * Math.exp(-t * 4), 0.3);
  // S2: Beach wave swoosh & sand trickling (t = 2.0s - 7.5s)
  addSound(2.0, 5.5, t => (noise() * 0.4 + Math.sin(2 * Math.PI * (120 + Math.sin(t * 3) * 40) * t) * 0.3) * Math.sin((t / 5.5) * Math.PI), 0.28);
  // S3: Quartz atomic hum & crystalline high chime (t = 8.5s - 11.2s)
  addSound(8.5, 2.5, t => (Math.sin(2 * Math.PI * 880 * t) * 0.35 + Math.sin(2 * Math.PI * 1760 * t) * 0.25) * Math.sin((t / 2.5) * Math.PI), 0.32);
  // S4: Furnace bubble, laser etching & lightning THUNDER CRACK (t = 12.0s - 20.0s)
  addSound(12.5, 3.5, t => (noise() * 0.5 + Math.sin(2 * Math.PI * (200 + t * 300) * t) * 0.3) * Math.exp(-t * 0.6), 0.35);
  // Thunder bolt zap at t = 17.5s
  addSound(17.5, 1.2, t => (noise() * 0.8 + Math.sin(2 * Math.PI * 90 * t) * 0.7) * Math.exp(-t * 5), 0.65);
  // S5: Switch OFF click (t = 21.2s)
  addSound(21.2, 0.2, t => (noise() * 0.4 + Math.sin(2 * Math.PI * 340 * t) * 0.7) * Math.exp(-t * 25), 0.45);
  // Switch ON slam & electric buzz (t = 23.6s)
  addSound(23.6, 0.8, t => (noise() * 0.6 + Math.sin(2 * Math.PI * 60 * t) * 0.6 + Math.sin(2 * Math.PI * 980 * t) * 0.4) * Math.exp(-t * 6), 0.65);
  // S6: Binary waterfall chime cascade & triumphant fanfare (t = 27.5s - 33.8s)
  [27.6, 28.2, 28.8, 29.4, 30.0, 30.6].forEach((tm, i) => {
    addSound(tm, 0.4, t => Math.sin(2 * Math.PI * (523 + i * 110) * t) * Math.exp(-t * 8), 0.25);
  });
  // Grand finale chime (t = 31.5s)
  addSound(31.5, 2.5, t => {
    const env = Math.exp(-t * 2.2);
    return (
      Math.sin(2 * Math.PI * 523.25 * t) * 0.35 +
      Math.sin(2 * Math.PI * 659.25 * t) * 0.3 +
      Math.sin(2 * Math.PI * 783.99 * t) * 0.25 +
      Math.sin(2 * Math.PI * 1046.5 * t) * 0.3
    ) * env;
  }, 0.65);

  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) bytes.writeInt16LE(Math.round(clamp(samples[i], -1, 1) * 32767), 44 + i * 2);
  fs.writeFileSync(TEMP_SFX, bytes);
}

// Mix with original voiceover
execSync(`ffmpeg -v error -y -i "${AUDIO_VOICE}" -i "${TEMP_SFX}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.85[s];[v][s]amix=inputs=2:duration=longest" -ar 48000 "${TEMP_MIXED}"`);
console.log('✓ Master soundtrack mixed.');

// -------------------------------------------------------------
// 2. 3D PROJECTION ENGINE (MANIM / EP07 STYLE)
// -------------------------------------------------------------
function project3D(x, y, z, rotY, rotX, fov = 700, cx = 640, cy = 360) {
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  const x1 = x * cosY + z * sinY;
  const z1 = -x * sinY + z * cosY;

  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  const y2 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;

  const depth = fov / (fov + z2 + 450);
  return { x: cx + x1 * depth, y: cy + y2 * depth, z: z2, scale: depth };
}

// -------------------------------------------------------------
// 3. CHARACTER ACTOR (MAGI WITH EXPRESSIVE POSE BLENDS)
// -------------------------------------------------------------
function drawMagi(ctx, x, y, options = {}) {
  const {
    t = 0,
    action = 'phone_hold', // 'phone_hold', 'beach_scoop', 'crystal_lens', 'lightning_duck', 'switch_slam', 'celebrate'
    facing = 1,
    scale = 1
  } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);

  const boil = Math.floor(t * 12);
  const wobbly = Math.sin(boil * 3.7) * 1.2;

  const hipY = -70;
  const shoulderY = hipY - 55;
  const headY = shoulderY - 26;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 36, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Limbs
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4.0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let lFootX = -12, lFootY = 0;
  let rFootX = 12, rFootY = 0;
  let lHandX = -16, lHandY = shoulderY + 30;
  let rHandX = 22, rHandY = shoulderY + 30;
  let torsoTilt = 0;

  if (action === 'phone_hold') {
    lHandX = 10; lHandY = shoulderY + 5;
    rHandX = 26; rHandY = shoulderY + 5;
    torsoTilt = 4;
  } else if (action === 'beach_scoop') {
    lHandX = 35; lHandY = hipY + 45;
    rHandX = 48; rHandY = hipY + 42;
    torsoTilt = 18;
    lFootX = -25; rFootX = 18;
  } else if (action === 'crystal_lens') {
    rHandX = 40; rHandY = headY - 5; // holding magnifying lens to eye
    lHandX = -15; lHandY = shoulderY + 20;
    torsoTilt = 3;
  } else if (action === 'lightning_duck') {
    torsoTilt = -15;
    lHandX = -35; lHandY = headY - 10;
    rHandX = 35; rHandY = headY - 10; // hands guarding head
    lFootX = -30; rFootX = 30;
  } else if (action === 'switch_slam') {
    torsoTilt = 22;
    lHandX = 45; lHandY = hipY + 30;
    rHandX = 55; rHandY = hipY + 30; // both hands slamming down
  } else if (action === 'celebrate') {
    rHandX = 45; rHandY = headY - 35; // arms up!
    lHandX = -45; lHandY = headY - 35;
    torsoTilt = 0;
  }

  // Legs
  ctx.beginPath(); ctx.moveTo(-6, hipY); ctx.lineTo(-8, hipY + 36); ctx.lineTo(lFootX, lFootY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, hipY); ctx.lineTo(8, hipY + 36); ctx.lineTo(rFootX, rFootY); ctx.stroke();

  // Torso
  ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(torsoTilt, shoulderY); ctx.stroke();

  // Arms
  ctx.beginPath(); ctx.moveTo(-4 + torsoTilt, shoulderY); ctx.lineTo(lHandX * 0.5, shoulderY + 15); ctx.lineTo(lHandX, lHandY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4 + torsoTilt, shoulderY); ctx.lineTo(rHandX * 0.5, shoulderY + 15); ctx.lineTo(rHandX, rHandY); ctx.stroke();

  // Props held in hand
  if (action === 'phone_hold') {
    // Smartphone
    ctx.fillStyle = '#0284C7';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(12, shoulderY - 15, 26, 42, 4); ctx.fill(); ctx.stroke();
    // Screen glow
    ctx.fillStyle = '#BAE6FD'; ctx.fillRect(15, shoulderY - 10, 20, 32);
  } else if (action === 'crystal_lens') {
    // Magnifying glass
    ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(rHandX + 10, rHandY - 10, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(rHandX, rHandY); ctx.lineTo(rHandX + 6, rHandY - 4); ctx.stroke();
  } else if (action === 'celebrate') {
    // Magic wand
    ctx.strokeStyle = '#B45309'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(rHandX, rHandY); ctx.lineTo(rHandX + 32, rHandY - 32); ctx.stroke();
    ctx.fillStyle = '#FACC15'; ctx.shadowColor = '#FACC15'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(rHandX + 32, rHandY - 32, 6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Yellow Scarf
  ctx.fillStyle = '#E8B32A';
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.roundRect(-4 + torsoTilt, shoulderY - 6, 26, 12, 4); ctx.fill(); ctx.stroke();
  const wave = Math.sin(t * 10) * 6;
  ctx.beginPath();
  ctx.moveTo(2 + torsoTilt, shoulderY);
  ctx.quadraticCurveTo(-14, shoulderY + 18, -18 + wave, shoulderY + 36);
  ctx.lineTo(-11 + wave, shoulderY + 38);
  ctx.quadraticCurveTo(-6, shoulderY + 20, 6 + torsoTilt, shoulderY + 6);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Head
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 3.6;
  ctx.beginPath(); ctx.arc(torsoTilt, headY, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Face Expression
  ctx.fillStyle = '#0F172A';
  if (action === 'lightning_duck') {
    // Shocked squint
    ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(torsoTilt - 8, headY - 3); ctx.lineTo(torsoTilt - 2, headY - 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(torsoTilt + 4, headY - 1); ctx.lineTo(torsoTilt + 10, headY - 3); ctx.stroke();
    // Open wavy mouth
    ctx.beginPath(); ctx.arc(torsoTilt + 2, headY + 8, 5, 0, Math.PI * 2); ctx.fill();
  } else if (action === 'celebrate' || action === 'phone_hold') {
    // Amazed wide eyes
    ctx.beginPath(); ctx.arc(torsoTilt - 6, headY - 2, 3.5, 0, Math.PI * 2); ctx.arc(torsoTilt + 7, headY - 2, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(torsoTilt + 2, headY + 5, 7, 0.1, Math.PI - 0.1); ctx.stroke();
  } else {
    // Normal smile
    ctx.beginPath(); ctx.arc(torsoTilt - 5, headY - 2, 3, 0, Math.PI * 2); ctx.arc(torsoTilt + 7, headY - 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(torsoTilt + 2, headY + 4, 6, 0.2, Math.PI - 0.2); ctx.stroke();
  }

  // Wizard Hat
  const hatTilt = torsoTilt + (action === 'lightning_duck' ? -12 : 3);
  ctx.fillStyle = '#6B4BD8'; ctx.strokeStyle = '#432B94'; ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.ellipse(hatTilt, headY - 18, 30, 6, 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hatTilt - 18, headY - 18);
  ctx.quadraticCurveTo(hatTilt - 5, headY - 55, hatTilt + 20, headY - 65);
  ctx.lineTo(hatTilt + 16, headY - 18);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FACC15';
  ctx.beginPath(); ctx.arc(hatTilt + 10, headY - 42, 5, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// -------------------------------------------------------------
// 4. MAIN MULTI-ACT VIDEO RENDERER
// -------------------------------------------------------------
async function renderMasterpiece() {
  console.log(`2. Rendering ${TOTAL_FRAMES} frames across 6 Acts...`);
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const ffmpeg = spawn('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${WIDTH}x${HEIGHT}`,
    '-framerate', String(FPS),
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    TEMP_VIDEO
  ]);

  ffmpeg.stdin.on('error', () => {});
  let errorMsg = '';
  ffmpeg.stderr.on('data', chunk => { errorMsg += chunk.toString(); });

  const completion = new Promise((resolve, reject) => {
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`Encode failed (code ${code}): ${errorMsg}`)));
  });

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const t = f / FPS;

    // Background Gradient (Deep Space Navy with Warm Paper Edge)
    const bg = ctx.createRadialGradient(640, 360, 60, 640, 360, 800);
    bg.addColorStop(0, '#0F172A');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    let caption = '';

    // =========================================================
    // ACT 1 (0.0s – 1.69s): Look down at your phone
    // =========================================================
    if (t < 1.69) {
      caption = "Look down at your phone.";
      const phoneScale = ease(t / 1.69);

      // Floating Glow Ring
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(640, 320, 180 + Math.sin(t * 8) * 15, 0, Math.PI * 2); ctx.stroke();

      // Giant Smartphone Model
      ctx.shadowColor = '#38BDF8'; ctx.shadowBlur = 35;
      ctx.fillStyle = '#0F172A'; ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(540, 160, 200, 320, 24); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;

      // Phone UI App Icons
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)'; ctx.roundRect(560, 200, 160, 240, 12); ctx.fill();
      ['#EF4444', '#3B82F6', '#10B981', '#F59E0B'].forEach((c, idx) => {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.roundRect(580 + (idx % 2) * 65, 230 + Math.floor(idx / 2) * 65, 48, 48, 12); ctx.fill();
      });
      ctx.restore();

      drawMagi(ctx, 360, 520, { t, action: 'phone_hold', facing: 1, scale: 0.95 });
    }

    // =========================================================
    // ACT 2 (1.69s – 8.11s): Beach sand from the ocean
    // =========================================================
    else if (t < 8.11) {
      caption = "It feels like magic, but inside, it's just beach sand!";

      // Animated Beach Dunes
      ctx.save();
      ctx.fillStyle = '#FDE047'; ctx.beginPath();
      ctx.moveTo(0, 520);
      for (let x = 0; x <= WIDTH; x += 40) ctx.lineTo(x, 500 + Math.sin(x * 0.008 + t * 2) * 22);
      ctx.lineTo(WIDTH, HEIGHT); ctx.lineTo(0, HEIGHT); ctx.fill();

      // Rolling Ocean Waves
      ctx.fillStyle = 'rgba(14, 165, 233, 0.75)'; ctx.beginPath();
      ctx.moveTo(0, 560);
      for (let x = 0; x <= WIDTH; x += 30) ctx.lineTo(x, 545 + Math.sin(x * 0.015 - t * 3) * 16);
      ctx.lineTo(WIDTH, HEIGHT); ctx.lineTo(0, HEIGHT); ctx.fill();
      ctx.restore();

      // Trickling Sand Particles Cascade
      ctx.save();
      ctx.fillStyle = '#FACC15';
      for (let i = 0; i < 45; i++) {
        const sx = 720 + Math.sin(i * 9 + t * 4) * 25;
        const sy = 340 + ((i * 18 + t * 240) % 200);
        ctx.beginPath(); ctx.arc(sx, sy, 2.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      drawMagi(ctx, 640, 520, { t, action: 'beach_scoop', facing: 1, scale: 0.95 });
    }

    // =========================================================
    // ACT 3 (8.11s – 11.78s): 3D Silicon Quartz Crystal Lattice
    // =========================================================
    else if (t < 11.78) {
      caption = "Sand is made of quartz crystals: Silicon Dioxide (SiO2).";

      const localT = t - 8.11;
      const rotY = localT * 0.8;
      const rotX = 0.35 + Math.sin(localT * 0.5) * 0.15;

      // 3D Atomic Lattice (Silicon in center, 4 Oxygen tetrahedrons)
      ctx.save();
      const atoms = [
        { type: 'Si', x: 0, y: 0, z: 0, color: '#38BDF8', r: 18 },
        { type: 'O', x: -110, y: -90, z: 90, color: '#EF4444', r: 12 },
        { type: 'O', x: 110, y: -90, z: -90, color: '#EF4444', r: 12 },
        { type: 'O', x: 90, y: 110, z: 90, color: '#EF4444', r: 12 },
        { type: 'O', x: -90, y: 110, z: -90, color: '#EF4444', r: 12 }
      ];

      const proj = atoms.map(a => ({ ...a, ...project3D(a.x, a.y, a.z, rotY, rotX, 600, 780, 320) }));

      // Bonds
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 3.5;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(proj[0].x, proj[0].y); ctx.lineTo(proj[i].x, proj[i].y); ctx.stroke();
      }

      // Atoms
      proj.sort((a, b) => b.z - a.z); // Depth sort
      proj.forEach(a => {
        ctx.save();
        ctx.shadowColor = a.color; ctx.shadowBlur = 20;
        ctx.fillStyle = a.color;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r * a.scale, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFF'; ctx.font = `bold ${Math.round(11 * a.scale)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(a.type, a.x, a.y);
        ctx.restore();
      });
      ctx.restore();

      drawMagi(ctx, 340, 520, { t, action: 'crystal_lens', facing: 1, scale: 0.95 });
    }

    // =========================================================
    // ACT 4 (11.78s – 20.95s): Melt Sand & Lightning Zaps Microchip
    // =========================================================
    else if (t < 20.95) {
      caption = "Melt sand down, carve billions of switches, and trap electricity!";

      const localT = t - 11.78;

      // Silicon Wafer Chip Die (Grid of Microscopic Switches)
      ctx.save();
      ctx.fillStyle = '#0F172A'; ctx.strokeStyle = '#22C55E'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(560, 200, 420, 260, 16); ctx.fill(); ctx.stroke();

      // Microscopic Circuit Grid Buses
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)'; ctx.lineWidth = 1.5;
      for (let gx = 580; gx < 960; gx += 30) {
        ctx.beginPath(); ctx.moveTo(gx, 210); ctx.lineTo(gx, 450); ctx.stroke();
      }
      for (let gy = 220; gy < 450; gy += 30) {
        ctx.beginPath(); ctx.moveTo(570, gy); ctx.lineTo(970, gy); ctx.stroke();
      }

      // Animated Lightning Bolt
      const zapActive = Math.sin(t * 18) > 0.3;
      if (zapActive) {
        ctx.shadowColor = '#FACC15'; ctx.shadowBlur = 30;
        ctx.strokeStyle = '#FACC15'; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(760, 60);
        ctx.lineTo(740, 130);
        ctx.lineTo(780, 150);
        ctx.lineTo(750, 220);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      drawMagi(ctx, 380, 520, { t, action: 'lightning_duck', facing: 1, scale: 0.95 });
    }

    // =========================================================
    // ACT 5 (20.95s – 27.5s): OFF = 0, ON = 1 (Mechanical Knife Switch)
    // =========================================================
    else if (t < 27.5) {
      const isSwitchOn = t > 23.5;
      caption = isSwitchOn ? "When switch is ON = 1! Electricity flows." : "When switch is OFF = 0.";

      // Huge Knife Switch Console
      ctx.save();
      ctx.fillStyle = '#1E293B'; ctx.strokeStyle = '#475569'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(620, 240, 360, 200, 14); ctx.fill(); ctx.stroke();

      // Blade Lever
      const leverAngle = isSwitchOn ? 0.35 : -0.75;
      ctx.save();
      ctx.translate(720, 380);
      ctx.rotate(leverAngle);
      ctx.fillStyle = '#B45309'; ctx.fillRect(-8, -120, 16, 120);
      ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(0, -120, 18, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Binary State Indicators
      ctx.font = '900 68px NotoSans'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (isSwitchOn) {
        ctx.fillStyle = '#22C55E'; ctx.shadowColor = '#22C55E'; ctx.shadowBlur = 30;
        ctx.fillText('1 (ON)', 860, 340);
      } else {
        ctx.fillStyle = '#EF4444'; ctx.shadowColor = '#EF4444'; ctx.shadowBlur = 30;
        ctx.fillText('0 (OFF)', 860, 340);
      }
      ctx.restore();

      drawMagi(ctx, 420, 520, { t, action: isSwitchOn ? 'celebrate' : 'switch_slam', facing: 1, scale: 0.95 });
    }

    // =========================================================
    // ACT 6 (27.5s – 34.22s): Beach + Lightning = AI Brain
    // =========================================================
    else {
      caption = "A beach of sand with lightning: How we taught sand to think!";

      // Pulsing Binary Stream Waterfall
      ctx.save();
      ctx.font = 'bold 22px monospace'; ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      for (let col = 80; col < WIDTH; col += 70) {
        for (let row = 80; row < 550; row += 40) {
          const bit = (Math.sin(col * 3 + row * 7 + t * 8) > 0) ? '1' : '0';
          ctx.fillText(bit, col, row);
        }
      }

      // Golden Starburst Aura
      ctx.shadowColor = '#FACC15'; ctx.shadowBlur = 40;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.15)';
      ctx.beginPath(); ctx.arc(640, 340, 220 + Math.sin(t * 12) * 20, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      drawMagi(ctx, 640, 520, { t, action: 'celebrate', facing: 1, scale: 1.05 });
    }

    // =========================================================
    // BOTTOM CAPTION BAND (Readable, Single-Line, Natural Contrast)
    // =========================================================
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 32px NotoSans';
    ctx.strokeStyle = '#020617'; ctx.lineWidth = 7;
    ctx.strokeText(caption, 640, 665);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(caption, 640, 665);
    ctx.restore();

    // Pipe raw frame to ffmpeg with backpressure handling
    const buffer = Buffer.from(canvas.data());
    if (!ffmpeg.stdin.write(buffer)) {
      await Promise.race([
        once(ffmpeg.stdin, 'drain'),
        completion.then(() => { throw new Error('Encoder closed early'); })
      ]);
    }
  }

  ffmpeg.stdin.end();
  await completion;
  console.log('3. Video frames encoded successfully.');

  // Mux video and soundtrack
  console.log('4. Muxing video and master audio soundtrack...');
  execSync(`ffmpeg -v error -y -i "${TEMP_VIDEO}" -i "${TEMP_MIXED}" -c:v copy -c:a aac -b:a 192k "${OUTPUT_FILE}"`);
  console.log(`✓ Masterpiece generated: ${OUTPUT_FILE}`);
}

renderMasterpiece().catch(err => {
  console.error('Render failed:', err);
  process.exit(1);
});

