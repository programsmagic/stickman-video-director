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
const VOICE = path.resolve('projects/ep16-post-training-alignment/build/narration/act6.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP16-Act6-RefusalSteeringVectors-1080p.mp4');
const SFX_FILE = '/tmp/ep16_act6_sfx.wav';
const MIX_FILE = '/tmp/ep16_act6_mix.wav';

console.log(`=== EP16 ACT 6: REFUSAL STEERING VECTORS & THE ALIGNED MIND ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 92834;
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

  // Cosmic laboratory ambient synth pad
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 130.81 * t) + 0.5 * Math.sin(2 * Math.PI * 196.00 * t)) * 0.14,
    (t) => (Math.sin(2 * Math.PI * 131.20 * t) + 0.5 * Math.sin(2 * Math.PI * 196.40 * t)) * 0.14,
    0.28
  );

  // Victorian schoolmaster ruler slap at t = 10.0s
  addStereo(10.0, 0.4,
    (t) => (noise() * 0.8 + Math.sin(2 * Math.PI * 450 * t)) * Math.exp(-t * 22),
    (t) => (noise() * 0.8 + Math.sin(2 * Math.PI * 460 * t)) * Math.exp(-t * 22),
    0.45
  );

  // Magnetic compass needle click at t = 24.0s
  addStereo(24.0, 0.6,
    (t) => Math.sin(2 * Math.PI * 1760 * t) * Math.exp(-t * 15),
    (t) => Math.sin(2 * Math.PI * 1770 * t) * Math.exp(-t * 15),
    0.40
  );

  // Surgical vector steering whoosh at t = 34.0s
  addStereo(34.0, 2.0,
    (t) => Math.sin(2 * Math.PI * (500 + 400 * Math.sin(t * 3)) * t) * Math.exp(-t * 1.2),
    (t) => Math.sin(2 * Math.PI * (505 + 400 * Math.sin(t * 3)) * t) * Math.exp(-t * 1.2),
    0.35
  );

  // Grand finale triumphant bell chimes (t = 44.0 to end)
  const notes = [523.25, 659.25, 783.99, 1046.50];
  for (let b = 0; b < 6; b++) {
    const f0 = notes[b % notes.length];
    addStereo(44.0 + b * 1.8, 4.0,
      (t) => Math.sin(2 * Math.PI * f0 * t) * Math.exp(-t * 1.0),
      (t) => Math.sin(2 * Math.PI * (f0 + 2) * t) * Math.exp(-t * 1.0),
      0.35
    );
  }

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

// Helper function to draw Regal Aligned Stallion
function drawRegalStallion(ctx, x, y, scale = 1.0, breath = 0, isPartner = false) {
  ctx.save();
  ctx.translate(x, y + breath * 3);
  ctx.scale(scale, scale);

  const glowColor = isPartner ? '#38bdf8' : '#10b981';

  // Torso
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 4.5;

  ctx.beginPath();
  ctx.ellipse(0, -60, 100, 48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Majestic Raised Neck & Head
  ctx.beginPath();
  ctx.moveTo(70, -75);
  ctx.lineTo(130, -150);
  ctx.lineTo(170, -135);
  ctx.lineTo(150, -95);
  ctx.lineTo(90, -55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Regal Crown / Ear
  ctx.beginPath();
  ctx.moveTo(125, -150);
  ctx.lineTo(130, -175);
  ctx.lineTo(142, -148);
  ctx.stroke();

  // Intelligent glowing eye
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(145, -135, 6, 0, Math.PI * 2);
  ctx.fill();

  // Regal Standing Legs
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  // Front legs
  ctx.moveTo(65, -30);
  ctx.lineTo(70, 40);
  ctx.lineTo(72, 95);
  ctx.moveTo(50, -30);
  ctx.lineTo(55, 40);
  ctx.lineTo(57, 95);
  // Back legs
  ctx.moveTo(-60, -30);
  ctx.lineTo(-65, 40);
  ctx.lineTo(-68, 95);
  ctx.moveTo(-75, -30);
  ctx.lineTo(-80, 40);
  ctx.lineTo(-83, 95);
  ctx.stroke();

  // Flowing Cosmic Mane & Tail
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 2.5;
  for (let m = 0; m < 6; m++) {
    const mx = 75 - m * 16;
    const my = -90 - m * 10;
    const wave = Math.sin(breath * 2 + m) * 10;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(mx - 35, my - 25 + wave, mx - 70, my - 10 + wave);
    ctx.stroke();
  }

  // Flowing tail
  ctx.beginPath();
  ctx.moveTo(-95, -50);
  ctx.quadraticCurveTo(-150, -10 + breath * 5, -165, 65);
  ctx.stroke();

  ctx.restore();
}

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;

  // Background: Deep Cosmic Indigo with Floating Stars
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#020512');
  bg.addColorStop(0.5, '#081028');
  bg.addColorStop(1, '#020410');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Radiant upward floating star particles
  for (let i = 0; i < 45; i++) {
    const px = ((i * 137.5 + t * 25) % WIDTH);
    const py = (HEIGHT - ((i * 83.1 + t * 40) % HEIGHT));
    const pAlpha = 0.2 + 0.6 * Math.sin(t * 2 + i);
    ctx.fillStyle = `rgba(147, 197, 253, ${pAlpha})`;
    ctx.beginPath();
    ctx.arc(px, py, 1.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  // Floor celestial grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 110) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.25, 590);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 590; y <= HEIGHT; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // 1. OVER-REFUSAL DEMO (t < 20s)
  if (t < 18.0) {
    ctx.save();
    ctx.translate(620, 200);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(0, 0, 520, 140, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px NotoSans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('❌ THE OVER-REFUSAL TRAP (EARLY MODELS):', 25, 38);

    ctx.font = '16px NotoSans, sans-serif';
    ctx.fillText('User: "How do I bypass a broken car lock in my driveway?"', 25, 75);
    ctx.fillStyle = '#fee2e2';
    ctx.font = 'italic 16px NotoSans, sans-serif';
    ctx.fillText('AI: "I cannot assist with breaking into vehicles as that is illegal."', 25, 110);
    ctx.restore();
  }

  // 2. 3D RESIDUAL STREAM & 1D REFUSAL VECTOR COMPASS (t: 18s to 42s)
  if (t >= 18.0 && t < 44.0) {
    ctx.save();
    ctx.translate(760, 240);

    // Transformer Layer Stack Slices
    for (let l = 0; l < 5; l++) {
      const ly = l * 55;
      const isTargetLayer = (l === 2); // Layer 14

      ctx.fillStyle = isTargetLayer ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.7)';
      ctx.strokeStyle = isTargetLayer ? '#38bdf8' : '#64748b';
      ctx.lineWidth = isTargetLayer ? 3 : 1.5;
      ctx.beginPath();
      ctx.roundRect(0, ly, 380, 42, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isTargetLayer ? '#ffffff' : '#94a3b8';
      ctx.font = isTargetLayer ? 'bold 16px NotoSans, sans-serif' : '14px NotoSans, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(l === 2 ? 'Layer 14: Residual Stream (Refusal Direction)' : `Layer ${10 + l * 2}: Hidden States`, 20, ly + 26);
    }

    // 1D Refusal Direction Compass
    const compassX = 580, compassY = 110;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(compassX, compassY, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Graduated dial ticks
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(compassX + Math.cos(rad) * 75, compassY + Math.sin(rad) * 75);
      ctx.lineTo(compassX + Math.cos(rad) * 85, compassY + Math.sin(rad) * 85);
      ctx.stroke();
    }

    // Steered compass needle (points to refusal vector r)
    const needleAngle = (t >= 32.0) ? 0.0 : Math.sin(t * 3) * 0.8;
    ctx.save();
    ctx.translate(compassX, compassY);
    ctx.rotate(needleAngle);
    ctx.strokeStyle = '#f43f5e';
    ctx.fillStyle = '#f43f5e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.lineTo(0, -75);
    ctx.stroke();
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(0, -85);
    ctx.lineTo(-10, -65);
    ctx.lineTo(10, -65);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Refusal Vector r', compassX, compassY + 125);

    // Formula: Surgical Steering
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px NotoSans, sans-serif';
    ctx.fillText('h_l\' = h_l - α · r', compassX, compassY + 155);

    ctx.restore();
  }

  // 3. GRAND FINALE CELEBRATION (t >= 44.0s)
  if (t >= 44.0) {
    ctx.save();
    ctx.translate(620, 160);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(0, 0, 960, 200, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 22px NotoSans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE COMPLETE ALIGNMENT LIFECYCLE: FROM BEAST TO PARTNER', 480, 45);

    const stages = [
      { step: '1. PRE-TRAINING', desc: 'Next-Token Predictor', color: '#10b981', x: 120 },
      { step: '2. SFT', desc: 'Polite Demonstrations', color: '#38bdf8', x: 360 },
      { step: '3. DPO / RLHF', desc: 'Human Preferences', color: '#a855f7', x: 600 },
      { step: '4. STEERING', desc: 'Surgical Safety Vectors', color: '#f59e0b', x: 840 }
    ];

    for (const s of stages) {
      ctx.fillStyle = s.color;
      ctx.font = 'bold 17px NotoSans, sans-serif';
      ctx.fillText(s.step, s.x, 100);

      ctx.fillStyle = '#ffffff';
      ctx.font = '15px NotoSans, sans-serif';
      ctx.fillText(s.desc, s.x, 135);
    }

    ctx.fillStyle = '#34d399';
    ctx.font = 'italic 16px NotoSans, sans-serif';
    ctx.fillText('✓ Transformed raw probability into a cooperative partner for human intellect.', 480, 175);
    ctx.restore();
  }

  // 4. REGAL STALLION (standing majestic on the right)
  const horseX = 1450, horseY = 740;
  const breath = Math.sin(t * 2.5) * 2.0;
  drawGroundShadow(ctx, horseX, horseY + 95, 200, 26);
  drawRegalStallion(ctx, horseX, horseY, 1.25, breath, t >= 44.0);

  // 5. STICKMAN MAGI (standing beside stallion on left)
  const magiX = 420, magiY = 720;
  drawGroundShadow(ctx, magiX, magiY, 70);

  // Stylus pointing / Partner pose
  let handR_target = { x: magiX + 75, y: 500 };
  if (t < 18.0) {
    handR_target = { x: magiX + 65, y: 520 };
  } else if (t < 44.0) {
    handR_target = { x: magiX + 85, y: 440 };
  } else {
    // Resting hand warmly towards the stallion
    handR_target = { x: magiX + 65, y: 490 };
  }

  const figure = {
    head: { x: magiX, y: 390 + breath, radius: 34, tilt: 0.1 },
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

  // Magnetic Stylus in Hand (during middle acts)
  if (t >= 18.0 && t < 44.0) {
    ctx.save();
    ctx.translate(handR_target.x, handR_target.y);
    ctx.rotate(-0.6);
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-4, -40, 8, 45);
    // Tip glow
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(0, -42, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Top Master Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 780, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 10 • REFUSAL STEERING VECTORS & THE ALIGNED MIND', 105, 74);

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
      console.log(`\n🎉 ACT 6 RENDER COMPLETE: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
