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
const VOICE = path.resolve('projects/ep10-geometry-of-thinking/build/narration/act6.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP10-Act6-GlobalBasin-1080p.mp4');
const SFX_FILE = '/tmp/ep10_act6_sfx.wav';
const MIX_FILE = '/tmp/ep10_act6_mix.wav';

console.log(`=== EP10 ACT 6: THE GLOBAL BASIN & THE COSMIC CHISEL ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 10492;
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

  // Cosmic ambient pad (throughout the 53.88s)
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const drone = (
      Math.sin(2 * Math.PI * 110 * t) * 0.03 +
      Math.sin(2 * Math.PI * 220 * t) * 0.02 +
      Math.sin(2 * Math.PI * 330 * t) * 0.01 +
      noise() * 0.005
    );
    left[i] += drone;
    right[i] += drone;
  }

  // Harmonic resonant chimes at key transitions (t = 0.5s, 15.0s, 35.0s, 44.0s)
  const chimeTimes = [0.5, 15.0, 35.0, 44.0];
  for (const tc of chimeTimes) {
    addStereo(tc, 4.5,
      (t) => (Math.sin(2 * Math.PI * 528 * t) + Math.sin(2 * Math.PI * 1056 * t) * 0.5) * Math.exp(-t * 0.8),
      (t) => (Math.sin(2 * Math.PI * 532 * t) + Math.sin(2 * Math.PI * 1064 * t) * 0.5) * Math.exp(-t * 0.8),
      0.35
    );
  }

  // Lantern ignition chime at t = 44s
  addStereo(44.0, 5.0,
    (t) => (Math.sin(2 * Math.PI * 880 * t) + Math.sin(2 * Math.PI * 1760 * t) * 0.6) * Math.exp(-t * 0.6),
    (t) => (Math.sin(2 * Math.PI * 884 * t) + Math.sin(2 * Math.PI * 1768 * t) * 0.6) * Math.exp(-t * 0.6),
    0.45
  );

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
  execSync(`ffmpeg -v error -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v0];[1:a]volume=0.40[v1];[v0][v1]amix=inputs=2:duration=first:dropout_transition=2" -ar 48000 -c:a pcm_s16le "${MIX_FILE}"`);
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

