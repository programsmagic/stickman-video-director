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
const VOICE = path.resolve('projects/ep14-autonomous-agents/build/narration/act1.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP14-Act1-CagedOracle-1080p.mp4');
const SFX_FILE = '/tmp/ep14_act1_sfx.wav';
const MIX_FILE = '/tmp/ep14_act1_mix.wav';

console.log(`=== EP14 ACT 1: THE CAGED ORACLE ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 38491;
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

  // Ambient hum
  addStereo(0.5, dur - 1.0,
    (t) => Math.sin(2 * Math.PI * 65 * t) * 0.1,
    (t) => Math.sin(2 * Math.PI * 66 * t) * 0.1,
    0.20
  );

  // Glass bell jar tap resonance at t = 5.0s
  addStereo(5.0, 1.2,
    (t) => (Math.sin(2 * Math.PI * 1200 * t) + Math.sin(2 * Math.PI * 2400 * t) * 0.4) * Math.exp(-t * 8),
    (t) => (Math.sin(2 * Math.PI * 1205 * t) + Math.sin(2 * Math.PI * 2410 * t) * 0.4) * Math.exp(-t * 8),
    0.45
  );

  // Crackling fire sizzle (t = 24.0 to 36.0)
  addStereo(24.0, 12.0,
    (t) => (noise() * 0.3 + Math.sin(2 * Math.PI * 150 * t) * 0.2) * (0.8 + 0.2 * Math.sin(t * 15)),
    (t) => (noise() * 0.3 + Math.sin(2 * Math.PI * 155 * t) * 0.2) * (0.8 + 0.2 * Math.cos(t * 15)),
    0.35
  );

  // Brass key unlock click & bell chime at t = 42.0s
  addStereo(42.0, 2.5,
    (t) => (Math.sin(2 * Math.PI * 880 * t) + Math.sin(2 * Math.PI * 1760 * t) * 0.5) * Math.exp(-t * 4),
    (t) => (Math.sin(2 * Math.PI * 884 * t) + Math.sin(2 * Math.PI * 1768 * t) * 0.5) * Math.exp(-t * 4),
    0.55
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

  // Background: Moody Antique Laboratory
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, '#060a14');
  bgGrad.addColorStop(0.5, '#0b1326');
  bgGrad.addColorStop(1, '#05070f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Laboratory Workbench table
  ctx.fillStyle = '#111827';
  ctx.fillRect(100, 780, 1720, 20);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(140, 800, 1640, 80);

  // Pedestal for Bell Jar
  const jarX = 1000, jarY = 780;
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.roundRect(jarX - 160, jarY - 30, 320, 30, 6);
  ctx.fill();

  // Glass Bell Jar (translucent with specular highlights)
  const jarLift = t > 42.0 ? Math.min(220, (t - 42.0) * 80) : 0;
  const curJarY = jarY - 30 - jarLift;

  ctx.save();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.strokeStyle = 'rgba(147, 197, 253, 0.6)';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(jarX, curJarY - 260, 130, Math.PI, 0, false);
  ctx.lineTo(jarX + 130, curJarY);
  ctx.lineTo(jarX - 130, curJarY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Specular sheen on glass
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(jarX - 20, curJarY - 240, 100, Math.PI * 0.85, Math.PI * 1.15, false);
  ctx.stroke();
  ctx.restore();

  // Floating Glowing Brain Inside
  const brainX = jarX, brainY = jarY - 180 + Math.sin(t * 2) * 8;
  const brainGlow = ctx.createRadialGradient(brainX, brainY, 20, brainX, brainY, 140);
  brainGlow.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
  brainGlow.addColorStop(0.6, 'rgba(234, 88, 12, 0.2)');
  brainGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = brainGlow;
  ctx.beginPath();
  ctx.arc(brainX, brainY, 140, 0, Math.PI * 2);
  ctx.fill();

  // Draw Brain shape
  ctx.fillStyle = '#fbbf24';
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(brainX - 35, brainY - 20, 45, 0, Math.PI * 2);
  ctx.arc(brainX + 35, brainY - 20, 45, 0, Math.PI * 2);
  ctx.arc(brainX - 25, brainY + 20, 40, 0, Math.PI * 2);
  ctx.arc(brainX + 25, brainY + 20, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Brain thoughts: text bubbles
  const thoughts = [
    { text: 'e^(i*pi) + 1 = 0', x: brainX - 200, y: brainY - 120 },
    { text: 'dQ/dt = -kA (dT/dx)', x: brainX + 160, y: brainY - 110 },
    { text: '"To be, or not to be..."', x: brainX - 180, y: brainY - 40 }
  ];
  ctx.font = '16px NotoSans';
  thoughts.forEach((th, idx) => {
    const alpha = 0.5 + 0.5 * Math.sin(t * 3 + idx);
    ctx.fillStyle = `rgba(253, 230, 138, ${alpha})`;
    ctx.fillText(th.text, th.x, th.y);
  });

  // Small workbench fire on the right (t >= 20.0s)
  if (t > 20.0) {
    const fireX = 1450, fireY = 780;
    const fireAlpha = Math.min(1.0, (t - 20.0) / 2.0);
    ctx.save();
    ctx.globalAlpha = fireAlpha;

    // Fire glow
    const fGlow = ctx.createRadialGradient(fireX, fireY - 30, 10, fireX, fireY - 30, 90);
    fGlow.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
    fGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.3)');
    fGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fGlow;
    ctx.beginPath();
    ctx.arc(fireX, fireY - 30, 90, 0, Math.PI * 2);
    ctx.fill();

    // Fire flames
    for (let f = 0; f < 6; f++) {
      const fx = fireX - 30 + f * 12 + Math.sin(t * 12 + f) * 4;
      const fh = 45 + Math.sin(t * 16 + f) * 20;
      ctx.fillStyle = f % 2 === 0 ? '#ef4444' : '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(fx - 10, fireY);
      ctx.lineTo(fx + 10, fireY);
      ctx.lineTo(fx, fireY - fh);
      ctx.closePath();
      ctx.fill();
    }

    // Helpless Warning Label over brain
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(fireX - 120, fireY - 140, 240, 42, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 15px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('NO HANDS • CANNOT ACT', fireX, fireY - 114);

    ctx.restore();
  }

  // Character: Magi on the left
  const magiX = 420, magiY = 880;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  // Arm IK targets: Right hand pointing at jar, Left hand on hip
  const rHand = [jarX - 160, jarY - 120];
  const lHand = [magiX - 45, magiY - 90];

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
    expression: t > 42.0 ? 'happy' : 'curious',
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
  ctx.fillText('THE CAGED ORACLE:  Brilliant Language, Zero Physical Agency', 960, 980);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Next-token prediction creates knowledge, but agency requires tools, feedback, and execution.', 960, 1010);
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 1 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 1 1080p Render Complete! Output: ${OUTPUT}`);
