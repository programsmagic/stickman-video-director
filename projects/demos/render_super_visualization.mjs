import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 24;
const DURATION = 9.5;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const AUDIO_PATH = path.resolve('projects/demos/demo_voice.wav');
const TEMP_VIDEO = '/tmp/demo_super_viz.mp4';
const FINAL_OUTPUT = path.resolve('exports/demo-super-visualization-10s.mp4');

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

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
// ANATOMICALLY GROUNDED MAGI WITH FIXED PROPORTIONS
// -------------------------------------------------------------
function drawMagi(ctx, x, y, options = {}) {
  const { facing = 1, isWalking = false, walkSpeed = 1, armAction = 'idle', t = 0 } = options;

  ctx.save();
  ctx.translate(x, y);

  const cycle = isWalking ? t * 8.5 * walkSpeed : t * 2.2;
  const bounce = isWalking ? Math.abs(Math.sin(cycle)) * 5.5 : Math.sin(t * 2.2) * 1.5;
  const hipY = -70 - bounce;

  // Ground shadow
  ctx.beginPath();
  ctx.ellipse(0, 0, 36 - bounce * 1.1, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();

  // Bipedal Legs
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.5;
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
  const torsoLean = isWalking ? 4 : 0;
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(torsoLean, hipY - 55);
  ctx.stroke();

  const shoulderY = hipY - 55;
  const headY = shoulderY - 26;

  // Arms with fixed skeletal proportions (shoulder -> elbow: 28px, elbow -> hand: 26px)
  let lElbowX = -15, lElbowY = shoulderY + 20, lHandX = -12, lHandY = shoulderY + 45;
  let rElbowX = 15, rElbowY = shoulderY + 20, rHandX = 12, rHandY = shoulderY + 45;

  if (armAction === 'point_right') {
    // Reaching forward towards diagram
    rElbowX = 26;
    rElbowY = shoulderY - 6;
    rHandX = 52;
    rHandY = shoulderY - 14;
    // Left hand resting at hip
    lElbowX = -18;
    lElbowY = shoulderY + 18;
    lHandX = -6;
    lHandY = shoulderY + 28;
  } else if (armAction === 'arms_crossed') {
    // Both arms crossed in front of chest
    lElbowX = -18;
    lElbowY = shoulderY + 20;
    lHandX = 14;
    lHandY = shoulderY + 22;

    rElbowX = 18;
    rElbowY = shoulderY + 22;
    rHandX = -12;
    rHandY = shoulderY + 24;
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

  // Laser Pointer Spark when pointing
  if (armAction === 'point_right') {
    ctx.save();
    ctx.fillStyle = '#38BDF8';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(rHandX, rHandY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Laser beam toward active node
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rHandX, rHandY);
    ctx.lineTo(rHandX + 160, rHandY - 60);
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

  // Eye dots
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(glassX + (facing === 1 ? 1 : -1), headY - 1, 2, 0, Math.PI * 2);
  ctx.arc(glassX + (facing === 1 ? 12 : -10), headY - 1, 2, 0, Math.PI * 2);
  ctx.fill();

  // Yellow Scarf
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.roundRect(torsoLean - 12, shoulderY - 6, 26, 9, 4);
  ctx.fill();
  // Trailing scarf
  const scarfWave = Math.sin(t * 4.5) * 6;
  ctx.beginPath();
  ctx.moveTo(torsoLean - 8, shoulderY);
  ctx.quadraticCurveTo(torsoLean - 24, shoulderY + 8 + scarfWave, torsoLean - 30, shoulderY + 18 + scarfWave);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#FACC15';
  ctx.stroke();

  // Wizard Hat
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

  ctx.restore();
}

// -------------------------------------------------------------
// HIGH-END VISUALIZATION: ATTENTION MATRIX + NEURAL GRAPH
// -------------------------------------------------------------
function drawAttentionNetwork(ctx, t) {
  const originX = 420;
  const originY = 160;

  // Header Title
  ctx.save();
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('⚡ MULTI-HEAD SELF-ATTENTION GRAPH', originX, originY);

  ctx.font = '13px monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('Attention(Q, K, V) = softmax(Q Kᵀ / √dₖ) V', originX, originY + 24);
  ctx.restore();

  // Token Nodes
  const tokens = [
    { label: '"Can"', x: originX + 40, y: originY + 100 },
    { label: '"Machines"', x: originX + 160, y: originY + 100 },
    { label: '"Think"', x: originX + 280, y: originY + 100 },
    { label: '"?"', x: originX + 380, y: originY + 100 },
  ];

  const targetTokens = [
    { label: '"Can"', x: originX + 40, y: originY + 280 },
    { label: '"Machines"', x: originX + 160, y: originY + 280 },
    { label: '"Think"', x: originX + 280, y: originY + 280 },
    { label: '"?"', x: originX + 380, y: originY + 280 },
  ];

  // Draw Attention Interconnects (Curves with dynamic weights)
  for (let i = 0; i < tokens.length; i++) {
    for (let j = 0; j < targetTokens.length; j++) {
      const src = tokens[i];
      const dst = targetTokens[j];

      // Dynamic weight based on semantic connection
      let weight = (i === 1 && j === 2) || (i === 2 && j === 1) ? 0.92 : 0.15;
      if (i === j) weight = 0.45;

      const progress = clamp((t - 1.0) / 1.5);
      if (progress <= 0) continue;

      ctx.save();
      const isHighAttention = weight > 0.8;
      ctx.strokeStyle = isHighAttention
        ? `rgba(250, 204, 21, ${0.4 + Math.sin(t * 6) * 0.3})`
        : 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = isHighAttention ? 3.5 : 1.2;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y + 20);
      const cpY1 = src.y + 80;
      const cpY2 = dst.y - 80;
      ctx.bezierCurveTo(src.x, cpY1, dst.x, cpY2, dst.x, dst.y - 20);
      ctx.stroke();

      // Flowing Energy Packet along the high-attention connection
      if (isHighAttention && progress >= 0.5) {
        const flowT = ((t * 1.5) % 1.0);
        const bx = Math.pow(1 - flowT, 3) * src.x +
                   3 * Math.pow(1 - flowT, 2) * flowT * src.x +
                   3 * (1 - flowT) * Math.pow(flowT, 2) * dst.x +
                   Math.pow(flowT, 3) * dst.x;
        const by = Math.pow(1 - flowT, 3) * (src.y + 20) +
                   3 * Math.pow(1 - flowT, 2) * flowT * cpY1 +
                   3 * (1 - flowT) * Math.pow(flowT, 2) * cpY2 +
                   Math.pow(flowT, 3) * (dst.y - 20);

        ctx.fillStyle = '#FACC15';
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing attention weight badge
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 1.5;
        const badgeX = (src.x + dst.x) / 2 - 24;
        const badgeY = (src.y + dst.y) / 2 - 10;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, 48, 20, 4);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#FACC15';
        ctx.fillText('α: 0.94', badgeX + 5, badgeY + 14);
      }
      ctx.restore();
    }
  }

  // Draw Source & Target Token Pills
  function drawPillRow(row, isTarget = false) {
    row.forEach((tok, idx) => {
      ctx.save();
      const isActive = tok.label === '"Machines"' || tok.label === '"Think"';
      ctx.fillStyle = isActive ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = isActive ? '#38BDF8' : 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = isActive ? 2 : 1;

      ctx.beginPath();
      ctx.roundRect(tok.x - 42, tok.y - 18, 84, 36, 18);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = isActive ? '#FFFFFF' : '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText(tok.label, tok.x, tok.y + 5);

      // Label (Query vs Key)
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = isTarget ? '#A855F7' : '#38BDF8';
      ctx.fillText(isTarget ? `K[${idx}]` : `Q[${idx}]`, tok.x, tok.y + (isTarget ? 30 : -24));
      ctx.restore();
    });
  }

  drawPillRow(tokens, false);
  drawPillRow(targetTokens, true);
}

// -------------------------------------------------------------
// HIGH-END VISUALIZATION: DYNAMIC LOSS / CONVERGENCE HUD
// -------------------------------------------------------------
function drawConvergenceHUD(ctx, t) {
  const panelX = 890;
  const panelY = 160;
  const panelW = 340;
  const panelH = 320;

  ctx.save();
  // Glassmorphic HUD panel
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 12);
  ctx.fill();
  ctx.stroke();

  // Header
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#E2E8F0';
  ctx.fillText('OPTIMIZATION CONVERGENCE', panelX + 20, panelY + 34);

  // Live Loss metric readout
  const lossProgress = clamp((t - 1.5) / 6.0);
  const currentLoss = lerp(2.845, 0.014, ease(lossProgress)).toFixed(4);

  ctx.font = '900 28px monospace';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText(`L: ${currentLoss}`, panelX + 20, panelY + 70);

  ctx.font = '11px monospace';
  ctx.fillStyle = '#10B981';
  ctx.fillText('● GLOBAL MINIMUM REACHED', panelX + 160, panelY + 68);

  // Dynamic Graph Axes
  const graphX = panelX + 40;
  const graphY = panelY + 110;
  const graphW = panelW - 70;
  const graphH = 150;

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // Y-axis
  ctx.moveTo(graphX, graphY);
  ctx.lineTo(graphX, graphY + graphH);
  // X-axis
  ctx.lineTo(graphX + graphW, graphY + graphH);
  ctx.stroke();

  // Horizontal grid lines
  for (let gy = graphY; gy < graphY + graphH; gy += 38) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.beginPath();
    ctx.moveTo(graphX, gy);
    ctx.lineTo(graphX + graphW, gy);
    ctx.stroke();
  }

  // Animated Exponential Loss Curve
  const points = [];
  const maxPts = 60;
  const drawCount = Math.floor(maxPts * lossProgress);

  for (let i = 0; i <= maxPts; i++) {
    const normX = i / maxPts;
    // Exponential decay with slight stochastic noise
    const noise = Math.sin(i * 1.8) * 0.03 * (1 - normX);
    const normY = Math.exp(-normX * 3.8) + noise;

    const px = graphX + normX * graphW;
    const py = graphY + (1 - clamp(normY, 0, 1)) * graphH;
    points.push({ x: px, y: py });
  }

  if (drawCount > 1) {
    // Fill area under curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, graphY + graphH);
    for (let i = 0; i < drawCount; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[drawCount - 1].x, graphY + graphH);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, graphY, 0, graphY + graphH);
    fillGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Curve line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < drawCount; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Leading glowing cursor point
    const lead = points[drawCount - 1];
    ctx.fillStyle = '#FACC15';
    ctx.shadowColor = '#FACC15';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(lead.x, lead.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Bottom axis labels
  ctx.font = '10px monospace';
  ctx.fillStyle = '#64748B';
  ctx.fillText('0k iter', graphX, graphY + graphH + 18);
  ctx.fillText('500k iter', graphX + graphW - 55, graphY + graphH + 18);

  ctx.restore();
}

