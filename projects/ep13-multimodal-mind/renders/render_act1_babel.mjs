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
const VOICE = path.resolve('projects/ep13-multimodal-mind/build/narration/act1.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP13-Act1-Babel-1080p.mp4');
const SFX_FILE = '/tmp/ep13_act1_sfx.wav';
const MIX_FILE = '/tmp/ep13_act1_mix.wav';

console.log(`=== EP13 ACT 1: THE TOWER OF SENSORY BABEL ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 48192;
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

  // Thunder rumble at t = 3.0s
  addStereo(3.0, 3.5,
    (t) => Math.sin(2 * Math.PI * 45 * t) * Math.exp(-t * 0.8) + noise() * 0.25 * Math.exp(-t * 1.2),
    (t) => Math.sin(2 * Math.PI * 48 * t) * Math.exp(-t * 0.8) + noise() * 0.25 * Math.exp(-t * 1.2),
    0.60
  );

  // Glass partition thuds at t = 22.0s and 25.0s
  [22.0, 25.0].forEach((pt) => {
    addStereo(pt, 0.4,
      (t) => Math.sin(2 * Math.PI * 340 * t) * Math.exp(-t * 18) + noise() * 0.15 * Math.exp(-t * 20),
      (t) => Math.sin(2 * Math.PI * 350 * t) * Math.exp(-t * 18) + noise() * 0.15 * Math.exp(-t * 20),
      0.45
    );
  });

  // Frankenstein pipeline gear clank at t = 42.0s
  addStereo(42.0, 2.0,
    (t) => Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 2) + noise() * 0.2 * Math.exp(-t * 4),
    (t) => Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 2) + noise() * 0.2 * Math.exp(-t * 4),
    0.40
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

  // Background: Moody Atmospheric Ancient Observatory
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#060914');
  grad.addColorStop(0.5, '#0b1226');
  grad.addColorStop(1, '#03050c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Distant Lightning Flash at t = 3.0s to 3.8s
  if (t >= 3.0 && t <= 3.8) {
    const flashAlpha = Math.sin((t - 3.0) * Math.PI * 4) * 0.25;
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(168, 85, 247, ${flashAlpha})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  // Ancient stone floor perspective grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }

  // 3 Isolated Sensory Chambers in Stage Center (X: 1100, Y: 460)
  const chamberW = 220, chamberH = 340;
  const startX = 720;

  // Chamber 1: Computer Vision (Left: Red/Cyan - Pixel Filters)
  const c1X = startX;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(c1X, 260, chamberW, chamberH);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.strokeRect(c1X, 260, chamberW, chamberH);

  // CNN 3x3 Filter Kernel graphic
  ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
  ctx.fillRect(c1X + 40, 320, 140, 140);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  for (let gx = 0; gx < 3; gx++) {
    for (let gy = 0; gy < 3; gy++) {
      ctx.strokeRect(c1X + 40 + gx * 46, 320 + gy * 46, 46, 46);
    }
  }
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 18px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('COMPUTER VISION', c1X + chamberW / 2, 500);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans';
  ctx.fillText('Pixel Convolutions', c1X + chamberW / 2, 530);

  // Chamber 2: Natural Language (Center: Violet - BPE Tokens)
  const c2X = startX + 260;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(c2X, 260, chamberW, chamberH);
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 3;
  ctx.strokeRect(c2X, 260, chamberW, chamberH);

  // Vocabulary Token Blocks
  ['[word: 412]', '[token: 89]', '[embed: 704]'].forEach((tok, idx) => {
    ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
    ctx.fillRect(c2X + 25, 330 + idx * 45, 170, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px NotoSans';
    ctx.fillText(tok, c2X + chamberW / 2, 352 + idx * 45);
  });
  ctx.fillStyle = '#a855f7';
  ctx.font = 'bold 18px NotoSans';
  ctx.fillText('LANGUAGE (NLP)', c2X + chamberW / 2, 500);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans';
  ctx.fillText('Discrete Tokens', c2X + chamberW / 2, 530);

  // Chamber 3: Speech Audio (Right: Gold - Mel Waveforms)
  const c3X = startX + 520;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(c3X, 260, chamberW, chamberH);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3;
  ctx.strokeRect(c3X, 260, chamberW, chamberH);

  // Audio waveform squiggles
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let ax = 0; ax < 160; ax += 5) {
    const ay = 390 + Math.sin(ax * 0.15 + t * 4) * 30 * Math.sin(ax * 0.04);
    if (ax === 0) ctx.moveTo(c3X + 30 + ax, ay);
    else ctx.lineTo(c3X + 30 + ax, ay);
  }
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 18px NotoSans';
  ctx.fillText('SPEECH AUDIO', c3X + chamberW / 2, 500);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans';
  ctx.fillText('Acoustic Waves', c3X + chamberW / 2, 530);

  // Thick Glass Partition Barriers between chambers
  ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.fillRect(c1X + chamberW + 8, 240, 24, chamberH + 40);
  ctx.fillRect(c2X + chamberW + 8, 240, 24, chamberH + 40);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(c1X + chamberW + 8, 240, 24, chamberH + 40);
  ctx.strokeRect(c2X + chamberW + 8, 240, 24, chamberH + 40);

  // Barrier Lock Icons
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 16px NotoSans';
  ctx.fillText('ISOLATED', c1X + chamberW + 20, 225);
  ctx.fillText('ISOLATED', c2X + chamberW + 20, 225);

  // Character: Magi standing before the chambers (X: 380, Y: 780)
  const magiX = 380, magiY = 780;
  drawGroundShadow(ctx, magiX, magiY, 80, 16);

  // Magi holding 3 glowing sensory orbs
  const rHand = [magiX + 90, magiY - 140];
  const lHand = [magiX - 60, magiY - 120];

  const rArm = solve2BoneIK([magiX + 10, magiY - 130], rHand, 55, 55, 1);
  const lArm = solve2BoneIK([magiX - 10, magiY - 130], lHand, 50, 50, -1);

  drawFigure(ctx, {
    x: magiX,
    y: magiY,
    scale: 1.15,
    color: INK,
    fillColor: '#ffffff',
    hat: 'wizard',
    scarf: true,
    expression: 'curious',
    blinking: blinkState(t),
    breathing: idleBreath(t),
    lHandTarget: lArm ? [lArm[1][0], lArm[1][1]] : undefined,
    rHandTarget: rArm ? [rArm[1][0], rArm[1][1]] : undefined
  });

  // Floating sensory orbs above Magi's hands
  const orbGlow = (ox, oy, col) => {
    const og = ctx.createRadialGradient(ox, oy, 4, ox, oy, 24);
    og.addColorStop(0, '#ffffff');
    og.addColorStop(0.5, col);
    og.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(ox, oy, 24, 0, Math.PI * 2);
    ctx.fill();
  };
  orbGlow(magiX + 90, magiY - 150 + Math.sin(t * 3) * 6, '#ef4444'); // Vision orb
  orbGlow(magiX + 125, magiY - 170 + Math.cos(t * 3) * 6, '#a855f7'); // Text orb
  orbGlow(magiX - 60, magiY - 130 + Math.sin(t * 2.5) * 6, '#facc15'); // Audio orb

  // HUD Insight Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(360, 930, 1200, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE TOWER OF SENSORY BABEL:  70 Years of Sensory Isolation', 960, 970);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Vision processed pixel convolutions. NLP read discrete text tokens. Audio analyzed frequencies. None could talk to each other.', 960, 1000);
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
