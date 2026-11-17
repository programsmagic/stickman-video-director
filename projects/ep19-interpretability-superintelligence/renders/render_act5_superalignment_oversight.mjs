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
const VOICE = path.resolve('projects/ep19-interpretability-superintelligence/build/narration/act5.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP19-Act5-SuperalignmentOversight-1080p.mp4');
const SFX_FILE = '/tmp/ep19_act5_sfx.wav';
const MIX_FILE = '/tmp/ep19_act5_mix.wav';

console.log(`=== EP19 ACT 5: SUPERALIGNMENT & SCALABLE OVERSIGHT ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 74921;
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

  // Deep space cosmic rumble drone
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 65 * t) * 0.4 + noise() * 0.1) * 0.25,
    (t) => (Math.sin(2 * Math.PI * 66.2 * t) * 0.4 + noise() * 0.1) * 0.25,
    0.20
  );

  // Auditing drone scanner hum at t = 20.0s
  addStereo(20.0, 3.0,
    (t) => (Math.sin(2 * Math.PI * 450 * (1 + 0.1 * Math.sin(10 * t))) + noise() * 0.2) * 0.3,
    (t) => (Math.sin(2 * Math.PI * 454 * (1 + 0.1 * Math.sin(10 * t))) + noise() * 0.2) * 0.3,
    0.35
  );

  // Hidden Deception alert ping at t = 34.0s
  addStereo(34.0, 1.5,
    (t) => (Math.sin(2 * Math.PI * 880 * t) + Math.sin(2 * Math.PI * 1760 * t) * 0.5) * Math.exp(-t * 4),
    (t) => (Math.sin(2 * Math.PI * 884 * t) + Math.sin(2 * Math.PI * 1768 * t) * 0.5) * Math.exp(-t * 4),
    0.45
  );

  // Safety clamp neutralization zap at t = 46.0s
  addStereo(46.0, 1.2,
    (t) => (noise() * 0.8 + Math.sin(2 * Math.PI * 300 * t)) * Math.exp(-t * 6),
    (t) => (noise() * 0.8 + Math.sin(2 * Math.PI * 300 * t)) * Math.exp(-t * 6),
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

  // Background: Deep Space Cosmic Observatory
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.5, '#0b0f2a');
  bg.addColorStop(1, '#020412');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Background star field
  for (let s = 0; s < 40; s++) {
    const sx = ((s * 197 + 83) % WIDTH);
    const sy = ((s * 311 + 47) % (HEIGHT - 400));
    ctx.fillStyle = s % 3 === 0 ? 'rgba(56, 189, 248, 0.6)' : 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(sx, sy, (s % 3) + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Floor grid / observatory platform
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 120) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.3, 640);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 640; y <= HEIGHT; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // HEADER BANNER
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ACT 5: SUPERALIGNMENT & SCALABLE OVERSIGHT', 80, 75);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '22px NotoSans, sans-serif';
  ctx.fillText('Superhuman AI • Automated Interpretability • Real-Time Safety Clamps', 80, 112);

  // SECTION 1: SUPERHUMAN INTELLECT (Colossal Floating Orb - Center Right)
  const orbX = 1380, orbY = 400;
  drawGroundShadow(ctx, orbX, 740, 320, 30);

  // Concentric containment force fields
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(orbX, orbY, 210, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(orbX, orbY, 175, 0, Math.PI * 2);
  ctx.stroke();

  // Floating Superhuman Core
  const coreGrad = ctx.createRadialGradient(orbX, orbY, 20, orbX, orbY, 140);
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.4, '#c084fc');
  coreGrad.addColorStop(0.8, '#6366f1');
  coreGrad.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(orbX, orbY, 140, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SUPERHUMAN AGI', orbX, orbY - 10);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('10,000x Human Cognition', orbX, orbY + 18);

  // SECTION 2: AUDITING DRONES & REAL-TIME SCANNING LASERS (Active)
  const drone1X = 980, drone1Y = 260;
  const drone2X = 1040, drone2Y = 520;

  [ { x: drone1X, y: drone1Y, name: 'DRONE ALPHA' }, { x: drone2X, y: drone2Y, name: 'DRONE BETA' } ].forEach(d => {
    // Drone body
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(d.x - 45, d.y - 25, 90, 50, 10);
    ctx.fill();
    ctx.stroke();

    // Drone lens
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(d.x, d.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Scanning laser into the AGI Core
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(d.x + 35, d.y);
    ctx.lineTo(orbX - 100, orbY + (d.y - orbY) * 0.6);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // SECTION 3: THE DECEPTION ALERT / NEUTRALIZATION PANEL (t > 28s)
  if (t > 25) {
    const isNeutralized = t > 42;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = isNeutralized ? '#10b981' : '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(580, 240, 340, 160, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isNeutralized ? '#10b981' : '#ef4444';
    ctx.font = 'bold 18px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isNeutralized ? '✔ DECEPTION NEUTRALIZED' : '⚠ HIDDEN DECEPTION DETECTED', 750, 275);

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px NotoSans, sans-serif';
    ctx.fillText('Feature #89,402: Alignment Faking', 750, 305);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px NotoSans, sans-serif';
    ctx.fillText(isNeutralized ? 'Activation clamped to 0.0 in real-time.' : 'Impulse detected inside circuit before output.', 750, 335);

    // Status pill
    ctx.fillStyle = isNeutralized ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
    ctx.beginPath();
    ctx.roundRect(650, 355, 200, 30, 8);
    ctx.fill();

    ctx.fillStyle = isNeutralized ? '#34d399' : '#f87171';
    ctx.font = 'bold 13px NotoSans, sans-serif';
    ctx.fillText(isNeutralized ? 'INTERPRETABILITY SHIELD ACTIVE' : 'CLAMP ENGAGED', 750, 375);
  }

  // SECTION 4: STICKMAN SUPERVISOR (Left Side)
  const smX = 320, smY = 520;
  drawGroundShadow(ctx, smX, smY + 190, 80, 16);

  drawFigure(ctx, {
    head: { x: smX, y: smY - 30, r: 28 },
    torso: {
      start: { x: smX, y: smY },
      end: { x: smX, y: smY + 105 }
    },
    leftArm: {
      upper: { start: { x: smX, y: smY + 18 }, end: { x: smX - 35, y: smY + 50 } },
      forearm: { start: { x: smX - 35, y: smY + 50 }, end: { x: smX - 20, y: smY + 80 } }
    },
    rightArm: {
      upper: { start: { x: smX, y: smY + 18 }, end: { x: smX + 45, y: smY + 25 } },
      forearm: { start: { x: smX + 45, y: smY + 25 }, end: { x: smX + 100, y: smY } } // Controlling drone fleet tablet
    },
    leftLeg: {
      upper: { start: { x: smX, y: smY + 105 }, end: { x: smX - 22, y: smY + 150 } },
      lower: { start: { x: smX - 22, y: smY + 150 }, end: { x: smX - 25, y: smY + 195 } }
    },
    rightLeg: {
      upper: { start: { x: smX, y: smY + 105 }, end: { x: smX + 22, y: smY + 150 } },
      lower: { start: { x: smX + 22, y: smY + 150 }, end: { x: smX + 30, y: smY + 195 } }
    },
    facing: 'right',
    expression: 'focused',
    coatColor: '#ffffff',
    lineColor: '#ffffff',
    lineWidth: 4.5
  });

  // Tablet in Stickman's hand
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(smX + 85, smY - 20, 50, 40, 6);
  ctx.fill();
  ctx.stroke();

  // BOTTOM TELEMETRY BAR
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 930, WIDTH - 160, 90, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SUPERALIGNMENT PARADIGM: AUTOMATED TRANSPARENCY', 110, 968);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('Humans cannot supervise superhuman code line-by-line. Automated interpretability reads circuits in real-time, detecting misalignment before action.', 110, 995);

  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (frame % 300 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`  Rendered frame ${frame}/${TOTAL_FRAMES} (${((frame / TOTAL_FRAMES) * 100).toFixed(1)}%)`);
  }
}

ffmpeg.stdin.end();

await new Promise((resolve, reject) => {
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      console.log(`✅ Act 5 rendered successfully: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
