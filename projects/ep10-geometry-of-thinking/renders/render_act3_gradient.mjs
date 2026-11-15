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
const VOICE = path.resolve('projects/ep10-geometry-of-thinking/build/narration/act3.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP10-Act3-GradientDescent-1080p.mp4');
const SFX_FILE = '/tmp/ep10_act3_sfx.wav';
const MIX_FILE = '/tmp/ep10_act3_mix.wav';

console.log(`=== EP10 ACT 3: GRADIENT DESCENT & THE ALTIMETER ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 58219;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };

  const addStereo = (t0, len, fnL, fnR, gain = 0.3) => {
    const i0 = Math.round(t0 * rate);
    const cnt = Math.min(n - i0, Math.round(len * rate));
    for (let i = 0; i < cnt; i++) {
      if (i0 + i >= 0 && i0 + i < n) {
        const dt = i / rate;
        left[i0 + i] += fnL(dt) * gain;
        right[i0 + i] += fnR(dt) * gain;
      }
    }
  };

  // Ambient mountain wind (0 - dur)
  addStereo(0.0, dur,
    t => (noise() * 0.06 + Math.sin(2 * Math.PI * 60 * t) * 0.08) * Math.min(1, t * 2) * Math.min(1, dur - t),
    t => (noise() * 0.06 + Math.sin(2 * Math.PI * 62 * t) * 0.08) * Math.min(1, t * 2) * Math.min(1, dur - t),
    0.22
  );

  // Staff plant resonant clang at 4.5s
  addStereo(4.5, 3.0,
    t => (Math.sin(2 * Math.PI * 523.25 * t) + Math.sin(2 * Math.PI * 1046.5 * t) * 0.4) * Math.exp(-t * 2.2),
    t => (Math.sin(2 * Math.PI * 523.25 * t) + Math.sin(2 * Math.PI * 1046.5 * t) * 0.4) * Math.exp(-t * 2.2),
    0.65
  );

  // Wild leap overshoot whoosh and cliff bounce impact (22.0s)
  addStereo(22.0, 1.2,
    t => noise() * Math.sin((t / 1.2) * Math.PI),
    t => noise() * Math.sin((t / 1.2) * Math.PI),
    0.45
  );
  addStereo(22.8, 1.5,
    t => Math.sin(2 * Math.PI * 160 * t) * Math.exp(-t * 5),
    t => Math.sin(2 * Math.PI * 160 * t) * Math.exp(-t * 5),
    0.55
  );

  // Optimal smooth descent glide chime (36.0s)
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
    addStereo(36.0 + idx * 0.25, 1.5,
      t => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 2.5),
      t => Math.sin(2 * Math.PI * (freq * 1.008) * t) * Math.exp(-t * 2.5),
      0.35
    );
  });

  // Write Stereo WAV
  const sampleCount = n * 2;
  const wavBuf = Buffer.alloc(44 + sampleCount * 2);
  wavBuf.write('RIFF', 0); wavBuf.writeUInt32LE(36 + sampleCount * 2, 4);
  wavBuf.write('WAVE', 8); wavBuf.write('fmt ', 12);
  wavBuf.writeUInt32LE(16, 16); wavBuf.writeUInt16LE(1, 20); // PCM
  wavBuf.writeUInt16LE(2, 22); wavBuf.writeUInt32LE(rate, 24); // Stereo 48kHz
  wavBuf.writeUInt32LE(rate * 4, 28); wavBuf.writeUInt16LE(4, 32);
  wavBuf.writeUInt16LE(16, 34); wavBuf.write('data', 36);
  wavBuf.writeUInt32LE(sampleCount * 2, 40);

  let offset = 44;
  for (let i = 0; i < n; i++) {
    const sl = Math.max(-1, Math.min(1, left[i]));
    const sr = Math.max(-1, Math.min(1, right[i]));
    wavBuf.writeInt16LE(Math.round(sl * 32767), offset);
    wavBuf.writeInt16LE(Math.round(sr * 32767), offset + 2);
    offset += 4;
  }
  fs.writeFileSync(SFX_FILE, wavBuf);

  execSync(`ffmpeg -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.55[s];[v][s]amix=inputs=2:duration=first[out]" -map "[out]" -ar 48000 -ac 2 "${MIX_FILE}"`);
  console.log(`  ✅ Mixed audio track complete: ${MIX_FILE}`);
}

// 2. 1080P RENDERING PIPELINE
console.log('• Launching 1080p FFmpeg encoding pipeline...');
const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'rawvideo',
  '-pix_fmt', 'rgba',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-r', `${FPS}`,
  '-i', 'pipe:0',
  '-i', MIX_FILE,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '17',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-ar', '48000',
  '-b:a', '256k',
  '-movflags', '+faststart',
  OUTPUT
]);

