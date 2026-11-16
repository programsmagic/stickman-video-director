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
  drawGroundShadow
} from '../../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1920, HEIGHT = 1080, FPS = 30;
const VOICE = path.resolve('projects/ep18-kv-cache-gpu-inference/build/narration/act1.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP18-Act1-MemoryWall-1080p.mp4');
const SFX_FILE = '/tmp/ep18_act1_sfx.wav';
const MIX_FILE = '/tmp/ep18_act1_mix.wav';

console.log(`=== EP18 ACT 1: THE MEMORY WALL (WHY $40,000 GPUS SIT IDLE) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 91823;
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

  // Datacenter server fan drone
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 120 * t) * 0.4 + noise() * 0.15) * 0.25,
    (t) => (Math.sin(2 * Math.PI * 121.2 * t) * 0.4 + noise() * 0.15) * 0.25,
    0.20
  );

  // Electrical buzz at t = 12.0s
  addStereo(12.0, 1.2,
    (t) => (Math.sin(2 * Math.PI * 60 * t) + noise() * 0.4) * Math.exp(-t * 3),
    (t) => (Math.sin(2 * Math.PI * 60 * t) + noise() * 0.4) * Math.exp(-t * 3),
    0.35
  );

  // Memory Wall alarm gong at t = 22.0s
  addStereo(22.0, 3.5,
    (t) => (Math.sin(2 * Math.PI * 180 * t) + Math.sin(2 * Math.PI * 360 * t) * 0.5) * Math.exp(-t * 1.2),
    (t) => (Math.sin(2 * Math.PI * 181 * t) + Math.sin(2 * Math.PI * 362 * t) * 0.5) * Math.exp(-t * 1.2),
    0.45
  );

  // Heavy 140-lb crate thud at t = 44.0s
  addStereo(44.0, 1.0,
    (t) => (noise() * 0.8 + Math.sin(2 * Math.PI * 85 * t)) * Math.exp(-t * 8),
    (t) => (noise() * 0.8 + Math.sin(2 * Math.PI * 88 * t)) * Math.exp(-t * 8),
    0.50
  );

  // Single knife chop slice at t = 48.0s
  addStereo(48.0, 0.4,
    (t) => (Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 25) + noise() * 0.6 * Math.exp(-t * 15)),
    (t) => (Math.sin(2 * Math.PI * 820 * t) * Math.exp(-t * 25) + noise() * 0.6 * Math.exp(-t * 15)),
    0.45
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

  execSync(`ffmpeg -v error -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v0];[1:a]volume=0.45[v1];[v0][v1]amix=inputs=2:duration=first:dropout_transition=2" -ar 48000 -c:a pcm_s16le "${MIX_FILE}"`);
  console.log(`  ✅ Mixed audio track complete: ${MIX_FILE}`);
}

// 2. VIDEO RENDERING ENGINE (Native 1080p @ 30fps)
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'rawvideo',
  '-pix_fmt', 'rgba',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-r', `${FPS}`,
  '-i', '-',
  '-i', MIX_FILE,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '16',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-shortest',
  OUTPUT
]);

