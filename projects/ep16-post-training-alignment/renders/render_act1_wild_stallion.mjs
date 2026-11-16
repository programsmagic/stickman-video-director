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
const VOICE = path.resolve('projects/ep16-post-training-alignment/build/narration/act1.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP16-Act1-WildStallion-1080p.mp4');
const SFX_FILE = '/tmp/ep16_act1_sfx.wav';
const MIX_FILE = '/tmp/ep16_act1_mix.wav';

console.log(`=== EP16 ACT 1: THE WILD COMPUTATIONAL STALLION ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 12948;
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

  // Arena wind ambient
  addStereo(0.5, dur - 1.0,
    (t) => (noise() * 0.15 + Math.sin(2 * Math.PI * 60 * t) * 0.1) * (0.8 + 0.2 * Math.sin(t * 2)),
    (t) => (noise() * 0.15 + Math.sin(2 * Math.PI * 62 * t) * 0.1) * (0.8 + 0.2 * Math.cos(t * 2)),
    0.22
  );

  // Galloping binary hoofbeats (rhythmic 4-beat gallop)
  for (let g = 0; g < 40; g++) {
    const tg = 3.0 + g * 0.8;
    if (tg < dur - 2.0) {
      addStereo(tg, 0.25,
        (t) => (noise() * 0.6 + Math.sin(2 * Math.PI * 110 * t) * 0.4) * Math.exp(-t * 20),
        (t) => (noise() * 0.6 + Math.sin(2 * Math.PI * 115 * t) * 0.4) * Math.exp(-t * 20),
        0.45
      );
    }
  }

  // Trampled wooden sign crack at t = 20.0s
  addStereo(20.0, 1.2,
    (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 340 * t) * 0.4) * Math.exp(-t * 8),
    (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 345 * t) * 0.4) * Math.exp(-t * 8),
    0.50
  );

  // Cyber stallion electronic whinny at t = 36.0s
  addStereo(36.0, 2.5,
    (t) => (Math.sin(2 * Math.PI * (800 + 400 * Math.sin(t * 12)) * t) + noise() * 0.1) * Math.exp(-t * 2),
    (t) => (Math.sin(2 * Math.PI * (805 + 400 * Math.sin(t * 12)) * t) + noise() * 0.1) * Math.exp(-t * 2),
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

  execSync(`ffmpeg -v error -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v0];[1:a]volume=0.45[v1];[v0][v1]amix=inputs=2:duration=first:dropout_transition=2" -ar 48000 -c:a pcm_s16le "${MIX_FILE}"`);
  console.log(`  ✅ Mixed audio track complete: ${MIX_FILE}`);
}

// 2. VIDEO RENDERING ENGINE (Native 1080p @ 30fps)
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'rawvideo',
  '-pix_fmt', 'rgba',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-r', `${FPS}`,
  '-i', '-',
  '-i', MIX_FILE,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '16',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-shortest',
  OUTPUT
]);

