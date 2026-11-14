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
const TOTAL_DUR = 58.0;
const TOTAL_FRAMES = Math.ceil(FPS * TOTAL_DUR);

const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const OUTPUT_FILE = path.join(EXPORTS_DIR, 'EP08-Act6-Autonomous-Horizon-Masterpiece.mp4');

const TEMP_VOICE = '/tmp/ep08_act6_voice.wav';
const TEMP_SFX = '/tmp/ep08_act6_sfx.wav';
const TEMP_MIXED_AUDIO = '/tmp/ep08_act6_audio.wav';

// Math Helpers
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };

// -------------------------------------------------------------
// 1. COMPILE AUDIO & FOLEY SOUND DESIGN
// -------------------------------------------------------------
console.log('1. Compiling voice narration and procedural Foley sound design for Act 6...');

const scriptLines = [
  { text: "And that brings us to the fourth and final species: Autonomous Agents! Up until now, AI was just a brain in a jar. You asked a question, and it gave you text.", at: 0.2 },
  { text: "But what happens when you give that brain eyes to look at your computer screen, and robotic hands to type commands and click a mouse? The AI does not just suggest code; it opens the editor, runs the compiler, reads the bug report, and fixes the issue on its own!", at: 10.5 },
  { text: "This is powered by the four-step loop: Observe the environment. Reason with thinking tokens. Take an action in the real world. And verify the outcome! It transforms AI from a passive chatbot into an active partner.", at: 25.8 },
  { text: "Seventy-six years ago, Alan Turing asked if a machine could think. Today, we know the secret: we melted beach sand, etched billions of microscopic switches, and taught electricity how to pay attention! AI is not magic. It is humanity greatest mirror. And the journey has only just begun!", at: 39.0 }
];

