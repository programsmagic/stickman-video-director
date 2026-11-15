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
const VOICE = path.resolve('projects/ep10-geometry-of-thinking/build/narration/act1.wav');
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP10-Act1-MountainInFog-1080p.mp4');
const SFX_FILE = '/tmp/ep10_act1_sfx.wav';
const MIX_FILE = '/tmp/ep10_act1_mix.wav';

console.log(`=== EP10 ACT 1: THE MOUNTAIN IN THE FOG ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// ----------------------------------------------------------------------------
// 1. PROCEDURAL 48 kHz STEREO FOLEY SYNTHESIS
// ----------------------------------------------------------------------------
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
        const dt = i / rate;
        left[i0 + i] += fnL(dt) * gain;
        right[i0 + i] += fnR(dt) * gain;
      }
    }
  };

  // 1. Continuous deep mountain thunderstorm wind (0 - dur)
  addStereo(0.0, dur,
    t => (noise() * 0.08 + Math.sin(2 * Math.PI * 45 * t) * 0.12) * Math.min(1, t * 2) * Math.min(1, dur - t),
    t => (noise() * 0.08 + Math.sin(2 * Math.PI * 48 * t) * 0.12) * Math.min(1, t * 2) * Math.min(1, dur - t),
    0.28
  );

  // 2. Distant Thunder Rumbles (8.0s & 28.0s)
  [8.0, 28.0].forEach((st, idx) => {
    addStereo(st, 4.0,
      t => (noise() * Math.exp(-t * 0.8) * Math.sin(t * 12) + Math.sin(2 * Math.PI * 55 * t) * 0.4) * Math.exp(-t * 0.7),
      t => (noise() * Math.exp(-t * 0.8) * Math.sin(t * 12 + 0.5) + Math.sin(2 * Math.PI * 52 * t) * 0.4) * Math.exp(-t * 0.7),
      0.55
    );
  });

  // 3. Falling loose gravel cascade into the abyss (17.5s)
  addStereo(17.5, 3.0,
    t => (noise() * Math.exp(-t * 2.5) * (Math.sin(t * 80) > 0 ? 1 : 0) + Math.sin(2 * Math.PI * 180 * t) * 0.2) * Math.exp(-t * 1.5),
    t => (noise() * Math.exp(-t * 2.5) * (Math.sin(t * 85) > 0 ? 1 : 0) + Math.sin(2 * Math.PI * 175 * t) * 0.2) * Math.exp(-t * 1.5),
    0.45
  );

  // 4. Lantern chain clinks (3.0s, 12.0s, 22.0s, 38.0s)
  [3.0, 12.0, 22.0, 38.0].forEach(st => {
    addStereo(st, 0.4,
      t => Math.sin(2 * Math.PI * 1420 * t) * Math.exp(-t * 14),
      t => Math.sin(2 * Math.PI * 1450 * t) * Math.exp(-t * 14),
      0.22
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

  // Mix Foley + Voice with FFmpeg
  execSync(`ffmpeg -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.6[s];[v][s]amix=inputs=2:duration=first[out]" -map "[out]" -ar 48000 -ac 2 "${MIX_FILE}"`);
  console.log(`  ✅ Mixed audio track complete: ${MIX_FILE}`);
}

// ----------------------------------------------------------------------------
// 2. 1080P MASTER CANVAS RENDERING & FFMPEG PIPE
// ----------------------------------------------------------------------------
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