ffmpeg.stderr.on('data', () => {});

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background: Roman Arena Sandstone & Cyber Midnight Sky
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#040714');
  bg.addColorStop(0.5, '#161c2e');
  bg.addColorStop(1, '#0c101c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Colosseum stone amphitheater pillars in distance
  ctx.fillStyle = 'rgba(30, 41, 59, 0.4)';
  for (let p = 0; p < 14; p++) {
    const px = 80 + p * 135;
    ctx.fillRect(px, 340, 65, 280);
    ctx.beginPath();
    ctx.arc(px + 32.5, 340, 32.5, Math.PI, 0);
    ctx.fill();
  }

  // Arena ground floor
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 620);
    ctx.lineTo((x - 960) * 2.3 + 960, HEIGHT);
    ctx.stroke();
  }
  for (let y = 620; y <= HEIGHT; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // The Wild Computational Stallion (Galloping Motion)
  const gallopSpeed = 160;
  // Stallion position loops across arena
  const stallionX = 1350 + Math.sin(t * 1.5) * 180;
  const gallopBob = Math.abs(Math.sin(t * 8)) * 30;
  const stallionY = 560 - gallopBob;

  drawGroundShadow(ctx, stallionX, 720, 110);

  // Stallion Aura
  const sGlow = ctx.createRadialGradient(stallionX, stallionY - 60, 40, stallionX, stallionY - 60, 240);
  sGlow.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
  sGlow.addColorStop(0.6, 'rgba(56, 189, 248, 0.15)');
  sGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sGlow;
  ctx.beginPath();
  ctx.arc(stallionX, stallionY - 60, 240, 0, Math.PI * 2);
  ctx.fill();

  // Draw Computational Stallion Body
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';

  // Torso
  ctx.beginPath();
  ctx.ellipse(stallionX, stallionY - 60, 110, 65, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Neck & Head
  ctx.beginPath();
  ctx.moveTo(stallionX - 80, stallionY - 90);
  ctx.lineTo(stallionX - 130, stallionY - 170);
  ctx.lineTo(stallionX - 170, stallionY - 150);
  ctx.lineTo(stallionX - 190, stallionY - 130);
  ctx.lineTo(stallionX - 150, stallionY - 110);
  ctx.lineTo(stallionX - 90, stallionY - 50);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Eye
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(stallionX - 145, stallionY - 140, 7, 0, Math.PI * 2);
  ctx.fill();

  // Wild Laser Mane
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  for (let m = 0; m < 7; m++) {
    const mAngle = Math.sin(t * 12 + m) * 12;
    ctx.beginPath();
    ctx.moveTo(stallionX - 120 + m * 16, stallionY - 160 + m * 14);
    ctx.lineTo(stallionX - 100 + m * 16 + mAngle, stallionY - 200 + m * 8);
    ctx.stroke();
  }

  // Galloping Legs
  const legCycle = Math.sin(t * 8);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 5;
  // Front legs
  ctx.beginPath();
  ctx.moveTo(stallionX - 80, stallionY - 20);
  ctx.lineTo(stallionX - 100 + legCycle * 40, stallionY + 60);
  ctx.lineTo(stallionX - 80 + legCycle * 50, stallionY + 160);
  ctx.stroke();

  // Hind legs
  ctx.beginPath();
  ctx.moveTo(stallionX + 80, stallionY - 30);
  ctx.lineTo(stallionX + 90 - legCycle * 40, stallionY + 60);
  ctx.lineTo(stallionX + 110 - legCycle * 50, stallionY + 160);
  ctx.stroke();

  // Chaotic Uncontrolled Next-Token Streams Spewing Out
  const streamY = stallionY - 120;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(stallionX - 520, streamY - 80, 480, 80, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('RAW BASE PREDICTION STREAM (UNCONSTRAINED):', stallionX - 505, streamY - 55);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px monospace';
  ctx.fillText('"...was published in 1842 by Oxford Press, see"', stallionX - 505, streamY - 30);
  ctx.fillText('"references in chapter 4... (Next-Token Drift)"', stallionX - 505, streamY - 10);

  // Left Side: Stickman Magi with Instruction Sign
  const magiX = 460, magiY = 720;
  const breath = Math.sin(t * 2.5) * 2.0;

  drawGroundShadow(ctx, magiX, magiY, 70);

  // Instruction Sign (Trampled or held)
  const signHeld = t < 20;
  if (signHeld) {
    // Magi holding the user prompt sign
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(magiX - 180, 400 + breath, 220, 90, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.fillText('USER PROMPT:', magiX - 165, 425 + breath);
    ctx.fillStyle = '#2563eb';
    ctx.font = '15px monospace';
    ctx.fillText('"Explain quantum', magiX - 165, 452 + breath);
    ctx.fillText('mechanics to me."', magiX - 165, 475 + breath);

    // Signpost handle
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(magiX - 70, 490 + breath);
    ctx.lineTo(magiX - 70, 600);
    ctx.stroke();
  } else {
    // Trampled broken sign lying on the arena dirt
    ctx.save();
    ctx.translate(magiX + 160, 690);
    ctx.rotate(0.35);
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(-80, -30, 160, 60);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('PROMPT IGNORED', -65, 5);
    ctx.restore();
  }

  // Stickman figure
  const figure = {
    head: { x: magiX, y: 380 + breath, radius: 34, tilt: signHeld ? 0.05 : -0.15 },
    body: {
      spine: [
        { x: magiX, y: 414 + breath },
        { x: magiX - 2, y: 475 + breath * 0.8 },
        { x: magiX - 4, y: 540 }
      ],
      width: 6
    },
    leftArm: {
      ik: {
        target: signHeld ? { x: magiX - 70, y: 490 + breath } : { x: magiX - 50, y: 390 + breath }, // Scratching head
        pole: { x: magiX - 45, y: 450 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: signHeld ? { x: magiX - 30, y: 490 + breath } : { x: stallionX - 220, y: stallionY }, // Pointing at charging beast
        pole: { x: magiX + 45, y: 450 }
      },
      upperLength: 68,
      lowerLength: 72
    },
    leftLeg: {
      ik: {
        target: { x: magiX + 35, y: magiY },
        pole: { x: magiX + 45, y: 630 }
      },
      upperLength: 85,
      lowerLength: 88
    },
    rightLeg: {
      ik: {
        target: { x: magiX - 35, y: magiY },
        pole: { x: magiX - 25, y: 630 }
      },
      upperLength: 85,
      lowerLength: 88
    },
    accessories: [
      { type: 'glasses', color: '#f59e0b', scale: 1.15 }
    ]
  };

  drawFigure(ctx, figure, {
    color: '#ffffff',
    lineWidth: 5.5,
    fillColor: 'rgba(255,255,255,0.06)'
  });

  // Top Master Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 680, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 10 • THE WILD COMPUTATIONAL STALLION (BASE MODEL)', 105, 74);

  // Raw bytes write
  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (frame % 300 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`  Frame ${frame}/${TOTAL_FRAMES} (${((frame / TOTAL_FRAMES) * 100).toFixed(1)}%) rendered`);
  }
}

ffmpeg.stdin.end();

await new Promise((resolve, reject) => {
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      console.log(`\n🎉 ACT 1 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
