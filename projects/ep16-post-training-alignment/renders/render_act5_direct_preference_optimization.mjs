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
const VOICE = path.resolve('projects/ep16-post-training-alignment/build/narration/act5.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP16-Act5-DirectPreferenceOptimization-1080p.mp4');
const SFX_FILE = '/tmp/ep16_act5_sfx.wav';
const MIX_FILE = '/tmp/ep16_act5_mix.wav';

console.log(`=== EP16 ACT 5: DIRECT PREFERENCE OPTIMIZATION (DPO) ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 48291;
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

  // Clunky 4-model GPU machine hum and steam pressure (t = 0.5 to 22.0)
  addStereo(0.5, 21.5,
    (t) => (Math.sin(2 * Math.PI * 85 * t) + noise() * 0.12) * 0.25,
    (t) => (Math.sin(2 * Math.PI * 88 * t) + noise() * 0.12) * 0.25,
    0.35
  );

  // Wrench metallic ratchet sound at t = 21.0s
  for (let r = 0; r < 4; r++) {
    addStereo(21.0 + r * 0.3, 0.15,
      (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 1800 * t) * 0.5) * Math.exp(-t * 30),
      (t) => (noise() * 0.7 + Math.sin(2 * Math.PI * 1820 * t) * 0.5) * Math.exp(-t * 30),
      0.40
    );
  }

  // Machine dismantling whoosh / dissolution at t = 24.5s
  addStereo(24.5, 2.5,
    (t) => (noise() * 0.5 + Math.sin(2 * Math.PI * (400 - t * 120) * t)) * Math.exp(-t * 1.5),
    (t) => (noise() * 0.5 + Math.sin(2 * Math.PI * (410 - t * 120) * t)) * Math.exp(-t * 1.5),
    0.45
  );

  // Pure golden tuning fork crystal chime at t = 28.0s (Rafailov et al. DPO discovery)
  addStereo(28.0, 5.0,
    (t) => Math.sin(2 * Math.PI * 1046.5 * t) * Math.exp(-t * 1.2),
    (t) => Math.sin(2 * Math.PI * 1050.0 * t) * Math.exp(-t * 1.2),
    0.65
  );

  // High-efficiency modern resonance hum (t = 34.0 to end)
  addStereo(34.0, dur - 34.5,
    (t) => Math.sin(2 * Math.PI * 528 * t) * 0.15,
    (t) => Math.sin(2 * Math.PI * 531 * t) * 0.15,
    0.30
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

ffmpeg.stderr.on('data', () => {});

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background: Quantum Lab Cyan/Slate
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.5, '#0b1329');
  bg.addColorStop(1, '#020510');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Modern floor grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.25, 580);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 580; y <= HEIGHT; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // 1. COMPLEX 4-MODEL PPO APPARATUS (t: 0 to 25s) vs SLEEK DPO (t: 26s to end)
  const dismantleProgress = Math.max(0, Math.min(1, (t - 22.0) / 4.0));

  if (dismantleProgress < 1.0) {
    ctx.save();
    ctx.globalAlpha = 1.0 - dismantleProgress;

    // Draw the 4 Clunky GPU Memory Blocks
    const models = [
      { name: '1. Policy Model π_θ', color: '#38bdf8', x: 800, y: 320, vram: '80 GB VRAM' },
      { name: '2. Reference Model π_ref', color: '#94a3b8', x: 1200, y: 320, vram: '80 GB VRAM' },
      { name: '3. Reward Model r_ϕ', color: '#10b981', x: 800, y: 560, vram: '80 GB VRAM' },
      { name: '4. Value Critic V_ψ', color: '#f59e0b', x: 1200, y: 560, vram: '80 GB VRAM' }
    ];

    // Heavy connecting conduits and pipes
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(800 + 150, 320 + 60);
    ctx.lineTo(1200, 320 + 60);
    ctx.moveTo(800 + 150, 560 + 60);
    ctx.lineTo(1200, 560 + 60);
    ctx.moveTo(800 + 75, 320 + 120);
    ctx.lineTo(800 + 75, 560);
    ctx.moveTo(1200 + 75, 320 + 120);
    ctx.lineTo(1200 + 75, 560);
    ctx.stroke();

    for (const m of models) {
      drawGroundShadow(ctx, m.x + 75, 760, 160, 20);

      // Chassis
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(m.x, m.y, 240, 130, 12);
      ctx.fill();
      ctx.stroke();

      // Flashing server status LEDs
      for (let l = 0; l < 4; l++) {
        ctx.fillStyle = (Math.sin(t * 8 + l) > 0) ? '#22c55e' : '#ef4444';
        ctx.beginPath();
        ctx.arc(m.x + 25 + l * 20, m.y + 30, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px NotoSans, sans-serif';
      ctx.fillText(m.name, m.x + 20, m.y + 70);

      ctx.fillStyle = '#f43f5e';
      ctx.font = '14px NotoSans, sans-serif';
      ctx.fillText(`🚨 ${m.vram}`, m.x + 20, m.y + 100);
    }

    // Top Overhead Warning Sign
    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(880, 210, 280, 55, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ 320 GB VRAM OCCUPIED', 1020, 245);

    ctx.restore();
  }

  // 2. GOLDEN DPO TUNING FORK & CLOSED-FORM ELEGANCE (t: 26s to end)
  if (dismantleProgress > 0.1) {
    const dpoAlpha = dismantleProgress;
    ctx.save();
    ctx.globalAlpha = dpoAlpha;

    // Glowing golden pedestal
    const forkX = 1100, forkY = 480;
    drawGroundShadow(ctx, forkX, 760, 240, 26);

    // Radiating resonance waves
    if (t >= 28.0) {
      for (let ring = 1; ring <= 4; ring++) {
        const ringR = ((t * 80 + ring * 60) % 260);
        const ringAlpha = (1.0 - ringR / 260) * 0.45;
        ctx.strokeStyle = `rgba(245, 158, 11, ${ringAlpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(forkX, forkY - 40, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Golden Tuning Fork
    ctx.strokeStyle = '#f59e0b';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.lineWidth = 14;

    // Stem
    ctx.beginPath();
    ctx.moveTo(forkX, forkY + 140);
    ctx.lineTo(forkX, forkY + 30);
    ctx.stroke();

    // Curved Base & Tines
    ctx.beginPath();
    ctx.arc(forkX, forkY + 30, 48, 0, Math.PI, false);
    ctx.lineTo(forkX - 48, forkY - 140);
    ctx.moveTo(forkX + 48, forkY + 30);
    ctx.lineTo(forkX + 48, forkY - 140);
    ctx.stroke();

    // Golden Orb Base
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(forkX, forkY + 155, 18, 0, Math.PI * 2);
    ctx.fill();

    // 3. CLOSED-FORM DPO FORMULA BANNER
    ctx.save();
    ctx.translate(620, 160);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(0, 0, 960, 175, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 18px NotoSans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DIRECT PREFERENCE OPTIMIZATION (STANFORD 2023 - RAFAILOV ET AL.)', 35, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px NotoSans, sans-serif';
    ctx.fillText('L_DPO(θ) = - E [ log σ ( β log (π_θ(y_w|x) / π_ref(y_w|x)) - β log (π_θ(y_l|x) / π_ref(y_l|x)) ) ]', 35, 85);

    // Advantages pills
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.fillText('✓ ZERO Reward Models', 35, 130);
    ctx.fillText('✓ ZERO Reinforcement Loops', 260, 130);
    ctx.fillText('✓ 10x Cheaper & 100% Stable', 540, 130);
    ctx.fillText('✓ Pure Cross-Entropy Loss', 785, 130);
    ctx.restore();

    // Pairwise Win / Loss Probabilities HUD
    ctx.save();
    ctx.translate(1360, 480);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(0, 0, 360, 220, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px NotoSans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DIRECT PROBABILITY SHIFT', 20, 35);

    // Preferred y_w bar
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.fillText('Preferred y_w ↑ (+82% Prob)', 20, 75);
    ctx.fillRect(20, 90, 280 * Math.min(1, 0.4 + (t - 28) * 0.05), 18);

    // Rejected y_l bar
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('Rejected y_l ↓ (-78% Prob)', 20, 150);
    ctx.fillRect(20, 165, Math.max(25, 280 - (t - 28) * 20), 18);
    ctx.restore();

    ctx.restore();
  }

  // 4. STICKMAN MAGI (holding wrench, then striking tuning fork)
  const magiX = 360, magiY = 720;
  drawGroundShadow(ctx, magiX, magiY, 70);

  const breath = Math.sin(t * 2.5) * 2.0;

  // Wrench gesture (t < 25s) vs Presentation gesture (t >= 25s)
  let handR_target = { x: magiX + 65, y: 520 };
  if (t < 25.0) {
    handR_target = { x: magiX + 65, y: 500 + Math.sin(t * 6) * 12 };
  } else {
    handR_target = { x: magiX + 85, y: 440 };
  }

  const figure = {
    head: { x: magiX, y: 390 + breath, radius: 34, tilt: t >= 25.0 ? 0.15 : -0.1 },
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
        target: handR_target,
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

  // Wrench in hand for early part
  if (t < 25.0) {
    ctx.save();
    ctx.translate(handR_target.x, handR_target.y);
    ctx.rotate(0.5);
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.fillRect(-6, -35, 12, 45);
    // Wrench head
    ctx.beginPath();
    ctx.arc(0, -35, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Top Master Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 780, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 10 • DIRECT PREFERENCE OPTIMIZATION (DPO & THE MATH SHORTCUT)', 105, 74);

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
      console.log(`\n🎉 ACT 5 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
