import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, GlobalFonts } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';
import { solve2BoneIK } from '../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const AUDIO_VOICE = path.resolve('projects/ep04-save-point/build/narration/ch4.wav');
const DURATION = 87.68;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const OUTPUT_FILE = path.resolve('exports/EP04-Act4-ButterflyChaos-Masterpiece.mp4');
const TEMP_SFX = '/tmp/ep04_act4_sfx.wav';
const TEMP_MIXED = '/tmp/ep04_act4_audio.wav';

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };

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
// 1. PROCEDURAL FOLEY (87.68s)
// -------------------------------------------------------------
console.log('1. Synthesizing procedural Foley for Act 4...');
{
  const rate = 48000;
  const n = Math.ceil(DURATION * rate);
  const samples = new Float32Array(n);
  let seed = 44910;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // Rain sound throughout Act 4 (0 to 60s)
  for (let i = 0; i < Math.min(n, Math.floor(62 * rate)); i++) {
    const rainNoise = (rand() - 0.5) * 0.08;
    samples[i] += rainNoise;
  }

  // Crash / Thud
  const addCrash = (sec, vol = 0.4) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.8; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 6);
      const bass = Math.sin(2 * Math.PI * 65 * t) * 0.7;
      const noise = (rand() - 0.5) * 0.5;
      if (s + i < n) samples[s + i] += (bass + noise) * env * vol;
    }
  };

  // Car Horn / Screech
  const addScreech = (sec, vol = 0.3) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.6; i++) {
      const t = i / rate;
      const env = Math.sin(Math.PI * (t / 0.6));
      const tone = Math.sin(2 * Math.PI * (820 + (rand() - 0.5) * 40) * t) * 0.6;
      if (s + i < n) samples[s + i] += tone * env * vol;
    }
  };

  const addWristTap = (sec, vol = 0.35) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.15; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 45);
      const snap = (rand() - 0.5) * 0.6 + Math.sin(2 * Math.PI * 520 * t) * 0.4;
      if (s + i < n) samples[s + i] += snap * env * vol;
    }
  };

  const addRewindWhoosh = (sec, vol = 0.3) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.8; i++) {
      const t = i / rate;
      const freq = 350 + 1100 * (t / 0.8);
      const env = Math.sin(Math.PI * (t / 0.8));
      const sound = ((rand() - 0.5) * 0.4 + Math.sin(2 * Math.PI * freq * t) * 0.6) * env * vol;
      if (s + i < n) samples[s + i] += sound;
    }
  };

  // Heartbeat sound (t = 50s to 75s)
  const addHeartbeat = (sec, vol = 0.25) => {
    const s = Math.floor(sec * rate);
    for (let i = 0; i < rate * 0.4; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 12);
      const thud = Math.sin(2 * Math.PI * 55 * t) * env * vol;
      if (s + i < n) samples[s + i] += thud;
    }
  };

  // Foley Events
  addScreech(12.5, 0.28);
  addCrash(13.2, 0.45);        // Cyclist clipped
  addWristTap(18.0, 0.38);
  addRewindWhoosh(18.5, 0.35); // Reload to 7:00 AM
  addCrash(48.5, 0.5);         // Bus crash
  addWristTap(52.0, 0.38);
  addRewindWhoosh(52.5, 0.35); // Reload again

  // Heartbeat loop during chaos realization
  for (let hb = 54.0; hb < 75.0; hb += 0.9) {
    addHeartbeat(hb, 0.3);
    addHeartbeat(hb + 0.25, 0.2);
  }

  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
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
  console.log('✓ Act 4 Foley synthesized.');
}

// -------------------------------------------------------------
// 2. MIX NARRATION + FOLEY
// -------------------------------------------------------------
console.log('2. Mixing audio for Act 4...');
{
  const ffmpegAudio = spawn('ffmpeg', [
    '-v', 'error', '-y',
    '-i', AUDIO_VOICE,
    '-i', TEMP_SFX,
    '-filter_complex', '[0:a]volume=1.05[v];[1:a]volume=0.85[s];[v][s]amix=inputs=2:duration=first:dropout_transition=2[out]',
    '-map', '[out]',
    '-c:a', 'pcm_s16le',
    '-ar', '48000',
    TEMP_MIXED
  ]);
  await once(ffmpegAudio, 'close');
  console.log('✓ Act 4 Audio mixed.');
}

