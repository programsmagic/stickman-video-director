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
const VOICE = path.resolve('projects/ep16-post-training-alignment/build/narration/act2.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP16-Act2-SupervisedFineTuning-1080p.mp4');
const SFX_FILE = '/tmp/ep16_act2_sfx.wav';
const MIX_FILE = '/tmp/ep16_act2_mix.wav';

console.log(`=== EP16 ACT 2: SUPERVISED FINE-TUNING (SFT) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 23910;
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

  // Regal academy ambient
  addStereo(0.5, dur - 1.0,
    (t) => Math.sin(2 * Math.PI * 88 * t) * 0.12,
    (t) => Math.sin(2 * Math.PI * 90 * t) * 0.12,
    0.20
  );

  // Golden leash chimes (t = 8.0s, 16.0s, 24.0s)
  for (const tChime of [8.0, 16.0, 24.0]) {
    addStereo(tChime, 1.2,
      (t) => Math.sin(2 * Math.PI * 1320 * t) * Math.exp(-t * 6),
      (t) => Math.sin(2 * Math.PI * 1325 * t) * Math.exp(-t * 6),
      0.40
    );
  }

  // Demonstration scroll unroll paper flutter at t = 14.0s
  addStereo(14.0, 1.5,
    (t) => (noise() * 0.4 + Math.sin(2 * Math.PI * 220 * t) * 0.3) * Math.exp(-t * 4),
    (t) => (noise() * 0.4 + Math.sin(2 * Math.PI * 225 * t) * 0.3) * Math.exp(-t * 4),
    0.45
  );

  // Gradient descent golden particle flow hum (t = 28.0s to 44.0s)
  addStereo(28.0, 16.0,
    (t) => (Math.sin(2 * Math.PI * (528 + 60 * Math.sin(t * 3)) * t) + noise() * 0.05) * 0.25,
    (t) => (Math.sin(2 * Math.PI * (532 + 60 * Math.sin(t * 3)) * t) + noise() * 0.05) * 0.25,
    0.35
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

  // Background: Royal Academy Gold & Navy
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#040714');
  bg.addColorStop(0.5, '#0e1832');
  bg.addColorStop(1, '#050a18');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 660);
    ctx.lineTo((x - 960) * 2.3 + 960, HEIGHT);
    ctx.stroke();
  }
  for (let y = 660; y <= HEIGHT; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Left Side: Curated SFT Demonstration Dialogue Scrolls
  const scX = 400, scY = 380;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(scX - 240, scY - 190, 480, 420, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('SUPERVISED FINE-TUNING (SFT) DATASET', scX - 200, scY - 155);

  // User Turn Box
  ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(scX - 210, scY - 130, 420, 80, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('[USER PROMPT]', scX - 190, scY - 105);
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px monospace';
  ctx.fillText('"Explain how airplanes fly using physics."', scX - 190, scY - 75);

  // Assistant Target Response Box (Loss calculated here)
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(scX - 210, scY - 35, 420, 120, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('[ASSISTANT COMPLETION (CROSS-ENTROPY LOSS)]', scX - 190, scY - 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px monospace';
  ctx.fillText('"Airplanes fly by generating lift. Air flows', scX - 190, scY + 16);
  ctx.fillText('faster over curved wings, creating pressure', scX - 190, scY + 38);
  ctx.fillText('differences described by Bernoulli\'s principle."', scX - 190, scY + 60);

  // SFT Limitation Callout (Bottom of left card)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(scX - 210, scY + 100, 420, 95, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('⚠️ THE SFT CEILING (IMITATION TRAP):', scX - 190, scY + 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px monospace';
  ctx.fillText('• Cannot explore better novel answers', scX - 190, scY + 152);
  ctx.fillText('• Cannot learn what NOT to say without feedback', scX - 190, scY + 174);

  // Right Side: Tamed & Polite Computational Stallion
  const hx = 1380, hy = 500;
  const bowAngle = Math.min(0.25, t * 0.03);

  drawGroundShadow(ctx, hx, 720, 110);

  // Golden Academy Reins connecting from Magi's hand
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(hx - 160, hy - 110 + bowAngle * 50);
  ctx.quadraticCurveTo(1060, 470, 820, 430);
  ctx.stroke();

  // Draw Tamed Stallion (Emerald & Gold)
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';

  // Body
  ctx.beginPath();
  ctx.ellipse(hx, hy - 60, 110, 65, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Polite Bowing Neck & Head
  ctx.beginPath();
  ctx.moveTo(hx - 80, hy - 90);
  ctx.lineTo(hx - 120, hy - 140 + bowAngle * 60);
  ctx.lineTo(hx - 160, hy - 120 + bowAngle * 60);
  ctx.lineTo(hx - 170, hy - 95 + bowAngle * 60);
  ctx.lineTo(hx - 140, hy - 80 + bowAngle * 60);
  ctx.lineTo(hx - 90, hy - 40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Calm Emerald Eye
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(hx - 135, hy - 115 + bowAngle * 60, 6, 0, Math.PI * 2);
  ctx.fill();

  // Neat Golden Mane
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  for (let m = 0; m < 6; m++) {
    ctx.beginPath();
    ctx.moveTo(hx - 110 + m * 16, hy - 135 + m * 12 + bowAngle * 60);
    ctx.lineTo(hx - 100 + m * 16, hy - 160 + m * 10 + bowAngle * 60);
    ctx.stroke();
  }

  // Stable Standing Legs
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 5;
  // Front legs
  ctx.beginPath();
  ctx.moveTo(hx - 80, hy - 20);
  ctx.lineTo(hx - 85, hy + 80);
  ctx.lineTo(hx - 80, hy + 180);
  ctx.stroke();

  // Hind legs
  ctx.beginPath();
  ctx.moveTo(hx + 80, hy - 30);
  ctx.lineTo(hx + 85, hy + 80);
  ctx.lineTo(hx + 90, hy + 180);
  ctx.stroke();

  // Speech bubble from the tamed beast
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(hx - 360, hy - 280, 360, 75, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('ASSISTANT PERSONA ACTIVATED:', hx - 340, hy - 250);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('"Certainly! I would be glad to explain..."', hx - 340, hy - 225);

  // 3. Stickman Magi Holding the Golden Reins
  const magiX = 760, magiY = 720;
  const breath = Math.sin(t * 2.5) * 2.0;

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
        target: { x: scX + 200, y: scY - 10 }, // Gesturing to SFT scroll
        pole: { x: magiX - 45, y: 460 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: 820, y: 430 }, // Holding golden reins
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

  // Top Master Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 700, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 10 • SUPERVISED FINE-TUNING (SFT & DEMONSTRATIONS)', 105, 74);

  // Raw bytes write
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
      console.log(`\n🎉 ACT 2 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
