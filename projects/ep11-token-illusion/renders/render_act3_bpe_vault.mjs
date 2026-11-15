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
const VOICE = path.resolve('projects/ep11-token-illusion/build/narration/act3.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP11-Act3-BPEVault-1080p.mp4');
const SFX_FILE = '/tmp/ep11_act3_sfx.wav';
const MIX_FILE = '/tmp/ep11_act3_mix.wav';

console.log(`=== EP11 ACT 3: BYTE-PAIR ENCODING & THE 100,000-WORD VAULT ===`);
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

  // Ambient library vault reverb
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    left[i] += Math.sin(2 * Math.PI * 50 * t) * 0.015;
    right[i] += Math.sin(2 * Math.PI * 52 * t) * 0.015;
  }

  // Locker door clicks (every 4s)
  for (let k = 0; k < 10; k++) {
    const tk = 4.0 + k * 4.2;
    addStereo(tk, 0.12,
      (t) => Math.sin(2 * Math.PI * 850 * t) * Math.exp(-t * 35) + noise() * 0.2 * Math.exp(-t * 20),
      (t) => Math.sin(2 * Math.PI * 870 * t) * Math.exp(-t * 35) + noise() * 0.2 * Math.exp(-t * 20),
      0.35
    );
  }

  // Token fusion spark whooshes (at t = 14s, 22s, 34s)
  const fusionTimes = [14.0, 22.0, 34.0];
  for (const tf of fusionTimes) {
    addStereo(tf, 0.35,
      (t) => (Math.sin(2 * Math.PI * (400 + t * 600) * t) + noise() * 0.4) * Math.exp(-t * 8),
      (t) => (Math.sin(2 * Math.PI * (420 + t * 600) * t) + noise() * 0.4) * Math.exp(-t * 8),
      0.45
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

  // Vault Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#0c1220');
  grad.addColorStop(0.5, '#11192e');
  grad.addColorStop(1, '#070b14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // HUD Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('ACT III: BYTE-PAIR ENCODING & THE VOCABULARY VAULT', 100, 90);
  ctx.fillStyle = '#f59e0b';
  ctx.font = '22px NotoSans';
  ctx.fillText('Sennrich et al. (ACL 2016) · Frequency-Based Subword Compression', 100, 126);

  // Perspective Brass Vault Lockers Wall (Right Half)
  const lockerStartX = 720;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 7; col++) {
      const lx = lockerStartX + col * 160;
      const ly = 220 + row * 110;
      const isOpen = (col === 2 && row === 1) || (col === 5 && row === 3);

      ctx.fillStyle = isOpen ? '#1e293b' : '#334155';
      ctx.fillRect(lx, ly, 145, 95);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.strokeRect(lx, ly, 145, 95);

      // Brass door handle
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(lx + 125, ly + 48, 6, 0, Math.PI * 2);
      ctx.fill();

      // Locker index number
      const num = 12400 + row * 1500 + col * 280;
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 13px NotoSans';
      ctx.textAlign = 'left';
      ctx.fillText(`#${num}`, lx + 12, ly + 25);

      if (isOpen) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 18px NotoSans';
        ctx.fillText(col === 2 ? '"programming"' : '"the"', lx + 12, ly + 65);
      }
    }
  }

  // Left Side: Interactive BPE Fusion Laboratory
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(120, 220, 540, 535);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(120, 220, 540, 535);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('BYTE-PAIR ENCODING (BPE) ALGORITHM', 390, 270);

  // Step 1: Characters 'e' and 'r'
  const fuseCycle = (t * 0.4) % 1.0;
  const cardDist = Math.max(0, 100 * (1 - fuseCycle * 1.5));

  const c1X = 390 - cardDist - 40;
  const c2X = 390 + cardDist + 40;

  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(c1X - 35, 340, 70, 70);
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 3;
  ctx.strokeRect(c1X - 35, 340, 70, 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px NotoSans';
  ctx.fillText('e', c1X, 390);

  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(c2X - 35, 340, 70, 70);
  ctx.strokeRect(c2X - 35, 340, 70, 70);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('r', c2X, 390);

  // Fusion arrow
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(390, 440);
  ctx.lineTo(390, 490);
  ctx.stroke();

  // Fused Token Block
  ctx.fillStyle = '#065f46';
  ctx.fillRect(390 - 80, 510, 160, 80);
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 3;
  ctx.strokeRect(390 - 80, 510, 160, 80);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px NotoSans';
  ctx.fillText('"er"', 390, 550);
  ctx.fillStyle = '#a7f3d0';
  ctx.font = '14px NotoSans';
  ctx.fillText('TOKEN #412', 390, 575);

  // Frequency Stats
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '16px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('Frequency Count: 482,910,240 pairs', 390, 640);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 16px NotoSans';
  ctx.fillText('ACTION: PROMOTE TO VOCABULARY LOCKER', 390, 675);

  // Magi with Inspection Ledger (Standing near vault)
  const magiX = 760, magiGroundY = 880;
  drawGroundShadow(ctx, magiX, magiGroundY, 65, 18, 0.5);

  const breath = idleBreath(t, 18);
  const blink = blinkState(t, 3912);

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

  // Standing Legs
  ctx.beginPath();
  ctx.moveTo(magiX, hipY);
  ctx.lineTo(magiX - 12, magiGroundY);
  ctx.moveTo(magiX, hipY);
  ctx.lineTo(magiX + 12, magiGroundY);
  ctx.stroke();

  // Hands holding open ledger book
  const bookX = magiX + 50, bookY = torsoY - 10;
  const rArm = solve2BoneIK([magiX, torsoY], [bookX, bookY], 40, 40, -1);
  ctx.beginPath();
  ctx.moveTo(magiX, torsoY);
  ctx.lineTo(rArm[1][0], rArm[1][1]);
  ctx.lineTo(bookX, bookY);
  ctx.stroke();

  // Open Book
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(bookX - 15, bookY - 20, 45, 30);
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 2;
  ctx.strokeRect(bookX - 15, bookY - 20, 45, 30);

  // Bottom Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(400, 920, 1120, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('BYTE-PAIR ENCODING (BPE): The Compromise Between Letters & Words', 960, 960);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Frequent subwords earn permanent dictionary lockers (~100k tokens), avoiding character explosion.', 960, 990);

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
