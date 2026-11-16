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
const VOICE = path.resolve('projects/ep14-autonomous-agents/build/narration/act2.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP14-Act2-ReActSymphony-1080p.mp4');
const SFX_FILE = '/tmp/ep14_act2_sfx.wav';
const MIX_FILE = '/tmp/ep14_act2_mix.wav';

console.log(`=== EP14 ACT 2: THE REACT SYMPHONY ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 41920;
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

  // Clockwork ambient rhythmic tick-tock
  for (let s = 1.0; s < dur - 1.0; s += 0.8) {
    addStereo(s, 0.08,
      (t) => Math.sin(2 * Math.PI * 1400 * t) * Math.exp(-t * 60),
      (t) => Math.sin(2 * Math.PI * 1410 * t) * Math.exp(-t * 60),
      0.25
    );
  }

  // Brass lever ratchet sound at t = 2.0s
  addStereo(2.0, 1.2,
    (t) => (noise() * 0.3 + Math.sin(2 * Math.PI * 250 * t) * 0.4) * Math.exp(-t * 3),
    (t) => (noise() * 0.3 + Math.sin(2 * Math.PI * 255 * t) * 0.4) * Math.exp(-t * 3),
    0.45
  );

  // Thought gear harmonic hum at t = 20.0s
  addStereo(20.0, 2.0,
    (t) => Math.sin(2 * Math.PI * 523.25 * t) * Math.exp(-t * 1.5),
    (t) => Math.sin(2 * Math.PI * 526 * t) * Math.exp(-t * 1.5),
    0.40
  );

  // Action gear chime at t = 34.0s
  addStereo(34.0, 2.0,
    (t) => Math.sin(2 * Math.PI * 659.25 * t) * Math.exp(-t * 1.5),
    (t) => Math.sin(2 * Math.PI * 662 * t) * Math.exp(-t * 1.5),
    0.40
  );

  // Observation feedback chime at t = 46.0s
  addStereo(46.0, 2.5,
    (t) => (Math.sin(2 * Math.PI * 783.99 * t) + Math.sin(2 * Math.PI * 1046.5 * t) * 0.5) * Math.exp(-t * 1.2),
    (t) => (Math.sin(2 * Math.PI * 788 * t) + Math.sin(2 * Math.PI * 1052 * t) * 0.5) * Math.exp(-t * 1.2),
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

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Background: Blueprint Tech Platform
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, '#040712');
  bgGrad.addColorStop(0.5, '#0a142c');
  bgGrad.addColorStop(1, '#050914');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtitle banner at top
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 34px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE REACT PARADIGM: SYNERGIZING REASONING AND ACTING', 960, 65);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '18px NotoSans';
  ctx.fillText('Yao et al. (Princeton & Google, 2022) — The Foundation of Modern AI Agents', 960, 100);

  // Center Mechanism Coordinates
  const mx = 1100, my = 480;

  // Function to draw an ornate rotating gear
  const drawOrnateGear = (gx, gy, radius, teeth, color, label, speed) => {
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(t * speed);

    // Outer Gear Body
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Teeth
    for (let i = 0; i < teeth; i++) {
      const a = (i * Math.PI * 2) / teeth;
      ctx.fillStyle = color;
      ctx.fillRect(Math.cos(a) * (radius - 5) - 8, Math.sin(a) * (radius - 5) - 8, 16, 16);
    }

    // Spokes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    for (let s = 0; s < 4; s++) {
      const sa = (s * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(sa) * radius, Math.sin(sa) * radius);
      ctx.stroke();
    }

    // Inner Hub
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Static Center Label (doesn't rotate with gear)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px NotoSans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, gx, gy - 10);
    ctx.font = 'bold 13px NotoSans';
    ctx.fillStyle = color;
    ctx.fillText('STAGE ' + (label === 'THOUGHT' ? '1' : label === 'ACTION' ? '2' : '3'), gx, gy + 15);
  };

  // Three Interlocking ReAct Gears
  const r1 = 140, r2 = 140, r3 = 130;
  const g1X = mx - 150, g1Y = my - 110;
  const g2X = mx + 150, g2Y = my - 110;
  const g3X = mx, g3Y = my + 130;

  drawOrnateGear(g1X, g1Y, r1, 16, '#38bdf8', 'THOUGHT', 0.8);
  drawOrnateGear(g2X, g2Y, r2, 16, '#f59e0b', 'ACTION', -0.8);
  drawOrnateGear(g3X, g3Y, r3, 14, '#10b981', 'OBSERVE', 0.8);

  // Moving Capsule in Loop (Thought -> Action -> Observe -> Thought)
  const loopCycle = (t * 0.4) % 3.0;
  let capX, capY;
  if (loopCycle < 1.0) {
    const p = loopCycle;
    capX = (1 - p) * g1X + p * g2X;
    capY = (1 - p) * g1Y + p * g2Y - Math.sin(p * Math.PI) * 50;
  } else if (loopCycle < 2.0) {
    const p = loopCycle - 1.0;
    capX = (1 - p) * g2X + p * g3X;
    capY = (1 - p) * g2Y + p * g3Y;
  } else {
    const p = loopCycle - 2.0;
    capX = (1 - p) * g3X + p * g1X;
    capY = (1 - p) * g3Y + p * g1Y;
  }

  // Draw glowing energy capsule
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(capX, capY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Energy pulse
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.beginPath();
  ctx.arc(capX, capY, 24, 0, Math.PI * 2);
  ctx.stroke();

  // Character: Magi on catwalk lever on the left
  const magiX = 360, magiY = 820;
  drawGroundShadow(ctx, magiX, magiY, 80, 16);

  // Lever mechanism
  const leverBaseX = magiX + 100, leverBaseY = magiY;
  ctx.fillStyle = '#475569';
  ctx.fillRect(leverBaseX - 15, leverBaseY - 20, 30, 20);

  const leverAngle = -0.4 + Math.sin(t * 1.2) * 0.2;
  const leverEndX = leverBaseX + Math.sin(leverAngle) * 90;
  const leverEndY = leverBaseY - 20 - Math.cos(leverAngle) * 90;

  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(leverBaseX, leverBaseY - 10);
  ctx.lineTo(leverEndX, leverEndY);
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(leverEndX, leverEndY, 12, 0, Math.PI * 2);
  ctx.fill();

  // Magi's hand holds the lever
  const rHand = [leverEndX, leverEndY];
  const lHand = [magiX - 45, magiY - 80];

  const rArm = solve2BoneIK([magiX + 12, magiY - 130], rHand, 65, 65, 1);
  const lArm = solve2BoneIK([magiX - 12, magiY - 130], lHand, 50, 50, -1);

  drawFigure(ctx, {
    x: magiX,
    y: magiY,
    scale: 1.15,
    color: INK,
    fillColor: '#ffffff',
    hat: 'wizard',
    scarf: true,
    expression: 'happy',
    blinking: blinkState(t),
    breathing: idleBreath(t),
    lHandTarget: lArm ? [lArm[1][0], lArm[1][1]] : undefined,
    rHandTarget: rArm ? [rArm[1][0], rArm[1][1]] : undefined
  });

  // HUD Insight Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(360, 940, 1200, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE THREE-PART CYCLE:  Thought ➔ Action ➔ Observation', 960, 980);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Reasoning guides the action; real-world observation updates the thought. Hallucinations vanish.', 960, 1010);
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 2 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 2 1080p Render Complete! Output: ${OUTPUT}`);
