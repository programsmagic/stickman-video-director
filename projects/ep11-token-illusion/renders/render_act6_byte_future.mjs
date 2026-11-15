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
const VOICE = path.resolve('projects/ep11-token-illusion/build/narration/act6.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP11-Act6-ByteFuture-1080p.mp4');
const SFX_FILE = '/tmp/ep11_act6_sfx.wav';
const MIX_FILE = '/tmp/ep11_act6_mix.wav';

console.log(`=== EP11 ACT 6: BEYOND THE ILLUSION (TOKEN-FREE BYTE MODELS) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 19284;
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

  // Cosmic ambient pad
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

  // Chimes at key transitions (t = 0.5s, 16s, 32s, 42s)
  const chimeTimes = [0.5, 16.0, 32.0, 42.0];
  for (const tc of chimeTimes) {
    addStereo(tc, 4.5,
      (t) => (Math.sin(2 * Math.PI * 528 * t) + Math.sin(2 * Math.PI * 1056 * t) * 0.5) * Math.exp(-t * 0.8),
      (t) => (Math.sin(2 * Math.PI * 532 * t) + Math.sin(2 * Math.PI * 1064 * t) * 0.5) * Math.exp(-t * 0.8),
      0.35
    );
  }

  // Dissolution whoosh at t = 14s
  addStereo(14.0, 3.5,
    (t) => noise() * Math.sin(Math.PI * t / 3.5) * 0.35,
    (t) => noise() * Math.sin(Math.PI * t / 3.5) * 0.35,
    0.4
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

// Static stars
const STARS = [];
let sSeed = 72910;
for (let i = 0; i < 220; i++) {
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
  ctx.fillText('ACT VI: BEYOND THE ILLUSION (TOKEN-FREE BYTE MODELS)', 100, 90);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '22px NotoSans';
  ctx.fillText('Meta FAIR (2024) · Byte Latent Transformers & Continuous Thought', 100, 126);

  // Fluid Continuous Waveforms of Light (Replacing the Guillotine)
  const waveY = 520;
  for (let w = 0; w < 4; w++) {
    ctx.beginPath();
    ctx.moveTo(150, waveY);
    for (let x = 150; x <= 1770; x += 30) {
      const u = (x - 150) / 1620;
      const y = waveY + Math.sin(u * 12 + t * 4 + w) * (35 + w * 12);
      ctx.lineTo(x, y);
    }
    const colors = [
      'rgba(56, 189, 248, 0.4)',
      'rgba(245, 158, 11, 0.35)',
      'rgba(168, 85, 247, 0.3)',
      'rgba(34, 197, 94, 0.3)'
    ];
    ctx.strokeStyle = colors[w];
    ctx.lineWidth = 4 - w * 0.8;
    ctx.stroke();
  }

  // Floating Byte Particles
  for (let p = 0; p < 45; p++) {
    const px = 200 + ((p * 37 + Math.floor(t * 80)) % 1520);
    const py = waveY - 80 + Math.sin(t * 3 + p) * 60;
    ctx.fillStyle = 'rgba(253, 224, 71, 0.8)';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Karpathy Insight Quote Card (Center)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(440, 240, 1040, 160, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'italic 22px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('"Tokenization is a completely artificial layer of suffering.', 960, 290);
  ctx.fillText('A huge number of subtle bugs in LLMs trace back to it."', 960, 325);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 18px NotoSans';
  ctx.fillText('— Andrej Karpathy (Former OpenAI Scientist & Tesla AI Director)', 960, 365);

  // Magi standing in center, raising lantern
  const magiX = WIDTH / 2, magiGroundY = 860;
  drawGroundShadow(ctx, magiX, magiGroundY, 65, 18, 0.55);

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

  // Eyes (front curious eyes looking at camera)
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

  // Arms: Right arm raising glowing lantern into the air
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

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(lanternTargetX - 12, lanternTargetY - 15, 24, 30);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3;
  ctx.strokeRect(lanternTargetX - 12, lanternTargetY - 15, 24, 30);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(lanternTargetX, lanternTargetY, 8, 0, Math.PI * 2);
  ctx.fill();

  // Grand Climax Cinematic Title Card (t >= 32s)
  if (t >= 32.0) {
    const bannerAlpha = Math.min(1.0, (t - 32.0) / 2.0);
    ctx.fillStyle = `rgba(15, 23, 42, ${(bannerAlpha * 0.9).toFixed(2)})`;
    ctx.strokeStyle = `rgba(234, 179, 8, ${(bannerAlpha * 0.8).toFixed(2)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(320, 880, 1280, 105, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = `rgba(254, 240, 138, ${bannerAlpha.toFixed(2)})`;
    ctx.font = 'bold 30px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('LANGUAGE IS NOT A PUZZLE OF BLOCKS. IT IS A STREAM OF CONTINUOUS THOUGHT.', 960, 930);

    ctx.fillStyle = `rgba(148, 163, 184, ${bannerAlpha.toFixed(2)})`;
    ctx.font = '18px NotoSans';
    ctx.fillText('When AI transcends the token illusion, machines will finally perceive language as we do.', 960, 962);
  }

  // Stream raw bytes into FFmpeg stdin
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
