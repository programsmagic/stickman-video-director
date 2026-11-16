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
const VOICE = path.resolve('projects/ep18-kv-cache-gpu-inference/build/narration/act5.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP18-Act5-FlashAttentionSRAM-1080p.mp4');
const SFX_FILE = '/tmp/ep18_act5_sfx.wav';
const MIX_FILE = '/tmp/ep18_act5_mix.wav';

console.log(`=== EP18 ACT 5: FLASHATTENTION — THE SRAM HIGHWAY & ONLINE SOFTMAX ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 78192;
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

  // High-speed silicon bus drone
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 140 * t) * 0.3 + noise() * 0.05) * 0.2,
    (t) => (Math.sin(2 * Math.PI * 141.5 * t) * 0.3 + noise() * 0.05) * 0.2,
    0.20
  );

  // Slow HBM bottle-neck rumble at t = 16.0s
  addStereo(16.0, 3.0,
    (t) => (Math.sin(2 * Math.PI * 65 * t) + noise() * 0.3) * Math.exp(-t * 0.8),
    (t) => (Math.sin(2 * Math.PI * 66 * t) + noise() * 0.3) * Math.exp(-t * 0.8),
    0.35
  );

  // High-speed SRAM flash burst at t = 32.0s
  addStereo(32.0, 1.5,
    (t) => Math.sin(2 * Math.PI * (800 + t * 600) * t) * Math.exp(-t * 2.5),
    (t) => Math.sin(2 * Math.PI * (805 + t * 600) * t) * Math.exp(-t * 2.5),
    0.40
  );

  // Online softmax accumulator sync pulses at t = 44.0s, 48.0s, 52.0s
  [44.0, 48.0, 52.0].forEach((pt) => {
    addStereo(pt, 0.4,
      (t) => Math.sin(2 * Math.PI * 1320 * t) * Math.exp(-t * 15),
      (t) => Math.sin(2 * Math.PI * 1325 * t) * Math.exp(-t * 15),
      0.30
    );
  });

  // 4x speedup harmonic chord at t = 58.0s
  const chord = [440, 554.37, 659.25, 880];
  chord.forEach((freq) => {
    addStereo(58.0, 3.5,
      (t) => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 1.0),
      (t) => Math.sin(2 * Math.PI * (freq + 1.5) * t) * Math.exp(-t * 1.0),
      0.25
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

  // Background: Silicon Die Architecture
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.5, '#0a1435');
  bg.addColorStop(1, '#020510');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
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
  ctx.fillText('ACT V: FLASHATTENTION — THE SRAM HIGHWAY & ONLINE SOFTMAX', 76, 56);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.fillText('GPU Memory Hierarchy (HBM vs SRAM) • Eliminating Intermediate Attention Matrices with Matrix Tiling', 76, 82);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText(`IO-AWARE COMPUTATION • ${t.toFixed(1)}s / ${dur.toFixed(1)}s`, WIDTH - 76, 68);

  // 2. LEFT PANEL: STANDARD ATTENTION (SLOW HBM ROUNDTRIPS)
  const lX = 100, lY = 140, lW = 820, lH = 520;
  drawGroundShadow(ctx, lX + lW / 2, lY + lH + 25, lW * 0.45, 20);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(lX, lY, lW, lH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('STANDARD ATTENTION: SLOW HBM ROUNDTRIPS', lX + 25, lY + 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Materializes giant N × N matrix into slow High Bandwidth Memory', lX + 25, lY + 72);

  // Steps diagram of standard attention
  const stdSteps = [
    { title: '1. Compute S = Q · Kᵀ', target: 'Write N × N matrix to slow HBM RAM', col: '#ef4444' },
    { title: '2. Compute P = Softmax(S)', target: 'Read S from HBM, write P back to HBM', col: '#ef4444' },
    { title: '3. Compute Output O = P · V', target: 'Read P from HBM, compute final output', col: '#ef4444' }
  ];

  stdSteps.forEach((st, idx) => {
    const sy = lY + 115 + idx * 85;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(lX + 35, sy, lW - 70, 65, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.fillText(st.title, lX + 55, sy + 28);

    ctx.fillStyle = '#fca5a5';
    ctx.font = '14px NotoSans, sans-serif';
    ctx.fillText(`❌ ${st.target}`, lX + 55, sy + 52);
  });

  // Bottleneck summary at bottom of left panel
  const lBotY = lY + 395;
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(lX + 35, lBotY, lW - 70, 95, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('MEMORY BUS BOTTLENECK:', lX + 50, lBotY + 30);
  ctx.fillStyle = '#fecaca';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Tensor Cores spend 80% of time idle waiting for memory reads and writes!', lX + 50, lBotY + 58);
  ctx.fillText('Memory footprint explodes quadratically: O(N²) HBM bytes.', lX + 50, lBotY + 80);

  // 3. RIGHT PANEL: FLASHATTENTION (SRAM TILING & ONLINE SOFTMAX)
  const rX = 960, rY = 140, rW = 860, rH = 520;
  drawGroundShadow(ctx, rX + rW / 2, rY + rH + 25, rW * 0.45, 20);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(rX, rY, rW, rH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FLASHATTENTION: ON-CHIP SRAM TILING', rX + 30, rY + 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Tri Dao & Stanford (2022/2024) • Never materializes N × N matrix', rX + 30, rY + 72);

  // Memory Hierarchy Diagram
  const memY = rY + 105;

  // Ultra-Fast SRAM Cache (Top)
  ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rX + 40, memY, rW - 80, 90, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('ON-CHIP SRAM CACHE (19 TB/s BANDWIDTH • 100-200 KB per SM)', rX + 60, memY + 30);

  ctx.fillStyle = '#ffffff';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Tiles Q, K, V into bite-sized blocks that stay 100% on silicon!', rX + 60, memY + 58);

  // Highway Laser Bridge
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(rX + rW / 2, memY + 95);
  ctx.lineTo(rX + rW / 2, memY + 155);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Fewer roundtrips across memory bus', rX + rW / 2, memY + 130);

  // Slow High Bandwidth Memory (Bottom)
  const hbmY = memY + 160;
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rX + 40, hbmY, rW - 80, 75, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HIGH BANDWIDTH MEMORY (HBM3 • 3.35 TB/s • 80 GB)', rX + 60, hbmY + 30);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Only reads inputs once and writes final output once (IO-Awareness)', rX + 60, hbmY + 55);

  // Online Softmax Box at bottom of right panel
  const smY = rY + 375;
  ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rX + 40, smY, rW - 80, 115, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 17px NotoSans, sans-serif';
  ctx.fillText('THE SECRET WEAPON: ONLINE SOFTMAX TRICK', rX + 60, smY + 32);

  ctx.fillStyle = '#ffffff';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Standard softmax requires knowing the global maximum over all tokens.', rX + 60, smY + 60);
  ctx.fillText('Online Softmax rescales running accumulators on the fly tile-by-tile.', rX + 60, smY + 84);
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 14px NotoSans, sans-serif';
  ctx.fillText('✓ Mathematical precision is 100% exact • Speedup: 2× to 4× !', rX + 60, smY + 104);

  // 4. BOTTOM ARCHITECTURE SUMMARY BANNER
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
  ctx.fillText('RESPECTING SILICON PHYSICS: HARDWARE-AWARE ALGORITHM DESIGN', botX + 30, botY + 40);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('In computer science theory, all memory accesses take O(1) time. In reality, SRAM is 10× faster than HBM.', botX + 30, botY + 75);
  ctx.fillText('By redesigning attention to fit inside on-chip cache, FlashAttention broke through the memory bandwidth wall.', botX + 30, botY + 105);

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('Now modern models can train on 128k contexts in weeks instead of months, and serve users with 4× higher efficiency.', botX + 30, botY + 145);

  // 5. STICKMAN CHARACTER (Micro-architect at right)
  const stickX = botX + botW - 140;
  const stickY = botY + 110;
  const breath = Math.sin(t * 2.5) * 2.0;

  drawGroundShadow(ctx, stickX, botY + botH - 20, 60, 14);

  drawFigure(ctx, {
    x: stickX,
    y: stickY + breath,
    scale: 1.15,
    facing: 'left',
    expression: 'excited',
    handL: { x: stickX - 60, y: stickY - 40 },
    handR: { x: stickX + 35, y: stickY - 65 }, // holding chip caliper
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
      console.log(`\n🎉 ACT 5 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
