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
const TOTAL_DUR = 52.0;
const TOTAL_FRAMES = Math.ceil(FPS * TOTAL_DUR);

const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP08-Act2-Vector-Supermarket-Masterpiece.mp4');

const TEMP_VOICE = '/tmp/ep08_act2_voice.wav';
const TEMP_SFX = '/tmp/ep08_act2_sfx.wav';
const TEMP_MIXED_AUDIO = '/tmp/ep08_act2_audio.wav';

// Math Helpers
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };

// -------------------------------------------------------------
// 1. GENERATE AUDIO TRACKS
// -------------------------------------------------------------
console.log('1. Compiling voice narration and Foley tracks for Act 2...');

const scriptLines = [
  { text: "Computers cannot read letters! A computer chip is literally just billions of microscopic switches that are either ON or OFF. It has no idea what the word dog or banana means. So how do we feed human language into silicon?", at: 0.2 },
  { text: "Imagine a giant supermarket with thousands of aisles. The manager does not organize items alphabetically! Bananas sit next to apples in the fruit aisle, and dog food sits next to leashes in the pet aisle. In machine learning, this is called an Embedding Space: every word gets a GPS coordinate in the supermarket of meaning!", at: 13.5 },
  { text: "Because words are coordinates, you can actually do math with human thoughts! Take the GPS coordinates of KING, subtract MAN, and add WOMAN... the coordinates slide straight across the aisles and land directly on QUEEN! The computer does not feel royalty. It just knows geometry!", at: 32.5 }
];

