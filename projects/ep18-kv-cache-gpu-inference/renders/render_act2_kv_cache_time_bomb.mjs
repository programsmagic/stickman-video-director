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
const VOICE = path.resolve('projects/ep18-kv-cache-gpu-inference/build/narration/act2.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP18-Act2-KVCacheTimeBomb-1080p.mp4');
const SFX_FILE = '/tmp/ep18_act2_sfx.wav';
const MIX_FILE = '/tmp/ep18_act2_mix.wav';

console.log(`=== EP18 ACT 2: THE KV CACHE & THE QUADRATIC TIME BOMB ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 44102;
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

  // Ambient intellectual library hum
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 98 * t) + noise() * 0.05) * 0.15,
    (t) => (Math.sin(2 * Math.PI * 99 * t) + noise() * 0.05) * 0.15,
    0.20
  );

  // Quill pen scratching at t = 10.0s to 16.0s
  for (let s = 10.0; s < 16.0; s += 0.5) {
    addStereo(s, 0.25,
      (t) => (noise() * 0.6) * Math.exp(-t * 15),
      (t) => (noise() * 0.6) * Math.exp(-t * 15),
      0.30
    );
  }

  // Quadratic explosion whoosh at t = 26.0s
  addStereo(26.0, 2.0,
    (t) => Math.sin(2 * Math.PI * (100 + t * 300) * t) * Math.exp(-t * 1.5) + noise() * 0.3,
    (t) => Math.sin(2 * Math.PI * (105 + t * 300) * t) * Math.exp(-t * 1.5) + noise() * 0.3,
    0.40
  );

  // Pinning index card thumbtack click at t = 38.0s, 42.0s, 46.0s
  [38.0, 42.0, 46.0].forEach((pt) => {
    addStereo(pt, 0.3,
      (t) => (Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 30) + noise() * 0.5 * Math.exp(-t * 20)),
      (t) => (Math.sin(2 * Math.PI * 1820 * t) * Math.exp(-t * 30) + noise() * 0.5 * Math.exp(-t * 20)),
      0.45
    );
  });

  // O(1) chime at t = 52.0s
  addStereo(52.0, 2.5,
    (t) => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 1.5),
    (t) => Math.sin(2 * Math.PI * 882 * t) * Math.exp(-t * 1.5),
    0.40
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

  // Background: Deep Cyber Study
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(0.5, '#0b1633');
  bg.addColorStop(1, '#020512');
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
  ctx.fillText('ACT II: THE KV CACHE & THE QUADRATIC TIME BOMB', 76, 56);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.fillText('Why Recomputing Self-Attention Explodes as O(N²) • Key-Value Memory Pins', 76, 82);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText(`ALGORITHMIC COMPLEXITY • ${t.toFixed(1)}s / ${dur.toFixed(1)}s`, WIDTH - 76, 68);

  // 2. LEFT PANEL: QUADRATIC EXPLOSION GRAPH (WITHOUT KV CACHE)
  const gX = 100, gY = 140, gW = 780, gH = 520;
  drawGroundShadow(ctx, gX + gW / 2, gY + gH + 25, gW * 0.45, 20);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(gX, gY, gW, gH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NAIVE RECOMPUTATION: O(N²) TIME BOMB', gX + 25, gY + 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Token #500 requires recalculating all 499 previous dot products', gX + 25, gY + 72);

  // Graph Axes
  const axX = gX + 70, axY = gY + 440, axW = 640, axH = 320;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(axX, axY - axH);
  ctx.lineTo(axX, axY);
  ctx.lineTo(axX + axW, axY);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px NotoSans, sans-serif';
  ctx.fillText('FLOPs (Quadratic Explosion)', axX - 50, axY - axH - 10);
  ctx.fillText('Sequence Length (Tokens)', axX + axW - 120, axY + 30);

  // Draw O(N^2) Curve
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let px = 0; px <= axW; px += 5) {
    const normX = px / axW;
    const normY = normX * normX; // Quadratic
    const py = axY - normY * axH;
    if (px === 0) ctx.moveTo(axX + px, py);
    else ctx.lineTo(axX + px, py);
  }
  ctx.stroke();

  // Moving red warning point along curve
  const curvePhase = (t * 0.3) % 1.0;
  const dotX = axX + curvePhase * axW;
  const dotY = axY - (curvePhase * curvePhase) * axH;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(dotX, dotY, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px NotoSans, sans-serif';
  ctx.fillText(`Token #${Math.floor(curvePhase * 1000)}: ${Math.floor(curvePhase * curvePhase * 1000000).toLocaleString()} ops!`, dotX - 80, dotY - 20);

  // 3. RIGHT PANEL: THE KV CACHE BULLETIN BOARD (O(1) OPTIMIZATION)
  const bX = 940, bY = 140, bW = 880, bH = 520;
  drawGroundShadow(ctx, bX + bW / 2, bY + bH + 25, bW * 0.45, 20);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(bX, bY, bW, bH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WITH KV CACHE: O(1) CONSTANT TIME PER TOKEN', bX + 25, bY + 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Keys & Values computed ONCE and pinned to high-speed GPU memory', bX + 25, bY + 72);

  // Pinned Bulletin Board
  const corkX = bX + 40, corkY = bY + 100, corkW = 800, corkH = 380;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(corkX, corkY, corkW, corkH, 12);
  ctx.fill();
  ctx.stroke();

  // Pinned Index Cards
  const cards = [
    { tok: 'The', k: 'K₁: [0.12, -0.84, ...]', v: 'V₁: [0.44, 0.91, ...]' },
    { tok: 'sky', k: 'K₂: [-0.31, 0.72, ...]', v: 'V₂: [0.81, -0.15, ...]' },
    { tok: 'is', k: 'K₃: [0.55, 0.19, ...]', v: 'V₃: [-0.22, 0.63, ...]' },
    { tok: 'blue', k: 'K₄: [0.89, -0.42, ...]', v: 'V₄: [0.11, 0.77, ...]' }
  ];

  cards.forEach((card, idx) => {
    const cx = corkX + 30 + idx * 185;
    const cy = corkY + 40;
    const cw = 165;
    const ch = 150;

    // Card background
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, 8);
    ctx.fill();
    ctx.stroke();

    // Red thumbtack on top of card
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cx + cw / 2, cy + 12, 6, 0, Math.PI * 2);
    ctx.fill();

    // Token text
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`"${card.tok}"`, cx + cw / 2, cy + 42);

    // Key Vector tag
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 11px NotoSans, sans-serif';
    ctx.fillText(card.k, cx + cw / 2, cy + 78);

    // Value Vector tag
    ctx.fillStyle = '#059669';
    ctx.fillText(card.v, cx + cw / 2, cy + 112);
  });

  // Query vector matching new token at bottom of board
  const qY = corkY + 230;
  ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(corkX + 30, qY, 740, 110, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NEW INCOMING TOKEN: [ "today" ] → Compute Query Q₅ ONCE', corkX + 50, qY + 36);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Attention Score = Softmax( Q₅ · [K₁, K₂, K₃, K₄]ᵀ / √d ) · [V₁, V₂, V₃, V₄]', corkX + 50, qY + 68);
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 14px NotoSans, sans-serif';
  ctx.fillText('✓ Exactly ONE dot product against the stored board • Zero past recomputation!', corkX + 50, qY + 94);

  // 4. BOTTOM FORMULA & TRADEOFF BANNER
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
  ctx.fillText('THE ALGORITHMIC TRADE-OFF: TRADING FLOPs FOR MEMORY', botX + 30, botY + 40);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('• Without KV Cache: Computation explodes quadratically as O(N²). Slows to a crawl after a few hundred tokens.', botX + 30, botY + 75);
  ctx.fillText('• With KV Cache: Every token generation step takes identical constant time O(1). Fast, responsive streaming!', botX + 30, botY + 105);

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('• THE TRAP: The bulletin board grows with every single word. How much memory does a thought actually take?', botX + 30, botY + 145);

  // 5. STICKMAN CHARACTER (Writer at desk on bottom right)
  const stickX = botX + botW - 140;
  const stickY = botY + 110;
  const breath = Math.sin(t * 2.5) * 2.0;

  drawGroundShadow(ctx, stickX, botY + botH - 20, 60, 14);

  drawFigure(ctx, {
    x: stickX,
    y: stickY + breath,
    scale: 1.15,
    facing: 'left',
    expression: t >= 50.0 ? 'thoughtful' : 'excited',
    handL: { x: stickX - 60, y: stickY - 40 },
    handR: { x: stickX + 35, y: stickY - 65 }, // holding index card
    footL: { x: stickX - 25, y: botY + botH - 20 },
    footR: { x: stickX + 25, y: botY + botH - 20 },
    headRadius: 26,
    torsoLength: 75,
    legLength: 70,
    armLength: 50,
    showEyes: true,
    blink: (t % 3.8 < 0.15)
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
      console.log(`\n🎉 ACT 2 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
