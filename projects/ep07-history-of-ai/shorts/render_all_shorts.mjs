import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas } from '../../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 24;

const SHORTS_DIR = path.resolve('projects/ep07-history-of-ai/shorts');
const EXPORTS_DIR = path.resolve('exports');

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function ease(t) {
  t = clamp(t);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// -------------------------------------------------------------
// MAGI DRAWING ENGINE FOR 9:16 VERTICAL (SCALED UP FOR MOBILE)
// -------------------------------------------------------------
function drawMagiVertical(ctx, x, y, options = {}) {
  const { facing = 1, isWalking = false, walkSpeed = 1, armAction = 'idle', t = 0 } = options;

  ctx.save();
  ctx.translate(x, y);
  const scale = 1.45;
  ctx.scale(scale, scale);

  const cycle = isWalking ? t * 8.5 * walkSpeed : t * 2.2;
  const bounce = isWalking ? Math.abs(Math.sin(cycle)) * 5.5 : Math.sin(t * 2.2) * 1.5;
  const hipY = -70 - bounce;

  // Ground shadow
  ctx.beginPath();
  ctx.ellipse(0, 0, 42 - bounce * 1.1, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fill();

  // Legs
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const legSwing = isWalking ? Math.sin(cycle) * 26 : 0;
  // Left leg
  ctx.beginPath();
  ctx.moveTo(-10, hipY);
  ctx.lineTo(-10 + legSwing * 0.5, hipY + 36);
  ctx.lineTo(-10 + legSwing, 0);
  ctx.stroke();

  // Right leg
  ctx.beginPath();
  ctx.moveTo(10, hipY);
  ctx.lineTo(10 - legSwing * 0.5, hipY + 36);
  ctx.lineTo(10 - legSwing, 0);
  ctx.stroke();

  // Torso
  const torsoLean = isWalking ? 4 * (facing || 1) : 0;
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(torsoLean, hipY - 55);
  ctx.stroke();

  const shoulderY = hipY - 55;
  const headY = shoulderY - 26;

  // Arms
  let lElbowX = -15, lElbowY = shoulderY + 20, lHandX = -12, lHandY = shoulderY + 45;
  let rElbowX = 15, rElbowY = shoulderY + 20, rHandX = 12, rHandY = shoulderY + 45;

  if (armAction === 'point_up') {
    // Pointing upward towards top diagram
    rElbowX = 26;
    rElbowY = shoulderY - 20;
    rHandX = 42;
    rHandY = shoulderY - 55;
    lElbowX = -18;
    lElbowY = shoulderY + 18;
    lHandX = -6;
    lHandY = shoulderY + 28;
  } else if (armAction === 'shiver') {
    const shiverOff = Math.sin(t * 28) * 3;
    lElbowX = -12 + shiverOff;
    lElbowY = shoulderY + 15;
    lHandX = 10;
    lHandY = shoulderY + 18;
    rElbowX = 12 - shiverOff;
    rElbowY = shoulderY + 15;
    rHandX = -10;
    rHandY = shoulderY + 18;
  } else if (armAction === 'thumbs_up') {
    rElbowX = 22;
    rElbowY = shoulderY - 10;
    rHandX = 36;
    rHandY = shoulderY - 32;
    lElbowX = -18;
    lElbowY = shoulderY + 18;
    lHandX = -8;
    lHandY = shoulderY + 28;
  } else if (isWalking) {
    const armSwing = Math.sin(cycle) * 22;
    lHandX = -15 - armSwing;
    rHandX = 15 + armSwing;
  }

  // Draw Left Arm
  ctx.beginPath();
  ctx.moveTo(-4 + torsoLean, shoulderY);
  ctx.lineTo(lElbowX, lElbowY);
  ctx.lineTo(lHandX, lHandY);
  ctx.stroke();

  // Draw Right Arm
  ctx.beginPath();
  ctx.moveTo(4 + torsoLean, shoulderY);
  ctx.lineTo(rElbowX, rElbowY);
  ctx.lineTo(rHandX, rHandY);
  ctx.stroke();

  // Laser Pointer Spark directed upward at diagram
  if (armAction === 'point_up') {
    ctx.save();
    ctx.fillStyle = '#38BDF8';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(rHandX, rHandY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Laser beam going up towards diagram
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(rHandX, rHandY);
    ctx.lineTo(rHandX + 40, rHandY - 240);
    ctx.stroke();
    ctx.restore();
  }

  // Head
  ctx.beginPath();
  ctx.arc(torsoLean, headY, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Glasses
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  const glassX = facing === 1 ? torsoLean + 4 : torsoLean - 4;
  ctx.beginPath();
  ctx.arc(glassX, headY - 1, 6, 0, Math.PI * 2);
  ctx.arc(glassX + (facing === 1 ? 11 : -11), headY - 1, 6, 0, Math.PI * 2);
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(glassX + (facing === 1 ? 1 : -1), headY - 1, 2, 0, Math.PI * 2);
  ctx.arc(glassX + (facing === 1 ? 12 : -10), headY - 1, 2, 0, Math.PI * 2);
  ctx.fill();

  // Scarf
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.roundRect(torsoLean - 12, shoulderY - 6, 26, 9, 4);
  ctx.fill();
  const scarfWave = Math.sin(t * 4.5) * 6;
  ctx.beginPath();
  ctx.moveTo(torsoLean - 8, shoulderY);
  ctx.quadraticCurveTo(torsoLean - 24, shoulderY + 8 + scarfWave, torsoLean - 30, shoulderY + 18 + scarfWave);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#FACC15';
  ctx.stroke();

  // Hat
  ctx.fillStyle = '#6366F1';
  ctx.beginPath();
  ctx.ellipse(torsoLean, headY - 16, 26, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(torsoLean - 14, headY - 16);
  ctx.quadraticCurveTo(torsoLean + 4, headY - 55, torsoLean + 16, headY - 62);
  ctx.quadraticCurveTo(torsoLean + 10, headY - 25, torsoLean + 16, headY - 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(torsoLean + 6, headY - 38, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// -------------------------------------------------------------
// SHORT 1 VISUALIZER: THE XOR CATASTROPHE
// -------------------------------------------------------------
function drawShort1Visualizer(ctx, t) {
  const panelX = 80;
  const panelY = 260;
  const panelW = 920;
  const panelH = 720;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 20);
  ctx.fill(); ctx.stroke();

  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = '#EF4444';
  ctx.fillText('MINSKY & PAPERT (1969) // PERCEPTRON XOR FAILURE', panelX + 35, panelY + 55);

  ctx.font = '20px monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('Single-layer neural network cannot compute XOR', panelX + 35, panelY + 95);

  // Cartesian XOR Plane
  const originX = panelX + 220;
  const originY = panelY + 540;
  const span = 380;

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX + span + 50, originY);
  ctx.moveTo(originX, originY);
  ctx.lineTo(originX, originY - span - 50);
  ctx.stroke();

  // 4 XOR points
  const pts = [
    { x: 0, y: 0, val: 0, label: '(0,0) → 0' },
    { x: 1, y: 0, val: 1, label: '(1,0) → 1' },
    { x: 0, y: 1, val: 1, label: '(0,1) → 1' },
    { x: 1, y: 1, val: 0, label: '(1,1) → 0' }
  ];

  pts.forEach(p => {
    const px = originX + p.x * span;
    const py = originY - p.y * span;

    ctx.beginPath();
    ctx.arc(px, py, 16, 0, Math.PI * 2);
    ctx.fillStyle = p.val === 1 ? '#38BDF8' : '#EF4444';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(p.label, px + (p.x === 0 ? 25 : -115), py - 20);
  });

  // Decision line attempting to separate XOR
  const angle = Math.sin(t * 2.2) * 0.5 - 0.35;
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 5;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(originX + 30, originY - 30);
  ctx.lineTo(originX + 30 + Math.cos(angle) * 440, originY - 30 - Math.sin(angle) * 440);
  ctx.stroke();
  ctx.setLineDash([]);

  // Warning Banner
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panelX + 110, panelY + 610, panelW - 220, 65, 12);
  ctx.fill(); ctx.stroke();

  ctx.font = '900 24px monospace';
  ctx.fillStyle = '#EF4444';
  ctx.textAlign = 'center';
  ctx.fillText('❌ FATAL: LINEARLY INSEPARABLE', panelX + panelW / 2, panelY + 652);
  ctx.restore();
}

// -------------------------------------------------------------
// SHORT 2 VISUALIZER: HOW GAMING GPUS SAVED AI
// -------------------------------------------------------------
function drawShort2Visualizer(ctx, t) {
  const panelX = 80;
  const panelY = 260;
  const panelW = 920;
  const panelH = 720;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 20);
  ctx.fill(); ctx.stroke();

  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = '#10B981';
  ctx.fillText('OCT 2012 // ALEXNET ON 2× NVIDIA GTX 580', panelX + 35, panelY + 55);

  ctx.font = '20px monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('GPU Parallel Matrix Multiplication: C = A × B', panelX + 35, panelY + 95);

  // Neural Network Layers
  const layers = [
    { x: panelX + 110, count: 5, label: 'Pixel Input' },
    { x: panelX + 260, count: 7, label: 'Conv 11×11' },
    { x: panelX + 410, count: 7, label: 'Conv 5×5' },
    { x: panelX + 560, count: 5, label: 'Dense 4096' }
  ];

  // Synaptic lines
  for (let l = 0; l < layers.length - 1; l++) {
    const la = layers[l];
    const lb = layers[l + 1];
    for (let na = 0; na < la.count; na++) {
      const ya = panelY + 160 + na * 52;
      for (let nb = 0; nb < lb.count; nb++) {
        const yb = panelY + 160 + nb * 52;
        const pulse = (Math.sin(t * 9 + na * 2 + nb) + 1) * 0.12;
        ctx.strokeStyle = `rgba(16, 185, 129, ${pulse})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(la.x, ya); ctx.lineTo(lb.x, yb); ctx.stroke();
      }
    }
  }

  // Nodes
  layers.forEach(lay => {
    for (let n = 0; n < lay.count; n++) {
      const ny = panelY + 160 + n * 52;
      ctx.fillStyle = '#10B981';
      ctx.shadowColor = '#10B981';
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(lay.x, ny, 8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  });

  // ImageNet Scorecard Card
  const scX = panelX + 650;
  const scY = panelY + 180;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(scX, scY, 230, 320, 16);
  ctx.fill(); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('IMAGENET 2012', scX + 115, scY + 50);

  ctx.font = '18px monospace';
  ctx.fillStyle = '#EF4444';
  ctx.fillText('Prior: 26.2%', scX + 115, scY + 115);

  ctx.font = '900 44px monospace';
  ctx.fillStyle = '#10B981';
  ctx.fillText('15.3%', scX + 115, scY + 190);

  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('⚡ -10.9% DROP!', scX + 115, scY + 245);

  ctx.font = '14px monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('Deep Learning Era', scX + 115, scY + 285);
  ctx.restore();
}

// -------------------------------------------------------------
// SHORT 3 VISUALIZER: HOW AI ACTUALLY THINKS (ATTENTION)
// -------------------------------------------------------------
function drawShort3Visualizer(ctx, t) {
  const panelX = 80;
  const panelY = 260;
  const panelW = 920;
  const panelH = 720;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 20);
  ctx.fill(); ctx.stroke();

  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('GOOGLE BRAIN (2017) // "ATTENTION IS ALL YOU NEED"', panelX + 35, panelY + 55);

  ctx.font = '20px monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('Attention(Q, K, V) = softmax(Q Kᵀ / √dₖ) V', panelX + 35, panelY + 95);

  const qTokens = [
    { label: '"The"', x: panelX + 130, y: panelY + 180 },
    { label: '"animal"', x: panelX + 290, y: panelY + 180 },
    { label: '"street"', x: panelX + 450, y: panelY + 180 },
    { label: '"it"', x: panelX + 610, y: panelY + 180 },
    { label: '"tired"', x: panelX + 770, y: panelY + 180 }
  ];

  const kTokens = [
    { label: '"The"', x: panelX + 130, y: panelY + 480 },
    { label: '"animal"', x: panelX + 290, y: panelY + 480 },
    { label: '"street"', x: panelX + 450, y: panelY + 480 },
    { label: '"it"', x: panelX + 610, y: panelY + 480 },
    { label: '"tired"', x: panelX + 770, y: panelY + 480 }
  ];

  // Curves
  for (let qi = 0; qi < qTokens.length; qi++) {
    for (let ki = 0; ki < kTokens.length; ki++) {
      const q = qTokens[qi];
      const k = kTokens[ki];
      const isStrong = (qi === 3 && ki === 1);

      ctx.strokeStyle = isStrong
        ? `rgba(250, 204, 21, ${0.7 + Math.sin(t * 6) * 0.3})`
        : 'rgba(56, 189, 248, 0.1)';
      ctx.lineWidth = isStrong ? 5 : 1.5;

      ctx.beginPath();
      ctx.moveTo(q.x, q.y + 25);
      ctx.bezierCurveTo(q.x, q.y + 120, k.x, k.y - 120, k.x, k.y - 25);
      ctx.stroke();

      if (isStrong) {
        const flowP = (t * 1.8) % 1.0;
        const bx = Math.pow(1 - flowP, 3) * q.x +
                   3 * Math.pow(1 - flowP, 2) * flowP * q.x +
                   3 * (1 - flowP) * Math.pow(flowP, 2) * k.x +
                   Math.pow(flowP, 3) * k.x;
        const by = Math.pow(1 - flowP, 3) * (q.y + 25) +
                   3 * Math.pow(1 - flowP, 2) * flowP * (q.y + 120) +
                   3 * (1 - flowP) * Math.pow(flowP, 2) * (k.y - 120) +
                   Math.pow(flowP, 3) * (k.y - 25);

        ctx.fillStyle = '#FACC15';
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  // Token Pills
  [qTokens, kTokens].forEach((row, isK) => {
    row.forEach((tok, idx) => {
      const isHigh = tok.label === '"it"' || tok.label === '"animal"';
      ctx.fillStyle = isHigh ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = isHigh ? '#38BDF8' : 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = isHigh ? 3 : 1.5;

      ctx.beginPath();
      ctx.roundRect(tok.x - 55, tok.y - 25, 110, 50, 25);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = isHigh ? '#FFFFFF' : '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText(tok.label, tok.x, tok.y + 7);
    });
  });

  // Softmax Badge
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(panelX + 280, panelY + 590, 360, 65, 12);
  ctx.fill(); ctx.stroke();

  ctx.font = '900 24px monospace';
  ctx.fillStyle = '#FACC15';
  ctx.textAlign = 'center';
  ctx.fillText('α: 0.94 // CROSS-ATTENTION', panelX + panelW / 2, panelY + 632);
  ctx.restore();
}

// -------------------------------------------------------------
// RENDER A SINGLE SHORT (9:16 VERTICAL 1080x1920)
// -------------------------------------------------------------
async function renderShort(config) {
  const { id, title, scriptFile, wavFile, outFile, drawVisualizer, duration } = config;
  console.log(`\n======================================================`);
  console.log(`Rendering Short ${id}: ${title}`);
  console.log(`Duration: ${duration.toFixed(2)}s | Target: ${outFile}`);
  console.log(`======================================================\n`);

  const tempVideo = `/tmp/temp_short_${id}.mp4`;
  const totalFrames = Math.ceil(duration * FPS);

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const ffmpeg = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${WIDTH}x${HEIGHT}`,
    '-framerate', String(FPS),
    '-i', 'pipe:0',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '17',
    '-pix_fmt', 'yuv420p',
    tempVideo
  ]);

  ffmpeg.stdin.on('error', () => {});
  const completion = new Promise((res, rej) => {
    ffmpeg.on('close', code => code === 0 ? res() : rej(new Error('Video encode failed')));
  });

  // Script text lines for dynamic captions
  const scriptText = fs.readFileSync(scriptFile, 'utf8').trim();
  const sentences = scriptText.split('\n').filter(Boolean);
  const timePerSent = duration / sentences.length;

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / FPS;

    // 1. Cinematic Deep Space Background
    const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 80, WIDTH / 2, HEIGHT / 2, 1100);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Floor Cyber Grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
    ctx.lineWidth = 1.5;
    for (let gx = 0; gx <= WIDTH; gx += 80) {
      ctx.beginPath();
      ctx.moveTo(gx, 1680);
      ctx.lineTo(gx + (gx - WIDTH / 2) * 0.5, HEIGHT);
      ctx.stroke();
    }
    for (let gy = 1680; gy <= HEIGHT; gy += 45) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(WIDTH, gy);
      ctx.stroke();
    }

    // 2. Top Header & Channel Pill
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.roundRect(WIDTH / 2 - 210, 80, 420, 52, 26);
    ctx.fill();

    ctx.font = '900 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('🔴 PROGRAMS MAGIC // SHORT DOC', WIDTH / 2, 115);

    // Main Hook Title
    ctx.font = '900 44px system-ui, -apple-system, sans-serif';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#020617';
    ctx.strokeText(title, WIDTH / 2, 205);
    ctx.fillStyle = '#FACC15';
    ctx.fillText(title, WIDTH / 2, 205);

    // 3. Middle Visualizer Stage
    drawVisualizer(ctx, t);

    // 4. Dynamic Subtitles Band (Middle)
    const sentIdx = Math.min(sentences.length - 1, Math.floor(t / timePerSent));
    const currentSent = sentences[sentIdx];

    ctx.fillStyle = 'rgba(11, 15, 25, 0.94)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(80, 1070, WIDTH - 160, 110, 20);
    ctx.fill(); ctx.stroke();

    ctx.font = '900 32px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(currentSent, WIDTH / 2, 1135, WIDTH - 200);

    // 5. Magi Mascot on Ground Stage
    let magiX = 380;
    let isWalking = false;
    let armAction = 'point_up';

    if (t < 3.0) {
      const walkP = ease(t / 3.0);
      magiX = lerp(180, 380, walkP);
      isWalking = true;
    } else if (t > duration - 4.0) {
      armAction = 'thumbs_up';
    }

    drawMagiVertical(ctx, magiX, 1680, {
      facing: 1,
      isWalking,
      armAction,
      t
    });

    // 6. Bottom Call to Action Card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(80, 1780, WIDTH - 160, 80, 40);
    ctx.fill(); ctx.stroke();

    ctx.font = '900 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'center';
    const bounceY = Math.sin(t * 8) * 4;
    ctx.fillText('⬇️ WATCH FULL DOCUMENTARY (RELATED VIDEO) ⬇️', WIDTH / 2, 1830 + bounceY);

    // Pipe frame to ffmpeg
    const buffer = canvas.data();
    if (!ffmpeg.stdin.write(buffer)) {
      await Promise.race([
        once(ffmpeg.stdin, 'drain'),
        completion.then(() => { throw new Error('Encoder closed early'); })
      ]);
    }
  }

  ffmpeg.stdin.end();
  await completion;

  console.log(`Muxing Short ${id} with 24kHz Bodi voiceover...`);
  const finalMux = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-i', tempVideo,
    '-i', wavFile,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    outFile
  ]);

  await new Promise((res, rej) => {
    finalMux.on('close', code => code === 0 ? res() : rej(new Error('Mux failed')));
  });

  console.log(`✓ Short ${id} Complete: ${outFile}`);
}

