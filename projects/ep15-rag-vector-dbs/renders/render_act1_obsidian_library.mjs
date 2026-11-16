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
const VOICE = path.resolve('projects/ep15-rag-vector-dbs/build/narration/act1.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP15-Act1-ObsidianLibrary-1080p.mp4');
const SFX_FILE = '/tmp/ep15_act1_sfx.wav';
const MIX_FILE = '/tmp/ep15_act1_mix.wav';

console.log(`=== EP15 ACT 1: THE INFINITE OBSIDIAN LIBRARY ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 48291;
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

  // Ambient library drone
  addStereo(0.5, dur - 1.0,
    (t) => Math.sin(2 * Math.PI * 55 * t) * 0.12,
    (t) => Math.sin(2 * Math.PI * 56 * t) * 0.12,
    0.20
  );

  // Books rustling & heavy book thuds (t = 8.0s to 18.0s)
  addStereo(8.0, 1.2,
    (t) => (noise() * 0.4 + Math.sin(2 * Math.PI * 180 * t) * 0.3) * Math.exp(-t * 6),
    (t) => (noise() * 0.4 + Math.sin(2 * Math.PI * 185 * t) * 0.3) * Math.exp(-t * 6),
    0.40
  );
  addStereo(14.0, 1.5,
    (t) => (noise() * 0.5 + Math.sin(2 * Math.PI * 140 * t) * 0.4) * Math.exp(-t * 5),
    (t) => (noise() * 0.5 + Math.sin(2 * Math.PI * 145 * t) * 0.4) * Math.exp(-t * 5),
    0.45
  );

  // Funnel glass creak & alarm pulse (t = 24.0s to 38.0s)
  addStereo(24.0, 14.0,
    (t) => Math.sin(2 * Math.PI * (880 + 200 * Math.sin(t * 8)) * t) * (0.3 + 0.1 * Math.sin(t * 4)),
    (t) => Math.sin(2 * Math.PI * (884 + 200 * Math.sin(t * 8)) * t) * (0.3 + 0.1 * Math.cos(t * 4)),
    0.28
  );

  // High-tech RAG memory chip hum & laser lock (t = 44.0s)
  addStereo(44.0, 3.5,
    (t) => (Math.sin(2 * Math.PI * 1440 * t) + Math.sin(2 * Math.PI * 2880 * t) * 0.3) * Math.exp(-t * 1.5),
    (t) => (Math.sin(2 * Math.PI * 1445 * t) + Math.sin(2 * Math.PI * 2890 * t) * 0.3) * Math.exp(-t * 1.5),
    0.50
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

  // Background: Obsidian Void with glowing blue-amber library shelves
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#040712');
  bg.addColorStop(0.5, '#070e24');
  bg.addColorStop(1, '#03050c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Background perspective grid floor
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -400; x <= WIDTH + 400; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 620);
    ctx.lineTo((x - 960) * 2.8 + 960, HEIGHT);
    ctx.stroke();
  }
  for (let y = 620; y <= HEIGHT; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Left Background: Towering Obsidian Library Shelves
  const shelfX = 140;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(shelfX, 100, 360, 560, 8);
  ctx.fill();
  ctx.stroke();

  // Books on shelves with varied glowing colors
  for (let row = 0; row < 5; row++) {
    const ry = 130 + row * 105;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(shelfX + 10, ry + 85);
    ctx.lineTo(shelfX + 350, ry + 85);
    ctx.stroke();

    for (let col = 0; col < 12; col++) {
      const bx = shelfX + 25 + col * 26;
      const bH = 65 + Math.sin(col * 3.7 + row) * 12;
      const bookColors = ['#38bdf8', '#818cf8', '#f59e0b', '#10b981', '#ec4899'];
      ctx.fillStyle = bookColors[(col + row * 3) % bookColors.length];
      ctx.fillRect(bx, ry + 85 - bH, 20, bH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(bx + 4, ry + 85 - bH, 2, bH);
    }
  }

  // Shelf header
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText('🏛️ WORLD KNOWLEDGE (100M+ DOCS)', shelfX + 25, 125);

  // Center-Right: The LLM Context Window Funnel & Neural Core
  const coreX = 1340, coreY = 560;

  // Pedestal
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(coreX - 160, coreY + 120, 320, 160, 10);
  ctx.fill();
  ctx.stroke();

  // The Glass Funnel
  ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.strokeStyle = t > 22 && t < 40 ? '#ef4444' : 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(coreX - 180, coreY - 260); // Wide top lip
  ctx.lineTo(coreX + 180, coreY - 260);
  ctx.lineTo(coreX + 50, coreY - 40);   // Narrow throat
  ctx.lineTo(coreX + 50, coreY + 60);
  ctx.lineTo(coreX - 50, coreY + 60);
  ctx.lineTo(coreX - 50, coreY - 40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Funnel Label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('CONTEXT WINDOW (PROMPT)', coreX - 145, coreY - 280);

  // Silicon Brain inside lower core chamber
  const pulse = Math.sin(t * 6) * 6;
  const brainColor = t > 22 && t < 40 ? '#ef4444' : '#38bdf8';
  ctx.fillStyle = brainColor;
  ctx.beginPath();
  ctx.arc(coreX, coreY + 80, 42 + pulse * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Brain details
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(coreX - 14, coreY + 75, 18, 0, Math.PI * 2);
  ctx.arc(coreX + 14, coreY + 75, 18, 0, Math.PI * 2);
  ctx.stroke();

  // STRESS / OVERLOAD STATE (t = 22s to 42s)
  if (t > 22 && t < 42) {
    const alarmPulse = Math.sin(t * 12) * 0.5 + 0.5;
    // Red emergency glow
    const redGlow = ctx.createRadialGradient(coreX, coreY - 100, 40, coreX, coreY - 100, 300);
    redGlow.addColorStop(0, `rgba(239, 68, 68, ${0.4 * alarmPulse})`);
    redGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = redGlow;
    ctx.beginPath();
    ctx.arc(coreX, coreY - 100, 300, 0, Math.PI * 2);
    ctx.fill();

    // Jammed floating pages in throat
    for (let p = 0; p < 8; p++) {
      const py = coreY - 180 + p * 24 + Math.sin(t * 8 + p) * 6;
      const px = coreX - 40 + (p % 3) * 25;
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.fillRect(px, py, 35, 22);
      ctx.strokeRect(px, py, 35, 22);
    }

    // Warning Banner
    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.beginPath();
    ctx.roundRect(coreX - 220, coreY - 370, 440, 54, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px NotoSans, sans-serif';
    ctx.fillText('⚠️ ATTENTION OVERLOAD: O(N²)', coreX - 190, coreY - 335);

    // Lost in the middle notice
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 18px NotoSans, sans-serif';
    ctx.fillText('⚡ LOST IN THE MIDDLE PHENOMENON', coreX - 165, coreY + 220);
  } else if (t >= 42) {
    // RESOLUTION: Sleek RAG External Memory Card docked
    const chipX = 960, chipY = 380;
    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(chipX - 120, chipY - 60, 240, 120, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px NotoSans, sans-serif';
    ctx.fillText('EXTERNAL MEMORY', chipX - 100, chipY - 15);
    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.fillText('RAG: NON-PARAMETRIC INDEX', chipX - 105, chipY + 20);

    // Laser bridge connecting External Memory directly into Brain
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    ctx.moveTo(chipX + 120, chipY);
    ctx.lineTo(coreX - 50, coreY + 60);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 3. STICKMAN MAGI (IK Kinematics)
  const breath = idleBreath(frame);
  const blink = blinkState(frame);

  // Position and action states
  let magiX = 720;
  let magiY = 720;
  let headTilt = 0;
  let armL_target = { x: 800, y: 560 };
  let armR_target = { x: 640, y: 580 };

  if (t < 18) {
    // Walking towards funnel carrying heavy stack of books
    magiX = 520 + (t / 18) * 220;
    headTilt = 0.1;
    armL_target = { x: magiX + 70, y: 530 + breath };
    armR_target = { x: magiX + 40, y: 560 + breath };
  } else if (t >= 18 && t < 38) {
    // Shoving books, then wiping brow / looking shocked
    magiX = 740;
    headTilt = -0.15;
    armL_target = { x: coreX - 140, y: coreY - 180 + Math.sin(t * 8) * 15 };
    armR_target = { x: magiX - 40, y: 360 + breath }; // scratching head
  } else {
    // Proudly presenting the RAG External Memory Card
    magiX = 700;
    headTilt = 0.2;
    armL_target = { x: 860, y: 380 }; // pointing to card
    armR_target = { x: 620, y: 540 };
  }

  drawGroundShadow(ctx, magiX, magiY, 70);

  // Carried book stack during t < 18
  if (t < 18) {
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = b % 2 === 0 ? '#38bdf8' : '#f59e0b';
      ctx.fillRect(magiX + 45, 520 - b * 16 + breath, 50, 14);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(magiX + 45, 520 - b * 16 + breath, 50, 14);
    }
  }

  const figure = {
    head: { x: magiX, y: 360 + breath, radius: 34, tilt: headTilt },
    body: {
      spine: [
        { x: magiX, y: 394 + breath },
        { x: magiX - 2, y: 460 + breath * 0.8 },
        { x: magiX - 5, y: 540 }
      ],
      width: 6
    },
    leftArm: {
      ik: {
        target: armL_target,
        pole: { x: magiX + 60, y: 450 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: armR_target,
        pole: { x: magiX - 60, y: 450 }
      },
      upperLength: 65,
      lowerLength: 68
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

  // Title Banner Top
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 580, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 09 • THE CONTEXT WINDOW TRAP', 105, 74);

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
