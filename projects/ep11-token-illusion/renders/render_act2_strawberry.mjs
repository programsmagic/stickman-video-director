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
const VOICE = path.resolve('projects/ep11-token-illusion/build/narration/act2.wav');

// Wait if voice is still synthesizing
while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP11-Act2-StrawberryParadox-1080p.mp4');
const SFX_FILE = '/tmp/ep11_act2_sfx.wav';
const MIX_FILE = '/tmp/ep11_act2_mix.wav';

console.log(`=== EP11 ACT 2: THE STRAWBERRY PARADOX ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 61928;
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

  // Gameshow tension drone
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    left[i] += Math.sin(2 * Math.PI * 65 * t) * 0.02;
    right[i] += Math.sin(2 * Math.PI * 66 * t) * 0.02;
  }

  // Gameshow wrong buzzer at t = 3.2s
  addStereo(3.2, 0.75,
    (t) => (Math.sin(2 * Math.PI * 140 * t) + Math.sin(2 * Math.PI * 175 * t)) * Math.exp(-t * 2.5),
    (t) => (Math.sin(2 * Math.PI * 142 * t) + Math.sin(2 * Math.PI * 177 * t)) * Math.exp(-t * 2.5),
    0.65
  );

  // Chalkboard taps at t = 10s, 16s, 24s
  const chalkTimes = [10.0, 16.0, 24.0, 32.0];
  for (const tc of chalkTimes) {
    addStereo(tc, 0.06,
      (t) => (noise() * Math.exp(-t * 50) + Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 40)),
      (t) => (noise() * Math.exp(-t * 50) + Math.sin(2 * Math.PI * 2220 * t) * Math.exp(-t * 40)),
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

  // Gameshow Stage Lighting Gradient
  const grad = ctx.createRadialGradient(WIDTH / 2, 450, 80, WIDTH / 2, 450, 950);
  grad.addColorStop(0, '#172554');
  grad.addColorStop(0.5, '#0f172a');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // HUD Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('ACT II: THE STRAWBERRY PARADOX', 100, 90);
  ctx.fillStyle = '#ef4444';
  ctx.font = '22px NotoSans';
  ctx.fillText('Why 1,000,000,000,000 Parameters Fail a 1st-Grade Spelling Test', 100, 126);

  // Central Chalkboard / Display Screen
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(480, 200, 960, 420);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(480, 200, 960, 420);

  // The Big Question
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('TEST PROMPT: "HOW MANY R\'S ARE IN STRAWBERRY?"', 960, 260);

  // Full Word Representation (Top)
  const letters = ['S', 't', 'r', 'a', 'w', 'b', 'e', 'r', 'r', 'y'];
  const startX = 660;
  for (let i = 0; i < letters.length; i++) {
    const lx = startX + i * 60;
    const isR = letters[i].toLowerCase() === 'r';
    ctx.fillStyle = isR ? '#f59e0b' : '#334155';
    ctx.fillRect(lx - 25, 300, 50, 60);
    ctx.strokeStyle = isR ? '#fbbf24' : '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(lx - 25, 300, 50, 60);

    ctx.fillStyle = isR ? '#ffffff' : '#e2e8f0';
    ctx.font = 'bold 32px NotoSans';
    ctx.fillText(letters[i], lx, 342);

    if (isR) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 14px NotoSans';
      ctx.fillText('R', lx, 385);
    }
  }

  // Tokenizer Split Dissection (Bottom of chalkboard)
  // Arrow pointing down
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(960, 410);
  ctx.lineTo(960, 450);
  ctx.stroke();

  // Block 1: "straw"
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(660, 470, 260, 90);
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 3;
  ctx.strokeRect(660, 470, 260, 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px NotoSans';
  ctx.fillText('"straw"', 790, 510);
  ctx.fillStyle = '#93c5fd';
  ctx.font = '16px NotoSans';
  ctx.fillText('TOKEN ID: 1832', 790, 540);

  // Plus sign
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.fillText('+', 960, 525);

  // Block 2: "berry"
  ctx.fillStyle = '#831843';
  ctx.fillRect(1000, 470, 260, 90);
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 3;
  ctx.strokeRect(1000, 470, 260, 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px NotoSans';
  ctx.fillText('"berry"', 1130, 510);
  ctx.fillStyle = '#fbcfe8';
  ctx.font = '16px NotoSans';
  ctx.fillText('TOKEN ID: 7421', 1130, 540);

  // AI Robot Mascot behind Buzzer Podium (Right Side)
  const robotX = 1620, robotGroundY = 880;
  drawGroundShadow(ctx, robotX, robotGroundY, 70, 20, 0.5);

  // Podium
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(robotX - 60, robotGroundY - 140, 120, 140);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  ctx.strokeRect(robotX - 60, robotGroundY - 140, 120, 140);

  // Giant Red Buzzer on Podium
  const buzzerPressed = t >= 3.0 && t <= 5.0;
  ctx.fillStyle = buzzerPressed ? '#dc2626' : '#ef4444';
  ctx.beginPath();
  ctx.ellipse(robotX, robotGroundY - 140 - (buzzerPressed ? 5 : 15), 35, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Robot Body
  ctx.fillStyle = '#475569';
  ctx.fillRect(robotX - 35, robotGroundY - 240, 70, 90);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(robotX - 35, robotGroundY - 240, 70, 90);

  // Robot Head
  ctx.fillStyle = '#334155';
  ctx.fillRect(robotX - 30, robotGroundY - 305, 60, 55);
  ctx.strokeRect(robotX - 30, robotGroundY - 305, 60, 55);

  // Robot Eyes (flashing red on wrong answer)
  ctx.fillStyle = buzzerPressed ? '#ef4444' : '#38bdf8';
  ctx.fillRect(robotX - 20, robotGroundY - 290, 15, 12);
  ctx.fillRect(robotX + 5, robotGroundY - 290, 15, 12);

  // Speech bubble from robot shouting "TWO!"
  if (t >= 3.2 && t <= 9.0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(robotX - 160, robotGroundY - 420, 180, 80, 16);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.font = '900 42px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('TWO! ❌', robotX - 70, robotGroundY - 365);
  }

  // Magi with Pointer Staff on Left
  const magiX = 320, magiGroundY = 880;
  drawGroundShadow(ctx, magiX, magiGroundY, 60, 16, 0.45);

  const breath = idleBreath(t, 18);
  const blink = blinkState(t, 5192);

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

  // Right arm pointing teaching pointer at the chalkboard
  const pointerTargetX = 520, pointerTargetY = 480;
  const rArm = solve2BoneIK([magiX, torsoY], [pointerTargetX - 90, pointerTargetY + 50], 45, 45, -1);

  ctx.beginPath();
  ctx.moveTo(magiX, torsoY);
  ctx.lineTo(rArm[1][0], rArm[1][1]);
  ctx.lineTo(pointerTargetX - 90, pointerTargetY + 50);
  ctx.stroke();

  // Pointer Staff
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pointerTargetX - 90, pointerTargetY + 50);
  ctx.lineTo(pointerTargetX, pointerTargetY);
  ctx.stroke();

  // Left arm on hip
  const lArm = solve2BoneIK([magiX, torsoY], [magiX - 30, hipY], 40, 40, 1);
  ctx.beginPath();
  ctx.moveTo(magiX, torsoY);
  ctx.lineTo(lArm[1][0], lArm[1][1]);
  ctx.lineTo(magiX - 30, hipY);
  ctx.stroke();

  // Bottom Key Takeaway Banner
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
  ctx.fillText('WHY AI CANNOT COUNT LETTERS: Subword Token Blindness', 960, 960);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('"straw" + "berry" are opaque numerical IDs. The model never receives character-level input.', 960, 990);

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
