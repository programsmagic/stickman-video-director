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
const VOICE = path.resolve('projects/ep11-token-illusion/build/narration/act4.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP11-Act4-GlitchMagikarp-1080p.mp4');
const SFX_FILE = '/tmp/ep11_act4_sfx.wav';
const MIX_FILE = '/tmp/ep11_act4_mix.wav';

console.log(`=== EP11 ACT 4: THE GLITCH TOKEN (SOLIDGOLDMAGIKARP) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 91823;
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

  // Ominous deep drone (40 Hz + 80 Hz)
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    left[i] += Math.sin(2 * Math.PI * 40 * t) * 0.03 + (noise() * 0.01);
    right[i] += Math.sin(2 * Math.PI * 42 * t) * 0.03 + (noise() * 0.01);
  }

  // Periodic digital glitch crackles (every 2.5s)
  for (let g = 0; g < 18; g++) {
    const tg = 3.0 + g * 2.6;
    addStereo(tg, 0.15,
      (t) => (noise() * Math.exp(-t * 20) + Math.sin(2 * Math.PI * 3400 * t) * 0.3),
      (t) => (noise() * Math.exp(-t * 20) + Math.sin(2 * Math.PI * 3450 * t) * 0.3),
      0.35
    );
  }

  // Glitch alarm pulse at t = 18s and 30s
  addStereo(18.0, 1.2,
    (t) => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 3),
    (t) => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 3),
    0.4
  );
  addStereo(30.0, 1.5,
    (t) => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 2.5),
    (t) => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 2.5),
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

  // Dark Matrix Void Background
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#050811');
  grad.addColorStop(0.5, '#0a0d1a');
  grad.addColorStop(1, '#020408');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Digital Glitch Scanlines (random horizontal offsets)
  const isGlitched = Math.sin(t * 12) > 0.7;
  if (isGlitched) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    const gy = Math.floor((Math.sin(t * 25) * 0.5 + 0.5) * HEIGHT);
    ctx.fillRect(0, gy, WIDTH, 35);
  }

  // HUD Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('ACT IV: THE GLITCH IN THE MATRIX (SOLIDGOLDMAGIKARP)', 100, 90);
  ctx.fillStyle = '#ef4444';
  ctx.font = '22px NotoSans';
  ctx.fillText('Land & Rumbelow (2023) · Untrained Embeddings & Negative Centroids', 100, 126);

  // Vector Space Coordinate Grid (Left Half)
  const originX = 520, originY = 540;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(originX - 350, originY);
  ctx.lineTo(originX + 350, originY);
  ctx.moveTo(originX, originY - 260);
  ctx.lineTo(originX, originY + 260);
  ctx.stroke();

  // Concentric embedding distance rings
  for (let r = 80; r <= 280; r += 70) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
    ctx.beginPath();
    ctx.arc(originX, originY, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Normal Token Clusters (Trained Data)
  const CLUSTERS = [
    { name: 'Fruits / Food', x: originX + 160, y: originY - 120, color: '#22c55e' },
    { name: 'Math / Logic', x: originX + 120, y: originY + 140, color: '#38bdf8' },
    { name: 'Language / Verbs', x: originX - 140, y: originY - 150, color: '#a855f7' }
  ];

  for (const c of CLUSTERS) {
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 16px NotoSans';
    ctx.fillText(c.name, c.x + 25, c.y + 5);
  }

  // GLITCH TOKEN: "SolidGoldMagikarp" (Flung into anomalous negative vector)
  const glitchX = originX - 260 + (isGlitched ? (Math.random() * 8 - 4) : 0);
  const glitchY = originY + 190 + (isGlitched ? (Math.random() * 8 - 4) : 0);

  // Warning pulse aura
  const auraR = 40 + Math.sin(t * 8) * 15;
  ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
  ctx.beginPath();
  ctx.arc(glitchX, glitchY, auraR, 0, Math.PI * 2);
  ctx.fill();

  // SolidGoldMagikarp Token Box
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(glitchX - 120, glitchY - 45, 240, 65);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.strokeRect(glitchX - 120, glitchY - 45, 240, 65);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('"SolidGoldMagikarp"', glitchX, glitchY - 15);
  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 13px NotoSans';
  ctx.fillText('TOKEN #43597 (UNTRAINED)', glitchX, glitchY + 10);

  // Anomaly Vector Line from Center
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(glitchX, glitchY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Right Side: Glitch Inspection Console
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fillRect(1080, 220, 720, 535);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.strokeRect(1080, 220, 720, 535);

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 22px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('ANOMALY DIAGNOSTIC LEDGER', 1120, 270);

  const DIAG = [
    '• Tokenizer: Trained on raw Reddit internet dump',
    '• Username appeared > 10,000 times in Reddit forums',
    '• BPE assigned permanent vocabulary index #43597',
    '• Training Phase: Reddit was FILTERED out of dataset!',
    '• Result: Neural weight dial was NEVER updated during SGD',
    '• Embedding: Negative dot-product anomaly (Hallucination trigger)'
  ];

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '16px NotoSans';
  for (let i = 0; i < DIAG.length; i++) {
    ctx.fillText(DIAG[i], 1120, 320 + i * 45);
  }

  // Magi with Inspection Staff & Lantern
  const magiX = 960, magiGroundY = 880;
  drawGroundShadow(ctx, magiX, magiGroundY, 65, 18, 0.5);

  const breath = idleBreath(t, 18);
  const blink = blinkState(t, 8192);

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

  // Eyes (wide curious eyes)
  if (!blink) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(magiX - 6, headY - 2, 3, 0, Math.PI * 2);
    ctx.arc(magiX + 6, headY - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(magiX - 9, headY - 2);
    ctx.lineTo(magiX - 3, headY - 2);
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

  // Legs standing
  ctx.beginPath();
  ctx.moveTo(magiX, hipY);
  ctx.lineTo(magiX - 12, magiGroundY);
  ctx.moveTo(magiX, hipY);
  ctx.lineTo(magiX + 12, magiGroundY);
  ctx.stroke();

  // Left arm holding staff pointing towards the glitch token
  const staffTargetX = magiX - 180, staffTargetY = torsoY - 20;
  const lArm = solve2BoneIK([magiX, torsoY], [staffTargetX + 60, staffTargetY + 40], 45, 45, 1);

  ctx.beginPath();
  ctx.moveTo(magiX, torsoY);
  ctx.lineTo(lArm[1][0], lArm[1][1]);
  ctx.lineTo(staffTargetX + 60, staffTargetY + 40);
  ctx.stroke();

  // Staff
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(staffTargetX + 60, staffTargetY + 40);
  ctx.lineTo(staffTargetX, staffTargetY);
  ctx.stroke();

  // Bottom Key Takeaway HUD
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(400, 920, 1120, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE GHOSTS IN THE MACHINE: Glitch Tokens from Unaligned Scrapes', 960, 960);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('When vocabulary building and neural training datasets diverge, untuned vector landmines emerge.', 960, 990);

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
