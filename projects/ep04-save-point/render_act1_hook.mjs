import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, GlobalFonts } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';
import { solve2BoneIK } from '../tools/stickman.mjs';

// Fonts
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const AUDIO_VOICE = path.resolve('projects/ep04-save-point/build/narration/ch1.wav');
const DURATION = 111.24;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const OUTPUT_FILE = path.resolve('exports/EP04-Act1-Hook-Masterpiece.mp4');
const TEMP_SFX = '/tmp/ep04_act1_sfx.wav';
const TEMP_MIXED = '/tmp/ep04_act1_audio.wav';

// Math Helpers
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };

// Remotion Spring Helper
function spring({ frame, fps = 30, config = { damping: 12, stiffness: 100, mass: 1 }, delay = 0 }) {
  const t = Math.max(0, (frame - delay) / fps);
  if (t === 0) return 0;
  const { damping, stiffness, mass } = config;
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const omega1 = omega0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega0 * t) * (Math.cos(omega1 * t) + (zeta * omega0 / omega1) * Math.sin(omega1 * t));
  }
  return 1 - Math.exp(-omega0 * t) * (1 + omega0 * t);
}

// -------------------------------------------------------------
// 1. PROCEDURAL SYNCHRONIZED FOLEY (111.24s)
// -------------------------------------------------------------
console.log('1. Synthesizing multi-track procedural Foley for Act 1...');
{
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const samples = new Float32Array(n);
  let seed = 91823;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // Helper sound synthesizers
  const addChime = (sec, freq = 880, vol = 0.25) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 1.5; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 3.2);
      const wave = Math.sin(2 * Math.PI * freq * t) * 0.5 + Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.3;
      if (s + i < n) samples[s + i] += wave * env * vol;
    }
  };

  const addHum = (startSec, durSec, vol = 0.15) => {
    const s = Math.floor(startSec * rate);
    const dur = Math.floor(durSec * rate);
    for (let i = 0; i < dur; i++) {
      const t = i / rate;
      const env = Math.min(1, t * 5) * Math.max(0, 1 - (t - (durSec - 0.3)) * 3);
      const hum = (Math.sin(2 * Math.PI * 120 * t) + Math.sin(2 * Math.PI * 240 * t) * 0.4 + (rand() - 0.5) * 0.15) * vol;
      if (s + i < n) samples[s + i] += hum * env;
    }
  };

  const addWristTap = (sec, vol = 0.3) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.15; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 45);
      const snap = (rand() - 0.5) * 0.6 + Math.sin(2 * Math.PI * 520 * t) * 0.4;
      if (s + i < n) samples[s + i] += snap * env * vol;
    }
  };

  const addWhoosh = (sec, vol = 0.2) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.6; i++) {
      const t = i / rate;
      const env = Math.sin(Math.PI * (t / 0.6));
      const noise = (rand() - 0.5) * env * vol;
      if (s + i < n) samples[s + i] += noise;
    }
  };

  // Foley Events throughout Act 1:
  addChime(3.5, 880, 0.28); // Menu spawn
  addHum(8.0, 3.0, 0.18);   // Touch hologram
  addWristTap(15.2, 0.35);  // Wrist tap 1
  addWristTap(15.5, 0.35);  // Wrist tap 2
  addWhoosh(19.0, 0.22);    // Window pan
  addChime(42.0, 720, 0.2); // 7-day calendar HUD spawn
  addWristTap(72.0, 0.3);   // Wrist tap demo 1
  addWristTap(72.3, 0.3);   // Wrist tap demo 2
  addWhoosh(73.0, 0.3);     // Reset rewind simulation
  addChime(95.0, 1100, 0.25); // Godhood to prison title card

  // Clock tick ambience every 1 second
  for (let s = 0; s < DURATION; s += 1.0) {
    const sIdx = Math.floor(s * rate);
    for (let i = 0; i < rate * 0.04; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 140);
      const tick = (rand() - 0.5) * 0.12 + Math.sin(2 * Math.PI * 1900 * t) * 0.08;
      if (sIdx + i < n) samples[sIdx + i] += tick * env * 0.1;
    }
  }

  // Write WAV
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // Mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);

  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.floor(s < 0 ? s * 32768 : s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(TEMP_SFX, buf);
  console.log('✓ Act 1 Foley synthesized.');
}

