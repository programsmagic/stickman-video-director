import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, GlobalFonts } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';
import { drawFigure, COLORS, INK, solve2BoneIK, spring } from '../tools/stickman.mjs';

// Register fonts
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const TOTAL_DUR = 41.0;
const TOTAL_FRAMES = Math.ceil(FPS * TOTAL_DUR);

const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP08-Attention-Flashlight-Masterpiece.mp4');

const TEMP_VIDEO = '/tmp/ep08_att_temp.mp4';
const TEMP_VOICE = '/tmp/ep08_att_voice.wav';
const TEMP_SFX = '/tmp/ep08_att_sfx.wav';
const TEMP_MIXED_AUDIO = '/tmp/ep08_att_audio.wav';

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
// 1. GENERATE AUDIO TRACKS
// -------------------------------------------------------------
console.log('1. Generating speech narration and procedural Foley sound effects...');

const scriptLines = [
  { text: "Once words become coordinates, the AI chops them into bite-sized puzzle pieces called Tokens.", at: 0.2 },
  { text: "But how does the model know which words matter? In 2017, the Attention Mechanism changed everything! Imagine sitting in a pitch-black library with a spotlight.", at: 6.2 },
  { text: "When looking at the word BANK, the attention beam scans the sentence. If it spots RIVER, it knows bank means riverbank.", at: 16.4 },
  { text: "If it spots ROBBERY, it instantly knows bank means money vault! Multi-head attention uses eight flashlights at once, finding every hidden clue in parallel.", at: 24.0 },
  { text: "Then, it calculates the next most likely word with pure probability. That is how artificial intelligence pays attention!", at: 33.6 }
];

// Generate each voice piece and place into single audio buffer
const voiceBuffer = new Float32Array(Math.ceil(TOTAL_DUR * 48000));
for (let i = 0; i < scriptLines.length; i++) {
  const partFile = `/tmp/ep08_att_part_${i}.wav`;
  execSync(`say -v Samantha "${scriptLines[i].text}" -o "${partFile}" --data-format=LEI16@48000`);
  const buf = fs.readFileSync(partFile);
  // Read 16-bit PCM at 48000
  const sampleCount = Math.floor((buf.length - 44) / 2);
  const startSample = Math.round(scriptLines[i].at * 48000);
  for (let s = 0; s < sampleCount; s++) {
    if (startSample + s < voiceBuffer.length) {
      voiceBuffer[startSample + s] = buf.readInt16LE(44 + s * 2) / 32768.0;
    }
  }
}

// Write compiled voice track
{
  const n = voiceBuffer.length;
  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(48000, 24); bytes.writeUInt32LE(48000 * 2, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) bytes.writeInt16LE(Math.round(clamp(voiceBuffer[i], -1, 1) * 32767), 44 + i * 2);
  fs.writeFileSync(TEMP_VOICE, bytes);
}

