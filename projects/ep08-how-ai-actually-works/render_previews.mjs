import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const PROJECT_DIR = path.resolve('projects/ep08-how-ai-actually-works');
const EXPORTS_DIR = path.resolve('exports');

// -------------------------------------------------------------
// HELPER DRAWING FUNCTIONS
// -------------------------------------------------------------
function drawMagi(ctx, x, y, options = {}) {
  const { facing = 1, isWalking = false, armAction = 'idle', t = 0, scale = 1 } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const cycle = isWalking ? t * 9 : t * 2.2;
  const bounce = isWalking ? Math.abs(Math.sin(cycle)) * 5 : Math.sin(t * 2.2) * 1.5;
  const hipY = -70 - bounce;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 35, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bipedal Legs
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const legSwing = isWalking ? Math.sin(cycle) * 24 : 0;
  ctx.beginPath();
  ctx.moveTo(-10, hipY); ctx.lineTo(-10 + legSwing * 0.5, hipY + 36); ctx.lineTo(-10 + legSwing, 0); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, hipY); ctx.lineTo(10 - legSwing * 0.5, hipY + 36); ctx.lineTo(10 - legSwing, 0); ctx.stroke();

  // Torso
  const torsoLean = isWalking ? 4 * (facing || 1) : 0;
  ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(torsoLean, hipY - 55); ctx.stroke();

  const shoulderY = hipY - 55;
  const headY = shoulderY - 26;

  // Arms based on armAction
  let lHandX = -12, lHandY = shoulderY + 45;
  let rHandX = 12, rHandY = shoulderY + 45;

  if (armAction === 'point_right') {
    rHandX = 50; rHandY = shoulderY - 15;
    lHandX = -8; lHandY = shoulderY + 28;
  } else if (armAction === 'wand_wave') {
    const wave = Math.sin(t * 6) * 15;
    rHandX = 45 + wave; rHandY = shoulderY - 35;
    lHandX = -8; lHandY = shoulderY + 28;
  } else if (armAction === 'facepalm') {
    rHandX = 14; rHandY = headY;
    lHandX = -18; lHandY = shoulderY + 20;
  } else if (armAction === 'thumbs_up') {
    rHandX = 35; rHandY = shoulderY - 30;
    lHandX = -8; lHandY = shoulderY + 25;
  }

  // Left Arm
  ctx.beginPath(); ctx.moveTo(-4 + torsoLean, shoulderY); ctx.lineTo(-15, shoulderY + 20); ctx.lineTo(lHandX, lHandY); ctx.stroke();
  // Right Arm
  ctx.beginPath(); ctx.moveTo(4 + torsoLean, shoulderY); ctx.lineTo(15, shoulderY + 15); ctx.lineTo(rHandX, rHandY); ctx.stroke();

  // Magic Wand
  if (armAction === 'wand_wave' || armAction === 'point_right') {
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(rHandX, rHandY); ctx.lineTo(rHandX + 28, rHandY - 28); ctx.stroke();

    // Wand Star / Sparkle
    ctx.fillStyle = '#FACC15';
    ctx.shadowColor = '#FACC15';
    ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(rHandX + 28, rHandY - 28, 6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Yellow Scarf
  ctx.fillStyle = '#FACC15';
  ctx.strokeStyle = '#CA8A04';
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.roundRect(-4, shoulderY - 6, 24, 12, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, shoulderY); ctx.quadraticCurveTo(-14, shoulderY + 18, -18, shoulderY + 36);
  ctx.lineTo(-12, shoulderY + 38); ctx.quadraticCurveTo(-6, shoulderY + 20, 6, shoulderY + 6);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Head
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.arc(10, headY, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Glasses
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, headY - 6, 10, 8);
  ctx.strokeRect(18, headY - 6, 10, 8);
  ctx.beginPath(); ctx.arc(11, headY - 2, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#0F172A'; ctx.fill();
  ctx.beginPath(); ctx.arc(23, headY - 2, 2.5, 0, Math.PI * 2); ctx.fill();

  // Mouth
  ctx.beginPath();
  if (armAction === 'facepalm') {
    ctx.arc(16, headY + 8, 4, Math.PI, 0); // Frown
  } else {
    ctx.arc(16, headY + 5, 5, 0, Math.PI); // Smile
  }
  ctx.stroke();

  // Purple Wizard Hat with Gold Star
  ctx.save();
  ctx.translate(10, headY - 12);
  ctx.rotate(0.1);
  ctx.fillStyle = '#6366F1';
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-15, 0); ctx.quadraticCurveTo(-4, -24, 6, -36); ctx.quadraticCurveTo(8, -20, 15, 0);
  ctx.closePath(); ctx.fillStyle = '#4F46E5'; ctx.fill();
  ctx.fillStyle = '#FACC15'; ctx.beginPath(); ctx.arc(0, -16, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.restore();
}

// -------------------------------------------------------------
// 1. RENDER 16:9 WIDESCREEN ANIMATION SHOWCASE (15 SECONDS)
// -------------------------------------------------------------
async function renderShowcase16x9() {
  const WIDTH = 1280;
  const HEIGHT = 720;
  const FPS = 24;
  const DURATION = 15;
  const TOTAL_FRAMES = FPS * DURATION;
  const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP08-Animation-Showcase-Preview.mp4');

  console.log(`Rendering 16:9 Showcase: ${OUTPUT_FILE} (${TOTAL_FRAMES} frames)...`);

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
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    OUTPUT_FILE
  ]);

  const completion = new Promise((resolve, reject) => {
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`Encode failed (code ${code})`)));
  });

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const t = f / FPS;

    // Background
    const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 40, WIDTH / 2, HEIGHT / 2, 850);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Grid Floor
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 560); ctx.lineTo(x + (x - WIDTH / 2) * 0.3, HEIGHT); ctx.stroke();
    }
    for (let y = 560; y <= HEIGHT; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
    }

    // Top Header Watermark
    ctx.save();
    ctx.font = '900 13px monospace';
    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'left';
    ctx.fillText('PROGRAMS MAGIC // EPISODE 02 PREVIEW: HOW AI ACTUALLY WORKS', 50, 42);
    ctx.restore();

    // =========================================================
    // SCENE 1: THE VECTOR MATH BALANCE SCALE (0s - 5s)
    // =========================================================
    if (t < 5.0) {
      const localT = t;

      ctx.textAlign = 'left';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('SCENE 1: HOW WORDS BECOME NUMBERS (THE 3D SUPERMARKET & SCALE)', 50, 78);

      // Fulcrum & Scale
      const fulcrumX = 640;
      const fulcrumY = 380;
      const tilt = Math.sin(localT * 3) * Math.max(0, 1 - localT / 3.5) * 0.12;

      ctx.save();
      ctx.translate(fulcrumX, fulcrumY);
      ctx.rotate(tilt);

      // Beam
      ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(-340, 0); ctx.lineTo(340, 0); ctx.stroke();

      // Left Pan
      ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-280, 0); ctx.lineTo(-340, 90); ctx.moveTo(-280, 0); ctx.lineTo(-220, 90); ctx.stroke();
      ctx.fillStyle = '#1E293B'; ctx.fillRect(-360, 90, 160, 16);

      // Right Pan
      ctx.beginPath(); ctx.moveTo(280, 0); ctx.lineTo(220, 90); ctx.moveTo(280, 0); ctx.lineTo(340, 90); ctx.stroke();
      ctx.fillRect(200, 90, 160, 16);

      // Left Word Blocks
      ctx.fillStyle = '#4F46E5'; ctx.fillRect(-350, 25, 65, 60);
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText('KING', -317, 60);

      ctx.fillStyle = '#0284C7'; ctx.fillRect(-275, 25, 65, 60);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText('MAN', -242, 60);

      ctx.fillStyle = '#EC4899'; ctx.fillRect(-315, -45, 75, 60);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText('+WOMAN', -277, -10);

      // Right Word Block (QUEEN!)
      if (localT > 1.2) {
        ctx.save();
        ctx.fillStyle = '#FACC15'; ctx.shadowColor = '#FACC15'; ctx.shadowBlur = 24;
        ctx.fillRect(225, 10, 110, 75);
        ctx.restore();
        ctx.fillStyle = '#0F172A'; ctx.font = '900 20px monospace';
        ctx.fillText('QUEEN!', 280, 55);
      }

      ctx.restore();

      // Fulcrum Triangle
      ctx.fillStyle = '#334155';
      ctx.beginPath(); ctx.moveTo(fulcrumX, fulcrumY); ctx.lineTo(fulcrumX - 35, fulcrumY + 70); ctx.lineTo(fulcrumX + 35, fulcrumY + 70); ctx.closePath(); ctx.fill();

      // Magi Character
      const magiX = 160 + Math.min(localT * 20, 40);
      drawMagi(ctx, magiX, 560, {
        isWalking: localT < 2.0,
        armAction: localT > 2.0 ? 'wand_wave' : 'point_right',
        t
      });

      // Subtitle
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; ctx.strokeStyle = '#FACC15'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(140, 600, WIDTH - 280, 50, 8); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#FEF08A'; ctx.textAlign = 'center';
      ctx.fillText('VECTOR MATH: KING - MAN + WOMAN = QUEEN (WORDS ARE GPS COORDINATES!)', WIDTH / 2, 632);
    }

    // =========================================================
    // SCENE 2: FAST CHATBOT VS DETECTIVE REASONING (5s - 10s)
    // =========================================================
    else if (t < 10.0) {
      const localT = t - 5.0;

      ctx.textAlign = 'left';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.fillStyle = '#10B981';
      ctx.fillText('SCENE 2: FAST CHATBOT VS DEEP REASONING (OPENAI o1 & DEEPSEEK-R1)', 50, 78);

      // Left Box: Fast Chatbot Error
      const fX = 50, fY = 110, fW = 400, fH = 460;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)'; ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(fX, fY, fW, fH, 12); ctx.fill(); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#EF4444';
      ctx.fillText('SPECIES 1: FAST NEXT-TOKEN CHATBOT', fX + fW / 2, fY + 35);
      ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#FEF08A';
      ctx.fillText('"How many letter \'r\'s in strawberry?"', fX + fW / 2, fY + 75);

      // Red Buzzer
      ctx.fillStyle = Math.sin(localT * 8) > 0 ? '#DC2626' : '#EF4444';
      ctx.beginPath(); ctx.roundRect(fX + 50, fY + 110, fW - 100, 55, 10); ctx.fill();
      ctx.font = '900 22px monospace'; ctx.fillStyle = '#FFFFFF';
      ctx.fillText('ANSWER: "TWO!"', fX + fW / 2, fY + 145);

      ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#EF4444';
      ctx.fillText('[X] FAILED LOGIC (NO THINKING)', fX + fW / 2, fY + 200);

      // Right Box: Detective Reasoning Model with live <think> typing
      const dX = 480, dY = 110, dW = 750, dH = 460;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)'; ctx.strokeStyle = '#10B981'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(dX, dY, dW, dH, 12); ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#10B981';
      ctx.fillText('SPECIES 2: REASONING MODEL (<think> SCRATCHPAD)', dX + 25, dY + 35);

      // Live animated typewriter <think> box
      const scX = dX + 25, scY = dY + 60, scW = dW - 50, scH = 260;
      ctx.fillStyle = '#0F172A'; ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(scX, scY, scW, scH, 8); ctx.fill(); ctx.stroke();

      ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#38BDF8';
      ctx.fillText('<think>  // TEST-TIME COMPUTE STREAMING...', scX + 16, scY + 26);

      const streamLines = [
        '1. Inspect target: "s-t-r-a-w-b-e-r-r-y"',
        '2. Letter pos 1: s | pos 2: t | pos 3: r [MATCH #1!]',
        '3. Letter pos 4: a | pos 5: w | pos 6: b | pos 7: e',
        '4. Letter pos 8: r [MATCH #2!] | pos 9: r [MATCH #3!]',
        '5. Total count = 3 letter \'r\'s verified.'
      ];

      const visibleLines = Math.min(streamLines.length, Math.floor(localT * 1.5) + 1);
      ctx.fillStyle = '#FEF08A';
      for (let l = 0; l < visibleLines; l++) {
        ctx.fillText(streamLines[l], scX + 16, scY + 58 + l * 28);
      }

      if (visibleLines >= streamLines.length) {
        ctx.fillStyle = '#10B981';
        ctx.beginPath(); ctx.roundRect(dX + 25, dY + 340, dW - 50, 50, 8); ctx.fill();
        ctx.font = '900 18px monospace'; ctx.fillStyle = '#0F172A';
        ctx.fillText('FINAL ANSWER: "There are 3 letter \'r\'s in strawberry."', dX + 45, dY + 372);
      }

      // Magi Character
      drawMagi(ctx, 220, 560, {
        armAction: visibleLines >= streamLines.length ? 'thumbs_up' : 'point_right',
        t
      });

      // Subtitle
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; ctx.strokeStyle = '#10B981'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(140, 600, WIDTH - 280, 50, 8); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#10B981'; ctx.textAlign = 'center';
      ctx.fillText('REASONING TOKENS ALLOW AI TO DOUBLE-CHECK AND SELF-CORRECT BEFORE SPEAKING!', WIDTH / 2, 632);
    }

    // =========================================================
    // SCENE 3: MIXTURE OF EXPERTS 64-CHEF KITCHEN (10s - 15s)
    // =========================================================
    else {
      const localT = t - 10.0;

      ctx.textAlign = 'left';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.fillStyle = '#A855F7';
      ctx.fillText('SCENE 3: MIXTURE OF EXPERTS (DEEPSEEK-V3 64-CHEF RESTAURANT)', 50, 78);

      // Order Ticket (Left)
      const ordX = 50, ordY = 110, ordW = 280, ordH = 460;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)'; ctx.strokeStyle = '#FACC15'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(ordX, ordY, ordW, ordH, 12); ctx.fill(); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '900 15px monospace'; ctx.fillStyle = '#FACC15';
      ctx.fillText('INCOMING TOKEN', ordX + ordW / 2, ordY + 35);

      ctx.fillStyle = '#FEF08A'; ctx.fillRect(ordX + 25, ordY + 60, ordW - 50, 80);
      ctx.fillStyle = '#451A03'; ctx.font = 'bold 13px monospace';
      ctx.fillText('TOKEN #819:', ordX + ordW / 2, ordY + 95);
      ctx.font = '900 18px monospace';
      ctx.fillText('"def solve():"', ordX + ordW / 2, ordY + 125);

      // Smart Router
      ctx.fillStyle = '#10B981'; ctx.fillRect(ordX + 25, ordY + 170, ordW - 50, 45);
      ctx.font = '900 14px monospace'; ctx.fillStyle = '#0F172A';
      ctx.fillText('SMART ROUTER', ordX + ordW / 2, ordY + 198);

      ctx.font = '12px sans-serif'; ctx.fillStyle = '#CBD5E1';
      ctx.fillText('Routes to only 3 of 64 experts.', ordX + ordW / 2, ordY + 250);
      ctx.fillText('Other 61 experts stay asleep!', ordX + ordW / 2, ordY + 275);

      // Kitchen of 64 Experts (Right)
      const kitX = 360, kitY = 110, kitW = 870, kitH = 460;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)'; ctx.strokeStyle = '#A855F7'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(kitX, kitY, kitW, kitH, 12); ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#A855F7';
      ctx.fillText('64 SPECIALIZED EXPERT CHEFS (671B TOTAL PARAMETERS)', kitX + 30, kitY + 35);

      const cols = 8, rows = 6;
      const cw = 90, ch = 48;
      const startX = kitX + 30, startY = kitY + 60;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const ex = startX + c * (cw + 12);
          const ey = startY + r * (ch + 10);
          const isActive = (idx === 14 || idx === 15 || idx === 2);

          ctx.fillStyle = isActive ? 'rgba(16, 185, 129, 0.45)' : 'rgba(30, 41, 59, 0.6)';
          ctx.strokeStyle = isActive ? '#10B981' : '#475569';
          ctx.lineWidth = isActive ? 2.5 : 1;
          ctx.beginPath(); ctx.roundRect(ex, ey, cw, ch, 6); ctx.fill(); ctx.stroke();

          ctx.font = 'bold 11px monospace'; ctx.fillStyle = isActive ? '#10B981' : '#64748B';
          ctx.textAlign = 'center';
          ctx.fillText(`EXP #${idx + 1}`, ex + cw / 2, ey + 20);

          ctx.font = 'bold 9.5px monospace';
          ctx.fillText(isActive ? '[ACTIVE]' : 'zzz sleep', ex + cw / 2, ey + 36);
        }
      }

      // Animated energy beam from router to active expert
      const pulse = Math.sin(localT * 10) * 4;
      ctx.strokeStyle = '#10B981'; ctx.lineWidth = 3 + pulse * 0.3;
      ctx.beginPath();
      ctx.moveTo(ordX + ordW - 10, ordY + 192);
      ctx.bezierCurveTo(ordX + ordW + 80, ordY + 192, startX + 6 * 102 - 60, startY + 1 * 58 + 24, startX + 6 * 102, startY + 1 * 58 + 24);
      ctx.stroke();

      // Magi Character
      drawMagi(ctx, 160, 560, {
        armAction: 'wand_wave',
        t
      });

      // Subtitle
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; ctx.strokeStyle = '#A855F7'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(140, 600, WIDTH - 280, 50, 8); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#FEF08A'; ctx.textAlign = 'center';
      ctx.fillText('DEEPSEEK-V3: ONLY 37B OF 671B PARAMETERS ACTIVE PER WORD (95% POWER SAVINGS!)', WIDTH / 2, 632);
    }

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
  console.log('✓ 16:9 Showcase Rendered successfully!\n');
}