// -------------------------------------------------------------
// 2. MIX NARRATION + FOLEY
// -------------------------------------------------------------
console.log('2. Mixing narration and procedural Foley for Act 1...');
{
  const ffmpegAudio = spawn('ffmpeg', [
    '-v', 'error', '-y',
    '-i', AUDIO_VOICE,
    '-i', TEMP_SFX,
    '-filter_complex', '[0:a]volume=1.05[v];[1:a]volume=0.85[s];[v][s]amix=inputs=2:duration=first:dropout_transition=2[out]',
    '-map', '[out]',
    '-c:a', 'pcm_s16le',
    '-ar', '48000',
    TEMP_MIXED
  ]);
  await once(ffmpegAudio, 'close');
  console.log('✓ Act 1 Audio mixed.');
}

// -------------------------------------------------------------
// 3. FRAME RENDERING PIPELINE
// -------------------------------------------------------------
console.log('3. Rendering video frames for Act 1...');
const ffmpegVideo = spawn('ffmpeg', [
  '-v', 'error', '-y',
  '-f', 'image2pipe',
  '-vcodec', 'png',
  '-r', `${FPS}`,
  '-i', '-',
  '-i', TEMP_MIXED,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  OUTPUT_FILE
]);

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Load captions for Act 1
const allCaptions = JSON.parse(fs.readFileSync('projects/ep04-save-point/build/captions.json', 'utf8'));
const act1Captions = allCaptions.filter(c => c.start < DURATION);

function getCaption(sec) {
  const c = act1Captions.find(x => sec >= x.start && sec <= x.end);
  return c ? c.text : '';
}

