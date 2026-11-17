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
const VOICE = path.resolve('projects/ep19-interpretability-superintelligence/build/narration/act2.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP19-Act2-SparseAutoencoders-1080p.mp4');
const SFX_FILE = '/tmp/ep19_act2_sfx.wav';
const MIX_FILE = '/tmp/ep19_act2_mix.wav';

console.log(`=== EP19 ACT 2: SPARSE AUTOENCODERS (THE PRISMS OF THE MIND) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 83921;
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

  // Optical laser hum
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 240 * t) * 0.3 + noise() * 0.08) * 0.25,
    (t) => (Math.sin(2 * Math.PI * 242 * t) * 0.3 + noise() * 0.08) * 0.25,
    0.20
  );

  // Diamond prism alignment click at t = 14.0s
  addStereo(14.0, 0.5,
    (t) => (Math.sin(2 * Math.PI * 1800 * t) + noise() * 0.6) * Math.exp(-t * 18),
    (t) => (Math.sin(2 * Math.PI * 1820 * t) + noise() * 0.6) * Math.exp(-t * 18),
    0.40
  );

  // Spectral refraction ignition chord at t = 22.0s
  addStereo(22.0, 2.5,
    (t) => (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 660 * t) * 0.6 + Math.sin(2 * Math.PI * 880 * t) * 0.4) * Math.exp(-t * 1.5),
    (t) => (Math.sin(2 * Math.PI * 442 * t) + Math.sin(2 * Math.PI * 663 * t) * 0.6 + Math.sin(2 * Math.PI * 884 * t) * 0.4) * Math.exp(-t * 1.5),
    0.45
  );

  // Monosemantic crystal chime at t = 42.0s
  addStereo(42.0, 1.5,
    (t) => (Math.sin(2 * Math.PI * 1200 * t) + Math.sin(2 * Math.PI * 2400 * t) * 0.3) * Math.exp(-t * 4),
    (t) => (Math.sin(2 * Math.PI * 1205 * t) + Math.sin(2 * Math.PI * 2410 * t) * 0.3) * Math.exp(-t * 4),
    0.40
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

  // Background: Deep Optical Physics Laboratory
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.5, '#0d1127');
  bg.addColorStop(1, '#030712');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 120) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.3, 640);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 640; y <= HEIGHT; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // HEADER BANNER
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ACT 2: SPARSE AUTOENCODERS — THE PRISMS OF THE MIND', 80, 75);

  ctx.fillStyle = '#a855f7';
  ctx.font = '22px NotoSans, sans-serif';
  ctx.fillText('Anthropic 2023/2024 Breakthrough • Dictionary Learning • Monosemanticity', 80, 112);

  // CENTRAL FOCAL SETUP: OPTICAL BENCH & DIAMOND PRISM
  const benchY = 620;
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.fillRect(100, benchY, WIDTH - 200, 24);
  ctx.strokeRect(100, benchY, WIDTH - 200, 24);

  // Incoming Dense Beam from left
  const prismX = 960, prismY = 460;
  drawGroundShadow(ctx, prismX, benchY, 260, 28);

  const incomingEndX = prismX - 60;
  // Tangled white/gray multi-frequency laser beam
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(120, prismY);
  ctx.lineTo(incomingEndX, prismY);
  ctx.stroke();

  // Dense Beam Label
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DENSE HIDDEN ACTIVATIONS x ∈ R^d (d = 4,096)', 500, prismY - 25);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Tangled polysemantic superposition', 500, prismY - 5);

  // THE DIAMOND PRISM (Sparse Autoencoder)
  ctx.beginPath();
  ctx.moveTo(prismX, prismY - 160);
  ctx.lineTo(prismX + 110, prismY + 120);
  ctx.lineTo(prismX - 110, prismY + 120);
  ctx.closePath();
  const pGrad = ctx.createLinearGradient(prismX - 80, prismY - 100, prismX + 80, prismY + 100);
  pGrad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
  pGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)');
  pGrad.addColorStop(1, 'rgba(236, 72, 153, 0.4)');
  ctx.fillStyle = pGrad;
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Prism Stand
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(prismX - 25, prismY + 120, 50, benchY - (prismY + 120));

  // Prism Title Badge
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(prismX - 120, prismY + 140, 240, 42, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#c084fc';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SPARSE AUTOENCODER', prismX, prismY + 167);

  // REFRACTED MONOSEMANTIC FEATURE RAYS (Right Side)
  const features = [
    { label: 'Feature #14,291: Python Syntax Error', col: '#ef4444', yOff: -170 },
    { label: 'Feature #8,402: Sycophantic Flattery', col: '#f59e0b', yOff: -85 },
    { label: 'Feature #34,912: San Francisco Landmark', col: '#10b981', yOff: 0 },
    { label: 'Feature #99,104: Deceptive Behavior', col: '#38bdf8', yOff: 85 },
    { label: 'Feature #112,055: Emotional Vulnerability', col: '#ec4899', yOff: 170 }
  ];

  const rayStartX = prismX + 50;
  const rayStartY = prismY;
  const rayEndX = 1450;

  features.forEach((f, idx) => {
    const targetY = prismY + f.yOff;

    // Glowing laser ray
    ctx.strokeStyle = f.col;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(rayStartX, rayStartY);
    ctx.lineTo(rayEndX, targetY);
    ctx.stroke();

    // Feature card at target
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = f.col;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(rayEndX, targetY - 26, 390, 52, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = f.col;
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(f.label, rayEndX + 16, targetY + 6);
  });

  // MATHEMATICAL SAE FORMULA BOX (Top Center-Right)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1100, 140, 740, 75, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('f(x) = TopK( W_enc • x + b_enc )   |   x̂ = W_dec • f(x) + b_dec', 1470, 175);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Loss = ||x - x̂||² + Sparsity Constraint (Overcomplete Dictionary M >> d)', 1470, 202);

  // STICKMAN OPTICAL PHYSICIST (Standing on the left, adjusting the laser alignment)
  const smX = 320, smY = 510;
  drawGroundShadow(ctx, smX, smY + 190, 80, 16);

  drawFigure(ctx, {
    head: { x: smX, y: smY - 30, r: 28 },
    torso: {
      start: { x: smX, y: smY },
      end: { x: smX, y: smY + 105 }
    },
    leftArm: {
      upper: { start: { x: smX, y: smY + 18 }, end: { x: smX - 35, y: smY + 50 } },
      forearm: { start: { x: smX - 35, y: smY + 50 }, end: { x: smX - 20, y: smY + 80 } }
    },
    rightArm: {
      upper: { start: { x: smX, y: smY + 18 }, end: { x: smX + 45, y: smY + 30 } },
      forearm: { start: { x: smX + 45, y: smY + 30 }, end: { x: smX + 90, y: smY + 15 } } // Calibrating laser emitter
    },
    leftLeg: {
      upper: { start: { x: smX, y: smY + 105 }, end: { x: smX - 22, y: smY + 150 } },
      lower: { start: { x: smX - 22, y: smY + 150 }, end: { x: smX - 25, y: smY + 195 } }
    },
    rightLeg: {
      upper: { start: { x: smX, y: smY + 105 }, end: { x: smX + 22, y: smY + 150 } },
      lower: { start: { x: smX + 22, y: smY + 150 }, end: { x: smX + 30, y: smY + 195 } }
    },
    facing: 'right',
    expression: 'focused',
    coatColor: '#ffffff',
    lineColor: '#ffffff',
    lineWidth: 4.5
  });

  // Safety Goggles on Stickman
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(smX + 6, smY - 36, 26, 12, 4);
  ctx.stroke();

  // BOTTOM TELEMETRY BAR
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 930, WIDTH - 160, 90, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#a855f7';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HISTORIC ACHIEVEMENT: MONOSEMANTICITY EMERGES', 110, 968);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('Anthropic extracts millions of clean, isolated concepts from Claude 3 Sonnet. The world\'s first fMRI for an artificial mind.', 110, 995);

  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (frame % 300 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`  Rendered frame ${frame}/${TOTAL_FRAMES} (${((frame / TOTAL_FRAMES) * 100).toFixed(1)}%)`);
  }
}

ffmpeg.stdin.end();

await new Promise((resolve, reject) => {
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      console.log(`✅ Act 2 rendered successfully: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
