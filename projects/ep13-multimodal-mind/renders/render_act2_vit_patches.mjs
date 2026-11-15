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
const VOICE = path.resolve('projects/ep13-multimodal-mind/build/narration/act2.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP13-Act2-ViTPatches-1080p.mp4');
const SFX_FILE = '/tmp/ep13_act2_sfx.wav';
const MIX_FILE = '/tmp/ep13_act2_mix.wav';

console.log(`=== EP13 ACT 2: VISION TRANSFORMERS & THE 16x16 PATCH SLICER ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 59102;
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

  // Laser slicer hum starting at t = 18s
  addStereo(18.0, 3.0,
    (t) => Math.sin(2 * Math.PI * 650 * t) * Math.min(t * 2, (3 - t) * 2) * 0.4 + noise() * 0.1,
    (t) => Math.sin(2 * Math.PI * 660 * t) * Math.min(t * 2, (3 - t) * 2) * 0.4 + noise() * 0.1,
    0.50
  );

  // Mosaic tile stamping clicks from t = 24s to t = 45s
  for (let c = 0; c < 16; c++) {
    const tc = 24.0 + c * 1.3;
    addStereo(tc, 0.08,
      (t) => Math.sin(2 * Math.PI * (500 + (c % 4) * 80) * t) * Math.exp(-t * 50) + noise() * 0.15 * Math.exp(-t * 40),
      (t) => Math.sin(2 * Math.PI * (520 + (c % 4) * 80) * t) * Math.exp(-t * 50) + noise() * 0.15 * Math.exp(-t * 40),
      0.40
    );
  }

  // Conveyor hum
  addStereo(24.0, 30.0,
    (t) => Math.sin(2 * Math.PI * 90 * t) * 0.15,
    (t) => Math.sin(2 * Math.PI * 92 * t) * 0.15,
    0.25
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

  // Background: High-tech Industrial Glass Cutting Laboratory
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#050a17');
  grad.addColorStop(0.5, '#0a142e');
  grad.addColorStop(1, '#020612');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Hero Cutting Table in Upper Right (X: 1220, Y: 360)
  const tableX = 1220, tableY = 360;
  const imgW = 480, imgH = 360;

  drawGroundShadow(ctx, tableX, tableY + imgH / 2 + 15, 260, 20);

  // Photo Frame on cutting table
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(tableX - imgW / 2, tableY - imgH / 2, imgW, imgH);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(tableX - imgW / 2, tableY - imgH / 2, imgW, imgH);

  // Render Artwork: Soaring Golden Eagle in Sky
  ctx.save();
  ctx.beginPath();
  ctx.rect(tableX - imgW / 2 + 2, tableY - imgH / 2 + 2, imgW - 4, imgH - 4);
  ctx.clip();

  const skyGrad = ctx.createLinearGradient(0, tableY - imgH / 2, 0, tableY + imgH / 2);
  skyGrad.addColorStop(0, '#0284c7');
  skyGrad.addColorStop(0.6, '#38bdf8');
  skyGrad.addColorStop(1, '#fed7aa');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(tableX - imgW / 2, tableY - imgH / 2, imgW, imgH);

  // Mountain peaks in background
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(tableX - 240, tableY + 180);
  ctx.lineTo(tableX - 80, tableY + 40);
  ctx.lineTo(tableX + 40, tableY + 180);
  ctx.lineTo(tableX + 160, tableY + 60);
  ctx.lineTo(tableX + 240, tableY + 180);
  ctx.closePath();
  ctx.fill();

  // Eagle silhouette
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.moveTo(tableX, tableY - 40);
  ctx.bezierCurveTo(tableX - 120, tableY - 90, tableX - 160, tableY - 20, tableX - 200, tableY - 50);
  ctx.bezierCurveTo(tableX - 120, tableY + 20, tableX - 50, tableY + 10, tableX, tableY + 40);
  ctx.bezierCurveTo(tableX + 50, tableY + 10, tableX + 120, tableY + 20, tableX + 200, tableY - 50);
  ctx.bezierCurveTo(tableX + 160, tableY - 20, tableX + 120, tableY - 90, tableX, tableY - 40);
  ctx.fill();

  // Eagle golden head
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(tableX, tableY - 50, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.moveTo(tableX + 14, tableY - 50);
  ctx.lineTo(tableX + 28, tableY - 46);
  ctx.lineTo(tableX + 14, tableY - 42);
  ctx.closePath();
  ctx.fill();

  // 16x16 Grid Slicing Laser Lines (Appears at t >= 18s)
  if (t >= 18.0) {
    const laserProgress = Math.min(1.0, (t - 18.0) / 2.0);
    const patchSize = 30; // 16 patches across 480px width

    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;

    // Vertical cut lines
    for (let vx = tableX - imgW / 2 + patchSize; vx < tableX + imgW / 2; vx += patchSize) {
      ctx.beginPath();
      ctx.moveTo(vx, tableY - imgH / 2);
      ctx.lineTo(vx, tableY - imgH / 2 + imgH * laserProgress);
      ctx.stroke();
    }

    // Horizontal cut lines
    for (let hy = tableY - imgH / 2 + patchSize; hy < tableY + imgH / 2; hy += patchSize) {
      ctx.beginPath();
      ctx.moveTo(tableX - imgW / 2, hy);
      ctx.lineTo(tableX - imgW / 2 + imgW * laserProgress, hy);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Highlight specific patches: Patch #1, Patch #42 (Eagle Eye)
  if (t >= 22.0) {
    // Patch 1 (Top-Left)
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.strokeRect(tableX - imgW / 2 + 3, tableY - imgH / 2 + 3, 28, 28);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 12px NotoSans';
    ctx.fillText('#1', tableX - imgW / 2 + 6, tableY - imgH / 2 + 22);

    // Patch 42 (Eagle Head/Eye)
    const p42X = tableX - 15, p42Y = tableY - 60;
    ctx.strokeRect(p42X, p42Y, 30, 30);
    ctx.fillText('#42', p42X + 4, p42Y + 22);
  }

  // Lower Stage: Conveyor Belt of Patches entering Transformer (Y: 680 to 820)
  const convY = 740;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(400, convY - 20, 1100, 40);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.strokeRect(400, convY - 20, 1100, 40);

  // Rollers
  for (let rx = 440; rx < 1480; rx += 70) {
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(rx, convY, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Patches marching down the conveyor belt
  if (t >= 22.0) {
    const marchSpeed = (t - 22.0) * 85;
    for (let i = 0; i < 9; i++) {
      const px = 1400 - ((marchSpeed + i * 110) % 950);
      if (px > 450 && px < 1420) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.fillRect(px - 35, convY - 70, 70, 50);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(px - 35, convY - 70, 70, 50);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px NotoSans';
        ctx.textAlign = 'center';
        ctx.fillText(`Patch #${(i * 12 + 1)}`, px, convY - 45);
        ctx.fillStyle = '#facc15';
        ctx.font = '11px NotoSans';
        ctx.fillText('+ Pos Embed', px, convY - 28);
      }
    }
  }

  // Mechanical Slicer Control Lever on Table Left
  const leverX = tableX - imgW / 2 - 80, leverY = tableY + 40;
  ctx.fillStyle = '#334155';
  ctx.fillRect(leverX - 20, leverY - 60, 40, 120);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.strokeRect(leverX - 20, leverY - 60, 40, 120);

  const leverAngle = t >= 16.0 ? Math.PI / 4 : -Math.PI / 4;
  const handleX = leverX + Math.sin(leverAngle) * 60;
  const handleY = leverY - Math.cos(leverAngle) * 60;

  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(leverX, leverY);
  ctx.lineTo(handleX, handleY);
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(handleX, handleY, 14, 0, Math.PI * 2);
  ctx.fill();

  // Character: Magi pulling the Slicer Lever (X: 340, Y: 820)
  const magiX = 340, magiY = 820;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  const rHand = [leverX - 20, leverY - 20];
  const lHand = [magiX - 50, magiY - 90]; // Left hand on hip

  const rArm = solve2BoneIK([magiX + 10, magiY - 130], rHand, 65, 65, 1);
  const lArm = solve2BoneIK([magiX - 10, magiY - 130], lHand, 50, 50, -1);

  drawFigure(ctx, {
    x: magiX,
    y: magiY,
    scale: 1.15,
    color: INK,
    fillColor: '#ffffff',
    hat: 'wizard',
    scarf: true,
    expression: t > 18.0 ? 'happy' : 'focused',
    blinking: blinkState(t),
    breathing: idleBreath(t),
    lHandTarget: lArm ? [lArm[1][0], lArm[1][1]] : undefined,
    rHandTarget: rArm ? [rArm[1][0], rArm[1][1]] : undefined
  });

  // HUD Insight Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(360, 930, 1200, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('VISION TRANSFORMERS (ViT):  An Image is Worth 16×16 Words', 960, 970);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Slice the 2D image into 16x16 pixel square patches, project into vectors, add positional codes, and feed to standard attention!', 960, 1000);
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 2 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 2 1080p Render Complete! Output: ${OUTPUT}`);
