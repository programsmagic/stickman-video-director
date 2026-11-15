import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require(
  path.resolve('skills/directing-stickman-videos/node_modules/@napi-rs/canvas')
);
import {
  drawFigure,
  COLORS,
  INK,
  solve2BoneIK,
  spring,
  blinkState,
  idleBreath,
  drawGroundShadow
} from '../../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1920, HEIGHT = 1080, FPS = 30;
const VOICE = path.resolve('projects/ep10-geometry-of-thinking/build/narration/act4.wav');

// Wait if voice is still synthesizing
while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP10-Act4-BackpropPulleys-1080p.mp4');
const SFX_FILE = '/tmp/ep10_act4_sfx.wav';
const MIX_FILE = '/tmp/ep10_act4_mix.wav';

console.log(`=== EP10 ACT 4: BACKPROPAGATION & THE PULLEY SYSTEM ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 71923;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };

  const addStereo = (t0, len, fnL, fnR, gain = 0.3) => {
    const i0 = Math.round(t0 * rate);
    const cnt = Math.min(n - i0, Math.round(len * rate));
    for (let i = 0; i < cnt; i++) {
      if (i0 + i >= 0 && i0 + i < n) {
        const t = i / rate;
        left[i0 + i] += fnL(t) * gain;
        right[i0 + i] += fnR(t) * gain;
      }
    }
  };

  // Atmospheric machine hum
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const hum = Math.sin(2 * Math.PI * 55 * t) * 0.02 + Math.sin(2 * Math.PI * 110 * t) * 0.01;
    left[i] += hum;
    right[i] += hum;
  }

  // Cable tension snap at t = 3.0s
  addStereo(3.0, 0.45,
    (t) => Math.sin(2 * Math.PI * 440 * Math.exp(-t * 8) * t) * Math.exp(-t * 7) + noise() * Math.exp(-t * 15) * 0.5,
    (t) => Math.sin(2 * Math.PI * 450 * Math.exp(-t * 8) * t) * Math.exp(-t * 7) + noise() * Math.exp(-t * 15) * 0.5,
    0.45
  );

  // Shockwave gear ratchets from right to left (t = 8.0s to 32.0s periodic clicks)
  for (let c = 0; c < 18; c++) {
    const tc = 8.0 + c * 1.5;
    const pan = 1.0 - (c / 18.0) * 1.5; // moves from right (pan > 0) to left (pan < 0)
    const panL = Math.max(0.1, 1 - pan);
    const panR = Math.max(0.1, 1 + pan);
    addStereo(tc, 0.08,
      (t) => (Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 40) + noise() * 0.3 * Math.exp(-t * 30)) * panL,
      (t) => (Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 40) + noise() * 0.3 * Math.exp(-t * 30)) * panR,
      0.28
    );
  }

  // Dial turn clicks
  for (let k = 0; k < 6; k++) {
    addStereo(33.0 + k * 1.2, 0.12,
      (t) => Math.sin(2 * Math.PI * (800 + k * 80) * t) * Math.exp(-t * 30),
      (t) => Math.sin(2 * Math.PI * (810 + k * 80) * t) * Math.exp(-t * 30),
      0.35
    );
  }

  const s16 = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    s16[i * 2] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)));
    s16[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)));
  }
  const buf = Buffer.alloc(44 + s16.byteLength);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + s16.byteLength, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(s16.byteLength, 40);
  Buffer.from(s16.buffer).copy(buf, 44);
  fs.writeFileSync(SFX_FILE, buf);

  // Mix SFX with Gemini Bodi narration
  execSync(`ffmpeg -v error -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v0];[1:a]volume=0.45[v1];[v0][v1]amix=inputs=2:duration=first:dropout_transition=2" -ar 48000 -c:a pcm_s16le "${MIX_FILE}"`);
  console.log(`  ✅ Mixed audio track complete: ${MIX_FILE}`);
}

