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
const TOTAL_DUR = 60.0;
const TOTAL_FRAMES = Math.ceil(FPS * TOTAL_DUR);

const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP08-Act1-AI-Zoo-Masterpiece.mp4');

const TEMP_VOICE = '/tmp/ep08_act1_voice.wav';
const TEMP_SFX = '/tmp/ep08_act1_sfx.wav';
const TEMP_MIXED_AUDIO = '/tmp/ep08_act1_audio.wav';

// Math Helpers
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };

// -------------------------------------------------------------
// 1. GENERATE AUDIO TRACKS
// -------------------------------------------------------------
console.log('1. Synthesizing voice narration and procedural Foley audio...');

const scriptLines = [
  { text: "If you open the news today, it feels like a new artificial intelligence is born every twelve hours! ChatGPT, Gemini, Claude, DeepSeek, Llama... Silicon Valley builds trillion dollar datacenters, while open-source labs drop shockwaves across the globe.", at: 0.2 },
  { text: "Everyone claims their model is the smartest mind on Earth. But if you strip away the billion dollar marketing... what actually is an AI model? Are they all the same machine, or completely different creatures?", at: 16.8 },
  { text: "Here is the secret: every single AI on this planet is built on the exact same three-step recipe: words turned into coordinates, numbers multiplied through layers of weights, and probabilities calculated at the speed of light!", at: 28.2 },
  { text: "Yet over the last two years, artificial intelligence split into four distinct species. Welcome to the Modern AI Zoo!", at: 41.5 },
  { text: "Species One: The Fast Auctioneer. Species Two: The Chess Detective. Species Three: The Sixty-Four Chef Kitchen. And Species Four: The Autonomous Agent with hands and eyes!", at: 49.0 }
];

const voiceBuffer = new Float32Array(Math.ceil(TOTAL_DUR * 48000));
for (let i = 0; i < scriptLines.length; i++) {
  const partFile = `/tmp/act1_part_${i}.wav`;
  // use existing parts or synthesize
  if (!fs.existsSync(partFile)) {
    execSync(`say -v Samantha "${scriptLines[i].text}" -o "${partFile}" --data-format=LEI16@48000`);
  }
  const buf = fs.readFileSync(partFile);
  const sampleCount = Math.floor((buf.length - 44) / 2);
  const startSample = Math.round(scriptLines[i].at * 48000);
  for (let s = 0; s < sampleCount; s++) {
    if (startSample + s < voiceBuffer.length) {
      voiceBuffer[startSample + s] = buf.readInt16LE(44 + s * 2) / 32768.0;
    }
  }
}