ffmpeg.stderr.on('data', () => {});
ffmpeg.on('close', code => {
  if (code !== 0) console.error(`FFmpeg exited with code ${code}`);
});

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#0F172A');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Cross-sectional Valley Hill Slope (Parabolic Valley)
  ctx.save();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 100; x <= WIDTH - 100; x += 10) {
    const normX = (x - WIDTH / 2) / 750;
    const y = 880 - (1 - normX * normX) * 400;
    if (x === 100) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Valley fill
  ctx.lineTo(WIDTH - 100, HEIGHT);
  ctx.lineTo(100, HEIGHT);
  ctx.closePath();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.fill();
  ctx.restore();

  // Global Minimum Basin at Valley Floor
  const valleyFloorX = WIDTH / 2;
  const valleyFloorY = 880;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(valleyFloorX, valleyFloorY, 50, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#F59E0B';
  ctx.shadowColor = '#F59E0B';
  ctx.shadowBlur = 20;
  ctx.fill();

  ctx.font = 'bold 20px NotoSans';
  ctx.fillStyle = '#FDE047';
  ctx.textAlign = 'center';
  ctx.fillText('MINIMUM θ*', valleyFloorX, valleyFloorY + 45);
  ctx.restore();

  // Interactive Learning Rate Dial Display Card
  ctx.save();
  const cardX = 1450, cardY = 240, cardW = 380, cardH = 220;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 20px NotoSans';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('LEARNING RATE DIAL (η)', cardX + 30, cardY + 45);

  let lrValue = '0.01 (Optimal)';
  let lrColor = '#22C55E';
  if (t >= 15.0 && t < 28.0) {
    lrValue = '1.50 (Too High! Overshoot!)';
    lrColor = '#EF4444';
  } else if (t >= 28.0 && t < 35.0) {
    lrValue = '0.0001 (Too Low! Frozen)';
    lrColor = '#F59E0B';
  }

  ctx.font = 'bold 24px NotoSans';
  ctx.fillStyle = lrColor;
  ctx.fillText(lrValue, cardX + 30, cardY + 95);

  // Update formula in card
  ctx.font = '18px NotoSans';
  ctx.fillStyle = '#E2E8F0';
  ctx.fillText('Step Size: Δθ = −η · ∇L(θ)', cardX + 30, cardY + 145);
  ctx.fillText('Direction: Opposite of steepest slope', cardX + 30, cardY + 180);
  ctx.restore();

  // Magi Hiker Animation on Slope
  // Position calculated from slope
  let magiSlopeX = 350;
  if (t >= 18.0 && t < 26.0) {
    // Overshoot: leap across to opposite cliff!
    const leapT = Math.min(1.0, (t - 18.0) / 1.5);
    magiSlopeX = 350 + leapT * 1200;
  } else if (t >= 26.0 && t < 35.0) {
    // Tiny baby step back on left slope
    magiSlopeX = 400;
  } else if (t >= 35.0) {
    // Smooth descent to bottom
    const pDesc = Math.min(1.0, (t - 35.0) / 7.0);
    magiSlopeX = 400 + pDesc * (valleyFloorX - 400);
  }

  const normX = (magiSlopeX - WIDTH / 2) / 750;
  const magiSlopeY = 880 - (1 - normX * normX) * 400 - 80;

  drawGroundShadow(ctx, magiSlopeX, magiSlopeY + 110, 85, 20, 0.45);

  const breath = idleBreath(t, 16);
  const blink = blinkState(t, 11);
  const r = 85;

  drawFigure(ctx, {
    torso: 4 + breath.torsoDelta,
    head: 6,
    facing: magiSlopeX > valleyFloorX ? 'left' : 'right',
    eyes: blink,
    mouth: t >= 18.0 && t < 26.0 ? 'open' : 'smile',
    scarf: true,
    accessory: 'wizard-hat',
    targetArmL: [-40, 20],
    targetArmR: [70, 40], // Holding surveyor compass staff
    legL: [-10, -5],
    legR: [14, 10]
  }, {
    x: magiSlopeX,
    y: magiSlopeY + breath.hipYDelta,
    r: r,
    seed: 94
  });

  // Gradient Vector Arrow beneath Magi's feet pointing downhill
  ctx.save();
  const dirSign = magiSlopeX < valleyFloorX ? 1 : -1;
  ctx.strokeStyle = '#FBBF24';
  ctx.fillStyle = '#FBBF24';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(magiSlopeX, magiSlopeY + 110);
  ctx.lineTo(magiSlopeX + dirSign * 110, magiSlopeY + 110);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(magiSlopeX + dirSign * 110, magiSlopeY + 110);
  ctx.lineTo(magiSlopeX + dirSign * 90, magiSlopeY + 98);
  ctx.lineTo(magiSlopeX + dirSign * 90, magiSlopeY + 122);
  ctx.closePath();
  ctx.fill();

  ctx.font = 'bold 20px NotoSans';
  ctx.fillText('−∇L(θ)', magiSlopeX + dirSign * 55, magiSlopeY + 95);
  ctx.restore();

  // TOP HUD
  ctx.save();
  ctx.font = '24px CaveatHand';
  ctx.fillStyle = '#94A3B8';
  ctx.textAlign = 'center';
  ctx.fillText('PROGRAMS MAGIC · THE GEOMETRY OF THINKING (EPISODE 04)', WIDTH / 2, 46);

  ctx.font = 'bold 30px NotoSans';
  ctx.fillStyle = '#F8FAFC';
  ctx.fillText('ACT 3: THE COMPASS OF INTELLIGENCE — GRADIENT DESCENT', WIDTH / 2, 92);

  ctx.font = '20px NotoSans';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('θ(t+1) = θ(t) − η · ∇L(θ)  ·  Tuning the Learning Rate η', WIDTH / 2, 130);
  ctx.restore();

  // Stream raw buffer
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
    console.log(`Act 3 1080p Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 3 1080p Render Complete! Output: ${OUTPUT}`);
