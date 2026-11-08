import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 24;
const DURATION = 14.52;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const AUDIO_VOICE = path.resolve('exports/creator_pad_voice.wav');
const AUDIO_SFX = path.resolve('/tmp/creator_pad_sfx.wav');
const AUDIO_MIXED = path.resolve('/tmp/creator_pad_mixed.wav');
const TEMP_VIDEO = path.resolve('/tmp/creator_pad_temp.mp4');
const OUTPUT_FILE = path.resolve('exports/creator-pad-interactive-v3.mp4');

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
// 1. PROCEDURAL FOLEY AUDIO (MARKER DRAWING, GLASS TAP, CHIME)
// -------------------------------------------------------------
function generateFoleyAudio() {
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const samples = new Float32Array(n);

  let seed = 91823;
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

  // Camera Zoom Whoosh at t = 1.8s
  addSound(1.8, 0.7, t => {
    const env = Math.sin((t / 0.7) * Math.PI);
    return noise() * env * 0.35;
  }, 0.35);

  // Stylus / Marker friction sound while writing (t = 3.4s to 6.2s)
  addSound(3.4, 2.8, t => {
    // Scratchy paper/glass friction rhythm
    const friction = Math.sin(t * 85) * noise() * 0.4 + noise() * 0.3;
    const burst = (Math.sin(t * 18) > 0.2) ? 1.0 : 0.2;
    return friction * burst * 0.5;
  }, 0.25);

  // Stylus sketching mini-agent (t = 7.0s to 8.4s)
  addSound(7.0, 1.4, t => {
    const friction = Math.sin(t * 110) * noise() * 0.5;
    return friction * 0.4;
  }, 0.25);

  // Glass Tap Sound at t = 8.5s (Magi touches stylus to wake agent)
  addSound(8.5, 0.12, t => {
    const env = Math.exp(-t * 60);
    return (noise() * 0.3 + Math.sin(2 * Math.PI * 1400 * t) * 0.7) * env;
  }, 0.6);

  // Magic Spark / Chime when sketch comes alive (t = 8.6s to 9.8s)
  addSound(8.6, 1.2, t => {
    const env = Math.exp(-t * 3.5);
    return (
      Math.sin(2 * Math.PI * 1046.5 * t) * 0.4 + // C6
      Math.sin(2 * Math.PI * 1318.5 * t) * 0.3 + // E6
      Math.sin(2 * Math.PI * 1567.9 * t) * 0.3   // G6
    ) * env;
  }, 0.5);

  // Camera Pull Back Whoosh at t = 10.8s
  addSound(10.8, 0.8, t => {
    const env = Math.sin((t / 0.8) * Math.PI);
    return noise() * env * 0.3;
  }, 0.3);

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
// 2. THE DRAFTING PAD & INTERACTIVE DRAWING ENGINE
// -------------------------------------------------------------
// Pad dimensions on canvas
const PAD = { x: 340, y: 130, w: 840, h: 520 };

function drawDigitalPadBase(ctx, t) {
  ctx.save();

  // Tablet Bezel / Desk Frame (Matte Aluminum)
  ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 16;

  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.roundRect(PAD.x - 24, PAD.y - 24, PAD.w + 48, PAD.h + 48, 24);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Inner Screen Bezel
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(PAD.x - 8, PAD.y - 8, PAD.w + 16, PAD.h + 16, 16);
  ctx.fill();

  // Glass Drawing Surface (Pristine luminous canvas)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(PAD.x, PAD.y, PAD.w, PAD.h, 12);
  ctx.fill();

  // Subtle Matrix Drafting Grid
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
  ctx.lineWidth = 1;
  for (let gx = PAD.x + 40; gx < PAD.x + PAD.w; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, PAD.y); ctx.lineTo(gx, PAD.y + PAD.h); ctx.stroke();
  }
  for (let gy = PAD.y + 40; gy < PAD.y + PAD.h; gy += 40) {
    ctx.beginPath(); ctx.moveTo(PAD.x, gy); ctx.lineTo(PAD.x + PAD.w, gy); ctx.stroke();
  }

  // Tablet UI Top Bar
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CANVAS: LIVE-AGENT-01 // REAL-TIME RENDERING', PAD.x + 20, PAD.y + 26);

  // Active Stylus Indicator
  ctx.fillStyle = '#10B981';
  ctx.beginPath(); ctx.arc(PAD.x + PAD.w - 120, PAD.y + 22, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#059669';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('STYLUS CONNECTED', PAD.x + PAD.w - 108, PAD.y + 26);

  ctx.restore();
}

// -------------------------------------------------------------
// 3. REAL-TIME DRAWN CONTENT ON PAD
// -------------------------------------------------------------
function drawPadContent(ctx, t) {
  ctx.save();

  // SECTION 1: MAGI WRITES THE GOAL (t = 3.4s to 6.2s)
  if (t > 3.4) {
    const textProgress = clamp((t - 3.4) / 2.2);

    // Prompt Header Bubble
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = 'rgba(239, 246, 255, 0.8)';
    ctx.beginPath();
    ctx.roundRect(PAD.x + 40, PAD.y + 60, 420 * clamp(textProgress * 1.5), 58, 12);
    ctx.fill();
    if (textProgress > 0.2) ctx.stroke();

    // Text written by stylus in real time
    const fullText = 'GOAL: Build Autonomous AI Agent';
    const charCount = Math.floor(clamp((textProgress - 0.2) / 0.8) * fullText.length);
    const visibleText = fullText.slice(0, charCount);

    ctx.fillStyle = '#1E3A8A';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(visibleText, PAD.x + 60, PAD.y + 96);
  }

  // SECTION 2: MAGI SKETCHES THE MINI-AGENT & BRINGS IT TO LIFE
  // (Sketched t = 6.8s to 8.4s, tapped & awakens at t = 8.5s)
  if (t > 6.8) {
    const sketchProgress = clamp((t - 6.8) / 1.6);
    const isAwake = t >= 8.5;

    const agentX = PAD.x + 240;
    const agentY = PAD.y + 300;

    // Head circle
    if (sketchProgress > 0.1) {
      const headRadius = 26;
      ctx.strokeStyle = isAwake ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 3.5;
      ctx.fillStyle = isAwake ? '#F0F9FF' : '#FFFFFF';
      ctx.beginPath();
      const arcEnd = isAwake ? Math.PI * 2 : clamp((sketchProgress - 0.1) / 0.3) * Math.PI * 2;
      ctx.arc(agentX, agentY - 60, headRadius, 0, arcEnd);
      ctx.fill();
      ctx.stroke();

      // Facial features when awake
      if (isAwake) {
        // Glowing cyan eyes
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.arc(agentX - 8, agentY - 62, 3, 0, Math.PI * 2);
        ctx.arc(agentX + 8, agentY - 62, 3, 0, Math.PI * 2);
        ctx.fill();

        // Happy open smile
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(agentX, agentY - 54, 7, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();

        // Glowing antenna on top of head
        ctx.beginPath();
        ctx.moveTo(agentX, agentY - 86);
        ctx.lineTo(agentX, agentY - 98);
        ctx.stroke();
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(agentX, agentY - 100, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Spine
    if (sketchProgress > 0.4) {
      const spineLen = clamp((sketchProgress - 0.4) / 0.2) * 55;
      ctx.strokeStyle = isAwake ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(agentX, agentY - 34);
      ctx.lineTo(agentX, agentY - 34 + spineLen);
      ctx.stroke();
    }

    // Arms & Legs
    if (sketchProgress > 0.6) {
      const armProgress = clamp((sketchProgress - 0.6) / 0.4);
      ctx.strokeStyle = isAwake ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 3.5;

      // When awake: energetic walking motion!
      const walkT = isAwake ? (t - 8.5) * 8 : 0;
      const legAngle = isAwake ? Math.sin(walkT) * 16 : 14;
      const armAngle = isAwake ? Math.cos(walkT) * 18 : 12;

      // Legs
      ctx.beginPath();
      ctx.moveTo(agentX, agentY + 21);
      ctx.lineTo(agentX - legAngle, agentY + 70);
      ctx.moveTo(agentX, agentY + 21);
      ctx.lineTo(agentX + legAngle, agentY + 70);
      ctx.stroke();

      // Arms
      ctx.beginPath();
      ctx.moveTo(agentX, agentY - 15);
      ctx.lineTo(agentX - armAngle - 10, agentY + 15);
      ctx.moveTo(agentX, agentY - 15);
      ctx.lineTo(agentX + armAngle + 10, agentY + 15);
      ctx.stroke();
    }

    // WAKE-UP SPARK RIPPLE at t = 8.5s
    if (t >= 8.5 && t < 9.6) {
      const sparkT = (t - 8.5) / 1.1;
      const radius = sparkT * 90;
      ctx.save();
      ctx.strokeStyle = `rgba(14, 165, 233, ${1 - sparkT})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(agentX, agentY - 20, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Spark particles
      for (let s = 0; s < 8; s++) {
        const ang = (s / 8) * Math.PI * 2;
        const spkX = agentX + Math.cos(ang) * (radius * 0.8);
        const spkY = (agentY - 20) + Math.sin(ang) * (radius * 0.8);
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(spkX, spkY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // SECTION 3: THE AUTONOMOUS CODE LOOP (Drawn on Right Side of Pad)
  // (t = 8.8s to 12.0s)
  if (t > 8.8) {
    const loopProgress = clamp((t - 8.8) / 2.0);

    const loopX = PAD.x + 580;
    const loopY = PAD.y + 260;

    // Glowing Loop Circle Path
    ctx.strokeStyle = '#6366F1';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    const arcLen = loopProgress * Math.PI * 2;
    ctx.arc(loopX, loopY, 85, -Math.PI * 0.5, -Math.PI * 0.5 + arcLen);
    ctx.stroke();

    // Arrows along loop
    if (loopProgress > 0.4) {
      // Loop Node 1: REASON
      ctx.fillStyle = '#4F46E5';
      ctx.beginPath();
      ctx.roundRect(loopX - 60, loopY - 120, 120, 36, 18);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('1. REASON', loopX, loopY - 97);
    }

    if (loopProgress > 0.7) {
      // Loop Node 2: EXECUTE
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.roundRect(loopX - 65, loopY + 84, 130, 36, 18);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('2. EXECUTE ⚡', loopX, loopY + 107);
    }

    // Dynamic rotating packet around loop when complete
    if (t > 10.5) {
      const rot = (t * 3.5) % (Math.PI * 2);
      const orbX = loopX + Math.cos(rot) * 85;
      const orbY = loopY + Math.sin(rot) * 85;

      ctx.save();
      ctx.fillStyle = '#F59E0B';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(orbX, orbY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Center Badge: 100% AUTONOMOUS
    if (t > 10.8) {
      const badgeAlpha = clamp((t - 10.8) * 3);
      ctx.save();
      ctx.globalAlpha = badgeAlpha;
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WHILE ACTIVE:', loopX, loopY - 8);
      ctx.fillStyle = '#2563EB';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('SOLVES TASK', loopX, loopY + 14);
      ctx.restore();
    }
  }

  ctx.restore();
}

// -------------------------------------------------------------
// 4. MAGI: THE CREATOR & ANIMATOR (HOLDING & DRAWING WITH STYLUS)
// -------------------------------------------------------------
function drawCreatorMagi(ctx, t, stylusTarget) {
  ctx.save();

  // Magi stands at left side of drafting pad (x=210, y=580)
  const magiX = 210;
  const magiY = 580;
  ctx.translate(magiX, magiY);

  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 4.0;
  ctx.lineCap = 'round';

  // Ground shadow
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 42, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30, 35, 42, 0.16)';
  ctx.fill();
  ctx.restore();

  // Legs (standing angled toward the pad)
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.lineTo(-14, 0);
  ctx.moveTo(0, -60);
  ctx.lineTo(16, 0);
  ctx.stroke();

  // Torso leaning slightly toward pad
  const chestX = 14;
  const chestY = -135;
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.lineTo(chestX, chestY);
  ctx.stroke();

  // Left arm resting comfortably on hip or pad edge
  ctx.beginPath();
  ctx.moveTo(chestX, chestY + 12);
  ctx.lineTo(chestX - 22, chestY + 45);
  ctx.lineTo(chestX - 6, chestY + 70);
  ctx.stroke();

  // Yellow Scarf
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.roundRect(chestX - 14, chestY - 8, 28, 14, 4);
  ctx.fill();
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Scarf tail waving slightly
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(chestX + 6, chestY);
  ctx.quadraticCurveTo(chestX + 18, chestY + 25, chestX + 24 + Math.sin(t * 3) * 4, chestY + 48);
  ctx.stroke();

  // Head tilted down toward pad when drawing, looks at camera at end
  const isLookingAtCamera = t > 11.5;
  const headAngle = isLookingAtCamera ? 0 : 0.18; // Tilted toward pad
  const headX = chestX + 4;
  const headY = chestY - 32;

  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(headAngle);

  // Head circle
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 4.0;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Glasses
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(-8, -2, 7.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(8, -2, 7.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.5, -2); ctx.lineTo(0.5, -2); ctx.stroke();

  // Eyes (Gazing at stylus when drawing, at camera when finished)
  ctx.fillStyle = '#1E232A';
  const eyeGazeX = isLookingAtCamera ? 0 : 3.5;
  const eyeGazeY = isLookingAtCamera ? 0 : 2.5;
  ctx.beginPath();
  ctx.arc(-8 + eyeGazeX, -2 + eyeGazeY, 2.5, 0, Math.PI * 2);
  ctx.arc(8 + eyeGazeX, -2 + eyeGazeY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Mouth (Curious concentration when drawing, proud smile at end)
  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (isLookingAtCamera) {
    ctx.arc(0, 8, 7, 0.1 * Math.PI, 0.9 * Math.PI); // Big proud smile
  } else {
    ctx.moveTo(-4, 11); ctx.lineTo(4, 11); // Focused line
  }
  ctx.stroke();

  // Wizard Hat
  ctx.fillStyle = '#4B5563';
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.ellipse(0, -20, 35, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-24, -20);
  ctx.lineTo(2, -82);
  ctx.lineTo(24, -20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(0, -23, 24, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // Restore head transform

  // RIGHT ARM: HOLDING THE STYLUS AND REACHING TO stylusTarget!
  // Target position in local Magi coordinates:
  const targetLocalX = stylusTarget.x - magiX;
  const targetLocalY = stylusTarget.y - magiY;

  const shoulderX = chestX + 6;
  const shoulderY = chestY + 12;

  // 2-Bone Arm reaches directly to stylusTarget
  const elbowX = shoulderX + (targetLocalX - shoulderX) * 0.45;
  const elbowY = shoulderY + (targetLocalY - shoulderY) * 0.5 + 25;

  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(elbowX, elbowY);
  ctx.lineTo(targetLocalX, targetLocalY);
  ctx.stroke();

  // Hand holding stylus
  ctx.fillStyle = '#1E232A';
  ctx.beginPath();
  ctx.arc(targetLocalX, targetLocalY, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // THE GLOWING STYLUS PEN
  ctx.save();
  ctx.translate(targetLocalX, targetLocalY);
  ctx.rotate(-0.5); // Angled pen

  // Stylus body (golden metallic)
  ctx.fillStyle = '#D97706';
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-4, -40, 8, 42, 2);
  ctx.fill();
  ctx.stroke();

  // Stylus Tip
  ctx.fillStyle = '#38BDF8'; // Glowing cyan nib
  ctx.beginPath();
  ctx.moveTo(-3, 2);
  ctx.lineTo(0, 8);
  ctx.lineTo(3, 2);
  ctx.closePath();
  ctx.fill();

  // Tip Sparkle when drawing
  if (t > 3.4 && t < 10.5) {
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

// -------------------------------------------------------------
// 5. MASTER RENDER PIPELINE WITH DYNAMIC CAMERA ZOOM
// -------------------------------------------------------------
async function renderCreatorPadVideo() {
  console.log(`\n======================================================`);
  console.log(`Rendering Interactive Creator Pad Explainer V3`);
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
  console.log(`Rendering ${TOTAL_FRAMES} cinematic camera-tracked frames...`);
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
    // DYNAMIC CAMERA DIRECTING (Pans & Zooms into active area!)
    // ---------------------------------------------------------
    let camZoom = 1.0;
    let camFocusX = WIDTH / 2;
    let camFocusY = HEIGHT / 2;

    // Stylus Target point that Magi draws towards
    let stylusX = PAD.x + 80;
    let stylusY = PAD.y + 90;

    if (t < 2.5) {
      // Wide shot: Establishing Magi at his pad
      camZoom = 1.05;
      camFocusX = WIDTH / 2;
      camFocusY = HEIGHT / 2;
      stylusX = PAD.x + 40;
      stylusY = PAD.y + 80;

    } else if (t >= 2.5 && t < 6.8) {
      // ZOOM IN CLOSE-UP: Writing the Goal on Pad Top-Left!
      const zoomProgress = ease((t - 2.5) / 1.2);
      camZoom = lerp(1.05, 1.65, zoomProgress);
      camFocusX = lerp(WIDTH / 2, PAD.x + 220, zoomProgress);
      camFocusY = lerp(HEIGHT / 2, PAD.y + 110, zoomProgress);

      // Stylus moves along the text line being written!
      const writeT = clamp((t - 3.4) / 2.2);
      stylusX = PAD.x + 60 + writeT * 320;
      stylusY = PAD.y + 90 + Math.sin(t * 35) * 4;

    } else if (t >= 6.8 && t < 10.5) {
      // CAMERA PANS ACROSS: Sketching mini-agent & waking it up!
      const panProgress = ease((t - 6.8) / 1.0);
      camZoom = 1.55;
      camFocusX = lerp(PAD.x + 220, PAD.x + 400, panProgress);
      camFocusY = lerp(PAD.y + 110, PAD.y + 260, panProgress);

      if (t < 8.5) {
        // Sketching the mini agent
        const skT = (t - 6.8) / 1.6;
        stylusX = PAD.x + 240 + Math.sin(t * 28) * 18;
        stylusY = PAD.y + 240 + skT * 80;
      } else {
        // Tapping the agent, then drawing the loop
        const loopT = clamp((t - 8.8) / 2.0);
        stylusX = PAD.x + 580 + Math.cos(loopT * Math.PI * 2) * 85;
        stylusY = PAD.y + 260 + Math.sin(loopT * Math.PI * 2) * 85;
      }

    } else {
      // PULL BACK TO HERO WIDE SHOT: Reveal the entire active canvas!
      const pullProgress = ease((t - 10.5) / 1.5);
      camZoom = lerp(1.55, 1.02, pullProgress);
      camFocusX = lerp(PAD.x + 400, WIDTH / 2 + 30, pullProgress);
      camFocusY = lerp(PAD.y + 260, HEIGHT / 2, pullProgress);

      // Stylus rests proudly in Magi's hand
      stylusX = PAD.x + 40;
      stylusY = PAD.y + 140;
    }

    // Apply Camera Transform
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-camFocusX, -camFocusY);

    // Warm minimalist studio floor
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-200, -200, WIDTH + 400, HEIGHT + 400);

    // Subtle background studio grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1.0;
    for (let gx = -100; gx < WIDTH + 200; gx += 48) {
      ctx.beginPath(); ctx.moveTo(gx, -100); ctx.lineTo(gx, HEIGHT + 100); ctx.stroke();
    }
    for (let gy = -100; gy < HEIGHT + 200; gy += 48) {
      ctx.beginPath(); ctx.moveTo(-100, gy); ctx.lineTo(WIDTH + 200, gy); ctx.stroke();
    }

    // 1. Draw Digital Tablet Base
    drawDigitalPadBase(ctx, t);

    // 2. Draw Real-Time Animated Content on Pad
    drawPadContent(ctx, t);

    // 3. Draw Magi holding and drawing with stylus
    drawCreatorMagi(ctx, t, { x: stylusX, y: stylusY });

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

  console.log(`\n🎉 Interactive Creator Pad Explainer V3 rendered successfully!`);
  console.log(`File: ${OUTPUT_FILE}`);
}

renderCreatorPadVideo().catch(err => {
  console.error(err);
  process.exit(1);
});