// Write voice WAV
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
  let seed = 38472;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };

  function addSound(timeSec, durationSec, fn, gain = 0.3) {
    const startIdx = Math.round(timeSec * rate);
    const count = Math.min(n - startIdx, Math.round(durationSec * rate));
    for (let i = 0; i < count; i++) samples[startIdx + i] += fn(i / rate) * gain;
  }

  // Neon billboard hum and flickers (0.0s - 16.5s)
  addSound(0.0, 16.0, t => (noise() * 0.1 + Math.sin(2 * Math.PI * 120 * t) * 0.15) * Math.min(1, t) * Math.min(1, 16 - t), 0.25);

  // Billboards popping on (t = 1.0s, 2.5s, 4.0s, 5.5s)
  [1.0, 2.5, 4.0, 5.5, 7.0].forEach(st => {
    addSound(st, 0.2, t => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 18), 0.4);
  });

  // Ticker money ding for datacenter spend (t = 9.5s)
  addSound(9.5, 0.8, t => (Math.sin(2 * Math.PI * 1320 * t) + Math.sin(2 * Math.PI * 1760 * t) * 0.7) * Math.exp(-t * 6), 0.45);

  // Feather duster cartoon swoosh (t = 17.5s)
  addSound(17.5, 0.6, t => noise() * Math.sin((t / 0.6) * Math.PI), 0.4);

  // Microchip zoom & magnifying glass beep (t = 20.0s)
  addSound(20.0, 0.8, t => Math.sin(2 * Math.PI * (500 + t * 400) * t) * Math.exp(-t * 3), 0.4);

  // 3-Step Recipe Chimes (t = 29.5s, 33.5s, 37.0s)
  // Step 1: Words to Coordinates
  addSound(29.5, 0.6, t => (Math.sin(2 * Math.PI * 523.25 * t) + Math.sin(2 * Math.PI * 659.25 * t)) * Math.exp(-t * 4), 0.5);
  // Step 2: Layer Multiplication Hum
  addSound(33.5, 1.2, t => Math.sin(2 * Math.PI * (220 + Math.sin(t * 15) * 50) * t) * Math.sin((t / 1.2) * Math.PI), 0.45);
  // Step 3: Probabilities calculated
  addSound(37.0, 0.8, t => (Math.sin(2 * Math.PI * 783.99 * t) + Math.sin(2 * Math.PI * 1046.5 * t)) * Math.exp(-t * 4), 0.5);

  // Evolution branch split whoosh (t = 42.0s)
  addSound(42.0, 0.8, t => Math.sin(2 * Math.PI * (150 + t * 300) * t) * Math.exp(-t * 2.5), 0.45);

  // 4 Terrarium Booth pop-in spring boings (t = 49.5s, 51.5s, 53.5s, 55.5s)
  [49.5, 51.5, 53.5, 55.5].forEach((st, idx) => {
    addSound(st, 0.4, t => Math.sin(2 * Math.PI * (320 + idx * 70 + Math.sin(t * 50) * 120) * t) * Math.exp(-t * 8), 0.5);
  });

  // Grand Finale Fanfare (t = 57.0s)
  addSound(57.0, 3.0, t => {
    const env = Math.exp(-t * 1.5);
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
console.log('✓ Audio tracks compiled.');

// -------------------------------------------------------------
// 2. VIDEO RENDERING LOOP
// -------------------------------------------------------------
console.log('2. Starting frame rendering pipeline for Act 1 (The Modern AI Zoo)...');

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

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);

  if (t < 16.8) {
    // ---------------------------------------------------------
    // SCENE 1: THE BUZZWORD STORM & TIMES SQUARE MARQUEE
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#0B0D17');
    bgGrad.addColorStop(1, '#1A1D2E');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // City skyline silhouette in background
    ctx.fillStyle = '#06070D';
    for (let b = 0; b < 16; b++) {
      const bx = b * 85 - 20;
      const bw = 70;
      const bh = 140 + ((b * 47) % 180);
      ctx.fillRect(bx, 480 - bh, bw, bh);
      // Small yellow windows
      ctx.fillStyle = '#FEF08A';
      for (let wx = bx + 10; wx < bx + bw - 10; wx += 16) {
        for (let wy = 480 - bh + 15; wy < 460; wy += 25) {
          if ((wx + wy + Math.floor(t * 3)) % 7 === 0) {
            ctx.fillRect(wx, wy, 8, 12);
          }
        }
      }
      ctx.fillStyle = '#06070D';
    }

    // Street ground
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 480, WIDTH, 240);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 480); ctx.lineTo(WIDTH, 480); ctx.stroke();

    // Floating Giant Neon Brand Billboards flashing across the sky
    const brands = [
      { name: "ChatGPT", color: '#10A37F', x: 200, y: 110, w: 180 },
      { name: "Gemini", color: '#38BDF8', x: 420, y: 70, w: 170 },
      { name: "Claude", color: '#D97706', x: 630, y: 110, w: 170 },
      { name: "DeepSeek", color: '#3B82F6', x: 840, y: 70, w: 190 },
      { name: "Llama 3", color: '#EC4899', x: 1060, y: 110, w: 170 }
    ];

    brands.forEach((br, bi) => {
      const pulse = Math.abs(Math.sin(t * 5 + bi * 1.5));
      ctx.save();
      ctx.translate(br.x, br.y);

      // Neon sign box
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(-br.w / 2, -30, br.w, 60, 12);
      ctx.fill();

      ctx.strokeStyle = br.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = br.color;
      ctx.shadowBlur = 12 + pulse * 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Brand text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px NotoSans';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(br.name, 0, 0);
      ctx.restore();
    });

    // Datacenter Spending Ticker Marquee in Center Sky
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(240, 180, 800, 50);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.strokeRect(240, 180, 800, 50);

    const spendBillion = Math.floor(100 + t * 45);
    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 20px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText(`*** GLOBAL COMPUTE SPEND: $${spendBillion} BILLION | NEW MODEL EVERY 12 HOURS ***`, 640, 212);

    // Magi in center stage, overwhelmed, hands covering ears, head shaking!
    const headWobble = Math.sin(t * 20) * 8;
    drawFigure(ctx, {
      torso: 0,
      head: headWobble,
      facing: 'front',
      accessory: 'wizard-hat',
      targetArmL: [-40, -115], // Hand up covering left ear
      targetArmR: [40, -115],  // Hand up covering right ear
      eyes: 'wide',
      brows: 'worried',
      mouth: 'o'
    }, { x: 640, y: 480, r: 40, seed: Math.floor(t * 12) });

    // Swirling dizziness / buzzword icons around Magi's head
    for (let c = 0; c < 5; c++) {
      const cAngle = t * 4 + (c / 5) * Math.PI * 2;
      const cDist = 90 + Math.sin(t * 3 + c) * 15;
      const cx = 640 + Math.cos(cAngle) * cDist;
      const cy = 340 + Math.sin(cAngle) * 35;
      ctx.fillStyle = '#FEF08A';
      ctx.font = 'bold 22px CaveatHand';
      ctx.fillText("?", cx, cy);
    }

  } else if (t < 28.2) {
    // ---------------------------------------------------------
    // SCENE 2: STRIPPING AWAY THE BRANDING TO RAW SILICON
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#060A17');
    bgGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Glowing Pedestal in center
    const pedX = 640, pedY = 460;
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(pedX, pedY, 180, 45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Raw Silicon Microprocessor Chip on Pedestal
    const chipY = pedY - 45;
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(pedX - 70, chipY - 70, 140, 140);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.strokeRect(pedX - 70, chipY - 70, 140, 140);

    // Golden Circuit Pins on chip perimeter
    ctx.fillStyle = '#F59E0B';
    for (let pin = -50; pin <= 50; pin += 25) {
      ctx.fillRect(pedX + pin - 6, chipY - 82, 12, 12);
      ctx.fillRect(pedX + pin - 6, chipY + 70, 12, 12);
      ctx.fillRect(pedX - 82, chipY + pin - 6, 12, 12);
      ctx.fillRect(pedX + 70, chipY + pin - 6, 12, 12);
    }

    // Silicon Wafer Die Core (Golden Mirror)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(pedX - 45, chipY - 45, 90, 90);
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 2;
    ctx.strokeRect(pedX - 45, chipY - 45, 90, 90);

    // Microscopic Binary Switches Glowing Inside Chip
    for (let bx = -35; bx <= 35; bx += 18) {
      for (let by = -35; by <= 35; by += 18) {
        const bit = ((bx * 7 + by * 13 + Math.floor(t * 6)) % 2 === 0) ? '1' : '0';
        ctx.fillStyle = bit === '1' ? '#38BDF8' : '#475569';
        ctx.font = 'bold 11px NotoSans';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bit, pedX + bx, chipY + by);
      }
    }

    // Magi leaning in from the left with a magnifying glass using 2-Bone IK
    const magiX = 360, magiY = 480;
    const magTargetX = pedX - 40 - magiX;
    const magTargetY = chipY - magiY;
    const distToTarget = Math.hypot(magTargetX, magTargetY);
    const maxReach = 110;
    const clampedTarget = [
      (magTargetX / distToTarget) * Math.min(distToTarget, maxReach),
      (magTargetY / distToTarget) * Math.min(distToTarget, maxReach)
    ];

    drawFigure(ctx, {
      torso: 6,
      head: 8,
      facing: 'right',
      accessory: 'wizard-hat',
      accessories: ['magnifier'],
      targetArmR: clampedTarget,
      targetArmL: [-25, 10],
      eyes: 'wide',
      brows: 'neutral',
      mouth: 'smile'
    }, { x: magiX, y: magiY, r: 38, seed: Math.floor(t * 12) });

    // Big Callout Banner above
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 30px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Strip away the branding... It's all the same silicon physics!", 640, 70);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '18px NotoSans';
    ctx.fillText("Billions of microscopic switches etching human thought into electricity.", 640, 110);

  } else if (t < 41.5) {
    // ---------------------------------------------------------
    // SCENE 3: THE UNIVERSAL 3-STEP RECIPE (FEYNMAN CLARITY)
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#030712');
    bgGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 32px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("The Universal 3-Step Recipe Behind EVERY AI Model", 640, 55);

    // 3 Clean Sequential Factory Cards
    const steps = [
      {
        num: "STEP 1",
        title: "Words  -->  Coordinates",
        desc: 'Words become GPS vectors\n"Cat" = [0.42, -0.89, 0.15]',
        color: '#0284C7',
        borderColor: '#38BDF8',
        x: 230
      },
      {
        num: "STEP 2",
        title: "Layer Multiplication",
        desc: "Multiply vectors across\nbillions of trained weights",
        color: '#4338CA',
        borderColor: '#818CF8',
        x: 640
      },
      {
        num: "STEP 3",
        title: "Next-Word Probability",
        desc: "Calculate probability\nPick best winning token!",
        color: '#065F46',
        borderColor: '#34D399',
        x: 1050
      }
    ];

    steps.forEach((st, idx) => {
      const cardY = 240;
      const cardW = 340, cardH = 220;

      ctx.save();
      ctx.translate(st.x, cardY);

      // Card background
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
      ctx.fill();

      ctx.strokeStyle = st.borderColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Step Number Pill
      ctx.fillStyle = st.color;
      ctx.beginPath();
      ctx.roundRect(-50, -cardH / 2 - 16, 100, 32, 16);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px NotoSans';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.num, 0, -cardH / 2);

      // Step Title
      ctx.fillStyle = st.borderColor;
      ctx.font = 'bold 22px CaveatHand';
      ctx.fillText(st.title, 0, -50);

      // Visual Demo inside card
      if (idx === 0) {
        // Step 1: Word to vector
        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 18px NotoSans';
        ctx.fillText('"Cat"  -->  [ 0.42, -0.89, 0.15 ]', 0, 0);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '14px NotoSans';
        ctx.fillText("Embedding Lookup", 0, 45);
      } else if (idx === 1) {
        // Step 2: Matrix weights grid
        ctx.fillStyle = '#A5B4FC';
        ctx.font = 'bold 18px NotoSans';
        ctx.fillText("Y = Softmax( W · X + b )", 0, 0);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '14px NotoSans';
        ctx.fillText("Billions of Matrix Operations", 0, 45);
      } else {
        // Step 3: Probabilities
        ctx.fillStyle = '#6EE7B7';
        ctx.font = 'bold 18px NotoSans';
        ctx.fillText('"meow" 94% | "bark" 2%', 0, 0);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '14px NotoSans';
        ctx.fillText("Next-Token Sampling", 0, 45);
      }

      ctx.restore();

      // Clean Drawn Connecting Arrows between cards
      if (idx < 2) {
        const arrowX = (steps[idx].x + steps[idx + 1].x) / 2;
        ctx.save();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(arrowX - 22, cardY);
        ctx.lineTo(arrowX + 22, cardY);
        ctx.lineTo(arrowX + 10, cardY - 12);
        ctx.moveTo(arrowX + 22, cardY);
        ctx.lineTo(arrowX + 10, cardY + 12);
        ctx.stroke();
        ctx.restore();
      }
    });

    // Magi standing below conducting the explanation with arms raised
    const magiX = 640, magiY = 560;
    drawFigure(ctx, {
      torso: 0,
      head: 0,
      facing: 'front',
      accessory: 'wizard-hat',
      targetArmL: [-50, -145],
      targetArmR: [50, -145],
      eyes: 'smile',
      mouth: 'smile'
    }, { x: magiX, y: magiY, r: 38, seed: Math.floor(t * 12) });

  } else if (t < 49.0) {
    // ---------------------------------------------------------
    // SCENE 4: THE EVOLUTIONARY BRANCH SPLIT
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#090D16');
    bgGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 34px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("The Modern AI Evolutionary Split", 640, 70);

    // Evolutionary Tree Trunk splitting into 4 Branches
    const trunkX = 640, trunkY = 460;
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(trunkX, trunkY);
    ctx.lineTo(trunkX, 320);
    ctx.stroke();

    // 4 Branches
    const branches = [180, 480, 800, 1100];
    branches.forEach((bx, bi) => {
      ctx.strokeStyle = bi % 2 === 0 ? '#38BDF8' : '#34D399';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(trunkX, 320);
      ctx.bezierCurveTo(trunkX, 240, bx, 260, bx, 180);
      ctx.stroke();

      // Glowing Node at tip
      ctx.fillStyle = bi % 2 === 0 ? '#38BDF8' : '#34D399';
      ctx.beginPath();
      ctx.arc(bx, 180, 12, 0, Math.PI * 2);
      ctx.fill();
    });

    // Magi standing proudly at root
    drawFigure(ctx, {
      torso: 0,
      head: 0,
      facing: 'front',
      accessory: 'wizard-hat',
      targetArmL: [-50, -80],
      targetArmR: [50, -80],
      eyes: 'wide',
      mouth: 'smile'
    }, { x: trunkX, y: 550, r: 40, seed: Math.floor(t * 12) });

    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 28px CaveatHand';
    ctx.fillText("Welcome to the 4 Distinct Species of the Modern AI Zoo!", 640, 640);

  } else {
    // ---------------------------------------------------------
    // SCENE 5: THE 4 SPECIES TERRARIUM SHOWCASE
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#030712');
    bgGrad.addColorStop(1, '#0B0F19');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 30px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("The 4 Inhabitants of the Modern AI Zoo", 640, 45);

    // 4 Glass Exhibition Terrariums
    const species = [
      {
        num: "Species 1",
        name: "Fast Auctioneer",
        models: "GPT-4o / Flash",
        desc: "Next-Token Speed",
        acc: ['cap'],
        color: '#0284C7',
        x: 180
      },
      {
        num: "Species 2",
        name: "Chess Detective",
        models: "o1 / DeepSeek-R1",
        desc: "Thinking Tokens",
        acc: ['deerstalker', 'magnifier'],
        color: '#7C3AED',
        x: 480
      },
      {
        num: "Species 3",
        name: "64-Chef Kitchen",
        models: "DeepSeek-V3 MoE",
        desc: "Sparse 95% Power",
        acc: ['chef-hat', 'spatula'],
        color: '#059669',
        x: 780
      },
      {
        num: "Species 4",
        name: "Autonomous Agent",
        models: "Claude Computer Use",
        desc: "Hands, Eyes & Tools",
        acc: ['goggles'],
        color: '#EA580C',
        x: 1080
      }
    ];

    const boothW = 270, boothH = 460;
    const boothY = 320;

    species.forEach((sp, idx) => {
      const popT = clamp((t - (49.0 + idx * 2.0)) / 0.6);
      const popSpring = spring(popT, 0.7, 12);
      const curY = lerp(boothY + 60, boothY, popSpring);

      ctx.save();
      ctx.translate(sp.x, curY);

      // Glass Booth
      ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
      ctx.beginPath();
      ctx.roundRect(-boothW / 2 + 10, -boothH / 2, boothW - 20, boothH, 16);
      ctx.fill();

      ctx.strokeStyle = sp.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Top Species Pill
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.roundRect(-boothW / 2 + 25, -boothH / 2 + 15, boothW - 50, 36, 12);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px NotoSans';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${sp.num}: ${sp.name}`, 0, -boothH / 2 + 33);

      // Mascot Stickman inside Terrarium
      const figBounce = Math.sin(t * 6 + idx) * 4;
      drawFigure(ctx, {
        torso: 0,
        head: figBounce > 0 ? 3 : -3,
        facing: 'front',
        accessory: sp.acc[0],
        accessories: sp.acc,
        eyes: 'normal',
        mouth: 'smile'
      }, { x: 0, y: 40 + figBounce, r: 32, seed: Math.floor(t * 12) + idx });

      // Model examples tag
      ctx.fillStyle = '#FEF08A';
      ctx.font = 'bold 16px NotoSans';
      ctx.fillText(sp.models, 0, 140);

      // Key mechanism tag
      ctx.fillStyle = '#94A3B8';
      ctx.font = '14px NotoSans';
      ctx.fillText(sp.desc, 0, 175);

      ctx.restore();
    });

    // Magi welcoming the viewer in bottom banner
    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 26px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Let's break down how every single one of them works!", 640, 620);
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

  if (currentCaption) {
    let displayCue = currentCaption;
    if (displayCue.includes("feels like a new artificial intelligence is born")) {
      displayCue = t < 8.0 ? "A new AI seems to be born every twelve hours!" : "Silicon Valley builds giant datacenters while open-source rises!";
    } else if (displayCue.includes("smartest mind on Earth")) {
      displayCue = t < 22.0 ? "Everyone claims their model is the smartest mind on Earth." : "What actually is an AI model beneath the branding?";
    } else if (displayCue.includes("exact same three-step recipe")) {
      if (t < 32.5) displayCue = "Every AI is built on the same three-step recipe:";
      else if (t < 36.5) displayCue = "Words to coordinates... numbers through weight layers...";
      else displayCue = "And probabilities calculated at the speed of light!";
    } else if (displayCue.includes("split into four distinct species")) {
      displayCue = "AI has evolved into 4 distinct species. Welcome to the Zoo!";
    } else if (displayCue.includes("Species One: The Fast Auctioneer")) {
      if (t < 52.0) displayCue = "Species 1: Fast Auctioneers | Species 2: Chess Detectives";
      else displayCue = "Species 3: The 64-Chef Kitchen | Species 4: Autonomous Agents!";
    }

    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT - 55);

    ctx.font = 'bold 28px CaveatHand';
    const textWidth = ctx.measureText(displayCue).width;
    const boxW = Math.min(WIDTH - 80, textWidth + 60);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -24, boxW, 48, 24);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayCue, 0, 0);
    ctx.restore();
  }

  // Pipe to ffmpeg
  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (Date.now() - lastReportTime > 3000) {
    const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
    console.log(`Zoo Render progress: ${pct}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
    lastReportTime = Date.now();
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 1 Zoo Masterpiece rendered successfully: ${OUTPUT_FILE}`);
