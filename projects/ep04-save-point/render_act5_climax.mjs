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
const AUDIO_VOICE = path.resolve('projects/ep04-save-point/build/narration/ch5.wav');
const DURATION = 78.00;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const OUTPUT_FILE = path.resolve('exports/EP04-Act5-Climax-Masterpiece.mp4');
const TEMP_SFX = '/tmp/ep04_act5_sfx.wav';
const TEMP_MIXED = '/tmp/ep04_act5_audio.wav';

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
// 1. PROCEDURAL FOLEY (78.0s)
// -------------------------------------------------------------
console.log('1. Synthesizing procedural Foley for Act 5...');
{
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const samples = new Float32Array(n);
  let seed = 39182;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // Digital countdown beeps
  const addBeep = (sec, freq = 880, vol = 0.2) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.1; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 30);
      const tone = Math.sin(2 * Math.PI * freq * t) * env * vol;
      if (s + i < n) samples[s + i] += tone;
    }
  };

  // Grand 12:00 Resonant Church / Clock Bell Chime
  const addBigBell = (sec, vol = 0.45) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 3.5; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 1.2);
      const b1 = Math.sin(2 * Math.PI * 220 * t) * 0.5;
      const b2 = Math.sin(2 * Math.PI * 440 * t) * 0.3;
      const b3 = Math.sin(2 * Math.PI * 660 * t) * 0.2;
      if (s + i < n) samples[s + i] += (b1 + b2 + b3) * env * vol;
    }
  };

  // Golden particle dissolve shimmer
  const addDissolve = (sec, vol = 0.3) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 2.0; i++) {
      const t = i / rate;
      const env = Math.sin(Math.PI * (t / 2.0));
      const freq = 1200 + Math.sin(t * 15) * 400;
      const chime = Math.sin(2 * Math.PI * freq * t) * 0.3 + (rand() - 0.5) * 0.2;
      if (s + i < n) samples[s + i] += chime * env * vol;
    }
  };

  // Foley Cues
  // Urgency beeps (0 to 15s)
  for (let b = 1.0; b < 12.0; b += 1.5) {
    addBeep(b, 880, 0.15);
  }

  // Final 10 seconds rapid beeps (47s to 54s)
  for (let b = 47.0; b < 54.0; b += 0.8) {
    addBeep(b, 1200, 0.25);
  }

  // 12:00 Strikes!
  addBigBell(54.5, 0.5);
  addDissolve(55.0, 0.35);
  addBigBell(57.5, 0.4);

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
  console.log('✓ Act 5 Foley synthesized.');
}

// -------------------------------------------------------------
// 2. MIX NARRATION + FOLEY
// -------------------------------------------------------------
console.log('2. Mixing audio for Act 5...');
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
  console.log('✓ Act 5 Audio mixed.');
}