// -------------------------------------------------------------
// 2. RENDER 9:16 VERTICAL VIRAL REEL (STRAWBERRY REASONING, 8 SECONDS)
// -------------------------------------------------------------
async function renderReel9x16() {
  const WIDTH = 720;
  const HEIGHT = 1280;
  const FPS = 24;
  const DURATION = 8;
  const TOTAL_FRAMES = FPS * DURATION;
  const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP08-Reel-Strawberry-Vertical.mp4');

  console.log(`Rendering 9:16 Vertical Reel: ${OUTPUT_FILE} (${TOTAL_FRAMES} frames)...`);

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
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    OUTPUT_FILE
  ]);

  const completion = new Promise((resolve, reject) => {
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`Encode failed (code ${code})`)));
  });

  const subtitleWords = [
    { word: 'WHY', start: 0.0, end: 0.5 },
    { word: 'CHATGPT', start: 0.5, end: 1.1 },
    { word: 'FAILED', start: 1.1, end: 1.7 },
    { word: 'AT', start: 1.7, end: 2.1 },
    { word: 'STRAWBERRY,', start: 2.1, end: 2.8 },
    { word: 'AND', start: 2.8, end: 3.2 },
    { word: 'HOW', start: 3.2, end: 3.7 },
    { word: 'DEEPSEEK-R1', start: 3.7, end: 4.6 },
    { word: 'TAUGHT', start: 4.6, end: 5.2 },
    { word: 'ITSELF', start: 5.2, end: 5.8 },
    { word: 'TO', start: 5.8, end: 6.2 },
    { word: 'REASON!', start: 6.2, end: 8.0 }
  ];

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const t = f / FPS;

    // Background Gradient (Deep Navy Cyber)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, '#090D16');
    bgGrad.addColorStop(0.5, '#0F172A');
    bgGrad.addColorStop(1, '#05070C');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Top Header Badge (Hook)
    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(40, 70, WIDTH - 80, 80, 16); ctx.fill(); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '900 24px Impact, system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('WHY CHATGPT FAILED STRAWBERRY!', WIDTH / 2, 118);
    ctx.restore();

    // Middle Stage: Fast Chatbot vs Detective Stickman
    // 1. Fast Chatbot Box (Top half of screen)
    const fBoxY = 180;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(40, fBoxY, WIDTH - 80, 170, 14); ctx.fill(); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#EF4444';
    ctx.fillText('OLD AI (FAST NEXT-TOKEN PREDICTOR)', WIDTH / 2, fBoxY + 30);

    ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#FEF08A';
    ctx.fillText('"How many letter \'r\'s in strawberry?"', WIDTH / 2, fBoxY + 65);

    ctx.fillStyle = '#EF4444';
    ctx.beginPath(); ctx.roundRect(WIDTH / 2 - 140, fBoxY + 90, 280, 45, 10); ctx.fill();
    ctx.font = '900 20px monospace'; ctx.fillStyle = '#FFFFFF';
    ctx.fillText('ANSWER: "TWO!" [WRONG]', WIDTH / 2, fBoxY + 120);

    // 2. Detective Reasoning Model Box (Lower middle)
    const dBoxY = 380;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(40, dBoxY, WIDTH - 80, 390, 14); ctx.fill(); ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#10B981';
    ctx.fillText('DEEPSEEK-R1 & o1: REASONING SCRATCHPAD', 65, dBoxY + 35);

    // Live Streaming <think> Box
    const scY = dBoxY + 55;
    ctx.fillStyle = '#0F172A'; ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(65, scY, WIDTH - 130, 220, 10); ctx.fill(); ctx.stroke();

    ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#38BDF8';
    ctx.fillText('<think>  // REASONING TOKENS...', 80, scY + 28);

    const rSteps = [
      '1. Target: "s-t-r-a-w-b-e-r-r-y"',
      '2. Pos 1:s | 2:t | 3:r [FOUND #1]',
      '3. Pos 4:a | 5:w | 6:b | 7:e',
      '4. Pos 8:r [FOUND #2] | 9:r [FOUND #3]',
      '5. Length=10. Verified count: 3!'
    ];

    const showCount = Math.min(rSteps.length, Math.floor(t * 1.6) + 1);
    ctx.fillStyle = '#FEF08A';
    for (let s = 0; s < showCount; s++) {
      ctx.fillText(rSteps[s], 80, scY + 60 + s * 28);
    }

    if (showCount >= rSteps.length) {
      ctx.fillStyle = '#10B981';
      ctx.beginPath(); ctx.roundRect(65, dBoxY + 300, WIDTH - 130, 55, 10); ctx.fill();
      ctx.font = '900 18px monospace'; ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.fillText('FINAL: "3 letter \'r\'s!"', WIDTH / 2, dBoxY + 335);
    }

    // Magi Character in Lower Center
    drawMagi(ctx, WIDTH / 2 - 120, 950, {
      scale: 1.15,
      armAction: showCount >= rSteps.length ? 'thumbs_up' : 'point_right',
      t
    });

    // 3. VIRAL KARAOKE BOUNCING SUBTITLES (MoneyPrinterTurbo Style)
    const subY = 1040;
    ctx.save();
    ctx.textAlign = 'center';

    let activeWord = '';
    for (const sw of subtitleWords) {
      if (t >= sw.start && t < sw.end) {
        activeWord = sw.word;
        break;
      }
    }

    // Subtitle Container
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(40, subY, WIDTH - 80, 110, 16); ctx.fill(); ctx.stroke();

    // Bouncing Word
    if (activeWord) {
      const bounceScale = 1.0 + Math.sin((t % 0.4) * Math.PI * 2.5) * 0.15;
      ctx.save();
      ctx.translate(WIDTH / 2, subY + 60);
      ctx.scale(bounceScale, bounceScale);
      ctx.font = '900 32px Impact, system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 18;
      ctx.fillText(activeWord, 0, 10);
      ctx.restore();
    }

    ctx.restore();

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
  console.log('✓ 9:16 Vertical Reel Rendered successfully!\n');
}

// -------------------------------------------------------------
// RUN BOTH PREVIEW ENGINES
// -------------------------------------------------------------
async function main() {
  await renderShowcase16x9();
  await renderReel9x16();
  console.log('All animation previews generated in exports/ !');
}

main().catch(err => {
  console.error('Render preview error:', err);
  process.exit(1);
});