ffmpeg.stderr.on('data', () => {});

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background: Deep Silicon Midnight
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(0.5, '#09132e');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Perspective floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.22, 600);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 600; y <= HEIGHT; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // 1. TOP HEADER HUD
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(50, 24, WIDTH - 100, 72, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ACT I: THE MEMORY WALL — WHY $40,000 GPUS SIT 99% IDLE', 76, 56);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.fillText('Compute-Bound Prefill vs Memory-Bandwidth-Bound Decode • The Secret Silicon Bottleneck', 76, 82);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText(`HARDWARE TELEMETRY • ${t.toFixed(1)}s / ${dur.toFixed(1)}s`, WIDTH - 76, 68);

  // 2. LEFT PANEL: PREFILL PHASE (Parallel Compute Matrix Multiplication)
  const p1X = 100, p1Y = 140, p1W = 820, p1H = 520;
  drawGroundShadow(ctx, p1X + p1W / 2, p1Y + p1H + 30, p1W * 0.45, 20);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(p1X, p1Y, p1W, p1H, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PHASE 1: PROMPT PREFILL (COMPUTE-BOUND)', p1X + 25, p1Y + 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Dense GEMM Matrix Multiply • All tokens processed in parallel', p1X + 25, p1Y + 72);

  // Matrix multiplication visual grid
  const gridX = p1X + 50, gridY = p1Y + 110, cellS = 28;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const active = Math.sin(t * 4 + r * 0.5 + c * 0.5) > -0.2;
      ctx.fillStyle = active ? '#38bdf8' : 'rgba(30, 41, 59, 0.7)';
      ctx.beginPath();
      ctx.roundRect(gridX + c * (cellS + 6), gridY + r * (cellS + 6), cellS, cellS, 4);
      ctx.fill();
    }
  }

  // Compute meter on left
  const cmX = p1X + 360, cmY = p1Y + 130, cmW = 420;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('TENSOR CORE SATURATION: 98% (MAXED OUT)', cmX, cmY);

  // Progress Bar
  ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.fillRect(cmX, cmY + 15, cmW, 26);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(cmX, cmY + 15, cmW * 0.98, 26);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Arithmetic Intensity: >150 FLOPs / byte', cmX, cmY + 70);
  ctx.fillText('All 2,000 TFLOPs fully active calculating attention', cmX, cmY + 95);

  // Parallel Token stream pills
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px NotoSans, sans-serif';
  ctx.fillText('Simultaneous Tokens Ingested:', cmX, cmY + 140);
  ['How', 'does', 'an', 'LLM', 'generate', 'text', 'so', 'fast?'].forEach((tok, idx) => {
    const tx = cmX + (idx % 4) * 100;
    const ty = cmY + 160 + Math.floor(idx / 4) * 36;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(tx, ty, 90, 28, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tok, tx + 45, ty + 19);
  });

  // 3. RIGHT PANEL: DECODE PHASE (MEMORY-BANDWIDTH-BOUND)
  const p2X = 1000, p2Y = 140, p2W = 820, p2H = 520;
  drawGroundShadow(ctx, p2X + p2W / 2, p2Y + p2H + 30, p2W * 0.45, 20);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(p2X, p2Y, p2W, p2H, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PHASE 2: AUTOREGRESSIVE DECODE (MEMORY-BOUND)', p2X + 25, p2Y + 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Matrix-Vector (GEMV) • Generates ONE single token at a time', p2X + 25, p2Y + 72);

  // Big Idle Gauge
  const dialX = p2X + 180, dialY = p2Y + 230, rDial = 85;
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(dialX, dialY, rDial, Math.PI * 0.8, Math.PI * 2.2);
  ctx.stroke();

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(dialX, dialY, rDial, Math.PI * 0.8, Math.PI * 0.84);
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = '900 54px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('99%', dialX, dialY + 12);

  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('IDLE SILICON', dialX, dialY + 40);

  // Memory bandwidth conveyor on right
  const bwX = p2X + 340, bwY = p2Y + 130, bwW = 440;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('HBM3 MEMORY BUS: 3.35 TB/s (REDLINE)', bwX, bwY);

  // Progress Bar for bus
  ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.fillRect(bwX, bwY + 15, bwW, 26);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(bwX, bwY + 15, bwW * 0.99, 26);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Arithmetic Intensity: ~1 FLOP / byte', bwX, bwY + 70);
  ctx.fillText('Must read 140 GB weights from VRAM per word!', bwX, bwY + 95);

  // Single word drip animation
  const dripToken = ['The', 'answer', 'is', 'forty', 'two'][Math.floor((t * 0.8) % 5)];
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText(`Current Token Generating: [ "${dripToken}" ]`, bwX, bwY + 140);

  // Moving weight crate on conveyor
  const cratePhase = (t * 1.2) % 1.0;
  const crateX = bwX + cratePhase * 360;
  ctx.fillStyle = '#ca8a04';
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(crateX, bwY + 170, 70, 45, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 11px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('140 GB', crateX + 35, bwY + 196);

  // 4. BOTTOM ANALOGY BANNER: THE CHEF IN THE WAREHOUSE
  const botX = 100, botY = 700, botW = 1720, botH = 190;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(botX, botY, botW, botH, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THE INTUITIVE ANALOGY: THE SUPER-CHEF AND THE DISTANT FREEZER', botX + 30, botY + 40);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('Imagine a master chef with a knife that chops 2 trillion vegetables per second (Tensor Cores).', botX + 30, botY + 75);
  ctx.fillText('However, each vegetable is locked in a massive walk-in freezer across a huge warehouse (HBM VRAM).', botX + 30, botY + 105);
  ctx.fillText('To slice ONE cucumber, the chef must run 500 meters, carry a 140-lb crate back to the kitchen, make ONE slice, and run back.', botX + 30, botY + 135);

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('The chef is not tired from cutting; the chef is exhausted from running back and forth through the hallway!', botX + 30, botY + 165);

  // 5. STICKMAN CHARACTER (Systems Engineer at bottom right)
  const stickX = botX + botW - 140;
  const stickY = botY + 110;
  const breath = Math.sin(t * 2.5) * 2.0;

  drawGroundShadow(ctx, stickX, botY + botH - 20, 60, 14);

  drawFigure(ctx, {
    x: stickX,
    y: stickY + breath,
    scale: 1.15,
    facing: 'left',
    expression: t >= 22.0 ? 'shocked' : 'thoughtful',
    handL: { x: stickX - 60, y: stickY - 40 }, // pointing left to explanation
    handR: { x: stickX + 40, y: stickY - 60 }, // holding clipboard
    footL: { x: stickX - 25, y: botY + botH - 20 },
    footR: { x: stickX + 25, y: botY + botH - 20 },
    headRadius: 26,
    torsoLength: 75,
    legLength: 70,
    armLength: 50,
    showEyes: true,
    blink: (t % 3.5 < 0.15)
  });

  // Pipe frame to ffmpeg with backpressure drain
  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (frame % 150 === 0 || frame === TOTAL_FRAMES - 1) {
    const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
    console.log(`  Rendered frame ${frame}/${TOTAL_FRAMES} (${pct}%)`);
  }
}

ffmpeg.stdin.end();

await new Promise((resolve, reject) => {
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      console.log(`\n🎉 ACT 1 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
