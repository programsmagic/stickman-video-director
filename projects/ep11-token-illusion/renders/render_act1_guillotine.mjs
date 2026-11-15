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
const VOICE = path.resolve('projects/ep11-token-illusion/build/narration/act1.wav');

// Wait if voice is still synthesizing
while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP11-Act1-WordGuillotine-1080p.mp4');
const SFX_FILE = '/tmp/ep11_act1_sfx.wav';
const MIX_FILE = '/tmp/ep11_act1_mix.wav';

console.log(`=== EP11 ACT 1: THE WOODEN WORD GUILLOTINE ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 41902;
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

  // Mechanical press background rhythm
  for (let c = 0; c < Math.floor(dur / 1.8); c++) {
    const tc = c * 1.8;
    // Rhythmic clack
    addStereo(tc, 0.15,
      (t) => Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 25) + noise() * 0.15 * Math.exp(-t * 30),
      (t) => Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 25) + noise() * 0.15 * Math.exp(-t * 30),
      0.25
    );
  }

  // Periodic heavy guillotine chops (every 3.6s)
  for (let chop = 0; chop < Math.floor(dur / 3.6); chop++) {
    const tch = 2.0 + chop * 3.6;
    // Blade descending whoosh
    addStereo(tch - 0.25, 0.25,
      (t) => noise() * Math.sin(Math.PI * t / 0.25) * 0.3,
      (t) => noise() * Math.sin(Math.PI * t / 0.25) * 0.3,
      0.25
    );
    // Heavy metal guillotine slam & wooden thud
    addStereo(tch, 0.45,
      (t) => (Math.sin(2 * Math.PI * 90 * Math.exp(-t * 10) * t) + noise() * 0.6) * Math.exp(-t * 12),
      (t) => (Math.sin(2 * Math.PI * 95 * Math.exp(-t * 10) * t) + noise() * 0.6) * Math.exp(-t * 12),
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

  // Deep Workshop Industrial Gradient Background
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#0a0e1a');
  grad.addColorStop(0.5, '#0f172a');
  grad.addColorStop(1, '#050811');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Technical blueprint grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // HUD Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('ACT I: THE WOODEN WORD GUILLOTINE', 100, 90);
  ctx.fillStyle = '#f59e0b';
  ctx.font = '22px NotoSans';
  ctx.fillText('The Tokenizer · The Invisible Layer Where Letters Disappear into Numbers', 100, 126);

  // Conveyor Belt Base
  const beltY = 620;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(150, beltY, 1620, 40);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  ctx.strokeRect(150, beltY, 1620, 40);

  // Conveyor rollers
  for (let rx = 180; rx < 1750; rx += 90) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(rx, beltY + 20, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Input Ribbon (Left of blade: Continuous Letters)
  const chopCycle = (t * 0.8) % 1.0;
  const bladeX = 960;
  const bladeY = 320 + Math.pow(Math.sin(chopCycle * Math.PI), 8) * 260; // Sharp drop

  // Left incoming text ribbon
  const inScroll = (t * 120) % 360;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(200, beltY - 60, 720, 50);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(200, beltY - 60, 720, 50);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 28px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('S T R A W B E R R Y   U N B E L I E V A B L E', 220 - inScroll, beltY - 25);
  ctx.fillText('S T R A W B E R R Y   U N B E L I E V A B L E', 220 - inScroll + 650, beltY - 25);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px NotoSans';
  ctx.fillText('HUMAN INPUT (CONTINUOUS LETTERS)', 200, beltY - 75);

  // Heavy Guillotine Rig
  // Guillotine side pillars
  ctx.fillStyle = '#334155';
  ctx.fillRect(bladeX - 60, 200, 25, 460);
  ctx.fillRect(bladeX + 35, 200, 25, 460);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 4;
  ctx.strokeRect(bladeX - 60, 200, 25, 460);
  ctx.strokeRect(bladeX + 35, 200, 25, 460);

  // Crossbeam
  ctx.fillRect(bladeX - 80, 180, 160, 30);
  ctx.strokeRect(bladeX - 80, 180, 160, 30);

  // Moving Blade (Brass & Steel)
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(bladeX - 45, bladeY);
  ctx.lineTo(bladeX + 45, bladeY);
  ctx.lineTo(bladeX + 45, bladeY + 40);
  ctx.lineTo(bladeX - 45, bladeY + 70); // angled razor edge
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Sparks at cut point when blade drops
  if (bladeY > 560) {
    for (let s = 0; s < 12; s++) {
      const spX = bladeX + (s - 6) * 8;
      const spY = beltY - 10 - Math.random() * 30;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(spX, spY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Right of Blade: Output Chunky Wooden Jigsaw Puzzle Blocks
  const BLOCKS = [
    { label: 'straw', token: 'Token #1832', x: 1060 },
    { label: 'berry', token: 'Token #7421', x: 1240 },
    { label: 'un', token: 'Token #482', x: 1420 },
    { label: 'believ', token: 'Token #9120', x: 1540 }
  ];

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 16px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('AI TOKENS (NUMBERED PUZZLE BLOCKS)', 1060, beltY - 75);

  for (let i = 0; i < BLOCKS.length; i++) {
    const b = BLOCKS[i];
    const bx = b.x + Math.sin(t * 3 + i) * 8;
    const by = beltY - 60;

    // Wooden Block Body
    ctx.fillStyle = '#b45309';
    ctx.fillRect(bx, by, 140, 50);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, 140, 50);

    // Jigsaw knob
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(bx + 140, by + 25, 12, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.stroke();

    // Text on Block
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText(`"${b.label}"`, bx + 70, by + 26);

    ctx.fillStyle = '#fef08a';
    ctx.font = '13px NotoSans';
    ctx.fillText(b.token, bx + 70, by + 44);
  }

  // Magi Inspecting with Magnifying Glass
  const magiX = 1450, magiGroundY = 880;
  drawGroundShadow(ctx, magiX, magiGroundY, 65, 18, 0.45);

  const breath = idleBreath(t, 18);
  const blink = blinkState(t, 2981);

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

  // Eyes (blinking)
  if (!blink) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(magiX - 4, headY - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(magiX - 7, headY - 2);
    ctx.lineTo(magiX - 1, headY - 2);
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
  ctx.lineTo(magiX - 15, magiGroundY);
  ctx.moveTo(magiX, hipY);
  ctx.lineTo(magiX + 15, magiGroundY);
  ctx.stroke();

  // Left arm holding magnifying glass up towards the wooden block
  const lensTargetX = magiX - 110;
  const lensTargetY = torsoY - 40;
  const lArm = solve2BoneIK([magiX, torsoY], [lensTargetX, lensTargetY], 45, 45, 1);

  ctx.beginPath();
  ctx.moveTo(magiX, torsoY);
  ctx.lineTo(lArm[1][0], lArm[1][1]);
  ctx.lineTo(lensTargetX, lensTargetY);
  ctx.stroke();

  // Magnifying Glass Prop
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(lensTargetX, lensTargetY, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.fill();

  // Lens handle
  ctx.beginPath();
  ctx.moveTo(lensTargetX + 22, lensTargetY + 22);
  ctx.lineTo(lensTargetX + 45, lensTargetY + 45);
  ctx.stroke();

  // Zoomed Inspection View in Lens
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 15px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('NO LETTERS', lensTargetX, lensTargetY - 5);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('#1832', lensTargetX, lensTargetY + 14);

  // Right arm resting on hip
  const rArm = solve2BoneIK([magiX, torsoY], [magiX + 30, hipY], 40, 40, -1);
  ctx.beginPath();
  ctx.moveTo(magiX, torsoY);
  ctx.lineTo(rArm[1][0], rArm[1][1]);
  ctx.lineTo(magiX + 30, hipY);
  ctx.stroke();

  // Formula / Key Insight HUD Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(400, 920, 1120, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('TOKENIZATION:  Text  ➔  Subword Chunks  ➔  Vocabulary Integer IDs', 960, 960);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('To a transformer, individual letters do not exist. Words are atomic puzzle blocks.', 960, 990);

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