// -------------------------------------------------------------
// RENDER PIPELINE
// -------------------------------------------------------------
async function renderDemo() {
  console.log('Rendering 10-Second Elevated Technical Visualization Demo...');

  const ffmpeg = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', `${WIDTH}x${HEIGHT}`,
    '-r', `${FPS}`,
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '18',
    TEMP_VIDEO
  ]);

  ffmpeg.stdin.on('error', () => {});
  const completion = new Promise((res, rej) => {
    ffmpeg.on('close', code => code === 0 ? res() : rej(new Error('Video encode failed')));
  });

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    // 1. Background
    const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 50, WIDTH / 2, HEIGHT / 2, 850);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#05070c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Floor Cyber Grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 580);
      ctx.lineTo(x + (x - WIDTH / 2) * 0.4, HEIGHT);
      ctx.stroke();
    }
    for (let y = 580; y <= HEIGHT; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    // Top Brand Badge
    ctx.font = '900 13px monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText('PROGRAMS MAGIC // AI DEEP DIVE ARCHITECTURE', 48, 48);

    // 2. Draw Multi-Head Attention Graph
    drawAttentionNetwork(ctx, t);

    // 3. Draw Loss Convergence HUD
    drawConvergenceHUD(ctx, t);

    // 4. Animate Magi with Physical Kinematics
    let magiX = 140;
    let isWalking = false;
    let armAction = 'idle';

    if (t < 2.5) {
      // Walks in naturally from x=60 to x=220
      const walkP = ease(t / 2.5);
      magiX = lerp(60, 220, walkP);
      isWalking = true;
    } else if (t < 6.8) {
      // Standing and actively pointing with laser toward the high-attention connection
      magiX = 220;
      isWalking = false;
      armAction = 'point_right';
    } else {
      // Theatrically steps back 35px and crosses arms to admire convergence
      const stepP = ease((t - 6.8) / 1.2);
      magiX = lerp(220, 180, stepP);
      isWalking = stepP < 0.9;
      armAction = 'arms_crossed';
    }

    drawMagi(ctx, magiX, 600, {
      facing: 1,
      isWalking,
      armAction,
      t
    });

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

  console.log('Muxing video with 24kHz Gemini Bodi voiceover...');
  const mux = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-i', TEMP_VIDEO,
    '-i', AUDIO_PATH,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    FINAL_OUTPUT
  ]);

  await new Promise((res, rej) => {
    mux.on('close', code => code === 0 ? res() : rej(new Error('Mux failed')));
  });

  console.log(`✓ Super-Visualization Demo Ready: ${FINAL_OUTPUT}`);
}

renderDemo().catch(err => {
  console.error(err);
  process.exit(1);
});