// Mountain peak geometry
const RIDGE_POINTS = [
  [120, 840],
  [380, 810],
  [650, 780],
  [880, 770], // Magi stands here
  [1150, 790],
  [1450, 820],
  [1800, 870]
];

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background: Deep Storm Night sky
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#090D16');
  bg.addColorStop(0.6, '#0F172A');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Distant Lightning Flash at 8.0s and 28.0s
  const lightning1 = Math.exp(-Math.abs(t - 8.2) * 12) * 0.45;
  const lightning2 = Math.exp(-Math.abs(t - 28.3) * 14) * 0.50;
  const flashAlpha = Math.max(0, lightning1 + lightning2);
  if (flashAlpha > 0.05) {
    ctx.save();
    ctx.fillStyle = `rgba(186, 230, 253, ${flashAlpha})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }

  // 3D Topographic Contour Wireframes (The 700B-D Loss Landscape)
  ctx.save();
  ctx.lineWidth = 2;
  for (let c = 0; c < 7; c++) {
    const cy = 600 + c * 55;
    const alpha = 0.08 + (c / 7) * 0.18;
    ctx.strokeStyle = '#38BDF8';
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(WIDTH / 2 + 100, cy, 780 + c * 60, 180 + c * 35, 0.05, 0, Math.PI * 2);
    ctx.stroke();

    // Dimension indicators
    if (c % 2 === 0) {
      ctx.font = '14px NotoSans';
      ctx.fillStyle = '#60A5FA';
      ctx.globalAlpha = alpha * 1.4;
      ctx.fillText(`Dimension θ_${c * 100 + 42} · Loss = ${(8.4 - c * 0.9).toFixed(1)}`, 220 + c * 40, cy - 8);
    }
  }
  ctx.restore();

  // Mountain Cliff Ridge
  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  ctx.lineTo(0, RIDGE_POINTS[0][1]);
  RIDGE_POINTS.forEach(([rx, ry]) => ctx.lineTo(rx, ry));
  ctx.lineTo(WIDTH, RIDGE_POINTS[RIDGE_POINTS.length - 1][1]);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Falling gravel cascade after 17.5s step
  if (t >= 17.5 && t <= 22.0) {
    const gProg = (t - 17.5);
    ctx.fillStyle = '#94A3B8';
    for (let g = 0; g < 14; g++) {
      const gx = 880 + (g % 3) * 12 + Math.sin(g * 5) * 8;
      const gy = 770 + gProg * 140 + g * 18;
      if (gy < HEIGHT) {
        ctx.beginPath();
        ctx.arc(gx, gy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // Rolling Fog Layers
  ctx.save();
  for (let fl = 0; fl < 4; fl++) {
    const fogY = 700 + fl * 60;
    const fogShift = Math.sin(t * 0.4 + fl) * 40;
    const fogGrad = ctx.createLinearGradient(0, fogY - 40, 0, fogY + 60);
    fogGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
    fogGrad.addColorStop(0.5, `rgba(30, 41, 59, ${0.18 + fl * 0.05})`);
    fogGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, fogY - 40, WIDTH, 100);
  }
  ctx.restore();

  // Grounding shadow under Magi
  const magiBaseX = 850 + (t >= 17.0 ? Math.min(30, (t - 17.0) * 18) : 0);
  const magiBaseY = 740;
  drawGroundShadow(ctx, magiBaseX, magiBaseY + 120, 95, 22, 0.45);

  // Character Magi with blindfold & lantern
  const breath = idleBreath(t, 14);
  const r = 90;

  // Cautious positioning:
  // 0 - 17s: Standing cautiously holding lantern
  // 17 - 22s: Step forward, gravel falls
  // 22 - 50s: Looking down with lantern raised, realizing the immense scale
  let torsoAngle = breath.torsoDelta + 2;
  let targetArmL = [magiBaseX - 80, magiBaseY - 20]; // Holding lantern
  let targetArmR = [magiBaseX + 60, magiBaseY + 40];

  if (t >= 17.0 && t < 22.0) {
    torsoAngle += 4;
    targetArmL = [magiBaseX - 100, magiBaseY - 40];
  } else if (t >= 22.0) {
    torsoAngle += 6;
    targetArmL = [magiBaseX - 110, magiBaseY - 70]; // Lantern lifted high
  }

  // Draw Figure
  drawFigure(ctx, {
    torso: torsoAngle,
    head: 6,
    facing: 'right',
    eyes: 'closed', // Blindfolded
    mouth: 'flat',
    scarf: true,
    accessory: 'wizard-hat',
    targetArmL: [targetArmL[0] - magiBaseX, targetArmL[1] - magiBaseY],
    targetArmR: [targetArmR[0] - magiBaseX, targetArmR[1] - magiBaseY],
    legL: [-12, -6],
    legR: [14, 10]
  }, {
    x: magiBaseX,
    y: magiBaseY + breath.hipYDelta,
    r: r,
    seed: 88
  });

  // Black Blindfold across eyes
  ctx.save();
  ctx.translate(magiBaseX, magiBaseY + breath.hipYDelta);
  ctx.fillStyle = '#020617';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-r * 0.4, -r * 1.15, r * 0.9, r * 0.24, 4);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Glowing Brass Lantern
  const lx = targetArmL[0], ly = targetArmL[1];
  ctx.save();
  // Radial illumination
  const lampGlow = ctx.createRadialGradient(lx, ly, 10, lx, ly, 380);
  lampGlow.addColorStop(0, 'rgba(254, 240, 138, 0.4)');
  lampGlow.addColorStop(0.5, 'rgba(254, 240, 138, 0.1)');
  lampGlow.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = lampGlow;
  ctx.beginPath();
  ctx.arc(lx, ly, 380, 0, Math.PI * 2);
  ctx.fill();

  // Lantern body
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(lx, ly, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();

  // --- TOP HUD HEADERS (1080P CLEAN EDITORIAL) ---
  ctx.save();
  ctx.font = '24px CaveatHand';
  ctx.fillStyle = '#94A3B8';
  ctx.textAlign = 'center';
  ctx.fillText('PROGRAMS MAGIC · THE GEOMETRY OF THINKING (EPISODE 04)', WIDTH / 2, 46);

  ctx.font = 'bold 30px NotoSans';
  ctx.fillStyle = '#F8FAFC';
  ctx.fillText('ACT 1: THE MOUNTAIN IN THE FOG — A 700-BILLION-DIMENSIONAL ASCENT', WIDTH / 2, 92);

  ctx.font = '20px NotoSans';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('Loss Function L(θ): Error Between Neural Prediction and Reality', WIDTH / 2, 130);
  ctx.restore();

  // Stream raw buffer
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
    console.log(`Act 1 1080p Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 1 1080p Render Complete! Output: ${OUTPUT}`);
