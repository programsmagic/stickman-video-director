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
const VOICE = path.resolve('projects/ep10-geometry-of-thinking/build/narration/act2.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP10-Act2-SaddlePoints-1080p.mp4');
const SFX_FILE = '/tmp/ep10_act2_sfx.wav';
const MIX_FILE = '/tmp/ep10_act2_mix.wav';

console.log(`=== EP10 ACT 2: SADDLE POINTS & THE LOSS SURFACE ===`);
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
        const dt = i / rate;
        left[i0 + i] += fnL(dt) * gain;
        right[i0 + i] += fnR(dt) * gain;
      }
    }
  };

  // Ambient synth drone (0 - dur)
  addStereo(0.0, dur,
    t => (Math.sin(2 * Math.PI * 65.4 * t) * 0.15 + noise() * 0.04) * Math.min(1, t * 2) * Math.min(1, dur - t),
    t => (Math.sin(2 * Math.PI * 65.4 * t) * 0.15 + noise() * 0.04) * Math.min(1, t * 2) * Math.min(1, dur - t),
    0.25
  );

  // Blindfold removal whoosh at 4.0s
  addStereo(4.0, 0.8,
    t => noise() * Math.sin((t / 0.8) * Math.PI),
    t => noise() * Math.sin((t / 0.8) * Math.PI),
    0.35
  );

  // Contour grid electric hum on at 6.0s
  addStereo(6.0, 4.0,
    t => Math.sin(2 * Math.PI * 220 * t + Math.sin(t * 8) * 0.5) * Math.exp(-t * 0.6),
    t => Math.sin(2 * Math.PI * 222 * t + Math.sin(t * 8) * 0.5) * Math.exp(-t * 0.6),
    0.30
  );

  // Saddle Point hesitation chime & freeze pulse (35.0s)
  addStereo(35.0, 2.5,
    t => (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 880 * t) * 0.5) * Math.exp(-t * 2),
    t => (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 880 * t) * 0.5) * Math.exp(-t * 2),
    0.45
  );

  // Write Stereo WAV
  const sampleCount = n * 2;
  const wavBuf = Buffer.alloc(44 + sampleCount * 2);
  wavBuf.write('RIFF', 0); wavBuf.writeUInt32LE(36 + sampleCount * 2, 4);
  wavBuf.write('WAVE', 8); wavBuf.write('fmt ', 12);
  wavBuf.writeUInt32LE(16, 16); wavBuf.writeUInt16LE(1, 20); // PCM
  wavBuf.writeUInt16LE(2, 22); wavBuf.writeUInt32LE(rate, 24); // Stereo 48kHz
  wavBuf.writeUInt32LE(rate * 4, 28); wavBuf.writeUInt16LE(4, 32);
  wavBuf.writeUInt16LE(16, 34); wavBuf.write('data', 36);
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

  execSync(`ffmpeg -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.55[s];[v][s]amix=inputs=2:duration=first[out]" -map "[out]" -ar 48000 -ac 2 "${MIX_FILE}"`);
  console.log(`  ✅ Mixed audio track complete: ${MIX_FILE}`);
}

// 2. 1080P RENDERING PIPELINE
console.log('• Launching 1080p FFmpeg encoding pipeline...');
const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'rawvideo',
  '-pix_fmt', 'rgba',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-r', `${FPS}`,
  '-i', 'pipe:0',
  '-i', MIX_FILE,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '17',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-ar', '48000',
  '-b:a', '256k',
  '-movflags', '+faststart',
  OUTPUT
]);

