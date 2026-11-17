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
const VOICE = path.resolve('projects/ep19-interpretability-superintelligence/build/narration/act4.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP19-Act4-TransformerCircuitsInduction-1080p.mp4');
const SFX_FILE = '/tmp/ep19_act4_sfx.wav';
const MIX_FILE = '/tmp/ep19_act4_mix.wav';

console.log(`=== EP19 ACT 4: TRANSFORMER CIRCUITS & INDUCTION HEADS ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 62819;
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

  // Clockwork ticking & gear mechanism
  for (let k = 0; k < Math.floor(dur * 2); k++) {
    const dt = k * 0.5;
    addStereo(dt, 0.05,
      (t) => (Math.sin(2 * Math.PI * 2200 * t) + noise() * 0.4) * Math.exp(-t * 80),
      (t) => (Math.sin(2 * Math.PI * 2250 * t) + noise() * 0.4) * Math.exp(-t * 80),
      0.15
    );
  }

  // Token sliding onto circuit track at t = 18.0s
  addStereo(18.0, 0.6,
    (t) => (Math.sin(2 * Math.PI * 650 * t) * Math.exp(-t * 12) + noise() * 0.3 * Math.exp(-t * 10)),
    (t) => (Math.sin(2 * Math.PI * 660 * t) * Math.exp(-t * 12) + noise() * 0.3 * Math.exp(-t * 10)),
    0.40
  );

  // Induction copying spark chime at t = 26.0s
  addStereo(26.0, 1.2,
    (t) => (Math.sin(2 * Math.PI * 987 * t) + Math.sin(2 * Math.PI * 1318 * t) * 0.6) * Math.exp(-t * 4),
    (t) => (Math.sin(2 * Math.PI * 992 * t) + Math.sin(2 * Math.PI * 1324 * t) * 0.6) * Math.exp(-t * 4),
    0.45
  );

  // Phase change electrical surge at t = 44.0s
  addStereo(44.0, 2.5,
    (t) => (Math.sin(2 * Math.PI * 300 * (1 + t * 2)) + noise() * 0.5) * Math.exp(-t * 1.5),
    (t) => (Math.sin(2 * Math.PI * 304 * (1 + t * 2)) + noise() * 0.5) * Math.exp(-t * 1.5),
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

  // Background: Electronic Clockwork Workshop
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(0.5, '#0c1a2e');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.12)';
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
  ctx.fillText('ACT 4: TRANSFORMER CIRCUITS & INDUCTION HEADS', 80, 75);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '22px NotoSans, sans-serif';
  ctx.fillText('Computational Sub-Circuits • In-Context Learning Engine • Phase Changes', 80, 112);

  // SECTION 1: THE TWO-LAYER INDUCTION HEAD CIRCUIT (Left-Center)
  const cX = 180, cY = 220, cW = 760, cH = 460;
  drawGroundShadow(ctx, cX + cW / 2, 710, 360, 24);

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cX, cY, cW, cH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CIRCUIT TOPOLOGY: 2-HEAD INDUCTION MECHANISM', cX + 30, cY + 45);

  // LAYER 1: Previous-Token Head
  const l1Y = cY + 110;
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cX + 30, l1Y, 320, 80, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText('Layer L-1: Previous-Token Head', cX + 45, l1Y + 35);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Outputs token at pos i-1 to pos i', cX + 45, l1Y + 62);

  // LAYER 2: Induction Head
  const l2Y = cY + 230;
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(cX + 30, l2Y, 320, 80, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText('Layer L: Induction Head', cX + 45, l2Y + 35);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Attends [A] earlier -> Predicts [B]', cX + 45, l2Y + 62);

  // Copper connecting bus wire between layers
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cX + 350, l1Y + 40);
  ctx.lineTo(cX + 420, l1Y + 40);
  ctx.lineTo(cX + 420, l2Y + 40);
  ctx.lineTo(cX + 350, l2Y + 40);
  ctx.stroke();

  // TOKEN STREAM TRACK (Bottom of Circuit Box)
  const trackY = cY + 360;
  ctx.fillStyle = '#030712';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cX + 30, trackY, 700, 70, 8);
  ctx.fill();
  ctx.stroke();

  // Tokens: [Harry] [Potter] ... [Harry] -> [Potter]
  const tokens = [
    { text: '[Harry]', x: cX + 50, col: '#38bdf8' },
    { text: '[Potter]', x: cX + 170, col: '#f59e0b' },
    { text: '...', x: cX + 305, col: '#64748b' },
    { text: '[Harry]', x: cX + 410, col: '#38bdf8' },
    { text: '➔ [Potter]', x: cX + 530, col: '#10b981' }
  ];

  tokens.forEach(tk => {
    ctx.fillStyle = tk.col;
    ctx.font = 'bold 20px NotoSans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(tk.text, tk.x, trackY + 42);
  });

  // SECTION 2: OSCILLOSCOPE (Sudden Phase Change & Loss Curve)
  const oscX = 1040, oscY = 220, oscW = 760, oscH = 460;
  drawGroundShadow(ctx, oscX + oscW / 2, 710, 360, 24);

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(oscX, oscY, oscW, oscH, 16);
  ctx.fill();
  ctx.stroke();

  // Oscilloscope Screen
  ctx.fillStyle = '#030e09';
  ctx.strokeStyle = '#064e3b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(oscX + 25, oscY + 60, oscW - 50, 330, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TRAINING PROGRESS: IN-CONTEXT LEARNING PHASE CHANGE', oscX + oscW / 2, oscY + 42);

  // Grid lines inside scope
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.lineWidth = 1;
  for (let gx = oscX + 40; gx < oscX + oscW - 40; gx += 50) {
    ctx.beginPath();
    ctx.moveTo(gx, oscY + 70);
    ctx.lineTo(gx, oscY + 380);
    ctx.stroke();
  }
  for (let gy = oscY + 80; gy < oscY + 380; gy += 45) {
    ctx.beginPath();
    ctx.moveTo(oscX + 35, gy);
    ctx.lineTo(oscX + oscW - 35, gy);
    ctx.stroke();
  }

  // Animated In-Context Loss Curve with sharp cliff
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  const startGraphX = oscX + 60;
  const cliffX = oscX + 380;
  const endGraphX = oscX + oscW - 60;

  ctx.moveTo(startGraphX, oscY + 120);
  ctx.lineTo(cliffX, oscY + 135); // Plateau before phase change
  ctx.lineTo(cliffX + 30, oscY + 320); // Sharp vertical drop!
  ctx.lineTo(endGraphX, oscY + 340); // Rapid learning plateau
  ctx.stroke();

  // Phase change marker
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cliffX + 15, oscY + 70);
  ctx.lineTo(cliffX + 15, oscY + 380);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText('PHASE CHANGE (Induction Heads Form)', cliffX + 15, oscY + 100);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px NotoSans, sans-serif';
  ctx.fillText('Token Step: ~100M-200M tokens (Non-linear emergence)', oscX + oscW / 2, oscY + 420);

  // SECTION 3: STICKMAN CLOCKMAKER / CIRCUIT ENGINEER
  const smX = 990, smY = 530;
  drawGroundShadow(ctx, smX, smY + 190, 80, 16);

  drawFigure(ctx, {
    head: { x: smX, y: smY - 30, r: 28 },
    torso: {
      start: { x: smX, y: smY },
      end: { x: smX, y: smY + 105 }
    },
    leftArm: {
      upper: { start: { x: smX, y: smY + 18 }, end: { x: smX - 45, y: smY + 25 } },
      forearm: { start: { x: smX - 45, y: smY + 25 }, end: { x: smX - 90, y: smY + 5 } } // Pointing to circuit box
    },
    rightArm: {
      upper: { start: { x: smX, y: smY + 18 }, end: { x: smX + 45, y: smY + 35 } },
      forearm: { start: { x: smX + 45, y: smY + 35 }, end: { x: smX + 90, y: smY + 20 } } // Adjusting scope knob
    },
    leftLeg: {
      upper: { start: { x: smX, y: smY + 105 }, end: { x: smX - 22, y: smY + 150 } },
      lower: { start: { x: smX - 22, y: smY + 150 }, end: { x: smX - 25, y: smY + 195 } }
    },
    rightLeg: {
      upper: { start: { x: smX, y: smY + 105 }, end: { x: smX + 22, y: smY + 150 } },
      lower: { start: { x: smX + 22, y: smY + 150 }, end: { x: smX + 30, y: smY + 195 } }
    },
    facing: 'left',
    expression: 'focused',
    coatColor: '#ffffff',
    lineColor: '#ffffff',
    lineWidth: 4.5
  });

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
  ctx.fillText('DISCOVERY: IN-CONTEXT LEARNING IS DRIVEN BY INDUCTION CIRCUITS', 110, 968);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('Attention heads work together as functional algorithms. The sudden phase change during training marks the emergence of reasoning from memory.', 110, 995);

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
      console.log(`✅ Act 4 rendered successfully: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
