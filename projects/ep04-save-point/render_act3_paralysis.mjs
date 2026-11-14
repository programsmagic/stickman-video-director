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
const AUDIO_VOICE = path.resolve('projects/ep04-save-point/build/narration/ch3.wav');
const DURATION = 84.36;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const OUTPUT_FILE = path.resolve('exports/EP04-Act3-Paralysis-Masterpiece.mp4');
const TEMP_SFX = '/tmp/ep04_act3_sfx.wav';
const TEMP_MIXED = '/tmp/ep04_act3_audio.wav';

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
// 1. PROCEDURAL FOLEY (84.36s)
// -------------------------------------------------------------
console.log('1. Synthesizing procedural Foley for Act 3...');
{
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const samples = new Float32Array(n);
  let seed = 83912;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const addCashRegister = (sec, vol = 0.3) => {
    const s = Math.floor(sec * rate);
    // Cha-ching: mechanical click + high dual bell
    for (let i = 0; i < rate * 0.1; i++) {
      const t = i / rate;
      samples[s + i] += (rand() - 0.5) * Math.exp(-t * 60) * 0.4;
    }
    for (let i = 0; i < rate * 1.5; i++) {
      const t = i / rate;
      const bell = (Math.sin(2 * Math.PI * 1800 * t) * 0.6 + Math.sin(2 * Math.PI * 2400 * t) * 0.4) * Math.exp(-t * 4);
      if (s + 2000 + i < n) samples[s + 2000 + i] += bell * vol;
    }
  };

  const addApplaud = (sec, dur = 2.0, vol = 0.18) => {
    const s = Math.floor(sec * rate);
    const len = Math.floor(dur * rate);
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      const env = Math.sin(Math.PI * (t / dur));
      const clap = (rand() - 0.5) * env * vol;
      if (s + i < n) samples[s + i] += clap;
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

  const addRewindWhoosh = (sec, vol = 0.3) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.8; i++) {
      const t = i / rate;
      const freq = 400 + 1000 * (t / 0.8);
      const env = Math.sin(Math.PI * (t / 0.8));
      const sound = ((rand() - 0.5) * 0.4 + Math.sin(2 * Math.PI * freq * t) * 0.6) * env * vol;
      if (s + i < n) samples[s + i] += sound;
    }
  };

  // Foley placements
  addCashRegister(16.5, 0.32);   // Wealthy trade ding
  addApplaud(30.0, 3.5, 0.22);   // Standing ovation clapping
  addWristTap(57.5, 0.35);       // Pizza reload tap
  addRewindWhoosh(58.0, 0.32);   // Rewind sound
  addWristTap(63.0, 0.35);       // Sushi reload tap
  addRewindWhoosh(63.5, 0.32);   // Rewind sound
  // Clock ticking in living room
  for (let s = 38.0; s < 70.0; s += 1.0) {
    const sIdx = Math.floor(s * rate);
    for (let i = 0; i < rate * 0.04; i++) {
      const t = i / rate;
      const tick = ((rand() - 0.5) * 0.1 + Math.sin(2 * Math.PI * 2200 * t) * 0.1) * Math.exp(-t * 120);
      if (sIdx + i < n) samples[sIdx + i] += tick * 0.15;
    }
  }

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
  console.log('✓ Act 3 Foley synthesized.');
}

// -------------------------------------------------------------
// 2. MIX NARRATION + FOLEY
// -------------------------------------------------------------
console.log('2. Mixing audio for Act 3...');
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
  console.log('✓ Act 3 Audio mixed.');
}

// -------------------------------------------------------------
// 3. FRAME RENDERING PIPELINE
// -------------------------------------------------------------
console.log('3. Rendering video frames for Act 3...');
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
const ACT3_OFFSET = 111.24 + 77.00; // 188.24s
function getCaption(sec) {
  const globalSec = sec + ACT3_OFFSET;
  const c = allCaptions.find(x => globalSec >= x.start && globalSec <= x.end);
  return c ? c.text : '';
}

