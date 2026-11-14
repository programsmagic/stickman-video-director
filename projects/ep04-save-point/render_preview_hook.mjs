import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, GlobalFonts } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';
import { solve2BoneIK } from '../tools/stickman.mjs';

// Fonts
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const DURATION = 20.0; // First 20s hook preview
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const AUDIO_VOICE = path.resolve('projects/ep04-save-point/build/narration.wav');
const OUTPUT_FILE = path.resolve('exports/EP04-SavePoint-Hook-Preview.mp4');
const TEMP_VIDEO = '/tmp/ep04_preview_temp.mp4';
const TEMP_SFX = '/tmp/ep04_preview_sfx.wav';
const TEMP_MIXED = '/tmp/ep04_preview_audio.wav';

// Math Helpers
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOutBack = t => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Remotion-style Spring helper
function spring({ frame, fps = 30, config = { damping: 12, stiffness: 100, mass: 1 }, delay = 0 }) {
  const t = Math.max(0, (frame - delay) / fps);
  if (t === 0) return 0;
  const { damping, stiffness, mass } = config;
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const omega1 = omega0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega0 * t) * (Math.cos(omega1 * t) + (zeta * omega0 / omega1) * Math.sin(omega1 * t));
  }
  return 1 - Math.exp(-omega0 * t) * (1 + omega0 * t);
}

// -------------------------------------------------------------
// 1. PROCEDURAL FOLEY AUDIO SYNTHESIS (First 20s)
// -------------------------------------------------------------
console.log('1. Generating synchronized Foley audio track...');
{
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const samples = new Float32Array(n);
  let seed = 42109;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // Digital chime for Save Point Prompt (t = 2.5s)
  const chimeStart = Math.floor(2.5 * rate);
  for (let i = 0; i < rate * 1.5; i++) {
    const t = i / rate;
    const env = Math.exp(-t * 3.5);
    const wave = Math.sin(2 * Math.PI * 880 * t) * 0.4 + Math.sin(2 * Math.PI * 1320 * t) * 0.3 + Math.sin(2 * Math.PI * 1760 * t) * 0.2;
    if (chimeStart + i < n) samples[chimeStart + i] += wave * env * 0.25;
  }

  // Electric hum when touching hologram (t = 7.8s to 9.5s)
  const humStart = Math.floor(7.8 * rate);
  for (let i = 0; i < rate * 1.7; i++) {
    const t = i / rate;
    const env = Math.min(1, t * 5) * Math.max(0, 1 - (t - 1.2) * 2);
    const hum = (Math.sin(2 * Math.PI * 120 * t) + Math.sin(2 * Math.PI * 240 * t) * 0.5 + (rand() - 0.5) * 0.2) * 0.15;
    if (humStart + i < n) samples[humStart + i] += hum * env;
  }

  // Wrist tap percussive snap (t = 14.5s and 14.8s)
  for (const tapSec of [14.5, 14.8]) {
    const tapStart = Math.floor(tapSec * rate);
    for (let i = 0; i < rate * 0.2; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 40);
      const click = (rand() - 0.5) * 0.6 + Math.sin(2 * Math.PI * 450 * t) * 0.4;
      if (tapStart + i < n) samples[tapStart + i] += click * env * 0.35;
    }
  }

  // Soft clock ticking throughout (every second)
  for (let s = 0; s < DURATION; s += 1.0) {
    const tickStart = Math.floor(s * rate);
    for (let i = 0; i < rate * 0.05; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 120);
      const tick = (rand() - 0.5) * 0.15 + Math.sin(2 * Math.PI * 1800 * t) * 0.1;
      if (tickStart + i < n) samples[tickStart + i] += tick * env * 0.12;
    }
  }

  // Convert Float32Array to 16-bit PCM WAV
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // Mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);

  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.floor(s < 0 ? s * 32768 : s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(TEMP_SFX, buf);
  console.log('✓ Foley audio synthesized:', TEMP_SFX);
}

// -------------------------------------------------------------
// 2. MIX NARRATION + FOLEY
// -------------------------------------------------------------
console.log('2. Mixing narration and procedural Foley...');
{
  const ffmpegAudio = spawn('ffmpeg', [
    '-v', 'error', '-y',
    '-ss', '0', '-t', `${DURATION}`, '-i', AUDIO_VOICE,
    '-ss', '0', '-t', `${DURATION}`, '-i', TEMP_SFX,
    '-filter_complex', '[0:a]volume=1.05[v];[1:a]volume=0.85[s];[v][s]amix=inputs=2:duration=first:dropout_transition=2[out]',
    '-map', '[out]',
    '-c:a', 'pcm_s16le',
    '-ar', '48000',
    TEMP_MIXED
  ]);
  await once(ffmpegAudio, 'close');
  console.log('✓ Audio mixed successfully:', TEMP_MIXED);
}

