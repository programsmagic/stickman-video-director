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
  drawGroundShadow
} from '../../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1920, HEIGHT = 1080, FPS = 30;
const VOICE = path.resolve('projects/ep17-test-time-compute/build/narration/act3.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP17-Act3-ThoughtScratchpad-1080p.mp4');
const SFX_FILE = '/tmp/ep17_act3_sfx.wav';
const MIX_FILE = '/tmp/ep17_act3_mix.wav';

console.log(`=== EP17 ACT 3: INSIDE THE <THOUGHT> SCRATCHPAD ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 38192;
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

  // Glass chamber optical hum
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 110 * t) + 0.3 * Math.sin(2 * Math.PI * 220 * t)) * 0.15,
    (t) => (Math.sin(2 * Math.PI * 111 * t) + 0.3 * Math.sin(2 * Math.PI * 222 * t)) * 0.15,
    0.22
  );

  // Rapid internal token stream typing (t = 8.0 to 25.0)
  for (let s = 8.0; s < 25.0; s += 0.22) {
    addStereo(s, 0.08,
      (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 1800 * t)) * Math.exp(-t * 40),
      (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 1820 * t)) * Math.exp(-t * 40),
      0.30
    );
  }

  // Backtracking eraser / strikethrough whoosh at t = 36.0s
  addStereo(36.0, 1.2,
    (t) => (noise() * 0.6 + Math.sin(2 * Math.PI * (600 - t * 200) * t)) * Math.exp(-t * 2.5),
    (t) => (noise() * 0.6 + Math.sin(2 * Math.PI * (610 - t * 200) * t)) * Math.exp(-t * 2.5),
    0.40
  );

  // Verification crystal chime at t = 48.0s
  addStereo(48.0, 3.5,
    (t) => Math.sin(2 * Math.PI * 1318 * t) * Math.exp(-t * 1.5),
    (t) => Math.sin(2 * Math.PI * 1324 * t) * Math.exp(-t * 1.5),
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

  // Background: Cyber Glass Observation Lab
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030718');
  bg.addColorStop(0.5, '#0b1432');
  bg.addColorStop(1, '#020512');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.25, 580);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 580; y <= HEIGHT; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // 1. TRANSPARENT MODEL CHAMBER (Center-Right)
  const chamX = 700, chamY = 160, chamW = 1120, chamH = 620;
  drawGroundShadow(ctx, chamX + chamW / 2, 800, chamW * 0.45, 26);

  // Glass chamber frame
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(chamX, chamY, chamW, chamH, 18);
  ctx.fill();
  ctx.stroke();

  // Header Bar: <thought> tokens tag
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.fillRect(chamX, chamY, chamW, 55);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(chamX, chamY + 55);
  ctx.lineTo(chamX + chamW, chamY + 55);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('<thought> INTERNAL MONOLOGUE & SCRATCHPAD ENCLOSURE </thought>', chamX + 30, chamY + 36);

  // Internal Thought Steps Scaffolding (Dynamic Token Blocks)
  const steps = [
    { title: 'Sub-Goal 1: Deconstruct Word Problem', code: 'x = ball_price, bat_price = x + 1.00', status: 'valid', tShow: 4.0 },
    { title: 'Sub-Goal 2: Total Sum Equation', code: 'x + (x + 1.00) = 1.10  =>  2x + 1.00 = 1.10', status: 'valid', tShow: 10.0 },
    { title: 'Hypothesis A (System 1 Intuitive Guess)', code: 'Assume x = 0.10  =>  bat = 1.10  =>  Total = $1.20 != $1.10 ❌', status: 'backtrack', tShow: 18.0 },
    { title: 'Self-Reflection & Error Detection', code: '"Wait, that contradicts total sum! Backtracking hypothesis A..."', status: 'reflection', tShow: 28.0 },
    { title: 'Correct Algebraic Deduction', code: '2x = 1.10 - 1.00  =>  2x = 0.10  =>  x = $0.05 ✅', status: 'verified', tShow: 38.0 },
    { title: 'Final Verified Output to User', code: 'Emit: "The ball costs $0.05, and the bat costs $1.05."', status: 'emitted', tShow: 46.0 }
  ];

  let sy = chamY + 80;
  for (const s of steps) {
    if (t >= s.tShow) {
      let bColor = '#38bdf8', bgColor = 'rgba(56, 189, 248, 0.12)';
      if (s.status === 'backtrack') {
        bColor = '#f43f5e';
        bgColor = 'rgba(244, 63, 94, 0.15)';
      } else if (s.status === 'reflection') {
        bColor = '#f59e0b';
        bgColor = 'rgba(245, 158, 11, 0.18)';
      } else if (s.status === 'verified' || s.status === 'emitted') {
        bColor = '#10b981';
        bgColor = 'rgba(16, 185, 129, 0.18)';
      }

      ctx.fillStyle = bgColor;
      ctx.strokeStyle = bColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(chamX + 30, sy, chamW - 60, 68, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = bColor;
      ctx.font = 'bold 15px NotoSans, sans-serif';
      ctx.fillText(s.title, chamX + 50, sy + 26);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(s.code, chamX + 50, sy + 52);

      // Strikethrough for backtracked line after t >= 32
      if (s.status === 'backtrack' && t >= 32.0) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(chamX + 45, sy + 50);
        ctx.lineTo(chamX + chamW - 80, sy + 50);
        ctx.stroke();
      }
    }
    sy += 85;
  }

  // 2. STICKMAN MAGI ON LEFT (holding illuminated optical prism)
  const magiX = 360, magiY = 720;
  drawGroundShadow(ctx, magiX, magiY, 70);

  const breath = Math.sin(t * 2.5) * 2.0;

  const figure = {
    head: { x: magiX, y: 390 + breath, radius: 34, tilt: 0.15 },
    body: {
      spine: [
        { x: magiX, y: 424 + breath },
        { x: magiX + 2, y: 485 + breath * 0.8 },
        { x: magiX + 4, y: 550 }
      ],
      width: 6
    },
    leftArm: {
      ik: {
        target: { x: magiX - 45, y: 530 },
        pole: { x: magiX - 35, y: 470 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: magiX + 85, y: 450 }, // Holding optical prism towards chamber
        pole: { x: magiX + 45, y: 470 }
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

  // Optical Prism in Hand
  ctx.save();
  ctx.translate(magiX + 85, 450);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -25);
  ctx.lineTo(25, 20);
  ctx.lineTo(-25, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Projected light beam into chamber
  const beamGrad = ctx.createLinearGradient(0, 0, 240, 0);
  beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
  beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(240, -40);
  ctx.lineTo(240, 40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Top Master Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 750, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 11 • INSIDE THE <THOUGHT> SCRATCHPAD (WORKING MEMORY)', 105, 74);

  // Raw bytes write
  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (frame % 150 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`  Frame ${frame}/${TOTAL_FRAMES} (${((frame / TOTAL_FRAMES) * 100).toFixed(1)}%) rendered`);
  }
}

ffmpeg.stdin.end();

await new Promise((resolve, reject) => {
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      console.log(`\n🎉 ACT 3 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