// -------------------------------------------------------------
// 3. FRAME RENDERING PIPELINE
// -------------------------------------------------------------
console.log('3. Rendering video frames for Act 4...');
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

const allCaptions = JSON.parse(fs.readFileSync('projects/ep04-save-point/build/captions.json', 'utf8'));
const ACT4_OFFSET = 111.24 + 77.00 + 84.36; // 272.60s
function getCaption(sec) {
  const globalSec = sec + ACT4_OFFSET;
  const c = allCaptions.find(x => globalSec >= x.start && globalSec <= x.end);
  return c ? c.text : '';
}

// Draw Magi with IK
function drawMagi(ctx, x, y, options = {}) {
  const {
    scale = 1.0,
    headLook = 0,
    armTargetL = null,
    armTargetR = null,
    expression = 'normal',
    wristTap = 0,
    isKneeling = false,
    facing = 1
  } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);

  const r = 24;
  const spineLen = 75;
  const shoulderY = -spineLen + 15;
  const hipY = 0;

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(0, -spineLen);
  ctx.stroke();

  // Scarf
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

  // Hat
  ctx.fillStyle = '#6366F1';
  ctx.strokeStyle = '#4338CA';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-32, headCY - 12);
  ctx.quadraticCurveTo(0, headCY - 20, 32, headCY - 12);
  ctx.quadraticCurveTo(0, headCY - 6, -32, headCY - 12);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-20, headCY - 14);
  ctx.quadraticCurveTo(-12, headCY - 50, 6, headCY - 65);
  ctx.quadraticCurveTo(10, headCY - 40, 20, headCY - 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  ctx.arc(2, headCY - 36, 5, 0, Math.PI * 2);
  ctx.fill();

  // Face
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  ctx.fillStyle = '#0F172A';

  if (expression === 'shocked') {
    // Wide horrified eyes
    ctx.beginPath();
    ctx.arc(-8, headCY - 2, 4, 0, Math.PI * 2);
    ctx.arc(8, headCY - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    // Open O mouth
    ctx.beginPath();
    ctx.ellipse(0, headCY + 10, 6, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (expression === 'exhausted') {
    // Bloodshot bags under eyes
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-11, headCY + 4);
    ctx.lineTo(-4, headCY + 4);
    ctx.moveTo(4, headCY + 4);
    ctx.lineTo(11, headCY + 4);
    ctx.stroke();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-10, headCY);
    ctx.lineTo(-3, headCY - 2);
    ctx.moveTo(3, headCY - 2);
    ctx.lineTo(10, headCY);
    ctx.stroke();
    // Droopy mouth
    ctx.beginPath();
    ctx.arc(0, headCY + 14, 6, 1.1 * Math.PI, 1.9 * Math.PI);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-7 + headLook * 2, headCY - 1, 2.5, 0, Math.PI * 2);
    ctx.arc(7 + headLook * 2, headCY - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, headCY + 9);
    ctx.lineTo(4, headCY + 9);
    ctx.stroke();
  }

  // Glasses
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(-8, headCY - 1, 7, 0, Math.PI * 2);
  ctx.arc(8, headCY - 1, 7, 0, Math.PI * 2);
  ctx.moveTo(-1, headCY - 1);
  ctx.lineTo(1, headCY - 1);
  ctx.stroke();

  // Arms
  const boneLen = 35;
  let targetL = armTargetL || [-30, shoulderY + 50];
  let targetR = armTargetR || [30, shoulderY + 50];

  if (wristTap > 0) {
    const tapX = lerp(30, 8, wristTap);
    const tapY = lerp(shoulderY + 50, shoulderY + 25, wristTap);
    targetR = [tapX, tapY];
    const tapXL = lerp(-30, -8, wristTap);
    targetL = [tapXL, tapY];
  }

  let ikL = solve2BoneIK([0, shoulderY], targetL, boneLen, boneLen, -1);
  let ikR = solve2BoneIK([0, shoulderY], targetR, boneLen, boneLen, 1);

  ctx.beginPath();
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(ikL[1][0], ikL[1][1]);
  ctx.lineTo(ikL[2][0], ikL[2][1]);
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(ikR[1][0], ikR[1][1]);
  ctx.lineTo(ikR[2][0], ikR[2][1]);
  ctx.stroke();

  // Legs
  if (isKneeling) {
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(-25, hipY + 30);
    ctx.lineTo(-45, hipY + 30);
    ctx.moveTo(0, hipY);
    ctx.lineTo(25, hipY + 30);
    ctx.lineTo(45, hipY + 30);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(-15, hipY + 80);
    ctx.moveTo(0, hipY);
    ctx.lineTo(15, hipY + 80);
    ctx.stroke();
  }

  ctx.restore();
}