// 2. FFmpeg Native 1080p Pipeline
console.log('• Launching 1080p FFmpeg encoding pipeline...');
const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'rawvideo',
  '-vcodec', 'rawvideo',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-pix_fmt', 'rgba',
  '-r', `${FPS}`,
  '-i', '-',
  '-i', MIX_FILE,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '16',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '320k',
  '-shortest',
  OUTPUT
], { stdio: ['pipe', 'inherit', 'inherit'] });

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Pulley tiers definitions
const TIERS = [
  { name: 'Layer 1: Input Features', x: 420, y: 540, r: 60, dialVal: -0.42 },
  { name: 'Layer 2: Hidden State A', x: 740, y: 460, r: 75, dialVal: 1.15 },
  { name: 'Layer 3: Hidden State B', x: 1060, y: 560, r: 65, dialVal: -0.88 },
  { name: 'Layer 4: Output Logits', x: 1380, y: 480, r: 85, dialVal: 2.34 }
];

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Deep Industrial Blueprint Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#0a0f1d');
  grad.addColorStop(0.5, '#0d1527');
  grad.addColorStop(1, '#050811');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Technical blueprint grid
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

  // Title Card HUD
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('ACT IV: THE PULLEY SYSTEM OF BACKPROPAGATION', 100, 90);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '22px NotoSans';
  ctx.fillText('Rumelhart, Hinton & Williams (1986) · Mathematical Chain Rule via Counterweights', 100, 126);

  // Target disc and Error snap at output
  const targetX = 1680, targetY = 480;
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(targetX, targetY, 45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 18px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('TARGET y', targetX, targetY - 55);

  // Actual prediction arrow
  const predX = 1620, predY = 380;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(1380 + 85, 480);
  ctx.lineTo(predX, predY);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.fillText('PREDICTION ŷ', predX + 10, predY - 15);

  // Loss error vector delta
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(predX, predY);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 16px NotoSans';
  ctx.fillText('LOSS ERROR: δ = (ŷ - y)', (predX + targetX) / 2, (predY + targetY) / 2 - 15);

  // Connecting cables between pulleys
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(TIERS[0].x, TIERS[0].y - TIERS[0].r);
  for (let i = 1; i < TIERS.length; i++) {
    const prev = TIERS[i - 1];
    const curr = TIERS[i];
    ctx.lineTo(curr.x, curr.y - curr.r);
  }
  ctx.stroke();

  // Reverse error shockwave (travels right to left periodically)
  const waveCycle = (t * 0.4) % 1.0;
  const waveX = 1450 - waveCycle * (1450 - 350);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 8;
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(Math.min(1450, waveX + 60), 500);
  ctx.lineTo(Math.max(350, waveX - 60), 500);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Draw Pulleys & Weight Dials
  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i];
    const spin = (t * 0.8 * (i % 2 === 0 ? 1 : -1));

    // Pulley wheel rim
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(tier.x, tier.y, tier.r, 0, Math.PI * 2);
    ctx.stroke();

    // Wheel spokes
    ctx.lineWidth = 2;
    for (let s = 0; s < 6; s++) {
      const ang = spin + (s * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(tier.x, tier.y);
      ctx.lineTo(tier.x + Math.cos(ang) * tier.r, tier.y + Math.sin(ang) * tier.r);
      ctx.stroke();
    }

    // Dial gauge center
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(tier.x, tier.y, tier.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dial needle
    const needleAng = spin * 1.5;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tier.x, tier.y);
    ctx.lineTo(tier.x + Math.cos(needleAng) * (tier.r * 0.5), tier.y + Math.sin(needleAng) * (tier.r * 0.5));
    ctx.stroke();

    // Label & Equation
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 16px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText(tier.name, tier.x, tier.y + tier.r + 30);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '14px NotoSans';
    const chainTerms = ['∂L/∂w₁', '∂L/∂w₂', '∂L/∂w₃', '∂L/∂w₄'];
    ctx.fillText(chainTerms[i] + ' = δ · a', tier.x, tier.y + tier.r + 55);
  }

  // Formula Banner HUD
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(400, 780, 1120, 90, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 26px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE CHAIN RULE:  ∂L / ∂wᵢ = (∂L / ∂y) · (∂y / ∂hₙ) ··· (∂h₁ / ∂wᵢ)', 960, 835);

  // Magi on observation platform
  const magiX = 220, magiGroundY = 820;
  drawGroundShadow(ctx, magiX, magiGroundY, 45, 12, 0.4);

  const breath = idleBreath(t, 16);
  const blink = blinkState(t, 2981);

  // Posing Magi holding brass calibration wrench
  const hipY = magiGroundY - 80 + breath.hipYDelta;
  const torsoY = hipY - 60 + breath.torsoDelta;
  const headY = torsoY - 45;

  // Head & Eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(magiX, headY, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Wizard Hat
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.moveTo(magiX - 25, headY - 10);
  ctx.lineTo(magiX + 25, headY - 10);
  ctx.lineTo(magiX + 5, headY - 60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Scarf
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.ellipse(magiX, headY + 16, 18, 9, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (blinking)
  if (!blink) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(magiX + 6, headY - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(magiX + 3, headY - 2);
    ctx.lineTo(magiX + 9, headY - 2);
    ctx.stroke();
  }

  // Torso
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(magiX, headY + 16);
  ctx.lineTo(magiX, hipY);
  ctx.stroke();

  // Legs standing on platform
  ctx.beginPath();
  ctx.moveTo(magiX, hipY);
  ctx.lineTo(magiX - 12, magiGroundY);
  ctx.moveTo(magiX, hipY);
  ctx.lineTo(magiX + 12, magiGroundY);
  ctx.stroke();

  // Left arm resting, Right arm holding wrench towards gears
  const wrenchTargetX = magiX + 95;
  const wrenchTargetY = torsoY - 30 + Math.sin(t * 3) * 8;
  const rArm = solve2BoneIK([magiX, torsoY], [wrenchTargetX, wrenchTargetY], 45, 45, -1);

  ctx.beginPath();
  ctx.moveTo(magiX, torsoY);
  ctx.lineTo(rArm[1][0], rArm[1][1]);
  ctx.lineTo(wrenchTargetX, wrenchTargetY);
  ctx.stroke();

  // Wrench prop
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(wrenchTargetX, wrenchTargetY);
  ctx.lineTo(wrenchTargetX + 25, wrenchTargetY - 15);
  ctx.stroke();

  // Stream raw RGBA bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 4 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 4 1080p Render Complete! Output: ${OUTPUT}`);
