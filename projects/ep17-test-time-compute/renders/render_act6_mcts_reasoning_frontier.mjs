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
const VOICE = path.resolve('projects/ep17-test-time-compute/build/narration/act6.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP17-Act6-MCTSReasoningFrontier-1080p.mp4');
const SFX_FILE = '/tmp/ep17_act6_sfx.wav';
const MIX_FILE = '/tmp/ep17_act6_mix.wav';

console.log(`=== EP17 ACT 6: MONTE CARLO TREE SEARCH & THE REASONING FRONTIER ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 42891;
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

  // Celestial cosmic drone
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 65.4 * t) + Math.sin(2 * Math.PI * 130.8 * t) * 0.4 + noise() * 0.03) * 0.2,
    (t) => (Math.sin(2 * Math.PI * 65.8 * t) + Math.sin(2 * Math.PI * 131.6 * t) * 0.4 + noise() * 0.03) * 0.2,
    0.22
  );

  // MCTS branching tree crystal notes
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
  [4.0, 9.0, 15.0, 20.0, 26.0].forEach((t0, idx) => {
    const freq = notes[idx % notes.length];
    addStereo(t0, 1.8,
      (t) => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 3.0),
      (t) => Math.sin(2 * Math.PI * (freq * 1.004) * t) * Math.exp(-t * 3.0),
      0.35
    );
  });

  // Pruning branch zap at t = 22.5s
  addStereo(22.5, 0.6,
    (t) => (noise() * 0.8 + Math.sin(2 * Math.PI * 220 * t)) * Math.exp(-t * 12),
    (t) => (noise() * 0.8 + Math.sin(2 * Math.PI * 230 * t)) * Math.exp(-t * 12),
    0.35
  );

  // Deep structural evolution gong at t = 33.0s
  addStereo(33.0, 4.0,
    (t) => (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 220 * t) * 0.5) * Math.exp(-t * 0.8),
    (t) => (Math.sin(2 * Math.PI * 110.5 * t) + Math.sin(2 * Math.PI * 221 * t) * 0.5) * Math.exp(-t * 0.8),
    0.45
  );

  // Grand finale cosmic discovery chord at t = 48.0s
  const finalChord = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
  for (const freq of finalChord) {
    addStereo(48.0, 7.0,
      (t) => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 0.4),
      (t) => Math.sin(2 * Math.PI * (freq * 1.003) * t) * Math.exp(-t * 0.4),
      0.22
    );
  }

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

// Node coordinates for Monte Carlo Tree of Thoughts
const rootNode = { id: 'root', x: 1200, y: 190, label: 'Root Prompt s0', score: 1.0, visits: 1200 };
const level1 = [
  { id: 'b1', x: 880, y: 330, label: 'Branch A: Direct Proof', score: 0.88, visits: 650, parent: rootNode, best: true },
  { id: 'b2', x: 1200, y: 330, label: 'Branch B: Contradiction', score: 0.42, visits: 320, parent: rootNode, best: false },
  { id: 'b3', x: 1520, y: 330, label: 'Branch C: Heuristic', score: 0.15, visits: 230, parent: rootNode, pruned: true }
];
const level2 = [
  // from b1
  { id: 'b1_1', x: 740, y: 470, label: 'Step A1: Lemma 1', score: 0.94, visits: 480, parent: level1[0], best: true },
  { id: 'b1_2', x: 980, y: 470, label: 'Step A2: Algebraic', score: 0.72, visits: 170, parent: level1[0], best: false },
  // from b2
  { id: 'b2_1', x: 1140, y: 470, label: 'Step B1: Assume False', score: 0.35, visits: 180, parent: level1[1], pruned: true },
  { id: 'b2_2', x: 1320, y: 470, label: 'Step B2: Induction', score: 0.20, visits: 140, parent: level1[1], pruned: true },
  // from b3
  { id: 'b3_1', x: 1520, y: 470, label: 'Step C1: Dead Branch', score: 0.05, visits: 230, parent: level1[2], pruned: true }
];
const level3 = [
  // from b1_1 (Golden Solution Leaf)
  { id: 'sol', x: 740, y: 610, label: 'Q.E.D. Global Solution', score: 0.99, visits: 450, parent: level2[0], best: true, leaf: true },
  { id: 'b1_1b', x: 860, y: 610, label: 'Sub-lemma Beta', score: 0.65, visits: 30, parent: level2[0], best: false },
  { id: 'b1_2a', x: 980, y: 610, label: 'Factorization', score: 0.58, visits: 170, parent: level2[1], best: false }
];

const allNodes = [rootNode, ...level1, ...level2, ...level3];

// Starfield stars
const stars = [];
let seedS = 7719;
for (let i = 0; i < 90; i++) {
  seedS = (Math.imul(seedS, 1664525) + 1013904223) >>> 0;
  const sx = (seedS % WIDTH);
  seedS = (Math.imul(seedS, 1664525) + 1013904223) >>> 0;
  const sy = (seedS % 680);
  seedS = (Math.imul(seedS, 1664525) + 1013904223) >>> 0;
  const sz = 1.0 + (seedS % 200) / 100;
  stars.push({ x: sx, y: sy, size: sz, phase: (i * 0.4) });
}

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background: Deep Cosmic Indigo
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.5, '#0b1329');
  bg.addColorStop(1, '#020510');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Twinkling stars
  for (const s of stars) {
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.8 + s.phase));
    ctx.fillStyle = `rgba(248, 250, 252, ${twinkle * 0.8})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Perspective floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.22, 680);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 680; y <= HEIGHT; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // 1. TOP HEADER HUD
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(50, 24, WIDTH - 100, 72, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ACT VI: THE REASONING FRONTIER — MONTE CARLO TREE OF THOUGHTS', 76, 56);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.fillText('AlphaZero Architecture Meets Autoregressive Models • Deliberation, Verification & Autonomous Scientific Discovery', 76, 82);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.fillText(`SYSTEM 2 INFERENCE • ${t.toFixed(1)}s / ${dur.toFixed(1)}s`, WIDTH - 76, 68);

  // 2. MONTE CARLO TREE OF THOUGHTS (Center-Right Canvas)
  // Draw Tree Edges First
  for (const node of allNodes) {
    if (!node.parent) continue;
    const p = node.parent;

    const isPruned = node.pruned && t >= 20.0;
    const isGolden = node.best;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 20);
    // Smooth bezier curve down to child
    const midY = (p.y + 20 + node.y - 20) / 2;
    ctx.bezierCurveTo(p.x, midY, node.x, midY, node.x, node.y - 20);

    if (isPruned) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (isGolden) {
      // Golden glowing beam
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Traveling thought photon down the golden branch
      const photonPhase = (t * 1.5) % 1.0;
      const photonX = p.x + (node.x - p.x) * photonPhase;
      const photonY = (p.y + 20) + (node.y - 20 - (p.y + 20)) * photonPhase;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(photonX, photonY, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // Draw Tree Nodes
  for (const node of allNodes) {
    const isPruned = node.pruned && t >= 20.0;
    const isGolden = node.best;

    // Node Box
    const nw = node.leaf ? 180 : 150;
    const nh = 40;
    const nx = node.x - nw / 2;
    const ny = node.y - nh / 2;

    if (isPruned) {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 1.5;
    } else if (isGolden) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
    }

    ctx.beginPath();
    ctx.roundRect(nx, ny, nw, nh, 8);
    ctx.fill();
    ctx.stroke();

    // Node Label
    ctx.textAlign = 'center';
    ctx.fillStyle = isPruned ? '#64748b' : (isGolden ? '#fbbf24' : '#e2e8f0');
    ctx.font = 'bold 12px NotoSans, sans-serif';
    ctx.fillText(node.label, node.x, node.y - 2);

    // Score & Visits tag
    ctx.font = '10px NotoSans, sans-serif';
    ctx.fillStyle = isPruned ? '#ef4444' : '#38bdf8';
    const tagText = isPruned ? 'PRUNED ✕' : `Q=${node.score.toFixed(2)} | N=${node.visits}`;
    ctx.fillText(tagText, node.x, node.y + 12);

    // Prune cross if pruned
    if (isPruned) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx + 10, ny + 10);
      ctx.lineTo(nx + nw - 10, ny + nh - 10);
      ctx.moveTo(nx + nw - 10, ny + 10);
      ctx.lineTo(nx + 10, ny + nh - 10);
      ctx.stroke();
    }

    // Leaf crown on solution node
    if (node.leaf && isGolden) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '18px NotoSans, sans-serif';
      ctx.fillText('★ SOLUTION ★', node.x, ny - 10);
    }
  }

  // 3. MCTS ALGORITHM 4-STEP CYCLE HUD (Top Right overlay card)
  const hudX = 1380, hudY = 700, hudW = 480, hudH = 190;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(hudX, hudY, hudW, hudH, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#818cf8';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MCTS 4-PHASE REASONING CYCLE', hudX + 20, hudY + 32);

  const phases = [
    { name: '1. Selection:', desc: 'PUCT formula balances exploration vs exploitation' },
    { name: '2. Expansion:', desc: 'LLM generates k token paths as candidate branches' },
    { name: '3. Simulation:', desc: 'Fast rollouts with step-level verifier scoring' },
    { name: '4. Backprop:', desc: 'Updates value estimates Q(s) up the tree to root' }
  ];

  phases.forEach((p, idx) => {
    const py = hudY + 62 + idx * 30;
    // Highlight active phase depending on time
    const activeIdx = Math.floor((t * 0.8) % 4);
    const isActive = (idx === activeIdx);

    ctx.fillStyle = isActive ? '#fbbf24' : '#38bdf8';
    ctx.font = isActive ? 'bold 13px NotoSans, sans-serif' : '13px NotoSans, sans-serif';
    ctx.fillText(`${isActive ? '▶ ' : '   '}${p.name}`, hudX + 20, py);

    ctx.fillStyle = isActive ? '#f8fafc' : '#94a3b8';
    ctx.font = '12px NotoSans, sans-serif';
    ctx.fillText(p.desc, hudX + 130, py);
  });

  // 4. EVOLUTIONARY ROADMAP BANNER (Bottom Center / Left at t >= 30s)
  if (t >= 30.0) {
    const evoX = 120, evoY = 710, evoW = 1200, evoH = 180;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(evoX, evoY, evoW, evoH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px NotoSans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('THE EVOLUTION OF ARTIFICIAL INTELLIGENCE (SERIES ROADMAP)', evoX + 25, evoY + 36);

    const stages = [
      { num: 'EP 01-07', title: 'Autocomplete Engine', sub: 'Predicting tokens on internet', color: '#64748b' },
      { num: 'EP 10', title: 'Loss Landscapes', sub: 'Gradient descent & backprop', color: '#38bdf8' },
      { num: 'EP 14-16', title: 'Post-Training Alignment', sub: 'RLHF, DPO & safety steer', color: '#a855f7' },
      { num: 'EP 17', title: 'Test-Time Compute', sub: 'Self-correction & reasoning', color: '#fbbf24', active: true }
    ];

    stages.forEach((st, idx) => {
      const bx = evoX + 25 + idx * 285;
      const by = evoY + 55;
      const bw = 270;
      const bh = 105;

      ctx.fillStyle = st.active ? 'rgba(251, 191, 36, 0.12)' : 'rgba(30, 41, 59, 0.6)';
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.active ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = st.color;
      ctx.font = 'bold 12px NotoSans, sans-serif';
      ctx.fillText(st.num, bx + 15, by + 26);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px NotoSans, sans-serif';
      ctx.fillText(st.title, bx + 15, by + 52);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px NotoSans, sans-serif';
      ctx.fillText(st.sub, bx + 15, by + 78);
    });
  }

  // 5. GRAND FINALE SCIENTIFIC DISCOVERY CONSTELLATION (at t >= 46s)
  if (t >= 46.0) {
    const finAlpha = Math.min(1.0, (t - 46.0) / 2.0);
    ctx.save();
    ctx.globalAlpha = finAlpha;

    // Glowing golden orb around the solution
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(740, 610, 80 + Math.sin(t * 3) * 10, 0, Math.PI * 2);
    ctx.stroke();

    // Orbiting scientific symbols
    const symbols = [
      { sym: 'E = mc²', r: 120, speed: 1.0 },
      { sym: '∇ × B = μ₀J', r: 160, speed: -0.7 },
      { sym: 'ζ(s) = 0', r: 200, speed: 0.85 },
      { sym: 'iℏ ∂ψ/∂t = Hψ', r: 240, speed: -0.6 }
    ];

    symbols.forEach((s) => {
      const angle = t * s.speed;
      const sx = 740 + Math.cos(angle) * s.r;
      const sy = 610 + Math.sin(angle) * (s.r * 0.45);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(sx - 55, sy - 16, 110, 32, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px NotoSans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.sym, sx, sy + 5);
    });

    // Grand discovery caption card
    ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(WIDTH / 2 - 400, 910, 800, 110, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 22px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ENGINES OF DISCOVERY: THINKING BEFORE SPEAKING', WIDTH / 2, 948);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '16px NotoSans, sans-serif';
    ctx.fillText('No longer mirrors of human text — artificial minds solving humanity’s greatest frontiers.', WIDTH / 2, 982);

    ctx.restore();
  }

  // 6. SCIENTIST STICKMAN (Left foreground)
  const stickX = 360;
  const stickY = 720;
  const breath = Math.sin(t * 2.5) * 2.0;

  drawGroundShadow(ctx, stickX, 740, 70, 16);

  // Dynamic arm pose:
  // t < 22s: holding surveyor staff and pointing up to root
  // 22s <= t < 46s: gesturing with pointer to the branching tree
  // t >= 46s: raising both hands in triumphant scientific breakthrough
  let handLX, handLY, handRX, handRY;

  if (t < 46.0) {
    // Left hand holds staff
    handLX = stickX - 35;
    handLY = stickY - 60 + breath;
    // Right hand points up-right to MCTS tree
    handRX = stickX + 75;
    handRY = stickY - 140 + Math.sin(t * 1.5) * 15;
  } else {
    // Both hands raised triumphantly
    handLX = stickX - 60;
    handLY = stickY - 170 + Math.sin(t * 4) * 8;
    handRX = stickX + 60;
    handRY = stickY - 170 - Math.sin(t * 4) * 8;
  }

  const blink = (t % 3.8 < 0.15);

  drawFigure(ctx, {
    x: stickX,
    y: stickY + breath,
    scale: 1.15,
    facing: 'right',
    expression: t >= 46.0 ? 'excited' : (t >= 20.0 ? 'thoughtful' : 'neutral'),
    handL: { x: handLX, y: handLY },
    handR: { x: handRX, y: handRY },
    footL: { x: stickX - 25, y: 740 },
    footR: { x: stickX + 25, y: 740 },
    headRadius: 28,
    torsoLength: 80,
    legLength: 75,
    armLength: 55,
    showEyes: true,
    blink
  });

  // Futuristic surveyor staff in hand
  if (t < 46.0) {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(handLX, handLY + 60);
    ctx.lineTo(handLX, handLY - 120);
    ctx.stroke();

    // Staff crystal head
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(handLX, handLY - 120, 10, 0, Math.PI * 2);
    ctx.fill();

    // Laser pointer beam from staff toward tree
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(handLX, handLY - 120);
    ctx.lineTo(880, 330);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Pipe frame to ffmpeg with backpressure drain
  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (frame % 150 === 0 || frame === TOTAL_FRAMES - 1) {
    const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
    console.log(`  Rendered frame ${frame}/${TOTAL_FRAMES} (${pct}%)`);
  }
}

ffmpeg.stdin.end();

await new Promise((resolve, reject) => {
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      console.log(`\n🎉 ACT 6 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
