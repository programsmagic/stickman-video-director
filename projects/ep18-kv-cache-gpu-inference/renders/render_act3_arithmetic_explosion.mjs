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
const VOICE = path.resolve('projects/ep18-kv-cache-gpu-inference/build/narration/act3.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP18-Act3-ArithmeticExplosion-1080p.mp4');
const SFX_FILE = '/tmp/ep18_act3_sfx.wav';
const MIX_FILE = '/tmp/ep18_act3_mix.wav';

console.log(`=== EP18 ACT 3: THE ARITHMETIC OF EXPLOSION (LLAMA-70B REALITY) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 55198;
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

  // Chalkboard / lecture hall drone
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 80 * t) + noise() * 0.04) * 0.15,
    (t) => (Math.sin(2 * Math.PI * 81 * t) + noise() * 0.04) * 0.15,
    0.20
  );

  // Chalk tap formula reveal at t = 12.0s, 16.0s, 20.0s
  [12.0, 16.0, 20.0].forEach((pt) => {
    addStereo(pt, 0.25,
      (t) => (Math.sin(2 * Math.PI * 1400 * t) * Math.exp(-t * 25) + noise() * 0.5 * Math.exp(-t * 20)),
      (t) => (Math.sin(2 * Math.PI * 1420 * t) * Math.exp(-t * 25) + noise() * 0.5 * Math.exp(-t * 20)),
      0.35
    );
  });

  // Memory counter rising tone at t = 28.0s to 36.0s
  addStereo(28.0, 8.0,
    (t) => Math.sin(2 * Math.PI * (200 + t * 50) * t) * 0.25,
    (t) => Math.sin(2 * Math.PI * (202 + t * 50) * t) * 0.25,
    0.25
  );

  // Red OOM alarm horn at t = 48.0s
  addStereo(48.0, 3.5,
    (t) => (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 880 * t) * 0.5) * (Math.sin(2 * Math.PI * 3 * t) > 0 ? 1 : 0) * Math.exp(-t * 0.8),
    (t) => (Math.sin(2 * Math.PI * 442 * t) + Math.sin(2 * Math.PI * 884 * t) * 0.5) * (Math.sin(2 * Math.PI * 3 * t) > 0 ? 1 : 0) * Math.exp(-t * 0.8),
    0.50
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

  // Background: Deep Midnight Laboratory
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.5, '#0b1329');
  bg.addColorStop(1, '#020510');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.22, 620);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 620; y <= HEIGHT; y += 42) {
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
  ctx.fillText('ACT III: THE ARITHMETIC OF EXPLOSION — THE LLAMA-70B REALITY CHECK', 76, 56);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.fillText('Calculating the Physical Memory Footprint: 2 × Layers × Heads × Dimension × Sequence Length × Precision', 76, 82);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText(`VRAM FOOTPRINT • ${t.toFixed(1)}s / ${dur.toFixed(1)}s`, WIDTH - 76, 68);

  // 2. LEFT PANEL: THE FORMULA & LLAMA-70B SPECS CHALKBOARD
  const fX = 100, fY = 140, fW = 860, fH = 520;
  drawGroundShadow(ctx, fX + fW / 2, fY + fH + 25, fW * 0.45, 20);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(fX, fY, fW, fH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('UNIVERSAL KV CACHE MEMORY EQUATION', fX + 30, fY + 45);

  // Big Glowing Formula
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 24px NotoSans, sans-serif';
  ctx.fillText('Size = 2 × n_layers × n_heads × d_head × seq_len × bytes', fX + 30, fY + 95);

  // Specs Breakdown Box
  const specs = [
    { label: 'Factor of 2:', val: 'One tensor for Keys, one for Values (K & V)', col: '#e2e8f0' },
    { label: 'Transformer Layers:', val: 'n_layers = 80 layers (Llama-2/3 70B)', col: '#38bdf8' },
    { label: 'Attention Heads:', val: 'n_heads = 64 heads per layer', col: '#38bdf8' },
    { label: 'Head Dimension:', val: 'd_head = 128 hidden dimensions', col: '#38bdf8' },
    { label: 'Precision:', val: 'FP16 (2 bytes per float parameter)', col: '#a855f7' }
  ];

  specs.forEach((sp, idx) => {
    const sy = fY + 145 + idx * 45;
    ctx.fillStyle = sp.col;
    ctx.font = 'bold 15px NotoSans, sans-serif';
    ctx.fillText(sp.label, fX + 35, sy);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '15px NotoSans, sans-serif';
    ctx.fillText(sp.val, fX + 220, sy);
  });

  // Result Banner at bottom of left panel
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(fX + 30, fY + 390, fW - 60, 95, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('THE COST PER TOKEN (1 SINGLE WORD):', fX + 50, fY + 425);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('2 × 80 × 64 × 128 × 2 = 2,621,440 bytes ≈ 2.62 MB / token!', fX + 50, fY + 462);

  // 3. RIGHT PANEL: MEMORY EXPLOSION & CONTEXT SCALING
  const rX = 1000, rY = 140, rW = 820, rH = 520;
  drawGroundShadow(ctx, rX + rW / 2, rY + rH + 25, rW * 0.45, 20);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = t >= 45.0 ? '#ef4444' : '#fbbf24';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(rX, rY, rW, rH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = t >= 45.0 ? '#ef4444' : '#fbbf24';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(t >= 45.0 ? '🚨 OUT OF MEMORY (OOM) CRASH!' : 'VRAM DEMAND AT PRODUCTION SCALE', rX + 30, rY + 45);

  const contexts = [
    { len: '1,000 tokens (Short summary)', size: '2.62 GB', bar: 0.15, col: '#22c55e' },
    { len: '4,096 tokens (Standard chat)', size: '10.7 GB', bar: 0.35, col: '#38bdf8' },
    { len: '32,000 tokens (Document analysis)', size: '83.9 GB', bar: 0.65, col: '#fbbf24' },
    { len: '128,000 tokens (Full codebase)', size: '335.5 GB (Exceeds Model!)', bar: 1.0, col: '#ef4444' }
  ];

  contexts.forEach((c, idx) => {
    const cy = rY + 95 + idx * 80;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px NotoSans, sans-serif';
    ctx.fillText(c.len, rX + 30, cy);

    ctx.fillStyle = c.col;
    ctx.font = 'bold 15px NotoSans, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(c.size, rX + rW - 35, cy);
    ctx.textAlign = 'left';

    // Bar background
    ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
    ctx.fillRect(rX + 30, cy + 12, rW - 65, 20);

    // Bar fill
    ctx.fillStyle = c.col;
    ctx.fillRect(rX + 30, cy + 12, (rW - 65) * c.bar, 20);
  });

  // Comparison note on right panel
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Notice: Model Weights = 140 GB (70B FP16). At 128k context,', rX + 30, rY + 440);
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('the KV cache alone is 2.4× BIGGER than the entire neural network!', rX + 30, rY + 470);

  // 4. BOTTOM AUDITOR LEDGER BANNER
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
  ctx.fillText('THE MULTI-USER MULTIPLIER CRISIS', botX + 30, botY + 40);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('• 1 User @ 4k tokens: 10.7 GB VRAM.', botX + 30, botY + 75);
  ctx.fillText('• 32 Concurrent Users @ 4k tokens: 342.4 GB VRAM — requiring 5× NVIDIA H100s JUST TO HOLD THE CACHE!', botX + 30, botY + 105);

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('• And this assumes 0% memory waste. In reality, traditional allocators wasted 80% of VRAM! Enter PagedAttention...', botX + 30, botY + 145);

  // 5. STICKMAN CHARACTER (Mathematical Auditor at right)
  const stickX = botX + botW - 140;
  const stickY = botY + 110;
  const breath = Math.sin(t * 2.5) * 2.0;

  drawGroundShadow(ctx, stickX, botY + botH - 20, 60, 14);

  drawFigure(ctx, {
    x: stickX,
    y: stickY + breath,
    scale: 1.15,
    facing: 'left',
    expression: t >= 45.0 ? 'shocked' : 'thoughtful',
    handL: { x: stickX - 60, y: stickY - 40 },
    handR: { x: stickX + 35, y: stickY - 65 }, // holding pointer to blackboard
    footL: { x: stickX - 25, y: botY + botH - 20 },
    footR: { x: stickX + 25, y: botY + botH - 20 },
    headRadius: 26,
    torsoLength: 75,
    legLength: 70,
    armLength: 50,
    showEyes: true,
    blink: (t % 3.6 < 0.15)
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
      console.log(`\n🎉 ACT 3 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
