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
const VOICE = path.resolve('projects/ep12-physics-of-diffusion/build/narration/act2.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP12-Act2-Destroyer-1080p.mp4');
const SFX_FILE = '/tmp/ep12_act2_sfx.wav';
const MIX_FILE = '/tmp/ep12_act2_mix.wav';

console.log(`=== EP12 ACT 2: THE FORWARD NOISE DESTROYER ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 73291;
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

  // Mechanical crank clicks starting at t = 12s
  for (let c = 0; c < 28; c++) {
    const tc = 12.0 + c * 1.5;
    addStereo(tc, 0.08,
      (t) => Math.sin(2 * Math.PI * 480 * t) * Math.exp(-t * 50) + noise() * 0.15 * Math.exp(-t * 40),
      (t) => Math.sin(2 * Math.PI * 510 * t) * Math.exp(-t * 50) + noise() * 0.15 * Math.exp(-t * 40),
      0.40
    );
  }

  // Gaussian aerosol spray hiss rising from t = 20s to t = 45s
  addStereo(20.0, 25.0,
    (t) => noise() * Math.min(1.0, t / 10.0) * 0.25,
    (t) => noise() * Math.min(1.0, t / 10.0) * 0.25,
    0.35
  );

  // Latch snap at t = 48s when t=1000 is reached
  addStereo(48.0, 0.4,
    (t) => Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 20) + noise() * 0.3 * Math.exp(-t * 30),
    (t) => Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 20) + noise() * 0.3 * Math.exp(-t * 30),
    0.60
  );

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

  // Background: Moody Art Studio Navy Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#0a0f1d');
  grad.addColorStop(0.5, '#10172a');
  grad.addColorStop(1, '#05070e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Wooden easel & Canvas in Center-Right (X: 1220, Y: 520)
  const easelX = 1220, easelY = 520;
  const canvasW = 560, canvasH = 420;

  // Easel legs
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(easelX, easelY - canvasH / 2 - 80);
  ctx.lineTo(easelX - 260, easelY + canvasH / 2 + 180);
  ctx.moveTo(easelX, easelY - canvasH / 2 - 80);
  ctx.lineTo(easelX + 260, easelY + canvasH / 2 + 180);
  ctx.moveTo(easelX, easelY - canvasH / 2 - 80);
  ctx.lineTo(easelX, easelY + canvasH / 2 + 190);
  ctx.stroke();

  drawGroundShadow(ctx, easelX, easelY + canvasH / 2 + 185, 320, 24);

  // Canvas shadow & backing
  drawGroundShadow(ctx, easelX, easelY + canvasH / 2 + 20, 280, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(easelX - canvasW / 2, easelY - canvasH / 2, canvasW, canvasH);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  ctx.strokeRect(easelX - canvasW / 2, easelY - canvasH / 2, canvasW, canvasH);

  // Calculate forward diffusion noise level: 0.0 at t <= 10s, reaches 1.0 at t = 45s
  let noiseLevel = 0.0;
  if (t > 10.0) {
    noiseLevel = Math.min(1.0, (t - 10.0) / 35.0);
  }
  const timestep = Math.min(1000, Math.round(noiseLevel * 1000));

  // Render Base Painting (Astronaut on Golden Horse) inside canvas clip
  ctx.save();
  ctx.beginPath();
  ctx.rect(easelX - canvasW / 2 + 2, easelY - canvasH / 2 + 2, canvasW - 4, canvasH - 4);
  ctx.clip();

  // Cosmic twilight background of painting
  const paintBg = ctx.createLinearGradient(0, easelY - canvasH / 2, 0, easelY + canvasH / 2);
  paintBg.addColorStop(0, '#1e1b4b');
  paintBg.addColorStop(0.5, '#431407');
  paintBg.addColorStop(1, '#78350f');
  ctx.fillStyle = paintBg;
  ctx.fillRect(easelX - canvasW / 2, easelY - canvasH / 2, canvasW, canvasH);

  // Golden Sun
  const sun = ctx.createRadialGradient(easelX + 80, easelY - 40, 10, easelX + 80, easelY - 40, 120);
  sun.addColorStop(0, '#fef08a');
  sun.addColorStop(0.5, '#f59e0b');
  sun.addColorStop(1, 'rgba(217, 119, 6, 0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(easelX + 80, easelY - 40, 120, 0, Math.PI * 2);
  ctx.fill();

  // Stylized Astronaut figure on horse
  ctx.fillStyle = '#f8fafc';
  // Helmet
  ctx.beginPath();
  ctx.arc(easelX - 30, easelY - 30, 36, 0, Math.PI * 2);
  ctx.fill();
  // Gold visor
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(easelX - 22, easelY - 30, 20, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  // Horse neck & head silhouette in rich gold
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.moveTo(easelX - 80, easelY + 120);
  ctx.lineTo(easelX + 60, easelY + 50);
  ctx.lineTo(easelX + 90, easelY - 10);
  ctx.lineTo(easelX + 130, easelY + 20);
  ctx.lineTo(easelX + 100, easelY + 70);
  ctx.lineTo(easelX + 50, easelY + 140);
  ctx.closePath();
  ctx.fill();

  // Procedural Gaussian Noise Overlay based on noiseLevel
  if (noiseLevel > 0.0) {
    let nSeed = 38190 + Math.floor(t * 30);
    const grainSize = 6;
    for (let gy = easelY - canvasH / 2; gy < easelY + canvasH / 2; gy += grainSize) {
      for (let gx = easelX - canvasW / 2; gx < easelX + canvasW / 2; gx += grainSize) {
        nSeed = (Math.imul(nSeed, 1664525) + 1013904223) >>> 0;
        const randVal = (nSeed / 4294967296);
        if (randVal < noiseLevel * 0.95) {
          nSeed = (Math.imul(nSeed, 1664525) + 1013904223) >>> 0;
          const lum = Math.floor((nSeed / 4294967296) * 255);
          ctx.fillStyle = `rgba(${lum}, ${lum}, ${lum}, ${Math.min(1.0, noiseLevel * 1.35)})`;
          ctx.fillRect(gx, gy, grainSize, grainSize);
        }
      }
    }
  }
  ctx.restore();

  // Digital Timestep Odometer Gauge above easel
  const odomX = easelX, odomY = easelY - canvasH / 2 - 40;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(odomX - 180, odomY - 30, 360, 60);
  ctx.strokeStyle = timestep >= 1000 ? '#ef4444' : '#38bdf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(odomX - 180, odomY - 30, 360, 60);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px NotoSans';
  ctx.fillText('TIMESTEP:', odomX - 160, odomY + 8);
  ctx.fillStyle = timestep >= 1000 ? '#ef4444' : '#facc15';
  ctx.font = 'bold 32px NotoSans';
  ctx.fillText(`t = ${timestep} / 1000`, odomX + 10, odomY + 11);

  // Mechanical Noise Crank Machine on the left of easel
  const crankX = easelX - canvasW / 2 - 120, crankY = easelY + 50;
  ctx.fillStyle = '#334155';
  ctx.fillRect(crankX - 30, crankY - 70, 60, 140);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.strokeRect(crankX - 30, crankY - 70, 60, 140);

  // Rotating crank arm
  const crankAngle = t > 10.0 ? (t - 10.0) * 4.5 : 0;
  const crankArmLen = 50;
  const crankHandleX = crankX + Math.cos(crankAngle) * crankArmLen;
  const crankHandleY = crankY + Math.sin(crankAngle) * crankArmLen;

  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(crankX, crankY);
  ctx.lineTo(crankHandleX, crankHandleY);
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(crankHandleX, crankHandleY, 12, 0, Math.PI * 2);
  ctx.fill();

  // Character: Magi operating the crank
  const magiX = crankX - 160, magiY = 820;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  // Magi IK hand tracking crank handle
  const rHand = [crankHandleX, crankHandleY];
  const lHand = [magiX - 30, magiY - 90]; // Left hand on hip

  const rArm = solve2BoneIK([magiX + 10, magiY - 130], rHand, 55, 55, 1);
  const lArm = solve2BoneIK([magiX - 10, magiY - 130], lHand, 45, 45, -1);

  drawFigure(ctx, {
    x: magiX,
    y: magiY,
    scale: 1.15,
    color: INK,
    fillColor: '#ffffff',
    hat: 'wizard',
    scarf: true,
    expression: t > 48.0 ? 'curious' : 'focused',
    blinking: blinkState(t),
    breathing: idleBreath(t),
    lHandTarget: lArm ? [lArm[1][0], lArm[1][1]] : undefined,
    rHandTarget: rArm ? [rArm[1][0], rArm[1][1]] : undefined
  });

  // HUD Insight Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(360, 930, 1200, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE FORWARD PROCESS:  Systematic Gaussian Noise Addition', 960, 970);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('q(x_t | x_{t-1})  =  N(x_t;  √(1 - β_t) x_{t-1},  β_t I)  ➔  At t = 1000, only pure isotropic static remains.', 960, 1000);
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 2 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 2 1080p Render Complete! Output: ${OUTPUT}`);
