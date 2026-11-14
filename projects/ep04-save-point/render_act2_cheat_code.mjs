import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, GlobalFonts } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';
import { solve2BoneIK } from '../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const AUDIO_VOICE = path.resolve('projects/ep04-save-point/build/narration/ch2.wav');
const DURATION = 77.00;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const OUTPUT_FILE = path.resolve('exports/EP04-Act2-CheatCode-Masterpiece.mp4');
const TEMP_SFX = '/tmp/ep04_act2_sfx.wav';
const TEMP_MIXED = '/tmp/ep04_act2_audio.wav';

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };

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
// 1. PROCEDURAL SYNCHRONIZED FOLEY (77.0s)
// -------------------------------------------------------------
console.log('1. Synthesizing procedural Foley for Act 2...');
{
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const samples = new Float32Array(n);
  let seed = 77281;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const addChime = (sec, freq = 900, vol = 0.25) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 1.2; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 3.5);
      const wave = Math.sin(2 * Math.PI * freq * t) * 0.5 + Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.3;
      if (s + i < n) samples[s + i] += wave * env * vol;
    }
  };

  const addNapkinSlide = (sec, vol = 0.25) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.4; i++) {
      const t = i / rate;
      const env = Math.sin(Math.PI * (t / 0.4));
      const noise = (rand() - 0.5) * env * vol;
      if (s + i < n) samples[s + i] += noise;
    }
  };

  const addBuzzer = (sec, vol = 0.3) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.6; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 4);
      const tone = Math.sin(2 * Math.PI * 180 * t) * 0.6 + Math.sin(2 * Math.PI * 360 * t) * 0.4;
      if (s + i < n) samples[s + i] += tone * env * vol;
    }
  };

  const addWristTap = (sec, vol = 0.35) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.15; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 45);
      const snap = (rand() - 0.5) * 0.6 + Math.sin(2 * Math.PI * 520 * t) * 0.4;
      if (s + i < n) samples[s + i] += snap * env * vol;
    }
  };

  const addRewindWhoosh = (sec, vol = 0.35) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 1.0; i++) {
      const t = i / rate;
      // Rising pitch for tape rewind
      const freq = 300 + 1200 * (t / 1.0);
      const env = Math.sin(Math.PI * (t / 1.0));
      const noise = ((rand() - 0.5) * 0.5 + Math.sin(2 * Math.PI * freq * t) * 0.5) * env * vol;
      if (s + i < n) samples[s + i] += noise;
    }
  };

  // Foley Cues
  addChime(4.0, 1050, 0.2);     // Freedom unlock chime
  addNapkinSlide(34.0, 0.28);   // Crush slides napkin
  addBuzzer(51.0, 0.32);        // Boss rage: YOU'RE FIRED
  addWristTap(57.2, 0.38);      // Wrist tap 1
  addWristTap(57.5, 0.38);      // Wrist tap 2
  addRewindWhoosh(58.0, 0.4);   // Tape rewind flash
  addChime(61.5, 880, 0.25);    // Back in bed chime
  addChime(71.0, 1200, 0.25);   // Superpower lesson pill

  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
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
  console.log('✓ Act 2 Foley synthesized.');
}

// -------------------------------------------------------------
// 2. MIX NARRATION + FOLEY
// -------------------------------------------------------------
console.log('2. Mixing audio for Act 2...');
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
  console.log('✓ Act 2 Audio mixed.');
}

// -------------------------------------------------------------
// 3. FRAME RENDERING PIPELINE
// -------------------------------------------------------------
console.log('3. Rendering video frames for Act 2...');
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

const allCaptions = JSON.parse(fs.readFileSync('projects/ep04-save-point/build/captions.json', 'utf8'));
// Offset for Act 2 (starts after ch1 = 111.24s)
const ACT2_OFFSET = 111.24;
function getCaption(sec) {
  const globalSec = sec + ACT2_OFFSET;
  const c = allCaptions.find(x => globalSec >= x.start && globalSec <= x.end);
  return c ? c.text : '';
}