// Draw 3D Lorenz Strange Attractor (Butterfly Chaos)
function drawLorenzAttractor(ctx, cx, cy, rot) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = '#F43F5E';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#F43F5E';
  ctx.shadowBlur = 10;

  // Render mathematical dual-lobe butterfly path
  ctx.beginPath();
  const numPts = 180;
  for (let i = 0; i < numPts; i++) {
    const a = (i / numPts) * Math.PI * 4;
    const rLobe = 130 * Math.sin(a * 0.5);
    const px = Math.cos(a + rot) * rLobe;
    const py = Math.sin(a * 2) * 55;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Glowing core
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// -------------------------------------------------------------
// RENDER LOOP (87.68s)
// -------------------------------------------------------------
for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background
  const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 80, WIDTH / 2, HEIGHT / 2, 720);
  bgGrad.addColorStop(0, '#0F172A');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Sub-scenes:
  // 1 (0 to 28s): Rainy Fifth Street, Van clips Cyclist, Panic Wrist Tap
  // 2 (28 to 48s): Delaying the Cyclist, Relief (No Crash at Intersection 1)
  // 3 (48 to 64s): Turning corner: Van crashes into City Bus! Kneeling in Shock
  // 4 (64 to 87.68s): Lorenz Strange Attractor (Chaos Butterfly), Exhausted Magi, Ocean Wave

  if (t < 28.0) {
    // SCENE 1: RAINY STREET & CYCLIST ACCIDENT
    // Rain particles
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.5;
    for (let r = 0; r < 40; r++) {
      const rx = (r * 37 + frame * 12) % WIDTH;
      const ry = (r * 47 + frame * 22) % HEIGHT;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + 16);
      ctx.stroke();
    }

    // Wet Asphalt Road
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 480, WIDTH, 240);

    // Traffic Signal on left: RED
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(100, 180, 45, 110);
    ctx.fillStyle = '#EF4444';
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(122, 210, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Delivery Van rushing through red light
    const vanT = clamp((t - 6.0) / 7.0);
    const vanX = lerp(-250, 680, ease(vanT));
    ctx.fillStyle = '#E2E8F0';
    ctx.roundRect(vanX, 420, 220, 100, 10);
    ctx.fill();
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(vanX + 20, 450, 180, 25);
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(vanX + 45, 520, 16, 0, Math.PI * 2);
    ctx.arc(vanX + 175, 520, 16, 0, Math.PI * 2);
    ctx.fill();

    // Cyclist
    const cyclistX = 820;
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    // Wheels
    ctx.beginPath();
    ctx.arc(cyclistX - 35, 520, 20, 0, Math.PI * 2);
    ctx.arc(cyclistX + 35, 520, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Magi on sidewalk screaming / tapping wrists at t >= 17.0
    let wristTap = 0;
    if (t >= 17.5 && t <= 19.5) {
      wristTap = Math.sin((t * 8) % Math.PI);
    }

    drawMagi(ctx, 360, 480, {
      scale: 1.2,
      expression: t > 12.0 ? 'shocked' : 'normal',
      wristTap,
      armTargetL: [-40, -40],
      armTargetR: [40, -40]
    });

  } else if (t >= 28.0 && t < 48.0) {
    // SCENE 2: DELAYING THE CYCLIST BY 30 SECONDS
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('2:10 PM: INTERVENING BEFORE THE CRASH', WIDTH / 2, 80);

    // Magi holding umbrella and asking cyclist for directions
    drawMagi(ctx, 420, 480, {
      scale: 1.25,
      expression: 'normal',
      facing: 1,
      armTargetR: [45, -20], // points questioning
      armTargetL: [-30, -50] // holds umbrella
    });

    // Umbrella
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(380, 310, 45, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(380, 310);
    ctx.lineTo(380, 370);
    ctx.stroke();

    // Cyclist stopped, pointing down street
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(640, 480);
    ctx.lineTo(640, 400); // torso
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(640, 375, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Arm pointing down street
    ctx.beginPath();
    ctx.moveTo(640, 415);
    ctx.lineTo(720, 400);
    ctx.stroke();

    // Delivery van speeds past in background unharmed
    const speedX = lerp(-200, 1400, (t - 28.0) / 10.0);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.4)';
    ctx.fillRect(speedX, 220, 160, 70);

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 22px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('NO CRASH! YOU SAVED HIM.', WIDTH / 2, 580);

  } else if (t >= 48.0 && t < 64.0) {
    // SCENE 3: THE CORNER · BUS CRASH DISASTER
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('UNTIL YOU TURN THE CORNER...', WIDTH / 2, 80);

    // City Bus crashed
    ctx.fillStyle = '#1D4ED8';
    ctx.roundRect(460, 340, 360, 160, 16);
    ctx.fill();
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Smashed Van against Bus
    ctx.fillStyle = '#E2E8F0';
    ctx.roundRect(360, 400, 160, 100, 8);
    ctx.fill();

    // Smoke particles
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    for (let sm = 0; sm < 8; sm++) {
      const smX = 460 + Math.sin(frame * 0.1 + sm) * 25;
      const smY = 320 - sm * 15;
      ctx.beginPath();
      ctx.arc(smX, smY, 16 + sm * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Emergency Flashing Beacon
    const flash = Math.sin(frame * 0.8) > 0;
    ctx.fillStyle = flash ? '#EF4444' : '#3B82F6';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(640, 330, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Magi Kneeling on sidewalk in complete horror
    drawMagi(ctx, 220, 480, {
      scale: 1.25,
      isKneeling: true,
      expression: 'shocked',
      armTargetL: [-25, 20],
      armTargetR: [25, 20]
    });

  } else {
    // SCENE 4: LORENZ ATTRACTOR (CHAOS BUTTERFLY) & EXHAUSTED JANITOR
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('EDWARD LORENZ CHAOS THEORY: THE BUTTERFLY EFFECT', WIDTH / 2, 80);

    // 3D Strange Attractor Rotating
    const rot = frame * 0.03;
    drawLorenzAttractor(ctx, 420, 340, rot);

    // Exhausted Magi holding a mop
    drawMagi(ctx, 940, 480, {
      scale: 1.3,
      expression: 'exhausted',
      armTargetR: [25, 20],
      armTargetL: [-25, 20]
    });

    // Mop stick
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(965, 340);
    ctx.lineTo(965, 560);
    ctx.stroke();
    // Mop head
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(945, 550, 40, 20);

    // Insight card
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 21px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('Eliminating friction in one spot displaces energy somewhere else.', 860, 220);
    ctx.fillStyle = '#F43F5E';
    ctx.font = 'bold 22px NotoSans';
    ctx.fillText('LIVED TUESDAY 19 TIMES.', 860, 260);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '19px NotoSans';
    ctx.fillText('"You are just a frantic janitor trying to mop the ocean."', 860, 300);
  }

  // Top Header
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 22px CaveatHand';
  ctx.textAlign = 'center';
  ctx.fillText('What If You Had a Real-Life Save Point? (Part 4: The Butterfly Trap)', WIDTH / 2, 35);

  // Bottom Subtitle Caption Pill
  const currentCaption = getCaption(t);
  if (currentCaption) {
    ctx.font = 'bold 20px CaveatHand';
    const textWidth = ctx.measureText(currentCaption).width;
    const pillW = Math.min(WIDTH - 120, textWidth + 48);
    const pillH = 44;
    const pillX = (WIDTH - pillW) / 2;
    const pillY = HEIGHT - 68;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 22);
    ctx.fill();

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentCaption, WIDTH / 2, pillY + pillH / 2);
  }

  const pngBuffer = canvas.toBuffer('image/png');
  ffmpegVideo.stdin.write(pngBuffer);

  if (frame % 150 === 0) {
    console.log(`Act 4 Progress: ${(frame / TOTAL_FRAMES * 100).toFixed(1)}% (Frame ${frame}/${TOTAL_FRAMES}, t=${t.toFixed(1)}s)`);
  }
}

ffmpegVideo.stdin.end();
await once(ffmpegVideo, 'close');

console.log(`\n🎉 Act 4 Butterfly Chaos Masterpiece rendered successfully: ${OUTPUT_FILE}`);