// -------------------------------------------------------------
// 3. FRAME RENDERING PIPELINE
// -------------------------------------------------------------
console.log('3. Rendering video frames for Act 5...');
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
const ACT5_OFFSET = 111.24 + 77.00 + 84.36 + 87.68; // 360.28s
function getCaption(sec) {
  const globalSec = sec + ACT5_OFFSET;
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
    expression = 'normal',
    wristTap = 0
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

  if (expression === 'smile' || expression === 'peaceful') {
    ctx.beginPath();
    ctx.arc(0, headCY + 7, 7, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else if (expression === 'solemn') {
    ctx.beginPath();
    ctx.moveTo(-5, headCY + 10);
    ctx.lineTo(5, headCY + 10);
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

  // Legs standing
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(-15, hipY + 80);
  ctx.moveTo(0, hipY);
  ctx.lineTo(15, hipY + 80);
  ctx.stroke();

  ctx.restore();
}

// -------------------------------------------------------------
// RENDER LOOP (78.0s)
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
  // 1 (0 to 34s): Midnight approaching, Red Prompt: SAVE POINT EXPIRES IN 00:05:00
  // 2 (34 to 49s): Carl Jung: Tension of Opposites (Danger/Courage, Loss/Love, Bad Days/Joy)
  // 3 (49 to 58s): 10 Seconds Remaining. Wrists apart. 12:00 Strikes. Prompt dissolves into Golden Dust
  // 4 (58 to 78s): Sunrise Dawn: Stepping into the messy, beautiful, real world

  if (t < 34.0) {
    // SCENE 1: COUNTDOWN TIMER & REFLECTION
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 26px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('DAY 7: THE FINAL DEADLINE', WIDTH / 2, 60);

    // Flashing Red Save Prompt
    const flashRed = Math.sin(frame * 0.2) > 0;
    const promptW = 440;
    const promptH = 220;
    const promptX = (WIDTH - promptW) / 2;
    const promptY = 130;

    ctx.fillStyle = 'rgba(76, 5, 25, 0.45)';
    ctx.roundRect(promptX, promptY, promptW, promptH, 16);
    ctx.fill();
    ctx.strokeStyle = flashRed ? '#EF4444' : '#F43F5E';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = flashRed ? 20 : 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FB7185';
    ctx.font = 'bold 18px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('SYSTEM WARNING: TIMELINE LOCKOUT', WIDTH / 2, promptY + 45);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px NotoSans';
    ctx.fillText('SAVE POINT EXPIRES IN:', WIDTH / 2, promptY + 95);

    // Countdown Display
    const remainingSec = Math.max(0, 300 - Math.floor(t * 8.5));
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    const timeStr = `00:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 36px NotoSans';
    ctx.fillText(timeStr, WIDTH / 2, promptY + 155);

    // Magi standing below looking down at his open hands
    drawMagi(ctx, WIDTH / 2, 540, {
      scale: 1.3,
      expression: 'solemn',
      armTargetL: [-25, 20], // hands held out contemplating
      armTargetR: [25, 20]
    });

  } else if (t >= 34.0 && t < 49.0) {
    // SCENE 2: CARL JUNG · THE TENSION OF OPPOSITES
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 26px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('CARL JUNG: TO BE ALIVE IS TO BEAR THE TENSION OF OPPOSITES', WIDTH / 2, 60);

    const pillars = [
      { left: 'DANGER', right: 'COURAGE', color: '#EF4444', y: 150 },
      { left: 'LOSS', right: 'LOVE', color: '#EC4899', y: 240 },
      { left: 'BAD DAYS', right: 'TRUE JOY', color: '#F59E0B', y: 330 }
    ];

    pillars.forEach((p, idx) => {
      const pSpring = spring({ frame, fps: FPS, config: { damping: 10, stiffness: 120, mass: 1 }, delay: (34 + idx * 2.5) * FPS });
      if (pSpring > 0.05) {
        ctx.save();
        ctx.translate(WIDTH / 2, p.y + 35);
        ctx.scale(pSpring, pSpring);

        // Bar container
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.roundRect(-340, -32, 680, 64, 12);
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Left concept
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 20px NotoSans';
        ctx.textAlign = 'left';
        ctx.fillText(p.left, -300, 8);

        // Balance Symbol
        ctx.fillStyle = '#FEF08A';
        ctx.textAlign = 'center';
        ctx.fillText('<====== GIVES RISE TO ======>', 0, 8);

        // Right concept
        ctx.fillStyle = '#F8FAFC';
        ctx.textAlign = 'right';
        ctx.fillText(p.right, 300, 8);

        ctx.restore();
      }
    });

    // Magi standing below smiling with understanding
    drawMagi(ctx, WIDTH / 2, 550, {
      scale: 1.25,
      expression: 'peaceful',
      armTargetL: [-35, 15],
      armTargetR: [35, 15]
    });

  } else if (t >= 49.0 && t < 58.0) {
    // SCENE 3: FINAL 10 SECONDS · ARMS STAY APART · GOLDEN DISSOLVE
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 28px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('12:00: SURRENDERING THE SAFETY NET', WIDTH / 2, 60);

    const dissolveT = clamp((t - 54.0) / 3.5);

    if (dissolveT < 1.0) {
      // Golden Dust Particles expanding outward
      const numParticles = 120;
      for (let p = 0; p < numParticles; p++) {
        const ang = (p * 37) * Math.PI / 180;
        const speed = (p % 5 + 2) * 45;
        const px = WIDTH / 2 + Math.cos(ang) * speed * dissolveT;
        const py = 250 + Math.sin(ang) * speed * dissolveT;
        const alpha = Math.max(0, 1 - dissolveT);

        ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 3 + (p % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Magi standing with hands by his side (wrists stay apart)
    drawMagi(ctx, WIDTH / 2, 520, {
      scale: 1.35,
      expression: 'peaceful',
      armTargetL: [-15, 45], // arms straight down by side
      armTargetR: [15, 45]
    });

    // Huge 12:00 Chime Bell Rings
    if (t >= 54.0) {
      ctx.fillStyle = '#FEF08A';
      ctx.font = 'bold 44px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText('MIDNIGHT: THE SAVE POINT IS GONE', WIDTH / 2, 160);
    }

  } else {
    // SCENE 4: SUNRISE & REAL LIFE RESTORED
    // Dawn Sky Gradient
    const dawnGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    dawnGrad.addColorStop(0, '#0F172A');
    dawnGrad.addColorStop(0.5, '#7C2D12');
    dawnGrad.addColorStop(1, '#F59E0B');
    ctx.fillStyle = dawnGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Rising Sun
    ctx.fillStyle = '#FEF08A';
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(WIDTH / 2, 480, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ground
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 480, WIDTH, 240);

    // Magi stepping forward toward the morning sun
    drawMagi(ctx, WIDTH / 2, 480, {
      scale: 1.35,
      expression: 'smile',
      armTargetL: [-35, 10],
      armTargetR: [35, 10]
    });

    // Final Core Truth Card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect(WIDTH / 2 - 360, 90, 720, 110, 16);
    ctx.fill();
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 28px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('PERFECTION IS DEAD.', WIDTH / 2, 135);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px NotoSans';
    ctx.fillText('LIFE IS UNCERTAIN. AND REAL.', WIDTH / 2, 175);
  }

  // Top Header
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 30px CaveatHand';
  ctx.textAlign = 'center';
  ctx.fillText('What If You Had a Real-Life Save Point? (Part 5: Climax & Resolution)', WIDTH / 2, 45);

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
    console.log(`Act 5 Progress: ${(frame / TOTAL_FRAMES * 100).toFixed(1)}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
  }
}

ffmpegVideo.stdin.end();
await once(ffmpegVideo, 'close');

console.log(`\n🎉 Act 5 Climax Masterpiece rendered successfully: ${OUTPUT_FILE}`);

