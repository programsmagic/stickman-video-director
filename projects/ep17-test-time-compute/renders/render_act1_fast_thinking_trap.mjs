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
const VOICE = path.resolve('projects/ep17-test-time-compute/build/narration/act1.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP17-Act1-FastThinkingTrap-1080p.mp4');
const SFX_FILE = '/tmp/ep17_act1_sfx.wav';
const MIX_FILE = '/tmp/ep17_act1_mix.wav';

console.log(`=== EP17 ACT 1: THE FAST-THINKING TRAP (SYSTEM 1 VS SYSTEM 2) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 12938;
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

  // Lab background atmospheric hum
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 65 * t) + noise() * 0.05) * 0.12,
    (t) => (Math.sin(2 * Math.PI * 66.5 * t) + noise() * 0.05) * 0.12,
    0.20
  );

  // Fast robotic ticker clicks (t = 8.0 to 22.0)
  for (let s = 8.0; s < 22.0; s += 0.25) {
    addStereo(s, 0.08,
      (t) => (noise() * 0.8 + Math.sin(2 * Math.PI * 2400 * t)) * Math.exp(-t * 50),
      (t) => (noise() * 0.8 + Math.sin(2 * Math.PI * 2420 * t)) * Math.exp(-t * 50),
      0.30
    );
  }

  // Auctioneer gavel strike at t = 24.5s
  addStereo(24.5, 0.6,
    (t) => (noise() * 0.9 + Math.sin(2 * Math.PI * 180 * t) * 0.8) * Math.exp(-t * 12),
    (t) => (noise() * 0.9 + Math.sin(2 * Math.PI * 185 * t) * 0.8) * Math.exp(-t * 12),
    0.50
  );

  // Loud buzzer buzz (System 1 blunder) at t = 26.0s
  addStereo(26.0, 1.8,
    (t) => (Math.sin(2 * Math.PI * 150 * t) + Math.sin(2 * Math.PI * 153 * t)) * 0.45,
    (t) => (Math.sin(2 * Math.PI * 150 * t) + Math.sin(2 * Math.PI * 153 * t)) * 0.45,
    0.55
  );

  // Ticking grandfather clock (slow System 2 reflection) from t = 42.0s
  for (let s = 42.0; s < dur - 2.0; s += 1.0) {
    addStereo(s, 0.12,
      (t) => Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t * 30),
      (t) => Math.sin(2 * Math.PI * 910 * t) * Math.exp(-t * 30),
      0.25
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

  // Background: Deep Cyber Cognitive Lab
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030716');
  bg.addColorStop(0.5, '#0b132e');
  bg.addColorStop(1, '#040718');
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

  // 1. LEFT: KAHNEMAN DUAL-SYSTEM ARCHITECTURE HUD
  ctx.save();
  ctx.translate(100, 130);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, 680, 260, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('COGNITIVE MODES: DANIEL KAHNEMAN SYSTEM 1 VS SYSTEM 2', 30, 40);

  // System 1 Box (Red highlight)
  const isSys1Active = (t < 40.0);
  ctx.fillStyle = isSys1Active ? 'rgba(239, 68, 68, 0.20)' : 'rgba(30, 41, 59, 0.6)';
  ctx.strokeStyle = isSys1Active ? '#ef4444' : '#64748b';
  ctx.lineWidth = isSys1Active ? 3 : 1.5;
  ctx.beginPath();
  ctx.roundRect(30, 65, 300, 165, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isSys1Active ? '#f87171' : '#94a3b8';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('SYSTEM 1: FAST', 50, 105);
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('• Instinctive & Automatic', 50, 138);
  ctx.fillText('• Fixed O(1) compute/token', 50, 164);
  ctx.fillText('• Prone to instant blunders', 50, 190);
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('STANDARD LLMs (GPT-3 / 4)', 50, 216);

  // System 2 Box (Cyan/Green highlight)
  const isSys2Active = (t >= 40.0);
  ctx.fillStyle = isSys2Active ? 'rgba(16, 185, 129, 0.20)' : 'rgba(30, 41, 59, 0.6)';
  ctx.strokeStyle = isSys2Active ? '#10b981' : '#64748b';
  ctx.lineWidth = isSys2Active ? 3 : 1.5;
  ctx.beginPath();
  ctx.roundRect(350, 65, 300, 165, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isSys2Active ? '#34d399' : '#94a3b8';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('SYSTEM 2: DELIBERATE', 370, 105);
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('• Slow, logical deduction', 370, 138);
  ctx.fillText('• Dynamic test-time search', 370, 164);
  ctx.fillText('• Self-verification & check', 370, 190);
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('REASONING (o1 / R1)', 370, 216);
  ctx.restore();

  // 2. CENTER-RIGHT: ROBOTIC AUCTIONEER & COGNITIVE RIDDLE
  const robX = 1380, robY = 640;
  drawGroundShadow(ctx, robX, robY + 110, 140, 22);

  // Auctioneer Wooden Podium
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(robX - 90, robY - 60, 180, 170, 12);
  ctx.fill();
  ctx.stroke();

  // Digital Ticker on Podium (flashing rapid tokens)
  ctx.fillStyle = '#020617';
  ctx.fillRect(robX - 75, robY - 45, 150, 45);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  const tickWords = ['predict()', 'O(1) Step', 'token=491', 'argMax()', 'P=0.98'];
  const curWord = tickWords[Math.floor(t * 4) % tickWords.length];
  ctx.fillText(`⚡ ${curWord}`, robX, robY - 17);

  // Fast Robot Auctioneer Figure
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(robX, robY - 130, 32, 0, Math.PI * 2); // Head
  ctx.fill();
  ctx.stroke();

  // Robot glowing eyes (Red when blundering, yellow when idling)
  ctx.fillStyle = t >= 24.0 && t < 38.0 ? '#ef4444' : '#38bdf8';
  ctx.beginPath();
  ctx.arc(robX - 12, robY - 132, 6, 0, Math.PI * 2);
  ctx.arc(robX + 12, robY - 132, 6, 0, Math.PI * 2);
  ctx.fill();

  // Gavel in hand
  const gavelAngle = (t >= 24.0 && t <= 25.5) ? Math.sin((t - 24.0) * 12) * 0.8 : -0.3;
  ctx.save();
  ctx.translate(robX - 45, robY - 90);
  ctx.rotate(gavelAngle);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-40, 15);
  ctx.stroke();
  // Gavel mallet head
  ctx.fillStyle = '#b45309';
  ctx.fillRect(-52, 5, 24, 20);
  ctx.restore();

  // 3. THE COGNITIVE PUZZLE BOARD (The Classic Bat & Ball Trap)
  ctx.save();
  ctx.translate(840, 280);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(0, 0, 450, 230, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 17px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('COGNITIVE REFLECTION TEST (CRT)', 25, 38);

  ctx.fillStyle = '#ffffff';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.fillText('• A bat and a ball cost $1.10 in total.', 25, 75);
  ctx.fillText('• The bat costs $1.00 MORE than the ball.', 25, 105);
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('QUESTION: How much does the ball cost?', 25, 140);

  // Answers HUD
  if (t >= 24.0) {
    // Blunder answer
    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.beginPath();
    ctx.roundRect(25, 160, 180, 50, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.fillText('AI: "$0.10" ❌', 40, 192);

    // Correct System 2 answer
    if (t >= 36.0) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.beginPath();
      ctx.roundRect(220, 160, 200, 50, 8);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText('True: "$0.05" ✅', 235, 192);
    }
  }
  ctx.restore();

  // 4. STICKMAN MAGI ON LEFT
  const magiX = 520, magiY = 720;
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
        target: { x: 780, y: 420 }, // Gesturing to the puzzle board
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
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 780, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 11 • THE FAST-THINKING TRAP (SYSTEM 1 VS SYSTEM 2)', 105, 74);

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
      console.log(`\n🎉 ACT 1 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
