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
const VOICE = path.resolve('projects/ep18-kv-cache-gpu-inference/build/narration/act6.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP18-Act6-SpeculativeDecoding-1080p.mp4');
const SFX_FILE = '/tmp/ep18_act6_sfx.wav';
const MIX_FILE = '/tmp/ep18_act6_mix.wav';

console.log(`=== EP18 ACT 6: SPECULATIVE DECODING & THE FUTURE OF INFERENCE ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 89102;
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

  // Cosmic future fleet ambient drone
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 70 * t) + noise() * 0.03) * 0.2,
    (t) => (Math.sin(2 * Math.PI * 71 * t) + noise() * 0.03) * 0.2,
    0.22
  );

  // Grouped-Query Attention regrouping chime at t = 10.0s
  addStereo(10.0, 2.0,
    (t) => Math.sin(2 * Math.PI * 659.25 * t) * Math.exp(-t * 1.8),
    (t) => Math.sin(2 * Math.PI * 663 * t) * Math.exp(-t * 1.8),
    0.35
  );

  // Draft model sprint footstep clicks at t = 22.0s, 23.0s, 24.0s, 25.0s
  [22.0, 23.0, 24.0, 25.0].forEach((pt) => {
    addStereo(pt, 0.2,
      (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 1200 * t)) * Math.exp(-t * 20),
      (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 1220 * t)) * Math.exp(-t * 20),
      0.30
    );
  });

  // Target model parallel verification laser beam at t = 29.0s
  addStereo(29.0, 2.5,
    (t) => (Math.sin(2 * Math.PI * 523.25 * t) + Math.sin(2 * Math.PI * 1046.50 * t) * 0.5) * Math.exp(-t * 1.2),
    (t) => (Math.sin(2 * Math.PI * 525 * t) + Math.sin(2 * Math.PI * 1050 * t) * 0.5) * Math.exp(-t * 1.2),
    0.45
  );

  // Grand finale crescendo chord at t = 52.0s
  const finalChord = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
  for (const freq of finalChord) {
    addStereo(52.0, 8.0,
      (t) => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 0.35),
      (t) => Math.sin(2 * Math.PI * (freq * 1.003) * t) * Math.exp(-t * 0.35),
      0.22
    );
  }

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

// Stars for cosmic background
const stars = [];
let seedS = 9812;
for (let i = 0; i < 90; i++) {
  seedS = (Math.imul(seedS, 1664525) + 1013904223) >>> 0;
  const sx = (seedS % WIDTH);
  seedS = (Math.imul(seedS, 1664525) + 1013904223) >>> 0;
  const sy = (seedS % 650);
  seedS = (Math.imul(seedS, 1664525) + 1013904223) >>> 0;
  const sz = 1.0 + (seedS % 200) / 100;
  stars.push({ x: sx, y: sy, size: sz, phase: (i * 0.4) });
}

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background: Deep Cosmic Silicon Constellation
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.5, '#0b1638');
  bg.addColorStop(1, '#020512');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Twinkling stars
  for (const s of stars) {
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.8 + s.phase));
    ctx.fillStyle = `rgba(248, 250, 252, ${twinkle * 0.8})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Perspective floor grid
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
  ctx.fillText('ACT VI: GROUPED-QUERY ATTENTION & SPECULATIVE DECODING', 76, 56);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.fillText('Draft Scout Models & Parallel Verification • Beating the Memory Bandwidth Wall', 76, 82);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText(`THE INFERENCE FRONTIER • ${t.toFixed(1)}s / ${dur.toFixed(1)}s`, WIDTH - 76, 68);

  // 2. LEFT PANEL: GROUPED-QUERY ATTENTION (GQA)
  const lX = 100, lY = 140, lW = 820, lH = 520;
  drawGroundShadow(ctx, lX + lW / 2, lY + lH + 25, lW * 0.45, 20);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(lX, lY, lW, lH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('1. GROUPED-QUERY ATTENTION (GQA)', lX + 25, lY + 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Ainslie et al. (Google Research 2023) • Slashes KV Cache Size by 8×', lX + 25, lY + 72);

  // MHA vs GQA comparison box
  const compY = lY + 110;

  // Traditional MHA
  ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(lX + 35, compY, lW - 70, 75, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('Multi-Head Attention (MHA): 64 Query Heads → 64 Distinct Key & Value Heads', lX + 50, compY + 28);
  ctx.fillStyle = '#f87171';
  ctx.font = '13px NotoSans, sans-serif';
  ctx.fillText('Enormous memory bandwidth footprint: 64 KV streams loaded from memory every token.', lX + 50, compY + 54);

  // Grouped-Query Attention (GQA)
  const gqaY = compY + 95;
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(lX + 35, gqaY, lW - 70, 110, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('Grouped-Query Attention (GQA): 64 Query Heads → 8 KV Group Heads (8:1 Ratio)', lX + 50, gqaY + 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Every 8 Query heads share ONE single Key and Value head.', lX + 50, gqaY + 60);
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 14px NotoSans, sans-serif';
  ctx.fillText('✓ KV Cache memory reduced by 87.5% with 0% reasoning loss (Llama 3, DeepSeek, Mistral)', lX + 50, gqaY + 86);

  // 8 KV Groups visual chips
  const chipsY = gqaY + 130;
  for (let g = 0; g < 8; g++) {
    const cx = lX + 35 + g * 94;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx, chipsY, 84, 40, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 12px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Group ${g + 1}`, cx + 42, chipsY + 24);
  }

  // 3. RIGHT PANEL: SPECULATIVE DECODING (SCOUT & MOTHERSHIP)
  const rX = 960, rY = 140, rW = 860, rH = 520;
  drawGroundShadow(ctx, rX + rW / 2, rY + rH + 25, rW * 0.45, 20);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(rX, rY, rW, rH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('2. SPECULATIVE DECODING: 2× TO 3× SPEEDUP', rX + 30, rY + 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Leviathan et al. (Google 2023) • Small Draft Model Proposes, Large Target Model Verifies', rX + 30, rY + 72);

  // Step 1: Draft Model Proposes
  const draftY = rY + 105;
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(rX + 35, draftY, rW - 70, 115, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('STEP 1: Fast 1B Draft Model sprints ahead (Tiny weights = low bandwidth latency):', rX + 50, draftY + 30);

  const proposedTokens = ['artificial', 'intelligence', 'moves', 'at', 'light'];
  proposedTokens.forEach((tok, idx) => {
    const tx = rX + 50 + idx * 145;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(tx, draftY + 45, 135, 45, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`+${idx + 1}: "${tok}"`, tx + 67, draftY + 72);
  });

  // Step 2: Target Model Parallel Verification
  const verifY = draftY + 135;
  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rX + 35, verifY, rW - 70, 130, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('STEP 2: Massive 70B Target Model verifies ALL 5 tokens in ONE forward pass!', rX + 50, verifY + 30);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Turning a memory-bound GEMV into a compute-bound parallel GEMM!', rX + 50, verifY + 60);

  // Verification Results
  const verifResults = ['✅ ACCEPT', '✅ ACCEPT', '✅ ACCEPT', '✅ ACCEPT', '❌ REJECT'];
  verifResults.forEach((res, idx) => {
    const rx = rX + 50 + idx * 145;
    const isAcc = res.includes('ACCEPT');
    ctx.fillStyle = isAcc ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
    ctx.strokeStyle = isAcc ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(rx, verifY + 75, 135, 36, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isAcc ? '#22c55e' : '#ef4444';
    ctx.font = 'bold 12px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(res, rx + 67, verifY + 98);
  });

  // Outcome banner at bottom of right panel
  const outY = verifY + 145;
  ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rX + 35, outY, rW - 70, 75, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SPEED RESULT: 4 TOKENS GENERATED IN TIME OF 1 !', rX + 50, outY + 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Rejection sampling guarantees output is 100% mathematically identical to the 70B model.', rX + 50, outY + 54);

  // 4. BOTTOM GRAND FINALE DISCOVERY BANNER
  const botX = 100, botY = 700, botW = 1720, botH = 190;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(botX, botY, botW, botH, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WHEN ALGORITHMS HONOR THE MACHINE, INTELLIGENCE MOVES AT THE SPEED OF THOUGHT', WIDTH / 2, botY + 45);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.fillText('True AI engineering is the master symphony between mathematical software and silicon physics.', WIDTH / 2, botY + 80);
  ctx.fillText('From KV Caching and PagedAttention to FlashAttention and Speculative Decoding, systems make intelligence scalable.', WIDTH / 2, botY + 110);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('NEXT & FINAL EPISODE: Mechanistic Interpretability & Superintelligence — The AGI Grand Finale!', WIDTH / 2, botY + 150);

  // 5. STICKMAN CHARACTER (Fleet Commander at right)
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
    handR: { x: stickX + 35, y: stickY - 70 }, // raising beacon
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
      console.log(`\n🎉 ACT 6 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
