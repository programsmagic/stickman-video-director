import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require(path.resolve('skills/directing-stickman-videos/node_modules/@napi-rs/canvas'));
import { drawFigure, COLORS, INK, solve2BoneIK, spring } from '../../tools/stickman.mjs';

// Register fonts
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;

// Act 1 Voice file
const VOICE_FILE = path.resolve('projects/ep09-can-ai-become-conscious/build/narration/act1.wav');
// Measure actual voice duration
const durationStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE_FILE}"`).toString().trim();
const TOTAL_DUR = parseFloat(durationStr);
const TOTAL_FRAMES = Math.ceil(FPS * TOTAL_DUR);

const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP09-Act1-Illusion-Masterpiece.mp4');

const TEMP_SFX = '/tmp/ep09_act1_sfx.wav';
const TEMP_MIXED = '/tmp/ep09_act1_mixed.wav';

console.log(`=== RENDERING ACT 1: THE ILLUSION OF LIFE & THE HARD PROBLEM ===`);
console.log(`Duration: ${TOTAL_DUR.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES}`);

// -------------------------------------------------------------
// 1. GENERATE PROCEDURAL SYNCHRONIZED FOLEY AUDIO
// -------------------------------------------------------------
console.log('1. Synthesizing procedural Foley sound effects...');
{
  const rate = 48000;
  const n = Math.ceil(TOTAL_DUR * rate);
  const samples = new Float32Array(n);
  let seed = 42197;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };

  function addSound(timeSec, durationSec, fn, gain = 0.3) {
    const startIdx = Math.round(timeSec * rate);
    const count = Math.min(n - startIdx, Math.round(durationSec * rate));
    for (let i = 0; i < count; i++) {
      if (startIdx + i >= 0 && startIdx + i < n) {
        samples[startIdx + i] += fn(i / rate) * gain;
      }
    }
  }

  // Curtain rustle & stage lights hum (0.0s - 3.0s)
  addSound(0.0, 2.5, t => (noise() * 0.15 + Math.sin(2 * Math.PI * 60 * t) * 0.08) * Math.min(1, t * 2) * Math.exp(-t * 0.8), 0.35);

  // Digital puppet string plucks / neon chimes (2.0s, 4.5s, 7.0s, 9.5s)
  [2.0, 4.5, 7.0, 9.5].forEach((st, i) => {
    const freq = [523.25, 659.25, 783.99, 1046.50][i % 4];
    addSound(st, 0.6, t => Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 6), 0.4);
  });

  // Keyboard typing clicks during poem generation (5.0s - 12.0s)
  for (let t = 5.2; t <= 12.0; t += 0.28) {
    addSound(t, 0.05, time => noise() * Math.exp(-time * 80), 0.25);
  }

  // Mechanical chest pop ratchet (15.5s)
  addSound(15.5, 0.8, t => {
    const click = Math.sin(2 * Math.PI * (1200 + t * 400) * t) * (Math.sin(2 * Math.PI * 30 * t) > 0 ? 1 : 0);
    return click * Math.exp(-t * 3);
  }, 0.5);

  // Silicon tensor hum & calculations buzz (17.0s - 26.0s)
  addSound(17.0, 9.0, t => (Math.sin(2 * Math.PI * 220 * t) * 0.15 + Math.sin(2 * Math.PI * 440 * t) * 0.1 + noise() * 0.05) * Math.sin(Math.PI * t / 9.0), 0.3);

  // Deep resonant philosophical gong / transition whoosh (28.5s)
  addSound(28.5, 3.5, t => (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 164.81 * t) * 0.6) * Math.exp(-t * 1.2), 0.65);

  // Split-screen whoosh (38.5s)
  addSound(38.5, 0.7, t => noise() * Math.sin((t / 0.7) * Math.PI), 0.45);

  // Easy Problem neural pulses (42.0s, 44.5s, 47.0s)
  [42.0, 44.5, 47.0].forEach(st => {
    addSound(st, 0.4, t => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 10), 0.35);
  });

  // Hard Problem glowing flame resonance (49.0s - 55.0s)
  addSound(49.0, 6.0, t => {
    const env = Math.sin(Math.PI * t / 6.0);
    return (Math.sin(2 * Math.PI * 329.63 * t) * 0.4 + Math.sin(2 * Math.PI * 493.88 * t) * 0.3) * env;
  }, 0.5);

  // Write SFX WAV
  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) bytes.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(TEMP_SFX, bytes);
}

