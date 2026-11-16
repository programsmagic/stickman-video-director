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
  blinkState,
  idleBreath,
  drawGroundShadow
} from '../../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1920, HEIGHT = 1080, FPS = 30;
const VOICE = path.resolve('projects/ep16-post-training-alignment/build/narration/act4.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP16-Act4-PPO-KLElectricFence-1080p.mp4');
const SFX_FILE = '/tmp/ep16_act4_sfx.wav';
const MIX_FILE = '/tmp/ep16_act4_mix.wav';

console.log(`=== EP16 ACT 4: PPO & THE KL DIVERGENCE ELECTRIC FENCE ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 71829;
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

  // High-voltage electric fence hum (60 Hz buzz with harmonic resonance)
  addStereo(1.0, dur - 2.0,
    (t) => (Math.sin(2 * Math.PI * 60 * t) + 0.3 * Math.sin(2 * Math.PI * 180 * t) + noise() * 0.04) * 0.15,
    (t) => (Math.sin(2 * Math.PI * 60.5 * t) + 0.3 * Math.sin(2 * Math.PI * 181 * t) + noise() * 0.04) * 0.15,
    0.22
  );

  // Galloping hooves on obstacle track (t = 2.0 to 18.0)
  for (let s = 2.5; s < 18.0; s += 0.45) {
    addStereo(s, 0.12,
      (t) => (noise() * 0.5 + Math.sin(2 * Math.PI * 90 * t) * 0.5) * Math.exp(-t * 28),
      (t) => (noise() * 0.5 + Math.sin(2 * Math.PI * 85 * t) * 0.5) * Math.exp(-t * 28),
      0.28
    );
  }

  // Reward points ding at t = 10.0s
  addStereo(10.0, 1.2,
    (t) => Math.sin(2 * Math.PI * 1046 * t) * Math.exp(-t * 5),
    (t) => Math.sin(2 * Math.PI * 1052 * t) * Math.exp(-t * 5),
    0.45
  );

  // Reward hacking alarm at t = 22.0s (sycophancy glitch)
  addStereo(22.0, 2.5,
    (t) => Math.sin(2 * Math.PI * (880 + 200 * Math.sin(t * 12)) * t) * 0.3,
    (t) => Math.sin(2 * Math.PI * (885 + 200 * Math.sin(t * 12)) * t) * 0.3,
    0.40
  );

  // Electric arc / lightning snap BZZZT at t = 32.5s (KL penalty shock)
  addStereo(32.5, 1.8,
    (t) => (noise() * 0.85 + Math.sin(2 * Math.PI * 340 * t) * 0.4) * Math.exp(-t * 3.5),
    (t) => (noise() * 0.85 + Math.sin(2 * Math.PI * 350 * t) * 0.4) * Math.exp(-t * 3.5),
    0.65
  );

  // Voltage dissipation & safe calibration tone at t = 45.0s
  addStereo(45.0, 3.0,
    (t) => Math.sin(2 * Math.PI * (440 + t * 40) * t) * Math.exp(-t * 1.5),
    (t) => Math.sin(2 * Math.PI * (444 + t * 40) * t) * Math.exp(-t * 1.5),
    0.35
  );

  // WAV header
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);

  const s16 = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    s16[i * 2] = Math.max(-32767, Math.min(32767, Math.round(left[i] * 32767)));
    s16[i * 2 + 1] = Math.max(-32767, Math.min(32767, Math.round(right[i] * 32767)));
  }
  Buffer.from(s16.buffer).copy(buf, 44);
  fs.writeFileSync(SFX_FILE, buf);

  execSync(`ffmpeg -v error -y -i "${VOICE}" -i "${SFX_FILE}" -filter_complex "[0:a]volume=1.0[v0];[1:a]volume=0.45[v1];[v0][v1]amix=inputs=2:duration=first:dropout_transition=2" -ar 48000 -c:a pcm_s16le "${MIX_FILE}"`);
  console.log(`  ✅ Mixed audio track complete: ${MIX_FILE}`);
}

// 2. VIDEO RENDERING ENGINE (Native 1080p @ 30fps)
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'rawvideo',
  '-pix_fmt', 'rgba',
  '-s', `${WIDTH}x${HEIGHT}`,
  '-r', `${FPS}`,
  '-i', '-',
  '-i', MIX_FILE,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '16',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-shortest',
  OUTPUT
]);

ffmpeg.stderr.on('data', (d) => {
  const msg = d.toString();
  if (msg.includes('Error') || msg.includes('Invalid') || msg.includes('failed')) {
    console.error('FFMPEG ERROR:', msg);
  }
});
ffmpeg.on('error', (err) => console.error('FFMPEG PROCESS ERROR:', err));
ffmpeg.stdin.on('error', (err) => console.error('FFMPEG STDIN ERROR:', err));

// Helper function to draw digital cyber stallion
function drawCyberStallion(ctx, x, y, scale = 1.0, runPhase = 0, glowColor = '#10b981', shockIntensity = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Electric shock jitter
  if (shockIntensity > 0) {
    const jx = (Math.random() - 0.5) * 16 * shockIntensity;
    const jy = (Math.random() - 0.5) * 16 * shockIntensity;
    ctx.translate(jx, jy);
  }

  // Torso
  ctx.fillStyle = shockIntensity > 0.5 ? 'rgba(217, 70, 239, 0.25)' : 'rgba(16, 185, 129, 0.15)';
  ctx.strokeStyle = shockIntensity > 0.5 ? '#f43f5e' : glowColor;
  ctx.lineWidth = 4.5;

  ctx.beginPath();
  ctx.ellipse(0, -60, 95, 45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Neck & Head
  const headBob = Math.sin(runPhase * 2) * 8;
  ctx.beginPath();
  ctx.moveTo(70, -75);
  ctx.lineTo(120, -130 + headBob);
  ctx.lineTo(155, -110 + headBob);
  ctx.lineTo(135, -80 + headBob);
  ctx.lineTo(85, -50);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Snout eye
  ctx.fillStyle = shockIntensity > 0.5 ? '#ffffff' : '#38bdf8';
  ctx.beginPath();
  ctx.arc(130, -112 + headBob, 5, 0, Math.PI * 2);
  ctx.fill();

  // Running Legs with sinusoidal galloping motion
  const legSwing1 = Math.sin(runPhase) * 35;
  const legSwing2 = Math.cos(runPhase) * 35;

  // Front legs
  ctx.beginPath();
  ctx.moveTo(65, -30);
  ctx.lineTo(75 + legSwing1, 30);
  ctx.lineTo(85 + legSwing1 * 1.3, 85);
  ctx.moveTo(50, -30);
  ctx.lineTo(60 - legSwing1, 30);
  ctx.lineTo(70 - legSwing1 * 1.3, 85);
  // Back legs
  ctx.moveTo(-60, -30);
  ctx.lineTo(-70 + legSwing2, 30);
  ctx.lineTo(-80 + legSwing2 * 1.3, 85);
  ctx.moveTo(-75, -30);
  ctx.lineTo(-85 - legSwing2, 30);
  ctx.lineTo(-95 - legSwing2 * 1.3, 85);
  ctx.stroke();

  // Particle flowing mane / cyber stream
  ctx.strokeStyle = shockIntensity > 0.5 ? '#ec4899' : '#34d399';
  ctx.lineWidth = 2.5;
  for (let m = 0; m < 5; m++) {
    const mx = 70 - m * 15;
    const my = -85 - m * 8 + headBob * 0.7;
    const wave = Math.sin(runPhase * 3 + m) * 12;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(mx - 30, my - 20 + wave, mx - 60, my - 5 + wave);
    ctx.stroke();
  }

  ctx.restore();
}

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background: Deep Cyber Training Arena
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(0.5, '#0a0f24');
  bg.addColorStop(1, '#02040f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor perspective grid
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
  ctx.lineWidth = 1.5;
  const horizonY = 560;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.2, horizonY);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = horizonY; y <= HEIGHT; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // 1. PURPLE KL DIVERGENCE ELECTRIC FENCE (humming neon posts & electric plasma arcs)
  const fenceX = 1150;
  const fenceTop = 260, fenceBottom = 820;

  // Glow halo for electric fence
  const fenceGlow = ctx.createLinearGradient(fenceX - 120, 0, fenceX + 120, 0);
  fenceGlow.addColorStop(0, 'rgba(168, 85, 247, 0)');
  fenceGlow.addColorStop(0.5, 'rgba(192, 132, 252, 0.18)');
  fenceGlow.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = fenceGlow;
  ctx.fillRect(fenceX - 120, fenceTop, 240, fenceBottom - fenceTop + 60);

  // Vertical Posts
  for (const postX of [fenceX - 60, fenceX + 60]) {
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.fillRect(postX - 12, fenceTop, 24, fenceBottom - fenceTop);
    ctx.strokeRect(postX - 12, fenceTop, 24, fenceBottom - fenceTop);

    // Neon insulators
    for (let iy = fenceTop + 60; iy < fenceBottom; iy += 110) {
      ctx.fillStyle = '#d946ef';
      ctx.beginPath();
      ctx.arc(postX, iy, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Horizontal high-voltage electric wires with animated sinusoidal plasma arcs
  for (let wy = fenceTop + 60; wy < fenceBottom; wy += 110) {
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(fenceX - 80, wy);
    for (let x = fenceX - 80; x <= fenceX + 80; x += 10) {
      const arc = Math.sin(t * 18 + x * 0.15 + wy) * 6;
      ctx.lineTo(x, wy + arc);
    }
    ctx.stroke();
  }

  // Dynamic lightning spark tendrils bursting across the fence
  if (Math.random() > 0.4 || (t >= 31.0 && t <= 36.0)) {
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let sx = fenceX - 50 + (Math.random() - 0.5) * 30;
    let sy = fenceTop + 100 + Math.random() * (fenceBottom - fenceTop - 200);
    ctx.moveTo(sx, sy);
    for (let k = 0; k < 6; k++) {
      sx += (Math.random() - 0.5) * 50;
      sy += (Math.random() - 0.5) * 50;
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  // Fence Warning Sign
  ctx.save();
  ctx.translate(fenceX, fenceTop - 45);
  ctx.fillStyle = 'rgba(88, 28, 135, 0.9)';
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-150, -25, 300, 50, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ KL DIVERGENCE BOUNDARY ⚡', 0, 8);
  ctx.restore();

  // 2. STALLION ANIMATION & REWARD HUNTING
  // Phased behavior:
  // t: 0-20s normal galloping towards reward points
  // t: 20-31s reward hacking (sycophancy / flattery loop) lunging right
  // t: 31-38s shock at KL fence, sparks flying, knocked back
  // t: 38-end grounded safe alignment, balanced trot
  let horseX = 520;
  let horseY = 740;
  let shock = 0;
  let horseGlow = '#10b981';

  if (t < 20.0) {
    horseX = 420 + Math.sin(t * 1.5) * 90;
  } else if (t >= 20.0 && t < 31.5) {
    // Lunging forward towards the hacked points
    const p = (t - 20.0) / 11.5;
    horseX = 510 + p * 520; // Reaches ~1030 near fence
    horseGlow = '#f59e0b';
  } else if (t >= 31.5 && t < 36.5) {
    // Shock impact
    shock = 1.0 - (t - 31.5) / 5.0;
    horseX = 1010 - (t - 31.5) * 110; // Knocked back to ~460
    horseGlow = '#f43f5e';
  } else {
    // Safe balanced trot
    horseX = 490 + Math.sin(t * 1.2) * 40;
    horseGlow = '#38bdf8';
  }

  const runPhase = t * 14;
  drawGroundShadow(ctx, horseX, horseY + 80, 160, 24);
  drawCyberStallion(ctx, horseX, horseY, 1.15, runPhase, horseGlow, shock);

  // 3. FLOATING REWARD & PENALTY HUD
  // Left: PPO Objective Formula Box
  ctx.save();
  ctx.translate(100, 120);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, 720, 160, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PROXIMAL POLICY OPTIMIZATION (PPO) WITH KL PENALTY', 25, 35);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px NotoSans, sans-serif';
  ctx.fillText('obj(θ) = E [ R(x, y) - β · D_KL ( π_θ || π_ref ) ]', 25, 75);

  // Dynamic breakdown gauges
  ctx.font = '16px NotoSans, sans-serif';
  ctx.fillStyle = '#10b981';
  ctx.fillText('▲ Reward Model Score: +8.4 pts', 25, 115);

  ctx.fillStyle = t >= 31.0 ? '#f43f5e' : '#c084fc';
  const klVal = t < 20 ? '0.12' : (t < 32 ? '4.85 (CRITICAL SPIKE)' : '0.18 (STABILIZED)');
  ctx.fillText(`⚡ KL Divergence Drift: ${klVal}`, 25, 142);
  ctx.restore();

  // Floating Reward Orbs in Arena
  if (t < 31.0) {
    // Normal reward orbs
    ctx.save();
    ctx.translate(780, 520);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, Math.sin(t * 3) * 10, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+10 pts', 0, Math.sin(t * 3) * 10 + 7);
    ctx.restore();
  }

  // Reward Hacking Flattery Bubble at t >= 18.0s
  if (t >= 18.0 && t < 34.0) {
    ctx.save();
    ctx.translate(horseX + 110, horseY - 140);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(0, 0, 310, 85, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🚨 REWARD HACKING DETECTED:', 15, 28);
    ctx.font = 'italic 15px NotoSans, sans-serif';
    ctx.fillText('"You are so brilliant! 100% correct!"', 15, 52);
    ctx.font = 'bold 15px NotoSans, sans-serif';
    ctx.fillStyle = '#b91c1c';
    ctx.fillText('Fake Score: +999 pts ⚠️', 15, 74);
    ctx.restore();
  }

  // Shock Slashing HUD at t >= 31.5s
  if (t >= 31.5 && t < 42.0) {
    ctx.save();
    ctx.translate(1150, 420);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.95)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-140, -45, 280, 90, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ KL PENALTY ⚡', 0, -10);
    ctx.font = 'bold 28px NotoSans, sans-serif';
    ctx.fillText('-950 POINTS!', 0, 26);
    ctx.restore();
  }

  // 4. STICKMAN MAGI (On Trainer Platform at bottom left)
  const magiX = 220, magiY = 720;
  drawGroundShadow(ctx, magiX, magiY, 70);

  const breath = Math.sin(t * 2.5) * 2.0;

  const figure = {
    head: { x: magiX, y: 390 + breath, radius: 34, tilt: t >= 31.0 ? -0.15 : 0.05 },
    body: {
      spine: [
        { x: magiX, y: 424 + breath },
        { x: magiX + 2, y: 485 + breath * 0.8 },
        { x: magiX + 4, y: 550 }
      ],
      width: 6
    },
    leftArm: {
      ik: {
        target: { x: magiX - 45, y: 530 },
        pole: { x: magiX - 35, y: 470 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: magiX + 75, y: 490 }, // Holding remote
        pole: { x: magiX + 45, y: 470 }
      },
      upperLength: 68,
      lowerLength: 72
    },
    leftLeg: {
      ik: {
        target: { x: magiX + 35, y: magiY },
        pole: { x: magiX + 45, y: 630 }
      },
      upperLength: 85,
      lowerLength: 88
    },
    rightLeg: {
      ik: {
        target: { x: magiX - 35, y: magiY },
        pole: { x: magiX - 25, y: 630 }
      },
      upperLength: 85,
      lowerLength: 88
    },
    accessories: [
      { type: 'glasses', color: '#f59e0b', scale: 1.15 }
    ]
  };

  drawFigure(ctx, figure, {
    color: '#ffffff',
    lineWidth: 5.5,
    fillColor: 'rgba(255,255,255,0.06)'
  });

  // Trainer Remote Controller in Hand
  ctx.save();
  ctx.translate(magiX + 75, 490);
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-10, -22, 55, 45, 8);
  ctx.fill();
  ctx.stroke();

  // Dial knob
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.arc(18, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(18 + Math.cos(t * 2) * 10, Math.sin(t * 2) * 10);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px NotoSans, sans-serif';
  ctx.fillText('β = 0.05', -6, 34);
  ctx.restore();

  // Top Master Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 720, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#c084fc';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 10 • PROXIMAL POLICY OPTIMIZATION & KL ELECTRIC FENCE', 105, 74);

  // Raw bytes write
  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (frame % 150 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`  Frame ${frame}/${TOTAL_FRAMES} (${((frame / TOTAL_FRAMES) * 100).toFixed(1)}%) rendered`);
  }
}

ffmpeg.stdin.end();

await new Promise((resolve, reject) => {
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      console.log(`\n🎉 ACT 4 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
