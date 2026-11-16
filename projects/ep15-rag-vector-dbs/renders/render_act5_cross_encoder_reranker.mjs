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
const VOICE = path.resolve('projects/ep15-rag-vector-dbs/build/narration/act5.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP15-Act5-CrossEncoderReranker-1080p.mp4');
const SFX_FILE = '/tmp/ep15_act5_sfx.wav';
const MIX_FILE = '/tmp/ep15_act5_mix.wav';

console.log(`=== EP15 ACT 5: THE CROSS-ENCODER RERANKER ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 88204;
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

  // Courtroom legal hum (t = 0.5s to dur)
  addStereo(0.5, dur - 1.0,
    (t) => Math.sin(2 * Math.PI * 65 * t) * 0.12,
    (t) => Math.sin(2 * Math.PI * 66 * t) * 0.12,
    0.20
  );

  // Cross-attention laser hum (t = 16.0s to 30.0s)
  addStereo(16.0, 14.0,
    (t) => (Math.sin(2 * Math.PI * (580 + 120 * Math.sin(t * 6)) * t) + noise() * 0.08) * 0.28,
    (t) => (Math.sin(2 * Math.PI * (584 + 120 * Math.sin(t * 6)) * t) + noise() * 0.08) * 0.28,
    0.35
  );

  // Red rejection stamp thuds (t = 28.0s, 34.0s)
  for (const tStamp of [28.0, 34.0]) {
    addStereo(tStamp, 0.8,
      (t) => (noise() * 0.6 + Math.sin(2 * Math.PI * 160 * t) * 0.5) * Math.exp(-t * 9),
      (t) => (noise() * 0.6 + Math.sin(2 * Math.PI * 165 * t) * 0.5) * Math.exp(-t * 9),
      0.50
    );
  }

  // Golden needle approval bell chime at t = 42.0s
  addStereo(42.0, 3.0,
    (t) => (Math.sin(2 * Math.PI * 1568 * t) + Math.sin(2 * Math.PI * 3136 * t) * 0.4) * Math.exp(-t * 2.5),
    (t) => (Math.sin(2 * Math.PI * 1572 * t) + Math.sin(2 * Math.PI * 3144 * t) * 0.4) * Math.exp(-t * 2.5),
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

  // Background: Judicial Tech Slate & Navy
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#040712');
  bg.addColorStop(0.5, '#0b142c');
  bg.addColorStop(1, '#030511');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 700);
    ctx.lineTo((x - 960) * 2.3 + 960, HEIGHT);
    ctx.stroke();
  }
  for (let y = 700; y <= HEIGHT; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Left Side: Bi-Encoder vs Cross-Encoder Architecture Box
  const archX = 380, archY = 380;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(archX - 240, archY - 190, 480, 420, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('BI-ENCODER vs CROSS-ENCODER', archX - 170, archY - 155);

  // Bi-Encoder: Separate Towers
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(archX - 210, archY - 130, 190, 120, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('Bi-Encoder', archX - 165, archY - 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px monospace';
  ctx.fillText('Query -> [E_Q]', archX - 190, archY - 70);
  ctx.fillText('Passage -> [E_P]', archX - 190, archY - 45);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Fast O(1), No Cross-Attn', archX - 200, archY - 20);

  // Cross-Encoder: Joint Deep Attention Chamber
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(archX + 10, archY - 130, 200, 120, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('Cross-Encoder', archX + 45, archY - 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px monospace';
  ctx.fillText('[CLS] Q [SEP] P', archX + 25, archY - 70);
  ctx.fillText('Full All-to-All Attn', archX + 25, archY - 45);
  ctx.fillStyle = '#10b981';
  ctx.fillText('Deep Token Interaction', archX + 20, archY - 20);

  // Cross-Encoder Pipeline Table
  ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(archX - 210, archY + 15, 420, 150, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('TWO-STAGE RETRIEVAL PIPELINE', archX - 150, archY + 45);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px monospace';
  ctx.fillText('Stage 1 (Bi-Encoder): 100M docs -> Top 50', archX - 190, archY + 75);
  ctx.fillText('Stage 2 (Cross-Encoder): Top 50 -> Top 3', archX - 190, archY + 105);
  ctx.fillStyle = '#10b981';
  ctx.fillText('Result: 99.4% Precision at LLM prompt', archX - 190, archY + 135);

  // Right Side: Judicial Inspection Station with Rejected & Top-3 Candidates
  const jX = 1380, jY = 400;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(jX - 250, jY - 210, 500, 440, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('CANDIDATE PASSAGE INSPECTION', jX - 180, jY - 175);

  // Rejected candidate cards (with red stamps)
  const rejectedDocs = [
    { title: 'Doc #48: Keyword matches without relevance', score: '0.12' },
    { title: 'Doc #32: Superficial synonym spam', score: '0.18' }
  ];

  for (let r = 0; r < rejectedDocs.length; r++) {
    const ry = jY - 140 + r * 70;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(jX - 220, ry, 440, 55, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '13px monospace';
    ctx.fillText(rejectedDocs[r].title, jX - 205, ry + 25);
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`Score: ${rejectedDocs[r].score}`, jX - 205, ry + 45);

    // Red STAMP
    ctx.save();
    ctx.translate(jX + 130, ry + 25);
    ctx.rotate(-0.15);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(-50, -15, 100, 30);
    ctx.fillStyle = '#ef4444';
    ctx.font = '900 13px NotoSans, sans-serif';
    ctx.fillText('REJECTED', -35, 5);
    ctx.restore();
  }

  // Top 3 Approved Gold Candidates (Neon Green)
  const topDocs = [
    { title: 'Doc #01: Exact Technical Specification', score: '0.994' },
    { title: 'Doc #02: Calibration Protocol Details', score: '0.981' }
  ];

  for (let a = 0; a < topDocs.length; a++) {
    const ay = jY + 15 + a * 75;
    ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(jX - 220, ay, 440, 60, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(topDocs[a].title, jX - 205, ay + 26);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`Cross-Attn Score: ${topDocs[a].score} (VERIFIED)`, jX - 205, ay + 48);

    // Green VERIFIED STAMP
    ctx.save();
    ctx.translate(jX + 130, ay + 30);
    ctx.rotate(0.12);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-50, -16, 100, 32);
    ctx.fillStyle = '#10b981';
    ctx.font = '900 13px NotoSans, sans-serif';
    ctx.fillText('VERIFIED', -32, 6);
    ctx.restore();
  }

  // 3. Stickman Magi in Judge Attire
  const magiX = 870, magiY = 720;
  const breath = idleBreath(frame);

  drawGroundShadow(ctx, magiX, magiY, 70);

  const figure = {
    head: { x: magiX, y: 390 + breath, radius: 34, tilt: 0.1 },
    body: {
      spine: [
        { x: magiX, y: 424 + breath },
        { x: magiX + 2, y: 485 + breath * 0.8 },
        { x: magiX + 4, y: 550 }
      ],
      width: 6
    },
    leftArm: {
      ik: {
        target: { x: archX + 180, y: archY + 50 }, // Pointing to pipeline
        pole: { x: magiX - 45, y: 460 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: jX - 160, y: jY - 40 }, // Holding gavel / inspection lens
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

  // Judge's Gavel prop in right hand
  ctx.fillStyle = '#b45309';
  ctx.fillRect(jX - 170, jY - 55, 30, 16);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(jX - 160, jY - 40, 10, 45);

  // Top Master Badge
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 680, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 09 • THE CROSS-ENCODER RERANKER (STAGE 2)', 105, 74);

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
      console.log(`\n🎉 ACT 5 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
