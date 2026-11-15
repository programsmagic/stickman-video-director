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
  spring,
  blinkState,
  idleBreath,
  drawGroundShadow
} from '../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1920, HEIGHT = 1080, FPS = 30;
const DURATION = 12.0; // 12 seconds
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const OUT_DIR = path.resolve('projects/benchmark-1080p/output');
fs.mkdirSync(OUT_DIR, { recursive: true });

const OUTPUT_1080P = path.join(OUT_DIR, 'benchmark_1080p_master.mp4');
const OUTPUT_720P = path.join(OUT_DIR, 'benchmark_720p_preview.mp4');
const SFX_FILE = path.join(OUT_DIR, 'benchmark_sfx.wav');

console.log(`=== MASTER BLUEPRINT: 1080P PROOF-OF-QUALITY BENCHMARK ===`);
console.log(`Resolution: ${WIDTH}x${HEIGHT} @ ${FPS}fps | Total Frames: ${TOTAL_FRAMES}`);

// ----------------------------------------------------------------------------
// 1. PROCEDURAL 48 kHz STEREO FOLEY SYNTHESIS
// ----------------------------------------------------------------------------
{
  console.log('• Synthesizing 48 kHz stereo procedural Foley...');
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 94821;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };

  const addStereo = (t0, len, fnL, fnR, gain = 0.3) => {
    const i0 = Math.round(t0 * rate);
    const cnt = Math.min(n - i0, Math.round(len * rate));
    for (let i = 0; i < cnt; i++) {
      if (i0 + i >= 0 && i0 + i < n) {
        const dt = i / rate;
        left[i0 + i] += fnL(dt) * gain;
        right[i0 + i] += fnR(dt) * gain;
      }
    }
  };

  // 1. Ambient mountain wind hum (0.0s - 12.0s)
  addStereo(0.0, 12.0,
    t => (noise() * 0.05 + Math.sin(2 * Math.PI * 55 * t) * 0.08) * Math.min(1, t * 1.5),
    t => (noise() * 0.05 + Math.sin(2 * Math.PI * 58 * t) * 0.08) * Math.min(1, t * 1.5),
    0.22
  );

  // 2. Lantern creak / raise anticipation at 3.2s
  addStereo(3.2, 1.2,
    t => (Math.sin(2 * Math.PI * 320 * t + Math.sin(t * 30) * 2) * Math.exp(-t * 3)),
    t => (Math.sin(2 * Math.PI * 340 * t + Math.sin(t * 30) * 2) * Math.exp(-t * 3)),
    0.18
  );

  // 3. Staff Tap CLANG & Resonance at 6.0s (Key Cause & Effect)
  addStereo(6.0, 3.5,
    t => (Math.sin(2 * Math.PI * 523.25 * t) * 0.7 + Math.sin(2 * Math.PI * 1046.5 * t) * 0.3 + Math.sin(2 * Math.PI * 65.4 * t) * 0.8) * Math.exp(-t * 1.8),
    t => (Math.sin(2 * Math.PI * 523.25 * t) * 0.5 + Math.sin(2 * Math.PI * 1046.5 * t) * 0.4 + Math.sin(2 * Math.PI * 65.4 * t) * 0.8) * Math.exp(-t * 1.8),
    0.70
  );
  // Impact crack
  addStereo(6.0, 0.25,
    t => noise() * Math.exp(-t * 30),
    t => noise() * Math.exp(-t * 30),
    0.50
  );

  // 4. Gradient descent rollout arpeggio (6.2s - 8.5s)
  [0, 1, 2, 3, 4, 5].forEach((step, idx) => {
    const noteTime = 6.2 + idx * 0.38;
    const freq = 659.25 - idx * 45; // descending pitch down the valley
    addStereo(noteTime, 0.8,
      t => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 4),
      t => Math.sin(2 * Math.PI * (freq * 1.01) * t) * Math.exp(-t * 4),
      0.30
  );
  });

  // 5. Global minimum lock sparkle chord at 8.5s
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    addStereo(8.5, 3.0,
      t => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 1.5),
      t => Math.sin(2 * Math.PI * (freq * 1.005) * t) * Math.exp(-t * 1.5),
      0.28
    );
  });

  // Write Stereo 16-bit PCM WAV
  const sampleCount = n * 2;
  const wavBuf = Buffer.alloc(44 + sampleCount * 2);
  wavBuf.write('RIFF', 0);
  wavBuf.writeUInt32LE(36 + sampleCount * 2, 4);
  wavBuf.write('WAVE', 8);
  wavBuf.write('fmt ', 12);
  wavBuf.writeUInt32LE(16, 16);
  wavBuf.writeUInt16LE(1, 20); // PCM
  wavBuf.writeUInt16LE(2, 22); // Stereo 2ch
  wavBuf.writeUInt32LE(rate, 24);
  wavBuf.writeUInt32LE(rate * 4, 28);
  wavBuf.writeUInt16LE(4, 32);
  wavBuf.writeUInt16LE(16, 34); // 16-bit
  wavBuf.write('data', 36);
  wavBuf.writeUInt32LE(sampleCount * 2, 40);

  let offset = 44;
  for (let i = 0; i < n; i++) {
    const sl = Math.max(-1, Math.min(1, left[i]));
    const sr = Math.max(-1, Math.min(1, right[i]));
    wavBuf.writeInt16LE(Math.round(sl * 32767), offset);
    wavBuf.writeInt16LE(Math.round(sr * 32767), offset + 2);
    offset += 4;
  }
  fs.writeFileSync(SFX_FILE, wavBuf);
  console.log(`  ✅ Written 48 kHz stereo Foley: ${SFX_FILE}`);
}

