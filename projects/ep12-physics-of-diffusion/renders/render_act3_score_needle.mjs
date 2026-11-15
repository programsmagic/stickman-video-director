import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require(
  path.resolve('skills/directing-stickman-videos/node_modules/@napi-rs/canvas')
);
import {
  drawFigure,
  COLORS,
  INK,
  solve2BoneIK,
  blinkState,
  idleBreath,
  drawGroundShadow
} from '../../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1920, HEIGHT = 1080, FPS = 30;
const VOICE = path.resolve('projects/ep12-physics-of-diffusion/build/narration/act3.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP12-Act3-ScoreNeedle-1080p.mp4');
const SFX_FILE = '/tmp/ep12_act3_sfx.wav';
const MIX_FILE = '/tmp/ep12_act3_mix.wav';

console.log(`=== EP12 ACT 3: LANGEVIN DYNAMICS & THE SCORE NEEDLE ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 64019;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };

  const addStereo = (t0, len, fnL, fnR, gain = 0.3) => {
    const i0 = Math.round(t0 * rate);
    const cnt = Math.min(n - i0, Math.round(len * rate));
    for (let i = 0; i < cnt; i++) {
      if (i0 + i >= 0 && i0 + i < n) {
        const t = i / rate;
        left[i0 + i] += fnL(t) * gain;
        right[i0 + i] += fnR(t) * gain;
      }
    }
  };

  // Eerie mountain wind howl throughout
  addStereo(1.0, 56.0,
    (t) => Math.sin(2 * Math.PI * (60 + Math.sin(t * 0.3) * 15) * t) * 0.15 + noise() * 0.05,
    (t) => Math.sin(2 * Math.PI * (65 + Math.sin(t * 0.3) * 15) * t) * 0.15 + noise() * 0.05,
    0.25
  );

  // Compass needle magnetic spin & lock at t = 24.0s
  addStereo(24.0, 0.8,
    (t) => Math.sin(2 * Math.PI * (1200 - t * 400) * t) * Math.exp(-t * 6) + noise() * 0.1 * Math.exp(-t * 10),
    (t) => Math.sin(2 * Math.PI * (1220 - t * 400) * t) * Math.exp(-t * 6) + noise() * 0.1 * Math.exp(-t * 10),
    0.50
  );

  // Resonant crystal ping harmonics when fog clears at t = 42s, 48s, 54s
  [42.0, 48.0, 54.0].forEach((pt, idx) => {
    const freq = 880 + idx * 220;
    addStereo(pt, 1.2,
      (t) => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 4),
      (t) => Math.sin(2 * Math.PI * (freq + 5) * t) * Math.exp(-t * 4),
      0.45
    );
  });

  // WAV header
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);

  const s16 = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    s16[i * 2] = Math.max(-32767, Math.min(32767, Math.round(left[i] * 32767)));
    s16[i * 2 + 1] = Math.max(-32767, Math.min(32767, Math.round(right[i] * 32767)));
  }
  Buffer.from(s16.buffer).copy(buf, 44);
  fs.writeFileSync(SFX_FILE, buf);

  // Mix SFX with Gemini Bodi narration
  execSync(`ffmpeg -v error -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v0];[1:a]volume=0.45[v1];[v0][v1]amix=inputs=2:duration=first:dropout_transition=2" -ar 48000 -c:a pcm_s16le "${MIX_FILE}"`);
  console.log(`  ✅ Mixed audio track complete: ${MIX_FILE}`);
}

