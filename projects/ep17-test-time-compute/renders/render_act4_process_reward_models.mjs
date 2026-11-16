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
const VOICE = path.resolve('projects/ep17-test-time-compute/build/narration/act4.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP17-Act4-ProcessRewardModels-1080p.mp4');
const SFX_FILE = '/tmp/ep17_act4_sfx.wav';
const MIX_FILE = '/tmp/ep17_act4_mix.wav';

console.log(`=== EP17 ACT 4: PROCESS REWARD MODELS (STEP-BY-STEP VERIFICATION) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 58291;
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

  // Factory conveyor belt low rumble
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 70 * t) + noise() * 0.08) * 0.18,
    (t) => (Math.sin(2 * Math.PI * 72 * t) + noise() * 0.08) * 0.18,
    0.25
  );

  // Step-by-step scanner laser pulses (t = 8.0 to 45.0)
  for (let s = 8.0; s < 45.0; s += 2.2) {
    addStereo(s, 0.15,
      (t) => Math.sin(2 * Math.PI * 1760 * t) * Math.exp(-t * 20),
      (t) => Math.sin(2 * Math.PI * 1770 * t) * Math.exp(-t * 20),
      0.35
    );
  }

  // Error detection buzz at t = 28.0s (Step 14 error flagged)
  addStereo(28.0, 1.8,
    (t) => (Math.sin(2 * Math.PI * 180 * t) + Math.sin(2 * Math.PI * 185 * t)) * 0.4,
    (t) => (Math.sin(2 * Math.PI * 180 * t) + Math.sin(2 * Math.PI * 185 * t)) * 0.4,
    0.50
  );

  // PRM truth calibration chime at t = 52.0s
  addStereo(52.0, 3.5,
    (t) => Math.sin(2 * Math.PI * 1046 * t) * Math.exp(-t * 1.5),
    (t) => Math.sin(2 * Math.PI * 1052 * t) * Math.exp(-t * 1.5),
    0.45
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

  // Background: Deep Industrial Verification Lab
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(0.5, '#0b132c');
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

  // 1. COMPARISON HEADER: ORM vs PRM (Lightman et al. 2023)
  ctx.save();
  ctx.translate(100, 120);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, 800, 180, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('OPENAI 2023: PROCESS-SUPERVISED REWARD MODELS (PRM)', 30, 36);

  // ORM pill (left)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(30, 60, 350, 100, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 17px NotoSans, sans-serif';
  ctx.fillText('OUTCOME REWARD MODEL (ORM)', 45, 90);
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('• Grades ONLY final answer at the end', 45, 118);
  ctx.fillText('• Credit Assignment Trap: Lucky errors rewarded', 45, 142);

  // PRM pill (right)
  ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(410, 60, 360, 100, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 17px NotoSans, sans-serif';
  ctx.fillText('PROCESS REWARD MODEL (PRM)', 425, 90);
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('• Grades EVERY individual deduction step', 425, 118);
  ctx.fillText('• Pinpoints exact moment of failure!', 425, 142);
  ctx.restore();

  // 2. MATHEMATICAL PROOF CONVEYOR BELT (Middle Screen)
  const convY = 480;
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.rect(80, convY, 1760, 140);
  ctx.fill();
  ctx.stroke();

  // Moving conveyor rollers
  for (let rx = 100; rx < 1840; rx += 50) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, convY);
    ctx.lineTo(rx, convY + 140);
    ctx.stroke();
  }

  // 5 Deduction Steps on the Conveyor
  const proofSteps = [
    { num: 'Step 1', text: 'Let n be an integer', score: '+0.95', valid: true },
    { num: 'Step 2', text: 'Assume n^2 is even', score: '+0.92', valid: true },
    { num: 'Step 3', text: 'n = 2k + 1 (Contrapositive)', score: '+0.88', valid: true },
    { num: 'Step 4', text: 'n^2 = 4k^2 + 4k + 2 (Slip!)', score: (t >= 28.0 ? '-0.91 ❌' : '+0.40'), valid: (t < 28.0) },
    { num: 'Step 5', text: 'Conclusion: Proved', score: (t >= 28.0 ? '0.00' : '+0.90'), valid: (t < 28.0) }
  ];

  for (let i = 0; i < proofSteps.length; i++) {
    const ps = proofSteps[i];
    const bx = 160 + i * 330;
    const by = convY + 15;

    ctx.fillStyle = ps.valid ? 'rgba(30, 41, 59, 0.95)' : 'rgba(239, 68, 68, 0.95)';
    ctx.strokeStyle = ps.valid ? '#38bdf8' : '#ffffff';
    ctx.lineWidth = ps.valid ? 2 : 3;
    ctx.beginPath();
    ctx.roundRect(bx, by, 300, 110, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = ps.valid ? '#38bdf8' : '#ffffff';
    ctx.font = 'bold 15px NotoSans, sans-serif';
    ctx.fillText(ps.num, bx + 16, by + 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText(ps.text, bx + 16, by + 62);

    // PRM Score Badge
    ctx.fillStyle = ps.valid ? '#10b981' : '#fef08a';
    ctx.font = 'bold 15px NotoSans, sans-serif';
    ctx.fillText(`PRM: ${ps.score}`, bx + 16, by + 92);

    // Scanner Laser Beam from Above
    const laserX = bx + 150;
    const isScanning = Math.floor(t * 1.5) % proofSteps.length === i;
    if (isScanning || (!ps.valid && i === 3)) {
      ctx.strokeStyle = ps.valid ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(laserX, 320);
      ctx.lineTo(laserX, by);
      ctx.stroke();
    }
  }

  // 3. STICKMAN MAGI ON LEFT (Safety Inspector)
  const magiX = 320, magiY = 760;
  drawGroundShadow(ctx, magiX, magiY, 70);

  const breath = Math.sin(t * 2.5) * 2.0;

  const figure = {
    head: { x: magiX, y: 430 + breath, radius: 34, tilt: 0.1 },
    body: {
      spine: [
        { x: magiX, y: 464 + breath },
        { x: magiX + 2, y: 525 + breath * 0.8 },
        { x: magiX + 4, y: 590 }
      ],
      width: 6
    },
    leftArm: {
      ik: {
        target: { x: magiX - 45, y: 570 },
        pole: { x: magiX - 35, y: 510 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: 580, y: 490 }, // Pointing to PRM conveyor
        pole: { x: magiX + 45, y: 510 }
      },
      upperLength: 68,
      lowerLength: 72
    },
    leftLeg: {
      ik: {
        target: { x: magiX + 35, y: magiY },
        pole: { x: magiX + 45, y: 670 }
      },
      upperLength: 85,
      lowerLength: 88
    },
    rightLeg: {
      ik: {
        target: { x: magiX - 35, y: magiY },
        pole: { x: magiX - 25, y: 670 }
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
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 780, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 11 • PROCESS REWARD MODELS (STEP-BY-STEP VERIFICATION)', 105, 74);

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
      console.log(`\n🎉 ACT 4 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