const voiceBuffer = new Float32Array(Math.ceil(TOTAL_DUR * 48000));
for (let i = 0; i < scriptLines.length; i++) {
  const partFile = `/tmp/act6_part_${i}.wav`;
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

// Synthesize procedural Foley SFX track
{
  const rate = 48000;
  const n = Math.ceil(TOTAL_DUR * rate);
  const samples = new Float32Array(n);
  let seed = 89312;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 2 - 1; };

  function addSound(timeSec, durationSec, fn, gain = 0.3) {
    const startIdx = Math.round(timeSec * rate);
    const count = Math.min(n - startIdx, Math.round(durationSec * rate));
    for (let i = 0; i < count; i++) samples[startIdx + i] += fn(i / rate) * gain;
  }

  // Water bubble in jar (t = 2.0s, 4.5s, 7.0s)
  [2.0, 4.5, 7.0].forEach(st => {
    addSound(st, 0.4, t => Math.sin(2 * Math.PI * (400 + Math.sin(t * 40) * 120) * t) * Math.exp(-t * 9), 0.35);
  });

  // Mechanical tool equip snap (t = 11.2s, 13.0s)
  addSound(11.2, 0.3, t => Math.sin(2 * Math.PI * 950 * t) * Math.exp(-t * 18), 0.5); // Goggles snap
  addSound(13.0, 0.35, t => (noise() * 0.5 + Math.sin(2 * Math.PI * 650 * t)) * Math.exp(-t * 15), 0.5); // Robotic hand attach

  // Rapid mechanical keyboard typing clatter (t = 15.0s - 24.0s)
  addSound(15.0, 9.0, t => {
    const key = ((t * 14) % 1 < 0.15) ? (noise() * 0.7 + Math.sin(2 * Math.PI * 1800 * t) * 0.3) * Math.exp(-((t * 14) % 1) * 35) : 0;
    return key;
  }, 0.35);

  // Success compiler ping (t = 23.5s)
  addSound(23.5, 1.0, t => (Math.sin(2 * Math.PI * 880 * t) + Math.sin(2 * Math.PI * 1320 * t) * 0.7) * Math.exp(-t * 4), 0.5);

  // Cycle loop whoosh & electrical hum (t = 26.0s - 38.0s)
  addSound(26.0, 12.0, t => {
    const cycleFreq = 180 + Math.sin(t * 3) * 60;
    return Math.sin(2 * Math.PI * cycleFreq * t) * 0.2 + noise() * 0.05;
  }, 0.25);

  // Sand lightning strike explosion (t = 44.5s)
  addSound(44.5, 1.8, t => (noise() * 0.8 + Math.sin(2 * Math.PI * 75 * t) * 0.8) * Math.exp(-t * 3.5), 0.85);

  // Galaxy celestial chime & sparkling cosmos (t = 45.0s - 56.0s)
  addSound(45.0, 11.0, t => {
    const chord = (
      Math.sin(2 * Math.PI * 523.25 * t) * 0.25 +
      Math.sin(2 * Math.PI * 659.25 * t) * 0.22 +
      Math.sin(2 * Math.PI * 783.99 * t) * 0.2 +
      Math.sin(2 * Math.PI * 1046.50 * t) * 0.18 +
      Math.sin(2 * Math.PI * 1318.51 * t) * 0.15
    );
    return chord * Math.min(1, t) * Math.min(1, 11 - t);
  }, 0.6);

  // Final wand sparkle (t = 54.5s)
  addSound(54.5, 2.0, t => Math.sin(2 * Math.PI * (1200 + Math.sin(t * 30) * 400) * t) * Math.exp(-t * 2), 0.4);

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
console.log('2. Starting frame rendering pipeline for Act 6 (Autonomous Horizon & Finale)...');

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

  if (t < 10.5) {
    // ---------------------------------------------------------
    // SCENE 1: THE BRAIN IN A JAR (PASSIVE AI)
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title Banner
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 30px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Before: AI Was Just a Passive 'Brain in a Jar'", 640, 50);

    // Laboratory Table
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(200, 440, 880, 280);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(200, 440, 880, 280);

    // Glass Jar with Cyan Glowing Liquid
    const jarX = 640, jarY = 320;
    ctx.fillStyle = 'rgba(14, 165, 233, 0.18)';
    ctx.beginPath();
    ctx.roundRect(jarX - 100, jarY - 140, 200, 240, 30);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Jar metal lid
    ctx.fillStyle = '#64748B';
    ctx.fillRect(jarX - 110, jarY - 155, 220, 22);

    // Liquid bubbles floating up
    for (let b = 0; b < 6; b++) {
      const bubbleY = jarY + 80 - ((t * 40 + b * 45) % 200);
      const bubbleX = jarX - 60 + ((b * 47) % 120);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.beginPath(); ctx.arc(bubbleX, bubbleY, 5 + (b % 3) * 2, 0, Math.PI * 2); ctx.fill();
    }

    // Bored Brain Stickman floating inside Jar
    const brainFloat = Math.sin(t * 3) * 8;
    drawFigure(ctx, {
      torso: 0,
      head: 0,
      facing: 'front',
      eyes: 'closed',
      mouth: 'neutral'
    }, { x: jarX, y: jarY + 40 + brainFloat, r: 30, seed: Math.floor(t * 12) });

    // Dialogue: You asked text, it gave text
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 20px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText('User: "What is Python?"  -->  AI: "Python is a language."', 640, 475);
    ctx.fillText('Zero ability to act, run code, or touch the real world.', 640, 505);

    // Magi standing on left looking at jar with crossed arms
    drawFigure(ctx, {
      torso: 4,
      head: 6,
      facing: 'right',
      accessory: 'wizard-hat',
      targetArmL: [-20, 20],
      targetArmR: [20, 20],
      eyes: 'normal',
      brows: 'neutral',
      mouth: 'neutral'
    }, { x: 300, y: 500, r: 38, seed: Math.floor(t * 12) });

  } else if (t < 25.8) {
    // ---------------------------------------------------------
    // SCENE 2: GIVING THE BRAIN HANDS & EYES (AUTONOMOUS AGENTS)
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#060A17');
    bgGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 30px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Autonomous Agents: Giving the Brain Eyes, Hands, and Tools!", 640, 48);

    // Modern Computer Desk with Monitor and Laptop
    const deskX = 800, deskY = 460;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(deskX - 220, deskY, 440, 260);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(deskX - 220, deskY, 440, 260);

    // Large Glowing Monitor on desk (to the right of agent)
    const screenX = deskX + 80, screenY = deskY - 140;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(screenX - 120, screenY - 90, 240, 180);
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 3;
    ctx.strokeRect(screenX - 120, screenY - 90, 240, 180);

    // IDE Code lines typing rapidly
    const codeLines = [
      "1: import agent_core",
      "2: screen = vision.capture()",
      "3: if bug_detected:",
      "4:   editor.replace_fix()",
      "5:   compiler.run_tests()",
      "6: Status: [ALL TESTS PASSED!]"
    ];

    const linesVisible = Math.min(codeLines.length, Math.floor((t - 15.0) * 1.5));
    ctx.font = '12px NotoSans';
    ctx.textAlign = 'left';
    for (let l = 0; l < linesVisible; l++) {
      ctx.fillStyle = l === 5 ? '#34D399' : (l === 3 ? '#FBBF24' : '#94A3B8');
      ctx.fillText(codeLines[l], screenX - 110, screenY - 60 + l * 24);
    }

    // Active Agent Stickman sitting at desk wearing Camera Goggles and Robotic Hands!
    const typingArmL = [-30, -75 + Math.sin(t * 22) * 8];
    const typingArmR = [30, -75 + Math.cos(t * 22) * 8];

    drawFigure(ctx, {
      torso: -5,
      head: 8,
      facing: 'right',
      accessory: 'goggles',
      targetArmL: typingArmL,
      targetArmR: typingArmR,
      eyes: 'normal',
      mouth: 'smile'
    }, { x: deskX - 130, y: deskY + 10, r: 36, seed: Math.floor(t * 12) });

    // Laptop on desk right in front of agent
    ctx.fillStyle = '#334155';
    ctx.fillRect(deskX - 160, deskY - 20, 60, 20);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(deskX - 155, deskY - 50, 50, 32);

    // Vision Ray from Goggles to Screen
    ctx.save();
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(deskX - 100, deskY - 90);
    ctx.lineTo(screenX - 120, screenY - 20);
    ctx.stroke();
    ctx.restore();

    // Magi standing on left pointing with pride
    drawFigure(ctx, {
      torso: 6,
      head: -4,
      facing: 'right',
      accessory: 'wizard-hat',
      targetArmR: [65, -90], // Pointing right at the autonomous agent
      targetArmL: [-25, 10],
      eyes: 'smile',
      mouth: 'smile'
    }, { x: 260, y: 500, r: 38, seed: Math.floor(t * 12) });

    // Callout Box: Anthropic Claude Computer Use & Coding Agents
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 22px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("Claude Computer Use & Coding Agents:", 260, 200);
    ctx.fillStyle = '#38BDF8';
    ctx.font = '16px NotoSans';
    ctx.fillText("Reads screen, uses mouse & keyboard, fixes bugs autonomously!", 260, 235);

  } else if (t < 39.0) {
    // ---------------------------------------------------------
    // SCENE 3: THE 4-STEP THOUGHT-TO-ACTION CYCLE (OBSERVE -> REASON -> ACT -> VERIFY)
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#030712');
    bgGrad.addColorStop(1, '#0B0F19');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Title
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 30px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("The 4-Step Thought-to-Action Autonomous Loop", 640, 50);

    // Circular Racetrack Loop shifted to center-right
    const loopX = 750, loopY = 320, loopR = 190;
    ctx.save();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(loopX, loopY, loopR, 0, Math.PI * 2);
    ctx.stroke();

    // Glowing Pulse of Electricity Traveling around the loop
    const pulseAngle = (t * 2.2) % (Math.PI * 2);

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 14;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(loopX, loopY, loopR, pulseAngle - 0.5, pulseAngle);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 4 Nodes around the loop
    const nodes = [
      { name: "1. OBSERVE", desc: "Vision & Screen Scan", color: '#0284C7', angle: -Math.PI / 2 },
      { name: "2. REASON", desc: "Thinking Tokens", color: '#7C3AED', angle: 0 },
      { name: "3. ACT", desc: "Tool & Mouse Click", color: '#059669', angle: Math.PI / 2 },
      { name: "4. VERIFY", desc: "Check Test Outcome", color: '#D97706', angle: Math.PI }
    ];

    nodes.forEach((nd) => {
      const nx = loopX + Math.cos(nd.angle) * loopR;
      const ny = loopY + Math.sin(nd.angle) * loopR;

      ctx.save();
      ctx.translate(nx, ny);

      // Node box
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(-80, -32, 160, 64, 14);
      ctx.fill();

      ctx.strokeStyle = nd.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText(nd.name, 0, -6);

      ctx.fillStyle = nd.color;
      ctx.font = '12px NotoSans';
      ctx.fillText(nd.desc, 0, 16);
      ctx.restore();
    });

    // Magi standing on left stage gesturing at the loop
    const magiX = 260, magiY = 490;
    drawFigure(ctx, {
      torso: 6,
      head: -4,
      facing: 'right',
      accessory: 'wizard-hat',
      targetArmR: [65, -95], // Arm pointing right at the loop
      targetArmL: [-25, 10],
      eyes: 'smile',
      mouth: 'smile'
    }, { x: magiX, y: magiY, r: 40, seed: Math.floor(t * 12) });

    // Electric energy beam from wand to loop
    ctx.save();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(magiX + 65, magiY - 95);
    ctx.lineTo(loopX - loopR, loopY);
    ctx.stroke();
    ctx.restore();

    // Bottom description
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 24px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText("From passive chatbots into active scientific and engineering partners!", 640, 590);

  } else {
    // ---------------------------------------------------------
    // SCENE 4: GRAND FINALE: THE MIRACLE OF THINKING ROCKS
    // ---------------------------------------------------------
    bgGrad.addColorStop(0, '#020308');
    bgGrad.addColorStop(1, '#090D1C');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Deep Space Starfield
    ctx.fillStyle = '#FFFFFF';
    for (let s = 0; s < 70; s++) {
      const sx = (s * 43) % WIDTH;
      const sy = (s * 31) % HEIGHT;
      const twinkle = Math.abs(Math.sin(t * 4 + s));
      ctx.beginPath(); ctx.arc(sx, sy, (s % 3) * 0.8 + 0.5, 0, Math.PI * 2); ctx.fill();
    }

    // Alan Turing Quote (floating at top)
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 20px CaveatHand';
    ctx.textAlign = 'center';
    ctx.fillText('1950: Alan Turing asked — "Can machines think?"', 640, 55);

    // Magi on Left Stage Holding up Sand towards Center-Right
    const magiX = 400, magiY = 480;
    const handX = magiX + 110, handY = magiY - 110;

    // Hand holding out sand
    drawFigure(ctx, {
      torso: 4,
      head: 6,
      facing: 'right',
      accessory: 'wizard-hat',
      targetArmR: [100, -110], // Hand raised high pointing forward
      targetArmL: [-25, 15],
      eyes: 'wide',
      mouth: 'smile'
    }, { x: magiX, y: magiY, r: 42, seed: Math.floor(t * 12) });

    // Lightning strike on sand at t = 44.5s
    const lightningAge = t - 44.5;
    if (lightningAge >= 0 && lightningAge < 0.8) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.moveTo(handX + 40, 0);
      ctx.lineTo(handX + 10, 140);
      ctx.lineTo(handX + 35, 230);
      ctx.lineTo(handX, handY);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Glowing Galaxy of Thinking Sand blossoming out of Magi's hand into the center
    const galaxyCenterX = handX + 180, galaxyCenterY = handY;
    if (t >= 44.5) {
      const galaxyProgress = clamp((t - 44.5) / 2.0);
      const galaxyR = 170 * galaxyProgress;

      ctx.save();
      ctx.translate(galaxyCenterX, galaxyCenterY);
      ctx.rotate(t * 0.8);

      // Rotating spiral galaxy arms
      for (let arm = 0; arm < 3; arm++) {
        const armOffset = (arm / 3) * Math.PI * 2;
        ctx.strokeStyle = arm === 0 ? '#38BDF8' : (arm === 1 ? '#FBBF24' : '#34D399');
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        for (let rad = 5; rad < galaxyR; rad += 6) {
          const theta = armOffset + (rad / 22);
          const gx = Math.cos(theta) * rad;
          const gy = Math.sin(theta) * rad;
          if (rad === 5) ctx.moveTo(gx, gy);
          else ctx.lineTo(gx, gy);
        }
        ctx.stroke();
      }

      // Golden core
      ctx.fillStyle = '#FEF08A';
      ctx.shadowColor = '#FBBF24';
      ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    } else {
      // Simple pile of beach sand on hand
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.ellipse(handX, handY - 5, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Philosophical Conclusion Text
    if (t > 46.0) {
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 30px CaveatHand';
      ctx.textAlign = 'center';
      ctx.fillText('"We taught melted beach sand how to pay attention."', 640, 120);

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 22px CaveatHand';
      ctx.fillText("AI is not magic. It is humanity's greatest mirror.", 640, 160);

      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 26px CaveatHand';
      ctx.fillText("And the journey... has only just begun!", 640, 620);
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
    if (displayCue.includes("fourth and final species: Autonomous Agents")) {
      displayCue = t < 5.0 ? "Species Four: Autonomous Agents!" : "Up until now, AI was just a brain in a jar.";
    } else if (displayCue.includes("give that brain eyes to look at your computer")) {
      if (t < 15.5) displayCue = "What happens when you give that brain eyes and robotic hands?";
      else if (t < 20.5) displayCue = "It opens the editor, runs compilers, and reads bug reports!";
      else displayCue = "The AI fixes issues on its own!";
    } else if (displayCue.includes("four-step loop")) {
      if (t < 30.5) displayCue = "The 4-Step Loop: Observe, Reason, Act, and Verify!";
      else displayCue = "Transforming AI from a passive chatbot into an active partner!";
    } else if (displayCue.includes("Alan Turing asked if a machine could think")) {
      if (t < 44.5) displayCue = "76 years ago, Alan Turing asked if a machine could think.";
      else if (t < 50.0) displayCue = "We melted sand and taught electricity how to pay attention!";
      else displayCue = "AI is humanity's greatest mirror. The journey has just begun!";
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
    console.log(`Act 6 Render progress: ${pct}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
    lastReportTime = Date.now();
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 6 Autonomous Masterpiece rendered successfully: ${OUTPUT_FILE}`);
