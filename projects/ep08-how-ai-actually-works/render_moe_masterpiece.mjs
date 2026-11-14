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
const TOTAL_DUR = 45.0;
const TOTAL_FRAMES = Math.ceil(FPS * TOTAL_DUR);

const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP08-MoE-Kitchen-Masterpiece.mp4');

const TEMP_VOICE = '/tmp/ep08_moe_voice.wav';
const TEMP_SFX = '/tmp/ep08_moe_sfx.wav';
const TEMP_MIXED_AUDIO = '/tmp/ep08_moe_audio.wav';

// Math Helpers
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };

// -------------------------------------------------------------
// 1. GENERATE AUDIO TRACKS
// -------------------------------------------------------------
console.log('1. Synthesizing voice narration and procedural Foley audio...');

const scriptLines = [
  { text: "As AI models grew to hundreds of billions of parameters, they hit a wall of physics. Running every single weight for every single word would require its own nuclear power plant!", at: 0.2 },
  { text: "So engineers turned to an architectural miracle: Mixture of Experts, or MoE. Imagine a five-star kitchen with sixty-four master chefs.", at: 10.2 },
  { text: "When an order comes in for calculus, you do not wake up the pastry chef, the sushi master, or the grill cook!", at: 19.0 },
  { text: "Instead, sixty-two chefs instantly go to sleep to save ninety-five percent of the power! Only the two calculus experts spring into action.", at: 26.0 },
  { text: "In DeepSeek-V3, out of six hundred seventy-one billion parameters, only thirty-seven billion activate per token. You get the mind of a giant, at a fraction of the electric bill!", at: 34.8 }
];

