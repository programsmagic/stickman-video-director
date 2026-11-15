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
} from '../../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1920, HEIGHT = 1080, FPS = 30;
const VOICE = path.resolve('projects/ep10-geometry-of-thinking/build/narration/act5.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP10-Act5-MomentumAdam-1080p.mp4');
const SFX_FILE = '/tmp/ep10_act5_sfx.wav';
const MIX_FILE = '/tmp/ep10_act5_mix.wav';

console.log(`=== EP10 ACT 5: MOMENTUM & THE ADAM OPTIMIZER ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 92831;
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

  // Heavy rolling boulder low rumble (t = 6s to 24s)
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    if (t >= 6.0 && t <= 24.0) {
      const prog = (t - 6.0) / 18.0;
      const panL = 1.0 - prog * 0.8;
      const panR = 0.2 + prog * 0.8;
      const rumble = (Math.sin(2 * Math.PI * 45 * t) + noise() * 0.25) * 0.15;
      left[i] += rumble * panL;
      right[i] += rumble * panR;
    }
  }

  // Hydraulic hiss and piston whoosh (t = 26s to 42s)
  for (let step = 0; step < 8; step++) {
    const ts = 26.0 + step * 2.2;
    addStereo(ts, 0.35,
      (t) => (noise() * Math.exp(-t * 12) + Math.sin(2 * Math.PI * (300 - t * 400) * t)) * 0.4,
      (t) => (noise() * Math.exp(-t * 12) + Math.sin(2 * Math.PI * (320 - t * 400) * t)) * 0.4,
      0.35
    );
  }

  const s16 = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    s16[i * 2] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)));
    s16[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)));
  }
  const buf = Buffer.alloc(44 + s16.byteLength);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + s16.byteLength, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(s16.byteLength, 40);
  Buffer.from(s16.buffer).copy(buf, 44);
  fs.writeFileSync(SFX_FILE, buf);

  // Mix SFX with Gemini Bodi narration
  execSync(`ffmpeg -v error -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v0];[1:a]volume=0.45[v1];[v0][v1]amix=inputs=2:duration=first:dropout_transition=2" -ar 48000 -c:a pcm_s16le "${MIX_FILE}"`);
  console.log(`  ✅ Mixed audio track complete: ${MIX_FILE}`);
}

