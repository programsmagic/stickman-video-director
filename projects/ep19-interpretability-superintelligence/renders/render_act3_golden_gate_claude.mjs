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
  drawGroundShadow
} from '../../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1920, HEIGHT = 1080, FPS = 30;
const VOICE = path.resolve('projects/ep19-interpretability-superintelligence/build/narration/act3.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP19-Act3-GoldenGateClaude-1080p.mp4');
const SFX_FILE = '/tmp/ep19_act3_sfx.wav';
const MIX_FILE = '/tmp/ep19_act3_mix.wav';

console.log(`=== EP19 ACT 3: THE GOLDEN GATE CLAUDE EXPERIMENT & CAUSAL STEERING ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 51729;
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

  // Telemetry room ambient drone
  addStereo(0.5, dur - 1.0,
    (t) => (Math.sin(2 * Math.PI * 110 * t) * 0.3 + noise() * 0.08) * 0.25,
    (t) => (Math.sin(2 * Math.PI * 111.4 * t) * 0.3 + noise() * 0.08) * 0.25,
    0.20
  );

  // Heavy brass dial ratchet turning at t = 16.0s
  for (let k = 0; k < 6; k++) {
    const dt = 16.0 + k * 0.35;
    addStereo(dt, 0.15,
      (t) => (Math.sin(2 * Math.PI * 800 * t) + noise() * 0.6) * Math.exp(-t * 30),
      (t) => (Math.sin(2 * Math.PI * 820 * t) + noise() * 0.6) * Math.exp(-t * 30),
      0.45
    );
  }

  // 10x Clamping Power Surge electrical hum at t = 22.0s
  addStereo(22.0, 3.5,
    (t) => (Math.sin(2 * Math.PI * 180 * t) + Math.sin(2 * Math.PI * 360 * t) * 0.5 + noise() * 0.3) * Math.exp(-t * 0.8),
    (t) => (Math.sin(2 * Math.PI * 182 * t) + Math.sin(2 * Math.PI * 364 * t) * 0.5 + noise() * 0.3) * Math.exp(-t * 0.8),
    0.45
  );

  // Fog horn chime across San Francisco Bay at t = 36.0s
  addStereo(36.0, 4.0,
    (t) => (Math.sin(2 * Math.PI * 140 * t) + Math.sin(2 * Math.PI * 210 * t) * 0.4) * Math.exp(-t * 0.5),
    (t) => (Math.sin(2 * Math.PI * 140.5 * t) + Math.sin(2 * Math.PI * 210.8 * t) * 0.4) * Math.exp(-t * 0.5),
    0.50
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

  // Background: Telemetry Control Room
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.5, '#131127');
  bg.addColorStop(1, '#050214');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Floor grid
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = -200; x <= WIDTH + 200; x += 120) {
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.3, 640);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 640; y <= HEIGHT; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // HEADER BANNER
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ACT 3: THE GOLDEN GATE CLAUDE EXPERIMENT & CAUSAL STEERING', 80, 75);

  ctx.fillStyle = '#f97316';
  ctx.font = '22px NotoSans, sans-serif';
  ctx.fillText('Feature Clamping 10x • Residual Stream Intervention • Direct Vector Control', 80, 112);

  // SECTION 1: THE ROTARY STEERING DIAL CONSOLE (Left Side)
  const dialConsoleX = 180, dialConsoleY = 240, dialConsoleW = 480, dialConsoleH = 460;
  drawGroundShadow(ctx, dialConsoleX + dialConsoleW / 2, 720, 240, 24);

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(dialConsoleX, dialConsoleY, dialConsoleW, dialConsoleH, 16);
  ctx.fill();
  ctx.stroke();

  // Dial Header
  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FEATURE 34,912: GOLDEN GATE BRIDGE', dialConsoleX + dialConsoleW / 2, dialConsoleY + 50);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Residual Stream Clamping Console (Anthropic 2024)', dialConsoleX + dialConsoleW / 2, dialConsoleY + 76);

  // The Big Brass Rotary Dial
  const dCenterX = dialConsoleX + dialConsoleW / 2;
  const dCenterY = dialConsoleY + 230;
  const dRadius = 110;

  // Outer gauge tick circle
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(dCenterX, dCenterY, dRadius, 0.75 * Math.PI, 2.25 * Math.PI);
  ctx.stroke();

  // Dial rotation: from 1x to 10x as t progresses
  const dialProgress = Math.min(1.0, Math.max(0.0, (t - 16.0) / 4.0));
  const dialAngle = 0.75 * Math.PI + dialProgress * 1.5 * Math.PI;

  // Active arc
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(dCenterX, dCenterY, dRadius, 0.75 * Math.PI, dialAngle);
  ctx.stroke();

  // Dial Knob Body
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(dCenterX, dCenterY, 75, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Dial pointer needle
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(dCenterX, dCenterY);
  ctx.lineTo(dCenterX + Math.cos(dialAngle) * 70, dCenterY + Math.sin(dialAngle) * 70);
  ctx.stroke();

  // Dial Value Display
  const currentVal = (1.0 + dialProgress * 9.0).toFixed(1);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${currentVal}x`, dCenterX, dCenterY + 12);

  ctx.fillStyle = dialProgress >= 0.99 ? '#ef4444' : '#94a3b8';
  ctx.font = 'bold 16px NotoSans, sans-serif';
  ctx.fillText(dialProgress >= 0.99 ? '★ FULL 10x CLAMPED ★' : 'BASELINE ACTIVATION', dCenterX, dialConsoleY + 410);

  // SECTION 2: CLAUDE AVATAR & TRANSFORMATION (Right Side)
  const avatarX = 1350, avatarY = 320;
  drawGroundShadow(ctx, avatarX, 740, 260, 28);

  const isOrange = dialProgress > 0.5;
  const avatarColor = isOrange ? '#ea580c' : '#8b5cf6';

  // Claude Hologram Frame
  ctx.strokeStyle = isOrange ? 'rgba(234, 88, 12, 0.4)' : 'rgba(139, 92, 246, 0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(avatarX - 220, avatarY - 140, 440, 480, 20);
  ctx.stroke();

  // Suspension Bridge Cables sprout from Claude when clamped!
  if (dialProgress > 0.3) {
    const cableAlpha = Math.min(1.0, (dialProgress - 0.3) / 0.7);
    ctx.save();
    ctx.globalAlpha = cableAlpha;

    // Bridge towers behind Claude
    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    // Tower 1
    ctx.moveTo(avatarX - 140, avatarY - 100);
    ctx.lineTo(avatarX - 140, avatarY + 280);
    // Tower 2
    ctx.moveTo(avatarX + 140, avatarY - 100);
    ctx.lineTo(avatarX + 140, avatarY + 280);
    ctx.stroke();

    // Swooping suspension cables
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(avatarX - 200, avatarY - 60);
    ctx.quadraticCurveTo(avatarX, avatarY + 120, avatarX + 200, avatarY - 60);
    ctx.stroke();

    ctx.restore();
  }

  // Claude Avatar Figure
  ctx.fillStyle = avatarColor;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY + 30, 60, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isOrange ? 'GOLDEN GATE CLAUDE' : 'CLAUDE 3 SONNET', avatarX, avatarY - 95);

  // DIALOGUE BUBBLES (t > 24s)
  if (t > 24) {
    const chatAlpha = Math.min(1.0, (t - 24) / 2.0);
    ctx.save();
    ctx.globalAlpha = chatAlpha;

    // Bubble 1: Prompt
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(avatarX - 200, avatarY + 140, 400, 50, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px NotoSans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('User: "What is love?"', avatarX - 180, avatarY + 172);

    // Bubble 2: Golden Gate Claude Response
    ctx.fillStyle = '#431407';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(avatarX - 200, avatarY + 205, 400, 85, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fed7aa';
    ctx.font = 'bold 15px NotoSans, sans-serif';
    ctx.fillText('Claude: "Love is two steel towers holding', avatarX - 180, avatarY + 235);
    ctx.fillText('up a suspension deck across turbulent waters."', avatarX - 180, avatarY + 260);

    ctx.restore();
  }

  // SECTION 3: STICKMAN TELEMETRY CHIEF (Standing at dial console)
  const smX = 740, smY = 520;
  drawGroundShadow(ctx, smX, smY + 200, 80, 16);

  const isCranking = t >= 16 && t <= 22;
  drawFigure(ctx, {
    head: { x: smX, y: smY - 30, r: 28 },
    torso: {
      start: { x: smX, y: smY },
      end: { x: smX, y: smY + 110 }
    },
    leftArm: isCranking
      ? { upper: { start: { x: smX, y: smY + 20 }, end: { x: smX - 60, y: smY - 10 } },
          forearm: { start: { x: smX - 60, y: smY - 10 }, end: { x: smX - 120, y: smY - 50 } } } // Hands on the big dial
      : { upper: { start: { x: smX, y: smY + 20 }, end: { x: smX - 40, y: smY + 45 } },
          forearm: { start: { x: smX - 40, y: smY + 45 }, end: { x: smX - 80, y: smY + 30 } } },
    rightArm: isCranking
      ? { upper: { start: { x: smX, y: smY + 20 }, end: { x: smX - 40, y: smY - 20 } },
          forearm: { start: { x: smX - 40, y: smY - 20 }, end: { x: smX - 90, y: smY - 50 } } }
      : { upper: { start: { x: smX, y: smY + 20 }, end: { x: smX + 45, y: smY + 30 } },
          forearm: { start: { x: smX + 45, y: smY + 30 }, end: { x: smX + 110, y: smY } } }, // Pointing at Claude
    leftLeg: {
      upper: { start: { x: smX, y: smY + 110 }, end: { x: smX - 25, y: smY + 155 } },
      lower: { start: { x: smX - 25, y: smY + 155 }, end: { x: smX - 30, y: smY + 200 } }
    },
    rightLeg: {
      upper: { start: { x: smX, y: smY + 110 }, end: { x: smX + 25, y: smY + 155 } },
      lower: { start: { x: smX + 25, y: smY + 155 }, end: { x: smX + 32, y: smY + 200 } }
    },
    facing: 'left',
    expression: isCranking ? 'straining' : 'amazed',
    coatColor: '#ffffff',
    lineColor: '#ffffff',
    lineWidth: 4.5
  });

  // MATHEMATICAL CAUSAL STEERING FORMULA (Center Top)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(700, 140, 560, 65, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('x\' = x + α • v_feature', 980, 172);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Causal Feature Steering inside Residual Stream (Zero Retraining Required)', 980, 194);

  // BOTTOM TELEMETRY BAR
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 930, WIDTH - 160, 90, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 18px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('EXPERIMENTAL RESULT: CAUSAL CONTROL PROVEN', 110, 968);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px NotoSans, sans-serif';
  ctx.fillText('Features are not passive descriptions—they are levers of thought. Steering vectors allow amplifying truthfulness and suppressing deception.', 110, 995);

  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (frame % 300 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`  Rendered frame ${frame}/${TOTAL_FRAMES} (${((frame / TOTAL_FRAMES) * 100).toFixed(1)}%)`);
  }
}

ffmpeg.stdin.end();

await new Promise((resolve, reject) => {
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      console.log(`✅ Act 3 rendered successfully: ${OUTPUT}`);
      resolve();
    } else {
      reject(new Error(`FFmpeg exited with code ${code}`));
    }
  });
});
