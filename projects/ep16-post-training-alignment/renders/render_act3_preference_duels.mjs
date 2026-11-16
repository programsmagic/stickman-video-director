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
const VOICE = path.resolve('projects/ep16-post-training-alignment/build/narration/act3.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP16-Act3-PreferenceDuels-1080p.mp4');
const SFX_FILE = '/tmp/ep16_act3_sfx.wav';
const MIX_FILE = '/tmp/ep16_act3_mix.wav';

console.log(`=== EP16 ACT 3: PREFERENCE DUELS & THE REWARD MODEL ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 34912;
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

  // Arena tournament murmur & hum
  addStereo(0.5, dur - 1.0,
    (t) => Math.sin(2 * Math.PI * 75 * t) * 0.12,
    (t) => Math.sin(2 * Math.PI * 77 * t) * 0.12,
    0.20
  );

  // Judge scorecard stamp at t = 12.0s (Winner stamp)
  addStereo(12.0, 0.8,
    (t) => (noise() * 0.6 + Math.sin(2 * Math.PI * 180 * t) * 0.5) * Math.exp(-t * 9),
    (t) => (noise() * 0.6 + Math.sin(2 * Math.PI * 185 * t) * 0.5) * Math.exp(-t * 9),
    0.45
  );

  // Winner bell chime at t = 16.0s
  addStereo(16.0, 2.0,
    (t) => Math.sin(2 * Math.PI * 1568 * t) * Math.exp(-t * 4),
    (t) => Math.sin(2 * Math.PI * 1573 * t) * Math.exp(-t * 4),
    0.50
  );

  // Reward Model neural calculation hum (t = 26.0s to 42.0s)
  addStereo(26.0, 16.0,
    (t) => (Math.sin(2 * Math.PI * (660 + 100 * Math.sin(t * 5)) * t) + noise() * 0.05) * 0.25,
    (t) => (Math.sin(2 * Math.PI * (665 + 100 * Math.sin(t * 5)) * t) + noise() * 0.05) * 0.25,
    0.35
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

  // Background: Cyber Arena Indigo & Navy
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#040714');
  bg.addColorStop(0.5, '#0d152d');
  bg.addColorStop(1, '#050917');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 680);
    ctx.lineTo((x - 960) * 2.3 + 960, HEIGHT);
    ctx.stroke();
  }
  for (let y = 680; y <= HEIGHT; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Left Side: Pairwise Candidate Responses (Duel)
  const dX = 400, dY = 380;

  // Response A (Winner yw)
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(dX - 240, dY - 190, 480, 150, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText('RESPONSE A (WINNER: yw)', dX - 220, dY - 160);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px monospace';
  ctx.fillText('"Photosynthesis converts solar photons into"', dX - 220, dY - 130);
  ctx.fillText('glucose via chlorophyll in the thylakoid membrane."', dX - 220, dY - 108);

  // Green Winner Stamp
  ctx.save();
  ctx.translate(dX + 160, dY - 140);
  ctx.rotate(-0.1);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-45, -16, 90, 32);
  ctx.fillStyle = '#10b981';
  ctx.font = '900 14px NotoSans, sans-serif';
  ctx.fillText('CHOSEN', -32, 6);
  ctx.restore();

  // Response B (Loser yl)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(dX - 240, dY - 20, 480, 150, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText('RESPONSE B (LOSER: yl)', dX - 220, dY + 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px monospace';
  ctx.fillText('"Plants eat sunshine and make sugar or whatever.', dX - 220, dY + 40);
  ctx.fillText('I am the smartest AI ever. Ask something else!"', dX - 220, dY + 62);

  // Red Rejected Stamp
  ctx.save();
  ctx.translate(dX + 160, dY + 30);
  ctx.rotate(0.12);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-50, -16, 100, 32);
  ctx.fillStyle = '#ef4444';
  ctx.font = '900 13px NotoSans, sans-serif';
  ctx.fillText('REJECTED', -35, 6);
  ctx.restore();

  // Right Side: The Bradley-Terry Reward Model Critic & Score Meter
  const rX = 1380, rY = 400;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(rX - 240, rY - 210, 480, 440, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('BRADLEY-TERRY REWARD MODEL r_ψ(x, y)', rX - 200, rY - 175);

  // Bradley-Terry Probability Formula
  ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(rX - 210, rY - 140, 420, 65, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '16px monospace';
  ctx.fillText('P(yw > yl) = σ( r(x, yw) - r(x, yl) )', rX - 180, rY - 100);

  // Analog Dual Reward Gauge / Sliders
  // Winner Score Bar
  ctx.fillStyle = '#334155';
  ctx.fillRect(rX - 210, rY - 40, 420, 32);
  const winWidth = Math.min(360, 200 + t * 4);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(rX - 210, rY - 40, winWidth, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('r(x, yw) = +8.42 (REWARD WINNER)', rX - 195, rY - 18);

  // Loser Score Bar
  ctx.fillStyle = '#334155';
  ctx.fillRect(rX - 210, rY + 15, 420, 32);
  const loseWidth = 80;
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(rX - 210, rY + 15, loseWidth, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('r(x, yl) = -3.81 (PENALIZED)', rX - 195, rY + 37);

  // Training Objective Summary Box
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(rX - 210, rY + 70, 420, 130, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('REWARD MODEL CRITERIA:', rX - 190, rY + 98);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px monospace';
  ctx.fillText('• Rewards: Factual clarity, safety, honesty', rX - 190, rY + 124);
  ctx.fillText('• Penalizes: Hallucination, toxicity, arrogance', rX - 190, rY + 148);
  ctx.fillText('• Scales exponentially across 100k+ human pairs', rX - 190, rY + 172);

  // 3. Stickman Magi in Center as the Preference Judge
  const magiX = 870, magiY = 720;
  const breath = Math.sin(t * 2.5) * 2.0;

  drawGroundShadow(ctx, magiX, magiY, 70);

  const figure = {
    head: { x: magiX, y: 390 + breath, radius: 34, tilt: 0.1 },
    body: {
      spine: [
        { x: magiX, y: 424 + breath },
        { x: magiX - 2, y: 485 + breath * 0.8 },
        { x: magiX - 4, y: 550 }
      ],
      width: 6
    },
    leftArm: {
      ik: {
        target: { x: dX + 180, y: dY - 110 }, // Stamping Winner card
        pole: { x: magiX - 45, y: 460 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: rX - 160, y: rY - 30 }, // Pointing to reward meter
        pole: { x: magiX + 45, y: 460 }
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
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 700, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 10 • PREFERENCE DUELS & BRADLEY-TERRY REWARD MODEL', 105, 74);

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
      console.log(`\n🎉 ACT 3 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
