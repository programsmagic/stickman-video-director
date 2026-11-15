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
const VOICE = path.resolve('projects/ep11-token-illusion/build/narration/act5.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP11-Act5-TokenTax-1080p.mp4');
const SFX_FILE = '/tmp/ep11_act5_sfx.wav';
const MIX_FILE = '/tmp/ep11_act5_mix.wav';

console.log(`=== EP11 ACT 5: THE GLOBAL TOKEN TAX ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 72819;
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

  // Cash register cha-ching at t = 22.0s
  addStereo(22.0, 0.45,
    (t) => (Math.sin(2 * Math.PI * 1800 * t) + Math.sin(2 * Math.PI * 2700 * t)) * Math.exp(-t * 6),
    (t) => (Math.sin(2 * Math.PI * 1820 * t) + Math.sin(2 * Math.PI * 2730 * t)) * Math.exp(-t * 6),
    0.55
  );

  // Shattering byte shards crackle (t = 12s to 36s periodic)
  for (let s = 0; s < 12; s++) {
    const ts = 12.0 + s * 2.2;
    addStereo(ts, 0.12,
      (t) => (noise() * Math.exp(-t * 30) + Math.sin(2 * Math.PI * 3200 * t) * 0.2),
      (t) => (noise() * Math.exp(-t * 30) + Math.sin(2 * Math.PI * 3250 * t) * 0.2),
      0.35
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

  // Split Screen Dark Background
  ctx.fillStyle = '#0a0f1d';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Vertical Divider Line
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 180);
  ctx.lineTo(WIDTH / 2, 880);
  ctx.stroke();

  // HUD Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('ACT V: THE GLOBAL TOKEN TAX', 100, 90);
  ctx.fillStyle = '#f59e0b';
  ctx.font = '22px NotoSans';
  ctx.fillText('Petrov et al. (EMNLP 2023) · Subword Inequity & Language Disparity', 100, 126);

  // LEFT PANEL: ENGLISH (HIGH RESOURCE)
  const leftCX = 480;
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 26px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('ENGLISH INPUT (1.3 Tokens / Word)', leftCX, 240);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '22px NotoSans';
  ctx.fillText('"Artificial intelligence transforms our world."', leftCX, 290);

  // 4 Neat Wooden Blocks
  const ENG_TOKENS = ['Artificial', 'intelligence', 'transforms', 'our world'];
  for (let i = 0; i < 4; i++) {
    const bx = leftCX - 320 + i * 165;
    const by = 350;

    ctx.fillStyle = '#166534';
    ctx.fillRect(bx, by, 150, 65);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, 150, 65);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px NotoSans';
    ctx.fillText(ENG_TOKENS[i], bx + 75, by + 35);
    ctx.fillStyle = '#bbf7d0';
    ctx.font = '12px NotoSans';
    ctx.fillText(`TOKEN #${1000 + i * 450}`, bx + 75, by + 52);
  }

  // English Cost Card
  ctx.fillStyle = 'rgba(22, 101, 52, 0.4)';
  ctx.fillRect(leftCX - 180, 480, 360, 120);
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.strokeRect(leftCX - 180, 480, 360, 120);

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 28px NotoSans';
  ctx.fillText('COMPUTE COST: $0.04', leftCX, 530);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '16px NotoSans';
  ctx.fillText('Total Tokens: 4 · Latency: 1.0x (Baseline)', leftCX, 570);

  // RIGHT PANEL: HINDI / LOW RESOURCE
  const rightCX = 1440;
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 26px NotoSans';
  ctx.fillText('NON-ENGLISH / HINDI (7.0+ Tokens / Word)', rightCX, 240);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '22px NotoSans';
  ctx.fillText('Same Meaning · Unicode Multi-Byte Shattering', rightCX, 290);

  // 14 Shattered Tiny Byte Shards (Grid 7x2)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 7; c++) {
      const bx = rightCX - 380 + c * 110;
      const by = 350 + r * 55;

      ctx.fillStyle = '#991b1b';
      ctx.fillRect(bx, by, 95, 45);
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, 95, 45);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px NotoSans';
      ctx.fillText(`Byte \\x${(160 + c * 12 + r * 20).toString(16)}`, bx + 47, by + 28);
    }
  }

  // Hindi Cost Card (7x Cost)
  ctx.fillStyle = 'rgba(153, 27, 27, 0.4)';
  ctx.fillRect(rightCX - 180, 480, 360, 120);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.strokeRect(rightCX - 180, 480, 360, 120);

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 28px NotoSans';
  ctx.fillText('COMPUTE COST: $0.28', rightCX, 530);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '16px NotoSans';
  ctx.fillText('Total Tokens: 28 · Latency: 7.0x SLOWER', rightCX, 570);

  // Central Comparison Badge
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.roundRect(WIDTH / 2 - 110, 490, 220, 60, 12);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 24px NotoSans';
  ctx.fillText('700% TAX', WIDTH / 2, 530);

  // Magi standing at center holding balance scale
  const magiX = WIDTH / 2, magiGroundY = 880;
  drawGroundShadow(ctx, magiX, magiGroundY, 65, 18, 0.5);

  const breath = idleBreath(t, 18);
  const blink = blinkState(t, 7291);

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
    ctx.arc(magiX - 5, headY - 2, 3, 0, Math.PI * 2);
    ctx.arc(magiX + 5, headY - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(magiX - 8, headY - 2);
    ctx.lineTo(magiX - 2, headY - 2);
    ctx.moveTo(magiX + 2, headY - 2);
    ctx.lineTo(magiX + 8, headY - 2);
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

  // Arms holding tilted balance scale
  const scaleTilt = Math.sin(t * 2) * 8;
  const lPanY = torsoY - 10 - scaleTilt;
  const rPanY = torsoY - 10 + scaleTilt;

  const lArm = solve2BoneIK([magiX, torsoY], [magiX - 60, lPanY], 45, 45, 1);
  const rArm = solve2BoneIK([magiX, torsoY], [magiX + 60, rPanY], 45, 45, -1);

  ctx.beginPath();
  ctx.moveTo(magiX, torsoY);
  ctx.lineTo(lArm[1][0], lArm[1][1]);
  ctx.lineTo(magiX - 60, lPanY);

  ctx.moveTo(magiX, torsoY);
  ctx.lineTo(rArm[1][0], rArm[1][1]);
  ctx.lineTo(magiX + 60, rPanY);
  ctx.stroke();

  // Balance scale beam
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(magiX - 90, lPanY);
  ctx.lineTo(magiX + 90, rPanY);
  ctx.stroke();

  // Bottom Key Takeaway HUD
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(400, 920, 1120, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE TOKEN TAX: Hardcoded Arithmetic Inequity Across Global Languages', 960, 960);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('English compresses into concise tokens, while non-Latin scripts shatter into costly byte fragments.', 960, 990);

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 5 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 5 1080p Render Complete! Output: ${OUTPUT}`);
