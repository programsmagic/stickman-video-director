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
const VOICE = path.resolve('projects/ep17-test-time-compute/build/narration/act2.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP17-Act2-SecondScalingLaw-1080p.mp4');
const SFX_FILE = '/tmp/ep17_act2_sfx.wav';
const MIX_FILE = '/tmp/ep17_act2_mix.wav';

console.log(`=== EP17 ACT 2: THE SECOND SCALING LAW (TEST-TIME COMPUTE) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 49201;
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

  // Clockwork pendulum tick-tock throughout act
  for (let s = 1.0; s < dur - 1.0; s += 0.8) {
    const isTick = Math.floor(s / 0.8) % 2 === 0;
    const f0 = isTick ? 1200 : 960;
    addStereo(s, 0.09,
      (t) => Math.sin(2 * Math.PI * f0 * t) * Math.exp(-t * 35),
      (t) => Math.sin(2 * Math.PI * (f0 + 8) * t) * Math.exp(-t * 35),
      0.30
    );
  }

  // Supercomputer cluster fan drone (t = 0 to 20s)
  addStereo(0.5, 20.0,
    (t) => (Math.sin(2 * Math.PI * 120 * t) + noise() * 0.1) * 0.2,
    (t) => (Math.sin(2 * Math.PI * 122 * t) + noise() * 0.1) * 0.2,
    0.30
  );

  // New scaling curve laser draw sound at t = 26.0s
  addStereo(26.0, 3.5,
    (t) => Math.sin(2 * Math.PI * (440 + t * 180) * t) * Math.exp(-t * 0.8),
    (t) => Math.sin(2 * Math.PI * (444 + t * 180) * t) * Math.exp(-t * 0.8),
    0.40
  );

  // Milestone breakthrough chime at t = 45.0s (o1 breakthrough)
  addStereo(45.0, 4.0,
    (t) => (Math.sin(2 * Math.PI * 1046 * t) + Math.sin(2 * Math.PI * 1318 * t)) * Math.exp(-t * 1.2),
    (t) => (Math.sin(2 * Math.PI * 1050 * t) + Math.sin(2 * Math.PI * 1324 * t)) * Math.exp(-t * 1.2),
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

  // Background: Deep Indigo Mathematical Space
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030718');
  bg.addColorStop(0.5, '#0b1434');
  bg.addColorStop(1, '#020512');
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

  // 1. MANIM 2D/3D SCALING LAW GRAPH (Center-Left)
  const gx = 200, gy = 520, gw = 750, gh = 360;

  ctx.save();
  ctx.translate(gx, gy);

  // Graph Axes
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(gw, 0); // X-axis (Compute)
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -gh); // Y-axis (Accuracy)
  ctx.stroke();

  // Axis Labels
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Reasoning Accuracy (%) →', gw, 35);
  ctx.textAlign = 'left';
  ctx.fillText('↑ Math / Coding Performance', 15, -gh + 20);

  // Curve 1: Pre-training Scaling (Chinchilla) - Plateaus!
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let px = 0; px <= gw * 0.8; px += 10) {
    const py = -Math.log(1 + px * 0.03) * 70;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('Pre-Training Scaling (Plateaus)', gw * 0.5, -160);

  // Curve 2: The Second Scaling Law (Test-Time Compute) - Shoots up!
  if (t >= 15.0) {
    const progress = Math.min(1, (t - 15.0) / 10.0);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let px = 0; px <= gw * progress; px += 10) {
      const py = -Math.pow(px / gw, 0.65) * (gh * 0.88);
      ctx.lineTo(px, py);
    }
    ctx.stroke();

    if (progress > 0.4) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 17px NotoSans, sans-serif';
      ctx.fillText('🚀 Test-Time Compute: Scaling at Inference!', gw * 0.42, -gh * 0.72);
      ctx.font = 'italic 14px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('Accuracy ∝ log(Thinking Tokens)', gw * 0.42, -gh * 0.72 + 25);
    }
  }
  ctx.restore();

  // 2. RIGHT: MECHANICAL CLOCKWORK PENDULUM (Deliberation Engine)
  const penX = 1420, penY = 220;
  drawGroundShadow(ctx, penX, 720, 160, 24);

  // Clockwork Housing Box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(penX - 160, penY - 60, 320, 480, 16);
  ctx.fill();
  ctx.stroke();

  // Clock Dial at Top
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(penX, penY + 60, 70, 0, Math.PI * 2);
  ctx.stroke();

  // Clock Hands rotating with thinking speed
  const handAngle = t * 2.5;
  ctx.beginPath();
  ctx.moveTo(penX, penY + 60);
  ctx.lineTo(penX + Math.cos(handAngle) * 55, penY + 60 + Math.sin(handAngle) * 55);
  ctx.stroke();

  // Oscillating Brass Pendulum
  const swing = Math.sin(t * 3.5) * 0.45;
  ctx.save();
  ctx.translate(penX, penY + 140);
  ctx.rotate(swing);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 180);
  ctx.stroke();
  // Bob
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, 180, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Efficiency Comparison Pill underneath clock
  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(penX - 140, penY + 360, 280, 50, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('8B Thinking > 70B Instant! 💡', penX, penY + 392);

  // 3. TOP FORMULA BANNER
  ctx.save();
  ctx.translate(200, 120);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, 750, 100, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THE SECOND SCALING LAW: TEST-TIME INFERENCE COMPUTE', 25, 35);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('Perf(M, N_train, C_test) = α · log(C_test) + β', 25, 75);
  ctx.restore();

  // 4. STICKMAN MAGI (Center-Right, pointing to the graph)
  const magiX = 1040, magiY = 720;
  drawGroundShadow(ctx, magiX, magiY, 70);

  const breath = Math.sin(t * 2.5) * 2.0;

  const figure = {
    head: { x: magiX, y: 390 + breath, radius: 34, tilt: -0.1 },
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
        target: { x: 800, y: 430 }, // Gesturing left to the graph
        pole: { x: magiX - 45, y: 470 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: magiX + 45, y: 520 },
        pole: { x: magiX + 35, y: 470 }
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
  ctx.roundRect(80, 40, 750, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 11 • THE SECOND SCALING LAW (TEST-TIME COMPUTE)', 105, 74);

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
      console.log(`\n🎉 ACT 2 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