// Draw Magi with IK
function drawMagi(ctx, x, y, options = {}) {
  const {
    scale = 1.0,
    headLook = 0,
    armTargetL = null,
    armTargetR = null,
    expression = 'normal',
    wristTap = 0,
    isSitting = true
  } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const r = 24;
  const spineLen = 75;
  const shoulderY = -spineLen + 15;
  const hipY = 0;

  // Spine
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(0, -spineLen);
  ctx.stroke();

  // Yellow Scarf
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(0, -spineLen + 8, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, -spineLen + 8);
  ctx.lineTo(14, -spineLen + 32);
  ctx.lineTo(2, -spineLen + 30);
  ctx.closePath();
  ctx.fill();

  // Head
  const headCY = -spineLen - r + 4;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, headCY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wizard Hat
  ctx.fillStyle = '#6366F1';
  ctx.strokeStyle = '#4338CA';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-32, headCY - 12);
  ctx.quadraticCurveTo(0, headCY - 20, 32, headCY - 12);
  ctx.quadraticCurveTo(0, headCY - 6, -32, headCY - 12);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-20, headCY - 14);
  ctx.quadraticCurveTo(-12, headCY - 50, 6, headCY - 65);
  ctx.quadraticCurveTo(10, headCY - 40, 20, headCY - 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Star on hat
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(2, headCY - 36, 5, 0, Math.PI * 2);
  ctx.fill();

  // Face Expression
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  if (expression === 'sleepy') {
    ctx.beginPath();
    ctx.moveTo(-12, headCY);
    ctx.lineTo(-4, headCY - 2);
    ctx.moveTo(4, headCY - 2);
    ctx.lineTo(12, headCY);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, headCY + 11, 4, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (expression === 'amazed') {
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-8, headCY - 1, 3.5, 0, Math.PI * 2);
    ctx.arc(8, headCY - 1, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, headCY + 10, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-7 + headLook * 2, headCY - 1, 2.5, 0, Math.PI * 2);
    ctx.arc(7 + headLook * 2, headCY - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, headCY + 7, 7, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  // Glasses
  ctx.beginPath();
  ctx.arc(-8, headCY - 1, 7, 0, Math.PI * 2);
  ctx.arc(8, headCY - 1, 7, 0, Math.PI * 2);
  ctx.moveTo(-1, headCY - 1);
  ctx.lineTo(1, headCY - 1);
  ctx.stroke();

  // Arms with 2-Bone IK
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  const boneLen = 35;

  let targetL = armTargetL || [-30, shoulderY + 50];
  let ikL = solve2BoneIK([0, shoulderY], targetL, boneLen, boneLen, -1);

  let targetR = armTargetR || [30, shoulderY + 50];
  if (wristTap > 0) {
    const tapX = lerp(30, 8, wristTap);
    const tapY = lerp(shoulderY + 50, shoulderY + 25, wristTap);
    targetR = [tapX, tapY];
    const tapXL = lerp(-30, -8, wristTap);
    targetL = [tapXL, tapY];
    ikL = solve2BoneIK([0, shoulderY], targetL, boneLen, boneLen, -1);
  }

  const ikR = solve2BoneIK([0, shoulderY], targetR, boneLen, boneLen, 1);
  ctx.beginPath();
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(ikL[1][0], ikL[1][1]);
  ctx.lineTo(ikL[2][0], ikL[2][1]);
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(ikR[1][0], ikR[1][1]);
  ctx.lineTo(ikR[2][0], ikR[2][1]);
  ctx.stroke();

  // Legs
  if (isSitting) {
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(-20, hipY + 45);
    ctx.lineTo(-45, hipY + 45);
    ctx.moveTo(0, hipY);
    ctx.lineTo(20, hipY + 45);
    ctx.lineTo(45, hipY + 45);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(-15, hipY + 80);
    ctx.moveTo(0, hipY);
    ctx.lineTo(15, hipY + 80);
    ctx.stroke();
  }

  ctx.restore();
}

// Draw Glowing Save Point Hologram Card
function drawHologramMenu(ctx, cx, cy, springVal, options = {}) {
  const { title = 'SAVE POINT CREATED', subtitle = 'DAY 1 · 07:00 AM', status = 'STATUS: ACTIVE QUICKSAVE', instruction = '', sparkT = 0 } = options;
  if (springVal < 0.01) return;

  ctx.save();
  ctx.translate(cx, cy);

  const w = 400 * springVal;
  const h = 230 * springVal;

  // Glassmorphism background
  const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  grad.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
  grad.addColorStop(1, 'rgba(6, 78, 59, 0.35)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 16);
  ctx.fill();

  // Neon Cyber Glow Border
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#10B981';
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Corner HUD Brackets
  ctx.strokeStyle = '#34D399';
  ctx.lineWidth = 4;
  const cw = 20;
  // TL
  ctx.beginPath();
  ctx.moveTo(-w / 2 + cw, -h / 2);
  ctx.lineTo(-w / 2, -h / 2);
  ctx.lineTo(-w / 2, -h / 2 + cw);
  ctx.stroke();
  // TR
  ctx.beginPath();
  ctx.moveTo(w / 2 - cw, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2 + cw);
  ctx.stroke();
  // BL
  ctx.beginPath();
  ctx.moveTo(-w / 2 + cw, h / 2);
  ctx.lineTo(-w / 2, h / 2);
  ctx.lineTo(-w / 2, h / 2 - cw);
  ctx.stroke();
  // BR
  ctx.beginPath();
  ctx.moveTo(w / 2 - cw, h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(w / 2, h / 2 - cw);
  ctx.stroke();

  // Scanlines
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.12)';
  ctx.lineWidth = 1;
  for (let y = -h / 2 + 10; y < h / 2; y += 12) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 12, y);
    ctx.lineTo(w / 2 - 12, y);
    ctx.stroke();
  }

  if (springVal > 0.8) {
    // Status indicator
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(-w / 2 + 35, -h / 2 + 35, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#A7F3D0';
    ctx.font = 'bold 15px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText(status, -w / 2 + 50, -h / 2 + 40);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText(title, 0, -h / 2 + 85);

    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 19px NotoSans';
    ctx.fillText(subtitle, 0, -h / 2 + 115);

    if (instruction) {
      ctx.fillStyle = '#FEF08A';
      ctx.font = 'bold 17px NotoSans';
      ctx.fillText(instruction, 0, -h / 2 + 170);
    }
  }

  // Spark contact
  if (sparkT > 0) {
    ctx.strokeStyle = `rgba(56, 189, 248, ${sparkT})`;
    ctx.lineWidth = 2.5;
    for (let s = 0; s < 8; s++) {
      const ang = (s * 45) * Math.PI / 180;
      const dist = 22 + Math.sin(sparkT * 10) * 8;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(-w / 2 + Math.cos(ang) * dist, Math.sin(ang) * dist);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// -------------------------------------------------------------
// RENDER LOOP
// -------------------------------------------------------------
for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Scene Switching:
  // Scene 1 (0 to 35s): Bedroom waking up, save prompt spawns, electric spark, tap wrists
  // Scene 2 (35 to 65s): Window looking out at normal city (cars, buses, normal world)
  // Scene 3 (65 to 90s): 7-Day Matrix calendar HUD & Zero Consequences demo
  // Scene 4 (90 to 111.24s): Climax transition: Godhood vs Prison cinematic card

  // Base background: Midnight Blue with radial vignette
  const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 80, WIDTH / 2, HEIGHT / 2, 720);
  bgGrad.addColorStop(0, '#0F172A');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle coordinate grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  if (t < 35.0) {
    // SCENE 1: BEDROOM & PROMPT SPAWN
    // Bed
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(180, 480, 520, 140);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(180, 480, 520, 140);

    // Alarm Clock: 07:00 AM
    ctx.fillStyle = '#090D16';
    ctx.fillRect(100, 440, 130, 60);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 440, 130, 60);
    ctx.fillStyle = '#38BDF8';
    ctx.font = '24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('07:00 AM', 165, 478);

    let expr = 'sleepy';
    let reachR = [30, -25];
    let wristTap = 0;
    let sparkT = 0;

    if (t > 2.5 && t < 7.0) expr = 'amazed';
    else if (t >= 7.0 && t < 12.0) {
      expr = 'amazed';
      // Hand reaches to touch menu
      const reachProgress = clamp((t - 7.5) / 1.5);
      reachR = [lerp(30, 140, ease(reachProgress)), lerp(-25, -75, ease(reachProgress))];
      if (t >= 9.0 && t <= 11.0) sparkT = Math.sin((t - 9.0) / 2.0 * Math.PI);
    } else if (t >= 12.0) {
      expr = 'smile';
      // Double wrist tap at t = 15.0 and t = 16.5
      if ((t >= 14.8 && t <= 15.5) || (t >= 16.3 && t <= 17.0)) {
        const cycle = t < 16.0 ? (t - 14.8) / 0.7 : (t - 16.3) / 0.7;
        wristTap = Math.sin(cycle * Math.PI);
      }
    }

    drawMagi(ctx, 420, 490, {
      scale: 1.15,
      expression: expr,
      armTargetR: reachR,
      wristTap,
      isSitting: true
    });

    // Hologram Spring Popup
    const hSpring = spring({ frame, fps: FPS, config: { damping: 10, stiffness: 120, mass: 0.8 }, delay: 2.5 * FPS });
    let instruct = '';
    if (t > 11.0) instruct = '"Tap wrists together twice to reload"';
    drawHologramMenu(ctx, 790, 340, hSpring, {
      title: 'SAVE POINT CREATED',
      subtitle: 'DAY 1 · 07:00 AM',
      status: 'STATUS: ACTIVE QUICKSAVE',
      instruction: instruct,
      sparkT
    });

  } else if (t >= 35.0 && t < 65.0) {
    // SCENE 2: WINDOW LOOKING OUT AT THE NORMAL WORLD (Streets, Bus, Normal People)
    ctx.save();

    // Window Frame
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(80, 80, 700, 520);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.strokeRect(80, 80, 700, 520);

    // City street inside window
    ctx.save();
    ctx.beginPath();
    ctx.rect(84, 84, 692, 512);
    ctx.clip();

    // Sky in window
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(84, 84, 692, 300);

    // Distant Skyscrapers
    ctx.fillStyle = '#0369A1';
    ctx.fillRect(120, 160, 90, 240);
    ctx.fillRect(240, 110, 110, 290);
    ctx.fillRect(380, 180, 80, 220);
    ctx.fillRect(490, 130, 120, 270);
    ctx.fillRect(640, 200, 90, 200);

    // Road
    ctx.fillStyle = '#334155';
    ctx.fillRect(84, 400, 692, 200);

    // Road dashed stripes
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 4;
    ctx.setLineDash([25, 20]);
    ctx.beginPath();
    ctx.moveTo(84, 500);
    ctx.lineTo(776, 500);
    ctx.stroke();
    ctx.setLineDash([]);

    // Moving City Bus
    const busX = 100 + ((t * 85) % 850) - 200;
    ctx.fillStyle = '#3B82F6';
    ctx.roundRect(busX, 420, 180, 75, 8);
    ctx.fill();
    ctx.strokeStyle = '#1D4ED8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bus Windows
    ctx.fillStyle = '#E0F2FE';
    for (let bx = 15; bx < 165; bx += 32) {
      ctx.fillRect(busX + bx, 430, 24, 25);
    }
    // Bus wheels
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(busX + 40, 498, 14, 0, Math.PI * 2);
    ctx.arc(busX + 140, 498, 14, 0, Math.PI * 2);
    ctx.fill();

    // Moving Car
    const carX = 750 - ((t * 130) % 950);
    ctx.fillStyle = '#EF4444';
    ctx.roundRect(carX, 515, 110, 45, 6);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(carX + 25, 560, 10, 0, Math.PI * 2);
    ctx.arc(carX + 85, 560, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Window Pane Crossbars
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(430, 80);
    ctx.lineTo(430, 600);
    ctx.moveTo(80, 340);
    ctx.lineTo(780, 340);
    ctx.stroke();

    ctx.restore();

    // Magi standing looking out the window
    drawMagi(ctx, 960, 480, {
      scale: 1.25,
      headLook: -1,
      expression: 'amazed',
      isSitting: false,
      armTargetL: [-35, 15],
      armTargetR: [15, 25]
    });

    // Tag above window: "THE OUTSIDE WORLD IS NORMAL. EXCEPT FOR YOU."
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 22px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('The Outside World Moves Forward Normally...', 430, 55);

  } else if (t >= 65.0 && t < 90.0) {
    // SCENE 3: 7-DAY MATRIX CALENDAR HUD & ZERO CONSEQUENCES
    ctx.save();

    // 7-Day Holographic Calendar Grid
    const calW = 860;
    const calH = 220;
    const calX = (WIDTH - calW) / 2;
    const calY = 120;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(calX, calY, calW, calH, 16);
    ctx.fill();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 20px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('ACTIVE SAVE TIMELINE: 7 DAYS BUFFER', WIDTH / 2, calY + 36);

    // 7 Day Boxes
    const colW = (calW - 60) / 7;
    for (let d = 1; d <= 7; d++) {
      const bx = calX + 30 + (d - 1) * colW;
      const by = calY + 60;
      const bw = colW - 12;
      const bh = 130;

      const isDay1 = d === 1;
      ctx.fillStyle = isDay1 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.5)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.fill();

      ctx.strokeStyle = isDay1 ? '#34D399' : '#475569';
      ctx.lineWidth = isDay1 ? 2.5 : 1;
      ctx.stroke();

      ctx.fillStyle = isDay1 ? '#34D399' : '#94A3B8';
      ctx.font = 'bold 16px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText(`DAY ${d}`, bx + bw / 2, by + 30);

      if (isDay1) {
        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 12px NotoSans';
        ctx.fillText('ACTIVE', bx + bw / 2, by + 58);
        ctx.fillText('07:00 AM', bx + bw / 2, by + 76);
        ctx.fillText('ANCHOR', bx + bw / 2, by + 94);
      } else {
        ctx.fillStyle = '#64748B';
        ctx.font = '13px NotoSans';
        ctx.fillText('LOCKED', bx + bw / 2, by + 70);
      }
    }

    // Demonstrating the Wrist Tap Return Loop
    const loopProgress = (t - 65.0) % 6.0 / 6.0;
    const arrowX = lerp(calX + 30 + colW * 4, calX + 30 + colW * 0.5, ease(loopProgress));

    // Curved Rewind Arrow from Day 5 back to Day 1
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(calX + 30 + colW * 4, calY + calH + 20);
    ctx.quadraticCurveTo(WIDTH / 2, calY + calH + 90, calX + 30 + colW * 0.5, calY + calH + 20);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#F43F5E';
    ctx.font = 'bold 17px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('DOUBLE TAP WRISTS: INSTANT ZERO-SECOND RESET TO DAY 1 · 07:00 AM', WIDTH / 2, calY + calH + 85);

    // Magi standing below conducting the timeline
    drawMagi(ctx, 220, 520, {
      scale: 1.15,
      headLook: 1,
      expression: 'smile',
      isSitting: false,
      armTargetR: [45, -30],
      armTargetL: [-30, 20]
    });

    ctx.restore();

  } else {
    // SCENE 4 (90 to 111.24s): "At first, it feels like godhood. By day seven, it becomes a terrifying prison."
    ctx.save();

    const splitSpring = spring({ frame, fps: FPS, config: { damping: 12, stiffness: 90, mass: 1 }, delay: 90 * FPS });

    // Left Card: Day 1 Godhood
    const cardW = 460 * splitSpring;
    const cardH = 340 * splitSpring;

    // Day 1: Godhood (Cyan / Emerald)
    ctx.save();
    ctx.translate(340, 320);
    ctx.fillStyle = 'rgba(6, 78, 59, 0.4)';
    ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    ctx.fill();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 28px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('DAY 1: GODHOOD', 0, -cardH / 2 + 55);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '20px NotoSans';
    ctx.fillText('+ Zero Consequences', 0, -cardH / 2 + 115);
    ctx.fillText('+ Endless Retries', 0, -cardH / 2 + 165);
    ctx.fillText('+ Fear Disappears', 0, -cardH / 2 + 215);
    ctx.fillText('+ Ultimate Freedom', 0, -cardH / 2 + 265);
    ctx.restore();

    // Right Card: Day 7 Prison (Crimson / Violet)
    ctx.save();
    ctx.translate(940, 320);
    ctx.fillStyle = 'rgba(76, 5, 25, 0.4)';
    ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
    ctx.fill();
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#F43F5E';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FB7185';
    ctx.font = 'bold 28px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('DAY 7: THE PRISON', 0, -cardH / 2 + 55);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '20px NotoSans';
    ctx.fillText('- Maximization Paralysis', 0, -cardH / 2 + 115);
    ctx.fillText('- Butterfly Chaos', 0, -cardH / 2 + 165);
    ctx.fillText('- Isolated Memories', 0, -cardH / 2 + 215);
    ctx.fillText('- Weightless Existence', 0, -cardH / 2 + 265);
    ctx.restore();

    // Central VS Badge
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(WIDTH / 2, 320, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px NotoSans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', WIDTH / 2, 320);

    ctx.restore();
  }

  // Top Header
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 30px CaveatHand';
  ctx.textAlign = 'center';
  ctx.fillText('What If You Had a Real-Life Save Point? (Part 1: The Quicksave)', WIDTH / 2, 45);

  // Bottom Subtitle Caption Pill
  const currentCaption = getCaption(t);
  if (currentCaption) {
    ctx.font = 'bold 20px CaveatHand';
    const textWidth = ctx.measureText(currentCaption).width;
    const pillW = Math.min(WIDTH - 120, textWidth + 48);
    const pillH = 44;
    const pillX = (WIDTH - pillW) / 2;
    const pillY = HEIGHT - 68;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 22);
    ctx.fill();

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentCaption, WIDTH / 2, pillY + pillH / 2);
  }

  // Pipe PNG frame to ffmpeg
  const pngBuffer = canvas.toBuffer('image/png');
  ffmpegVideo.stdin.write(pngBuffer);

  if (frame % 150 === 0) {
    console.log(`Act 1 Progress: ${(frame / TOTAL_FRAMES * 100).toFixed(1)}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
  }
}

ffmpegVideo.stdin.end();
await once(ffmpegVideo, 'close');

console.log(`\n🎉 Act 1 Hook Masterpiece rendered successfully: ${OUTPUT_FILE}`);