// Static cosmic stars
const STARS = [];
let sSeed = 38910;
for (let i = 0; i < 240; i++) {
  sSeed = (Math.imul(sSeed, 1664525) + 1013904223) >>> 0;
  const sx = (sSeed / 4294967296) * WIDTH;
  sSeed = (Math.imul(sSeed, 1664525) + 1013904223) >>> 0;
  const sy = (sSeed / 4294967296) * (HEIGHT * 0.7);
  sSeed = (Math.imul(sSeed, 1664525) + 1013904223) >>> 0;
  const sr = 0.8 + (sSeed / 4294967296) * 2.2;
  STARS.push({ x: sx, y: sy, r: sr });
}

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Deep Cosmic Midnight Gradient
  const grad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 100, WIDTH / 2, HEIGHT / 2, 900);
  grad.addColorStop(0, '#111827');
  grad.addColorStop(0.5, '#090d16');
  grad.addColorStop(1, '#020408');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Stars twinkling
  for (let i = 0; i < STARS.length; i++) {
    const star = STARS[i];
    const alpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + i));
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // HUD Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('ACT VI: THE GLOBAL BASIN & THE MYSTERY OF GENERALIZATION', 100, 90);
  ctx.fillStyle = '#eab308';
  ctx.font = '22px NotoSans';
  ctx.fillText('High-Dimensional Topology (Li et al., 2018) · The Universal Cosmic Chisel', 100, 126);

  // Giant parabolic global basin contour rings
  const centerX = WIDTH / 2;
  const basinCenterY = 740;

  for (let r = 800; r >= 100; r -= 70) {
    const ringAlpha = (1.0 - r / 900) * 0.45;
    ctx.strokeStyle = `rgba(234, 179, 8, ${ringAlpha.toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(centerX, basinCenterY, r, r * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Golden pool of light at center
  const poolGlow = ctx.createRadialGradient(centerX, basinCenterY, 10, centerX, basinCenterY, 220);
  poolGlow.addColorStop(0, 'rgba(234, 179, 8, 0.6)');
  poolGlow.addColorStop(0.5, 'rgba(234, 179, 8, 0.25)');
  poolGlow.addColorStop(1, 'rgba(234, 179, 8, 0.0)');
  ctx.fillStyle = poolGlow;
  ctx.beginPath();
  ctx.ellipse(centerX, basinCenterY, 220, 80, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 20px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('GLOBAL MINIMUM: LOSS = 0.000000', centerX, basinCenterY + 45);

  // Floating golden stardust particles
  for (let p = 0; p < 45; p++) {
    const pSeed = (p * 8129 + Math.floor(t * 10)) % 1000;
    const px = centerX - 180 + ((p * 37) % 360);
    const py = basinCenterY - ((t * 40 + p * 15) % 350);
    ctx.fillStyle = 'rgba(253, 224, 71, 0.7)';
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Magi standing in the center of the golden pool
  const magiX = centerX;
  const magiGroundY = basinCenterY + 10;
  drawGroundShadow(ctx, magiX, magiGroundY, 50, 15, 0.6);

  const breath = idleBreath(t, 16);
  const blink = blinkState(t, 9812);

  const hipY = magiGroundY - 80 + breath.hipYDelta;
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

  // Yellow Scarf
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.ellipse(magiX, headY + 16, 18, 9, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (front-facing curious eyes looking at camera)
  if (!blink) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(magiX - 4, headY - 2, 3, 0, Math.PI * 2);
    ctx.arc(magiX + 4, headY - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(magiX - 7, headY - 2);
    ctx.lineTo(magiX - 1, headY - 2);
    ctx.moveTo(magiX + 1, headY - 2);
    ctx.lineTo(magiX + 7, headY - 2);
    ctx.stroke();
  }

  // Torso
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(magiX, headY + 16);
  ctx.lineTo(magiX, hipY);
  ctx.stroke();

  // Standing Legs
  ctx.beginPath();
  ctx.moveTo(magiX, hipY);
  ctx.lineTo(magiX - 15, magiGroundY);
  ctx.moveTo(magiX, hipY);
  ctx.lineTo(magiX + 15, magiGroundY);
  ctx.stroke();

  // Arms: Left arm on hip, Right arm raising glowing lantern into the air
  const lanternTargetX = magiX + 65;
  const lanternTargetY = headY - 45 + Math.sin(t * 2) * 4;
  const rArm = solve2BoneIK([magiX, torsoY], [lanternTargetX, lanternTargetY], 45, 45, -1);

  ctx.beginPath();
  ctx.moveTo(magiX, torsoY);
  ctx.lineTo(rArm[1][0], rArm[1][1]);
  ctx.lineTo(lanternTargetX, lanternTargetY);
  ctx.stroke();

  // Left arm on hip
  const lArm = solve2BoneIK([magiX, torsoY], [magiX - 35, hipY], 40, 40, 1);
  ctx.beginPath();
  ctx.moveTo(magiX, torsoY);
  ctx.lineTo(lArm[1][0], lArm[1][1]);
  ctx.lineTo(magiX - 35, hipY);
  ctx.stroke();

  // Glowing Lantern Raised High
  const lanternGlow = ctx.createRadialGradient(lanternTargetX, lanternTargetY, 5, lanternTargetX, lanternTargetY, 90);
  lanternGlow.addColorStop(0, 'rgba(253, 224, 71, 0.9)');
  lanternGlow.addColorStop(0.4, 'rgba(234, 179, 8, 0.5)');
  lanternGlow.addColorStop(1, 'rgba(234, 179, 8, 0)');
  ctx.fillStyle = lanternGlow;
  ctx.beginPath();
  ctx.arc(lanternTargetX, lanternTargetY, 90, 0, Math.PI * 2);
  ctx.fill();

  // Brass lantern frame
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(lanternTargetX - 12, lanternTargetY - 15, 24, 30);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3;
  ctx.strokeRect(lanternTargetX - 12, lanternTargetY - 15, 24, 30);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(lanternTargetX, lanternTargetY, 8, 0, Math.PI * 2);
  ctx.fill();

  // Grand Climax Cinematic Title Card (t >= 38s)
  if (t >= 38.0) {
    const bannerAlpha = Math.min(1.0, (t - 38.0) / 2.0);
    ctx.fillStyle = `rgba(15, 23, 42, ${(bannerAlpha * 0.9).toFixed(2)})`;
    ctx.strokeStyle = `rgba(234, 179, 8, ${(bannerAlpha * 0.8).toFixed(2)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(320, 860, 1280, 110, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = `rgba(254, 240, 138, ${bannerAlpha.toFixed(2)})`;
    ctx.font = 'bold 32px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('OPTIMIZATION IS THE CHISEL. GEOMETRY IS THE MIND.', 960, 915);

    ctx.fillStyle = `rgba(148, 163, 184, ${bannerAlpha.toFixed(2)})`;
    ctx.font = '20px NotoSans';
    ctx.fillText('Teaching sand to compute was the spark. Navigating loss is how sand learned to think.', 960, 950);
  }

  // Stream raw bytes to FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 6 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 6 1080p Render Complete! Output: ${OUTPUT}`);
