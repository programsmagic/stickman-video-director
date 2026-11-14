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

// Act 2 Voice file
const VOICE_FILE = path.resolve('projects/ep09-can-ai-become-conscious/build/narration/act2.wav');
const durationStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE_FILE}"`).toString().trim();
const TOTAL_DUR = parseFloat(durationStr);
const TOTAL_FRAMES = Math.ceil(FPS * TOTAL_DUR);

const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP09-Act2-ChineseRoom-Masterpiece.mp4');

const TEMP_SFX = '/tmp/ep09_act2_sfx.wav';
const TEMP_MIXED = '/tmp/ep09_act2_mixed.wav';

console.log(`=== RENDERING ACT 2: THE CHINESE ROOM THOUGHT EXPERIMENT ===`);
console.log(`Duration: ${TOTAL_DUR.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES}`);

// -------------------------------------------------------------
// 1. GENERATE PROCEDURAL SYNCHRONIZED FOLEY AUDIO
// -------------------------------------------------------------
console.log('1. Synthesizing procedural Foley sound effects...');
{
  const rate = 48000;
  const n = Math.ceil(TOTAL_DUR * rate);
  const samples = new Float32Array(n);
  let seed = 58219;
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

  // Thought experiment clock ticking / wooden room echo (0.0s - 8.0s)
  for (let t = 0.5; t < 8.0; t += 1.0) {
    addSound(t, 0.08, time => Math.sin(2 * Math.PI * 1800 * time) * Math.exp(-time * 90), 0.2);
  }

  // Mail slot flap lift & slide (15.5s, 31.0s)
  [15.5, 31.0].forEach(st => {
    addSound(st, 0.2, t => (Math.sin(2 * Math.PI * 350 * t) + noise() * 0.4) * Math.exp(-t * 12), 0.45);
    addSound(st + 0.15, 0.4, t => noise() * Math.sin(t / 0.4 * Math.PI), 0.35); // paper slide
  });

  // Giant book opening & rapid page fluttering (22.0s - 26.5s)
  addSound(22.0, 0.5, t => (Math.sin(2 * Math.PI * 180 * t) + noise() * 0.5) * Math.exp(-t * 6), 0.5); // book drop
  for (let t = 23.0; t < 26.5; t += 0.22) {
    addSound(t, 0.15, time => noise() * Math.exp(-time * 30), 0.3); // page flutter
  }

  // Stamp impact / seal press (27.5s, 30.0s)
  [27.5, 30.0].forEach(st => {
    addSound(st, 0.3, t => Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t * 10) + noise() * 0.3 * Math.exp(-t * 40), 0.55);
  });

  // Outside scholar celebration chime / genius ding (37.0s)
  addSound(37.0, 1.2, t => (Math.sin(2 * Math.PI * 1046.50 * t) + Math.sin(2 * Math.PI * 1318.51 * t) * 0.8) * Math.exp(-t * 4), 0.5);

  // Big cognitive revelation hit / drum thud (44.0s)
  addSound(44.0, 1.8, t => (Math.sin(2 * Math.PI * 80 * t) + Math.sin(2 * Math.PI * 110 * t) * 0.7) * Math.exp(-t * 2.5), 0.65);

  // Neon buzzing & theorem slam (52.0s - 63.0s)
  addSound(52.0, 0.8, t => (Math.sin(2 * Math.PI * 587.33 * t) + Math.sin(2 * Math.PI * 880 * t)) * Math.exp(-t * 5), 0.55);
  addSound(53.0, 10.0, t => (Math.sin(2 * Math.PI * 120 * t) * 0.1 + noise() * 0.04) * Math.sin(Math.PI * t / 10.0), 0.25);

  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) bytes.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(TEMP_SFX, bytes);
}

// Mix audio
execSync(`ffmpeg -v error -y -i "${VOICE_FILE}" -i "${TEMP_SFX}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.75[s];[v][s]amix=inputs=2:duration=longest" -ar 48000 "${TEMP_MIXED}"`);
console.log('✓ Audio tracks compiled and mixed.');

// -------------------------------------------------------------
// 2. VIDEO RENDERING LOOP
// -------------------------------------------------------------
console.log('2. Starting frame rendering pipeline for Act 2...');

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

