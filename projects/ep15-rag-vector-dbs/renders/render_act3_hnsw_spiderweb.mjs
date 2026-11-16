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
const VOICE = path.resolve('projects/ep15-rag-vector-dbs/build/narration/act3.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP15-Act3-HNSWSpiderweb-1080p.mp4');
const SFX_FILE = '/tmp/ep15_act3_sfx.wav';
const MIX_FILE = '/tmp/ep15_act3_mix.wav';

console.log(`=== EP15 ACT 3: THE HNSW SPIDERWEB ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 63821;
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

  // Heavy server cluster hum & fan whine (t = 0.5s to 20.0s)
  addStereo(0.5, 20.0,
    (t) => (Math.sin(2 * Math.PI * 120 * t) + noise() * 0.1) * 0.3,
    (t) => (Math.sin(2 * Math.PI * 122 * t) + noise() * 0.1) * 0.3,
    0.25
  );

  // High-speed express elevator whoosh (t = 24.0s to 38.0s)
  addStereo(24.0, 14.0,
    (t) => (Math.sin(2 * Math.PI * (600 - 30 * t) * t) * 0.3 + noise() * 0.15) * Math.sin(t * 0.4),
    (t) => (Math.sin(2 * Math.PI * (604 - 30 * t) * t) * 0.3 + noise() * 0.15) * Math.sin(t * 0.4),
    0.35
  );

  // 4 discrete logarithmic graph node ping chimes (t = 34.0s, 38.0s, 42.0s, 46.0s)
  const pings = [34.0, 38.0, 42.0, 46.0];
  const freqs = [880, 1100, 1320, 1760];
  for (let k = 0; k < pings.length; k++) {
    addStereo(pings[k], 1.2,
      (t) => Math.sin(2 * Math.PI * freqs[k] * t) * Math.exp(-t * 7),
      (t) => Math.sin(2 * Math.PI * (freqs[k] + 4) * t) * Math.exp(-t * 7),
      0.50
    );
  }

  // Grand target lock chime at t = 50.0s
  addStereo(50.0, 3.5,
    (t) => (Math.sin(2 * Math.PI * 1980 * t) + Math.sin(2 * Math.PI * 3960 * t) * 0.3) * Math.exp(-t * 2.5),
    (t) => (Math.sin(2 * Math.PI * 1985 * t) + Math.sin(2 * Math.PI * 3970 * t) * 0.3) * Math.exp(-t * 2.5),
    0.55
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

  // Background: Deep Cyber Midnight Navy
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.5, '#071026');
  bg.addColorStop(1, '#02050e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 720);
    ctx.lineTo((x - 960) * 2.2 + 960, HEIGHT);
    ctx.stroke();
  }
  for (let y = 720; y <= HEIGHT; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Left Side: Benchmark Comparison Card
  const benchX = 280, benchY = 380;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(benchX - 220, benchY - 200, 440, 410, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('100,000,000 VECTORS', benchX - 140, benchY - 165);

  // Brute Force Linear Scan Box
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(benchX - 190, benchY - 130, 380, 120, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText('BRUTE FORCE LINEAR SCAN: O(N)', benchX - 170, benchY - 95);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('Evaluates all 100M dot products', benchX - 170, benchY - 65);
  ctx.fillStyle = '#ef4444';
  ctx.font = '900 24px monospace';
  ctx.fillText('Time: ~4,800 ms (CLOGGED)', benchX - 170, benchY - 30);

  // HNSW Graph Box
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(benchX - 190, benchY + 15, 380, 150, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText('HNSW GRAPH SKIP-SEARCH: O(log N)', benchX - 170, benchY + 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('Multi-layer logarithmic expressway', benchX - 170, benchY + 80);
  ctx.fillStyle = '#10b981';
  ctx.font = '900 24px monospace';
  ctx.fillText('Time: 4.2 ms (1,100x FASTER)', benchX - 170, benchY + 120);

  // Right Side: 3-Story HNSW Skyscraper Graph
  const hX = 1240, hW = 600;
  const layers = [
    { name: 'LAYER 2: EXPRESSWAY (Long Jumps)', y: 220, color: '#f59e0b', nodes: 4 },
    { name: 'LAYER 1: REGIONAL HIGHWAYS', y: 400, color: '#a855f7', nodes: 8 },
    { name: 'LAYER 0: DENSE LOCAL NEIGHBORHOODS', y: 580, color: '#38bdf8', nodes: 16 }
  ];

  // Draw floors
  for (let l = 0; l < layers.length; l++) {
    const lay = layers[l];

    // Floor platform plate
    ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
    ctx.strokeStyle = lay.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(hX - hW / 2, lay.y - 40, hW, 110, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = lay.color;
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.fillText(lay.name, hX - hW / 2 + 20, lay.y - 15);

    // Floor nodes
    const nCnt = lay.nodes;
    const spacing = (hW - 80) / (nCnt + 1);
    for (let i = 1; i <= nCnt; i++) {
      const nx = hX - hW / 2 + 40 + i * spacing;
      const ny = lay.y + 30;

      ctx.fillStyle = lay.color;
      ctx.beginPath();
      ctx.arc(nx, ny, 7, 0, Math.PI * 2);
      ctx.fill();

      // Connecting edges to next node
      if (i < nCnt) {
        ctx.strokeStyle = `${lay.color}44`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx + spacing, ny);
        ctx.stroke();
      }
    }
  }

  // Vertical Elevator Shafts connecting layers
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(hX - 160, 180);
  ctx.lineTo(hX - 160, 650);
  ctx.moveTo(hX + 160, 180);
  ctx.lineTo(hX + 160, 650);
  ctx.stroke();
  ctx.setLineDash([]);

  // Active Query Path Animation (t > 24s)
  if (t > 24) {
    const progress = Math.min(1.0, (t - 24) / 24);

    // Query path coordinates across layers
    const p0 = { x: hX - 220, y: 170 }; // Start top
    const p1 = { x: hX - 60, y: 250 };  // Hop on Layer 2
    const p2 = { x: hX + 40, y: 430 };  // Drop to Layer 1
    const p3 = { x: hX + 180, y: 610 }; // Drop to Layer 0 nearest neighbor

    let curPos = p0;
    if (progress < 0.33) {
      const u = progress / 0.33;
      curPos = { x: p0.x + (p1.x - p0.x) * u, y: p0.y + (p1.y - p0.y) * u };
    } else if (progress < 0.66) {
      const u = (progress - 0.33) / 0.33;
      curPos = { x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u };
    } else {
      const u = (progress - 0.66) / 0.34;
      curPos = { x: p2.x + (p3.x - p2.x) * u, y: p2.y + (p3.y - p2.y) * u };
    }

    // Laser trail
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    if (progress >= 0.33) ctx.lineTo(p1.x, p1.y);
    if (progress >= 0.66) ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(curPos.x, curPos.y);
    ctx.stroke();

    // Query Orb
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(curPos.x, curPos.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px NotoSans, sans-serif';
    ctx.fillText('q (Query)', curPos.x - 30, curPos.y - 20);

    // Lock circle at final target
    if (progress >= 0.95) {
      const lockPulse = Math.sin(t * 10) * 8;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p3.x, p3.y, 24 + lockPulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.font = '900 18px NotoSans, sans-serif';
      ctx.fillText('MATCH: Top-1 Found!', p3.x - 70, p3.y + 45);
    }
  }

  // 3. Stickman Magi Standing Between Benchmark & Skyscraper
  const magiX = 640, magiY = 720;
  const breath = idleBreath(frame);

  drawGroundShadow(ctx, magiX, magiY, 70);

  const figure = {
    head: { x: magiX, y: 380 + breath, radius: 34, tilt: 0.12 },
    body: {
      spine: [
        { x: magiX, y: 414 + breath },
        { x: magiX + 2, y: 475 + breath * 0.8 },
        { x: magiX + 4, y: 540 }
      ],
      width: 6
    },
    leftArm: {
      ik: {
        target: { x: benchX + 120, y: benchY + 80 }, // Pointing to speedup box
        pole: { x: magiX - 45, y: 450 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: hX - 200, y: 340 + breath }, // Holding laser pointer toward HNSW graph
        pole: { x: magiX + 50, y: 450 }
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

  // Laser beam from right arm to HNSW graph
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(hX - 200, 340 + breath);
  ctx.lineTo(hX - 60, 250);
  ctx.stroke();
  ctx.setLineDash([]);

  // Top Master Badge
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 640, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 09 • HNSW GRAPHS: 100M VECTORS IN 5ms', 105, 74);

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
      console.log(`\n🎉 ACT 3 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