ffmpeg.stderr.on('data', () => {});
ffmpeg.on('close', code => {
  if (code !== 0) console.error(`FFmpeg exited with code ${code}`);
});

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background: Blueprint Deep Space
  const bg = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 100, WIDTH / 2, HEIGHT / 2, 1100);
  bg.addColorStop(0, '#0F172A');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 3D Isometric Saddle Surface Mesh (Hyperbolic Paraboloid z = x^2 - y^2)
  const saddleCenterX = 1250, saddleCenterY = 560;
  ctx.save();
  ctx.lineWidth = 2;
  const meshSteps = 16;
  const scale = 22;

  for (let ix = -meshSteps; ix <= meshSteps; ix += 2) {
    ctx.beginPath();
    for (let iy = -meshSteps; iy <= meshSteps; iy++) {
      const z = (ix * ix - iy * iy) * 0.18;
      // 3D Isometric projection
      const px = saddleCenterX + (ix - iy) * scale * 0.866;
      const py = saddleCenterY + (ix + iy) * scale * 0.5 - z * 3.5;
      if (iy === -meshSteps) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    // Color gradient based on elevation
    ctx.strokeStyle = ix === 0 ? '#F59E0B' : (ix > 0 ? '#38BDF8' : '#818CF8');
    ctx.globalAlpha = 0.35 + Math.abs(ix) * 0.02;
    ctx.stroke();
  }

  // Cross lines
  for (let iy = -meshSteps; iy <= meshSteps; iy += 2) {
    ctx.beginPath();
    for (let ix = -meshSteps; ix <= meshSteps; ix++) {
      const z = (ix * ix - iy * iy) * 0.18;
      const px = saddleCenterX + (ix - iy) * scale * 0.866;
      const py = saddleCenterY + (ix + iy) * scale * 0.5 - z * 3.5;
      if (ix === -meshSteps) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#64748B';
    ctx.globalAlpha = 0.25;
    ctx.stroke();
  }
  ctx.restore();

  // Saddle Center Critical Point (∇L = 0, but NOT a minimum)
  const saddleX = saddleCenterX, saddleY = saddleCenterY;
  ctx.save();
  ctx.beginPath();
  ctx.arc(saddleX, saddleY, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#EF4444';
  ctx.shadowColor = '#EF4444';
  ctx.shadowBlur = 18;
  ctx.fill();

  ctx.font = 'bold 22px NotoSans';
  ctx.fillStyle = '#F87171';
  ctx.textAlign = 'center';
  ctx.fillText('CRITICAL SADDLE POINT', saddleX, saddleY - 24);
  ctx.font = '18px NotoSans';
  ctx.fillStyle = '#FCA5A5';
  ctx.fillText('∇L = 0  (Gradient Vanishes!)', saddleX, saddleY + 36);

  // Directional escape arrows
  if (t >= 32.0) {
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 3;
    // Downhill escape path 1
    ctx.beginPath();
    ctx.moveTo(saddleX, saddleY);
    ctx.lineTo(saddleX - 90, saddleY + 110);
    ctx.stroke();
    // Downhill escape path 2
    ctx.beginPath();
    ctx.moveTo(saddleX, saddleY);
    ctx.lineTo(saddleX + 90, saddleY + 110);
    ctx.stroke();

    ctx.font = 'bold 16px NotoSans';
    ctx.fillStyle = '#34D399';
    ctx.fillText('Escape Ravine ↓', saddleX - 110, saddleY + 135);
    ctx.fillText('Escape Ravine ↓', saddleX + 110, saddleY + 135);
  }
  ctx.restore();

  // Grounding shadow under Magi on Left Ridge
  const magiX = 420;
  const magiY = 740;
  drawGroundShadow(ctx, magiX, magiY + 120, 100, 22, 0.45);

  // Character Magi inspecting the saddle surface
  const breath = idleBreath(t, 16);
  const blink = blinkState(t, 7);
  const r = 90;

  // After 4.0s, blindfold is off, eyes are wide open
  const isBlind = t < 4.0;
  const eyeState = isBlind ? 'closed' : (blink === 'closed' ? 'closed' : 'wide');

  drawFigure(ctx, {
    torso: 6 + breath.torsoDelta,
    head: 8,
    facing: 'right',
    eyes: eyeState,
    brows: 'one-up',
    mouth: t >= 35.0 ? 'o' : 'smile',
    scarf: true,
    accessory: 'wizard-hat',
    targetArmL: [-40, 20],
    targetArmR: [95, -10], // Pointing surveyor compass toward saddle
    legL: [-10, -5],
    legR: [14, 10]
  }, {
    x: magiX,
    y: magiY + breath.hipYDelta,
    r: r,
    seed: 92
  });

  // Surveyor pointer beam from Magi to Saddle point
  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(magiX + 95, magiY - 10);
  ctx.lineTo(saddleX, saddleY);
  ctx.stroke();
  ctx.restore();

  // TOP HUD
  ctx.save();
  ctx.font = '24px CaveatHand';
  ctx.fillStyle = '#94A3B8';
  ctx.textAlign = 'center';
  ctx.fillText('PROGRAMS MAGIC · THE GEOMETRY OF THINKING (EPISODE 04)', WIDTH / 2, 46);

  ctx.font = 'bold 30px NotoSans';
  ctx.fillStyle = '#F8FAFC';
  ctx.fillText('ACT 2: THE TOPOGRAPHY OF MISTAKES & SADDLE POINTS', WIDTH / 2, 92);

  ctx.font = '20px NotoSans';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('In 10,000 Dimensions: Local Minima Are Rare — Saddle Points Are Common', WIDTH / 2, 130);
  ctx.restore();

  // Stream raw buffer
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
    console.log(`Act 2 1080p Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 2 1080p Render Complete! Output: ${OUTPUT}`);
