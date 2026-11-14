import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, GlobalFonts } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

// Register fonts
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const DURATION = 15.0; // 15-second high-energy hybrid showcase
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP08-Hybrid-Vector-Miracle-Masterpiece.mp4');
const TEMP_VIDEO = '/tmp/ep08_hybrid_temp.mp4';
const TEMP_SFX = '/tmp/ep08_hybrid_sfx.wav';
const TEMP_VOICE = '/tmp/ep08_hybrid_voice.wav';
const TEMP_MIXED_AUDIO = '/tmp/ep08_hybrid_audio.wav';

// Math & Easing Helpers
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOutBack = t => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// -------------------------------------------------------------
// 1. GENERATE AUDIO & NARRATION
// -------------------------------------------------------------
console.log('1. Synthesizing voice & sound effects...');
const narrationText = "Words aren't magic to a computer. They're coordinates in a 3D supermarket of meaning! Take King, subtract Man, add Woman... and the math slides directly onto Queen! It's pure geometry.";
execSync(`say -v Samantha "${narrationText}" -o "${TEMP_VOICE}" --data-format=LEI16@48000`);

// Synthesize procedural Foley SFX track
{
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const samples = new Float32Array(n);
  let seed = 42135;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };

  function addSound(timeSec, durationSec, fn, gain = 0.3) {
    const startIdx = Math.round(timeSec * rate);
    const count = Math.min(n - startIdx, Math.round(durationSec * rate));
    for (let i = 0; i < count; i++) samples[startIdx + i] += fn(i / rate) * gain;
  }

  // Jetpack whoosh / rocket thrust (t = 0.5s - 4.0s)
  addSound(0.5, 3.5, t => (noise() * 0.4 + Math.sin(2 * Math.PI * 80 * t) * 0.4) * Math.sin((t / 3.5) * Math.PI), 0.25);
  // Whoosh entrance for 3D Grid (t = 1.0s)
  addSound(1.0, 0.8, t => Math.sin(2 * Math.PI * (180 + t * 400) * t) * Math.exp(-t * 3.5), 0.3);
  // King block drop thud (t = 3.8s)
  addSound(3.8, 0.25, t => (noise() * 0.5 + Math.sin(2 * Math.PI * 120 * t) * 0.8) * Math.exp(-t * 18), 0.5);
  // Wrench slam & spark zap on "subtract Man" (t = 6.2s)
  addSound(6.2, 0.4, t => (noise() * 0.7 + Math.sin(2 * Math.PI * 650 * t) * 0.5) * Math.exp(-t * 12), 0.6);
  // Mechanical snap for "add Woman" (t = 8.5s)
  addSound(8.5, 0.3, t => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 22), 0.45);
  // Sci-fi coordinate computation hum (t = 9.5s - 12.0s)
  addSound(9.5, 2.5, t => Math.sin(2 * Math.PI * (220 + Math.sin(t * 14) * 80) * t) * Math.sin((t / 2.5) * Math.PI), 0.35);
  // Queen explosion shockwave & victory fanfare chime (t = 12.0s)
  addSound(12.0, 2.2, t => {
    const env = Math.exp(-t * 2.5);
    return (
      Math.sin(2 * Math.PI * 523.25 * t) * 0.4 + // C5
      Math.sin(2 * Math.PI * 659.25 * t) * 0.35 + // E5
      Math.sin(2 * Math.PI * 783.99 * t) * 0.3 + // G5
      Math.sin(2 * Math.PI * 1046.5 * t) * 0.25 // C6
    ) * env;
  }, 0.65);

  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) bytes.writeInt16LE(Math.round(clamp(samples[i], -1, 1) * 32767), 44 + i * 2);
  fs.writeFileSync(TEMP_SFX, bytes);
}

// Mix voice and sfx with ffmpeg
execSync(`ffmpeg -v error -y -i "${TEMP_VOICE}" -i "${TEMP_SFX}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.85[s];[v][s]amix=inputs=2:duration=longest" -ar 48000 "${TEMP_MIXED_AUDIO}"`);
console.log('✓ Audio tracks mixed successfully.');

// -------------------------------------------------------------
// 2. 3D PROJECTION & MANIM-STYLE MATHEMATICAL GRID
// -------------------------------------------------------------
function project3D(x, y, z, rotY, rotX, fov = 650, cx = 640, cy = 340) {
  // Rotate around Y
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  const x1 = x * cosY + z * sinY;
  const z1 = -x * sinY + z * cosY;

  // Rotate around X
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  const y2 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;

  const depth = fov / (fov + z2 + 400);
  return {
    x: cx + x1 * depth,
    y: cy + y2 * depth,
    z: z2,
    scale: depth
  };
}

