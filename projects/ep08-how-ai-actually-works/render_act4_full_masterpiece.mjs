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
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP08-Act4-Reasoning-Detective-Masterpiece.mp4');

const TEMP_VOICE = '/tmp/ep08_act4_voice.wav';
const TEMP_SFX = '/tmp/ep08_act4_sfx.wav';
const TEMP_MIXED_AUDIO = '/tmp/ep08_act4_audio.wav';

// Math Helpers
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };

// -------------------------------------------------------------
// 1. GENERATE AUDIO TRACKS
// -------------------------------------------------------------
console.log('1. Compiling voice narration and Foley sound design for Act 4...');

const scriptLines = [
  { text: "For years, fast language models had a fatal flaw: they were too fast! Because they generate tokens instantly without pausing to think, they failed simple logic traps. Ask an older AI: how many r's are in strawberry? And it blurted: TWO! Because in internet text, berry has two r's, and it never spelled out the letters.", at: 0.2 },
  { text: "Enter Species Two: The Reasoning Models! Led by OpenAI's o1 and China's DeepSeek-R1. Instead of blurting out the first word, they take a deep breath. Behind the scenes, they generate thousands of hidden thinking tokens: an internal scratchpad where the AI talks to itself, breaks puzzles into steps, and checks its own work!", at: 20.5 },
  { text: "And here is the magic: self-correction! If a reasoning model makes a mistake, it does not crash. It literally reads its own thought, says: Wait, that is impossible, let me backtrack, and tries a different path! Rewarded purely on mathematical correctness, the AI taught itself how to think!", at: 40.5 }
];