// Compile voice buffer
const voiceBuffer = new Float32Array(Math.ceil(TOTAL_DUR * 48000));
for (let i = 0; i < scriptLines.length; i++) {
  const partFile = `/tmp/ep08_moe_part_${i}.wav`;
  execSync(`say -v Samantha "${scriptLines[i].text}" -o "${partFile}" --data-format=LEI16@48000`);
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

// Synthesize procedural Foley SFX track
{
  const rate = 48000;
  const n = Math.ceil(TOTAL_DUR * rate);
  const samples = new Float32Array(n);
  let seed = 74619;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };

  function addSound(timeSec, durationSec, fn, gain = 0.3) {
    const startIdx = Math.round(timeSec * rate);
    const count = Math.min(n - startIdx, Math.round(durationSec * rate));
    for (let i = 0; i < count; i++) samples[startIdx + i] += fn(i / rate) * gain;
  }

  // Giant monster robot hum & steam hiss (0.0s - 10.0s)
  addSound(0.0, 9.5, t => (noise() * 0.25 + Math.sin(2 * Math.PI * 65 * t) * 0.35) * Math.min(1, t) * Math.min(1, 9.5 - t), 0.35);

  // Electrical overload buzz (t = 4.0s - 8.0s)
  addSound(4.0, 4.0, t => (noise() * 0.4 + Math.sin(2 * Math.PI * (120 + Math.sin(t * 30) * 40) * t) * 0.3) * Math.sin((t / 4.0) * Math.PI), 0.3);

  // Cash register cha-ching (t = 8.2s)
  addSound(8.2, 0.4, t => (Math.sin(2 * Math.PI * 1320 * t) + Math.sin(2 * Math.PI * 1760 * t) * 0.7) * Math.exp(-t * 9), 0.45);

  // Restaurant kitchen transition bell ding (t = 10.5s)
  addSound(10.5, 1.2, t => Math.sin(2 * Math.PI * 1046.5 * t) * Math.exp(-t * 3.5), 0.5);

  // Order ticket printer chatter (t = 19.2s - 21.0s)
  addSound(19.2, 1.8, t => {
    const click = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-((t * 20) % 1) * 15);
    return (noise() * 0.3 + click * 0.7);
  }, 0.35);

  // Cartoon slide whistle DOWN & heavy group THUD when 62 chefs collapse asleep (t = 26.2s - 27.5s)
  addSound(26.2, 0.7, t => Math.sin(2 * Math.PI * (900 - t * 800) * t) * (1 - t / 0.7), 0.4); // Whistle down
  addSound(26.9, 0.5, t => (noise() * 0.8 + Math.sin(2 * Math.PI * 85 * t) * 0.7) * Math.exp(-t * 12), 0.7); // Big group THUD!

  // Snoring loop (t = 27.5s - 34.0s)
  addSound(27.5, 6.5, t => {
    const snoreCycle = Math.sin(2 * Math.PI * 0.6 * t);
    return Math.max(0, snoreCycle) * (noise() * 0.15 + Math.sin(2 * Math.PI * 110 * t) * 0.2);
  }, 0.25);

  // Spring boing for the 2 calculus chefs leaping up (t = 28.5s)
  addSound(28.5, 0.4, t => Math.sin(2 * Math.PI * (350 + Math.sin(t * 60) * 150) * t) * Math.exp(-t * 7), 0.45);

  // Rapid spatula clanging / cooking sizzle (t = 29.5s - 34.0s)
  addSound(29.5, 4.5, t => {
    const clang = ((t * 8) % 1 < 0.15) ? Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-((t * 8) % 1) * 30) : 0;
    return noise() * 0.2 + clang * 0.6;
  }, 0.3);

  // DeepSeek-V3 671B matrix reveal chime (t = 35.0s)
  addSound(35.0, 1.5, t => (Math.sin(2 * Math.PI * 523.25 * t) + Math.sin(2 * Math.PI * 783.99 * t)) * Math.exp(-t * 2.5), 0.5);

  // Cloche lift ding & celebration fanfare (t = 41.0s)
  addSound(41.0, 0.3, t => Math.sin(2 * Math.PI * 1320 * t) * Math.exp(-t * 8), 0.55);
  addSound(41.2, 3.2, t => {
    const env = Math.exp(-t * 1.8);
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

// Mix audio tracks with ffmpeg
execSync(`ffmpeg -v error -y -i "${TEMP_VOICE}" -i "${TEMP_SFX}" -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.85[s];[v][s]amix=inputs=2:duration=longest" -ar 48000 "${TEMP_MIXED_AUDIO}"`);
console.log('✓ Audio tracks compiled.');

// -------------------------------------------------------------
// 2. VIDEO RENDERING WITH FFMPEG PIPE
// -------------------------------------------------------------
console.log('2. Starting frame rendering pipeline for Act 5 (MoE Kitchen)...');

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

  if (t < 10.2) {
    // ---------------------------------------------------------
    // SCENE 1: THE TRILLION-PARAMETER POWER-HUNGRY MONSTER
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#1E1B18');
    bgGrad.addColorStop(1, '#0C0A09');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 3 Nuclear Cooling Towers in background
    const towers = [180, 420, 1080];
    towers.forEach((twX, twi) => {
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.moveTo(twX - 70, 480);
      ctx.quadraticCurveTo(twX - 40, 320, twX - 55, 200);
      ctx.lineTo(twX + 55, 200);
      ctx.quadraticCurveTo(twX + 40, 320, twX + 70, 480);
      ctx.closePath();
      ctx.fill();

      // Billowing steam clouds from cooling tower tops
      ctx.fillStyle = 'rgba(214, 211, 209, 0.25)';
      for (let st = 0; st < 4; st++) {
        const steamY = 200 - ((t * 40 + st * 45) % 160);
        const steamR = 25 + ((t * 20 + st * 25) % 40);
        const steamDrift = Math.sin(t + st + twi) * 20;
        ctx.beginPath();
        ctx.arc(twX + steamDrift, steamY, steamR, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Dark industrial factory floor
    ctx.fillStyle = '#1C1917';
    ctx.fillRect(0, 480, WIDTH, 240);
    ctx.strokeStyle = '#44403C';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 480); ctx.lineTo(WIDTH, 480); ctx.stroke();

    // Giant 1,000-Ton Steel Robot Brain Monster
    const botX = 720, botY = 320 + Math.sin(t * 3) * 6; // Heavy breathing heave
    ctx.save();
    ctx.translate(botX, botY);

    // Brain lobes (Steel plates with rivets)
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;

    // Left hemisphere
    ctx.beginPath();
    ctx.arc(-80, -30, 110, Math.PI * 0.5, Math.PI * 1.5);
    ctx.quadraticCurveTo(0, -180, 0, 70);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Right hemisphere
    ctx.beginPath();
    ctx.arc(80, -30, 110, Math.PI * 1.5, Math.PI * 0.5);
    ctx.quadraticCurveTo(0, -180, 0, 70);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Steel plate seams and rivets
    ctx.fillStyle = '#CBD5E1';
    for (let r = -5; r <= 5; r++) {
      ctx.beginPath(); ctx.arc(r * 22, -110 + Math.abs(r) * 15, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 22, -10 + Math.abs(r) * 10, 3.5, 0, Math.PI * 2); ctx.fill();
    }

    // Glowing Overheated Vacuum Tubes & Red Exhaust Pipes
    const heatGlow = Math.abs(Math.sin(t * 8));
    ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + heatGlow * 0.5})`;
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 25;
    ctx.fillRect(-60, -90, 40, 50);
    ctx.fillRect(20, -90, 40, 50);
    ctx.shadowBlur = 0;

    // Glowing exhausted red robot eyes
    ctx.fillStyle = '#EF4444';
    ctx.beginPath(); ctx.ellipse(-50, 10, 22, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(50, 10, 22, 14, 0, 0, Math.PI * 2); ctx.fill();

    // Black smoke puffs from exhaust pipes
    for (let sm = 0; sm < 3; sm++) {
      const smokeY = -150 - ((t * 60 + sm * 40) % 120);
      ctx.fillStyle = 'rgba(68, 64, 60, 0.45)';
      ctx.beginPath(); ctx.arc(-50 + Math.sin(t * 2 + sm) * 15, smokeY, 20 + sm * 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(50 - Math.sin(t * 2 + sm) * 15, smokeY, 20 + sm * 8, 0, Math.PI * 2); ctx.fill();
    }

    // Machine oil sweat drops splashing down
    const sweatY = ((t * 140) % 180) - 20;
    ctx.fillStyle = '#0284C7';
    ctx.beginPath(); ctx.ellipse(-20, sweatY, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(35, sweatY + 30, 6, 10, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    // Giant High-Voltage Power Cables plugged into the monster
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(180, 480);
    ctx.bezierCurveTo(340, 540, 540, 440, botX - 80, botY + 40);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(420, 480);
    ctx.bezierCurveTo(520, 550, 620, 450, botX + 80, botY + 40);
    ctx.stroke();

    // Crackling Electric Lightning Arcs on cables
    if (Math.sin(t * 18) > 0.4) {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(botX - 80, botY + 40);
      ctx.lineTo(botX - 110, botY + 15);
      ctx.lineTo(botX - 70, botY - 10);
      ctx.stroke();
    }

    // Overload Power Gauge on the left
    const gaugeX = 140, gaugeY = 320;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath(); ctx.arc(gaugeX, gaugeY, 65, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Red zone arc
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, 55, -Math.PI * 0.8, Math.PI * 0.2);
    ctx.stroke();

    // Gauge needle vibrating wildly in red zone
    const needleAngle = 0.05 + Math.sin(t * 35) * 0.15;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gaugeX, gaugeY);
    ctx.lineTo(gaugeX + Math.cos(needleAngle) * 50, gaugeY + Math.sin(needleAngle) * 50);
    ctx.stroke();

    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 16px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText("500 MEGAWATTS!", gaugeX, gaugeY + 95);

    // Magi standing in foreground holding an electric bill with jaw dropped
    drawFigure(ctx, {
      torso: -8,
      head: 12,
      facing: 'right',
      accessory: 'wizard-hat',
      targetArmR: [60, -50], // Holding high electric bill
      targetArmL: [-20, 20],
      eyes: 'wide',
      brows: 'up',
      mouth: 'o'
    }, { x: 280, y: 520, r: 38, seed: Math.floor(t * 12) });

    // Electric Bill graphic held in right hand
    ctx.save();
    ctx.translate(340, 460);
    ctx.rotate(0.15);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-25, -40, 50, 70);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(-25, -40, 50, 70);

    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 13px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText("ELECTRIC", 0, -20);
    ctx.fillText("BILL", 0, -6);
    ctx.fillText("$$$ MILLIONS", 0, 16);
    ctx.restore();

  } else if (t < 19.0) {
    // ---------------------------------------------------------
    // SCENE 2: THE 64-CHEF 5-STAR RESTAURANT KITCHEN
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#FFFBEB');
    bgGrad.addColorStop(1, '#FEF3C7');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Warm Restaurant Kitchen Background
    // Subway tiles pattern on wall
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 1;
    for (let y = 0; y < 420; y += 30) {
      const shift = ((y / 30) % 2) * 30;
      for (let x = 0; x < WIDTH; x += 60) {
        ctx.strokeRect(x + shift, y, 60, 30);
      }
    }

    // Hanging copper kitchen pans and pots
    for (let p = 0; p < 8; p++) {
      const px = 180 + p * 125;
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, 50); ctx.stroke();
      ctx.fillStyle = '#B45309';
      ctx.beginPath(); ctx.ellipse(px, 65, 22, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Stainless Steel Kitchen Prep Counter
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(0, 420, WIDTH, 300);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 420); ctx.lineTo(WIDTH, 420); ctx.stroke();

    // Checkered Kitchen Floor at bottom
    for (let fx = 0; fx < WIDTH; fx += 50) {
      for (let fy = 480; fy < HEIGHT; fy += 50) {
        if (((fx / 50) + (fy / 50)) % 2 === 0) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(fx, fy, 50, 50);
        } else {
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(fx, fy, 50, 50);
        }
      }
    }

    // Array of 6 Master Chefs working side by side (representing the 64-Chef Kitchen)
    const chefs = [
      { name: "Pastry", acc: ['chef-hat', 'spatula'], x: 180, tool: 'Croissant' },
      { name: "Sushi", acc: ['chef-hat'], x: 330, tool: 'Sushi Knife' },
      { name: "Python", acc: ['chef-hat'], x: 480, tool: 'Code { }' },
      { name: "French", acc: ['chef-hat'], x: 630, tool: 'Sauce Pan' },
      { name: "Calculus A", acc: ['chef-hat', 'glasses', 'spatula'], x: 780, tool: 'Integral ∫' },
      { name: "Calculus B", acc: ['chef-hat', 'glasses', 'spatula'], x: 930, tool: 'Matrix [M]' }
    ];

    chefs.forEach((ch, idx) => {
      const cookBounce = Math.sin(t * 6 + idx) * 5;
      drawFigure(ctx, {
        torso: 0,
        head: cookBounce > 0 ? 4 : -4,
        facing: 'front',
        accessory: 'chef-hat',
        accessories: ch.acc,
        eyes: 'normal',
        mouth: 'smile'
      }, { x: ch.x, y: 440 + cookBounce, r: 32, seed: Math.floor(t * 12) + idx });

      // Chef Name Tag (above the chef hat)
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 15px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText(ch.name, ch.x, 260);

      // Tool / Specialty badge above chef hat
      ctx.fillStyle = '#D97706';
      ctx.font = '13px NotoSans';
      ctx.fillText(ch.tool, ch.x, 240);
    });

    // Magi as Head Maitre D' standing on the far right at the order window
    drawFigure(ctx, {
      torso: -4,
      head: 6,
      facing: 'left',
      accessory: 'wizard-hat',
      accessories: ['apron'],
      targetArmL: [-40, -50], // Holding order bell
      targetArmR: [20, 20],
      eyes: 'smile',
      mouth: 'smile'
    }, { x: 1140, y: 440, r: 36, seed: Math.floor(t * 12) });

    // 5-Star Kitchen Banner
    ctx.fillStyle = '#78350F';
    ctx.font = 'bold 28px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("The 64-Chef MoE Kitchen: 64 Specialized Neural Experts", 640, 45);

  } else if (t < 26.0) {
    // ---------------------------------------------------------
    // SCENE 3: THE CALCULUS ORDER ARRIVES & ROUTING WINDOW
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#1E293B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Glowing Kitchen Pass Window
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(100, 100, 1080, 500);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(100, 100, 1080, 500);

    // Order Ticket sliding down from the printer
    const ticketDrop = clamp((t - 19.2) / 1.5);
    const ticketY = lerp(40, 220, ease(ticketDrop));

    ctx.save();
    ctx.translate(640, ticketY);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(-200, -70, 400, 140);
    ctx.strokeStyle = '#CA8A04';
    ctx.lineWidth = 3;
    ctx.strokeRect(-200, -70, 400, 140);

    // Ticket text
    ctx.fillStyle = '#854D0E';
    ctx.font = 'bold 18px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText("★ INCOMING ORDER #404 ★", 0, -40);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 32px CaveatHand';
    ctx.fillText('Order: "Solve the Calculus Integral: ∫ x · e^x dx"', 0, 5);

    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 16px NotoSans';
    ctx.fillText("ROUTER TASK: ACTIVATE TOP-2 EXPERTS ONLY", 0, 45);
    ctx.restore();

    // Sushi Chef and Pastry Chef on the left looking puzzled with question marks
    drawFigure(ctx, {
      torso: -4,
      head: -8,
      facing: 'right',
      accessory: 'chef-hat',
      targetArmR: [30, -30],
      eyes: 'normal',
      mouth: 'o'
    }, { x: 260, y: 480, r: 35, seed: Math.floor(t * 12) });

    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 42px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("???", 260, 360);
    ctx.font = 'bold 18px NotoSans';
    ctx.fillText("Pastry Chef: I bake cakes, not math!", 260, 400);

    // Magi reading ticket with megaphone or pointer
    drawFigure(ctx, {
      torso: 6,
      head: 8,
      facing: 'left',
      accessory: 'wizard-hat',
      targetArmL: [-60, -60],
      eyes: 'wide',
      mouth: 'smile'
    }, { x: 1020, y: 480, r: 38, seed: Math.floor(t * 12) });

  } else if (t < 34.8) {
    // ---------------------------------------------------------
    // SCENE 4: 62 CHEFS FALL ASLEEP! 2 CALCULUS EXPERTS COOK!
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#020617');
    bgGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Stainless Steel Counter
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 420, WIDTH, 300);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 420, WIDTH, 300);

    // Energy Savings Gauge at top center
    const energyStart = 26.5;
    const energyDrop = clamp((t - energyStart) / 1.5);
    const powerPct = lerp(100, 3.125, ease(energyDrop));

    ctx.save();
    ctx.translate(640, 70);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-240, -30, 480, 60);
    ctx.strokeStyle = powerPct < 10 ? '#10B981' : '#EF4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(-240, -30, 480, 60);

    ctx.fillStyle = powerPct < 10 ? '#34D399' : '#F87171';
    ctx.font = 'bold 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`POWER CONSUMPTION: ${powerPct.toFixed(1)}% (95% SAVED!)`, 0, 0);
    ctx.restore();

    // 4 Sleeping Chefs collapsed face down on the counter (left side)
    const sleepChefsX = [140, 260, 380, 500];
    sleepChefsX.forEach((sx, si) => {
      // Body collapsed horizontally across table
      ctx.save();
      ctx.translate(sx, 440);

      // Torso face down
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-25, 0); ctx.lineTo(25, 0); ctx.stroke();

      // Head down with chef hat tilted
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(35, 5, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Chef hat fallen over
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(38, -15, 30, 20);

      // Limbs ragdoll
      ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-45, 25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(35, 25); ctx.stroke();

      // Floating Zzz bubbles
      const zAge = (t * 2 + si) % 3;
      const zX = 45 + zAge * 10;
      const zY = -10 - zAge * 22;
      ctx.fillStyle = '#38BDF8';
      ctx.font = `${Math.round(14 + zAge * 6)}px CaveatHand`;
      ctx.fillText("Zzz...", zX, zY);
      ctx.restore();
    });

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 20px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("62 Chefs Asleep (Weights Powered Down)", 320, 370);

    // The 2 Active Calculus Chefs (right side) Spring Up and Juggle Equations!
    const calcA_X = 820, calcB_X = 1040;
    const calcSpring = spring(t - 27.5, 0.7, 12);
    const calcY = lerp(460, 410, calcSpring);

    // Juggling Spatula targets with 2-Bone IK
    const jugArmAY = -130 + Math.sin(t * 12) * 25;
    const jugArmBY = -130 + Math.cos(t * 12) * 25;

    // Chef A
    drawFigure(ctx, {
      torso: 4,
      head: -6,
      facing: 'right',
      accessory: 'chef-hat',
      accessories: ['glasses', 'spatula'],
      targetArmR: [50, jugArmAY],
      targetArmL: [-40, -110],
      eyes: 'smile',
      mouth: 'smile'
    }, { x: calcA_X, y: calcY, r: 35, seed: Math.floor(t * 12) });

    // Chef B
    drawFigure(ctx, {
      torso: -4,
      head: 6,
      facing: 'left',
      accessory: 'chef-hat',
      accessories: ['glasses', 'spatula'],
      targetArmL: [-50, jugArmBY],
      targetArmR: [40, -110],
      eyes: 'smile',
      mouth: 'smile'
    }, { x: calcB_X, y: calcY, r: 35, seed: Math.floor(t * 12) });

    // Juggling Glowing Math Dough in the air between them
    const doughX = 930 + Math.sin(t * 8) * 60;
    const doughY = 220 + Math.abs(Math.sin(t * 8)) * -60;

    ctx.save();
    ctx.translate(doughX, doughY);
    ctx.fillStyle = '#34D399';
    ctx.shadowColor = '#34D399';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.roundRect(-75, -25, 150, 50, 16);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#064E3B';
    ctx.font = 'bold 20px NotoSans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Integral: u·v - Integral(v du)", 0, 0);
    ctx.restore();

    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 20px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Active Top-2 Experts Computing in Parallel!", 930, 360);

  } else {
    // ---------------------------------------------------------
    // SCENE 5: DEEPSEEK-V3 EFFICIENCY BENCHMARK & SILVER CLOCHE FEAST
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // DeepSeek-V3 MoE Architecture Constellation on the Left
    const centerX = 380, centerY = 280, circleR = 170;
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 24px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("DeepSeek-V3: 671B Total Parameters", centerX, 60);

    // 64 Expert Nodes arranged in a circle
    for (let e = 0; e < 64; e++) {
      const angle = (e / 64) * Math.PI * 2;
      const ex = centerX + Math.cos(angle) * circleR;
      const ey = centerY + Math.sin(angle) * circleR;

      const isActive = (e === 12 || e === 13); // Top-2 active experts

      if (isActive) {
        // Glowing Green Active Nodes
        ctx.fillStyle = '#10B981';
        ctx.shadowColor = '#34D399';
        ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(ex, ey, 9, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Active router connection line to center
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(ex, ey); ctx.stroke();
      } else {
        // Dim inactive nodes (sleeping)
        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Router Hub at center
    ctx.fillStyle = '#0284C7';
    ctx.beginPath(); ctx.arc(centerX, centerY, 28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 12px NotoSans';
    ctx.fillText("ROUTER", centerX, centerY + 4);

    // Statistics Box under constellation
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 20px NotoSans';
    ctx.fillText("37 Billion Active (Only 5.5% Power Used!)", centerX, centerY + circleR + 40);

    // Silver Cloche Serving Platter on the Right
    const clocheX = 940, clocheY = 360;
    const clocheOpenT = clamp((t - 39.5) / 1.2);
    const lidLiftY = lerp(0, -110, ease(clocheOpenT));

    // Platter base
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.ellipse(clocheX, clocheY + 30, 160, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 3;
    ctx.stroke();

    // The Finished Mathematical Dish inside!
    ctx.save();
    ctx.translate(clocheX, clocheY + 10);
    ctx.fillStyle = '#FEF08A';
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.roundRect(-120, -30, 240, 60, 16);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#854D0E';
    ctx.font = 'bold 28px CaveatHand';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("(x - 1)e^x + C", 0, 0);
    ctx.restore();

    // Domed Silver Cloche Lid lifting up
    ctx.save();
    ctx.translate(clocheX, clocheY + lidLiftY);
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(0, 0, 130, Math.PI, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Lid knob
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath(); ctx.arc(0, -135, 16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Magi lifting the Cloche Lid proudly
    drawFigure(ctx, {
      torso: -5,
      head: 8,
      facing: 'left',
      accessory: 'wizard-hat',
      targetArmL: [-70, -140], // Arm raised holding lid knob
      targetArmR: [30, 20],
      eyes: 'wink',
      mouth: 'smile'
    }, { x: 1150, y: 440, r: 38, seed: Math.floor(t * 12) });

    // 5-Star Rating Banner
    if (t > 40.5) {
      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 30px CaveatHand';
      ctx.textAlign = 'center';
      ctx.fillText("5-Star Efficiency: Mind of a Giant at 1/18th the Electric Bill!", 640, 610);
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
    if (displayCue.includes("hundreds of billions of parameters")) {
      displayCue = t < 5.0 ? "AI models hit a wall of physics..." : "Running 600B weights needs its own nuclear power plant!";
    } else if (displayCue.includes("Mixture of Experts, or MoE")) {
      displayCue = t < 14.5 ? "Engineers turned to Mixture-of-Experts (MoE)." : "Imagine a five-star kitchen with 64 master chefs!";
    } else if (displayCue.includes("order comes in for calculus")) {
      displayCue = "When an order comes in for calculus, you don't wake the sushi chef!";
    } else if (displayCue.includes("sixty-two chefs instantly go to sleep")) {
      displayCue = t < 30.5 ? "62 chefs instantly sleep to save 95% power!" : "Only the two calculus experts spring into action!";
    } else if (displayCue.includes("DeepSeek-V3")) {
      displayCue = t < 39.5 ? "In DeepSeek-V3, only 37B out of 671B weights activate per token." : "You get the mind of a giant, at a fraction of the electric bill!";
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
    console.log(`MoE Render progress: ${pct}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
    lastReportTime = Date.now();
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 5 MoE Masterpiece rendered successfully: ${OUTPUT_FILE}`);
