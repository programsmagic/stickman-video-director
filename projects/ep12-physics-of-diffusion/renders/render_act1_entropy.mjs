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
const VOICE = path.resolve('projects/ep12-physics-of-diffusion/build/narration/act1.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP12-Act1-Entropy-1080p.mp4');
const SFX_FILE = '/tmp/ep12_act1_sfx.wav';
const MIX_FILE = '/tmp/ep12_act1_mix.wav';

console.log(`=== EP12 ACT 1: THE ONE-WAY ARROW OF ENTROPY ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 91823;
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

  // Water droplet impact at t = 3.5s
  addStereo(3.5, 1.2,
    (t) => Math.sin(2 * Math.PI * 620 * Math.exp(-t * 8) * t) * Math.exp(-t * 6) + Math.sin(2 * Math.PI * 1240 * t) * Math.exp(-t * 12) * 0.4,
    (t) => Math.sin(2 * Math.PI * 640 * Math.exp(-t * 8) * t) * Math.exp(-t * 6) + Math.sin(2 * Math.PI * 1280 * t) * Math.exp(-t * 12) * 0.4,
    0.65
  );

  // Clock tick forward then grinding reverse at t = 18.0s
  for (let c = 0; c < 8; c++) {
    const tc = 18.0 + c * 0.8;
    addStereo(tc, 0.08,
      (t) => Math.sin(2 * Math.PI * (800 + c * 40) * t) * Math.exp(-t * 60) + noise() * 0.1 * Math.exp(-t * 50),
      (t) => Math.sin(2 * Math.PI * (820 + c * 40) * t) * Math.exp(-t * 60) + noise() * 0.1 * Math.exp(-t * 50),
      0.35
    );
  }

  // Reverse whoosh at t = 42.0s
  addStereo(42.0, 2.5,
    (t) => Math.sin(2 * Math.PI * (180 + t * 450) * t) * Math.min(t, 2.5 - t) * 0.6 + noise() * 0.2 * Math.min(t * 0.8, 1),
    (t) => Math.sin(2 * Math.PI * (190 + t * 460) * t) * Math.min(t, 2.5 - t) * 0.6 + noise() * 0.2 * Math.min(t * 0.8, 1),
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

// Initialize 1,200 Brownian ink particles
const PARTICLE_COUNT = 1200;
const particles = [];
let pSeed = 58210;
for (let i = 0; i < PARTICLE_COUNT; i++) {
  pSeed = (Math.imul(pSeed, 1664525) + 1013904223) >>> 0;
  const angle = (pSeed / 4294967296) * Math.PI * 2;
  pSeed = (Math.imul(pSeed, 1664525) + 1013904223) >>> 0;
  const speed = 0.5 + (pSeed / 4294967296) * 2.5;
  particles.push({
    x: 0,
    y: 0,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    alpha: 0.8 + ((i % 5) * 0.04)
  });
}

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Background gradient: Deep physics laboratory ambient navy
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#070b19');
  grad.addColorStop(0.5, '#0c1228');
  grad.addColorStop(1, '#040711');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Perspective 3D laboratory grid lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Chalkboard on the wall (Left side background)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(120, 100, 480, 260);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 5;
  ctx.strokeRect(120, 100, 480, 260);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans';
  ctx.fillText('SECOND LAW OF THERMODYNAMICS', 150, 145);

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 44px CaveatHand';
  ctx.fillText('dS ≥ 0   (Entropy Increases)', 150, 215);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px NotoSans';
  ctx.fillText('• Time has a strict direction.', 150, 265);
  ctx.fillText('• You cannot unmix ink from water.', 150, 295);
  ctx.fillText('• Unless... you reverse the Markov chain.', 150, 325);

  // Hero Glass Beaker (Right-Center: X: 1180, Y: 620)
  const beakerX = 1180, beakerY = 620, beakerW = 420, beakerH = 460;
  drawGroundShadow(ctx, beakerX, beakerY + beakerH / 2, 240, 25);

  // Beaker glass back wall
  ctx.fillStyle = 'rgba(30, 58, 138, 0.25)';
  ctx.fillRect(beakerX - beakerW / 2, beakerY - beakerH / 2, beakerW, beakerH);

  // Water level
  const waterTop = beakerY - beakerH / 2 + 70;
  const waterH = beakerH - 70;
  const waterGrad = ctx.createLinearGradient(0, waterTop, 0, waterTop + waterH);
  waterGrad.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
  waterGrad.addColorStop(1, 'rgba(14, 116, 144, 0.35)');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(beakerX - beakerW / 2 + 10, waterTop, beakerW - 20, waterH - 10);

  // Eyedropper rig above the beaker
  const dropperX = beakerX, dropperY = waterTop - 110;
  ctx.fillStyle = '#64748b';
  ctx.fillRect(dropperX - 12, dropperY - 90, 24, 80);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(dropperX - 18, dropperY - 120, 36, 30); // Rubber bulb

  // Tapered glass nozzle
  ctx.beginPath();
  ctx.moveTo(dropperX - 10, dropperY - 10);
  ctx.lineTo(dropperX + 10, dropperY - 10);
  ctx.lineTo(dropperX + 3, dropperY + 25);
  ctx.lineTo(dropperX - 3, dropperY + 25);
  ctx.closePath();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.fill();

  // Droplet falling physics: releases at t = 3.0s, hits water at t = 3.5s
  let dropY = dropperY + 25;
  let dropVisible = false;
  if (t < 3.0) {
    dropVisible = true;
    dropY = dropperY + 25;
  } else if (t >= 3.0 && t < 3.5) {
    dropVisible = true;
    const progress = (t - 3.0) / 0.5;
    dropY = dropperY + 25 + progress * progress * (waterTop - (dropperY + 25));
  }

  if (dropVisible) {
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.arc(dropperX, dropY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Water ripples upon impact
  if (t >= 3.5 && t < 6.5) {
    const ripAge = t - 3.5;
    const ripR = ripAge * 70;
    const ripAlpha = Math.max(0, 1 - ripAge / 3.0);
    ctx.strokeStyle = `rgba(56, 189, 248, ${ripAlpha * 0.7})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(dropperX, waterTop + 5, ripR, ripR * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Brownian Ink Particle Dispersion
  if (t >= 3.5) {
    const inkAge = t - 3.5;
    const isReversing = t > 38.0;
    const reverseFactor = isReversing ? Math.max(0, 1 - (t - 38.0) / 10.0) : 1.0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      // Brownian dispersion spreads out, then reverses after t=38s
      const currentRadius = Math.min(170, inkAge * 12 * Math.sqrt(i % 17 + 1)) * reverseFactor;
      const angle = (i * 2.39996) + (inkAge * 0.2); // Golden ratio spiral dispersion
      const px = dropperX + Math.cos(angle) * currentRadius * 0.9;
      const py = (waterTop + 25) + Math.sin(angle) * (currentRadius * 0.75) + Math.min(260, inkAge * 6);

      if (py > waterTop + 5 && py < waterTop + waterH - 15 && px > beakerX - beakerW / 2 + 15 && px < beakerX + beakerW / 2 - 15) {
        ctx.fillStyle = isReversing ? `rgba(250, 204, 21, ${p.alpha * 0.75})` : `rgba(37, 99, 235, ${p.alpha * 0.65})`;
        ctx.beginPath();
        ctx.arc(px, py, isReversing ? 3.0 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Beaker glass front contour & graduated markings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(beakerX - beakerW / 2, beakerY - beakerH / 2, beakerW, beakerH);

  // Graduated tick marks
  for (let m = 1; m <= 6; m++) {
    const my = waterTop + waterH - (m * 55);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(beakerX - beakerW / 2 + 10, my);
    ctx.lineTo(beakerX - beakerW / 2 + 35, my);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px NotoSans';
    ctx.fillText(`${m * 100} mL`, beakerX - beakerW / 2 + 45, my + 5);
  }

  // Character: Magi standing at the lab bench
  const magiX = 520, magiY = 820;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  // Magi IK hand tracking dropper & chalkboard
  const lHand = [dropperX - 25, dropperY - 110];
  const rHand = t < 20.0 ? [480, 240] : [magiX + 50, magiY - 90];

  const lArm = solve2BoneIK([magiX - 10, magiY - 130], lHand, 55, 55, -1);
  const rArm = solve2BoneIK([magiX + 10, magiY - 130], rHand, 50, 50, 1);

  drawFigure(ctx, {
    x: magiX,
    y: magiY,
    scale: 1.15,
    color: INK,
    fillColor: '#ffffff',
    hat: 'wizard',
    scarf: true,
    expression: t > 36.0 ? 'happy' : 'curious',
    blinking: blinkState(t),
    breathing: idleBreath(t),
    lHandTarget: lArm ? [lArm[1][0], lArm[1][1]] : undefined,
    rHandTarget: rArm ? [rArm[1][0], rArm[1][1]] : undefined
  });

  // HUD Insight Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = t > 36.0 ? 'rgba(250, 204, 21, 0.5)' : 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(360, 930, 1200, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  if (t < 36.0) {
    ctx.fillText('THE ONE-WAY ARROW:  Physical Entropy Destroys Information', 960, 970);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '16px NotoSans';
    ctx.fillText('Molecules scatter through Brownian motion. You can never unspill coffee or unmix ink.', 960, 1000);
  } else {
    ctx.fillStyle = '#facc15';
    ctx.fillText('REVERSE THERMODYNAMICS:  What If Time Could Run Backwards?', 960, 970);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '16px NotoSans';
    ctx.fillText('Diffusion models learn the infinitesimal reverse steps to sculpt organized art from pure chaos.', 960, 1000);
  }
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 1 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 1 1080p Render Complete! Output: ${OUTPUT}`);
