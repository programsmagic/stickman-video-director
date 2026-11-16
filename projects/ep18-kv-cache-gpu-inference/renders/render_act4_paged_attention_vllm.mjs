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
const VOICE = path.resolve('projects/ep18-kv-cache-gpu-inference/build/narration/act4.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP18-Act4-PagedAttentionVLLM-1080p.mp4');
const SFX_FILE = '/tmp/ep18_act4_sfx.wav';
const MIX_FILE = '/tmp/ep18_act4_mix.wav';

console.log(`=== EP18 ACT 4: THE FRAGMENTATION CRISIS & PAGEDATTENTION (VLLM) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 67201;
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

  // Grand hotel / datacenter drone
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 110 * t) + noise() * 0.04) * 0.15,
    (t) => (Math.sin(2 * Math.PI * 111 * t) + noise() * 0.04) * 0.15,
    0.20
  );

  // Hotel front desk bell ding at t = 14.0s
  addStereo(14.0, 2.5,
    (t) => Math.sin(2 * Math.PI * 2093 * t) * Math.exp(-t * 2.5),
    (t) => Math.sin(2 * Math.PI * 2098 * t) * Math.exp(-t * 2.5),
    0.45
  );

  // Door lock clank at t = 24.0s
  addStereo(24.0, 0.6,
    (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 250 * t)) * Math.exp(-t * 12),
    (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 255 * t)) * Math.exp(-t * 12),
    0.40
  );

  // Digital paging block alignment sweep at t = 42.0s
  addStereo(42.0, 1.8,
    (t) => Math.sin(2 * Math.PI * (400 + t * 400) * t) * Math.exp(-t * 1.5),
    (t) => Math.sin(2 * Math.PI * (405 + t * 400) * t) * Math.exp(-t * 1.5),
    0.35
  );

  // Triumphant 4x throughput chord at t = 64.0s
  const chord = [523.25, 659.25, 783.99, 1046.50];
  chord.forEach((freq) => {
    addStereo(64.0, 3.5,
      (t) => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 1.0),
      (t) => Math.sin(2 * Math.PI * (freq + 2) * t) * Math.exp(-t * 1.0),
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

  // Background: Cyber Hotel / Datacenter
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(0.5, '#091536');
  bg.addColorStop(1, '#020512');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Perspective floor grid
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
  ctx.fillText('ACT IV: THE FRAGMENTATION CRISIS & PAGEDATTENTION (VLLM)', 76, 56);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.fillText('Operating Systems Virtual Memory Applied to AI • Eliminating 80% VRAM Waste with Block Tables', 76, 82);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText(`VIRTUAL MEMORY PAGING • ${t.toFixed(1)}s / ${dur.toFixed(1)}s`, WIDTH - 76, 68);

  // 2. LEFT PANEL: TRADITIONAL CONTIGUOUS ALLOCATION (80% WASTE)
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
  ctx.fillText('TRADITIONAL CONTIGUOUS ALLOCATOR (80% WASTE)', lX + 25, lY + 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Pre-allocating worst-case max sequence length (e.g. 2048 tokens)', lX + 25, lY + 72);

  // Hotel rooms visual grid (Traditional: 80% locked empty)
  const rmX = lX + 35, rmY = lY + 110, rw = 135, rh = 55;
  const hotelGuests = [
    { req: 'Req 1: 50 tokens', used: 0.1, col: '#ef4444' },
    { req: 'Req 2: 120 tokens', used: 0.15, col: '#ef4444' },
    { req: 'Req 3: 400 tokens', used: 0.35, col: '#ef4444' },
    { req: 'Req 4: 80 tokens', used: 0.12, col: '#ef4444' }
  ];

  hotelGuests.forEach((g, idx) => {
    const gy = rmY + idx * 75;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px NotoSans, sans-serif';
    ctx.fillText(`${g.req} (Reserved 2,048 tokens contiguous)`, rmX, gy);

    // Full slot container
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.fillRect(rmX, gy + 8, lW - 70, 24);
    ctx.strokeRect(rmX, gy + 8, lW - 70, 24);

    // Used portion
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(rmX, gy + 8, (lW - 70) * g.used, 24);

    // Label on waste
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 11px NotoSans, sans-serif';
    ctx.fillText('UNRESERVED LOCKED WASTELAND (INTERNAL FRAGMENTATION)', rmX + (lW - 70) * 0.45, gy + 25);
  });

  // Wasteland Meter at bottom of left panel
  const wasteY = lY + 430;
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(lX + 35, wasteY, lW - 70, 65, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('TOTAL GPU VRAM WASTED: 60% – 80% !', lX + 50, wasteY + 28);
  ctx.fillStyle = '#fecaca';
  ctx.font = '13px NotoSans, sans-serif';
  ctx.fillText('New requests rejected with "Out of Memory" while 70% of memory is empty!', lX + 50, wasteY + 50);

  // 3. RIGHT PANEL: UC BERKELEY PAGEDATTENTION (VLLM VIRTUAL PAGING)
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
  ctx.fillText('PAGEDATTENTION (VLLM): VIRTUAL BLOCK TABLE', rX + 30, rY + 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Fixed-size blocks (16 tokens) allocated on-demand anywhere in VRAM', rX + 30, rY + 72);

  // Logical vs Physical Block Diagram
  const bTableX = rX + 40, bTableY = rY + 110;

  // Logical Blocks Column
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('Logical Sequence (User)', bTableX, bTableY);

  const lBlocks = ['Block 0 (Tok 1-16)', 'Block 1 (Tok 17-32)', 'Block 2 (Tok 33-48)'];
  lBlocks.forEach((lb, idx) => {
    const ly = bTableY + 20 + idx * 55;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bTableX, ly, 190, 42, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px NotoSans, sans-serif';
    ctx.fillText(lb, bTableX + 15, ly + 26);
  });

  // Translation Arrows
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2.5;
  [0, 1, 2].forEach((idx) => {
    const ly = bTableY + 41 + idx * 55;
    const destY = bTableY + 41 + (idx === 0 ? 110 : (idx === 1 ? 0 : 55));
    ctx.beginPath();
    ctx.moveTo(bTableX + 200, ly);
    ctx.bezierCurveTo(bTableX + 270, ly, bTableX + 310, destY, bTableX + 370, destY);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(bTableX + 370, destY, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Physical Memory Pool (Non-contiguous blocks)
  const pPoolX = bTableX + 380;
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('Physical GPU Memory (VRAM)', pPoolX, bTableY);

  const pBlocks = [
    { id: 'Frame #7', owner: 'Block 1 (User A)', active: true },
    { id: 'Frame #12', owner: 'Block 2 (User A)', active: true },
    { id: 'Frame #3', owner: 'Block 0 (User A)', active: true },
    { id: 'Frame #9', owner: 'Free Block (User B)', active: false }
  ];

  pBlocks.forEach((pb, idx) => {
    const py = bTableY + 20 + idx * 55;
    ctx.fillStyle = pb.active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.15)';
    ctx.strokeStyle = pb.active ? '#22c55e' : '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pPoolX, py, 260, 42, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = pb.active ? '#22c55e' : '#94a3b8';
    ctx.font = 'bold 12px NotoSans, sans-serif';
    ctx.fillText(`${pb.id} → ${pb.owner}`, pPoolX + 15, py + 26);
  });

  // Throughput Banner at bottom of right panel
  const pSuccessY = rY + 370;
  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rX + 30, pSuccessY, rW - 60, 125, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText('PAGEDATTENTION PERFORMANCE BREAKTHROUGH:', rX + 50, pSuccessY + 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('• Memory waste drops from 80% down to under 4% (near-zero waste!)', rX + 50, pSuccessY + 68);
  ctx.fillText('• Serving throughput increases by 2× to 4× on identical GPU hardware', rX + 50, pSuccessY + 96);

  // 4. BOTTOM HOTEL METAPHOR BANNER
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
  ctx.fillText('THE OPERATING SYSTEM REVOLUTION: LESSONS FROM VIRTUAL MEMORY', botX + 30, botY + 40);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('In classical operating systems, programs don’t need contiguous physical RAM; virtual memory maps pages anywhere.', botX + 30, botY + 75);
  ctx.fillText('PagedAttention applied this exact computer science principle to KV Caches for LLM generation.', botX + 30, botY + 105);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('Bonus Superpower: Copy-on-Write sharing! Parallel sampling and beam search share identical parent prompt blocks with ZERO duplicated memory.', botX + 30, botY + 145);

  // 5. STICKMAN CHARACTER (Hotel Manager / Systems Architect)
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
    handR: { x: stickX + 35, y: stickY - 65 }, // holding keycard
    footL: { x: stickX - 25, y: botY + botH - 20 },
    footR: { x: stickX + 25, y: botY + botH - 20 },
    headRadius: 26,
    torsoLength: 75,
    legLength: 70,
    armLength: 50,
    showEyes: true,
    blink: (t % 3.7 < 0.15)
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
      console.log(`\n🎉 ACT 4 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
