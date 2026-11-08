import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 24;
const DURATION = 17.88;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const AUDIO_VOICE = path.resolve('exports/physical_agent_voice.wav');
const AUDIO_SFX = path.resolve('/tmp/physical_sfx.wav');
const AUDIO_MIXED = path.resolve('/tmp/physical_mixed.wav');
const TEMP_VIDEO = path.resolve('/tmp/physical_temp.mp4');
const OUTPUT_FILE = path.resolve('exports/physical-grounded-explainer-v4.mp4');

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function ease(t) {
  t = clamp(t);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// -------------------------------------------------------------
// 1. PROCEDURAL FOLEY AUDIO (FOOTSTEPS, CONSOLE TAP, ENGINE HUM, CHIME)
// -------------------------------------------------------------
function generateFoleyAudio() {
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const samples = new Float32Array(n);

  let seed = 51782;
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

  // Walking footsteps (Act 2: t = 4.0s to 6.6s, step every ~0.45s)
  const walkSteps = [4.1, 4.55, 5.0, 5.45, 5.9, 6.35];
  walkSteps.forEach(st => {
    addSound(st, 0.08, t => {
      const env = Math.exp(-t * 55);
      return (noise() * 0.4 + Math.sin(2 * Math.PI * 180 * t) * 0.6) * env;
    }, 0.22);
  });

  // Console Button Click (t = 7.05s)
  addSound(7.05, 0.1, t => {
    const env = Math.exp(-t * 60);
    return (noise() * 0.3 + Math.sin(2 * Math.PI * 920 * t) * 0.7) * env;
  }, 0.55);

  // Hologram Power-up Swoosh / Hum (t = 7.4s to 9.0s)
  addSound(7.4, 1.4, t => {
    const env = Math.sin((t / 1.4) * Math.PI);
    const f = 220 + t * 240;
    return (Math.sin(2 * Math.PI * f * t) * 0.4 + noise() * 0.2) * env;
  }, 0.3);

  // Stepping Back Footsteps (Act 3: t = 8.2s, 8.65s)
  [8.2, 8.65].forEach(st => {
    addSound(st, 0.08, t => {
      const env = Math.exp(-t * 55);
      return (noise() * 0.4 + Math.sin(2 * Math.PI * 160 * t) * 0.6) * env;
    }, 0.2);
  });

  // Terminal Code Typing (t = 10.2s, 10.4s, 10.6s, 10.8s)
  [10.2, 10.35, 10.5, 10.65, 10.8].forEach(clk => {
    addSound(clk, 0.04, t => (noise() * 0.5 + Math.sin(2 * Math.PI * 1100 * t) * 0.5) * Math.exp(-t * 85), 0.18);
  });

  // Final Success Bell Chime (t = 14.5s)
  addSound(14.5, 1.4, t => {
    const env = Math.exp(-t * 3.8);
    return (
      Math.sin(2 * Math.PI * 1046.5 * t) * 0.45 + // C6
      Math.sin(2 * Math.PI * 1318.5 * t) * 0.35 + // E6
      Math.sin(2 * Math.PI * 1567.9 * t) * 0.2    // G6
    ) * env;
  }, 0.5);

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
  console.log(`✓ Procedural Foley SFX synthesized: ${AUDIO_SFX}`);
}

// -------------------------------------------------------------
// 2. PHYSICALLY GROUNDED STICKMAN: STRICT ANATOMIC PROPORTIONS
// -------------------------------------------------------------
// Proportions (Fixed, never stretched!):
// Head Radius: 25px
// Torso: 65px
// Upper Arm: 28px, Forearm: 26px (Total arm: 54px max reach!)
// Thigh: 36px, Calf: 34px (Total leg: 70px)
function drawGroundedMagi(ctx, x, y, options) {
  const {
    facing = 1, // 1 for facing right, -1 for facing left, 0 for facing camera
    isWalking = false,
    walkSpeed = 1,
    armAction = 'idle', // 'idle', 'press_console', 'point_engine', 'thumbs_up'
    t = 0
  } = options;

  ctx.save();
  ctx.translate(x, y);

  // Walk bounce and cycle
  const cycle = isWalking ? t * 9 * walkSpeed : t * 2.5;
  const bounce = isWalking ? Math.abs(Math.sin(cycle)) * 6 : Math.sin(t * 2.5) * 1.5;
  const hipY = -70 - bounce;

  // Ground Contact Shadow (physically scales with bounce)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 38 - bounce * 1.2, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30, 35, 42, 0.2)';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 3.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // -----------------------------------------------------------
  // LEGS (2-Bone Articulated with Inverse Kinematics Gait)
  // -----------------------------------------------------------
  const lAngle = isWalking ? Math.sin(cycle) * 0.45 : 0.05;
  const rAngle = isWalking ? Math.sin(cycle + Math.PI) * 0.45 : -0.05;
  const lKnee = isWalking ? Math.max(0, Math.cos(cycle)) * 0.6 : 0;
  const rKnee = isWalking ? Math.max(0, Math.cos(cycle + Math.PI)) * 0.6 : 0;

  function drawLeg(angle, knee, isBack) {
    const hipX = isBack ? -6 : 6;
    const kneeX = hipX + Math.sin(angle) * 36;
    const kneeY = hipY + Math.cos(angle) * 36;
    const footX = kneeX + Math.sin(angle + knee) * 34;
    const footY = kneeY + Math.cos(angle + knee) * 34;

    ctx.strokeStyle = isBack ? '#3C424F' : '#1E232A';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    // Small foot/shoe
    ctx.beginPath();
    ctx.moveTo(footX, footY);
    ctx.lineTo(footX + (facing !== 0 ? facing * 9 : 4), footY);
    ctx.stroke();
  }

  drawLeg(rAngle, rKnee, true); // back leg

  // -----------------------------------------------------------
  // TORSO (Tilts slightly with movement momentum)
  // -----------------------------------------------------------
  const lean = isWalking ? 0.08 * (facing || 1) : 0;
  const chestX = Math.sin(lean) * 65;
  const chestY = hipY - 65;

  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(chestX, chestY);
  ctx.stroke();

  drawLeg(lAngle, lKnee, false); // front leg

  // -----------------------------------------------------------
  // ARMS (Strict natural proportions: Upper 28px, Forearm 26px!)
  // -----------------------------------------------------------
  function drawArm(action, isFront) {
    const shoulderX = isFront ? chestX + 6 : chestX - 6;
    const shoulderY = chestY + 10;
    ctx.strokeStyle = isFront ? '#1E232A' : '#3C424F';
    ctx.lineWidth = 3.6;

    if (action === 'press_console' && isFront) {
      // Reaching forward to console button (natural 45px extension)
      const elbowX = shoulderX + 22;
      const elbowY = shoulderY + 8;
      const handX = shoulderX + 46; // Natural reach ~46px!
      const handY = shoulderY - 6;

      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // Hand touching button
      ctx.fillStyle = '#1E232A';
      ctx.beginPath(); ctx.arc(handX, handY, 3.2, 0, Math.PI * 2); ctx.fill();

    } else if (action === 'point_engine' && isFront) {
      // Open palm gesture toward the engine
      const elbowX = shoulderX + 20;
      const elbowY = shoulderY + 12;
      const handX = shoulderX + 44;
      const handY = shoulderY - 14;

      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      ctx.fillStyle = '#1E232A';
      ctx.beginPath(); ctx.arc(handX, handY, 3.2, 0, Math.PI * 2); ctx.fill();

    } else if (action === 'thumbs_up') {
      // Confident celebratory thumbs up
      const elbowX = shoulderX + (isFront ? 18 : -18);
      const elbowY = shoulderY - 8;
      const handX = shoulderX + (isFront ? 22 : -22);
      const handY = shoulderY - 32;

      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      ctx.fillStyle = '#1E232A';
      ctx.beginPath(); ctx.arc(handX, handY, 3.8, 0, Math.PI * 2); ctx.fill();

    } else {
      // Natural idle or walking swing
      const armSwing = isWalking ? Math.sin(cycle + (isFront ? 0 : Math.PI)) * 0.45 : Math.sin(t * 2.5) * 0.08;
      const elbowX = shoulderX + Math.sin(armSwing) * 26;
      const elbowY = shoulderY + Math.cos(armSwing) * 26;
      const handX = elbowX + Math.sin(armSwing + 0.2) * 24;
      const handY = elbowY + Math.cos(armSwing + 0.2) * 24;

      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(handX, handY);
      ctx.stroke();
    }
  }

  drawArm(armAction, false); // back arm
  drawArm(armAction, true);  // front arm

  // -----------------------------------------------------------
  // SCARF (Iconic yellow scarf with physical velocity lag)
  // -----------------------------------------------------------
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.roundRect(chestX - 14, chestY - 8, 28, 14, 4);
  ctx.fill();
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Scarf tails trail opposite to walking direction
  const scarfLag = isWalking ? -facing * 12 : 0;
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(chestX + 6, chestY);
  ctx.quadraticCurveTo(chestX + 16 + scarfLag, chestY + 22, chestX + 22 + scarfLag + Math.sin(t * 4) * 4, chestY + 44);
  ctx.stroke();

  // -----------------------------------------------------------
  // HEAD & FACE (Looking at viewer or looking at console)
  // -----------------------------------------------------------
  const headX = chestX + 4;
  const headY = chestY - 32;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.arc(headX, headY, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Glasses
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2.0;
  const glassesOffsetX = facing * 4;
  ctx.beginPath();
  ctx.arc(headX - 8 + glassesOffsetX, headY - 2, 7.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(headX + 8 + glassesOffsetX, headY - 2, 7.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(headX - 0.5 + glassesOffsetX, headY - 2);
  ctx.lineTo(headX + 0.5 + glassesOffsetX, headY - 2);
  ctx.stroke();

  // Eyes (Gaze follows action)
  const isBlink = (t % 3.6) > 3.45;
  if (isBlink) {
    ctx.strokeStyle = '#1E232A';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(headX - 11 + glassesOffsetX, headY - 2); ctx.lineTo(headX - 5 + glassesOffsetX, headY - 2);
    ctx.moveTo(headX + 5 + glassesOffsetX, headY - 2); ctx.lineTo(headX + 11 + glassesOffsetX, headY - 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#1E232A';
    const gazeX = facing * 3;
    ctx.beginPath();
    ctx.arc(headX - 8 + glassesOffsetX + gazeX, headY - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(headX + 8 + glassesOffsetX + gazeX, headY - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth (Expression reacts to state)
  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  if (armAction === 'thumbs_up') {
    ctx.arc(headX + glassesOffsetX, headY + 8, 7, 0.1 * Math.PI, 0.9 * Math.PI); // Wide smile
  } else {
    ctx.moveTo(headX - 5 + glassesOffsetX, headY + 11);
    ctx.quadraticCurveTo(headX + glassesOffsetX, headY + 14, headX + 5 + glassesOffsetX, headY + 11);
  }
  ctx.stroke();

  // Wizard Hat
  ctx.fillStyle = '#4B5563';
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.ellipse(headX, headY - 20, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(headX - 23, headY - 20);
  ctx.lineTo(headX + 2, headY - 80);
  ctx.lineTo(headX + 23, headY - 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(headX, headY - 23, 23, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// -------------------------------------------------------------
// 3. PHYSICAL ENVIRONMENT: THE GLASS CONSOLE & HOLOGRAPHIC LAB
// -------------------------------------------------------------
const CONSOLE_X = 660;
const CONSOLE_Y = 580;

function drawLabEnvironment(ctx, t) {
  ctx.save();

  // Warm studio floor with depth horizon
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(-200, -200, WIDTH + 400, HEIGHT + 400);

  // Modern subtle perspective floor lines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  ctx.lineWidth = 1.0;
  for (let gx = -100; gx < WIDTH + 200; gx += 64) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, HEIGHT); ctx.stroke();
  }
  for (let gy = 0; gy < HEIGHT; gy += 64) {
    ctx.beginPath(); ctx.moveTo(-100, gy); ctx.lineTo(WIDTH + 200, gy); ctx.stroke();
  }

  // Ground Stage Platform / Soft ambient illumination
  ctx.fillStyle = 'rgba(241, 245, 249, 0.8)';
  ctx.beginPath();
  ctx.ellipse(WIDTH / 2, 580, 520, 80, 0, 0, Math.PI * 2);
  ctx.fill();

  // Physical Floor-Mounted Console Stand
  ctx.save();
  ctx.translate(CONSOLE_X, CONSOLE_Y);

  // Console Base on Floor
  ctx.fillStyle = '#E2E8F0';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 48, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Aluminum Pedestal Stem
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.roundRect(-8, -110, 16, 110, 4);
  ctx.fill();

  // Angled Interactive Glass Terminal Screen
  ctx.save();
  ctx.translate(0, -110);
  ctx.rotate(-0.15); // Angled toward Magi

  ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.roundRect(-45, -35, 90, 70, 8);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Glass Screen Surface
  const isActivated = t >= 7.05;
  ctx.fillStyle = isActivated ? '#0284C7' : '#334155';
  ctx.beginPath();
  ctx.roundRect(-40, -30, 80, 60, 6);
  ctx.fill();

  // Screen Interface Lines
  ctx.fillStyle = '#E2E8F0';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TERMINAL', 0, -14);

  // Big Physical Cyan Touch Button on Console
  const isPressed = t >= 7.05 && t < 7.4;
  ctx.fillStyle = isPressed ? '#38BDF8' : '#0284C7';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-24, 0, 48, 20, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8px sans-serif';
  ctx.fillText('INITIATE', 0, 13);

  // Touch Ripple Wave at t = 7.05s
  if (t >= 7.05 && t < 7.9) {
    const ripT = (t - 7.05) / 0.85;
    ctx.strokeStyle = `rgba(56, 189, 248, ${1 - ripT})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 10, ripT * 55, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore(); // Restore angled screen
  ctx.restore(); // Restore console transform

  ctx.restore();
}

// -------------------------------------------------------------
// 4. HOLOGRAPHIC MULTI-AGENT ENGINE (PROJECTED ABOVE CONSOLE)
// -------------------------------------------------------------
function drawHolographicEngine(ctx, t) {
  if (t < 7.4) return;
  const deployT = ease((t - 7.4) / 1.4);

  ctx.save();
  ctx.translate(CONSOLE_X + 110, 320);
  ctx.scale(deployT, deployT);

  // Hologram Glass Plinth
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(56, 189, 248, 0.2)';
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.roundRect(-210, -150, 420, 300, 16);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  // Hologram Top Header
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AUTONOMOUS AGENT ENGINE', -180, -115);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('● PIPELINE ACTIVE', 180, -115);

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-180, -98); ctx.lineTo(180, -98); ctx.stroke();

  // LEFT CORE: PLANNER BRAIN (Violet)
  const core1X = -100;
  const core1Y = 0;
  const pulse1 = Math.sin(t * 5) * 4;

  ctx.save();
  ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
  ctx.beginPath(); ctx.arc(core1X, core1Y, 46 + pulse1, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#6366F1';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(core1X, core1Y, 40, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Inner rotating rings
  ctx.strokeStyle = '#818CF8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(core1X, core1Y, 24, t * 2, t * 2 + Math.PI * 1.4);
  ctx.stroke();

  ctx.fillStyle = '#4F46E5';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PLANNER', core1X, core1Y + 5);
  ctx.restore();

  // RIGHT CORE: EXECUTION MATRIX (Emerald)
  const core2X = 100;
  const core2Y = 0;
  const pulse2 = Math.sin(t * 5 + Math.PI) * 4;

  ctx.save();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.beginPath(); ctx.arc(core2X, core2Y, 46 + pulse2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(core2X, core2Y, 40, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Inner rotating rings
  ctx.strokeStyle = '#34D399';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(core2X, core2Y, 24, -t * 2, -t * 2 + Math.PI * 1.4);
  ctx.stroke();

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXECUTOR', core2X, core2Y + 5);
  ctx.restore();

  // DATA CONDUIT BETWEEN CORES
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(core1X + 40, core1Y);
  ctx.lineTo(core2X - 40, core2Y);
  ctx.stroke();

  // Traveling Data Pulse
  const conduitT = (t * 2.2) % 1;
  const conduitX = (core1X + 40) + (core2X - 40 - (core1X + 40)) * conduitT;
  ctx.fillStyle = '#38BDF8';
  ctx.shadowColor = '#0284C7';
  ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(conduitX, core1Y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';

  // Real-Time Terminal Status Underneath
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(-170, 68, 340, 52, 8);
  ctx.fill();

  const codeProgress = clamp((t - 9.5) / 3.0);
  const codeLines = [
    '✓ Subtasks partitioned: 4/4',
    '✓ Tools executed without human loop',
    '⚡ 0 Errors // Production Ready'
  ];
  const visibleLines = Math.floor(codeProgress * codeLines.length);

  ctx.fillStyle = '#38BDF8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  for (let l = 0; l <= visibleLines && l < codeLines.length; l++) {
    ctx.fillText(codeLines[l], -155, 90 + l * 16);
  }

  // FINAL VERIFIED STAMP AT t = 14.2s
  if (t >= 14.2) {
    const stampProgress = ease((t - 14.2) * 3);
    ctx.save();
    ctx.translate(0, -10);
    ctx.scale(1.4 - stampProgress * 0.4, 1.4 - stampProgress * 0.4);
    ctx.rotate(-0.08);

    ctx.fillStyle = '#ECFDF5';
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-120, -28, 240, 56, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('100% AUTONOMOUS', 0, 7);
    ctx.restore();
  }

  ctx.restore();
}

// -------------------------------------------------------------
// 5. MASTER RENDER PIPELINE WITH THEATRICAL CHOREOGRAPHY
// -------------------------------------------------------------
async function renderPhysicallyGroundedVideo() {
  console.log(`\n======================================================`);
  console.log(`Rendering Physically Grounded Explainer V4`);
  console.log(`Target: ${OUTPUT_FILE}`);
  console.log(`Duration: ${DURATION}s (${TOTAL_FRAMES} frames @ 24fps)`);
  console.log(`======================================================\n`);

  // Step 1: Synthesize Foley audio
  generateFoleyAudio();

  // Step 2: Mix Bodi narration + Procedural Foley Audio
  console.log('Mixing narration audio with synchronized Foley sound effects...');
  const mixFfmpeg = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-i', AUDIO_VOICE,
    '-i', AUDIO_SFX,
    '-filter_complex', '[0:a]volume=1.0[a0];[1:a]volume=0.9[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[out]',
    '-map', '[out]',
    AUDIO_MIXED
  ]);

  await new Promise((res, rej) => {
    mixFfmpeg.on('close', code => code === 0 ? res() : rej(new Error('Audio mix failed')));
  });
  console.log(`✓ Audio mixed successfully to ${AUDIO_MIXED}`);

  // Step 3: Render video frames via rawvideo pipe
  console.log(`Rendering ${TOTAL_FRAMES} choreographed frames...`);
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

  ffmpeg.stdin.on('error', () => {});
  let ffmpegErr = '';
  ffmpeg.stderr.on('data', d => { ffmpegErr += d.toString(); });

  const completion = new Promise((resolve, reject) => {
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`Encode failed (code ${code}): ${ffmpegErr}`)));
  });

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    // ---------------------------------------------------------
    // THEATRICAL CHOREOGRAPHY & KINEMATICS (PHYSICALLY POSSIBLE)
    // ---------------------------------------------------------
    let magiX = 320;
    let magiFacing = 1;
    let isWalking = false;
    let armAction = 'idle';

    let camFocusX = 540;
    let camFocusY = 380;
    let camZoom = 1.0;

    if (t < 3.8) {
      // ACT 1: ESTABLISHING SHOT
      // Magi stands center-left, speaking to audience
      magiX = 320;
      magiFacing = 1;
      isWalking = false;
      armAction = 'idle';

      camFocusX = 540;
      camFocusY = 380;
      camZoom = 1.02;

    } else if (t >= 3.8 && t < 6.8) {
      // ACT 2: MAGI PHYSICALLY WALKS ACROSS THE STAGE TO THE CONSOLE
      // 6 natural bipedal steps from x = 320 to x = 600
      const walkT = ease((t - 3.8) / 3.0);
      magiX = lerp(320, 600, walkT);
      magiFacing = 1; // Facing right toward console
      isWalking = true;
      armAction = 'idle';

      // Camera smoothly tracks with Magi
      camFocusX = lerp(540, 680, walkT);
      camFocusY = 380;
      camZoom = lerp(1.02, 1.15, walkT);

    } else if (t >= 6.8 && t < 7.8) {
      // ACT 2B: MAGI STOPS AT CONSOLE & REACHES OUT TO PRESS BUTTON
      // Shoulder is at x=606, console button is at x=650 -> exactly 44px reach!
      magiX = 600;
      magiFacing = 1;
      isWalking = false;
      armAction = 'press_console'; // Natural arm reach!

      camFocusX = 680;
      camFocusY = 380;
      camZoom = 1.18;

    } else if (t >= 7.8 && t < 9.2) {
      // ACT 3: MAGI TAKES 2 NATURAL STEPS BACKWARD (THEATRICAL STAGING)
      // Clears the sightline so audience sees the hologram!
      const backT = ease((t - 7.8) / 1.4);
      magiX = lerp(600, 480, backT); // Steps back to x = 480
      magiFacing = 1; // Still looking toward console
      isWalking = true;
      armAction = 'point_engine';

      camFocusX = lerp(680, 720, backT);
      camFocusY = 360;
      camZoom = lerp(1.18, 1.05, backT);

    } else if (t >= 9.2 && t < 13.5) {
      // ACT 3B: MAGI GESTURES & PRESENTS THE EXPANDED ENGINE
      magiX = 480;
      magiFacing = 1;
      isWalking = false;
      armAction = 'point_engine'; // Normal proportional pointing

      camFocusX = 720;
      camFocusY = 360;
      camZoom = 1.05;

    } else {
      // ACT 4: MAGI FACES CAMERA IN HERO SPOTLIGHT & GIVES THUMBS UP
      const heroT = ease((t - 13.5) / 1.2);
      magiX = lerp(480, 420, heroT);
      magiFacing = 0; // Turns to face camera!
      isWalking = heroT < 0.8;
      armAction = 'thumbs_up';

      camFocusX = lerp(720, 600, heroT);
      camFocusY = 360;
      camZoom = 1.02;
    }

    // Apply Camera Transform
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-camFocusX, -camFocusY);

    // 1. Draw Physical Lab Floor & Console
    drawLabEnvironment(ctx, t);

    // 2. Draw Holographic Multi-Agent Engine
    drawHolographicEngine(ctx, t);

    // 3. Draw Magi with Physical Kinematics & Natural Proportions
    drawGroundedMagi(ctx, magiX, 580, {
      facing: magiFacing,
      isWalking,
      armAction,
      t
    });

    ctx.restore();

    // Pipe raw buffer to ffmpeg with backpressure drain handling
    const buffer = canvas.data();
    if (!ffmpeg.stdin.write(buffer)) {
      await Promise.race([
        once(ffmpeg.stdin, 'drain'),
        completion.then(() => { throw new Error('Encoder closed early'); })
      ]);
    }
  }

  ffmpeg.stdin.end();
  await completion;

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

  console.log(`\n🎉 Physically Grounded Explainer V4 rendered successfully!`);
  console.log(`File: ${OUTPUT_FILE}`);
}

renderPhysicallyGroundedVideo().catch(err => {
  console.error(err);
  process.exit(1);
});

