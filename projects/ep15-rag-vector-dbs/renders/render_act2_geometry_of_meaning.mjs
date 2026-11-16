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
const VOICE = path.resolve('projects/ep15-rag-vector-dbs/build/narration/act2.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP15-Act2-GeometryOfMeaning-1080p.mp4');
const SFX_FILE = '/tmp/ep15_act2_sfx.wav';
const MIX_FILE = '/tmp/ep15_act2_mix.wav';

console.log(`=== EP15 ACT 2: THE GEOMETRY OF MEANING ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 51928;
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

  // High-tech laser scanner sweep (t = 6.0s to 18.0s)
  addStereo(6.0, 12.0,
    (t) => (Math.sin(2 * Math.PI * (440 + 300 * Math.sin(t * 4)) * t) + noise() * 0.1) * 0.25,
    (t) => (Math.sin(2 * Math.PI * (444 + 300 * Math.sin(t * 4)) * t) + noise() * 0.1) * 0.25,
    0.35
  );

  // Digital coordinate pings (t = 20.0s, 24.0s, 28.0s)
  for (const tPing of [20.0, 24.0, 28.0]) {
    addStereo(tPing, 0.8,
      (t) => Math.sin(2 * Math.PI * 1760 * t) * Math.exp(-t * 9),
      (t) => Math.sin(2 * Math.PI * 1765 * t) * Math.exp(-t * 9),
      0.45
    );
  }

  // 3D celestial hypersphere resonance (t = 32.0s to dur)
  addStereo(32.0, dur - 32.0,
    (t) => (Math.sin(2 * Math.PI * 528 * t) + Math.sin(2 * Math.PI * 1056 * t) * 0.3) * (0.2 + 0.05 * Math.sin(t * 2)),
    (t) => (Math.sin(2 * Math.PI * 532 * t) + Math.sin(2 * Math.PI * 1060 * t) * 0.3) * (0.2 + 0.05 * Math.cos(t * 2)),
    0.30
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

  // Background gradient: Cosmic deep blue-slate
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.5, '#09132e');
  bg.addColorStop(1, '#040817');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -300; x <= WIDTH + 300; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 660);
    ctx.lineTo((x - 960) * 2.5 + 960, HEIGHT);
    ctx.stroke();
  }
  for (let y = 660; y <= HEIGHT; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Left Side: Text to Embedding Chamber
  const chamberX = 380, chamberY = 380;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(chamberX - 220, chamberY - 180, 440, 360, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('EMBEDDING TRANSFORMER', chamberX - 160, chamberY - 145);

  // Input Text Block
  const textShift = Math.sin(t * 3) * 6;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(chamberX - 180, chamberY - 100 + textShift, 360, 60, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('"The raging tempest destroyed the coast"', chamberX - 170, chamberY - 65 + textShift);

  // Scanning laser beam
  const laserY = chamberY - 20 + Math.sin(t * 8) * 35;
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(chamberX - 190, laserY);
  ctx.lineTo(chamberX + 190, laserY);
  ctx.stroke();

  // Downward compression laser funnel
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(chamberX - 140, chamberY + 40);
  ctx.lineTo(chamberX, chamberY + 110);
  ctx.lineTo(chamberX + 140, chamberY + 40);
  ctx.stroke();

  // Dense 1,536-D Vector Output Array
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('[+0.824, -0.193, +0.441, ... +0.082]', chamberX - 170, chamberY + 140);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 14px NotoSans, sans-serif';
  ctx.fillText('Dimension: 1,536 (L2-Normalized)', chamberX - 120, chamberY + 165);

  // Right Side: 3D Celestial Hypersphere & Cosine Angle Geometry
  const sphereX = 1320, sphereY = 460, sphereR = 260;

  // Hypersphere ambient glow
  const sphereGlow = ctx.createRadialGradient(sphereX, sphereY, 40, sphereX, sphereY, sphereR + 80);
  sphereGlow.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
  sphereGlow.addColorStop(0.6, 'rgba(139, 92, 246, 0.15)');
  sphereGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sphereGlow;
  ctx.beginPath();
  ctx.arc(sphereX, sphereY, sphereR + 80, 0, Math.PI * 2);
  ctx.fill();

  // Manim 3D Sphere Rings
  const rot = t * 0.4;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sphereX, sphereY, sphereR, 0, Math.PI * 2);
  ctx.stroke();

  // Rotating latitude/longitude ellipses
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
  ctx.beginPath();
  ctx.ellipse(sphereX, sphereY, sphereR, sphereR * Math.abs(Math.sin(rot)), 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
  ctx.beginPath();
  ctx.ellipse(sphereX, sphereY, sphereR * Math.abs(Math.cos(rot)), sphereR, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Coordinate Origin
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sphereX, sphereY, 6, 0, Math.PI * 2);
  ctx.fill();

  // Vector U: "furious storm"
  const u_angle = -0.65;
  const u_len = sphereR * 0.85;
  const ux = sphereX + Math.cos(u_angle) * u_len;
  const uy = sphereY + Math.sin(u_angle) * u_len;

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sphereX, sphereY);
  ctx.lineTo(ux, uy);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(ux, uy, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('u: "furious storm"', ux + 12, uy - 6);

  // Vector V: "raging tempest" (Very close angle θ)
  const v_angle = -0.48;
  const v_len = sphereR * 0.88;
  const vx = sphereX + Math.cos(v_angle) * v_len;
  const vy = sphereY + Math.sin(v_angle) * v_len;

  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sphereX, sphereY);
  ctx.lineTo(vx, vy);
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(vx, vy, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText('v: "raging tempest"', vx + 12, vy + 20);

  // Vector W: "wooden chair" (Orthogonal, far away)
  const w_angle = 1.35;
  const w_len = sphereR * 0.75;
  const wx = sphereX + Math.cos(w_angle) * w_len;
  const wy = sphereY + Math.sin(w_angle) * w_len;

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(sphereX, sphereY);
  ctx.lineTo(wx, wy);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(wx, wy, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px NotoSans, sans-serif';
  ctx.fillText('w: "wooden chair"', wx + 12, wy + 16);

  // Cosine Angle Arc & Formula HUD
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(sphereX, sphereY, 90, u_angle, v_angle);
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText('θ = 9.7°', sphereX + 95, sphereY - 45);

  // Formula Card (Bottom Right)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(sphereX - 220, sphereY + sphereR - 50, 440, 75, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('cos(θ) = (u · v) / (||u|| ||v||)', sphereX - 180, sphereY + sphereR - 18);
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('Similarity Score = 0.985 (MATCH)', sphereX - 170, sphereY + sphereR + 12);

  // 3. Stickman Magi in Center Operating the System
  const magiX = 810;
  const magiY = 720;
  const breath = idleBreath(frame);

  drawGroundShadow(ctx, magiX, magiY, 75);

  const figure = {
    head: { x: magiX, y: 390 + breath, radius: 34, tilt: 0.1 },
    body: {
      spine: [
        { x: magiX, y: 424 + breath },
        { x: magiX + 3, y: 485 + breath * 0.8 },
        { x: magiX + 5, y: 550 }
      ],
      width: 6
    },
    leftArm: {
      ik: {
        target: { x: chamberX + 220, y: chamberY + 40 }, // Touching chamber output
        pole: { x: magiX - 40, y: 460 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: sphereX - 140, y: sphereY - 40 }, // Pointing to angle arc
        pole: { x: magiX + 50, y: 460 }
      },
      upperLength: 68,
      lowerLength: 72
    },
    leftLeg: {
      ik: {
        target: { x: magiX + 40, y: magiY },
        pole: { x: magiX + 50, y: 630 }
      },
      upperLength: 85,
      lowerLength: 88
    },
    rightLeg: {
      ik: {
        target: { x: magiX - 30, y: magiY },
        pole: { x: magiX - 20, y: 630 }
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
  ctx.roundRect(80, 40, 620, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 09 • DENSE EMBEDDINGS & 1,536-D GEOMETRY', 105, 74);

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