// Procedural Foley SFX track
{
  const rate = 48000;
  const n = Math.ceil(TOTAL_DUR * rate);
  const samples = new Float32Array(n);
  let seed = 91823;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };

  function addSound(timeSec, durationSec, fn, gain = 0.3) {
    const startIdx = Math.round(timeSec * rate);
    const count = Math.min(n - startIdx, Math.round(durationSec * rate));
    for (let i = 0; i < count; i++) samples[startIdx + i] += fn(i / rate) * gain;
  }

  // Conveyor belt hum (0.0s - 6.0s)
  addSound(0.0, 6.0, t => (noise() * 0.15 + Math.sin(2 * Math.PI * 90 * t) * 0.25) * Math.min(1, t * 2) * Math.min(1, (6 - t) * 2), 0.3);

  // Laser slicer chops on tokens (t = 2.0s, 3.2s, 4.4s)
  [2.0, 3.2, 4.4].forEach(st => {
    addSound(st, 0.35, t => (noise() * 0.6 + Math.sin(2 * Math.PI * (1200 - t * 2400) * t) * 0.4) * Math.exp(-t * 14), 0.45);
  });

  // Token catch ping (t = 4.8s)
  addSound(4.8, 0.4, t => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 9), 0.35);

  // Darkness whoosh & flashlight click (t = 6.2s, 8.8s)
  addSound(6.2, 0.8, t => Math.sin(2 * Math.PI * 140 * t) * Math.exp(-t * 4), 0.4);
  addSound(8.8, 0.15, t => (noise() * 0.8 + Math.sin(2 * Math.PI * 950 * t) * 0.5) * Math.exp(-t * 30), 0.6); // Flashlight CLACK

  // Spotlight warm hum (8.8s - 33.0s)
  addSound(8.8, 24.2, t => Math.sin(2 * Math.PI * 110 * t) * 0.1, 0.15);

  // Attention scan chirp / vector laser (t = 16.8s)
  addSound(16.8, 0.9, t => Math.sin(2 * Math.PI * (440 + t * 600) * t) * Math.exp(-t * 3.5), 0.45);

  // River context ping (t = 19.2s)
  addSound(19.2, 0.8, t => (Math.sin(2 * Math.PI * 523.25 * t) + Math.sin(2 * Math.PI * 659.25 * t) * 0.8) * Math.exp(-t * 4), 0.5);

  // Robbery transition glitch zap (t = 24.0s)
  addSound(24.0, 0.4, t => (noise() * 0.7 + Math.sin(2 * Math.PI * 320 * t) * 0.4) * Math.exp(-t * 10), 0.4);

  // Vault laser chime (t = 26.5s)
  addSound(26.5, 0.8, t => (Math.sin(2 * Math.PI * 587.33 * t) + Math.sin(2 * Math.PI * 880.0 * t) * 0.8) * Math.exp(-t * 4), 0.5);

  // 8-Head multi-head holographic fan out chord (t = 28.5s - 33.0s)
  addSound(28.5, 4.5, t => {
    const freqs = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
    let sum = 0;
    for (const f of freqs) sum += Math.sin(2 * Math.PI * f * t) * 0.12;
    return sum * Math.min(1, t * 1.5) * Math.min(1, (4.5 - t) * 1.5);
  }, 0.5);

  // Probability bounce spring boing (t = 34.0s, 34.8s)
  addSound(34.0, 0.45, t => Math.sin(2 * Math.PI * (300 + Math.sin(t * 50) * 120) * t) * Math.exp(-t * 6), 0.4);

  // Final jigsaw snap & victory fanfare (t = 38.0s)
  addSound(38.0, 0.3, t => (noise() * 0.8 + Math.sin(2 * Math.PI * 220 * t) * 0.7) * Math.exp(-t * 16), 0.7); // Heavy snap
  addSound(38.2, 2.5, t => {
    const env = Math.exp(-t * 2.0);
    return (
      Math.sin(2 * Math.PI * 523.25 * t) * 0.35 +
      Math.sin(2 * Math.PI * 659.25 * t) * 0.3 +
      Math.sin(2 * Math.PI * 783.99 * t) * 0.25 +
      Math.sin(2 * Math.PI * 1046.50 * t) * 0.2
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

// Mix audio tracks
execSync(`ffmpeg -v error -y -i "${TEMP_VOICE}" -i "${TEMP_SFX}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.85[s];[v][s]amix=inputs=2:duration=longest" -ar 48000 "${TEMP_MIXED_AUDIO}"`);
console.log('✓ Audio tracks compiled and mixed.');

// -------------------------------------------------------------
// 2. GRAPHICS & ANIMATION HELPERS
// -------------------------------------------------------------
function drawWobblyRect(ctx, x, y, w, h, { color = '#38BDF8', fill = null, width = 3, seed = 12 } = {}) {
  const pts = [
    [x, y], [x + w, y], [x + w, y + h], [x, y + h]
  ];
  ctx.save();
  ctx.beginPath();
  let s = seed;
  const jitter = (sVal) => {
    sVal = (Math.imul(sVal, 1664525) + 1013904223) >>> 0;
    return ((sVal / 4294967296) * 2 - 1) * 1.5;
  };
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % pts.length];
    const midX = (p0[0] + p1[0]) / 2 + jitter(s++);
    const midY = (p0[1] + p1[1]) / 2 + jitter(s++);
    if (i === 0) ctx.moveTo(p0[0] + jitter(s++), p0[1] + jitter(s++));
    ctx.quadraticCurveTo(midX, midY, p1[0] + jitter(s++), p1[1] + jitter(s++));
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (color && width > 0) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
  ctx.restore();
}

function drawJigsawToken(ctx, x, y, w, h, text, tokenId, { tabRight = true, slotLeft = true, highlight = false, color = '#1E293B' } = {}) {
  ctx.save();
  ctx.translate(x, y);

  // Outer border & fill with jigsaw tabs
  ctx.beginPath();
  ctx.moveTo(0, 0);

  // Top edge
  ctx.lineTo(w, 0);

  // Right edge with outward tab
  if (tabRight) {
    ctx.lineTo(w, h * 0.35);
    ctx.bezierCurveTo(w + 14, h * 0.35, w + 14, h * 0.65, w, h * 0.65);
    ctx.lineTo(w, h);
  } else {
    ctx.lineTo(w, h);
  }

  // Bottom edge
  ctx.lineTo(0, h);

  // Left edge with inward slot
  if (slotLeft) {
    ctx.lineTo(0, h * 0.65);
    ctx.bezierCurveTo(14, h * 0.65, 14, h * 0.35, 0, h * 0.35);
    ctx.lineTo(0, 0);
  } else {
    ctx.lineTo(0, 0);
  }
  ctx.closePath();

  ctx.fillStyle = highlight ? '#0284C7' : color;
  ctx.fill();
  ctx.strokeStyle = highlight ? '#38BDF8' : '#64748B';
  ctx.lineWidth = highlight ? 3.5 : 2;
  ctx.stroke();

  // Glow if highlighted
  if (highlight) {
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Text inside token
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 22px CaveatHand';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h * 0.42);

  // Token ID subscript
  ctx.fillStyle = highlight ? '#BAE6FD' : '#94A3B8';
  ctx.font = '13px NotoSans';
  ctx.fillText(`ID: ${tokenId}`, w / 2, h * 0.75);

  ctx.restore();
}

// -------------------------------------------------------------
// 3. MAIN RENDER LOOP WITH FFMPEG PIPE
// -------------------------------------------------------------
console.log('2. Starting frame rendering pipeline...');

const ffmpeg = spawn('ffmpeg', [
  '-v', 'error',
  '-y',
  '-f', 'rawvideo',
  '-pix_fmt', 'rgba',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-r', `${FPS}`,
  '-i', 'pipe:0',
  '-i', TEMP_MIXED_AUDIO,
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

let lastReportTime = Date.now();

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background base
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);

  // Active scene determination
  // Scene 1: 0.0 - 6.2s (Tokenizer Factory)
  // Scene 2: 6.2 - 16.4s (Dark Library Spotlight - River Context)
  // Scene 3: 16.4 - 24.0s (Robbery Context Shift)
  // Scene 4: 24.0 - 33.6s (8-Head Multi-Head Attention & 3D Matrix Heatmap)
  // Scene 5: 33.6 - 41.0s (Probability Bar Chart & Final Snap)

  if (t < 6.2) {
    // ---------------------------------------------------------
    // SCENE 1: TOKEN CONVEYOR BELT & JIGSAW SLICER
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#1E293B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Grid Floor
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 480); ctx.lineTo(x, HEIGHT); ctx.stroke();
    }
    for (let y = 480; y < HEIGHT; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
    }

    // Industrial Conveyor Belt (Isometric / Perspective)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(80, 420, 1120, 70);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.strokeRect(80, 420, 1120, 70);

    // Tread lines moving continuously
    const treadShift = (t * 120) % 40;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    for (let tx = 80 + treadShift; tx < 1200; tx += 40) {
      ctx.beginPath(); ctx.moveTo(tx, 420); ctx.lineTo(tx - 20, 490); ctx.stroke();
    }

    // Conveyor Rollers / Gears at ends
    ctx.fillStyle = '#64748B';
    ctx.beginPath(); ctx.arc(100, 455, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(1180, 455, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Laser Slicer Assembly at x = 550
    const slicerX = 550;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(slicerX - 45, 80, 90, 60);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(slicerX - 45, 80, 90, 60);

    // Laser blade drop animation
    const chopCycle = Math.sin(t * 8);
    const laserY = 140 + Math.max(0, chopCycle) * 230;

    // Laser beam vertical
    const laserGrad = ctx.createLinearGradient(slicerX - 6, 0, slicerX + 6, 0);
    laserGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    laserGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.95)');
    laserGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = laserGrad;
    ctx.fillRect(slicerX - 12, 140, 24, 280);

    // Laser spark bursts
    if (chopCycle > 0.85) {
      ctx.save();
      ctx.translate(slicerX, 420);
      for (let sp = 0; sp < 12; sp++) {
        const ang = (sp / 12) * Math.PI + Math.PI;
        const dist = 15 + ((t * 80 + sp * 10) % 35);
        ctx.fillStyle = sp % 2 === 0 ? '#38BDF8' : '#FEF08A';
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Raw sentence string approaching from left, splitting after x = 550
    const rawWordX = 120 + t * 90;
    if (rawWordX < slicerX - 80) {
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 36px CaveatHand';
      ctx.textAlign = 'left';
      ctx.fillText('"ARTIFICIAL INTELLIGENCE"', rawWordX, 395);
    }

    // Sliced Jigsaw Tokens moving right past slicer
    const tokens = [
      { text: "ART", id: 3201, origX: 620 },
      { text: "IFI", id: 4892, origX: 740 },
      { text: "CIAL", id: 1045, origX: 860 },
      { text: "INTEL", id: 5521, origX: 990 },
      { text: "LIGENCE", id: 8933, origX: 1120 }
    ];

    tokens.forEach((tok, idx) => {
      const tokX = tok.origX + (t - 2.0) * 45;
      if (tokX > slicerX - 20 && tokX < 1180) {
        drawJigsawToken(ctx, tokX, 350, 105, 65, tok.text, tok.id, {
          tabRight: idx < tokens.length - 1,
          slotLeft: idx > 0,
          highlight: idx === 3
        });
      }
    });

    // Magi (Presenter) standing at x = 320, inspecting the token stream
    // Using 2-Bone IK to reach his right arm towards the slicer / token
    const ikTargetX = 65 + Math.sin(t * 3) * 15;
    const ikTargetY = -90 + Math.cos(t * 3) * 10;

    drawFigure(ctx, {
      torso: -5,
      head: 8,
      facing: 'right',
      accessory: 'wizard-hat',
      targetArmR: [ikTargetX, ikTargetY],
      eyes: 'normal',
      mouth: 'smile'
    }, { x: 300, y: 390, r: 38, seed: Math.floor(t * 12) });

    // Exclamation / dialogue bubble above Magi
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 26px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Raw Words  -->  Discrete Puzzle Tokens!", 300, 200);

    // Digital Token Counter on the laser slicer
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(slicerX - 60, 25, 120, 42);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.strokeRect(slicerX - 60, 25, 120, 42);
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 18px NotoSans';
    ctx.fillText("TOKENS: 5", slicerX, 52);

  } else if (t < 16.4) {
    // ---------------------------------------------------------
    // SCENE 2: DARK LIBRARY SPOTLIGHT — RIVER CONTEXT
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#060A12');
    bgGrad.addColorStop(1, '#0B132B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Floating subtle library dust motes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (let m = 0; m < 25; m++) {
      const mx = (m * 57 + t * 15) % WIDTH;
      const my = (m * 39 + Math.sin(t + m) * 30) % HEIGHT;
      ctx.beginPath(); ctx.arc(mx, my, (m % 3) + 1, 0, Math.PI * 2); ctx.fill();
    }

    // Sentence Tokens floating in mid-air
    const wordsRiver = [
      { text: "The", role: "det", weight: 0.05, x: 280 },
      { text: "muddy", role: "adj", weight: 0.78, x: 400 },
      { text: "BANK", role: "QUERY", weight: 1.0, x: 530, isQuery: true },
      { text: "of", role: "prep", weight: 0.04, x: 670 },
      { text: "the", role: "det", weight: 0.03, x: 770 },
      { text: "RIVER", role: "KEY", weight: 0.94, x: 880 },
      { text: "overflowed", role: "verb", weight: 0.62, x: 1040 }
    ];

    // Flashlight & Spotlight Geometry
    const magiX = 140, magiY = 510;
    const flashlightOn = t >= 8.5;
    const sweepProgress = clamp((t - 9.0) / 3.0);
    const aimTargetX = lerp(400, 560, sweepProgress);
    const aimTargetY = 240;

    // Hand and flashlight nozzle calculation
    const armTarget = [aimTargetX - magiX, aimTargetY - magiY];
    const distToTarget = Math.hypot(armTarget[0], armTarget[1]);
    const maxReach = 110;
    const clampedTarget = [
      (armTarget[0] / distToTarget) * Math.min(distToTarget, maxReach),
      (armTarget[1] / distToTarget) * Math.min(distToTarget, maxReach)
    ];

    // Prop angle pointing directly from hand to target
    const aimAngleRad = Math.atan2(aimTargetX - (magiX + clampedTarget[0]), -(aimTargetY - (magiY + clampedTarget[1])));
    const nozzleX = magiX + clampedTarget[0] + Math.sin(aimAngleRad) * 32;
    const nozzleY = magiY + clampedTarget[1] - Math.cos(aimAngleRad) * 32;

    // Volumetric Spotlight Beam originating from exact nozzle
    if (flashlightOn) {
      const beamAlpha = clamp((t - 8.5) * 3);
      ctx.save();
      const beamGrad = ctx.createRadialGradient(nozzleX, nozzleY, 15, aimTargetX, aimTargetY, 520);
      beamGrad.addColorStop(0, `rgba(254, 240, 138, ${0.5 * beamAlpha})`);
      beamGrad.addColorStop(0.35, `rgba(56, 189, 248, ${0.22 * beamAlpha})`);
      beamGrad.addColorStop(1, 'rgba(11, 19, 43, 0)');

      ctx.beginPath();
      ctx.moveTo(nozzleX, nozzleY);
      ctx.lineTo(aimTargetX - 160, aimTargetY - 140);
      ctx.lineTo(aimTargetX + 540, aimTargetY + 120);
      ctx.lineTo(aimTargetX - 100, aimTargetY + 220);
      ctx.closePath();
      ctx.fillStyle = beamGrad;
      ctx.fill();
      ctx.restore();
    }

    // Draw Word Tokens
    const bankTok = wordsRiver[2];
    wordsRiver.forEach((w) => {
      const isLit = flashlightOn && sweepProgress > 0.6;
      const isHighlight = w.isQuery || (isLit && w.weight > 0.7);

      ctx.save();
      ctx.translate(w.x, 230);

      // Pill Box
      const boxW = w.text.length * 15 + 40;
      ctx.fillStyle = isHighlight ? (w.isQuery ? '#D97706' : '#0284C7') : '#1E293B';
      ctx.strokeStyle = isHighlight ? (w.isQuery ? '#FBBF24' : '#38BDF8') : '#475569';
      ctx.lineWidth = isHighlight ? 3.5 : 1.5;

      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -26, boxW, 52, 12);
      ctx.fill();
      ctx.stroke();

      // Text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = isHighlight ? 'bold 28px CaveatHand' : '24px CaveatHand';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(w.text, 0, 0);

      // Weight badge under key words
      if (isLit && w.weight > 0.5 && t > 11.5) {
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 15px NotoSans';
        ctx.fillText(`w = ${w.weight.toFixed(2)}`, 0, 42);
      }
      ctx.restore();
    });

    // Attention Arcs (Connecting BANK to RIVER and MUDDY)
    if (flashlightOn && t > 11.0) {
      const arcAnim = clamp((t - 11.0) / 1.5);
      const riverTok = wordsRiver[5];
      const muddyTok = wordsRiver[1];

      // Arc to RIVER (cyan glowing curve)
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4 * arcAnim;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(bankTok.x, 204);
      ctx.quadraticCurveTo((bankTok.x + riverTok.x) / 2, 80, riverTok.x, 204);
      ctx.stroke();

      // Arc to MUDDY
      ctx.strokeStyle = '#7DD3FC';
      ctx.lineWidth = 3 * arcAnim;
      ctx.beginPath();
      ctx.moveTo(bankTok.x, 204);
      ctx.quadraticCurveTo((bankTok.x + muddyTok.x) / 2, 120, muddyTok.x, 204);
      ctx.stroke();
      ctx.restore();

      // Floating Attention Mathematical Formula (using clean NotoSans)
      if (t > 12.5) {
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 22px NotoSans';
        ctx.textAlign = 'center';
        ctx.fillText("Attention(Q, K, V) = softmax( (Q · K^T) / sqrt(d) ) · V", 640, 75);
      }

      // Context Tag Reveal
      if (t > 13.5) {
        const bounce = spring(t - 13.5, 0.65, 10);
        ctx.save();
        ctx.translate(640, 360);
        ctx.scale(bounce, bounce);
        ctx.fillStyle = '#065F46';
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-220, -30, 440, 60, 16);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#ECFDF5';
        ctx.font = 'bold 26px CaveatHand';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("RESOLVED CONTEXT: NATURAL RIVERBED 🌿", 0, 0);
        ctx.restore();
      }
    }

    // Magi holding Flashlight with dynamic 2-Bone IK aiming directly along flashlight angle
    drawFigure(ctx, {
      torso: 2,
      head: -4,
      facing: 'right',
      accessory: flashlightOn ? 'flashlight' : null,
      propAngle: flashlightOn ? aimAngleRad : 0,
      targetArmR: flashlightOn ? clampedTarget : [40, -20],
      targetArmL: [-25, 10],
      eyes: flashlightOn ? 'wide' : 'normal',
      brows: 'up',
      mouth: 'smile'
    }, { x: magiX, y: magiY, r: 38, seed: Math.floor(t * 12) });

  } else if (t < 24.0) {
    // ---------------------------------------------------------
    // SCENE 3: CONTEXT SHIFT — ROBBERY & MONEY VAULT
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#0F051D');
    bgGrad.addColorStop(1, '#1A0B2E');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Sentence Tokens for Robbery Context
    const wordsRobbery = [
      { text: "Armed", role: "adj", weight: 0.74, x: 260 },
      { text: "ROBBERY", role: "KEY", weight: 0.95, x: 390 },
      { text: "at", role: "prep", weight: 0.05, x: 520 },
      { text: "the", role: "det", weight: 0.03, x: 610 },
      { text: "BANK", role: "QUERY", weight: 1.0, x: 730, isQuery: true },
      { text: "VAULT", role: "KEY", weight: 0.92, x: 870 },
      { text: "tonight", role: "adv", weight: 0.35, x: 1010 }
    ];

    const bankTok = wordsRobbery[4];
    const robberyTok = wordsRobbery[1];
    const vaultTok = wordsRobbery[5];

    // Emerald Spotlight on BANK
    const magiX = 140, magiY = 510;
    const armTarget = [bankTok.x - magiX, 230 - magiY];
    const distToTarget = Math.hypot(armTarget[0], armTarget[1]);
    const maxReach = 110;
    const clampedTarget = [
      (armTarget[0] / distToTarget) * Math.min(distToTarget, maxReach),
      (armTarget[1] / distToTarget) * Math.min(distToTarget, maxReach)
    ];
    const aimAngleRad = Math.atan2(bankTok.x - (magiX + clampedTarget[0]), -(230 - (magiY + clampedTarget[1])));
    const nozzleX = magiX + clampedTarget[0] + Math.sin(aimAngleRad) * 32;
    const nozzleY = magiY + clampedTarget[1] - Math.cos(aimAngleRad) * 32;

    ctx.save();
    const beamGrad = ctx.createRadialGradient(nozzleX, nozzleY, 20, bankTok.x, 230, 480);
    beamGrad.addColorStop(0, 'rgba(52, 211, 153, 0.5)');
    beamGrad.addColorStop(0.4, 'rgba(16, 185, 129, 0.22)');
    beamGrad.addColorStop(1, 'rgba(26, 11, 46, 0)');
    ctx.beginPath();
    ctx.moveTo(nozzleX, nozzleY);
    ctx.lineTo(bankTok.x - 220, 90);
    ctx.lineTo(bankTok.x + 340, 260);
    ctx.lineTo(bankTok.x - 120, 360);
    ctx.closePath();
    ctx.fillStyle = beamGrad;
    ctx.fill();
    ctx.restore();

    // Render Robbery Word Tokens
    wordsRobbery.forEach(w => {
      ctx.save();
      ctx.translate(w.x, 230);
      const isHighlight = w.isQuery || w.weight > 0.7;
      const boxW = w.text.length * 15 + 40;

      ctx.fillStyle = isHighlight ? (w.isQuery ? '#D97706' : '#059669') : '#2D1B4E';
      ctx.strokeStyle = isHighlight ? (w.isQuery ? '#FBBF24' : '#34D399') : '#6B46C1';
      ctx.lineWidth = isHighlight ? 3.5 : 1.5;

      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -26, boxW, 52, 12);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = isHighlight ? 'bold 28px CaveatHand' : '24px CaveatHand';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(w.text, 0, 0);

      if (w.weight > 0.5) {
        ctx.fillStyle = '#34D399';
        ctx.font = 'bold 15px NotoSans';
        ctx.fillText(`w = ${w.weight.toFixed(2)}`, 0, 42);
      }
      ctx.restore();
    });

    // Emerald Green Attention Arcs
    ctx.save();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 4.5;
    ctx.shadowColor = '#34D399';
    ctx.shadowBlur = 15;

    // Arc from BANK to ROBBERY
    ctx.beginPath();
    ctx.moveTo(bankTok.x, 204);
    ctx.quadraticCurveTo((bankTok.x + robberyTok.x) / 2, 70, robberyTok.x, 204);
    ctx.stroke();

    // Arc from BANK to VAULT
    ctx.beginPath();
    ctx.moveTo(bankTok.x, 204);
    ctx.quadraticCurveTo((bankTok.x + vaultTok.x) / 2, 110, vaultTok.x, 204);
    ctx.stroke();
    ctx.restore();

    // Context Badge
    const bounce = spring(t - 17.5, 0.65, 10);
    ctx.save();
    ctx.translate(640, 360);
    ctx.scale(bounce, bounce);
    ctx.fillStyle = '#831843';
    ctx.strokeStyle = '#F472B6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-220, -30, 440, 60, 16);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#FDF2F8';
    ctx.font = 'bold 26px CaveatHand';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText("RESOLVED CONTEXT: FINANCIAL CASH VAULT 💰", 0, 0);
    ctx.restore();

    // Magi in shock/awe pointing flashlight dynamically
    drawFigure(ctx, {
      torso: -2,
      head: 6,
      facing: 'right',
      accessory: 'flashlight',
      propAngle: aimAngleRad,
      targetArmR: clampedTarget,
      targetArmL: [-25, 10],
      eyes: 'wide',
      brows: 'up',
      mouth: 'o'
    }, { x: magiX, y: magiY, r: 38, seed: Math.floor(t * 12) });

  } else if (t < 33.6) {
    // ---------------------------------------------------------
    // SCENE 4: MULTI-HEAD ATTENTION & 3D MATRIX HEATMAP
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#030712');
    bgGrad.addColorStop(1, '#0B0F19');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Header Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 30px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Multi-Head Attention: 8 Parallel Heads and Attention Matrix", 640, 48);

    // 8 Holographic Flashlights in an arc around Magi
    const magiX = 260, magiY = 490;
    const colors = ['#EF4444', '#F97316', '#FBBF24', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'];
    const headNames = ['Syntax', 'DirectObj', 'Semantic', 'LongRange', 'Prepos', 'Entity', 'Modifier', 'Context'];

    for (let h = 0; h < 8; h++) {
      const angle = -Math.PI * 0.85 + (h / 7) * Math.PI * 0.7;
      const radius = 170 + Math.sin(t * 4 + h) * 8;
      const flX = magiX + Math.cos(angle) * radius;
      const flY = magiY - 140 + Math.sin(angle) * radius;

      // Miniature glowing flashlight body
      ctx.save();
      ctx.translate(flX, flY);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = colors[h];
      ctx.fillRect(-7, -14, 14, 28);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-7, -14, 14, 28);

      // Light beam fanning outward toward the right (Heatmap)
      const beamGrad = ctx.createRadialGradient(0, -14, 5, 260, -14, 450);
      beamGrad.addColorStop(0, colors[h]);
      beamGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(280, -110);
      ctx.lineTo(280, 90);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Staggered Head Name Tag along beam
      const tagDist = radius + 40 + (h % 2) * 26;
      const tagX = magiX + Math.cos(angle) * tagDist;
      const tagY = magiY - 140 + Math.sin(angle) * tagDist;

      ctx.fillStyle = colors[h];
      ctx.font = 'bold 13px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText(`H${h + 1}:${headNames[h]}`, tagX, tagY);
    }

    // 3D Perspective Isometric Attention Matrix Heatmap (Manim Style)
    // Draw an 8x8 isometric grid on the right side
    const originX = 850, originY = 240;
    const tileW = 32, tileH = 18;

    ctx.save();
    // Grid baseline
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const val = Math.abs(Math.sin((r * 11 + c * 17) + t * 2.5));
        const isoX = originX + (c - r) * tileW;
        const isoY = originY + (c + r) * tileH;

        // Draw diamond isometric tile
        ctx.beginPath();
        ctx.moveTo(isoX, isoY - tileH);
        ctx.lineTo(isoX + tileW, isoY);
        ctx.lineTo(isoX, isoY + tileH);
        ctx.lineTo(isoX - tileW, isoY);
        ctx.closePath();

        ctx.fillStyle = `rgba(56, 189, 248, ${0.12 + val * 0.82})`;
        ctx.fill();
        ctx.strokeStyle = val > 0.7 ? '#BAE6FD' : '#0369A1';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (val > 0.65) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px NotoSans';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((val).toFixed(2), isoX, isoY);
        }
      }
    }
    ctx.restore();

    // Heatmap Axis Labels
    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText("Keys (Tokens: The, bank, of, river, was, muddy...)", originX, originY + 16 * tileH + 20);

    // Magi hovering / conducting like an orchestra maestro with both arms raised up high!
    const hoverY = magiY + Math.sin(t * 4) * 12;
    drawFigure(ctx, {
      torso: 0,
      head: 0,
      facing: 'front',
      accessory: 'wizard-hat',
      targetArmL: [-50, -145], // Hand up in the air conducting
      targetArmR: [50, -145],  // Hand up in the air conducting
      eyes: 'wide',
      mouth: 'smile'
    }, { x: magiX, y: hoverY, r: 40, seed: Math.floor(t * 12) });

  } else {
    // ---------------------------------------------------------
    // SCENE 5: PROBABILITY DISTRIBUTION & NEXT-TOKEN SNAP FINALE
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Context Sentence at top
    ctx.fillStyle = '#94A3B8';
    ctx.font = '24px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText('Context Prompt: "The raging river burst through the grassy..."', 640, 70);

    // Probability Bar Chart (Spring Dynamics)
    const probStart = 33.7;
    const probProgress = spring(t - probStart, 0.65, 9);

    const candidates = [
      { word: "bank", prob: 0.94, color: '#10B981', textColor: '#A7F3D0' },
      { word: "counter", prob: 0.04, color: '#F59E0B', textColor: '#FDE68A' },
      { word: "spaceship", prob: 0.0002, color: '#EF4444', textColor: '#FECACA' }
    ];

    const chartX = 220, chartY = 130;
    candidates.forEach((cand, idx) => {
      const cy = chartY + idx * 75;
      const barWidth = cand.prob * 620 * probProgress;

      // Word Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px CaveatHand';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`"${cand.word}"`, chartX - 20, cy + 20);

      // Background Track
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(chartX, cy, 620, 40, 8);
      ctx.fill();

      // Filled Progress Bar
      if (barWidth > 4) {
        ctx.fillStyle = cand.color;
        ctx.beginPath();
        ctx.roundRect(chartX, cy, barWidth, 40, 8);
        ctx.fill();
      }

      // Percentage Label
      ctx.fillStyle = cand.textColor;
      ctx.font = 'bold 18px NotoSans';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const pctStr = cand.prob >= 0.01 ? `${(cand.prob * 100).toFixed(1)}%` : `< 0.01%`;
      ctx.fillText(pctStr, chartX + Math.max(barWidth + 15, 60), cy + 20);
    });

    // Final Jigsaw Slot at bottom (Conveyor track)
    const trackY = 450;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(150, trackY, 980, 80);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(150, trackY, 980, 80);

    // Pre-existing words in sentence
    const preWords = ["The", "raging", "river", "burst", "through", "the", "grassy"];
    preWords.forEach((pw, pwi) => {
      ctx.fillStyle = '#CBD5E1';
      ctx.font = 'bold 22px CaveatHand';
      ctx.textAlign = 'center';
      ctx.fillText(pw, 200 + pwi * 105, trackY + 48);
    });

    // Empty Jigsaw Slot for the winning token at x = 945
    const slotX = 950;
    ctx.strokeStyle = '#FBBF24';
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(slotX, trackY + 8, 120, 64);
    ctx.setLineDash([]);

    // The Winning Token "bank" dropping down and snapping into place!
    const snapStart = 37.8;
    if (t >= snapStart) {
      const snapT = clamp((t - snapStart) / 0.4);
      const dropY = lerp(220, trackY + 8, ease(snapT));

      drawJigsawToken(ctx, slotX, dropY, 120, 64, "bank", 2814, {
        tabRight: false,
        slotLeft: true,
        highlight: true,
        color: '#059669'
      });

      // Snap Impact Shockwave & Confetti
      if (t >= snapStart + 0.3) {
        const shockAge = (t - (snapStart + 0.3));
        const shockRadius = shockAge * 220;
        ctx.strokeStyle = `rgba(52, 211, 153, ${Math.max(0, 1 - shockAge * 1.5)})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(slotX + 60, trackY + 40, shockRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Confetti Sparks
        for (let sp = 0; sp < 16; sp++) {
          const spAngle = (sp / 16) * Math.PI * 2;
          const spDist = shockAge * (120 + (sp % 4) * 40);
          ctx.fillStyle = sp % 2 === 0 ? '#FBBF24' : '#34D399';
          ctx.beginPath();
          ctx.arc(slotX + 60 + Math.cos(spAngle) * spDist, trackY + 40 + Math.sin(spAngle) * spDist, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Magi triumphant pose with celebratory spring jump and double fist pump!
    const jumpOffset = (t >= snapStart + 0.3) ? Math.max(0, Math.sin((t - snapStart - 0.3) * 10) * 45 * Math.exp(-(t - snapStart - 0.3) * 1.5)) : 0;
    const magiX = 1120, magiY = 440 - jumpOffset;
    drawFigure(ctx, {
      torso: jumpOffset > 5 ? -6 : 5,
      head: jumpOffset > 5 ? -12 : -8,
      facing: 'left',
      accessory: 'wizard-hat',
      targetArmL: [-45, -150], // Left arm raised high in victory
      targetArmR: [35, -145],  // Right arm raised high in victory
      eyes: 'wink',
      mouth: 'smile'
    }, { x: magiX, y: magiY, r: 38, seed: Math.floor(t * 12) });

    // Victory Banner
    if (t > 38.2) {
      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 32px CaveatHand';
      ctx.textAlign = 'center';
      ctx.fillText("Word Selected & Appended: Loop Repeats!", 640, 580);
    }
  }

  // -----------------------------------------------------------
  // GLOBAL CAPTION OVERLAY (Strictly Single-Line)
  // -----------------------------------------------------------
  let currentCaption = "";
  for (let s = 0; s < scriptLines.length; s++) {
    const line = scriptLines[s];
    const nextStart = s < scriptLines.length - 1 ? scriptLines[s + 1].at : TOTAL_DUR;
    if (t >= line.at && t < nextStart - 0.2) {
      currentCaption = line.text;
      break;
    }
  }

  // Split into shorter semantic clauses for single-line fit
  if (currentCaption) {
    let displayCue = currentCaption;
    // Map long lines to punchy single line cues
    if (displayCue.includes("Once words become coordinates")) {
      displayCue = t < 3.2 ? "Once words become coordinates..." : "The AI chops them into bite-sized Tokens!";
    } else if (displayCue.includes("how does the model know which words matter")) {
      if (t < 9.5) displayCue = "How does the model know which words matter?";
      else if (t < 13.0) displayCue = "In 2017, the Attention Mechanism changed everything!";
      else displayCue = "Imagine sitting in a pitch-black library with a spotlight.";
    } else if (displayCue.includes("When looking at the word BANK")) {
      if (t < 20.2) displayCue = "When looking at BANK, the attention beam scans the sentence.";
      else displayCue = "If it spots RIVER, it knows bank means riverbank!";
    } else if (displayCue.includes("If it spots ROBBERY")) {
      if (t < 28.0) displayCue = "If it spots ROBBERY, it instantly knows bank means money vault!";
      else displayCue = "Multi-head attention uses 8 flashlights finding clues in parallel!";
    } else if (displayCue.includes("calculates the next most likely word")) {
      if (t < 37.0) displayCue = "Then, it calculates the next most likely word with probability.";
      else displayCue = "That is how artificial intelligence pays attention!";
    }

    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT - 55);

    // Measure text
    ctx.font = 'bold 28px CaveatHand';
    const textWidth = ctx.measureText(displayCue).width;
    const boxW = Math.min(WIDTH - 80, textWidth + 60);

    // Pill background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -24, boxW, 48, 24);
    ctx.fill(); ctx.stroke();

    // Caption text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayCue, 0, 0);
    ctx.restore();
  }

  // Pipe raw frame buffer to ffmpeg
  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  // Progress log every 3 seconds
  if (Date.now() - lastReportTime > 3000) {
    const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
    console.log(`Render progress: ${pct}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
    lastReportTime = Date.now();
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Masterpiece rendered successfully: ${OUTPUT_FILE}`);
