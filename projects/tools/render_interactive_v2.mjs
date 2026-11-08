import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createCanvas } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 24;
const DURATION = 12.0;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const AUDIO_VOICE = path.resolve('exports/interactive_demo_voice.wav');
const AUDIO_SFX = path.resolve('/tmp/interactive_sfx.wav');
const AUDIO_MIXED = path.resolve('/tmp/interactive_mixed.wav');
const TEMP_VIDEO = path.resolve('/tmp/interactive_temp.mp4');
const OUTPUT_FILE = path.resolve('exports/interactive-pro-stickman-v2.mp4');

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function ease(t) {
  t = clamp(t);
  return t * t * (3 - 2 * t);
}

function easeOutBack(t) {
  t = clamp(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// -------------------------------------------------------------
// 1. SYNTHESIZE PROCEDURAL HIGH-DEFINITION FOLEY SFX
// -------------------------------------------------------------
function generateFoleyAudio() {
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const samples = new Float32Array(n);

  let seed = 42891;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };

  function addSound(timeSec, durationSec, fn, gain = 0.4) {
    const startIdx = Math.round(timeSec * rate);
    const count = Math.min(n - startIdx, Math.round(durationSec * rate));
    for (let i = 0; i < count; i++) {
      const t = i / rate;
      samples[startIdx + i] += fn(t) * gain;
    }
  }

  // 1. Button Tap / Click at t = 1.25s
  addSound(1.25, 0.12, t => {
    const env = Math.exp(-t * 45);
    return (noise() * 0.4 + Math.sin(2 * Math.PI * 480 * t) * 0.6) * env;
  }, 0.5);

  // 2. Whoosh / Energy Pulse at t = 1.6s
  addSound(1.6, 0.45, t => {
    const env = Math.sin((t / 0.45) * Math.PI);
    return noise() * env * 0.35;
  }, 0.4);

  // 3. Step 1 Blueprint Deploy at t = 3.6s
  addSound(3.6, 0.25, t => {
    const env = Math.exp(-t * 20);
    return Math.sin(2 * Math.PI * 520 * t) * env;
  }, 0.3);

  // 4. Step 2 Terminal Typing Clicks at t = 5.6s, 5.8s, 6.0s, 6.2s
  [5.6, 5.75, 5.9, 6.1, 6.3].forEach(clk => {
    addSound(clk, 0.04, t => (noise() * 0.5 + Math.sin(2 * Math.PI * 1200 * t) * 0.5) * Math.exp(-t * 90), 0.25);
  });

  // 5. Step 3 Success Bell Chime at t = 8.2s
  addSound(8.2, 0.9, t => {
    const env = Math.exp(-t * 4.5);
    return (Math.sin(2 * Math.PI * 880 * t) * 0.6 + Math.sin(2 * Math.PI * 1760 * t) * 0.3) * env;
  }, 0.45);

  // Write WAV
  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(n * 2, 40);

  for (let i = 0; i < n; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    bytes.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }
  fs.writeFileSync(AUDIO_SFX, bytes);
  console.log(`✓ Procedural Foley SFX synthesized to ${AUDIO_SFX}`);
}

// -------------------------------------------------------------
// 2. CHARACTER: MAGI WITH PHYSICAL OBJECT INTERACTIONS
// -------------------------------------------------------------
function drawInteractiveMagi(ctx, x, y, t, action) {
  ctx.save();
  ctx.translate(x, y);

  const bounce = Math.sin(t * 3) * 1.5;
  const hipY = -60 - bounce;

  // Ground shadow
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 36, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30, 35, 42, 0.16)';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 3.8;
  ctx.lineCap = 'round';

  // Legs
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(-14, 0);
  ctx.moveTo(0, hipY);
  ctx.lineTo(14, 0);
  ctx.stroke();

  // Torso
  const chestY = hipY - 75;
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(0, chestY);
  ctx.stroke();

  // ARMS & HANDS BASED ON ACTION
  if (action === 'tap_button') {
    // Left arm down
    ctx.beginPath();
    ctx.moveTo(0, chestY + 12);
    ctx.lineTo(-16, chestY + 45);
    ctx.stroke();

    // Right arm reaching forward and pressing button
    const reachProgress = clamp((t - 0.6) * 2.5);
    const handX = 25 + reachProgress * 65;
    const handY = chestY - 10 - reachProgress * 10;

    ctx.beginPath();
    ctx.moveTo(0, chestY + 12);
    ctx.lineTo(handX * 0.5, handY + 15);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // Finger press point
    ctx.fillStyle = '#1E232A';
    ctx.beginPath();
    ctx.arc(handX, handY, 3.5, 0, Math.PI * 2);
    ctx.fill();

  } else if (action === 'thumbs_up') {
    // Triumphant celebration
    ctx.beginPath();
    ctx.moveTo(0, chestY + 12);
    ctx.lineTo(-24, chestY - 15);
    ctx.lineTo(-30, chestY - 45);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, chestY + 12);
    ctx.lineTo(24, chestY - 15);
    ctx.lineTo(32, chestY - 45);
    ctx.stroke();

    // Thumbs up fist
    ctx.fillStyle = '#1E232A';
    ctx.beginPath();
    ctx.arc(32, chestY - 47, 4.5, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // Guiding / presenting towards the 3 cards
    ctx.beginPath();
    ctx.moveTo(0, chestY + 12);
    ctx.lineTo(-18, chestY + 45);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, chestY + 12);
    ctx.lineTo(35, chestY + 10);
    ctx.lineTo(75, chestY - 8);
    ctx.stroke();

    ctx.fillStyle = '#1E232A';
    ctx.beginPath();
    ctx.arc(77, chestY - 9, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scarf
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.roundRect(-14, chestY - 8, 28, 14, 4);
  ctx.fill();
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Scarf tail
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(6, chestY);
  ctx.quadraticCurveTo(18 + Math.sin(t * 4) * 4, chestY + 25, 26 + Math.sin(t * 5) * 6, chestY + 45);
  ctx.stroke();

  // Head
  const headY = chestY - 30;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.arc(0, headY, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Glasses
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(-8, headY - 2, 7.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(8, headY - 2, 7.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.5, headY - 2);
  ctx.lineTo(0.5, headY - 2);
  ctx.stroke();

  // Eyes (Blink and gaze)
  const isBlink = (t % 3.4) > 3.25;
  if (isBlink) {
    ctx.strokeStyle = '#1E232A';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-11, headY - 2); ctx.lineTo(-5, headY - 2);
    ctx.moveTo(5, headY - 2); ctx.lineTo(11, headY - 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#1E232A';
    const gaze = action === 'tap_button' ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(-8 + gaze, headY - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(8 + gaze, headY - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth
  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  if (action === 'thumbs_up') {
    // Big happy smile!
    ctx.arc(0, headY + 8, 7, 0.1 * Math.PI, 0.9 * Math.PI);
  } else {
    ctx.moveTo(-5, headY + 11);
    ctx.quadraticCurveTo(0, headY + 14, 5, headY + 11);
  }
  ctx.stroke();

  // Wizard Hat
  ctx.fillStyle = '#4B5563';
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = 2.8;

  ctx.beginPath();
  ctx.ellipse(0, headY - 20, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-23, headY - 20);
  ctx.lineTo(2, headY - 80);
  ctx.lineTo(23, headY - 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(0, headY - 23, 23, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// -------------------------------------------------------------
// 3. INTERACTIVE FLOATING BUTTON & TOUCH RIPPLE
// -------------------------------------------------------------
function drawInteractiveButton(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);

  const isPressed = t >= 1.25 && t < 1.6;
  const pressOffset = isPressed ? 3 : 0;

  // Button Shadow
  ctx.shadowColor = 'rgba(59, 130, 246, 0.35)';
  ctx.shadowBlur = isPressed ? 10 : 20;
  ctx.shadowOffsetY = isPressed ? 3 : 8;

  // Button Body
  ctx.fillStyle = isPressed ? '#2563EB' : '#3B82F6';
  ctx.beginPath();
  ctx.roundRect(0, pressOffset, 210, 48, 24);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Inner border highlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Icon (Paper airplane / Send icon)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(22, 24 + pressOffset);
  ctx.lineTo(36, 17 + pressOffset);
  ctx.lineTo(36, 31 + pressOffset);
  ctx.closePath();
  ctx.fill();

  // Button Label
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Send Goal: "Build Video"', 46, 29 + pressOffset);

  // Touch Ripple Wave at t = 1.25s
  if (t >= 1.25 && t < 2.2) {
    const ripT = (t - 1.25) / 0.95;
    const ripRadius = ripT * 70;
    const ripAlpha = (1 - ripT) * 0.8;

    ctx.save();
    ctx.strokeStyle = `rgba(59, 130, 246, ${ripAlpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(10, 24, ripRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Energy packet launch (arcs from button towards cards)
  if (t >= 1.6 && t < 3.2) {
    const arcT = (t - 1.6) / 1.6;
    const startX = 210;
    const startY = 24;
    const targetX = 350;
    const targetY = 120;

    const curX = startX + (targetX - startX) * arcT;
    const curY = startY + (targetY - startY) * Math.sin(arcT * Math.PI * 0.5) - Math.sin(arcT * Math.PI) * 50;

    ctx.save();
    ctx.fillStyle = '#60A5FA';
    ctx.shadowColor = '#3B82F6';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(curX, curY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Trail
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(startX + 60, startY - 40, curX, curY);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// -------------------------------------------------------------
// 4. THE 3 CRYSTAL-CLEAR STEP CARDS
// -------------------------------------------------------------
function drawStepCard(ctx, x, y, options) {
  const {
    stepNum,
    title,
    subtitle,
    color,
    iconKind,
    animProgress,
    interactiveContent
  } = options;

  if (animProgress <= 0) return;

  ctx.save();
  ctx.translate(x, y);

  // Pop-in bounce scale
  const scale = easeOutBack(animProgress);
  ctx.scale(scale, scale);

  const cardW = 270;
  const cardH = 340;

  // Card Shadow
  ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;

  // Card Base
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, cardW, cardH, 16);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  // Step Top Header Tag
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(16, 16, 80, 24, 12);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`STEP ${stepNum}`, 56, 33);

  // Big Central Icon
  ctx.save();
  ctx.translate(cardW / 2, 85);

  // Icon Circle Background
  ctx.fillStyle = `${color}18`;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw Specific Icon
  if (iconKind === 'brain') {
    // AI Brain / Blueprint
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(-10, -5, 10, Math.PI * 0.5, Math.PI * 1.8);
    ctx.arc(-5, -14, 8, Math.PI * 0.9, Math.PI * 2);
    ctx.arc(5, -14, 8, Math.PI, Math.PI * 2.1);
    ctx.arc(10, -5, 10, Math.PI * 1.2, Math.PI * 0.5);
    ctx.stroke();
    // Inner connection nodes
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

  } else if (iconKind === 'terminal') {
    // Terminal Window
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-22, -18, 44, 36, 6);
    ctx.fill();
    // Console prompt '>_'
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('>_', 0, 5);

  } else if (iconKind === 'shield') {
    // Verified Shield Badge
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(20, -10);
    ctx.lineTo(16, 12);
    ctx.lineTo(0, 22);
    ctx.lineTo(-16, 12);
    ctx.lineTo(-20, -10);
    ctx.closePath();
    ctx.fill();

    // Checkmark inside shield
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(-1, 6);
    ctx.lineTo(8, -6);
    ctx.stroke();
  }
  ctx.restore();

  // Card Title & Subtitle
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, cardW / 2, 155);

  ctx.fillStyle = '#64748B';
  ctx.font = '12px sans-serif';
  ctx.fillText(subtitle, cardW / 2, 175);

  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(20, 192);
  ctx.lineTo(cardW - 20, 192);
  ctx.stroke();

  // Interactive Content Section
  if (interactiveContent) {
    interactiveContent(ctx, cardW, cardH);
  }

  ctx.restore();
}

// -------------------------------------------------------------
// 5. MASTER RENDER PIPELINE
// -------------------------------------------------------------
async function renderInteractiveVideo() {
  console.log(`\n=================================================`);
  console.log(`Rendering Interactive Explainer V2 with Foley & Audio`);
  console.log(`Target: ${OUTPUT_FILE}`);
  console.log(`=================================================\n`);

  // Step 1: Synthesize Foley audio
  generateFoleyAudio();

  // Step 2: Mix Bodi narration + Procedural Foley Audio
  console.log('Mixing narration audio with synchronized Foley sound effects...');
  const mixFfmpeg = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-i', AUDIO_VOICE,
    '-i', AUDIO_SFX,
    '-filter_complex', '[0:a]volume=1.0[a0];[1:a]volume=0.85[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[out]',
    '-map', '[out]',
    AUDIO_MIXED
  ]);

  await new Promise((res, rej) => {
    mixFfmpeg.on('close', code => code === 0 ? res() : rej(new Error('Audio mix failed')));
  });
  console.log(`✓ Audio mixed successfully to ${AUDIO_MIXED}`);

  // Step 3: Render video frames via rawvideo pipe
  console.log(`Rendering ${TOTAL_FRAMES} high-definition frames...`);
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
    TEMP_VIDEO
  ]);

  let ffmpegErr = '';
  ffmpeg.stderr.on('data', d => { ffmpegErr += d.toString(); });

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    // Subtle continuous camera drift
    const zoom = 1.0 + (t / DURATION) * 0.025;
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);

    // Warm minimalist studio floor & ambient gradient
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Blueprint grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
    ctx.lineWidth = 1.0;
    for (let gx = 0; gx < WIDTH; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, HEIGHT); ctx.stroke();
    }
    for (let gy = 0; gy < HEIGHT; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(WIDTH, gy); ctx.stroke();
    }

    // TOP BANNER
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('AUTONOMOUS AI ARCHITECTURE // HOW AGENTS WORK', 56, 44);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('The 3-Step Autonomous Loop', 56, 76);

    // 1. Interactive Button (t = 0.4s to 2.8s)
    drawInteractiveButton(ctx, 56, 105, t);

    // 2. Character Magi
    let action = 'idle';
    if (t < 2.2) action = 'tap_button';
    else if (t >= 8.6) action = 'thumbs_up';
    else action = 'pointing';

    drawInteractiveMagi(ctx, 160, 560, t, action);

    // 3. THE 3 CRYSTAL-CLEAR STEP CARDS
    const cardY = 135;

    // CARD 1: BREAK DOWN (Appears at t = 3.2s)
    const card1T = ease((t - 3.2) * 2.0);
    drawStepCard(ctx, 390, cardY, {
      stepNum: 1,
      title: 'Break Down Goal',
      subtitle: 'Split into micro-tasks',
      color: '#4F46E5',
      iconKind: 'brain',
      animProgress: card1T,
      interactiveContent: (c, w, h) => {
        // 3 Micro-Task Checklist Pills
        const tasks = ['1. Read codebase', '2. Plan architecture', '3. Execute tools'];
        tasks.forEach((tsk, i) => {
          const pillProgress = clamp((t - (3.8 + i * 0.4)) * 3);
          c.fillStyle = pillProgress > 0.5 ? '#EEF2FF' : '#F8FAFC';
          c.strokeStyle = pillProgress > 0.5 ? '#6366F1' : '#E2E8F0';
          c.lineWidth = 1;
          c.beginPath();
          c.roundRect(20, 210 + i * 36, w - 40, 28, 6);
          c.fill();
          c.stroke();

          c.fillStyle = pillProgress > 0.5 ? '#4338CA' : '#94A3B8';
          c.font = 'bold 12px sans-serif';
          c.textAlign = 'left';
          c.fillText(tsk, 34, 229 + i * 36);

          if (pillProgress > 0.5) {
            c.fillStyle = '#4F46E5';
            c.font = 'bold 12px sans-serif';
            c.fillText('✔', w - 42, 229 + i * 36);
          }
        });
      }
    });

    // CARD 2: WRITE CODE (Appears at t = 5.2s)
    const card2T = ease((t - 5.2) * 2.0);
    drawStepCard(ctx, 680, cardY, {
      stepNum: 2,
      title: 'Execute Tools',
      subtitle: 'Write code & scripts',
      color: '#0F172A',
      iconKind: 'terminal',
      animProgress: card2T,
      interactiveContent: (c, w, h) => {
        // Mini Code Terminal Window
        c.fillStyle = '#1E293B';
        c.beginPath();
        c.roundRect(18, 205, w - 36, 115, 8);
        c.fill();

        // Terminal window dots
        c.fillStyle = '#EF4444'; c.beginPath(); c.arc(32, 218, 3.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#F59E0B'; c.beginPath(); c.arc(43, 218, 3.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#10B981'; c.beginPath(); c.arc(54, 218, 3.5, 0, Math.PI * 2); c.fill();

        // Terminal text typing effect
        const codeProgress = clamp((t - 5.6) / 1.5);
        const codeText = '> run_task(auto=True)\n> compile_film()\n✓ Build: SUCCESS';
        const chars = Math.floor(codeProgress * codeText.length);
        const currentLines = codeText.slice(0, chars).split('\n');

        c.fillStyle = '#38BDF8';
        c.font = '11px monospace';
        c.textAlign = 'left';
        currentLines.forEach((ln, lIdx) => {
          c.fillText(ln, 26, 242 + lIdx * 18);
        });
      }
    });

    // CARD 3: VERIFY RESULT (Appears at t = 7.4s)
    const card3T = ease((t - 7.4) * 2.0);
    drawStepCard(ctx, 970, cardY, {
      stepNum: 3,
      title: 'Verify & Ship',
      subtitle: 'Automated QA check',
      color: '#059669',
      iconKind: 'shield',
      animProgress: card3T,
      interactiveContent: (c, w, h) => {
        // Big verified completion badge
        c.fillStyle = '#ECFDF5';
        c.strokeStyle = '#10B981';
        c.lineWidth = 1.5;
        c.beginPath();
        c.roundRect(20, 210, w - 40, 65, 10);
        c.fill();
        c.stroke();

        c.fillStyle = '#047857';
        c.font = 'bold 15px sans-serif';
        c.textAlign = 'center';
        c.fillText('0 ERRORS FOUND', w / 2, 238);

        c.fillStyle = '#059669';
        c.font = '12px sans-serif';
        c.fillText('Production Ready (0.4s)', w / 2, 258);

        // Success metric callout
        if (t >= 8.5) {
          c.fillStyle = '#065F46';
          c.font = 'bold 13px sans-serif';
          c.fillText('⚡ 100% Autonomous', w / 2, 305);
        }
      }
    });

    ctx.restore();

    // Pipe raw buffer to ffmpeg
    const buffer = canvas.data();
    ffmpeg.stdin.write(buffer);
  }

  ffmpeg.stdin.end();

  await new Promise((res, rej) => {
    ffmpeg.on('close', code => code === 0 ? res() : rej(new Error(`Encode failed: ${ffmpegErr}`)));
  });

  // Step 4: Final Mux with Mixed Audio (Voiceover + Synced Foley SFX)
  console.log('Muxing final video with mixed narration and Foley audio...');
  const finalMux = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-i', TEMP_VIDEO,
    '-i', AUDIO_MIXED,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    OUTPUT_FILE
  ]);

  await new Promise((res, rej) => {
    finalMux.on('close', code => code === 0 ? res() : rej(new Error('Final mux failed')));
  });

  console.log(`\n🎉 Interactive Pro Explainer V2 rendered successfully!`);
  console.log(`File: ${OUTPUT_FILE}`);
}

renderInteractiveVideo().catch(err => {
  console.error(err);
  process.exit(1);
});

