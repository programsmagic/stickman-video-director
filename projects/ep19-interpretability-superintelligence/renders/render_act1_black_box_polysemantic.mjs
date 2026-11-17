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
const VOICE = path.resolve('projects/ep19-interpretability-superintelligence/build/narration/act1.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP19-Act1-BlackBoxPolysemantic-1080p.mp4');
const SFX_FILE = '/tmp/ep19_act1_sfx.wav';
const MIX_FILE = '/tmp/ep19_act1_mix.wav';

console.log(`=== EP19 ACT 1: THE BLACK BOX DILEMMA & POLYSEMANTIC NEURONS ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 48271;
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

  // Lab bio-chamber atmospheric hum
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 95 * t) * 0.4 + noise() * 0.1) * 0.2,
    (t) => (Math.sin(2 * Math.PI * 96.2 * t) * 0.4 + noise() * 0.1) * 0.2,
    0.20
  );

  // Microscope probe click at t = 16.0s
  addStereo(16.0, 0.4,
    (t) => (Math.sin(2 * Math.PI * 1400 * t) + noise() * 0.5) * Math.exp(-t * 20),
    (t) => (Math.sin(2 * Math.PI * 1420 * t) + noise() * 0.5) * Math.exp(-t * 20),
    0.45
  );

  // Neuron #417 electrical pulse chime at t = 24.0s
  addStereo(24.0, 1.2,
    (t) => (Math.sin(2 * Math.PI * 520 * t) + Math.sin(2 * Math.PI * 1040 * t) * 0.5) * Math.exp(-t * 3),
    (t) => (Math.sin(2 * Math.PI * 524 * t) + Math.sin(2 * Math.PI * 1048 * t) * 0.5) * Math.exp(-t * 3),
    0.45
  );

  // Confusion buzzer / question pop at t = 28.0s
  addStereo(28.0, 0.6,
    (t) => Math.sin(2 * Math.PI * 320 * t) * Math.exp(-t * 6),
    (t) => Math.sin(2 * Math.PI * 320 * t) * Math.exp(-t * 6),
    0.35
  );

  // Superposition geometric whoosh at t = 45.0s
  addStereo(45.0, 2.0,
    (t) => (noise() * 0.7 * Math.sin(Math.PI * t / 2.0)),
    (t) => (noise() * 0.7 * Math.sin(Math.PI * t / 2.0)),
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

  // Background: Deep Cyber Neuroscience Laboratory
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(0.5, '#070f26');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 120) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.3, 620);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 620; y <= HEIGHT; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // HEADER BANNER
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ACT 1: THE BLACK BOX DILEMMA & POLYSEMANTIC NEURONS', 80, 75);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '22px NotoSans, sans-serif';
  ctx.fillText('Superposition • 100B+ Parameters • Feature Tangling', 80, 112);

  // SECTION 1: THE GLOWING GLASS BRAIN CHAMBER (Center-Right)
  const brainX = 1250, brainY = 430;
  drawGroundShadow(ctx, brainX, 780, 320, 35);

  // Glass chamber sphere
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(brainX, brainY, 240, 0, Math.PI * 2);
  ctx.stroke();

  // Glass pedestal
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(brainX - 160, brainY + 220, 320, 80, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CONTAINMENT CHAMBER: FRONTIER LLM (70B DENSE)', brainX, brainY + 265);

  // Internal neural network mesh inside the glass
  const numNodes = 28;
  const nodes = [];
  for (let i = 0; i < numNodes; i++) {
    const angle = (i / numNodes) * Math.PI * 2 + Math.sin(t * 0.5 + i) * 0.2;
    const dist = 60 + (i % 5) * 32;
    nodes.push({
      x: brainX + Math.cos(angle) * dist,
      y: brainY + Math.sin(angle) * dist * 0.8,
      id: i
    });
  }

  // Draw synapses
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d < 110) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }

  // Draw normal nodes
  nodes.forEach((n, idx) => {
    if (idx !== 7) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // SPECIAL NODE: Neuron #417 (Node index 7)
  const probeNode = nodes[7];
  const pulseScale = 1.0 + Math.sin(t * 8) * 0.25;
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(probeNode.x, probeNode.y, 9 * pulseScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEURON #417', probeNode.x, probeNode.y - 18);

  // SECTION 2: THE 3 FLOATING POLYSEMANTIC CARDS (Active when t > 18s)
  if (t > 15) {
    const cardAlpha = Math.min(1.0, (t - 15) / 2.0);
    ctx.save();
    ctx.globalAlpha = cardAlpha;

    // Laser connection lines from Neuron 417 to 3 cards
    const cards = [
      { x: 740, y: 220, label: 'GOLDEN GATE BRIDGE', sub: 'Civil Engineering Landmark', col: '#f97316' },
      { x: 740, y: 350, label: 'ACADEMIC CITATIONS', sub: 'Vaswani et al. [1], Footnotes', col: '#38bdf8' },
      { x: 740, y: 480, label: 'LITHIUM-ION BATTERY', sub: 'Electrochemical Storage', col: '#10b981' }
    ];

    cards.forEach((c, idx) => {
      // connecting ray
      ctx.strokeStyle = c.col;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(probeNode.x, probeNode.y);
      ctx.lineTo(c.x + 280, c.y + 35);
      ctx.stroke();
      ctx.setLineDash([]);

      // Card box
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = c.col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, 280, 70, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = c.col;
      ctx.font = 'bold 17px NotoSans, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(c.label, c.x + 18, c.y + 30);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px NotoSans, sans-serif';
      ctx.fillText(c.sub, c.x + 18, c.y + 52);
    });

    ctx.restore();
  }

  // SECTION 3: SUPERPOSITION HYPERSPACE VECTOR DIAGRAM (t > 40s)
  if (t > 38) {
    const supAlpha = Math.min(1.0, (t - 38) / 2.5);
    ctx.save();
    ctx.globalAlpha = supAlpha;

    const diagX = 350, diagY = 320;
    // Circular compass/coordinate field
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(diagX, diagY, 110, 0, Math.PI * 2);
    ctx.stroke();

    // 2D representation of high-dimensional non-orthogonal packing
    const angles = [0.2, 0.65, 1.1, 1.55, 2.05, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.6];
    angles.forEach((a, i) => {
      const len = 95;
      const ex = diagX + Math.cos(a + t * 0.1) * len;
      const ey = diagY + Math.sin(a + t * 0.1) * len;
      ctx.strokeStyle = i % 2 === 0 ? '#c084fc' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(diagX, diagY);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.fillStyle = i % 2 === 0 ? '#c084fc' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Badge below
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(diagX - 160, diagY + 130, 320, 50, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUPERPOSITION IN HYPERSPACE', diagX, diagY + 160);

    ctx.restore();
  }

  // SECTION 4: STICKMAN NEUROSCIENTIST
  const stickmanX = 480;
  const stickmanY = 560;
  drawGroundShadow(ctx, stickmanX, stickmanY + 230, 90, 18);

  const isScratching = t > 25 && t < 40;
  const isPointing = t >= 40;

  drawFigure(ctx, {
    head: { x: stickmanX, y: stickmanY - 30, r: 30 },
    torso: {
      start: { x: stickmanX, y: stickmanY },
      end: { x: stickmanX, y: stickmanY + 115 }
    },
    leftArm: isScratching
      ? { upper: { start: { x: stickmanX, y: stickmanY + 20 }, end: { x: stickmanX - 35, y: stickmanY - 10 } },
          forearm: { start: { x: stickmanX - 35, y: stickmanY - 10 }, end: { x: stickmanX - 15, y: stickmanY - 40 } } } // Scratching head
      : { upper: { start: { x: stickmanX, y: stickmanY + 20 }, end: { x: stickmanX - 45, y: stickmanY + 65 } },
          forearm: { start: { x: stickmanX - 45, y: stickmanY + 65 }, end: { x: stickmanX - 25, y: stickmanY + 95 } } },
    rightArm: isPointing
      ? { upper: { start: { x: stickmanX, y: stickmanY + 20 }, end: { x: stickmanX + 55, y: stickmanY + 10 } },
          forearm: { start: { x: stickmanX + 55, y: stickmanY + 10 }, end: { x: stickmanX + 115, y: stickmanY - 15 } } } // Pointing to hyperspace
      : { upper: { start: { x: stickmanX, y: stickmanY + 20 }, end: { x: stickmanX + 50, y: stickmanY + 45 } },
          forearm: { start: { x: stickmanX + 50, y: stickmanY + 45 }, end: { x: stickmanX + 90, y: stickmanY + 25 } } }, // Holding probe wand
    leftLeg: {
      upper: { start: { x: stickmanX, y: stickmanY + 115 }, end: { x: stickmanX - 25, y: stickmanY + 170 } },
      lower: { start: { x: stickmanX - 25, y: stickmanY + 170 }, end: { x: stickmanX - 28, y: stickmanY + 230 } }
    },
    rightLeg: {
      upper: { start: { x: stickmanX, y: stickmanY + 115 }, end: { x: stickmanX + 25, y: stickmanY + 170 } },
      lower: { start: { x: stickmanX + 25, y: stickmanY + 170 }, end: { x: stickmanX + 32, y: stickmanY + 230 } }
    },
    facing: 'right',
    expression: isScratching ? 'skeptical' : 'focused',
    coatColor: '#ffffff',
    lineColor: '#ffffff',
    lineWidth: 4.5
  });

  // Confusion question mark if scratching
  if (isScratching) {
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 36px CaveatHand, cursive';
    ctx.textAlign = 'center';
    ctx.fillText('???', stickmanX + 45, stickmanY - 55);
  }

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
  ctx.fillText('DIAGNOSTIC STATUS: POLYSEMANTICITY DETECTED', 110, 968);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('1 Single Neuron = Multiple Disparate Concepts. Superposition packs N > D features via Johnson-Lindenstrauss geometry.', 110, 995);

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
      console.log(`✅ Act 1 rendered successfully: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