// -------------------------------------------------------------
// 3. EXPRESSIVE CHARACTER ACTING (MAGI WITH FLIPBOOK BOIL)
// -------------------------------------------------------------
function drawMagiActor(ctx, x, y, options = {}) {
  const {
    t = 0,
    action = 'jetpack', // 'jetpack', 'wrench_slam', 'hold_woman', 'shocked_flyback', 'thumbs_up'
    facing = 1,
    scale = 1
  } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);

  // Line boil wobble seed
  const boilSeed = Math.floor(t * 12);
  const wobble = Math.sin(boilSeed * 4.3) * 1.5;

  const hipY = -70;
  const shoulderY = hipY - 55;
  const headY = shoulderY - 26;

  // Contact / Hover Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  const shadowSpread = action === 'jetpack' ? 24 : 36;
  ctx.ellipse(0, 10, shadowSpread, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jetpack Rocket Prop
  if (action === 'jetpack' || action === 'shocked_flyback') {
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 3;
    ctx.roundRect(-24, shoulderY + 8, 16, 42, 4);
    ctx.fill(); ctx.stroke();

    // Rocket exhaust flame (pulsing)
    const flameH = 25 + Math.sin(t * 30) * 12;
    const flameGrad = ctx.createLinearGradient(0, shoulderY + 50, 0, shoulderY + 50 + flameH);
    flameGrad.addColorStop(0, '#FACC15');
    flameGrad.addColorStop(0.6, '#EF4444');
    flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-22, shoulderY + 50);
    ctx.lineTo(-16, shoulderY + 50 + flameH);
    ctx.lineTo(-10, shoulderY + 50);
    ctx.fill();
    ctx.restore();
  }

  // Legs
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let lFootX = -15, lFootY = 0;
  let rFootX = 15, rFootY = 0;

  if (action === 'jetpack') {
    lFootX = -18 + Math.sin(t * 6) * 6; lFootY = -12;
    rFootX = 8 + Math.cos(t * 6) * 6; rFootY = -18;
  } else if (action === 'shocked_flyback') {
    lFootX = -35; lFootY = -35;
    rFootX = -15; rFootY = -50;
  }

  ctx.beginPath(); ctx.moveTo(-6, hipY); ctx.lineTo(lFootX * 0.6, hipY + 36); ctx.lineTo(lFootX, lFootY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, hipY); ctx.lineTo(rFootX * 0.6, hipY + 36); ctx.lineTo(rFootX, rFootY); ctx.stroke();

  // Torso
  const torsoTilt = action === 'jetpack' ? 6 : action === 'shocked_flyback' ? -18 : 2;
  ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(torsoTilt, shoulderY); ctx.stroke();

  // Arms
  let lHandX = -18, lHandY = shoulderY + 35;
  let rHandX = 22, rHandY = shoulderY + 25;

  if (action === 'jetpack') {
    rHandX = 42; rHandY = shoulderY - 20; // pointing forward
    lHandX = -18; lHandY = shoulderY + 15;
  } else if (action === 'wrench_slam') {
    rHandX = 35; rHandY = shoulderY + 65; // slamming down
    lHandX = -15; lHandY = shoulderY - 10;
  } else if (action === 'shocked_flyback') {
    rHandX = 45; rHandY = headY - 15; // hands up in panic!
    lHandX = -35; lHandY = headY - 10;
  } else if (action === 'thumbs_up') {
    rHandX = 38; rHandY = shoulderY - 22;
    lHandX = -12; lHandY = shoulderY + 28;
  }

  // Left Arm
  ctx.beginPath(); ctx.moveTo(-4 + torsoTilt, shoulderY); ctx.lineTo((lHandX - 4) * 0.5, shoulderY + 20); ctx.lineTo(lHandX, lHandY); ctx.stroke();
  // Right Arm
  ctx.beginPath(); ctx.moveTo(4 + torsoTilt, shoulderY); ctx.lineTo((rHandX + 4) * 0.5, shoulderY + 15); ctx.lineTo(rHandX, rHandY); ctx.stroke();

  // Yellow Scarf
  ctx.fillStyle = '#E8B32A';
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-4 + torsoTilt, shoulderY - 6, 26, 12, 4); ctx.fill(); ctx.stroke();
  const scarfWave = Math.sin(t * 12) * 8;
  ctx.beginPath();
  ctx.moveTo(2 + torsoTilt, shoulderY);
  ctx.quadraticCurveTo(-16, shoulderY + 18, -22 + scarfWave, shoulderY + 38);
  ctx.lineTo(-14 + scarfWave, shoulderY + 40);
  ctx.quadraticCurveTo(-8, shoulderY + 20, 6 + torsoTilt, shoulderY + 6);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Head
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 3.6;
  ctx.beginPath(); ctx.arc(torsoTilt, headY, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Eyes & Mouth based on emotion
  ctx.fillStyle = '#0F172A';
  if (action === 'shocked_flyback') {
    // Wide shocked eyes
    ctx.beginPath(); ctx.arc(torsoTilt - 6, headY - 2, 4, 0, Math.PI * 2); ctx.arc(torsoTilt + 8, headY - 2, 4, 0, Math.PI * 2); ctx.fill();
    // Open screaming mouth
    ctx.beginPath(); ctx.arc(torsoTilt + 2, headY + 10, 6, 0, Math.PI * 2); ctx.fill();
  } else {
    // Normal confident cartoon eyes
    ctx.beginPath(); ctx.arc(torsoTilt - 5, headY - 2, 3, 0, Math.PI * 2); ctx.arc(torsoTilt + 7, headY - 2, 3, 0, Math.PI * 2); ctx.fill();
    // Grin
    ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(torsoTilt + 2, headY + 4, 7, 0.2, Math.PI - 0.2); ctx.stroke();
  }

  // Wizard Hat (Purple with Gold Star)
  const hatTilt = torsoTilt + (action === 'shocked_flyback' ? -15 : 4);
  ctx.fillStyle = '#6B4BD8';
  ctx.strokeStyle = '#432B94';
  ctx.lineWidth = 2.8;
  // Brim
  ctx.beginPath(); ctx.ellipse(hatTilt, headY - 18, 30, 6, 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Cone
  ctx.beginPath();
  ctx.moveTo(hatTilt - 18, headY - 18);
  ctx.quadraticCurveTo(hatTilt - 5, headY - 55, hatTilt + 20, headY - 65);
  ctx.lineTo(hatTilt + 16, headY - 18);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Gold Star
  ctx.fillStyle = '#FACC15';
  ctx.beginPath(); ctx.arc(hatTilt + 10, headY - 42, 5, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// -------------------------------------------------------------
// 4. MAIN RENDER LOOP
// -------------------------------------------------------------
async function renderVideo() {
  console.log(`2. Starting render of ${TOTAL_FRAMES} frames (${DURATION}s at ${FPS} fps)...`);

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
    TEMP_VIDEO
  ]);

  ffmpeg.stdin.on('error', () => {});
  let errorMsg = '';
  ffmpeg.stderr.on('data', chunk => { errorMsg += chunk.toString(); });

  const completion = new Promise((resolve, reject) => {
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`Encode failed (code ${code}): ${errorMsg}`)));
  });

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const t = f / FPS;

    // Dark sci-fi paper gradient background (Kurzgesagt / 3Blue1Brown aesthetic)
    const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 80, WIDTH / 2, HEIGHT / 2, 800);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Dynamic 3D Camera Rotation (smooth orbital motion)
    const camRotY = Math.sin(t * 0.35) * 0.28 + 0.15;
    const camRotX = 0.32 + Math.cos(t * 0.25) * 0.08;

    // ---------------------------------------------------------
    // A. 3D PERSPECTIVE COORDINATE GRID (MANIM / EP07 STYLE)
    // ---------------------------------------------------------
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';

    const gridSize = 450;
    const gridStep = 75;

    // Floor plane (X-Z)
    for (let x = -gridSize; x <= gridSize; x += gridStep) {
      const p1 = project3D(x, 180, -gridSize, camRotY, camRotX);
      const p2 = project3D(x, 180, gridSize, camRotY, camRotX);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    for (let z = -gridSize; z <= gridSize; z += gridStep) {
      const p1 = project3D(-gridSize, 180, z, camRotY, camRotX);
      const p2 = project3D(gridSize, 180, z, camRotY, camRotX);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }

    // Glowing 3D Axes with Labels
    const origin = project3D(0, 180, 0, camRotY, camRotX);
    const axisX = project3D(350, 180, 0, camRotY, camRotX);
    const axisY = project3D(0, -180, 0, camRotY, camRotX);
    const axisZ = project3D(0, 180, 350, camRotY, camRotX);

    // X Axis (Red)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(axisX.x, axisX.y); ctx.stroke();
    // Y Axis (Green)
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(axisY.x, axisY.y); ctx.stroke();
    // Z Axis (Blue)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(axisZ.x, axisZ.y); ctx.stroke();

    ctx.restore();

    // ---------------------------------------------------------
    // B. FLOATING 3D EMBEDDING NODES (THE 3D SUPERMARKET)
    // ---------------------------------------------------------
    const nodes = [
      { text: 'APPLE', x: -280, y: 140, z: -180, color: '#22C55E' },
      { text: 'BANANA', x: -240, y: 160, z: -210, color: '#EAB308' },
      { text: 'DOG', x: 260, y: 120, z: -150, color: '#38BDF8' },
      { text: 'PUPPY', x: 280, y: 150, z: -130, color: '#818CF8' }
    ];

    nodes.forEach(n => {
      const p = project3D(n.x, n.y, n.z, camRotY, camRotX);
      ctx.save();
      ctx.fillStyle = n.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 * p.scale, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${Math.round(13 * p.scale)}px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(n.text, p.x + 8 * p.scale, p.y + 4 * p.scale);
      ctx.restore();
    });

    // ---------------------------------------------------------
    // C. THE VECTOR MATH MIRACLE (KING - MAN + WOMAN = QUEEN)
    // ---------------------------------------------------------
    // Coordinates
    const posKing = { x: -160, y: -40, z: 80 };
    const posMan = { x: -80, y: 80, z: 120 };
    const posWoman = { x: 120, y: 70, z: 140 };
    const posQueen = { x: 180, y: -50, z: 60 };

    const pKing = project3D(posKing.x, posKing.y, posKing.z, camRotY, camRotX);
    const pMan = project3D(posMan.x, posMan.y, posMan.z, camRotY, camRotX);
    const pWoman = project3D(posWoman.x, posWoman.y, posWoman.z, camRotY, camRotX);
    const pQueen = project3D(posQueen.x, posQueen.y, posQueen.z, camRotY, camRotX);

    // 1. KING NODE (Appears at t = 2.5s)
    if (t > 2.5) {
      const kAlpha = clamp((t - 2.5) / 0.5);
      ctx.save();
      ctx.globalAlpha = kAlpha;
      ctx.shadowColor = '#FACC15'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#FACC15';
      ctx.beginPath(); ctx.arc(pKing.x, pKing.y, 9 * pKing.scale, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Label card
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(pKing.x - 45, pKing.y - 42, 90, 28, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 15px NotoSans'; ctx.textAlign = 'center';
      ctx.fillText('KING', pKing.x, pKing.y - 23);
      ctx.restore();
    }

    // 2. MINUS MAN VECTOR (t = 5.5s to 8.0s)
    if (t > 5.5) {
      const vProg = clamp((t - 5.5) / 0.8);
      ctx.save();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pKing.x, pKing.y);
      ctx.lineTo(pKing.x + (pMan.x - pKing.x) * vProg, pKing.y + (pMan.y - pKing.y) * vProg);
      ctx.stroke();

      // Negative sign badge
      ctx.fillStyle = '#EF4444';
      ctx.beginPath(); ctx.arc(pMan.x, pMan.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFF'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText('- MAN', pMan.x, pMan.y + 24);
      ctx.restore();
    }

    // 3. PLUS WOMAN VECTOR (t = 8.0s to 11.0s)
    if (t > 8.0) {
      const wProg = clamp((t - 8.0) / 0.8);
      ctx.save();
      ctx.strokeStyle = '#EC4899';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(pMan.x, pMan.y);
      ctx.lineTo(pMan.x + (pWoman.x - pMan.x) * wProg, pMan.y + (pWoman.y - pMan.y) * wProg);
      ctx.stroke();

      ctx.fillStyle = '#EC4899';
      ctx.beginPath(); ctx.arc(pWoman.x, pWoman.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFF'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText('+ WOMAN', pWoman.x, pWoman.y + 24);
      ctx.restore();
    }

    // 4. QUEEN EXPLOSION & CONVERGENCE (t > 11.5s)
    if (t > 11.5) {
      const qScale = easeOutBack(clamp((t - 11.5) / 0.6));
      ctx.save();
      // Expanding shockwave ring
      const shockR = (t - 11.5) * 80;
      ctx.strokeStyle = `rgba(250, 204, 21, ${clamp(1 - (t - 11.5) / 1.5)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pQueen.x, pQueen.y, shockR, 0, Math.PI * 2); ctx.stroke();

      // Glowing Queen Node
      ctx.shadowColor = '#FACC15'; ctx.shadowBlur = 35;
      ctx.fillStyle = '#FACC15';
      ctx.beginPath(); ctx.arc(pQueen.x, pQueen.y, 14 * pQueen.scale * qScale, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Golden Trophy Banner
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(pQueen.x - 70 * qScale, pQueen.y - 65 * qScale, 140 * qScale, 40 * qScale, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0F172A'; ctx.font = '900 22px NotoSans'; ctx.textAlign = 'center';
      ctx.fillText('QUEEN!', pQueen.x, pQueen.y - 38);

      // Cosine Similarity Badge
      ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#4ADE80';
      ctx.fillText('COSINE SIMILARITY: 99.4%', pQueen.x, pQueen.y + 36);
      ctx.restore();
    }

    // ---------------------------------------------------------
    // D. DYNAMIC STICKMAN ACTING INSIDE THE 3D WORLD
    // ---------------------------------------------------------
    let magiX = 260;
    let magiY = 480;
    let magiAction = 'jetpack';
    let magiScale = 1.0;

    if (t < 5.5) {
      // Act 1: Magi flying on jetpack, navigating the 3D space
      magiX = 220 + Math.sin(t * 1.8) * 45;
      magiY = 420 + Math.cos(t * 2.2) * 25;
      magiAction = 'jetpack';
    } else if (t < 8.2) {
      // Act 2: Magi wrenching out the MAN vector!
      magiX = pMan.x - 45;
      magiY = pMan.y + 40;
      magiAction = 'wrench_slam';
    } else if (t < 11.5) {
      // Act 3: Magi lifting the WOMAN vector into place
      magiX = pWoman.x - 40;
      magiY = pWoman.y + 35;
      magiAction = 'thumbs_up';
    } else {
      // Act 4: Shockwave hits Magi! Blown backwards with arms flailing!
      const flyBack = clamp((t - 11.5) / 0.7);
      magiX = lerp(pQueen.x - 60, 160, flyBack);
      magiY = lerp(pQueen.y + 30, 480, flyBack);
      magiAction = t > 13.5 ? 'thumbs_up' : 'shocked_flyback';
    }

    drawMagiActor(ctx, magiX, magiY, {
      t,
      action: magiAction,
      facing: magiAction === 'shocked_flyback' ? -1 : 1,
      scale: magiScale
    });

    // ---------------------------------------------------------
    // E. CINEMATIC CAPTIONS & STORY PUNCHLINES
    // ---------------------------------------------------------
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let captionText = '';
    if (t < 3.8) {
      captionText = "Words aren't magic to a computer: they're 3D coordinates!";
    } else if (t < 7.5) {
      captionText = "Take KING... subtract MAN...";
    } else if (t < 11.2) {
      captionText = "Add WOMAN... and the math slides across the space...";
    } else {
      captionText = "BOOM! It lands directly on QUEEN! Pure geometry.";
    }

    // Hand-lettered focal caption
    ctx.font = '600 34px NotoSans';
    ctx.strokeStyle = '#020617'; ctx.lineWidth = 7;
    ctx.strokeText(captionText, 640, 660);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(captionText, 640, 660);

    ctx.restore();

    // Pipe raw frame to ffmpeg with backpressure handling
    const buffer = Buffer.from(canvas.data());
    if (!ffmpeg.stdin.write(buffer)) {
      await Promise.race([
        once(ffmpeg.stdin, 'drain'),
        completion.then(() => { throw new Error('Encoder closed early'); })
      ]);
    }
  }

  ffmpeg.stdin.end();
  await completion;
  console.log('3. Video encoding complete.');

  // Mux video with audio
  console.log('4. Muxing video and audio with ffmpeg...');
  execSync(`ffmpeg -v error -y -i "${TEMP_VIDEO}" -i "${TEMP_MIXED_AUDIO}" -c:v copy -c:a aac -b:a 192k "${OUTPUT_FILE}"`);
  console.log(`✓ Masterpiece generated: ${OUTPUT_FILE}`);
}

renderVideo().catch(err => {
  console.error('Render failed:', err);
  process.exit(1);
});