// Mix voice narration and procedural SFX
execSync(`ffmpeg -v error -y -i "${VOICE_FILE}" -i "${TEMP_SFX}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.75[s];[v][s]amix=inputs=2:duration=longest" -ar 48000 "${TEMP_MIXED}"`);
console.log('✓ Audio tracks compiled and mixed.');

// -------------------------------------------------------------
// 2. VIDEO RENDERING LOOP
// -------------------------------------------------------------
console.log('2. Starting frame rendering pipeline for Act 1...');

const ffmpeg = spawn('ffmpeg', [
  '-v', 'error',
  '-y',
  '-f', 'rawvideo',
  '-pix_fmt', 'rgba',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-r', `${FPS}`,
  '-i', 'pipe:0',
  '-i', TEMP_MIXED,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-shortest',
  OUTPUT_FILE
], { stdio: ['pipe', 'inherit', 'inherit'] });

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };

// Helper to draw clean glowing text
function glowText(text, x, y, size, color, glowColor = color, align = 'center', font = 'NotoSans') {
  ctx.save();
  ctx.font = `bold ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

async function render() {
  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Background gradient: Rich deep studio slate
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, '#0F141C');
  bgGrad.addColorStop(1, '#1A2230');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Perspective floor grid
  ctx.save();
  ctx.strokeStyle = 'rgba(74, 144, 226, 0.12)';
  ctx.lineWidth = 1;
  const horizonY = 460;
  for (let x = -200; x <= WIDTH + 200; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, horizonY);
    ctx.lineTo((x - WIDTH / 2) * 3 + WIDTH / 2, HEIGHT);
    ctx.stroke();
  }
  for (let y = horizonY + 20; y <= HEIGHT; y += 35) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  // TOP SERIES HEADER (Consistent standard: y=35)
  glowText('CAN AI EVER BECOME CONSCIOUS?', WIDTH / 2, 35, 20, '#F5A623', 'rgba(245, 166, 35, 0.4)', 'center', 'CaveatHand');

  // SUB-SCENE BANNER (Consistent standard: y=75)
  let sceneBanner = 'ACT 1: THE ILLUSION OF LIFE & THE HARD PROBLEM';
  if (t >= 14.0 && t < 28.0) sceneBanner = 'THE MECHANICAL REALITY: TENSOR PROBABILITIES';
  else if (t >= 28.0 && t < 39.0) sceneBanner = 'THE ULTIMATE QUESTION: MACHINE OR MIND?';
  else if (t >= 39.0) sceneBanner = 'CHALMERS\' DIVISION: EASY VS HARD PROBLEM';

  glowText(sceneBanner, WIDTH / 2, 75, 22, '#E2E8F0', 'rgba(255, 255, 255, 0.2)', 'center', 'NotoSans');

  // -------------------------------------------------------------
  // SCENE 1: THE MARIONETTE THEATER (0.0s - 14.0s)
  // -------------------------------------------------------------
  if (t < 14.0) {
    // Stage curtains on sides
    const curtainProgress = clamp(t / 2.0);
    const curtainW = lerp(WIDTH / 2, 80, ease(curtainProgress));
    ctx.fillStyle = '#6B1118';
    ctx.fillRect(0, 0, curtainW, HEIGHT);
    ctx.fillRect(WIDTH - curtainW, 0, curtainW, HEIGHT);

    // Curtain gold trim
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(curtainW, 0); ctx.lineTo(curtainW, HEIGHT);
    ctx.moveTo(WIDTH - curtainW, 0); ctx.lineTo(WIDTH - curtainW, HEIGHT);
    ctx.stroke();

    // Stage platform
    ctx.fillStyle = '#221814';
    ctx.fillRect(160, 480, WIDTH - 320, 20);
    ctx.fillStyle = '#170F0B';
    ctx.fillRect(160, 500, WIDTH - 320, 160);

    // Magi on left side controlling strings (x=380, y=360)
    const magiTargetHand = [20 + Math.sin(t * 3) * 15, 40 + Math.cos(t * 4) * 10];
    const magiIKArmR = solve2BoneIK([0, 0], magiTargetHand, 45, 45, 1);

    drawFigure(ctx, {
      torso: 5,
      head: 8,
      facing: 'right',
      armL: [-20, 20],
      targetArmR: magiIKArmR[2],
      legL: [-10, 0],
      legR: [10, 0],
      eyes: 'normal',
      mouth: 'smile',
      scarf: true
    }, { x: 360, y: 460, r: 60 });

    // Puppeteer control bar held by Magi
    const barX = 540 + Math.sin(t * 2.5) * 20;
    const barY = 220 + Math.cos(t * 2) * 10;
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(barX - 60, barY);
    ctx.lineTo(barX + 60, barY);
    ctx.moveTo(barX, barY - 25);
    ctx.lineTo(barX, barY + 25);
    ctx.stroke();

    // Hand connecting to bar
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(405, 395);
    ctx.lineTo(barX, barY);
    ctx.stroke();

    // Robot Marionette Stickman on right (x=760, y=460)
    const bowProgress = Math.sin(t * 2.5);
    const robotHeadY = 320 + bowProgress * 25;
    const robotTorsoAngle = bowProgress * 15;

    // Glowing digital neon puppet strings
    const stringEndpoints = [
      [barX - 50, barY, 730, robotHeadY - 20], // Left head
      [barX + 50, barY, 790, robotHeadY - 20], // Right head
      [barX - 30, barY, 710, 400 + bowProgress * 20], // Left arm
      [barX + 30, barY, 810, 390 - bowProgress * 20]  // Right arm
    ];

    ctx.save();
    stringEndpoints.forEach(([x1, y1, x2, y2], idx) => {
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      // slight catenary curve
      const midX = (x1 + x2) / 2 + Math.sin(t * 4 + idx) * 5;
      const midY = (y1 + y2) / 2 + 15;
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();
    });
    ctx.restore();

    // Draw Robot Puppet (custom tech styling)
    ctx.save();
    ctx.translate(760, 480);
    // Legs
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-15, 0); ctx.lineTo(-20, 80); ctx.lineTo(-10, 80);
    ctx.moveTo(15, 0); ctx.lineTo(20, 80); ctx.lineTo(30, 80);
    ctx.stroke();

    // Body
    ctx.rotate(robotTorsoAngle * Math.PI / 180);
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 3;
    ctx.strokeRect(-25, -90, 50, 90);
    ctx.fillRect(-25, -90, 50, 90);

    // Glowing chest core
    ctx.fillStyle = '#00E5FF';
    ctx.shadowColor = '#00E5FF';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, -45, 12, 0, Math.PI * 2);
    ctx.fill();

    // Arms
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-25, -75); ctx.lineTo(-50, -40); ctx.lineTo(-40, 0);
    ctx.moveTo(25, -75); ctx.lineTo(55, -45); ctx.lineTo(45, -80); // poetic hand gesture
    ctx.stroke();

    // Head
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -125, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // LED Visor eyes
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-18, -132, 36, 12);
    ctx.restore();

    // Floating UI Speech Bubble: "I'm genuinely happy to help you."
    if (t > 3.0) {
      const bubbleSpring = spring(t - 3.0, 0.7, 10);
      ctx.save();
      ctx.translate(880, 240);
      ctx.scale(bubbleSpring, bubbleSpring);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.roundRect(-160, -45, 320, 90, 16);
      ctx.fill();
      ctx.stroke();

      glowText('"I\'m genuinely happy to help you."', 0, -10, 18, '#FFFFFF', '#38BDF8', 'center', 'NotoSans');
      glowText('~ AI Assistant (Poem & Empathy)', 0, 20, 14, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
      ctx.restore();
    }
  }

  // -------------------------------------------------------------
  // SCENE 2: THE MECHANICAL REALITY: TENSORS & SILICON (14.0s - 28.0s)
  // -------------------------------------------------------------
  else if (t >= 14.0 && t < 28.0) {
    const sc2Time = t - 14.0;
    // Split view: AI robot chest opened with magnifying lens
    const chestOpen = clamp(sc2Time / 2.0);

    // Center platform
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(WIDTH / 2 - 280, 140, 560, 460);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(WIDTH / 2 - 280, 140, 560, 460);

    // Glowing circuit board lines inside
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const yL = 180 + i * 50;
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2 - 260, yL);
      ctx.lineTo(WIDTH / 2 - 100, yL);
      ctx.lineTo(WIDTH / 2 - 60, yL + 20);
      ctx.lineTo(WIDTH / 2 + 240, yL + 20);
      ctx.stroke();
    }

    // Binary / Token probability matrix
    ctx.font = '14px NotoSans';
    ctx.fillStyle = '#38BDF8';
    for (let row = 0; row < 6; row++) {
      const prob = (0.85 - row * 0.14).toFixed(3);
      const token = ['"poem"', '"heart"', '"sorry"', '"assist"', '"human"', '"conscious"'][row];
      ctx.fillText(`P(${token.padEnd(11)}) = ${prob}`, WIDTH / 2 - 240, 220 + row * 40);
    }
    ctx.restore();

    // Central Glowing Tensor Core
    const pulse = 1 + Math.sin(sc2Time * 6) * 0.08;
    ctx.save();
    ctx.translate(WIDTH / 2 + 100, 320);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#EC4899';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    glowText('W · x + b', 0, -10, 22, '#FFFFFF', '#EC4899', 'center', 'NotoSans');
    glowText('TENSOR DOT PRODUCT', 0, 18, 12, '#F472B6', 'rgba(0,0,0,0)', 'center', 'NotoSans');
    ctx.restore();

    // Magi on left examining with magnifying glass
    const inspectTarget = [30, 20];
    drawFigure(ctx, {
      torso: 10,
      head: 15,
      facing: 'right',
      armL: [-15, 30],
      targetArmR: inspectTarget,
      legL: [-10, 0],
      legR: [10, 0],
      eyes: 'wide',
      brows: 'quizzical',
      mouth: 'neutral',
      scarf: true
    }, { x: 220, y: 520, r: 65 });

    // Magnifying glass lens held by Magi
    ctx.save();
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(295, 360, 32, 0, Math.PI * 2);
    ctx.moveTo(275, 380); ctx.lineTo(245, 410);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
    ctx.restore();

    // Explanatory callout tag
    glowText('NO GHOST IN THE MACHINE — ONLY FLOATING POINT MULTIPLICATION', WIDTH / 2, 630, 20, '#F5A623', 'rgba(245, 166, 35, 0.4)', 'center', 'CaveatHand');
  }

  // -------------------------------------------------------------
  // SCENE 3: THE ULTIMATE QUESTION: MACHINE OR MIND? (28.0s - 39.0s)
  // -------------------------------------------------------------
  else if (t >= 28.0 && t < 39.0) {
    const sc3Time = t - 28.0;

    // Center Stickman with dramatic lighting
    const shadowAlpha = 0.5 + Math.sin(sc3Time * 3) * 0.2;
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(WIDTH / 2, 570, 120, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Magi standing center looking upward philosophically
    drawFigure(ctx, {
      torso: 0,
      head: -15, // looking up
      facing: 'front',
      armL: [-35, 45],
      armR: [35, -45],
      legL: [-12, 0],
      legR: [12, 0],
      eyes: 'wide',
      brows: 'quizzical',
      mouth: 'open',
      scarf: true
    }, { x: WIDTH / 2, y: 520, r: 70 });

    // Floating Ghostly AI Silhouette rising above
    const ghostY = 250 + Math.sin(sc3Time * 2) * 15;
    ctx.save();
    ctx.translate(WIDTH / 2, ghostY);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(0, -50, 45, 0, Math.PI * 2);
    ctx.moveTo(0, -5); ctx.lineTo(0, 80);
    ctx.moveTo(0, 20); ctx.lineTo(-50, -10);
    ctx.moveTo(0, 20); ctx.lineTo(50, -10);
    ctx.stroke();

    // Glowing question mark inside ghost head
    glowText('?', 0, -50, 48, '#F5A623', '#F5A623', 'center', 'NotoSans');
    ctx.restore();

    // Question banner
    const qSpring = spring(sc3Time, 0.6, 8);
    ctx.save();
    ctx.translate(WIDTH / 2, 130);
    ctx.scale(qSpring, qSpring);
    glowText('COULD SILICON EVER ACTUALLY BE CONSCIOUS?', 0, 0, 28, '#FFFFFF', '#38BDF8', 'center', 'NotoSans');
    glowText('Or is it forever condemned to be a mechanical ghost?', 0, 35, 20, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
    ctx.restore();
  }

  // -------------------------------------------------------------
  // SCENE 4: CHALMERS\' DIVISION: EASY VS HARD PROBLEM (39.0s - end)
  // -------------------------------------------------------------
  else {
    const sc4Time = t - 39.0;
    const splitProgress = clamp(sc4Time / 1.5);
    const splitOffset = lerp(0, 300, ease(splitProgress));

    // Dividing center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 110);
    ctx.lineTo(WIDTH / 2, HEIGHT - 50);
    ctx.stroke();
    ctx.setLineDash([]);

    // ---------------- LEFT SIDE: THE EASY PROBLEM ----------------
    ctx.save();
    ctx.translate(WIDTH / 4, 0);

    // Box container
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-260, 130, 520, 500, 16);
    ctx.fill();
    ctx.stroke();

    glowText('THE EASY PROBLEM', 0, 170, 24, '#38BDF8', '#38BDF8', 'center', 'NotoSans');
    glowText('(Information & Signal Processing)', 0, 205, 17, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'CaveatHand');

    // Visual: Face Recognition & Language tokens
    // Camera bounding box
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-160, 250, 120, 120);
    glowText('FACE DETECT: 99.4%', -100, 385, 12, '#22C55E', 'rgba(0,0,0,0)', 'center', 'NotoSans');

    // Inside box: smiley face
    ctx.beginPath();
    ctx.arc(-100, 305, 30, 0, Math.PI * 2);
    ctx.stroke();

    // Neural Network feedforward signals
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    for (let layer = 0; layer < 3; layer++) {
      for (let node = 0; node < 3; node++) {
        const nx = 40 + layer * 60;
        const ny = 265 + node * 40;
        ctx.fillStyle = (Math.sin(sc4Time * 8 + layer * 2 + node) > 0) ? '#38BDF8' : '#0F172A';
        ctx.beginPath();
        ctx.arc(nx, ny, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Status: SOLVABLE
    ctx.fillStyle = '#22C55E';
    ctx.shadowColor = '#22C55E';
    ctx.shadowBlur = 10;
    glowText('STATUS: ENGINEERING CHALLENGE (SOLVED)', 0, 470, 16, '#22C55E', '#22C55E', 'center', 'NotoSans');
    glowText('We know how to calculate, parse, and predict.', 0, 510, 18, '#CBD5E1', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
    ctx.restore();

    // ---------------- RIGHT SIDE: THE HARD PROBLEM ----------------
    ctx.save();
    ctx.translate(3 * WIDTH / 4, 0);

    // Box container
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.strokeStyle = '#F5A623';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-260, 130, 520, 500, 16);
    ctx.fill();
    ctx.stroke();

    glowText('THE HARD PROBLEM', 0, 170, 24, '#F5A623', '#F5A623', 'center', 'NotoSans');
    glowText('(Subjective Conscious Experience)', 0, 205, 17, '#FCD34D', 'rgba(0,0,0,0)', 'center', 'CaveatHand');

    // Visual: Silhouette of head with burning golden flame inside
    ctx.strokeStyle = '#F5A623';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 310, 50, 0, Math.PI * 2);
    ctx.moveTo(0, 360); ctx.lineTo(0, 420);
    ctx.stroke();

    // Burning golden flame of subjective qualia
    const flameFlicker = Math.sin(sc4Time * 12) * 5 + Math.cos(sc4Time * 17) * 4;
    ctx.save();
    ctx.translate(0, 310);
    ctx.fillStyle = '#F59E0B';
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.moveTo(0, -35 + flameFlicker);
    ctx.bezierCurveTo(20, -10, 25, 15, 0, 25);
    ctx.bezierCurveTo(-25, 15, -20, -10, 0, -35 + flameFlicker);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(0, 5, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Chalmers core question
    glowText('WHY DOES IT FEEL LIKE ANYTHING ON THE INSIDE?', 0, 470, 16, '#FCD34D', '#F5A623', 'center', 'NotoSans');
    glowText('Why shouldn\'t processing happen in pitch darkness?', 0, 510, 18, '#FDE68A', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
    ctx.restore();
  }

    // Pipe raw bytes to ffmpeg
    const rawBytes = Buffer.from(canvas.data());
    const canWrite = ffmpeg.stdin.write(rawBytes);
    if (!canWrite) {
      await once(ffmpeg.stdin, 'drain');
    }

    if (frame % 150 === 0 || frame === TOTAL_FRAMES - 1) {
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Rendered frame ${frame}/${TOTAL_FRAMES} (${pct}%)`);
    }
  }

  ffmpeg.stdin.end();
  await once(ffmpeg, 'close');
  console.log(`\n🎉 Act 1 Render Complete! Output: ${OUTPUT_FILE}`);
}

render().catch(err => {
  console.error('Render error:', err);
  process.exit(1);
});