// -------------------------------------------------------------
// 3. FRAME RENDERING WITH REMOTION SPRINGS & IK CHARACTER
// -------------------------------------------------------------
console.log('3. Rendering video frames with analytical IK & Remotion springs...');
const ffmpegVideo = spawn('ffmpeg', [
  '-v', 'error', '-y',
  '-f', 'image2pipe',
  '-vcodec', 'png',
  '-r', `${FPS}`,
  '-i', '-',
  '-i', TEMP_MIXED,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  OUTPUT_FILE
]);

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Stickman Drawing Helper with IK
function drawMagiCharacter(ctx, x, y, options = {}) {
  const {
    scale = 1.0,
    headLook = 0,
    armTargetL = null,
    armTargetR = null,
    expression = 'normal', // 'sleepy', 'amazed', 'serious', 'smile'
    wristTap = 0 // 0 to 1 progress of tapping wrists
  } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const r = 24; // head radius
  const spineLen = 75;
  const shoulderY = -spineLen + 15;
  const hipY = 0;

  // Legs & Bed / Floor
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Torso / Spine
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(0, -spineLen);
  ctx.stroke();

  // Yellow Scarf
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(0, -spineLen + 8, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, -spineLen + 8);
  ctx.lineTo(14, -spineLen + 32);
  ctx.lineTo(2, -spineLen + 30);
  ctx.closePath();
  ctx.fill();

  // Head
  const headCY = -spineLen - r + 4;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, headCY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wizard Hat
  ctx.fillStyle = '#6366F1';
  ctx.strokeStyle = '#4338CA';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-32, headCY - 12);
  ctx.quadraticCurveTo(0, headCY - 20, 32, headCY - 12);
  ctx.quadraticCurveTo(0, headCY - 6, -32, headCY - 12);
  ctx.fill();
  ctx.stroke();

  // Hat cone
  ctx.beginPath();
  ctx.moveTo(-20, headCY - 14);
  ctx.quadraticCurveTo(-12, headCY - 50, 6, headCY - 65);
  ctx.quadraticCurveTo(10, headCY - 40, 20, headCY - 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Yellow star on hat
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(2, headCY - 36, 5, 0, Math.PI * 2);
  ctx.fill();

  // Glasses & Face Expression
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;

  if (expression === 'sleepy') {
    // Droopy eyes
    ctx.beginPath();
    ctx.moveTo(-12, headCY);
    ctx.lineTo(-4, headCY - 2);
    ctx.moveTo(4, headCY - 2);
    ctx.lineTo(12, headCY);
    ctx.stroke();
    // Yawny mouth
    ctx.beginPath();
    ctx.ellipse(0, headCY + 11, 4, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (expression === 'amazed') {
    // Wide eyes
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-8, headCY - 1, 3.5, 0, Math.PI * 2);
    ctx.arc(8, headCY - 1, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Round open mouth
    ctx.beginPath();
    ctx.arc(0, headCY + 10, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Confident smile
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-7 + headLook * 2, headCY - 1, 2.5, 0, Math.PI * 2);
    ctx.arc(7 + headLook * 2, headCY - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, headCY + 7, 7, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  // Glasses rims
  ctx.beginPath();
  ctx.arc(-8, headCY - 1, 7, 0, Math.PI * 2);
  ctx.arc(8, headCY - 1, 7, 0, Math.PI * 2);
  ctx.moveTo(-1, headCY - 1);
  ctx.lineTo(1, headCY - 1);
  ctx.stroke();

  // ARMS with 2-Bone Analytical IK
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  const boneLen = 35;

  // Left Arm
  let targetL = armTargetL || [-30, shoulderY + 50];
  let ikL = solve2BoneIK([0, shoulderY], targetL, boneLen, boneLen, -1);
  ctx.beginPath();
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(ikL[1][0], ikL[1][1]);
  ctx.lineTo(ikL[2][0], ikL[2][1]);
  ctx.stroke();

  // Right Arm
  let targetR = armTargetR || [30, shoulderY + 50];
  if (wristTap > 0) {
    // Move both hands together towards chest center [0, shoulderY + 25]
    const tapX = lerp(30, 8, wristTap);
    const tapY = lerp(shoulderY + 50, shoulderY + 25, wristTap);
    targetR = [tapX, tapY];
    const tapXL = lerp(-30, -8, wristTap);
    targetL = [tapXL, tapY];
    ikL = solve2BoneIK([0, shoulderY], targetL, boneLen, boneLen, -1);
  }

  const ikR = solve2BoneIK([0, shoulderY], targetR, boneLen, boneLen, 1);
  ctx.beginPath();
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(ikR[1][0], ikR[1][1]);
  ctx.lineTo(ikR[2][0], ikR[2][1]);
  ctx.stroke();

  // Legs sitting on bed / standing
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(-20, hipY + 45);
  ctx.lineTo(-45, hipY + 45);
  ctx.moveTo(0, hipY);
  ctx.lineTo(20, hipY + 45);
  ctx.lineTo(45, hipY + 45);
  ctx.stroke();

  ctx.restore();
}

// -------------------------------------------------------------
// RENDER LOOP
// -------------------------------------------------------------
for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background: Deep Cinematic Midnight Indigo
  const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 80, WIDTH / 2, HEIGHT / 2, 700);
  bgGrad.addColorStop(0, '#0F172A');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle isometric bedroom grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Bed & Warm Lamp Glow
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(200, 480, 500, 140);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.strokeRect(200, 480, 500, 140);

  // Digital Alarm Clock: "07:00 AM"
  ctx.fillStyle = '#090D16';
  ctx.fillRect(120, 440, 130, 60);
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2;
  ctx.strokeRect(120, 440, 130, 60);
  ctx.fillStyle = '#38BDF8';
  ctx.font = '24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('07:00 AM', 185, 478);

  // Scene 1: 0 - 5.5s (Wake up & Translucent Menu Spawn)
  // Scene 2: 5.5 - 11s (Touch hologram & Electric hum)
  // Scene 3: 11 - 20s (Tap wrists together twice instruction)

  let magiExpr = 'sleepy';
  let magiHandL = [-25, -40];
  let magiHandR = [25, -40];
  let wristTap = 0;

  if (t > 2.0 && t < 6.0) {
    magiExpr = 'amazed';
  } else if (t >= 6.0 && t < 12.0) {
    magiExpr = 'amazed';
    // Reach right hand out to touch the translucent menu
    const reachT = clamp((t - 6.5) / 1.5);
    const handX = lerp(30, 120, ease(reachT));
    const handY = lerp(-40, -90, ease(reachT));
    magiHandR = [handX, handY];
  } else if (t >= 12.0) {
    magiExpr = 'serious';
    // Tap wrists together twice at t=14.5 and t=16.5
    if ((t >= 14.2 && t <= 15.0) || (t >= 16.2 && t <= 17.0)) {
      const cycle = t < 15.5 ? (t - 14.2) / 0.8 : (t - 16.2) / 0.8;
      wristTap = Math.sin(cycle * Math.PI);
    }
  }

  // Draw Magi sitting on the bed
  drawMagiCharacter(ctx, 450, 490, {
    scale: 1.15,
    expression: magiExpr,
    armTargetL: magiHandL,
    armTargetR: magiHandR,
    wristTap
  });

  // REMOTION SPRING HOLOGRAPHIC MENU
  // Pops in with spring at t = 2.5s
  const menuSpring = spring({ frame, fps: FPS, config: { damping: 10, stiffness: 120, mass: 0.8 }, delay: 2.5 * FPS });

  if (menuSpring > 0.01) {
    ctx.save();
    const menuCX = 780;
    const menuCY = 340;
    const menuW = 380 * menuSpring;
    const menuH = 220 * menuSpring;

    ctx.translate(menuCX, menuCY);

    // Glowing Hologram Background (Glassmorphism)
    const glowGrad = ctx.createLinearGradient(-menuW / 2, -menuH / 2, menuW / 2, menuH / 2);
    glowGrad.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
    glowGrad.addColorStop(1, 'rgba(6, 78, 59, 0.28)');
    ctx.fillStyle = glowGrad;

    ctx.beginPath();
    ctx.roundRect(-menuW / 2, -menuH / 2, menuW, menuH, 16);
    ctx.fill();

    // Neon Cyber Border
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow

    // Corner decorative HUD brackets
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 4;
    const cw = 18;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(-menuW / 2 + cw, -menuH / 2);
    ctx.lineTo(-menuW / 2, -menuH / 2);
    ctx.lineTo(-menuW / 2, -menuH / 2 + cw);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(menuW / 2 - cw, -menuH / 2);
    ctx.lineTo(menuW / 2, -menuH / 2);
    ctx.lineTo(menuW / 2, -menuH / 2 + cw);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(-menuW / 2 + cw, menuH / 2);
    ctx.lineTo(-menuW / 2, menuH / 2);
    ctx.lineTo(-menuW / 2, menuH / 2 - cw);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(menuW / 2 - cw, menuH / 2);
    ctx.lineTo(menuW / 2, menuH / 2);
    ctx.lineTo(menuW / 2, menuH / 2 - cw);
    ctx.stroke();

    // Holographic Scanlines
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.12)';
    ctx.lineWidth = 1;
    for (let scanY = -menuH / 2 + 8; scanY < menuH / 2; scanY += 12) {
      ctx.beginPath();
      ctx.moveTo(-menuW / 2 + 10, scanY);
      ctx.lineTo(menuW / 2 - 10, scanY);
      ctx.stroke();
    }

    if (menuSpring > 0.8) {
      // Content: Status Badge
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(-menuW / 2 + 35, -menuH / 2 + 35, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#A7F3D0';
      ctx.font = 'bold 15px NotoSans';
      ctx.textAlign = 'left';
      ctx.fillText('STATUS: ACTIVE QUICKSAVE', -menuW / 2 + 50, -menuH / 2 + 40);

      // Main Title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText('SAVE POINT CREATED', 0, -menuH / 2 + 85);

      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 19px NotoSans';
      ctx.fillText('DAY 1 · 07:00 AM', 0, -menuH / 2 + 115);

      // Subtitle / Instruction with spring delay at t = 10s
      const instructSpring = spring({ frame, fps: FPS, config: { damping: 12, stiffness: 100, mass: 1 }, delay: 10 * FPS });
      if (instructSpring > 0.1) {
        ctx.fillStyle = `rgba(254, 240, 138, ${instructSpring})`;
        ctx.font = 'bold 17px NotoSans';
        ctx.fillText('"Tap wrists together twice to reload"', 0, -menuH / 2 + 165);
      }
    }

    // Touch Spark effect at t = 8.0s to 9.5s
    if (t >= 8.0 && t <= 9.5) {
      const sparkAlpha = Math.sin((t - 8.0) / 1.5 * Math.PI);
      ctx.strokeStyle = `rgba(56, 189, 248, ${sparkAlpha})`;
      ctx.lineWidth = 2;
      for (let s = 0; s < 6; s++) {
        const ang = (s * 60 + frame * 10) * Math.PI / 180;
        const dist = 18 + Math.sin(frame * 0.5) * 6;
        ctx.beginPath();
        ctx.moveTo(-menuW / 2, 0);
        ctx.lineTo(-menuW / 2 + Math.cos(ang) * dist, Math.sin(ang) * dist);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Top Title Banner
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 30px CaveatHand';
  ctx.textAlign = 'center';
  ctx.fillText('What If You Had a Real-Life Save Point?', WIDTH / 2, 50);

  // Bottom Subtitle Caption Pill
  let captionText = '';
  if (t < 2.5) {
    captionText = 'You wake up at seven in the morning...';
  } else if (t < 5.8) {
    captionText = '...and floating in front of your chest is a translucent menu.';
  } else if (t < 8.0) {
    captionText = 'Save point created. At first, you think you are still dreaming.';
  } else if (t < 11.5) {
    captionText = 'You swipe your hand through it, but your fingers buzz with an electric hum.';
  } else if (t < 16.0) {
    captionText = 'Then small text appears beneath it: "Tap your wrists together twice to reload."';
  } else {
    captionText = 'For the next seven days, you have one active save point. Zero consequences.';
  }

  if (captionText) {
    ctx.font = 'bold 21px CaveatHand';
    const textWidth = ctx.measureText(captionText).width;
    const pillW = textWidth + 48;
    const pillH = 46;
    const pillX = (WIDTH - pillW) / 2;
    const pillY = HEIGHT - 75;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 23);
    ctx.fill();

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(captionText, WIDTH / 2, pillY + pillH / 2);
  }

  // Pipe PNG frame to ffmpeg
  const pngBuffer = canvas.toBuffer('image/png');
  ffmpegVideo.stdin.write(pngBuffer);

  if (frame % 90 === 0) {
    console.log(`Render progress: ${(frame / TOTAL_FRAMES * 100).toFixed(1)}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
  }
}

ffmpegVideo.stdin.end();
await once(ffmpegVideo, 'close');

console.log(`\n🎉 Hook preview rendered successfully: ${OUTPUT_FILE}`);
