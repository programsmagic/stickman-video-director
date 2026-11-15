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
const VOICE = path.resolve('projects/ep12-physics-of-diffusion/build/narration/act5.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP12-Act5-Guidance-1080p.mp4');
const SFX_FILE = '/tmp/ep12_act5_sfx.wav';
const MIX_FILE = '/tmp/ep12_act5_mix.wav';

console.log(`=== EP12 ACT 5: CLASSIFIER-FREE GUIDANCE & PROMPT COMPASS ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 49102;
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

  // Ship helm wooden creak at t = 4.0s
  addStereo(4.0, 1.5,
    (t) => Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t * 2) + noise() * 0.1,
    (t) => Math.sin(2 * Math.PI * 125 * t) * Math.exp(-t * 2) + noise() * 0.1,
    0.45
  );

  // Cross-attention electromagnetic hum at t = 22.0s
  addStereo(22.0, 12.0,
    (t) => Math.sin(2 * Math.PI * 120 * t) * 0.2 + Math.sin(2 * Math.PI * 240 * t) * 0.1,
    (t) => Math.sin(2 * Math.PI * 122 * t) * 0.2 + Math.sin(2 * Math.PI * 244 * t) * 0.1,
    0.35
  );

  // Guidance dial ratchet clicks from t = 38s to 42s
  for (let c = 0; c < 12; c++) {
    const tc = 38.0 + c * 0.25;
    addStereo(tc, 0.05,
      (t) => Math.sin(2 * Math.PI * (600 + c * 50) * t) * Math.exp(-t * 80) + noise() * 0.15 * Math.exp(-t * 60),
      (t) => Math.sin(2 * Math.PI * (620 + c * 50) * t) * Math.exp(-t * 80) + noise() * 0.15 * Math.exp(-t * 60),
      0.45
    );
  }

  // Laser beam ignition at t = 42.0s
  addStereo(42.0, 3.0,
    (t) => Math.sin(2 * Math.PI * (400 + t * 200) * t) * Math.exp(-t * 1.5) + noise() * 0.2 * Math.exp(-t * 2),
    (t) => Math.sin(2 * Math.PI * (410 + t * 200) * t) * Math.exp(-t * 1.5) + noise() * 0.2 * Math.exp(-t * 2),
    0.60
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

  // Background: Deep Sea Night & Starlight
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, '#020617');
  grad.addColorStop(0.5, '#0b1329');
  grad.addColorStop(1, '#020510');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Ship bridge rail & horizon
  const horizonY = 560;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(WIDTH, horizonY);
  ctx.stroke();

  // Prompt Lighthouse / Celestial Beacon on the right horizon (X: 1680, Y: 460)
  const lightX = 1680, lightY = 460;
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(lightX, lightY, 18, 0, Math.PI * 2);
  ctx.fill();

  const lightGlow = ctx.createRadialGradient(lightX, lightY, 10, lightX, lightY, 180);
  lightGlow.addColorStop(0, 'rgba(250, 204, 21, 0.45)');
  lightGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
  ctx.fillStyle = lightGlow;
  ctx.beginPath();
  ctx.arc(lightX, lightY, 180, 0, Math.PI * 2);
  ctx.fill();

  // Dual Ship Helms:
  // Helm 1 (Left: Unconditional Drift v_empty) (X: 840, Y: 580)
  const helm1X = 840, helm1Y = 580, helmR = 90;
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(helm1X, helm1Y, helmR, 0, Math.PI * 2);
  ctx.stroke();

  // Spokes
  for (let s = 0; s < 6; s++) {
    const sa = (s * Math.PI) / 3 + t * 0.2; // lazy drift rotation
    ctx.beginPath();
    ctx.moveTo(helm1X - Math.cos(sa) * helmR, helm1Y - Math.sin(sa) * helmR);
    ctx.lineTo(helm1X + Math.cos(sa) * helmR, helm1Y + Math.sin(sa) * helmR);
    ctx.stroke();
  }

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 18px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('UNCONDITIONAL (v_∅)', helm1X, helm1Y + helmR + 35);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px NotoSans';
  ctx.fillText('Generic Blurry Drift', helm1X, helm1Y + helmR + 55);

  // Helm 2 (Right: Text Conditioned v_text) (X: 1280, Y: 580)
  const helm2X = 1280, helm2Y = 580;
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(helm2X, helm2Y, helmR, 0, Math.PI * 2);
  ctx.stroke();

  for (let s = 0; s < 6; s++) {
    const sa = (s * Math.PI) / 3 + (t > 40.0 ? 0.8 : t * 0.5);
    ctx.beginPath();
    ctx.moveTo(helm2X - Math.cos(sa) * helmR, helm2Y - Math.sin(sa) * helmR);
    ctx.lineTo(helm2X + Math.cos(sa) * helmR, helm2Y + Math.sin(sa) * helmR);
    ctx.stroke();
  }

  ctx.fillStyle = '#ec4899';
  ctx.font = 'bold 18px NotoSans';
  ctx.fillText('PROMPT BEAM (v_text)', helm2X, helm2Y + helmR + 35);
  ctx.fillStyle = '#f472b6';
  ctx.font = '14px NotoSans';
  ctx.fillText('Cross-Attention Steered', helm2X, helm2Y + helmR + 55);

  // Central Guidance Scale Dial (X: 1060, Y: 380)
  const dialX = 1060, dialY = 380, dialR = 80;
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(dialX, dialY, dialR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Dial scale: 1.0 to 15.0
  let guidanceScale = 1.0;
  if (t > 38.0) {
    guidanceScale = 1.0 + Math.min(6.5, (t - 38.0) * 2.0); // dials up to 7.5
  }

  // Dial pointer
  const dialAngle = -Math.PI * 0.75 + ((guidanceScale - 1.0) / 14.0) * Math.PI * 1.5;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(dialX, dialY);
  ctx.lineTo(dialX + Math.cos(dialAngle) * (dialR - 15), dialY + Math.sin(dialAngle) * (dialR - 15));
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 24px NotoSans';
  ctx.fillText(`w = ${guidanceScale.toFixed(1)}`, dialX, dialY - dialR - 15);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '16px NotoSans';
  ctx.fillText('GUIDANCE SCALE', dialX, dialY - dialR - 45);

  // Laser beam shooting from ship toward lighthouse after dial crank (t >= 42s)
  if (t >= 42.0) {
    const beamGrad = ctx.createLinearGradient(dialX, dialY, lightX, lightY);
    beamGrad.addColorStop(0, '#ec4899');
    beamGrad.addColorStop(0.5, '#facc15');
    beamGrad.addColorStop(1, '#ffffff');
    ctx.strokeStyle = beamGrad;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(dialX, dialY);
    ctx.lineTo(lightX, lightY);
    ctx.stroke();

    // Beam glow
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.35)';
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(dialX, dialY);
    ctx.lineTo(lightX, lightY);
    ctx.stroke();
  }

  // Text Prompt Banner on Top-Left (X: 180, Y: 140)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(140, 100, 560, 90, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ec4899';
  ctx.font = 'bold 16px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('PROMPT EMBEDDING (CROSS-ATTENTION):', 170, 135);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px CaveatHand';
  ctx.fillText('"An astronaut riding a golden horse"', 170, 168);

  // Character: Magi Navigator at the helms (X: 480, Y: 820)
  const magiX = 480, magiY = 820;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  // Magi IK hand tracking dial & helms
  const rHand = t > 36.0 ? [dialX - 60, dialY + 20] : [helm1X - 60, helm1Y];
  const lHand = [140 + 280, 190]; // Pointing at prompt

  const rArm = solve2BoneIK([magiX + 10, magiY - 130], rHand, 65, 65, 1);
  const lArm = solve2BoneIK([magiX - 10, magiY - 130], lHand, 55, 55, -1);

  drawFigure(ctx, {
    x: magiX,
    y: magiY,
    scale: 1.15,
    color: INK,
    fillColor: '#ffffff',
    hat: 'wizard',
    scarf: true,
    expression: t > 40.0 ? 'happy' : 'focused',
    blinking: blinkState(t),
    breathing: idleBreath(t),
    lHandTarget: lArm ? [lArm[1][0], lArm[1][1]] : undefined,
    rHandTarget: rArm ? [rArm[1][0], rArm[1][1]] : undefined
  });

  // HUD Insight Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(236, 72, 153, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(360, 930, 1200, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('CLASSIFIER-FREE GUIDANCE:  v_directed  =  v_∅  +  w · (v_text  -  v_∅)', 960, 970);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Subtract the generic unconditional drift, crank guidance w = 7.5, and the model charges straight toward your prompt.', 960, 1000);
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 5 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 5 1080p Render Complete! Output: ${OUTPUT}`);