function glowText(text, x, y, size, color, glowColor = color, align = 'center', font = 'NotoSans') {
  ctx.save();
  ctx.font = `bold ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (glowColor && glowColor !== 'rgba(0,0,0,0)') {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

async function render() {
  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Background gradient: Atmospheric studio workshop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, '#10172A');
    bgGrad.addColorStop(1, '#1E293B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Floor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 520, WIDTH, 200);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 520); ctx.lineTo(WIDTH, 520);
    ctx.stroke();

    // Top headers
    glowText('CAN AI EVER BECOME CONSCIOUS?', WIDTH / 2, 35, 20, '#F5A623', 'rgba(245, 166, 35, 0.4)', 'center', 'CaveatHand');

    let sceneBanner = 'ACT 2: JOHN SEARLE\'S CHINESE ROOM (1980)';
    if (t >= 15.0 && t < 35.0) sceneBanner = 'THE INSTRUCTION MANUAL: MATCHING SQUIGGLY SHAPES';
    else if (t >= 35.0 && t < 48.0) sceneBanner = 'EXTERNAL ILLUSION: BRILLIANT, BUT ZERO UNDERSTANDING';
    else if (t >= 48.0) sceneBanner = 'THE CORE LAW: SYNTAX IS NOT SEMANTICS';

    glowText(sceneBanner, WIDTH / 2, 75, 22, '#E2E8F0', 'rgba(255, 255, 255, 0.2)', 'center', 'NotoSans');

    // -------------------------------------------------------------
    // ARCHITECTURAL CUTAWAY: THE CHINESE ROOM
    // -------------------------------------------------------------
    const wallX = 460;

    // Outer Room (Left side: 0 to wallX)
    ctx.save();
    // Ambient outdoor lamp
    ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.fillRect(0, 110, wallX, 410);

    // Label: OUTSIDE (CHINESE SPEAKER)
    glowText('OUTSIDE: NATIVE SPEAKER', wallX / 2, 130, 16, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'NotoSans');
    ctx.restore();

    // The Thick Wooden Wall (wallX to wallX + 50)
    ctx.save();
    ctx.fillStyle = '#451A03'; // rich wood grain
    ctx.fillRect(wallX, 110, 50, 410);
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 3;
    ctx.strokeRect(wallX, 110, 50, 410);

    // Wood planks horizontal lines
    for (let y = 140; y < 520; y += 40) {
      ctx.beginPath();
      ctx.moveTo(wallX, y); ctx.lineTo(wallX + 50, y);
      ctx.stroke();
    }

    // The Brass Mail Slot at y = 330
    const slotY = 330;
    ctx.fillStyle = '#D97706';
    ctx.fillRect(wallX - 6, slotY - 12, 62, 24);
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 2;
    ctx.strokeRect(wallX - 6, slotY - 12, 62, 24);

    // Mail slot flap angle (lifts when card passes)
    let flapAngle = 0;
    if ((t >= 14.5 && t <= 17.5) || (t >= 29.5 && t <= 32.5)) {
      flapAngle = Math.sin((t % 3.0) * Math.PI) * 0.7;
    }
    ctx.save();
    ctx.translate(wallX + 25, slotY - 10);
    ctx.rotate(flapAngle);
    ctx.fillStyle = '#92400E';
    ctx.fillRect(-28, 0, 56, 6);
    ctx.restore();
    ctx.restore();

    // Inner Room (Right side: wallX + 50 to WIDTH)
    ctx.save();
    // Warm study lantern glow
    const lanternGrad = ctx.createRadialGradient(850, 220, 20, 850, 220, 320);
    lanternGrad.addColorStop(0, 'rgba(245, 158, 11, 0.15)');
    lanternGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = lanternGrad;
    ctx.fillRect(wallX + 50, 110, WIDTH - wallX - 50, 410);

    // Label: INSIDE THE ROOM
    glowText('INSIDE: ONLY ENGLISH MANUAL', (wallX + 50 + WIDTH) / 2, 130, 16, '#F5A623', 'rgba(245, 166, 35, 0.3)', 'center', 'NotoSans');

    // Mahogany Desk inside
    ctx.fillStyle = '#29140B';
    ctx.fillRect(wallX + 80, 420, 480, 25);
    ctx.fillStyle = '#1C0D07';
    ctx.fillRect(wallX + 110, 445, 30, 75);
    ctx.fillRect(wallX + 490, 445, 30, 75);
    ctx.restore();

    // -------------------------------------------------------------
    // CHARACTERS & ACTIONS
    // -------------------------------------------------------------

    // Left Character: Native Speaker (Outside)
    const speakerIKHand = [
      lerp(0, 35, ease(clamp((t - 14.0) / 1.5))),
      lerp(20, -10, ease(clamp((t - 14.0) / 1.5)))
    ];
    drawFigure(ctx, {
      torso: 5,
      head: 5,
      facing: 'right',
      armL: [-15, 20],
      armR: [speakerIKHand[0], speakerIKHand[1]],
      legL: [-10, 0],
      legR: [10, 0],
      eyes: (t >= 35.0) ? 'wide' : 'normal',
      mouth: (t >= 35.0) ? 'smile' : 'neutral',
      scarf: false
    }, { x: 250, y: 520, r: 62 });

    // Question card passing through slot (at t = 14.0s - 18.0s)
    if (t >= 14.0 && t < 22.0) {
      const cardProgress = clamp((t - 14.0) / 3.0);
      const cardX = lerp(320, 580, cardProgress);
      const cardY = slotY;

      ctx.save();
      ctx.translate(cardX, cardY);
      ctx.fillStyle = '#FEF08A';
      ctx.strokeStyle = '#CA8A04';
      ctx.lineWidth = 2;
      ctx.strokeRect(-35, -22, 70, 44);
      ctx.fillRect(-35, -22, 70, 44);

      // Chinese characters native path representation
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      // Friendly glyph cross
      ctx.moveTo(-15, -10); ctx.lineTo(15, -10);
      ctx.moveTo(0, -18); ctx.lineTo(0, 15);
      ctx.moveTo(-12, 10); ctx.lineTo(12, 10);
      ctx.stroke();

      glowText('QUESTION', 0, -28, 11, '#E2E8F0', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      ctx.restore();
    }

    // Inside Character: Magi
    // Magi sits at desk, looking at encyclopedia
    const bookFlipping = (t >= 21.0 && t <= 32.0);
    const magiArmR = bookFlipping ? [25 + Math.sin(t * 12) * 15, -30 + Math.cos(t * 10) * 10] : [20, 20];
    const magiArmL = bookFlipping ? [-20 + Math.cos(t * 8) * 10, -25] : [-15, 20];

    drawFigure(ctx, {
      torso: 8,
      head: 12,
      facing: 'left',
      armL: magiArmL,
      armR: magiArmR,
      legL: [-15, 30],
      legR: [15, 30],
      eyes: bookFlipping ? 'quizzical' : 'normal',
      mouth: 'neutral',
      scarf: true
    }, { x: 740, y: 480, r: 60 });

    // The Gigantic Encyclopedia on Desk (x=600 to 720, y=360)
    ctx.save();
    ctx.translate(620, 415);
    // Leather book cover
    ctx.fillStyle = '#7C2D12';
    ctx.fillRect(-50, -65, 100, 70);
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 3;
    ctx.strokeRect(-50, -65, 100, 70);

    // Book pages (glowing)
    ctx.fillStyle = '#FEF9C3';
    ctx.fillRect(-45, -60, 90, 60);

    // Book title banner
    glowText('RULES MANUAL', 0, -45, 10, '#78350F', 'rgba(0,0,0,0)', 'center', 'NotoSans');

    // Fluttering page effect
    if (bookFlipping) {
      const flipAngle = (Math.sin(t * 15) * 0.4);
      ctx.save();
      ctx.rotate(flipAngle);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-42, -58, 40, 56);
      ctx.strokeStyle = '#A16207';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-42, -58, 40, 56);
      ctx.restore();
    }
    ctx.restore();

    // Floating Rulebook Step Display (22.0s - 34.0s)
    if (t >= 21.0 && t < 35.0) {
      const stepSpring = spring(t - 21.0, 0.65, 10);
      ctx.save();
      ctx.translate(970, 270);
      ctx.scale(stepSpring, stepSpring);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#F5A623';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(245, 166, 35, 0.4)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.roundRect(-180, -90, 360, 180, 14);
      ctx.fill();
      ctx.stroke();

      glowText('RULEBOOK INSTRUCTION', 0, -60, 15, '#F5A623', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('1. If input symbol is:  [ ⼗ ]', 0, -25, 16, '#F8FAFC', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('2. Lookup Page 842', 0, 5, 15, '#38BDF8', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('3. Copy output symbol: [ ⽊ ]', 0, 35, 16, '#4ADE80', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('~ Zero Chinese understood. Pure lookup!', 0, 65, 14, '#94A3B8', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
      ctx.restore();
    }

    // Response card passing back outside (29.0s - 36.0s)
    if (t >= 29.0 && t < 37.0) {
      const outCardProg = clamp((t - 29.0) / 3.0);
      const outCardX = lerp(600, 300, outCardProg);
      const outCardY = slotY;

      ctx.save();
      ctx.translate(outCardX, outCardY);
      ctx.fillStyle = '#DCFCE7';
      ctx.strokeStyle = '#16A34A';
      ctx.lineWidth = 2;
      ctx.strokeRect(-35, -22, 70, 44);
      ctx.fillRect(-35, -22, 70, 44);

      // Output symbol
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(0, 15);
      ctx.moveTo(-15, -5); ctx.lineTo(15, -5);
      ctx.moveTo(0, -5); ctx.lineTo(-12, 12);
      ctx.moveTo(0, -5); ctx.lineTo(12, 12);
      ctx.stroke();

      glowText('ANSWER', 0, -28, 11, '#16A34A', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      ctx.restore();
    }

    // Outside celebration at 36.0s - 46.0s
    if (t >= 36.0 && t < 47.0) {
      const dingSpring = spring(t - 36.0, 0.7, 9);
      ctx.save();
      ctx.translate(250, 320);
      ctx.scale(dingSpring, dingSpring);
      ctx.fillStyle = 'rgba(22, 163, 74, 0.9)';
      ctx.beginPath();
      ctx.roundRect(-110, -35, 220, 70, 14);
      ctx.fill();
      glowText('"A TRUE GENIUS!"', 0, -8, 18, '#FFFFFF', '#4ADE80', 'center', 'NotoSans');
      glowText('Fluent, witty, and deep', 0, 18, 14, '#DCFCE7', 'rgba(0,0,0,0)', 'center', 'CaveatHand');
      ctx.restore();
    }

    // -------------------------------------------------------------
    // GRAND FINALE BANNER: SYNTAX IS NOT SEMANTICS (47.0s - end)
    // -------------------------------------------------------------
    if (t >= 47.0) {
      const bannerTime = t - 47.0;
      const bannerSpring = spring(bannerTime, 0.6, 8);

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(0, 120, WIDTH, 400);

      ctx.translate(WIDTH / 2, 310);
      ctx.scale(bannerSpring, bannerSpring);

      // Big Glowing Equation
      ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.roundRect(-480, -120, 960, 240, 20);
      ctx.fill();
      ctx.stroke();

      glowText('SYNTAX  ≠  SEMANTICS', 0, -45, 42, '#FFFFFF', '#EF4444', 'center', 'NotoSans');
      glowText('Manipulating Symbols  ≠  Genuine Understanding', 0, 15, 24, '#FCA5A5', 'rgba(0,0,0,0)', 'center', 'NotoSans');
      glowText('Large Language Models are the Chinese Room at planetary scale.', 0, 65, 22, '#F5A623', 'rgba(245, 166, 35, 0.4)', 'center', 'CaveatHand');
      ctx.restore();
    }

    // Write frame to ffmpeg
    const rawBytes = Buffer.from(canvas.data());
    const canWrite = ffmpeg.stdin.write(rawBytes);
    if (!canWrite) {
      await once(ffmpeg.stdin, 'drain');
    }

    if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Act 2 Render: ${pct}% (${frame}/${TOTAL_FRAMES})`);
    }
  }

  ffmpeg.stdin.end();
  await once(ffmpeg, 'close');
  console.log(`\n🎉 Act 2 Render Complete! Output: ${OUTPUT_FILE}`);
}

render().catch(err => {
  console.error('Act 2 Render error:', err);
  process.exit(1);
});

