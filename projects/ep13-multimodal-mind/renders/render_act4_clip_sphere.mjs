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
const VOICE = path.resolve('projects/ep13-multimodal-mind/build/narration/act4.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP13-Act4-CLIPSphere-1080p.mp4');
const SFX_FILE = '/tmp/ep13_act4_sfx.wav';
const MIX_FILE = '/tmp/ep13_act4_mix.wav';

console.log(`=== EP13 ACT 4: CLIP & THE SHARED CELESTIAL SPHERE ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 71923;
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

  // Cosmic hypersphere ambient hum
  addStereo(1.0, 50.0,
    (t) => Math.sin(2 * Math.PI * (110 + Math.sin(t * 0.2) * 10) * t) * 0.15,
    (t) => Math.sin(2 * Math.PI * (112 + Math.sin(t * 0.2) * 10) * t) * 0.15,
    0.25
  );

  // Contrastive gravitational pull sound at t = 20.0s
  addStereo(20.0, 3.5,
    (t) => Math.sin(2 * Math.PI * (200 + t * 150) * t) * Math.min(t, 3.5 - t) * 0.3,
    (t) => Math.sin(2 * Math.PI * (205 + t * 150) * t) * Math.min(t, 3.5 - t) * 0.3,
    0.45
  );

  // Snapping lock chime when positive pairs align at t = 24.0s
  addStereo(24.0, 1.2,
    (t) => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 6) + Math.sin(2 * Math.PI * 1760 * t) * Math.exp(-t * 12) * 0.5,
    (t) => Math.sin(2 * Math.PI * 884 * t) * Math.exp(-t * 6) + Math.sin(2 * Math.PI * 1768 * t) * Math.exp(-t * 12) * 0.5,
    0.60
  );

  // Electrostatic repulsion sizzle for negative pairs at t = 30.0s
  addStereo(30.0, 1.5,
    (t) => noise() * 0.2 * Math.exp(-t * 3),
    (t) => noise() * 0.2 * Math.exp(-t * 3),
    0.35
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

  // Background: Deep Cosmic Space Midnight Blue
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#020512');
  grad.addColorStop(0.5, '#070f2b');
  grad.addColorStop(1, '#02040d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Stardust stars
  let sSeed = 19482;
  for (let s = 0; s < 100; s++) {
    sSeed = (Math.imul(sSeed, 1664525) + 1013904223) >>> 0;
    const sx = (sSeed / 4294967296) * WIDTH;
    sSeed = (Math.imul(sSeed, 1664525) + 1013904223) >>> 0;
    const sy = (sSeed / 4294967296) * HEIGHT;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Giant 3D Celestial Hypersphere in Center-Right (X: 1200, Y: 480)
  const sphereX = 1200, sphereY = 480, sphereR = 260;

  // Outer glow
  const sphereGlow = ctx.createRadialGradient(sphereX, sphereY, sphereR * 0.7, sphereX, sphereY, sphereR * 1.2);
  sphereGlow.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
  sphereGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sphereGlow;
  ctx.beginPath();
  ctx.arc(sphereX, sphereY, sphereR * 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Sphere base disc
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(sphereX, sphereY, sphereR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Latitudinal & Longitudinal 3D Grid Rings
  const rotAngle = t * 0.15;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.lineWidth = 1.5;

  // Latitude rings
  for (let lat = -2; lat <= 2; lat++) {
    const latY = sphereY + lat * 65;
    const latR = Math.sqrt(Math.max(0, sphereR * sphereR - (lat * 65) * (lat * 65)));
    ctx.beginPath();
    ctx.ellipse(sphereX, latY, latR, latR * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Longitude rings
  for (let lon = 0; lon < 4; lon++) {
    const lonAngle = rotAngle + (lon * Math.PI) / 4;
    const lonW = Math.abs(Math.sin(lonAngle)) * sphereR;
    ctx.beginPath();
    ctx.ellipse(sphereX, sphereY, lonW, sphereR, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Contrastive Target Points on the Hypersphere:
  // Target 1: Golden Retriever Photo (Image Vector)
  // Target 2: Text "a friendly puppy" (Text Vector)
  let dogImgX = sphereX - 140, dogImgY = sphereY - 80;
  let dogTxtX = sphereX + 130, dogTxtY = sphereY + 90;

  // At t >= 18s, contrastive gravity pulls them toward a common point (sphereX, sphereY - 20)
  const targetX = sphereX - 20, targetY = sphereY - 40;
  if (t >= 18.0) {
    const pullProgress = Math.min(1.0, (t - 18.0) / 6.0);
    dogImgX = (sphereX - 140) + (targetX - (sphereX - 140)) * pullProgress;
    dogImgY = (sphereY - 80) + (targetY - (sphereY - 80)) * pullProgress;

    dogTxtX = (sphereX + 130) + (targetX - (sphereX + 130)) * pullProgress;
    dogTxtY = (sphereY + 90) + (targetY - (sphereY + 90)) * pullProgress;

    // Golden Gravitational Tractor Beam
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(dogImgX, dogImgY);
    ctx.lineTo(dogTxtX, dogTxtY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Image Node (Cyan)
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(dogImgX, dogImgY, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px NotoSans';
  ctx.fillText('🖼 [Photo: Dog]', dogImgX - 60, dogImgY - 24);

  // Text Node (Magenta)
  ctx.fillStyle = '#db2777';
  ctx.beginPath();
  ctx.arc(dogTxtX, dogTxtY, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#ec4899';
  ctx.font = 'bold 15px NotoSans';
  ctx.fillText('🔤 "a friendly puppy"', dogTxtX - 70, dogTxtY + 34);

  // When aligned (t >= 24s), flash unified gold crest
  if (t >= 24.0) {
    const snapAge = t - 24.0;
    const snapR = 20 + Math.min(40, snapAge * 30);
    ctx.strokeStyle = `rgba(250, 204, 21, ${Math.max(0, 1 - snapAge / 4.0)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(targetX, targetY, snapR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 16px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('✓ ALIGNED IN EMBEDDING SPACE', targetX, targetY - 45);
    ctx.textAlign = 'left';
  }

  // Mismatched Negative Pair Repulsion (e.g., Cat Text pushed away)
  if (t >= 28.0) {
    const catX = sphereX + 160, catY = sphereY - 120;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(targetX, targetY);
    ctx.lineTo(catX, catY);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 13px NotoSans';
    ctx.fillText('✖ REPELLED ("a black cat")', catX + 15, catY);
  }

  // Character: Magi exploring the Hypersphere (X: 380, Y: 800)
  const magiX = 380, magiY = 800;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  const rHand = [sphereX - sphereR + 40, sphereY + 20];
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
    expression: t > 24.0 ? 'happy' : 'curious',
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
  ctx.fillText('CLIP CONTRASTIVE EMBEDDINGS:  A Shared Celestial Hypersphere', 960, 970);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Maximize cosine similarity of matching pairs; push non-matching pairs apart. Photos, sketches, and words share identical coordinates!', 960, 1000);
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
