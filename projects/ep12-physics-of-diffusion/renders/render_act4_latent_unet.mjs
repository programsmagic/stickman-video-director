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
const VOICE = path.resolve('projects/ep12-physics-of-diffusion/build/narration/act4.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP12-Act4-LatentUNet-1080p.mp4');
const SFX_FILE = '/tmp/ep12_act4_sfx.wav';
const MIX_FILE = '/tmp/ep12_act4_mix.wav';

console.log(`=== EP12 ACT 4: THE LATENT U-NET SCULPTOR ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 81923;
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

  // Overheat electrical fry alarm at t = 3.0s
  addStereo(3.0, 2.0,
    (t) => Math.sin(2 * Math.PI * 880 * t) * (Math.sin(t * 20) > 0 ? 1 : 0) * 0.4 + noise() * 0.15,
    (t) => Math.sin(2 * Math.PI * 890 * t) * (Math.sin(t * 20) > 0 ? 1 : 0) * 0.4 + noise() * 0.15,
    0.45
  );

  // Crystal pneumatic compression lock at t = 18.0s
  addStereo(18.0, 1.2,
    (t) => Math.sin(2 * Math.PI * 440 * Math.exp(-t * 6) * t) * Math.exp(-t * 4) + noise() * 0.2 * Math.exp(-t * 10),
    (t) => Math.sin(2 * Math.PI * 450 * Math.exp(-t * 6) * t) * Math.exp(-t * 4) + noise() * 0.2 * Math.exp(-t * 10),
    0.60
  );

  // Skip connection laser bridge hums at t = 36s, 40s, 44s
  [36.0, 40.0, 44.0].forEach((lt, idx) => {
    addStereo(lt, 1.5,
      (t) => Math.sin(2 * Math.PI * (300 + idx * 100) * t) * Math.min(t * 2, (1.5 - t) * 2) * 0.4,
      (t) => Math.sin(2 * Math.PI * (305 + idx * 100) * t) * Math.min(t * 2, (1.5 - t) * 2) * 0.4,
      0.40
    );
  });

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

  // Background: Cyan Holographic Neural Engineering Vault
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#040b17');
  grad.addColorStop(0.5, '#071529');
  grad.addColorStop(1, '#02050c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Holographic circuit trace lines on the floor & ceiling
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < WIDTH; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }

  // Giant Floating U-Net Architecture in Center (X: 1150, Y: 490)
  const unetX = 1150, unetY = 490;

  // Left Encoder Blocks (Downsampling)
  const leftX = unetX - 240;
  const rightX = unetX + 240;

  // Level 1 (Top: 64x64)
  ctx.fillStyle = '#0369a1';
  ctx.fillRect(leftX - 45, unetY - 220, 90, 50);
  ctx.fillRect(rightX - 45, unetY - 220, 90, 50);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(leftX - 45, unetY - 220, 90, 50);
  ctx.strokeRect(rightX - 45, unetY - 220, 90, 50);

  // Level 2 (Mid: 32x32)
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(leftX + 20, unetY - 110, 80, 50);
  ctx.fillRect(rightX - 100, unetY - 110, 80, 50);
  ctx.strokeRect(leftX + 20, unetY - 110, 80, 50);
  ctx.strokeRect(rightX - 100, unetY - 110, 80, 50);

  // Level 3 (Lower: 16x16)
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(leftX + 70, unetY, 70, 50);
  ctx.fillRect(rightX - 140, unetY, 70, 50);
  ctx.strokeRect(leftX + 70, unetY, 70, 50);
  ctx.strokeRect(rightX - 140, unetY, 70, 50);

  // Bottleneck (Center Bottom: 8x8 semantic bottleneck)
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(unetX - 60, unetY + 110, 120, 60);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3;
  ctx.strokeRect(unetX - 60, unetY + 110, 120, 60);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('BOTTLENECK', unetX, unetY + 145);

  // Downsampling and Upsampling Flow Arrows
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  // Left down arrows
  ctx.beginPath();
  ctx.moveTo(leftX, unetY - 170);
  ctx.lineTo(leftX + 60, unetY - 110);
  ctx.moveTo(leftX + 60, unetY - 60);
  ctx.lineTo(leftX + 105, unetY);
  ctx.moveTo(leftX + 105, unetY + 50);
  ctx.lineTo(unetX - 60, unetY + 130);
  ctx.stroke();

  // Right up arrows
  ctx.strokeStyle = '#10b981';
  ctx.beginPath();
  ctx.moveTo(unetX + 60, unetY + 130);
  ctx.lineTo(rightX - 105, unetY + 50);
  ctx.moveTo(rightX - 105, unetY);
  ctx.lineTo(rightX - 60, unetY - 60);
  ctx.moveTo(rightX - 60, unetY - 110);
  ctx.lineTo(rightX, unetY - 170);
  ctx.stroke();

  // Horizontal Skip Connections (Cyan laser bridges)
  const bridge1Y = unetY - 195;
  const bridge2Y = unetY - 85;
  const bridge3Y = unetY + 25;

  [bridge1Y, bridge2Y, bridge3Y].forEach((by, idx) => {
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(leftX + 45 + idx * 45, by);
    ctx.lineTo(rightX - 45 - idx * 45, by);
    ctx.stroke();
    ctx.setLineDash([]);

    // Laser pulses travelling across bridge
    const pulseOffset = ((t * 2.0 + idx * 0.3) % 1.0);
    const startX = leftX + 45 + idx * 45;
    const endX = rightX - 45 - idx * 45;
    const pulseX = startX + (endX - startX) * pulseOffset;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pulseX, by, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Left Stage: VAE Encoder Crystal & Pixel Grid Comparison (X: 380, Y: 360)
  const vaeX = 380, vaeY = 320;

  // Raw Pixel Grid vs Latent Cube Comparison
  if (t < 18.0) {
    // Bulky 512x512 Raw Pixel Matrix (Glowing Red Hot)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.fillRect(vaeX - 110, vaeY - 110, 220, 220);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(vaeX - 110, vaeY - 110, 220, 220);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px NotoSans';
    ctx.fillText('512 × 512 × 3 RGB', vaeX, vaeY - 10);
    ctx.fillStyle = '#fca5a5';
    ctx.font = '16px NotoSans';
    ctx.fillText('786,432 Raw Values', vaeX, vaeY + 20);

    // VRAM Warning
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(vaeX - 130, vaeY + 125, 260, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px NotoSans';
    ctx.fillText('⚠ VRAM OVERFLOW (TOO HEAVY)', vaeX, vaeY + 149);
  } else {
    // Compact 64x64 Latent Cube (Cyan VAE Crystal)
    ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.fillRect(vaeX - 60, vaeY - 60, 120, 120);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(vaeX - 60, vaeY - 60, 120, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px NotoSans';
    ctx.fillText('LATENT CUBE', vaeX, vaeY - 10);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '15px NotoSans';
    ctx.fillText('64 × 64 × 4 (8x Shrink)', vaeX, vaeY + 15);
    ctx.fillStyle = '#10b981';
    ctx.fillText('16,384 Values (Fast!)', vaeX, vaeY + 35);
  }

  // Character: Magi Architect of Latent Space (X: 420, Y: 820)
  const magiX = 420, magiY = 820;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  // Magi IK hand tracking VAE crystal & pointing at U-Net
  const rHand = [unetX - 220, unetY - 150];
  const lHand = [vaeX + 40, vaeY + 40];

  const rArm = solve2BoneIK([magiX + 10, magiY - 130], rHand, 60, 60, 1);
  const lArm = solve2BoneIK([magiX - 10, magiY - 130], lHand, 55, 55, -1);

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
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(360, 930, 1200, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('LATENT DIFFUSION & THE U-NET:  Compressing Pixels into Pure Concepts', 960, 970);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Pre-trained VAE compresses images 8x. The U-Net downsamples broad composition, then uses skip bridges to restore fine edges.', 960, 1000);
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 4 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 4 1080p Render Complete! Output: ${OUTPUT}`);