// 2. FFmpeg Native 1080p Pipeline
console.log('• Launching 1080p FFmpeg encoding pipeline...');
const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'rawvideo',
  '-vcodec', 'rawvideo',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-pix_fmt', 'rgba',
  '-r', `${FPS}`,
  '-i', '-',
  '-i', MIX_FILE,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '16',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '320k',
  '-shortest',
  OUTPUT
], { stdio: ['pipe', 'inherit', 'inherit'] });

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Mountain Gorge Gradient Background
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#0c1322');
  grad.addColorStop(0.6, '#111c33');
  grad.addColorStop(1, '#080d18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // HUD Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('ACT V: MOMENTUM & THE ADAM OPTIMIZER', 100, 90);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '22px NotoSans';
  ctx.fillText('Polyak (1964) Momentum · Kingma & Ba (2014) Adaptive Learning Rates', 100, 126);

  // Ravine terrain cross-section with a flat plateau
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.bezierCurveTo(300, 680, 500, 780, 800, 780); // slope down into flat basin
  ctx.lineTo(1400, 780); // zero-gradient flat plateau
  ctx.bezierCurveTo(1550, 780, 1700, 840, 1920, 920); // slope resumes
  ctx.lineTo(1920, 1080);
  ctx.lineTo(0, 1080);
  ctx.closePath();

  const terrGrad = ctx.createLinearGradient(0, 520, 0, 1080);
  terrGrad.addColorStop(0, '#1e293b');
  terrGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = terrGrad;
  ctx.fill();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Highlight the Zero Gradient Flat Ravine
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.fillRect(800, 770, 600, 20);
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 18px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('ZERO GRADIENT PLATEAU: ∇L ≈ 0 (Standard Descent Dies Here)', 1100, 750);

  // 1. Heavy Iron Boulder rolling with Momentum (t < 25s)
  if (t < 26.0) {
    const bProg = Math.min(1.0, t / 24.0);
    const bX = 200 + bProg * 1400;
    let bY = 780 - 45;
    if (bX < 800) {
      const u = (bX - 200) / 600;
      bY = 560 + u * 175;
    }

    drawGroundShadow(ctx, bX, bY + 45, 55, 14, 0.5);

    // Iron Boulder Body
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(bX, bY, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Rolling rotation lines
    const rot = t * 6.0;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bX + Math.cos(rot) * 45, bY + Math.sin(rot) * 45);
    ctx.lineTo(bX - Math.cos(rot) * 45, bY - Math.sin(rot) * 45);
    ctx.stroke();

    // Glowing Momentum Vector Arrow
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bX, bY);
    ctx.lineTo(bX + 80, bY);
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 16px NotoSans';
    ctx.fillText('VELOCITY: v_t = β v_{t-1} + (1-β) g_t', bX, bY - 60);
  }

  // 2. Magi with Hydraulic Adam Boots (t >= 15s)
  const magiT = Math.max(0, t - 15.0);
  const magiProg = (magiT * 0.1) % 1.0;
  const magiX = 350 + magiProg * 1200;
  let magiBaseY = 780;
  if (magiX < 800) {
    const u = (magiX - 350) / 450;
    magiBaseY = 660 + u * 120;
  }

  // Adaptive stride width: broad on flat plateau, tight elsewhere
  const onFlat = magiX >= 800 && magiX <= 1400;
  const strideWidth = onFlat ? 65 : 25;
  const pistonH = onFlat ? 35 : 18;

  drawGroundShadow(ctx, magiX, magiBaseY, 50, 14, 0.4);

  const breath = idleBreath(t, 20);
  const blink = blinkState(t, 4192);

  const hipY = magiBaseY - 80 + breath.hipYDelta;
  const torsoY = hipY - 60 + breath.torsoDelta;
  const headY = torsoY - 45;

  // Head
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(magiX, headY, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Wizard Hat
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.moveTo(magiX - 25, headY - 10);
  ctx.lineTo(magiX + 25, headY - 10);
  ctx.lineTo(magiX + 5, headY - 60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Scarf
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.ellipse(magiX, headY + 16, 18, 9, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  if (!blink) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(magiX + 6, headY - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(magiX + 3, headY - 2);
    ctx.lineTo(magiX + 9, headY - 2);
    ctx.stroke();
  }

  // Torso
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(magiX, headY + 16);
  ctx.lineTo(magiX, hipY);
  ctx.stroke();

  // Legs with Hydraulic Adam Boots
  const lFootX = magiX - strideWidth;
  const rFootX = magiX + strideWidth;

  const lLeg = solve2BoneIK([magiX, hipY], [lFootX, magiBaseY - pistonH], 45, 45, -1);
  const rLeg = solve2BoneIK([magiX, hipY], [rFootX, magiBaseY - pistonH], 45, 45, 1);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(magiX, hipY);
  ctx.lineTo(lLeg[1][0], lLeg[1][1]);
  ctx.lineTo(lFootX, magiBaseY - pistonH);

  ctx.moveTo(magiX, hipY);
  ctx.lineTo(rLeg[1][0], rLeg[1][1]);
  ctx.lineTo(rFootX, magiBaseY - pistonH);
  ctx.stroke();

  // Hydraulic Piston Boots (Orange & Chrome)
  const drawBoot = (bx, by, h) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bx - 12, by, 24, 10);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(bx - 12, by, 24, 10);

    // Piston rod
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by + h);
    ctx.stroke();

    // Foot sole
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(bx - 16, by + h, 32, 8);
  };

  drawBoot(lFootX, magiBaseY - pistonH, pistonH);
  drawBoot(rFootX, magiBaseY - pistonH, pistonH);

  // Formula HUD Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(420, 880, 1080, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('ADAM OPTIMIZER:  θ_{t+1} = θ_t - (η / (√v̂_t + ε)) · m̂_t', 960, 925);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Adaptive Strides: Large steps over flat valleys (v̂_t small) · Micro-steps on cliffs (v̂_t large)', 960, 955);

  // Stream raw bytes to FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 5 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 5 1080p Render Complete! Output: ${OUTPUT}`);