// Draw Magi with IK
function drawMagi(ctx, x, y, options = {}) {
  const {
    scale = 1.0,
    headLook = 0,
    armTargetL = null,
    armTargetR = null,
    expression = 'smile',
    wristTap = 0,
    isSitting = false
  } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

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

  // Scarf
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

  // Hat
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

  // Face
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
  } else if (expression === 'confused' || expression === 'worried') {
    ctx.beginPath();
    ctx.arc(0, headCY + 12, 6, 1.1 * Math.PI, 1.9 * Math.PI);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-4, headCY + 9);
    ctx.lineTo(4, headCY + 9);
    ctx.stroke();
  }

  // Glasses
  ctx.beginPath();
  ctx.arc(-8, headCY - 1, 7, 0, Math.PI * 2);
  ctx.arc(8, headCY - 1, 7, 0, Math.PI * 2);
  ctx.moveTo(-1, headCY - 1);
  ctx.lineTo(1, headCY - 1);
  ctx.stroke();

  // Arms
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
// RENDER LOOP (84.36s)
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
  // 1 (0 to 24s): Stock Chart Spikes +300% & Bank Account Surge
  // 2 (24 to 38s): Flawless Presentation & Standing Ovation
  // 3 (38 to 68s): Couch Living Room, Dinner Optimization Loop (Pizza / Sushi / Curry)
  // 4 (68 to 84.36s): Maximization Paralysis: Satisfaction Collapse Curve

  if (t < 24.0) {
    // SCENE 1: STOCK CHART SURGE
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('DAY 2: THE FINANCIAL CHEAT CODE', WIDTH / 2, 80);

    // 3D Isometric Stock Chart
    const chartX = 140;
    const chartY = 120;
    const chartW = 720;
    const chartH = 340;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect(chartX, chartY, chartW, chartH, 16);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Chart gridlines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
    ctx.lineWidth = 1;
    for (let gy = chartY + 40; gy < chartY + chartH; gy += 60) {
      ctx.beginPath();
      ctx.moveTo(chartX + 20, gy);
      ctx.lineTo(chartX + chartW - 20, gy);
      ctx.stroke();
    }

    // Dynamic Candlestick Line
    const chartT = clamp(t / 14.0);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(chartX + 30, chartY + chartH - 40);
    ctx.lineTo(chartX + 180, chartY + chartH - 60);
    ctx.lineTo(chartX + 320, chartY + chartH - 90);
    // Surge!
    const spikeY = lerp(chartY + chartH - 90, chartY + 60, ease(chartT));
    ctx.lineTo(chartX + 540, spikeY);
    ctx.lineTo(chartX + chartW - 40, spikeY - 15);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // +300% Badge
    if (chartT > 0.5) {
      const badgeSpring = spring({ frame, fps: FPS, config: { damping: 10, stiffness: 120, mass: 0.8 }, delay: 7 * FPS });
      ctx.save();
      ctx.translate(chartX + 540, spikeY - 45);
      ctx.scale(badgeSpring, badgeSpring);
      ctx.fillStyle = '#10B981';
      ctx.roundRect(-70, -22, 140, 44, 10);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText('+300% NOON', 0, 8);
      ctx.restore();
    }

    // Bank Account Counter Box
    const bankVal = Math.floor(lerp(2400, 840000, ease(chartT)));
    ctx.fillStyle = 'rgba(6, 78, 59, 0.35)';
    ctx.roundRect(chartX, chartY + chartH + 25, chartW, 75, 12);
    ctx.fill();
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 20px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText('ACCOUNT BALANCE:', chartX + 30, chartY + chartH + 68);
    ctx.font = 'bold 30px NotoSans';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.fillText(`$${bankVal.toLocaleString()}`, chartX + chartW - 30, chartY + chartH + 72);

    // Magi standing on right pointing at chart
    drawMagi(ctx, 1060, 480, {
      scale: 1.25,
      headLook: -1,
      expression: 'smile',
      armTargetL: [-45, -30], // points at graph
      armTargetR: [25, 20]
    });

  } else if (t >= 24.0 && t < 38.0) {
    // SCENE 2: FLAWLESS PRESENTATION & STANDING OVATION
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('DAY 3: THE FLAWLESS PRESENTATION (RUN #32)', WIDTH / 2, 80);

    // Presentation Screen
    ctx.fillStyle = '#1E293B';
    ctx.roundRect(160, 110, 520, 320, 14);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 22px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('Q3 QUARTERLY PROJECTIONS', 420, 160);

    // Holographic bar chart on screen
    const barHeights = [80, 120, 160, 220];
    barHeights.forEach((bh, idx) => {
      ctx.fillStyle = '#10B981';
      ctx.fillRect(240 + idx * 75, 400 - bh, 50, bh);
    });

    // Magi conducting presentation confidently
    drawMagi(ctx, 760, 480, {
      scale: 1.25,
      headLook: -1,
      expression: 'smile',
      armTargetL: [-50, -40], // points with laser pointer
      armTargetR: [30, 20]
    });

    // Standing Ovation Audience (stick figures clapping)
    const audienceX = [940, 1050, 1160];
    const clapOffset = Math.sin(frame * 0.8) * 6;
    audienceX.forEach(ax => {
      // Body
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(ax, 520);
      ctx.lineTo(ax, 440);
      ctx.stroke();

      // Head
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ax, 420, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Clapping arms
      ctx.beginPath();
      ctx.moveTo(ax, 455);
      ctx.lineTo(ax - 12 + clapOffset, 445);
      ctx.moveTo(ax, 455);
      ctx.lineTo(ax + 12 - clapOffset, 445);
      ctx.stroke();

      // Legs
      ctx.beginPath();
      ctx.moveTo(ax, 520);
      ctx.lineTo(ax - 12, 590);
      ctx.moveTo(ax, 520);
      ctx.lineTo(ax + 12, 590);
      ctx.stroke();
    });

    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 20px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('STANDING OVATION!', 1050, 360);

  } else if (t >= 38.0 && t < 68.0) {
    // SCENE 3: LIVING ROOM COUCH · MAXIMIZATION PARALYSIS & DINNER LOOP
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('5:00 PM: MAXIMIZATION PARALYSIS SETS IN', WIDTH / 2, 80);

    // Living Room Couch
    ctx.fillStyle = '#1E293B';
    ctx.roundRect(140, 420, 480, 160, 16);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(140, 420, 480, 160);

    // Magi sitting on couch looking overwhelmed / holding phone
    let couchExpr = 'worried';
    let wristTap = 0;
    if ((t >= 57.0 && t <= 58.0) || (t >= 62.5 && t <= 63.5)) {
      wristTap = Math.sin((t * 8) % Math.PI);
    }

    drawMagi(ctx, 360, 430, {
      scale: 1.2,
      expression: couchExpr,
      isSitting: true,
      wristTap,
      armTargetL: [-25, 20],
      armTargetR: [25, 20]
    });

    // 3 Floating Food Hologram Options: PIZZA vs SUSHI vs THAI CURRY
    const foodCards = [
      { name: 'PIZZA', desc: 'Fast, comfort food', color: '#F97316', x: 740, y: 150 },
      { name: 'SUSHI', desc: 'Fresh, healthier', color: '#06B6D4', x: 920, y: 260 },
      { name: 'THAI CURRY', desc: 'Optimal spice level?', color: '#84CC16', x: 740, y: 370 }
    ];

    foodCards.forEach(f => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.roundRect(f.x - 70, f.y - 45, 140, 90, 12);
      ctx.fill();
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = f.color;
      ctx.font = 'bold 20px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText(f.name, f.x, f.y - 10);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px NotoSans';
      ctx.fillText(f.desc, f.x, f.y + 18);
    });

    // Rotating Reset Loop Arrows between foods
    const spinAng = frame * 0.05;
    ctx.save();
    ctx.translate(860, 260);
    ctx.rotate(spinAng);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, 140, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#F43F5E';
    ctx.font = 'bold 18px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('Order -> Eat 2 Slices -> Tap Wrists -> Reload -> Try Again...', 860, 480);

  } else {
    // SCENE 4: PSYCHOLOGICAL GRAPH · MAXIMIZATION PARALYSIS CURVE
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('THE PSYCHOLOGY OF SATISFACTION VS. OPTIONALITY', WIDTH / 2, 80);

    const graphX = 260;
    const graphY = 130;
    const graphW = 760;
    const graphH = 360;

    // Graph Box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.roundRect(graphX, graphY, graphW, graphH, 16);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Axes
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Y-Axis
    ctx.moveTo(graphX + 80, graphY + graphH - 50);
    ctx.lineTo(graphX + 80, graphY + 40);
    // X-Axis
    ctx.moveTo(graphX + 80, graphY + graphH - 50);
    ctx.lineTo(graphX + graphW - 40, graphY + graphH - 50);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 16px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('Perfection of Choice (Number of Resets) -->', graphX + graphW / 2, graphY + graphH - 18);

    ctx.save();
    ctx.translate(graphX + 35, graphY + graphH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Satisfaction / Happiness -->', 0, 0);
    ctx.restore();

    // Satisfaction Curve: Starts high with "Good Enough", then plummets to 0
    const curveT = clamp((t - 68.0) / 10.0);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(graphX + 90, graphY + 100); // High satisfaction initially
    ctx.bezierCurveTo(
      graphX + 280, graphY + 110,
      graphX + 440, graphY + 280,
      graphX + 90 + lerp(0, graphW - 160, ease(curveT)), lerp(graphY + 100, graphY + graphH - 55, ease(curveT))
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Big Insight Card
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 22px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('When mistakes cannot be undone: humans accept good outcomes.', WIDTH / 2, graphY + graphH + 45);
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 22px NotoSans';
    ctx.fillText('When every choice can be perfected: SATISFACTION DROPS TO ZERO.', WIDTH / 2, graphY + graphH + 75);
  }

  // Top Header
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 22px CaveatHand';
  ctx.textAlign = 'center';
  ctx.fillText('What If You Had a Real-Life Save Point? (Part 3: Maximization Paralysis)', WIDTH / 2, 35);

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
    console.log(`Act 3 Progress: ${(frame / TOTAL_FRAMES * 100).toFixed(1)}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
  }
}

ffmpegVideo.stdin.end();
await once(ffmpegVideo, 'close');

console.log(`\n🎉 Act 3 Paralysis Masterpiece rendered successfully: ${OUTPUT_FILE}`);