async function main() {
  const shorts = [
    {
      id: 1,
      title: 'THE MATH THAT KILLED AI',
      scriptFile: path.join(SHORTS_DIR, 'short1.txt'),
      wavFile: path.join(SHORTS_DIR, 'short1.wav'),
      outFile: path.join(EXPORTS_DIR, 'EP07-Short01-The-Math-That-Killed-AI.mp4'),
      drawVisualizer: drawShort1Visualizer,
      duration: 42.44
    },
    {
      id: 2,
      title: 'HOW VIDEO GAMES SAVED AI',
      scriptFile: path.join(SHORTS_DIR, 'short2.txt'),
      wavFile: path.join(SHORTS_DIR, 'short2.wav'),
      outFile: path.join(EXPORTS_DIR, 'EP07-Short02-How-Gaming-GPUs-Created-AI.mp4'),
      drawVisualizer: drawShort2Visualizer,
      duration: 44.84
    },
    {
      id: 3,
      title: 'HOW AI ACTUALLY THINKS',
      scriptFile: path.join(SHORTS_DIR, 'short3.txt'),
      wavFile: path.join(SHORTS_DIR, 'short3.wav'),
      outFile: path.join(EXPORTS_DIR, 'EP07-Short03-How-AI-Actually-Thinks.mp4'),
      drawVisualizer: drawShort3Visualizer,
      duration: 35.96
    }
  ];

  for (const s of shorts) {
    await renderShort(s);
  }

  console.log('\n🎉 ALL 3 VIRAL SHORTS RENDERED SUCCESSFULLY!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

