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
const VOICE = path.resolve('projects/ep19-interpretability-superintelligence/build/narration/act6.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP19-Act6-GrandSynthesisAGI-1080p.mp4');
const SFX_FILE = '/tmp/ep19_act6_sfx.wav';
const MIX_FILE = '/tmp/ep19_act6_mix.wav';

console.log(`=== EP19 ACT 6: THE GRAND SYNTHESIS (FROM SAND TO SUPERINTELLIGENCE) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 39182;
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

  // Cosmic celestial synth drone throughout
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 130.81 * t) * 0.3 + Math.sin(2 * Math.PI * 196.0 * t) * 0.2 + noise() * 0.05) * 0.3,
    (t) => (Math.sin(2 * Math.PI * 131.2 * t) * 0.3 + Math.sin(2 * Math.PI * 196.4 * t) * 0.2 + noise() * 0.05) * 0.3,
    0.25
  );

  // Sand melting lightning sizzle at t = 3.0s
  addStereo(3.0, 1.8,
    (t) => (noise() * 0.7 * Math.exp(-t * 2.5) + Math.sin(2 * Math.PI * 600 * t) * 0.3),
    (t) => (noise() * 0.7 * Math.exp(-t * 2.5) + Math.sin(2 * Math.PI * 610 * t) * 0.3),
    0.40
  );

  // 13 Constellation stars lighting chimes (t = 14s to 38s)
  for (let s = 0; s < 13; s++) {
    const tStar = 14.0 + s * 1.8;
    const freq = 440 * Math.pow(2, (s % 7) / 12);
    addStereo(tStar, 1.2,
      (t) => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 4),
      (t) => Math.sin(2 * Math.PI * (freq + 2) * t) * Math.exp(-t * 4),
      0.30
    );
  }

  // Grand climax majestic cathedral chord at t = 44.0s
  addStereo(44.0, 5.0,
    (t) => (Math.sin(2 * Math.PI * 261.63 * t) + Math.sin(2 * Math.PI * 329.63 * t) * 0.8 + Math.sin(2 * Math.PI * 392.0 * t) * 0.6) * Math.exp(-t * 0.6),
    (t) => (Math.sin(2 * Math.PI * 262.0 * t) + Math.sin(2 * Math.PI * 330.0 * t) * 0.8 + Math.sin(2 * Math.PI * 392.5 * t) * 0.6) * Math.exp(-t * 0.6),
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

const episodeMilestones = [
  { ep: 'EP01', title: 'Sand to Silicon', col: '#eab308' },
  { ep: 'EP02', title: 'LLM Mechanics', col: '#38bdf8' },
  { ep: 'EP03', title: 'Consciousness & Qualia', col: '#a855f7' },
  { ep: 'EP04', title: 'Geometry of Thinking', col: '#f97316' },
  { ep: 'EP05', title: 'The Token Illusion', col: '#ec4899' },
  { ep: 'EP06', title: 'Physics of Diffusion', col: '#06b6d4' },
  { ep: 'EP07', title: 'The Multimodal Mind', col: '#84cc16' },
  { ep: 'EP08', title: 'Autonomous Agents', col: '#10b981' },
  { ep: 'EP09', title: 'RAG & Vector DBs', col: '#6366f1' },
  { ep: 'EP10', title: 'Post-Training & Alignment', col: '#f43f5e' },
  { ep: 'EP11', title: 'Test-Time Compute', col: '#f59e0b' },
  { ep: 'EP12', title: 'KV Cache & GPU Systems', col: '#38bdf8' },
  { ep: 'EP13', title: 'Mechanistic Interpretability & Superintelligence', col: '#c084fc' }
];

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background: Majestic Cosmic Amphitheater
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(0.5, '#0b0c2a');
  bg.addColorStop(1, '#020210');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Background Nebula stars
  for (let s = 0; s < 50; s++) {
    const sx = ((s * 211 + 67) % WIDTH);
    const sy = ((s * 347 + 23) % (HEIGHT - 350));
    ctx.fillStyle = s % 2 === 0 ? 'rgba(250, 204, 21, 0.5)' : 'rgba(56, 189, 248, 0.4)';
    ctx.beginPath();
    ctx.arc(sx, sy, (s % 3) + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Golden perspective floor grid
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.15)';
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
  ctx.fillText('ACT 6: THE GRAND SYNTHESIS — FROM SAND TO SUPERINTELLIGENCE', 80, 75);

  ctx.fillStyle = '#facc15';
  ctx.font = '22px NotoSans, sans-serif';
  ctx.fillText('13-Episode Complete Masterclass • From First Principles to AI Expert', 80, 112);

  // SECTION 1: THE GOLDEN CELESTIAL CONSTELLATION ARC (All 13 Episodes)
  const arcStartX = 120, arcEndX = 1800;
  const arcControlY = 160, arcBaseY = 460;

  // Draw continuous golden parabolic celestial path
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(arcStartX, arcBaseY);
  ctx.quadraticCurveTo(WIDTH / 2, arcControlY, arcEndX, arcBaseY);
  ctx.stroke();

  // Milestone points along the curve
  const visibleNodes = Math.min(13, Math.floor(Math.max(0, (t - 12.0) / 1.8)) + 1);

  for (let i = 0; i < 13; i++) {
    const fraction = i / 12.0;
    // Quadratic bezier interpolation
    const bx = (1 - fraction) * (1 - fraction) * arcStartX + 2 * (1 - fraction) * fraction * (WIDTH / 2) + fraction * fraction * arcEndX;
    const by = (1 - fraction) * (1 - fraction) * arcBaseY + 2 * (1 - fraction) * fraction * arcControlY + fraction * fraction * arcBaseY;

    const isLit = i < visibleNodes;
    const ms = episodeMilestones[i];

    // Node circle
    ctx.fillStyle = isLit ? ms.col : '#1e293b';
    ctx.strokeStyle = isLit ? '#ffffff' : '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, isLit ? 10 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Node label if lit
    if (isLit) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 13px NotoSans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ms.ep, bx, by - 16);

      // Staggered title above/below
      const textY = i % 2 === 0 ? by + 28 : by - 32;
      ctx.fillStyle = ms.col;
      ctx.font = '11px NotoSans, sans-serif';
      ctx.fillText(ms.title, bx, textY);
    }
  }

  // SECTION 2: STICKMAN MAGI (Center Apex, Holding Golden Lantern)
  const magiX = 960, magiY = 510;
  drawGroundShadow(ctx, magiX, magiY + 190, 90, 18);

  const lanternGlow = 1.0 + Math.sin(t * 6) * 0.2;

  drawFigure(ctx, {
    head: { x: magiX, y: magiY - 30, r: 28 },
    torso: {
      start: { x: magiX, y: magiY },
      end: { x: magiX, y: magiY + 105 }
    },
    leftArm: {
      upper: { start: { x: magiX, y: magiY + 18 }, end: { x: magiX - 45, y: magiY + 35 } },
      forearm: { start: { x: magiX - 45, y: magiY + 35 }, end: { x: magiX - 90, y: magiY + 20 } } // Arm extended holding golden lantern
    },
    rightArm: {
      upper: { start: { x: magiX, y: magiY + 18 }, end: { x: magiX + 45, y: magiY + 20 } },
      forearm: { start: { x: magiX + 45, y: magiY + 20 }, end: { x: magiX + 90, y: magiY - 10 } } // Hand raised welcoming the cosmos
    },
    leftLeg: {
      upper: { start: { x: magiX, y: magiY + 105 }, end: { x: magiX - 22, y: magiY + 150 } },
      lower: { start: { x: magiX - 22, y: magiY + 150 }, end: { x: magiX - 25, y: magiY + 195 } }
    },
    rightLeg: {
      upper: { start: { x: magiX, y: magiY + 105 }, end: { x: magiX + 22, y: magiY + 150 } },
      lower: { start: { x: magiX + 22, y: magiY + 150 }, end: { x: magiX + 30, y: magiY + 195 } }
    },
    facing: 'right',
    expression: 'amazed',
    coatColor: '#ffffff',
    lineColor: '#ffffff',
    lineWidth: 4.5
  });

  // The Golden Lantern in hand
  const lantX = magiX - 90, lantY = magiY + 20;
  // Chain
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(lantX, lantY);
  ctx.lineTo(lantX, lantY + 30);
  ctx.stroke();

  // Lantern housing
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.arc(lantX, lantY + 45, 16 * lanternGlow, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(lantX - 14, lantY + 32, 28, 28, 4);
  ctx.stroke();

  // SECTION 3: GRAND COMPLETION SEAL (Active t > 38s)
  if (t > 38) {
    const sealAlpha = Math.min(1.0, (t - 38) / 2.5);
    ctx.save();
    ctx.globalAlpha = sealAlpha;

    // Centered Gold Seal Badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(WIDTH / 2 - 280, 720, 560, 160, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.font = '900 24px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ PROGRAMS MAGIC AI MASTERCLASS ★', WIDTH / 2, 765);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px NotoSans, sans-serif';
    ctx.fillText('13 OF 13 EPISODES FULLY COMPLETE', WIDTH / 2, 800);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '15px NotoSans, sans-serif';
    ctx.fillText('From Beach Sand to Autonomous Superintelligence', WIDTH / 2, 832);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 14px NotoSans, sans-serif';
    ctx.fillText('"The frontier is no longer a mystery. The future belongs to those who understand it."', WIDTH / 2, 860);

    ctx.restore();
  }

  // BOTTOM TELEMETRY BAR
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 930, WIDTH - 160, 90, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CURRICULUM COMPLETE: FROM FIRST PRINCIPLES TO AI EXPERT', 110, 968);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('Artificial intelligence is human curiosity, mathematical rigor, and engineering mastery reflected in the mirror of silicon.', 110, 995);

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
      console.log(`✅ Act 6 rendered successfully: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
