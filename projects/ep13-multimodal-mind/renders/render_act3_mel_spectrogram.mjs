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
const VOICE = path.resolve('projects/ep13-multimodal-mind/build/narration/act3.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP13-Act3-MelSpectrogram-1080p.mp4');
const SFX_FILE = '/tmp/ep13_act3_sfx.wav';
const MIX_FILE = '/tmp/ep13_act3_mix.wav';

console.log(`=== EP13 ACT 3: AUDIO SPECTROGRAMS & THE MELODY OF NUMBERS ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 69201;
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

  // Tuning fork strike at t = 12.0s
  addStereo(12.0, 6.0,
    (t) => Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 0.8) + Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 2) * 0.3,
    (t) => Math.sin(2 * Math.PI * 442 * t) * Math.exp(-t * 0.8) + Math.sin(2 * Math.PI * 884 * t) * Math.exp(-t * 2) * 0.3,
    0.65
  );

  // Fourier transform prism resonance at t = 26.0s
  addStereo(26.0, 4.0,
    (t) => Math.sin(2 * Math.PI * (200 + t * 250) * t) * Math.min(t, 4 - t) * 0.3 + noise() * 0.05,
    (t) => Math.sin(2 * Math.PI * (205 + t * 250) * t) * Math.min(t, 4 - t) * 0.3 + noise() * 0.05,
    0.45
  );

  // Thermal spectrogram shimmering hum
  addStereo(32.0, 24.0,
    (t) => Math.sin(2 * Math.PI * 180 * t) * 0.15 + Math.sin(2 * Math.PI * 360 * t) * 0.1,
    (t) => Math.sin(2 * Math.PI * 182 * t) * 0.15 + Math.sin(2 * Math.PI * 364 * t) * 0.1,
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

  // Background: Deep Acoustic Physics Laboratory
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#060a18');
  grad.addColorStop(0.5, '#0c1328');
  grad.addColorStop(1, '#03050e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Giant Brass Tuning Fork in Center-Left (X: 740, Y: 460)
  const forkX = 740, forkY = 460;
  const isVibrating = t >= 12.0;
  const vibeOffset = isVibrating ? Math.sin(t * 80) * 4 * Math.exp(-((t - 12.0) % 8) * 0.3) : 0;

  // Fork handle & base
  ctx.fillStyle = '#ca8a04';
  ctx.fillRect(forkX - 12, forkY + 50, 24, 180);
  ctx.beginPath();
  ctx.arc(forkX, forkY + 230, 20, 0, Math.PI * 2);
  ctx.fill();

  // Fork U-prongs
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(forkX - 50 + vibeOffset, forkY - 180);
  ctx.lineTo(forkX - 50 + vibeOffset, forkY + 30);
  ctx.bezierCurveTo(forkX - 50, forkY + 70, forkX + 50, forkY + 70, forkX + 50 - vibeOffset, forkY + 30);
  ctx.lineTo(forkX + 50 - vibeOffset, forkY - 180);
  ctx.stroke();

  // Sound Wave Ripples emanating from fork
  if (isVibrating) {
    for (let r = 0; r < 5; r++) {
      const waveAge = (t * 3.0 + r * 0.6) % 3.0;
      const waveRadius = waveAge * 80;
      const alpha = Math.max(0, 1 - waveAge / 3.0);
      ctx.strokeStyle = `rgba(250, 204, 21, ${alpha * 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(forkX, forkY - 40, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Optical Fourier Prism in Center (X: 980, Y: 460)
  const prismX = 980, prismY = 460;
  ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.beginPath();
  ctx.moveTo(prismX, prismY - 90);
  ctx.lineTo(prismX + 70, prismY + 70);
  ctx.lineTo(prismX - 70, prismY + 70);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('FOURIER', prismX, prismY + 15);
  ctx.fillText('PRISM', prismX, prismY + 35);

  // 80-Channel Mel-Spectrogram Heatmap on Right Stage (X: 1140 to 1740, Y: 240 to 660)
  const specX = 1140, specY = 240, specW = 600, specH = 420;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(specX, specY, specW, specH);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(specX, specY, specW, specH);

  // Spectrogram Waterfall Bars (80 frequency bins)
  const timeOffset = Math.floor(t * 30);
  const numBins = 32;
  const binH = specH / numBins;

  for (let b = 0; b < numBins; b++) {
    const by = specY + b * binH;
    for (let bx = 0; bx < specW; bx += 10) {
      const freqEnergy = Math.sin((bx + timeOffset * 2) * 0.05 + b * 0.4) * Math.cos(b * 0.3) * 0.5 + 0.5;
      const r = Math.floor(freqEnergy * 255);
      const g = Math.floor(freqEnergy * 180);
      const bl = Math.floor((1 - freqEnergy) * 120);

      ctx.fillStyle = `rgb(${r}, ${g}, ${bl})`;
      ctx.fillRect(specX + bx, by, 9, binH - 1);
    }
  }

  // Spectrogram Coordinate Axes
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('TIME (Horizontal) ➔', specX + specW / 2, specY + specH + 30);

  ctx.save();
  ctx.translate(specX - 25, specY + specH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('MEL FREQUENCY (80 Bins) ➔', 0, 0);
  ctx.restore();

  // Character: Magi striking the tuning fork with surveyor staff (X: 380, Y: 820)
  const magiX = 380, magiY = 820;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  const staffX = forkX - 80, staffY = forkY - 40;
  const rHand = [staffX, staffY];
  const lHand = [magiX - 45, magiY - 110]; // Left hand gesturing at spectrogram

  const rArm = solve2BoneIK([magiX + 10, magiY - 130], rHand, 60, 60, 1);
  const lArm = solve2BoneIK([magiX - 10, magiY - 130], lHand, 50, 50, -1);

  drawFigure(ctx, {
    x: magiX,
    y: magiY,
    scale: 1.15,
    color: INK,
    fillColor: '#ffffff',
    hat: 'wizard',
    scarf: true,
    expression: isVibrating ? 'happy' : 'focused',
    blinking: blinkState(t),
    breathing: idleBreath(t),
    lHandTarget: lArm ? [lArm[1][0], lArm[1][1]] : undefined,
    rHandTarget: rArm ? [rArm[1][0], rArm[1][1]] : undefined
  });

  // Surveyor Staff held by Magi striking the fork
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(magiX + 10, magiY - 50);
  ctx.lineTo(staffX, staffY);
  ctx.stroke();

  // HUD Insight Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(360, 930, 1200, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('MEL-SPECTROGRAMS:  Turning Acoustic Waveforms into Visual Heatmaps', 960, 970);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Decompose audio waves into 80 frequency channels. To a vision transformer, your spoken words are processed natively as an image!', 960, 1000);
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 3 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 3 1080p Render Complete! Output: ${OUTPUT}`);