// 2. FFmpeg Native 1080p Pipeline
console.log('• Launching 1080p FFmpeg encoding pipeline...');
const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'rawvideo',
  '-vcodec', 'rawvideo',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-pix_fmt', 'rgba',
  '-r', `${FPS}`,
  '-i', '-',
  '-i', MIX_FILE,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '16',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '320k',
  '-shortest',
  OUTPUT
], { stdio: ['pipe', 'inherit', 'inherit'] });

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Background: Deep Atmospheric Night Mountain Plateau
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#030712');
  grad.addColorStop(0.5, '#090d20');
  grad.addColorStop(1, '#020409');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // High-dimensional landscape contour terrain lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 2;
  for (let cy = 350; cy < 850; cy += 60) {
    ctx.beginPath();
    for (let cx = 0; cx <= WIDTH; cx += 40) {
      const terrainH = Math.sin(cx * 0.003 + cy * 0.01) * 35 + Math.cos(cx * 0.006) * 20;
      if (cx === 0) ctx.moveTo(cx, cy + terrainH);
      else ctx.lineTo(cx, cy + terrainH);
    }
    ctx.stroke();
  }

  // Mountain peak where Magi stands (X: 740, Y: 720)
  const peakX = 740, peakY = 720;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(peakX - 350, peakY + 120);
  ctx.lineTo(peakX, peakY - 30);
  ctx.lineTo(peakX + 380, peakY + 120);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.stroke();

  drawGroundShadow(ctx, peakX, peakY + 20, 160, 20);

  // Hero Compass (Magi holds in hand, extends toward right)
  const compassX = peakX + 180, compassY = peakY - 140;

  // Compass outer brass bezel
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.arc(compassX, compassY, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Compass inner dial with probability contour lines
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(compassX, compassY, 58, 0, Math.PI * 2);
  ctx.fill();

  // Dial grid & ticks
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    ctx.beginPath();
    ctx.moveTo(compassX + Math.cos(a) * 45, compassY + Math.sin(a) * 45);
    ctx.lineTo(compassX + Math.cos(a) * 55, compassY + Math.sin(a) * 55);
    ctx.stroke();
  }

  // Stein Score Needle: spins initially, then locks uphill toward target after t = 24s
  let needleAngle = -Math.PI / 4;
  if (t < 24.0) {
    needleAngle = t * 6.0; // spinning searching in fog
  } else {
    needleAngle = -Math.PI / 4 + Math.sin(t * 1.5) * 0.05; // locked onto uphill gradient
  }

  const needleLen = 45;
  const tipX = compassX + Math.cos(needleAngle) * needleLen;
  const tipY = compassY + Math.sin(needleAngle) * needleLen;
  const tailX = compassX - Math.cos(needleAngle) * (needleLen * 0.6);
  const tailY = compassY - Math.sin(needleAngle) * (needleLen * 0.6);

  // North needle (Red)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(compassX + Math.cos(needleAngle + Math.PI / 2) * 8, compassY + Math.sin(needleAngle + Math.PI / 2) * 8);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(compassX + Math.cos(needleAngle - Math.PI / 2) * 8, compassY + Math.sin(needleAngle - Math.PI / 2) * 8);
  ctx.closePath();
  ctx.fill();

  // South needle (White)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(compassX + Math.cos(needleAngle + Math.PI / 2) * 8, compassY + Math.sin(needleAngle + Math.PI / 2) * 8);
  ctx.lineTo(tailX, tailY);
  ctx.lineTo(compassX + Math.cos(needleAngle - Math.PI / 2) * 8, compassY + Math.sin(needleAngle - Math.PI / 2) * 8);
  ctx.closePath();
  ctx.fill();

  // Radiant Laser Score Vector Arrow shooting from compass tip after t = 24s
  if (t >= 24.0) {
    const vectorLen = Math.min(380, (t - 24.0) * 120);
    const endX = tipX + Math.cos(needleAngle) * vectorLen;
    const endY = tipY + Math.sin(needleAngle) * vectorLen;

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(endX, endY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Score Equation Callout floating above arrow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(tipX + 60, tipY - 80, 260, 50, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('∇x log p(x)', tipX + 190, tipY - 47);
    ctx.textAlign = 'left';
  }

  // Volumetric Fog Particles: Dense initially, evaporating along score vector
  let fSeed = 19280 + Math.floor(t * 15);
  const fogCount = 200;
  for (let i = 0; i < fogCount; i++) {
    fSeed = (Math.imul(fSeed, 1664525) + 1013904223) >>> 0;
    const fx = (fSeed / 4294967296) * WIDTH;
    fSeed = (Math.imul(fSeed, 1664525) + 1013904223) >>> 0;
    const fy = 150 + (fSeed / 4294967296) * 650;

    // Check distance to laser vector; if close and t > 35s, fog evaporates
    const distToVector = Math.hypot(fx - (compassX + 150), fy - (compassY - 80));
    const isCleared = (t > 35.0 && distToVector < 200);

    if (!isCleared) {
      ctx.fillStyle = 'rgba(203, 213, 225, 0.12)';
      ctx.beginPath();
      ctx.arc(fx, fy, 25 + (i % 30), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Character: Magi holding compass & surveyor staff
  const magiX = peakX - 40, magiY = peakY + 20;

  // Magi IK hand tracking compass
  const rHand = [compassX - 60, compassY + 10];
  const lHand = [magiX - 60, magiY - 90]; // Left hand on surveyor staff

  const rArm = solve2BoneIK([magiX + 10, magiY - 130], rHand, 55, 55, 1);
  const lArm = solve2BoneIK([magiX - 10, magiY - 130], lHand, 50, 50, -1);

  drawFigure(ctx, {
    x: magiX,
    y: magiY,
    scale: 1.15,
    color: INK,
    fillColor: '#ffffff',
    hat: 'wizard',
    scarf: true,
    expression: t > 24.0 ? 'happy' : 'curious',
    blinking: blinkState(t),
    breathing: idleBreath(t),
    lHandTarget: lArm ? [lArm[1][0], lArm[1][1]] : undefined,
    rHandTarget: rArm ? [rArm[1][0], rArm[1][1]] : undefined
  });

  // Surveyor Staff in Left Hand
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(magiX - 65, magiY - 140);
  ctx.lineTo(magiX - 65, magiY + 20);
  ctx.stroke();

  // HUD Insight Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(360, 930, 1200, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('LANGEVIN DYNAMICS:  The Score Function (∇x log p(x)) Points Uphill', 960, 970);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Never guess the whole image at once. Predict the tiny grain of noise added in the previous step and subtract it.', 960, 1000);
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 3 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 3 1080p Render Complete! Output: ${OUTPUT}`);
