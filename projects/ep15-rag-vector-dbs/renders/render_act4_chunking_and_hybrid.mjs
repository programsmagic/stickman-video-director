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
const VOICE = path.resolve('projects/ep15-rag-vector-dbs/build/narration/act4.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP15-Act4-ChunkingHybrid-1080p.mp4');
const SFX_FILE = '/tmp/ep15_act4_sfx.wav';
const MIX_FILE = '/tmp/ep15_act4_mix.wav';

console.log(`=== EP15 ACT 4: CHUNKING & HYBRID SEARCH ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 74912;
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

  // Workshop mechanical ambient (t = 0.5s to dur)
  addStereo(0.5, dur - 1.0,
    (t) => Math.sin(2 * Math.PI * 70 * t) * 0.15,
    (t) => Math.sin(2 * Math.PI * 72 * t) * 0.15,
    0.20
  );

  // Guillotine blade slice clicks (t = 6.0s, 12.0s, 18.0s)
  for (const tSlice of [6.0, 12.0, 18.0]) {
    addStereo(tSlice, 0.6,
      (t) => (noise() * 0.5 + Math.sin(2 * Math.PI * 2200 * t) * 0.4) * Math.exp(-t * 12),
      (t) => (noise() * 0.5 + Math.sin(2 * Math.PI * 2205 * t) * 0.4) * Math.exp(-t * 12),
      0.45
    );
  }

  // Balance scale clink & gear lock (t = 38.0s, 44.0s)
  addStereo(38.0, 1.5,
    (t) => (Math.sin(2 * Math.PI * 920 * t) + Math.sin(2 * Math.PI * 1840 * t) * 0.4) * Math.exp(-t * 5),
    (t) => (Math.sin(2 * Math.PI * 925 * t) + Math.sin(2 * Math.PI * 1850 * t) * 0.4) * Math.exp(-t * 5),
    0.40
  );

  // Reciprocal Rank Fusion grand lock at t = 52.0s
  addStereo(52.0, 2.5,
    (t) => (Math.sin(2 * Math.PI * 1320 * t) + Math.sin(2 * Math.PI * 2640 * t) * 0.3) * Math.exp(-t * 3),
    (t) => (Math.sin(2 * Math.PI * 1325 * t) + Math.sin(2 * Math.PI * 2650 * t) * 0.3) * Math.exp(-t * 3),
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

  // Background: Blueprint Slate-Navy
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#040712');
  bg.addColorStop(0.5, '#0a142e');
  bg.addColorStop(1, '#030614');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -300; x <= WIDTH + 300; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 680);
    ctx.lineTo((x - 960) * 2.4 + 960, HEIGHT);
    ctx.stroke();
  }
  for (let y = 680; y <= HEIGHT; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Left Side: Golden Guillotine & Chunking Workbench
  const gX = 400, gY = 380;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(gX - 240, gY - 190, 480, 420, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('RECURSIVE CHUNKING WORKBENCH', gX - 180, gY - 155);

  // Document parchment feed
  const docY = gY - 80;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.fillRect(gX - 200, docY, 400, 70);
  ctx.strokeRect(gX - 200, docY, 400, 70);

  ctx.fillStyle = '#0f172a';
  ctx.font = '14px monospace';
  ctx.fillText('The turbine model TX-9021-X operates at 450 RPM.', gX - 185, docY + 28);
  ctx.fillText('Thermal sensor calibrated under ISO-9001 specs...', gX - 185, docY + 52);

  // Guillotine Blade
  const bladeCycle = (Math.sin(t * 5) * 0.5 + 0.5);
  const bladeY = gY - 120 + bladeCycle * 35;
  ctx.fillStyle = '#94a3b8';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(gX - 20, bladeY);
  ctx.lineTo(gX + 40, bladeY);
  ctx.lineTo(gX + 40, bladeY + 50);
  ctx.lineTo(gX - 20, bladeY + 80);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sliced Chunks with Overlap Bracket (Lower area)
  ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(gX - 190, gY + 40, 180, 60, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('Chunk #1 (300 tok)', gX - 175, gY + 65);

  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.strokeStyle = '#10b981';
  ctx.beginPath();
  ctx.roundRect(gX - 40, gY + 40, 210, 60, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Chunk #2 (300 tok)', gX - 25, gY + 65);

  // Overlap bracket
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(gX - 40, gY + 110);
  ctx.lineTo(gX - 10, gY + 110);
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 12px NotoSans, sans-serif';
  ctx.fillText('15% Overlap Bracket', gX - 70, gY + 130);

  // Failure warning callout for exact string
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(gX - 190, gY + 155, 380, 50, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('Query: "TX-9021-X" -> Vectors FAIL on rare IDs!', gX - 175, gY + 185);

  // Right Side: Hybrid Search Mechanical Balance Scale
  const bX = 1380, bY = 400;
  const scaleTilt = Math.sin(t * 2) * 0.08;

  // Center post
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(bX, bY - 140);
  ctx.lineTo(bX, bY + 180);
  ctx.stroke();

  // Crossbeam
  const beamLen = 220;
  const leftPanX = bX - Math.cos(scaleTilt) * beamLen;
  const leftPanY = bY - 140 - Math.sin(scaleTilt) * beamLen;
  const rightPanX = bX + Math.cos(scaleTilt) * beamLen;
  const rightPanY = bY - 140 + Math.sin(scaleTilt) * beamLen;

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(leftPanX, leftPanY);
  ctx.lineTo(rightPanX, rightPanY);
  ctx.stroke();

  // Pan strings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftPanX, leftPanY);
  ctx.lineTo(leftPanX - 50, leftPanY + 100);
  ctx.moveTo(leftPanX, leftPanY);
  ctx.lineTo(leftPanX + 50, leftPanY + 100);

  ctx.moveTo(rightPanX, rightPanY);
  ctx.lineTo(rightPanX - 50, rightPanY + 100);
  ctx.moveTo(rightPanX, rightPanY);
  ctx.lineTo(rightPanX + 50, rightPanY + 100);
  ctx.stroke();

  // Left Pan: BM25 Lexical Inverted Index
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.ellipse(leftPanX, leftPanY + 100, 65, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(leftPanX - 90, leftPanY + 120, 180, 85, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('BM25 KEYWORD', leftPanX - 65, leftPanY + 145);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px monospace';
  ctx.fillText('Exact SKU matches', leftPanX - 65, leftPanY + 170);
  ctx.fillText('TF-IDF Inverted Index', leftPanX - 75, leftPanY + 190);

  // Right Pan: Dense Semantic Vectors
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.ellipse(rightPanX, rightPanY + 100, 65, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rightPanX - 90, rightPanY + 120, 180, 85, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('DENSE VECTORS', rightPanX - 60, rightPanY + 145);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px monospace';
  ctx.fillText('Conceptual meaning', rightPanX - 65, rightPanY + 170);
  ctx.fillText('Synonym proximity', rightPanX - 65, rightPanY + 190);

  // Bottom Center: Reciprocal Rank Fusion (RRF) Output Box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(bX - 220, bY + 180, 440, 90, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText('RECIPROCAL RANK FUSION (RRF)', bX - 165, bY + 210);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px monospace';
  ctx.fillText('RRF_Score = 1/(60 + r_BM25) + 1/(60 + r_Dense)', bX - 200, bY + 238);
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('✓ Perfect Hybrid Candidate Queue', bX - 140, bY + 260);

  // 3. Stickman Magi Operating the Workshop
  const magiX = 870, magiY = 720;
  const breath = idleBreath(frame);

  drawGroundShadow(ctx, magiX, magiY, 70);

  const figure = {
    head: { x: magiX, y: 390 + breath, radius: 34, tilt: -0.08 },
    body: {
      spine: [
        { x: magiX, y: 424 + breath },
        { x: magiX - 2, y: 485 + breath * 0.8 },
        { x: magiX - 4, y: 550 }
      ],
      width: 6
    },
    leftArm: {
      ik: {
        target: { x: gX + 160, y: gY + 70 }, // Adjusting chunk overlap bracket
        pole: { x: magiX - 45, y: 460 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: bX - 160, y: bY - 40 }, // Holding fusion balance lever
        pole: { x: magiX + 45, y: 460 }
      },
      upperLength: 68,
      lowerLength: 72
    },
    leftLeg: {
      ik: {
        target: { x: magiX + 35, y: magiY },
        pole: { x: magiX + 45, y: 630 }
      },
      upperLength: 85,
      lowerLength: 88
    },
    rightLeg: {
      ik: {
        target: { x: magiX - 35, y: magiY },
        pole: { x: magiX - 25, y: 630 }
      },
      upperLength: 85,
      lowerLength: 88
    },
    accessories: [
      { type: 'glasses', color: '#f59e0b', scale: 1.15 }
    ]
  };

  drawFigure(ctx, figure, {
    color: '#ffffff',
    lineWidth: 5.5,
    fillColor: 'rgba(255,255,255,0.06)'
  });

  // Top Master Badge
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 660, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 09 • CHUNKING & HYBRID SEARCH (BM25 + VECTORS)', 105, 74);

  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (frame % 300 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`  Frame ${frame}/${TOTAL_FRAMES} (${((frame / TOTAL_FRAMES) * 100).toFixed(1)}%) rendered`);
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
