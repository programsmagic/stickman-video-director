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
const VOICE = path.resolve('projects/ep17-test-time-compute/build/narration/act5.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP17-Act5-DeepSeekR1AhaMoment-1080p.mp4');
const SFX_FILE = '/tmp/ep17_act5_sfx.wav';
const MIX_FILE = '/tmp/ep17_act5_mix.wav';

console.log(`=== EP17 ACT 5: DEEPSEEK-R1 & THE PURE RL AHA MOMENT ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 81920;
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

  // Logic labyrinth ambient drone
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 80 * t) + noise() * 0.05) * 0.15,
    (t) => (Math.sin(2 * Math.PI * 81.5 * t) + noise() * 0.05) * 0.15,
    0.22
  );

  // Dead-end metallic barrier thud at t = 24.0s
  addStereo(24.0, 0.8,
    (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 140 * t)) * Math.exp(-t * 10),
    (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 145 * t)) * Math.exp(-t * 10),
    0.45
  );

  // Bright golden lightbulb explosion ping at t = 34.0s (The AHA! moment)
  addStereo(34.0, 3.5,
    (t) => Math.sin(2 * Math.PI * 1568 * t) * Math.exp(-t * 1.5),
    (t) => Math.sin(2 * Math.PI * 1574 * t) * Math.exp(-t * 1.5),
    0.65
  );

  // Backtracking chalk scratch at t = 38.0s
  for (let s = 38.0; s < 44.0; s += 0.4) {
    addStereo(s, 0.2,
      (t) => (noise() * 0.6) * Math.exp(-t * 20),
      (t) => (noise() * 0.6) * Math.exp(-t * 20),
      0.30
    );
  }

  // Triumphant gate unlock chord at t = 54.0s
  const chord = [523.25, 659.25, 783.99, 1046.50];
  for (const freq of chord) {
    addStereo(54.0, 4.0,
      (t) => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 1.0),
      (t) => Math.sin(2 * Math.PI * (freq + 1.5) * t) * Math.exp(-t * 1.0),
      0.30
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

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background: Deep Cyber Labyrinth
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#020512');
  bg.addColorStop(0.5, '#08102a');
  bg.addColorStop(1, '#020410');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.25, 580);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 580; y <= HEIGHT; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // 1. LOGIC LABYRINTH CORRIDORS (Center-Right)
  const labX = 740, labY = 240, labW = 1040, labH = 500;
  drawGroundShadow(ctx, labX + labW / 2, 760, labW * 0.45, 24);

  // Labyrinth Outer Wall
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(labX, labY, labW, labH, 16);
  ctx.fill();
  ctx.stroke();

  // Maze Walls & Partitions
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  // Horizontal wall
  ctx.moveTo(labX + 180, labY + 160);
  ctx.lineTo(labX + 850, labY + 160);
  // Vertical dividers
  ctx.moveTo(labX + 480, labY + 160);
  ctx.lineTo(labX + 480, labY + 360);
  ctx.moveTo(labX + 780, labY);
  ctx.lineTo(labX + 780, labY + 280);
  ctx.stroke();

  // Dead-end marker (at t >= 20.0s)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(labX + 420, labY + 200, 120, 60, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DEAD END ❌', labX + 480, labY + 236);

  // Backtracking path arrow (Golden)
  if (t >= 36.0) {
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(labX + 420, labY + 280);
    ctx.lineTo(labX + 260, labY + 280);
    ctx.lineTo(labX + 260, labY + 420);
    ctx.lineTo(labX + 880, labY + 420);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Golden Exit Gate (Unlocked at t >= 52.0s)
  const isUnlocked = (t >= 52.0);
  ctx.fillStyle = isUnlocked ? 'rgba(34, 197, 94, 0.95)' : 'rgba(245, 158, 11, 0.9)';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(labX + 850, labY + 380, 150, 80, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText(isUnlocked ? 'EXIT UNLOCKED 🏆' : 'LOCKED GATE 🔒', labX + 925, labY + 428);

  // 2. THE AHA! MOMENT LIGHTBULB (Appears at t >= 32.0s above avatar)
  if (t >= 32.0) {
    const bulbX = labX + 280, bulbY = labY + 110;

    // Radiating golden sunburst lines
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.5;
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(bulbX + Math.cos(ang) * 35, bulbY + Math.sin(ang) * 35);
      ctx.lineTo(bulbX + Math.cos(ang) * 55, bulbY + Math.sin(ang) * 55);
      ctx.stroke();
    }

    // Lightbulb glass
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(bulbX, bulbY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Thought Bubble: "Wait, let me rethink that!"
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(bulbX + 45, bulbY - 45, 360, 75, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('EMERGENT SELF-REFLECTION:', bulbX + 65, bulbY - 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 15px NotoSans, sans-serif';
    ctx.fillText('"Wait, let me re-evaluate that angle!"', bulbX + 65, bulbY + 10);
  }

  // 3. TOP BANNER: DEEPSEEK-R1 PURE REINFORCEMENT LEARNING
  ctx.save();
  ctx.translate(100, 120);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, 800, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('DEEPSEEK-R1 (2025): PURE REINFORCEMENT LEARNING (GRPO)', 25, 34);

  ctx.fillStyle = '#ffffff';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('• ZERO Human Demonstration Data (Pure Self-Exploration)', 25, 62);
  ctx.fillText('• Rule-Based Ground-Truth Verifiers (Math & Code Compilers)', 25, 84);
  ctx.restore();

  // 4. STICKMAN MAGI ON LEFT (Observing in Awe)
  const magiX = 380, magiY = 720;
  drawGroundShadow(ctx, magiX, magiY, 70);

  const breath = Math.sin(t * 2.5) * 2.0;

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
        target: { x: magiX - 45, y: 530 },
        pole: { x: magiX - 35, y: 470 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: 620, y: 420 }, // Pointing in wonder at R1's aha moment
        pole: { x: magiX + 45, y: 470 }
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
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 780, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 11 • DEEPSEEK-R1 & THE PURE RL AHA MOMENT (GRPO)', 105, 74);

  // Raw bytes write
  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (frame % 150 === 0 || frame === TOTAL_FRAMES - 1) {
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