const voiceBuffer = new Float32Array(Math.ceil(TOTAL_DUR * 48000));
for (let i = 0; i < scriptLines.length; i++) {
  const partFile = `/tmp/act4_part_${i}.wav`;
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
  let seed = 67214;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };

  function addSound(timeSec, durationSec, fn, gain = 0.3) {
    const startIdx = Math.round(timeSec * rate);
    const count = Math.min(n - startIdx, Math.round(durationSec * rate));
    for (let i = 0; i < count; i++) samples[startIdx + i] += fn(i / rate) * gain;
  }

  // Game show buzzer slam (t = 11.5s)
  addSound(11.5, 0.7, t => (Math.sin(2 * Math.PI * 140 * t) + noise() * 0.4) * Math.exp(-t * 4), 0.7);

  // Giant red X falling heavy thud (t = 12.2s)
  addSound(12.2, 0.45, t => (noise() * 0.7 + Math.sin(2 * Math.PI * 80 * t) * 0.6) * Math.exp(-t * 12), 0.75);

  // Detective entrance dramatic whoosh & scratchpad rustle (t = 21.0s)
  addSound(21.0, 0.8, t => Math.sin(2 * Math.PI * (200 + t * 400) * t) * Math.exp(-t * 3), 0.45);

  // Thinking tokens stream chirp / sc-fi ticker (t = 24.0s - 32.0s)
  addSound(24.0, 8.0, t => {
    const tick = ((t * 12) % 1 < 0.15) ? Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-((t * 12) % 1) * 25) : 0;
    return tick * 0.4;
  }, 0.35);

  // Detective checkmark success chime (t = 34.0s)
  addSound(34.0, 1.2, t => (Math.sin(2 * Math.PI * 783.99 * t) + Math.sin(2 * Math.PI * 1046.5 * t) * 0.8) * Math.exp(-t * 3.5), 0.55);

  // Blackboard chalk scribbles (t = 42.0s - 45.0s)
  addSound(42.0, 3.0, t => noise() * 0.25 * ((Math.sin(t * 30) > 0) ? 1 : 0), 0.35);

  // Blackboard eraser squeak (t = 47.0s - 49.0s)
  addSound(47.0, 2.0, t => (Math.sin(2 * Math.PI * (500 + Math.sin(t * 20) * 150) * t) + noise() * 0.3) * Math.exp(-((t * 2) % 1) * 3), 0.35);

  // Backtrack success golden star chime (t = 53.0s)
  addSound(53.0, 2.8, t => {
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
console.log('2. Starting frame rendering pipeline for Act 4 (Reasoning Models & Detective)...');

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

  if (t < 20.5) {
    // ---------------------------------------------------------
    // SCENE 1: THE STRAWBERRY GAME SHOW DISASTER
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#1E1B4B');
    bgGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 30px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("The Fatal Flaw of Fast LLMs: They Were TOO Fast!", 640, 50);

    // Game Show Podium on Right (Fast Chatbot)
    const botPodiumX = 850, botPodiumY = 460;
    ctx.fillStyle = '#312E81';
    ctx.fillRect(botPodiumX - 80, botPodiumY - 40, 160, 200);
    ctx.strokeStyle = '#6366F1';
    ctx.lineWidth = 3;
    ctx.strokeRect(botPodiumX - 80, botPodiumY - 40, 160, 200);

    // Big Red Buzzer on Podium
    const buzzerPressed = t >= 11.2;
    ctx.fillStyle = buzzerPressed ? '#991B1B' : '#EF4444';
    ctx.beginPath();
    ctx.ellipse(botPodiumX, botPodiumY - 42, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fast Chatbot Stickman behind podium
    const botArmY = buzzerPressed ? -55 : -90;
    drawFigure(ctx, {
      torso: 4,
      head: 8,
      facing: 'left',
      accessory: 'cap',
      targetArmL: [-40, botArmY], // Slamming buzzer
      targetArmR: [25, 20],
      eyes: buzzerPressed ? 'wide' : 'normal',
      brows: 'neutral',
      mouth: buzzerPressed ? 'o' : 'smile'
    }, { x: botPodiumX, y: botPodiumY - 30, r: 36, seed: Math.floor(t * 12) });

    // Host Podium on Left (Magi)
    const magiPodiumX = 350, magiPodiumY = 460;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(magiPodiumX - 80, magiPodiumY - 40, 160, 200);
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 3;
    ctx.strokeRect(magiPodiumX - 80, magiPodiumY - 40, 160, 200);

    // Game show question card in center
    ctx.save();
    ctx.translate(600, 170);
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(-220, -40, 440, 80, 14);
    ctx.fill();
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText('Host: "How many letter r\'s are in strawberry?"', 0, -8);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px NotoSans';
    ctx.fillText("Tokens generate instantly with zero reasoning pause", 0, 20);
    ctx.restore();

    // Magi holding mic
    drawFigure(ctx, {
      torso: -4,
      head: 6,
      facing: 'right',
      accessory: 'wizard-hat',
      accessories: ['mic'],
      targetArmR: [35, -70],
      targetArmL: [-20, 20],
      eyes: t >= 12.0 ? 'squint' : 'normal',
      brows: t >= 12.0 ? 'worried' : 'neutral',
      mouth: t >= 12.0 ? 'neutral' : 'smile'
    }, { x: magiPodiumX, y: magiPodiumY - 30, r: 38, seed: Math.floor(t * 12) });

    // Chatbot screams "TWO!" and giant red X slams down
    if (t >= 11.5) {
      // Speech Bubble: "TWO!"
      ctx.save();
      ctx.translate(botPodiumX - 90, botPodiumY - 140);
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.roundRect(-50, -25, 100, 50, 12);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px CaveatHand';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('"TWO!"', 0, 0);
      ctx.restore();

      // Giant Red X slams down on chatbot at t = 12.2s
      if (t >= 12.2) {
        const xDrop = clamp((t - 12.2) / 0.3);
        const xY = lerp(80, botPodiumY - 180, ease(xDrop));
        ctx.save();
        ctx.translate(botPodiumX, xY);
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(-50, -50); ctx.lineTo(50, 50);
        ctx.moveTo(50, -50); ctx.lineTo(-50, 50);
        ctx.stroke();
        ctx.restore();
      }
    }

  } else if (t < 40.5) {
    // ---------------------------------------------------------
    // SCENE 2: ENTER THE DETECTIVE (REASONING TOKENS & SCRATCHPAD)
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 30px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Enter Species Two: Reasoning Models (OpenAI o1 & DeepSeek-R1)", 640, 48);

    // Detective Stickman on the left
    const detX = 280, detY = 490;
    drawFigure(ctx, {
      torso: 4,
      head: 6,
      facing: 'right',
      accessory: 'deerstalker',
      accessories: ['trenchcoat', 'magnifier'],
      targetArmR: [65, -80], // Holding magnifying glass
      targetArmL: [-25, 10],
      eyes: 'normal',
      mouth: 'neutral'
    }, { x: detX, y: detY, r: 40, seed: Math.floor(t * 12) });

    // Large Glowing Translucent <think> Cloud expanding on the right
    const cloudX = 800, cloudY = 320;
    const cloudW = 600, cloudH = 340;

    ctx.save();
    ctx.translate(cloudX, cloudY);

    // Thought Cloud Border
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-cloudW / 2, -cloudH / 2, cloudW, cloudH, 24);
    ctx.fill();

    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#8B5CF6';
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Thought Cloud Header Pill
    ctx.fillStyle = '#6D28D9';
    ctx.beginPath();
    ctx.roundRect(-100, -cloudH / 2 - 18, 200, 36, 12);
    ctx.fill();
    ctx.strokeStyle = '#A78BFA';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px NotoSans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("<think> SCRATCHPAD", 0, -cloudH / 2);

    // Reasoning Stream breakdown
    const stepsText = [
      "Target: Count letter 'r' in 'strawberry'",
      "Step 1: Spell out letters sequentially:",
      "  s - t - r - a - w - b - e - r - r - y",
      "Step 2: Inspect index occurrences:",
      "  Index 3 = 'r'  [Found 1]",
      "  Index 8 = 'r'  [Found 2]",
      "  Index 9 = 'r'  [Found 3]",
      "Step 3: Verification: Total count = 3!"
    ];

    const linesVisible = Math.min(stepsText.length, Math.floor((t - 23.0) * 1.5));
    ctx.font = '15px NotoSans';
    ctx.textAlign = 'left';
    for (let l = 0; l < linesVisible; l++) {
      ctx.fillStyle = (l >= 4 && l <= 6) ? '#38BDF8' : (l === 7 ? '#34D399' : '#E2E8F0');
      ctx.fillText(stepsText[l], -cloudW / 2 + 35, -cloudH / 2 + 50 + l * 34);
    }

    ctx.restore();

    // Detective concludes: "There are three." (t > 33.5s)
    if (t > 33.5) {
      ctx.save();
      ctx.translate(detX + 80, detY - 140);
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.roundRect(-80, -25, 160, 50, 12);
      ctx.fill();
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px CaveatHand';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('"There are three."', 0, 0);
      ctx.restore();
    }

    // Bottom explanation
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 24px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Hidden thinking tokens allow the AI to talk to itself and verify theories!", 640, 580);

  } else {
    // ---------------------------------------------------------
    // SCENE 3: SELF-CORRECTION & BACKTRACKING (GRPO REWARD)
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#060A17');
    bgGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 30px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Self-Correction: When the Model Makes a Mistake, It Backtracks!", 640, 48);

    // Giant Classroom Blackboard
    const boardX = 640, boardY = 320;
    const boardW = 860, boardH = 340;

    ctx.save();
    ctx.translate(boardX, boardY);

    // Wooden Frame
    ctx.fillStyle = '#1E3A2F';
    ctx.beginPath();
    ctx.roundRect(-boardW / 2, -boardH / 2, boardW, boardH, 16);
    ctx.fill();

    ctx.strokeStyle = '#854D0E';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Blackboard Chalk Math
    ctx.font = 'bold 20px NotoSans';
    ctx.textAlign = 'left';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText("Problem: Find x and y such that x + y = 10 and x - y = 4", -boardW / 2 + 40, -boardH / 2 + 50);

    // Initial Attempt (Wrong Dead End)
    const erasing = t >= 47.0;
    if (!erasing) {
      ctx.fillStyle = '#F87171';
      ctx.fillText("Attempt 1: Let x = 10, y = 5", -boardW / 2 + 40, -boardH / 2 + 110);
      ctx.fillText("Check: 10 - 5 = 5  != 4  [CONTRADICTION! DEAD END!]", -boardW / 2 + 40, -boardH / 2 + 150);
    } else {
      // Chalk eraser wiping it away with dust
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(-boardW / 2 + 35, -boardH / 2 + 90, 500, 75);

      // Backtrack Correct Branch
      ctx.fillStyle = '#FBBF24';
      ctx.fillText("Wait, contradiction! Let me backtrack...", -boardW / 2 + 40, -boardH / 2 + 110);

      if (t >= 49.5) {
        ctx.fillStyle = '#34D399';
        ctx.fillText("Correct path: x = 7, y = 3", -boardW / 2 + 40, -boardH / 2 + 160);
        ctx.fillText("Check: 7 + 3 = 10  AND  7 - 3 = 4  [MATHEMATICALLY VERIFIED!]", -boardW / 2 + 40, -boardH / 2 + 200);
      }
    }

    ctx.restore();

    // Detective Stickman standing by the board holding eraser or chalk
    const magiX = 140, magiY = 490;
    drawFigure(ctx, {
      torso: -4,
      head: 6,
      facing: 'right',
      accessory: 'deerstalker',
      accessories: ['trenchcoat'],
      targetArmR: [65, -95], // Arm pointing at board
      targetArmL: [-25, 10],
      eyes: 'smile',
      mouth: 'smile'
    }, { x: magiX, y: magiY, r: 38, seed: Math.floor(t * 12) });

    // GRPO Golden Star Reward Badge
    if (t > 52.5) {
      ctx.save();
      ctx.translate(1120, 320);
      ctx.fillStyle = '#065F46';
      ctx.beginPath();
      ctx.roundRect(-80, -45, 160, 90, 14);
      ctx.fill();
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 20px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText("+100 REWARD", 0, -10);

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '12px NotoSans';
      ctx.fillText("GRPO / RL System", 0, 18);
      ctx.restore();
    }

    // Bottom Conclusion
    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 26px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("The model was rewarded purely for mathematical correctness, teaching itself how to reason!", 640, 610);
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
    if (displayCue.includes("fast language models had a fatal flaw")) {
      if (t < 7.0) displayCue = "For years, fast language models had a flaw: they were too fast!";
      else if (t < 13.0) displayCue = "How many r's in strawberry? Fast models blurted: TWO!";
      else displayCue = "In internet text, berry has two r's, so they never spelled it out.";
    } else if (displayCue.includes("Enter Species Two: The Reasoning Models")) {
      if (t < 27.0) displayCue = "Enter Species Two: Reasoning Models (OpenAI o1, DeepSeek-R1)!";
      else if (t < 34.0) displayCue = "They generate thousands of hidden thinking tokens!";
      else displayCue = "An internal scratchpad where the AI talks to itself and verifies.";
    } else if (displayCue.includes("here is the magic: self-correction")) {
      if (t < 46.5) displayCue = "And here is the magic: self-correction and backtracking!";
      else if (t < 53.0) displayCue = "If it makes a mistake, it backtracks and tries a new path.";
      else displayCue = "Rewarded on correctness, the AI taught itself how to think!";
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
    console.log(`Act 4 Render progress: ${pct}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
    lastReportTime = Date.now();
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 4 Reasoning Detective Masterpiece rendered successfully: ${OUTPUT_FILE}`);