// ----------------------------------------------------------------------------
// 2. 1080P MASTER CANVAS RENDERING & FFMPEG PIPE
// ----------------------------------------------------------------------------
console.log('• Launching 1080p FFmpeg encoding pipeline...');
const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'rawvideo',
  '-pix_fmt', 'rgba',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-r', `${FPS}`,
  '-i', 'pipe:0',
  '-i', SFX_FILE,
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '16',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-ar', '48000',
  '-b:a', '256k',
  '-movflags', '+faststart',
  OUTPUT_1080P
]);

ffmpeg.stderr.on('data', () => {}); // keep pipe clean
ffmpeg.on('close', code => {
  if (code !== 0) console.error(`FFmpeg exited with code ${code}`);
});

// Trajectory path coordinates down the loss valley
const PATH_POINTS = [
  [440, 780],
  [620, 760],
  [820, 710],
  [1040, 680],
  [1240, 720],
  [1420, 800],
  [1520, 840]
];

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // --- BACKGROUND: Deep Midnight Slate with subtle vignette ---
  const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 200, WIDTH / 2, HEIGHT / 2, 1100);
  bgGrad.addColorStop(0, '#0F172A');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // --- TOPOGRAPHIC CONTOUR LINES (MANIM-STYLE 3D LOSS LANDSCAPE) ---
  ctx.save();
  ctx.lineWidth = 2.5;
  const contourLevels = [
    { ry: 340, rx: 750, cy: 780, cx: 1350, alpha: 0.12, col: '#38BDF8' },
    { ry: 280, rx: 620, cy: 800, cx: 1380, alpha: 0.18, col: '#38BDF8' },
    { ry: 210, rx: 480, cy: 820, cx: 1420, alpha: 0.25, col: '#60A5FA' },
    { ry: 150, rx: 340, cy: 830, cx: 1460, alpha: 0.35, col: '#818CF8' },
    { ry: 90,  rx: 210, cy: 840, cx: 1500, alpha: 0.50, col: '#A78BFA' },
    { ry: 45,  rx: 110, cy: 845, cx: 1520, alpha: 0.75, col: '#F59E0B' }  // Global Minimum
  ];

  contourLevels.forEach((lvl, idx) => {
    ctx.strokeStyle = lvl.col;
    ctx.globalAlpha = lvl.alpha;
    ctx.beginPath();
    ctx.ellipse(lvl.cx, lvl.cy, lvl.rx, lvl.ry, -0.08, 0, Math.PI * 2);
    ctx.stroke();

    // Elevation tag
    if (idx < contourLevels.length - 1) {
      ctx.font = '14px NotoSans';
      ctx.fillStyle = lvl.col;
      ctx.globalAlpha = lvl.alpha * 1.5;
      ctx.fillText(`L = ${(1.2 - idx * 0.22).toFixed(2)}`, lvl.cx - lvl.rx + 20, lvl.cy - 10);
    }
  });
  ctx.restore();

  // --- GLOBAL MINIMUM TARGET PULSE ---
  const minX = 1520, minY = 845;
  const pulse = Math.sin(t * 4) * 0.5 + 0.5;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(minX, minY, 35 + pulse * 15, 16 + pulse * 7, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.6 + pulse * 0.4;
  ctx.stroke();

  // Glow core
  ctx.beginPath();
  ctx.arc(minX, minY, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#FDE047';
  ctx.fill();

  ctx.font = 'bold 20px NotoSans';
  ctx.fillStyle = '#FDE047';
  ctx.textAlign = 'center';
  ctx.fillText('GLOBAL MINIMUM (∇L = 0)', minX, minY + 42);
  ctx.restore();

  // --- GRADIENT DESCENT PATH ANIMATION (after staff tap at 6.0s) ---
  if (t >= 6.0) {
    const progress = Math.min(1.0, (t - 6.0) / 2.5); // 2.5s rollout
    const activePointsCount = Math.max(2, Math.floor(progress * PATH_POINTS.length));
    
    ctx.save();
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(PATH_POINTS[0][0], PATH_POINTS[0][1]);
    for (let p = 1; p < activePointsCount; p++) {
      ctx.lineTo(PATH_POINTS[p][0], PATH_POINTS[p][1]);
    }
    ctx.stroke();

    // Leading descent probe particle
    const lastP = PATH_POINTS[activePointsCount - 1];
    ctx.beginPath();
    ctx.arc(lastP[0], lastP[1], 10, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Directional vector arrow
    ctx.font = 'bold 18px NotoSans';
    ctx.fillStyle = '#FBBF24';
    ctx.textAlign = 'center';
    ctx.fillText('−η ∇L(θ)', lastP[0], lastP[1] - 22);
    ctx.restore();
  }

  // --- RIDGE GROUNDING SHADOW UNDER MAGI ---
  const magiX = 380;
  const magiY = 760;
  drawGroundShadow(ctx, magiX, magiY + 130, 110, 24, 0.4);

  // --- MAGI CHARACTER WITH PROCEDURAL MOTION ---
  const breath = idleBreath(t, 16);
  const blink = blinkState(t, 3);
  const r = 100; // 1080p scaled character radius

  // Motion states:
  // 0.0 - 3.2s: Idle observe with lantern
  // 3.2 - 6.0s: Lean forward (anticipation), raise lantern
  // 6.0 - 9.0s: Tap staff down, watch path descend
  // 9.0 - 12.0s: Turn to camera, smile, celebration follow-through

  let torsoAngle = breath.torsoDelta;
  let headTilt = 0;
  let facing = 'right';
  let eyes = blink;
  let mouth = 'smile';
  let targetArmR = null;
  let targetArmL = null;

  if (t < 3.2) {
    facing = 'right';
    torsoAngle += 2;
    headTilt = 4;
    // Left hand holds lantern forward
    targetArmL = [magiX - 90, magiY - 20];
    // Right hand rests on staff
    targetArmR = [magiX + 60, magiY + 40];
  } else if (t < 6.0) {
    // Anticipation: lean forward, lift lantern higher
    const pLean = (t - 3.2) / 2.8;
    torsoAngle += 2 + pLean * 8;
    headTilt = 8;
    targetArmL = [magiX - 110, magiY - 60 - pLean * 30]; // Lantern raised
    targetArmR = [magiX + 70, magiY + 20];
    eyes = blink === 'closed' ? 'closed' : 'wide';
  } else if (t < 9.0) {
    // Action: Staff tap down at 6.0s
    torsoAngle += 6;
    headTilt = 12;
    targetArmR = [magiX + 80, magiY + 90]; // Staff planted down
    targetArmL = [magiX - 80, magiY - 40];
    mouth = 'open';
  } else {
    // Follow-through: Turn to viewer, celebrate
    facing = 'front';
    torsoAngle = 0;
    headTilt = Math.sin(t * 3) * 3;
    eyes = 'wide';
    mouth = 'grin';
    targetArmR = [magiX + 110, magiY - 40];
    targetArmL = [magiX - 110, magiY - 40];
  }

  // Draw Surveyor Staff (wood + brass measure marks)
  const staffX = magiX + 75;
  ctx.save();
  ctx.strokeStyle = '#854D0E';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(staffX, magiY - 140);
  ctx.lineTo(staffX, magiY + 135);
  ctx.stroke();
  // Brass measurement rings
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 4;
  for (let sY = -100; sY <= 100; sY += 30) {
    ctx.beginPath();
    ctx.moveTo(staffX - 7, magiY + sY);
    ctx.lineTo(staffX + 7, magiY + sY);
    ctx.stroke();
  }
  ctx.restore();

  // Draw Character Magi
  drawFigure(ctx, {
    torso: torsoAngle,
    head: headTilt,
    facing: facing,
    eyes: eyes,
    mouth: mouth,
    scarf: true,
    accessory: 'wizard-hat',
    targetArmL: targetArmL ? [targetArmL[0] - magiX, targetArmL[1] - magiY] : null,
    targetArmR: targetArmR ? [targetArmR[0] - magiX, targetArmR[1] - magiY] : null,
    legL: [-10, -5],
    legR: [14, 10]
  }, {
    x: magiX,
    y: magiY + breath.hipYDelta,
    r: r,
    seed: 42
  });

  // Lantern Light Beam illumination cone
  if (targetArmL && t < 9.0) {
    const lx = targetArmL[0];
    const ly = targetArmL[1];
    ctx.save();
    const beam = ctx.createRadialGradient(lx, ly, 10, lx + 280, ly + 60, 480);
    beam.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    beam.addColorStop(0.5, 'rgba(254, 240, 138, 0.12)');
    beam.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 480, ly - 80);
    ctx.lineTo(lx + 520, ly + 220);
    ctx.closePath();
    ctx.fill();

    // Lantern prop
    ctx.beginPath();
    ctx.arc(lx, ly, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#FEF08A';
    ctx.fill();
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }

  // --- TOP HUD: CLEAN EDITORIAL HEADERS (MASTER BLUEPRINT SECTION 10) ---
  ctx.save();
  // Episode title HUD banner
  ctx.font = '24px CaveatHand';
  ctx.fillStyle = '#94A3B8';
  ctx.textAlign = 'center';
  ctx.fillText('PROGRAMS MAGIC · THE GEOMETRY OF THINKING (EP04 PROOF-OF-QUALITY)', WIDTH / 2, 46);

  // Action header
  ctx.font = 'bold 30px NotoSans';
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.fillText('GRADIENT DESCENT: DESCENDING HIGH-DIMENSIONAL LOSS VALLEYS', WIDTH / 2, 92);

  // Subtitle formula
  ctx.font = '20px NotoSans';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('θ(t+1) = θ(t) − η · ∇L(θ)', WIDTH / 2, 130);
  ctx.restore();

  // Send raw frame buffer to FFmpeg pipe
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 60 === 0 || frame === TOTAL_FRAMES - 1) {
    const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
    console.log(`1080p Render Progress: ${pct}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 1080p Master Render Complete: ${OUTPUT_1080P}`);

// Generate 720p Preview with FFmpeg scaling
console.log('• Generating 720p standard preview...');
execSync(`ffmpeg -y -i "${OUTPUT_1080P}" -vf "scale=1280:720" -c:v libx264 -crf 20 -c:a copy "${OUTPUT_720P}"`);
console.log(`  ✅ 720p Preview Complete: ${OUTPUT_720P}`);

// Run QA Inspector on 1080p Master
console.log('\n• Running QA Inspector on 1080p Master...');
execSync(`node projects/tools/qa_inspector.mjs "${OUTPUT_1080P}" --profile 1080p --out-dir "${OUT_DIR}"`, { stdio: 'inherit' });