const voiceBuffer = new Float32Array(Math.ceil(TOTAL_DUR * 48000));
for (let i = 0; i < scriptLines.length; i++) {
  const partFile = `/tmp/act2_part_${i}.wav`;
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
  let seed = 48215;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };

  function addSound(timeSec, durationSec, fn, gain = 0.3) {
    const startIdx = Math.round(timeSec * rate);
    const count = Math.min(n - startIdx, Math.round(durationSec * rate));
    for (let i = 0; i < count; i++) samples[startIdx + i] += fn(i / rate) * gain;
  }

  // Typewriter clatter (t = 1.0s, 2.0s, 3.0s, 4.0s)
  [1.0, 1.8, 2.6, 3.4].forEach(st => {
    addSound(st, 0.15, t => (noise() * 0.8 + Math.sin(2 * Math.PI * 1400 * t) * 0.4) * Math.exp(-t * 25), 0.45);
  });

  // Typewriter bell carriage return (t = 4.2s)
  addSound(4.2, 0.6, t => Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 8), 0.4);

  // Electrical short circuit buzz & error slam (t = 6.5s)
  addSound(6.5, 0.8, t => (noise() * 0.85 + Math.sin(2 * Math.PI * 120 * t) * 0.5) * Math.exp(-t * 5), 0.65);

  // Supermarket doors whoosh & jetpack thrust (t = 13.5s - 20.0s)
  addSound(13.5, 6.5, t => (noise() * 0.2 + Math.sin(2 * Math.PI * 85 * t) * 0.3) * Math.min(1, t) * Math.min(1, 6.5 - t), 0.3);

  // Laser tape measure chirp (t = 22.0s, 26.0s)
  [22.0, 26.0].forEach(st => {
    addSound(st, 0.4, t => Math.sin(2 * Math.PI * (600 + t * 800) * t) * Math.exp(-t * 6), 0.45);
  });

  // Wrench slam on "subtract Man" (t = 36.5s)
  addSound(36.5, 0.45, t => (noise() * 0.8 + Math.sin(2 * Math.PI * 650 * t) * 0.5) * Math.exp(-t * 12), 0.7);

  // Vector coordinate computation hum (t = 39.0s - 43.0s)
  addSound(39.0, 4.0, t => Math.sin(2 * Math.PI * (220 + Math.sin(t * 12) * 60) * t) * Math.sin((t / 4.0) * Math.PI), 0.35);

  // Queen explosion shockwave & victory fanfare (t = 43.5s)
  addSound(43.5, 0.4, t => (noise() * 0.7 + Math.sin(2 * Math.PI * 90 * t)) * Math.exp(-t * 10), 0.7);
  addSound(43.8, 3.5, t => {
    const env = Math.exp(-t * 1.6);
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
console.log('2. Starting frame rendering pipeline for Act 2 (Words into Numbers & Supermarket)...');

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

  if (t < 13.5) {
    // ---------------------------------------------------------
    // SCENE 1: THE TYPEWRITER & THE LETTER TRAP
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#1E1B18');
    bgGrad.addColorStop(1, '#0C0A09');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 30px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("The Letter Trap: Computers Cannot Read Letters!", 640, 50);

    // Wooden Desk
    ctx.fillStyle = '#292524';
    ctx.fillRect(150, 440, 980, 280);
    ctx.strokeStyle = '#57534E';
    ctx.lineWidth = 4;
    ctx.strokeRect(150, 440, 980, 280);

    // Antique Mechanical Typewriter
    const typeX = 520, typeY = 440;
    ctx.fillStyle = '#44403C';
    ctx.beginPath();
    ctx.roundRect(typeX - 110, typeY - 60, 220, 80, 12);
    ctx.fill(); ctx.stroke();

    // Typewriter Keys & Carriage
    ctx.fillStyle = '#1C1917';
    ctx.fillRect(typeX - 90, typeY - 45, 180, 50);

    // Paper sheet protruding from carriage
    ctx.fillStyle = '#FAFAF9';
    ctx.fillRect(typeX - 60, typeY - 140, 120, 90);
    ctx.strokeStyle = '#78716C';
    ctx.lineWidth = 2;
    ctx.strokeRect(typeX - 60, typeY - 140, 120, 90);

    // Typed word "D - O - G" appearing letter by letter
    const dogLetters = ["D", "O", "G"];
    const lettersTyped = Math.min(3, Math.max(0, Math.floor((t - 1.0) / 0.8)));
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 28px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText(dogLetters.slice(0, lettersTyped).join(" "), typeX, typeY - 80);

    // Computer Cable connecting paper to chip
    const cableEnd = t >= 6.5;
    ctx.strokeStyle = cableEnd ? '#EF4444' : '#38BDF8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(typeX + 60, typeY - 100);
    ctx.bezierCurveTo(typeX + 180, typeY - 160, 780, typeY - 80, 880, typeY - 40);
    ctx.stroke();

    // Giant Microchip on the right
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(860, typeY - 90, 120, 100);
    ctx.strokeStyle = cableEnd ? '#EF4444' : '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(860, typeY - 90, 120, 100);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px NotoSans';
    ctx.fillText("CPU DIE", 920, typeY - 35);

    // Electric sparks / explosion at t = 6.5s
    if (t >= 6.5) {
      // Sparks
      for (let sp = 0; sp < 12; sp++) {
        const ang = (sp / 12) * Math.PI * 2;
        const dist = 25 + ((t * 80 + sp * 10) % 35);
        ctx.fillStyle = sp % 2 === 0 ? '#EF4444' : '#FEF08A';
        ctx.beginPath();
        ctx.arc(880 + Math.cos(ang) * dist, typeY - 40 + Math.sin(ang) * dist, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Big Red Warning Banner
      ctx.save();
      ctx.translate(640, 180);
      ctx.fillStyle = '#7F1D1D';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-240, -40, 480, 80, 16);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#FEE2E2';
      ctx.font = 'bold 22px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText("ERROR: NO LETTERS ALLOWED!", 0, -10);
      ctx.font = '15px NotoSans';
      ctx.fillText("Transistors only understand binary switches (0 and 1)", 0, 18);
      ctx.restore();
    }

    // Magi typing at desk with 2-Bone IK
    const typeBounce = (t < 4.5) ? Math.sin(t * 18) * 8 : 0;
    const magiX = 320, magiY = 480;

    drawFigure(ctx, {
      torso: 6,
      head: t >= 6.5 ? 12 : -4,
      facing: 'right',
      accessory: 'wizard-hat',
      targetArmR: [60, -60 + typeBounce], // Hand on typewriter keys
      targetArmL: [40, -60 - typeBounce],
      eyes: t >= 6.5 ? 'wide' : 'normal',
      brows: t >= 6.5 ? 'up' : 'neutral',
      mouth: t >= 6.5 ? 'o' : 'smile'
    }, { x: magiX, y: magiY, r: 38, seed: Math.floor(t * 12) });

  } else if (t < 32.5) {
    // ---------------------------------------------------------
    // SCENE 2: THE 3D SUPERMARKET OF MEANING (EMBEDDING SPACE)
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 30px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("The 3D Supermarket of Meaning: Embedding Space", 640, 48);

    // Multi-tiered Aisle Shelves
    // Aisle 1 (Left): FRUIT & PRODUCE (Apple, Banana, Orange, Mango)
    const aisle1X = 320;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(aisle1X - 180, 130, 360, 360);
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 3;
    ctx.strokeRect(aisle1X - 180, 130, 360, 360);

    ctx.fillStyle = '#22C55E';
    ctx.font = 'bold 20px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText("AISLE 1: FRUIT & PRODUCE", aisle1X, 165);

    // Fruit word items with GPS coordinates
    const fruits = [
      { name: "BANANA", coord: "[ 0.82,  0.15, -0.40 ]", x: aisle1X - 80, y: 240 },
      { name: "APPLE",  coord: "[ 0.79,  0.18, -0.38 ]", x: aisle1X + 80, y: 240 },
      { name: "ORANGE", coord: "[ 0.85,  0.12, -0.42 ]", x: aisle1X - 80, y: 360 },
      { name: "MANGO",  coord: "[ 0.88,  0.10, -0.45 ]", x: aisle1X + 80, y: 360 }
    ];

    fruits.forEach(f => {
      ctx.fillStyle = '#064E3B';
      ctx.beginPath(); ctx.roundRect(f.x - 70, f.y - 30, 140, 60, 10); ctx.fill();
      ctx.strokeStyle = '#4ADE80'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#F0FDF4';
      ctx.font = 'bold 16px NotoSans';
      ctx.fillText(f.name, f.x, f.y - 6);
      ctx.fillStyle = '#86EFAC';
      ctx.font = '10px NotoSans';
      ctx.fillText(f.coord, f.x, f.y + 16);
    });

    // Aisle 2 (Right): PET CARE (Dog, Cat, Leash, Kibble)
    const aisle2X = 960;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(aisle2X - 180, 130, 360, 360);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(aisle2X - 180, 130, 360, 360);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 20px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText("AISLE 2: PET CARE", aisle2X, 165);

    const pets = [
      { name: "DOG",    coord: "[ -0.75,  0.90,  0.10 ]", x: aisle2X - 80, y: 240 },
      { name: "CAT",    coord: "[ -0.72,  0.88,  0.12 ]", x: aisle2X + 80, y: 240 },
      { name: "LEASH",  coord: "[ -0.68,  0.82,  0.18 ]", x: aisle2X - 80, y: 360 },
      { name: "KIBBLE", coord: "[ -0.79,  0.94,  0.08 ]", x: aisle2X + 80, y: 360 }
    ];

    pets.forEach(p => {
      ctx.fillStyle = '#0C4A6E';
      ctx.beginPath(); ctx.roundRect(p.x - 70, p.y - 30, 140, 60, 10); ctx.fill();
      ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#F0F9FF';
      ctx.font = 'bold 16px NotoSans';
      ctx.fillText(p.name, p.x, p.y - 6);
      ctx.fillStyle = '#7DD3FC';
      ctx.font = '10px NotoSans';
      ctx.fillText(p.coord, p.x, p.y + 16);
    });

    // Laser Distance Line between Banana and Dog (Semantic Distance)
    ctx.save();
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(aisle1X + 150, 240);
    ctx.lineTo(aisle2X - 150, 240);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#F43F5E';
    ctx.font = 'bold 15px NotoSans';
    ctx.fillText("High Semantic Distance (Unrelated)", 640, 230);

    // Magi Flying between aisles on a Jetpack with laser tape measure
    const flyX = 640 + Math.sin(t * 3) * 35;
    const flyY = 340 + Math.cos(t * 3) * 20;

    // Jetpack flames
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath(); ctx.ellipse(flyX - 18, flyY + 50, 6, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(flyX + 18, flyY + 50, 6, 16, 0, 0, Math.PI * 2); ctx.fill();

    drawFigure(ctx, {
      torso: 0,
      head: 0,
      facing: 'front',
      accessory: 'wizard-hat',
      targetArmL: [-45, -70],
      targetArmR: [45, -70],
      eyes: 'smile',
      mouth: 'smile'
    }, { x: flyX, y: flyY, r: 35, seed: Math.floor(t * 12) });

    // Educational Bottom Banner
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 24px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Words with similar meanings are placed close together in multi-dimensional space!", 640, 580);

  } else {
    // ---------------------------------------------------------
    // SCENE 3: THE VECTOR MATH MIRACLE (KING - MAN + WOMAN = QUEEN)
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#030712');
    bgGrad.addColorStop(1, '#0B0F19');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 3D Perspective Grid (Manim Style)
    const gridOriginX = 640, gridOriginY = 360;
    ctx.save();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.5;
    for (let r = -5; r <= 5; r++) {
      ctx.beginPath();
      ctx.moveTo(gridOriginX - 450 + r * 60, gridOriginY + 220);
      ctx.lineTo(gridOriginX + r * 30, gridOriginY - 140);
      ctx.stroke();
    }
    for (let d = 0; d <= 8; d++) {
      const y = gridOriginY - 140 + d * 45;
      const span = 150 + d * 50;
      ctx.beginPath();
      ctx.moveTo(gridOriginX - span, y);
      ctx.lineTo(gridOriginX + span, y);
      ctx.stroke();
    }
    ctx.restore();

    // The Famous Formula at Top
    ctx.save();
    ctx.translate(640, 70);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-320, -32, 640, 64);
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 3;
    ctx.strokeRect(-320, -32, 640, 64);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px CaveatHand';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Vector(KING) - Vector(MAN) + Vector(WOMAN) = Vector(QUEEN)", 0, 0);
    ctx.restore();

    // 3D Coordinate Nodes on Grid
    const kingPos = { x: 380, y: 260 };
    const manPos = { x: 500, y: 380 };
    const womanPos = { x: 740, y: 380 };
    const queenPos = { x: 880, y: 260 };

    // King Node
    ctx.fillStyle = '#0284C7';
    ctx.beginPath(); ctx.roundRect(kingPos.x - 55, kingPos.y - 25, 110, 50, 10); ctx.fill();
    ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 18px NotoSans'; ctx.fillText("KING", kingPos.x, kingPos.y + 6);

    // Subtract Man (Wrench strike!)
    const manStruck = t >= 36.5;
    ctx.fillStyle = manStruck ? '#450A0A' : '#1E293B';
    ctx.beginPath(); ctx.roundRect(manPos.x - 55, manPos.y - 25, 110, 50, 10); ctx.fill();
    ctx.strokeStyle = manStruck ? '#EF4444' : '#64748B'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = manStruck ? '#FCA5A5' : '#FFFFFF'; ctx.font = 'bold 18px NotoSans';
    ctx.fillText(manStruck ? "- MAN" : "MAN", manPos.x, manPos.y + 6);

    // Add Woman
    ctx.fillStyle = '#831843';
    ctx.beginPath(); ctx.roundRect(womanPos.x - 55, womanPos.y - 25, 110, 50, 10); ctx.fill();
    ctx.strokeStyle = '#F472B6'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 18px NotoSans'; ctx.fillText("+ WOMAN", womanPos.x, womanPos.y + 6);

    // Coordinate Vector Calculation Path (Golden Arrow sliding across)
    const calcProgress = clamp((t - 38.0) / 4.0);
    const arrowX = lerp(kingPos.x, queenPos.x, ease(calcProgress));
    const arrowY = lerp(kingPos.y, queenPos.y, ease(calcProgress));

    ctx.save();
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(kingPos.x, kingPos.y);
    ctx.bezierCurveTo(manPos.x, manPos.y, womanPos.x, womanPos.y, arrowX, arrowY);
    ctx.stroke();
    ctx.restore();

    // Queen Destination Node (Blooms with shockwave when reached!)
    const queenReached = t >= 43.5;
    ctx.save();
    ctx.translate(queenPos.x, queenPos.y);
    if (queenReached) {
      const shock = (t - 43.5);
      ctx.shadowColor = '#34D399';
      ctx.shadowBlur = 25;
      // Shockwave ring
      ctx.strokeStyle = `rgba(52, 211, 153, ${Math.max(0, 1 - shock * 1.5)})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, shock * 140, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = queenReached ? '#065F46' : '#1E293B';
    ctx.beginPath(); ctx.roundRect(-60, -28, 120, 56, 12); ctx.fill();
    ctx.strokeStyle = queenReached ? '#34D399' : '#475569'; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 20px NotoSans';
    ctx.fillText("QUEEN", 0, 7);
    ctx.restore();

    // Magi conducting the calculation on the bottom
    const magiX = 180, magiY = 490;
    drawFigure(ctx, {
      torso: -4,
      head: 6,
      facing: 'right',
      accessory: 'wizard-hat',
      targetArmR: [65, -95], // Pointing right at Queen
      targetArmL: [-25, 10],
      eyes: queenReached ? 'wide' : 'smile',
      mouth: 'smile'
    }, { x: magiX, y: magiY, r: 38, seed: Math.floor(t * 12) });

    // Conclusion Banner
    if (t > 44.0) {
      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 28px CaveatHand';
      ctx.textAlign = 'center';
      ctx.fillText("The computer doesn't know royalty. It just knows geometry!", 640, 610);
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

  if (currentCaption) {
    let displayCue = currentCaption;
    if (displayCue.includes("Computers cannot read letters")) {
      displayCue = t < 6.5 ? "Computers cannot read letters!" : "Chips only understand binary switches (0 and 1).";
    } else if (displayCue.includes("supermarket with thousands of aisles")) {
      if (t < 20.0) displayCue = "Imagine a giant supermarket with thousands of aisles.";
      else if (t < 26.0) displayCue = "Bananas sit in fruit, dog food in pet care!";
      else displayCue = "Every word gets a GPS coordinate in the supermarket of meaning!";
    } else if (displayCue.includes("do math with human thoughts")) {
      if (t < 38.0) displayCue = "Because words are coordinates, you can do math with thoughts!";
      else if (t < 44.0) displayCue = "Take KING, subtract MAN, add WOMAN... and you get QUEEN!";
      else displayCue = "The computer doesn't feel royalty. It just knows geometry!";
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
    console.log(`Act 2 Render progress: ${pct}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
    lastReportTime = Date.now();
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 2 Vector Supermarket Masterpiece rendered successfully: ${OUTPUT_FILE}`);