// Generic stickman renderer with analytical IK
function drawHuman(ctx, x, y, options = {}) {
  const {
    scale = 1.0,
    headColor = '#FFFFFF',
    torsoColor = '#E2E8F0',
    isBoss = false,
    isCrush = false,
    expression = 'normal',
    armTargetL = null,
    armTargetR = null,
    facing = 1, // 1 right, -1 left
    rageLevel = 0 // 0 to 1
  } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);

  const r = 24;
  const spineLen = 75;
  const shoulderY = -spineLen + 15;
  const hipY = 0;

  ctx.strokeStyle = torsoColor;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Torso
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(0, -spineLen);
  ctx.stroke();

  if (isBoss) {
    // Red necktie
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(0, shoulderY);
    ctx.lineTo(-6, shoulderY + 28);
    ctx.lineTo(0, shoulderY + 35);
    ctx.lineTo(6, shoulderY + 28);
    ctx.closePath();
    ctx.fill();
  }

  // Head
  const headCY = -spineLen - r + 4;
  const faceFill = rageLevel > 0 ? `rgb(${Math.floor(lerp(255, 239, rageLevel))}, ${Math.floor(lerp(255, 68, rageLevel))}, ${Math.floor(lerp(255, 68, rageLevel))})` : headColor;
  ctx.fillStyle = faceFill;
  ctx.beginPath();
  ctx.arc(0, headCY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Crush Features (hair & blush)
  if (isCrush) {
    // Long hair
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.arc(0, headCY - 4, r + 2, 0.8 * Math.PI, 2.2 * Math.PI);
    ctx.lineTo(r + 6, headCY + 28);
    ctx.lineTo(-r - 6, headCY + 28);
    ctx.closePath();
    ctx.fill();

    // Blush
    ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.beginPath();
    ctx.arc(-11, headCY + 5, 5, 0, Math.PI * 2);
    ctx.arc(11, headCY + 5, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Face Expression
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  if (rageLevel > 0.3) {
    // Angry eyebrows
    ctx.beginPath();
    ctx.moveTo(-10, headCY - 6);
    ctx.lineTo(-2, headCY - 2);
    ctx.moveTo(10, headCY - 6);
    ctx.lineTo(2, headCY - 2);
    ctx.stroke();
    // Shouting open mouth
    ctx.fillStyle = '#7F1D1D';
    ctx.beginPath();
    ctx.ellipse(0, headCY + 9, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'smile') {
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-7, headCY - 1, 2.5, 0, Math.PI * 2);
    ctx.arc(7, headCY - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, headCY + 7, 7, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-7, headCY - 1, 2.5, 0, Math.PI * 2);
    ctx.arc(7, headCY - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, headCY + 9);
    ctx.lineTo(4, headCY + 9);
    ctx.stroke();
  }

  // Arms with IK
  ctx.strokeStyle = torsoColor;
  ctx.lineWidth = 4;
  const boneLen = 35;

  let targetL = armTargetL || [-25, shoulderY + 50];
  let ikL = solve2BoneIK([0, shoulderY], targetL, boneLen, boneLen, -1);
  let targetR = armTargetR || [25, shoulderY + 50];
  let ikR = solve2BoneIK([0, shoulderY], targetR, boneLen, boneLen, 1);

  ctx.beginPath();
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(ikL[1][0], ikL[1][1]);
  ctx.lineTo(ikL[2][0], ikL[2][1]);
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(ikR[1][0], ikR[1][1]);
  ctx.lineTo(ikR[2][0], ikR[2][1]);
  ctx.stroke();

  // Legs standing
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(-15, hipY + 80);
  ctx.moveTo(0, hipY);
  ctx.lineTo(15, hipY + 80);
  ctx.stroke();

  ctx.restore();
}

// Magi stickman wrapper
function drawMagi(ctx, x, y, options = {}) {
  const {
    scale = 1.0,
    headLook = 0,
    armTargetL = null,
    armTargetR = null,
    expression = 'smile',
    wristTap = 0,
    facing = 1,
    isSitting = false
  } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);

  const r = 24;
  const spineLen = 75;
  const shoulderY = -spineLen + 15;
  const hipY = 0;

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

  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(2, headCY - 36, 5, 0, Math.PI * 2);
  ctx.fill();

  // Glasses & Face
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(-7 + headLook * 2, headCY - 1, 2.5, 0, Math.PI * 2);
  ctx.arc(7 + headLook * 2, headCY - 1, 2.5, 0, Math.PI * 2);
  ctx.fill();

  if (expression === 'smile') {
    ctx.beginPath();
    ctx.arc(0, headCY + 7, 7, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-4, headCY + 9);
    ctx.lineTo(4, headCY + 9);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(-8, headCY - 1, 7, 0, Math.PI * 2);
  ctx.arc(8, headCY - 1, 7, 0, Math.PI * 2);
  ctx.moveTo(-1, headCY - 1);
  ctx.lineTo(1, headCY - 1);
  ctx.stroke();

  // Arms with IK
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  const boneLen = 35;

  let targetL = armTargetL || [-30, shoulderY + 50];
  let targetR = armTargetR || [30, shoulderY + 50];

  if (wristTap > 0) {
    const tapX = lerp(30, 8, wristTap);
    const tapY = lerp(shoulderY + 50, shoulderY + 25, wristTap);
    targetR = [tapX, tapY];
    const tapXL = lerp(-30, -8, wristTap);
    targetL = [tapXL, tapY];
  }

  let ikL = solve2BoneIK([0, shoulderY], targetL, boneLen, boneLen, -1);
  let ikR = solve2BoneIK([0, shoulderY], targetR, boneLen, boneLen, 1);

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

// -------------------------------------------------------------
// RENDER LOOP FOR ACT 2 (0 to 77.0s)
// -------------------------------------------------------------
for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background
  const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 80, WIDTH / 2, HEIGHT / 2, 720);
  bgGrad.addColorStop(0, '#0F172A');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Sub-scenes:
  // 1 (0 to 18s): Fear Gauges Dropping to 0%
  // 2 (18 to 42s): Coffee Shop & Crush Napkin
  // 3 (42 to 57s): Office Boss Screaming "YOU'RE FIRED!"
  // 4 (57 to 61s): Wrist Tap & VHS Rewind Flash
  // 5 (61 to 77s): Waking up at 7:00 AM in bed with smirk: "Consequences Are Just Data"

  if (t < 18.0) {
    // SCENE 1: THE FEAR GAUGES DROPPING
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 28px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('FEAR WAS YOUR SILENT MANAGER', WIDTH / 2, 80);

    const fearSpring = clamp((t - 4.0) / 3.0);
    const dropVal = ease(fearSpring);

    const gauges = [
      { label: 'Fear of Looking Stupid', orig: 94, cur: lerp(94, 0, dropVal), color: '#EF4444' },
      { label: 'Fear of Rejection', orig: 98, cur: lerp(98, 0, dropVal), color: '#F59E0B' },
      { label: 'Fear of Losing Money', orig: 91, cur: lerp(91, 0, dropVal), color: '#3B82F6' }
    ];

    gauges.forEach((g, idx) => {
      const gy = 150 + idx * 75;
      const gw = 640;
      const gx = (WIDTH - gw) / 2;

      ctx.fillStyle = '#1E293B';
      ctx.roundRect(gx, gy, gw, 52, 10);
      ctx.fill();

      // Filled progress bar
      const fillW = gw * (g.cur / 100);
      ctx.fillStyle = g.cur > 10 ? g.color : '#10B981';
      ctx.roundRect(gx, gy, Math.max(12, fillW), 52, 10);
      ctx.fill();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 18px NotoSans';
      ctx.textAlign = 'left';
      ctx.fillText(g.label, gx + 20, gy + 32);

      ctx.textAlign = 'right';
      ctx.font = 'bold 20px NotoSans';
      ctx.fillText(`${Math.round(g.cur)}%`, gx + gw - 20, gy + 32);
    });

    // Magi standing below smiling with hands on hips
    drawMagi(ctx, WIDTH / 2, 540, {
      scale: 1.25,
      expression: 'smile',
      armTargetL: [-35, 10],
      armTargetR: [35, 10]
    });

  } else if (t >= 18.0 && t < 42.0) {
    // SCENE 2: COFFEE SHOP & CRUSH
    // Wooden coffee counter
    ctx.fillStyle = '#78350F';
    ctx.fillRect(400, 420, 480, 180);
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 4;
    ctx.strokeRect(400, 420, 480, 180);

    // Coffee machine
    ctx.fillStyle = '#475569';
    ctx.fillRect(430, 290, 140, 130);
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 3;
    ctx.strokeRect(430, 290, 140, 130);

    // Warm cafe sign: "CAFE"
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 24px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText('Morning Brew Co.', 500, 260);

    // Crush standing behind counter
    drawHuman(ctx, 580, 420, {
      scale: 1.15,
      isCrush: true,
      expression: 'smile',
      facing: -1,
      armTargetL: [-20, 30],
      armTargetR: [20, 30]
    });

    // Magi walking up and talking
    const walkProgress = clamp((t - 18.0) / 4.0);
    const magiX = lerp(120, 320, ease(walkProgress));
    drawMagi(ctx, magiX, 420, {
      scale: 1.15,
      facing: 1,
      expression: 'smile',
      armTargetR: [35, -20], // gestures boldly
      armTargetL: [-25, 20]
    });

    // Napkin sliding across counter at t >= 32.0s
    if (t >= 32.0) {
      const napSpring = spring({ frame, fps: FPS, config: { damping: 12, stiffness: 100, mass: 1 }, delay: 32 * FPS });
      const napX = lerp(550, 420, napSpring);
      ctx.fillStyle = '#F8FAFC';
      ctx.roundRect(napX, 410, 70, 40, 4);
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 12px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText('555-0199', napX + 35, 435);
    }

  } else if (t >= 42.0 && t < 57.0) {
    // SCENE 3: OFFICE PARKING LOT & ANGRY BOSS
    // Office building in background
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(80, 120, 400, 480);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(80, 120, 400, 480);

    // Parking lot asphalt
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 520, WIDTH, 200);

    const rage = clamp((t - 47.0) / 4.0);

    // Angry Boss
    drawHuman(ctx, 880, 520, {
      scale: 1.25,
      isBoss: true,
      facing: -1,
      rageLevel: rage,
      armTargetL: [-40, -40], // flailing arms
      armTargetR: [40, -40]
    });

    // Boss shout speech bubble
    if (t >= 49.0) {
      const bubbleSpring = spring({ frame, fps: FPS, config: { damping: 10, stiffness: 140, mass: 0.8 }, delay: 49 * FPS });
      ctx.save();
      ctx.translate(760, 240);
      ctx.scale(bubbleSpring, bubbleSpring);
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.roundRect(-160, -50, 320, 100, 16);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText("YOU'RE FIRED!", 0, 10);
      ctx.restore();
    }

    // Magi standing calmly with hands in pockets smiling
    drawMagi(ctx, 480, 520, {
      scale: 1.25,
      facing: 1,
      expression: 'smile',
      armTargetL: [-15, 30],
      armTargetR: [15, 30]
    });

  } else if (t >= 57.0 && t < 61.0) {
    // SCENE 4: WRIST TAP & VHS REWIND FLASH
    const rewindT = t - 57.0;

    // Magi in center tapping wrists together
    drawMagi(ctx, WIDTH / 2, 480, {
      scale: 1.35,
      expression: 'smile',
      wristTap: Math.sin(rewindT * 6.0)
    });

    // Full white flash at t = 58.0
    if (rewindT >= 1.0 && rewindT <= 1.8) {
      const flashAlpha = Math.sin((rewindT - 1.0) / 0.8 * Math.PI);
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // VHS Glitch Lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 3;
    for (let g = 0; g < 8; g++) {
      const gy = (frame * 35 + g * 85) % HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(WIDTH, gy);
      ctx.stroke();
    }

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 32px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('<< RELOADING STATE: DAY 1 · 07:00 AM <<', WIDTH / 2, 100);

  } else {
    // SCENE 5: BACK IN BED AT 7:00 AM · "CONSEQUENCES ARE JUST DATA"
    // Bedroom bed
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(200, 480, 500, 140);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(200, 480, 500, 140);

    // Alarm Clock: 07:00 AM
    ctx.fillStyle = '#090D16';
    ctx.fillRect(120, 440, 130, 60);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.strokeRect(120, 440, 130, 60);
    ctx.fillStyle = '#38BDF8';
    ctx.font = '24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('07:00 AM', 185, 478);

    // Magi sitting up grinning
    drawMagi(ctx, 450, 490, {
      scale: 1.15,
      expression: 'smile',
      isSitting: true,
      armTargetL: [-35, 10],
      armTargetR: [35, 10]
    });

    // Big Lesson Card: "CONSEQUENCES ARE JUST DATA"
    const cardSpring = spring({ frame, fps: FPS, config: { damping: 10, stiffness: 120, mass: 0.8 }, delay: 65 * FPS });
    if (cardSpring > 0.05) {
      ctx.save();
      ctx.translate(WIDTH / 2, 220);
      ctx.scale(cardSpring, cardSpring);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.roundRect(-300, -60, 600, 120, 16);
      ctx.fill();

      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#10B981';
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 26px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText('LESSON ONE:', 0, -15);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px NotoSans';
      ctx.fillText('CONSEQUENCES ARE JUST DATA', 0, 25);
      ctx.restore();
    }
  }

  // Top Title
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 30px CaveatHand';
  ctx.textAlign = 'center';
  ctx.fillText('What If You Had a Real-Life Save Point? (Part 2: The Cheat Code)', WIDTH / 2, 45);

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

  const pngBuffer = canvas.toBuffer('image/png');
  ffmpegVideo.stdin.write(pngBuffer);

  if (frame % 150 === 0) {
    console.log(`Act 2 Progress: ${(frame / TOTAL_FRAMES * 100).toFixed(1)}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
  }
}

ffmpegVideo.stdin.end();
await once(ffmpegVideo, 'close');

console.log(`\n🎉 Act 2 Cheat Code Masterpiece rendered successfully: ${OUTPUT_FILE}`);

