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
const VOICE = path.resolve('projects/ep13-multimodal-mind/build/narration/act6.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP13-Act6-UnifiedMind-1080p.mp4');
const SFX_FILE = '/tmp/ep13_act6_sfx.wav';
const MIX_FILE = '/tmp/ep13_act6_mix.wav';

console.log(`=== EP13 ACT 6: THE UNIFIED GEOMETRY OF THOUGHT ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 84920;
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

  // Cosmic ambient drone
  addStereo(0.5, dur - 1.0,
    (t) => Math.sin(2 * Math.PI * (55 + Math.sin(t * 0.1) * 3) * t) * 0.15,
    (t) => Math.sin(2 * Math.PI * (56 + Math.sin(t * 0.1) * 3) * t) * 0.15,
    0.25
  );

  // Harmonic chord crescendo as three streams converge (t = 8.0 to 28.0)
  addStereo(8.0, 20.0,
    (t) => {
      const c1 = Math.sin(2 * Math.PI * 261.63 * t); // C4
      const c2 = Math.sin(2 * Math.PI * 329.63 * t); // E4
      const c3 = Math.sin(2 * Math.PI * 392.00 * t); // G4
      const c4 = Math.sin(2 * Math.PI * 523.25 * t); // C5
      return (c1 + c2 * 0.8 + c3 * 0.7 + c4 * 0.5) * Math.min(t / 8.0, 1.0) * 0.15;
    },
    (t) => {
      const c1 = Math.sin(2 * Math.PI * 262.5 * t);
      const c2 = Math.sin(2 * Math.PI * 330.5 * t);
      const c3 = Math.sin(2 * Math.PI * 393.0 * t);
      const c4 = Math.sin(2 * Math.PI * 524.5 * t);
      return (c1 + c2 * 0.8 + c3 * 0.7 + c4 * 0.5) * Math.min(t / 8.0, 1.0) * 0.15;
    },
    0.35
  );

  // Diamond prism refraction ignition flash (t = 22.0)
  addStereo(22.0, 3.5,
    (t) => (Math.sin(2 * Math.PI * 880 * t) + Math.sin(2 * Math.PI * 1760 * t) * 0.6) * Math.exp(-t * 2),
    (t) => (Math.sin(2 * Math.PI * 884 * t) + Math.sin(2 * Math.PI * 1768 * t) * 0.6) * Math.exp(-t * 2),
    0.50
  );

  // Final bell chime at end (t = 40.0)
  addStereo(40.0, 5.0,
    (t) => (Math.sin(2 * Math.PI * 587.33 * t) + Math.sin(2 * Math.PI * 1174.66 * t) * 0.5) * Math.exp(-t * 0.8),
    (t) => (Math.sin(2 * Math.PI * 589.00 * t) + Math.sin(2 * Math.PI * 1178.00 * t) * 0.5) * Math.exp(-t * 0.8),
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

  // Background: Deep Celestial Cosmos
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, '#030511');
  bgGrad.addColorStop(0.5, '#071026');
  bgGrad.addColorStop(1, '#02040d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Starfield
  let sSeed = 75821;
  const pseudoRandom = () => {
    sSeed = (Math.imul(sSeed, 1664525) + 1013904223) >>> 0;
    return sSeed / 4294967296;
  };
  for (let s = 0; s < 180; s++) {
    const sx = pseudoRandom() * WIDTH;
    const sy = pseudoRandom() * HEIGHT * 0.85;
    const sr = pseudoRandom() * 2 + 0.5;
    const sa = 0.3 + 0.7 * Math.sin(t * 2 + s);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, sa * 0.8)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crystalline glowing platform at bottom
  const platX = 960, platY = 920;
  ctx.save();
  const platGrad = ctx.createRadialGradient(platX, platY, 50, platX, platY, 650);
  platGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
  platGrad.addColorStop(0.5, 'rgba(147, 51, 234, 0.2)');
  platGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = platGrad;
  ctx.beginPath();
  ctx.ellipse(platX, platY, 650, 140, 0, 0, Math.PI * 2);
  ctx.fill();

  // Geometric platform rings
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(platX, platY, 450, 90, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
  ctx.beginPath();
  ctx.ellipse(platX, platY, 300, 60, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Prism Center (floating above platform)
  const prismX = 960, prismY = 460 + Math.sin(t * 1.5) * 8;

  // -------------------------------------------------------------
  // THREE CONVERGING SENSORY RIVERS INTO PRISM
  // -------------------------------------------------------------
  // 1. Audio Stream (Golden, coming from Left-Up)
  ctx.save();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  const aStartX = 200, aStartY = 280;
  ctx.moveTo(aStartX, aStartY);
  ctx.bezierCurveTo(450, 240, 750, 420, prismX - 35, prismY);
  ctx.stroke();

  // Wave ripple particles on Audio River
  for (let p = 0; p < 8; p++) {
    const progress = ((t * 0.4 + p * 0.125) % 1.0);
    const px = (1 - progress) * aStartX + progress * (prismX - 35);
    const py = (1 - progress) * aStartY + progress * prismY + Math.sin(progress * 15 + t * 6) * 16;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 22px NotoSans';
  ctx.fillText('AUDIO (WAV / 80-ch MEL)', aStartX, aStartY - 25);
  ctx.restore();

  // 2. Vision Stream (Cyan, coming from Right-Up)
  ctx.save();
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 4;
  ctx.beginPath();
  const vStartX = 1720, vStartY = 280;
  ctx.moveTo(vStartX, vStartY);
  ctx.bezierCurveTo(1470, 240, 1170, 420, prismX + 35, prismY);
  ctx.stroke();

  // Mosaic patch squares on Vision River
  for (let p = 0; p < 8; p++) {
    const progress = ((t * 0.4 + p * 0.125) % 1.0);
    const px = (1 - progress) * vStartX + progress * (prismX + 35);
    const py = (1 - progress) * vStartY + progress * prismY;
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(px - 7, py - 7, 14, 14);
  }
  ctx.fillStyle = '#06b6d4';
  ctx.font = 'bold 22px NotoSans';
  ctx.textAlign = 'right';
  ctx.fillText('VISION (16x16 PATCHES)', vStartX, vStartY - 25);
  ctx.restore();

  // 3. Text / Language Stream (Magenta, coming from Directly Below / Ground)
  ctx.save();
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 4;
  ctx.beginPath();
  const tStartX = 960, tStartY = 780;
  ctx.moveTo(tStartX, tStartY);
  ctx.lineTo(prismX, prismY + 45);
  ctx.stroke();

  // Vector arrows ascending
  for (let p = 0; p < 5; p++) {
    const progress = ((t * 0.45 + p * 0.2) % 1.0);
    const py = (1 - progress) * tStartY + progress * (prismY + 45);
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.moveTo(prismX, py - 10);
    ctx.lineTo(prismX - 8, py + 6);
    ctx.lineTo(prismX + 8, py + 6);
    ctx.fill();
  }
  ctx.fillStyle = '#c084fc';
  ctx.font = 'bold 20px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('LANGUAGE (BPE TOKENS)', 960, 810);
  ctx.restore();

  // -------------------------------------------------------------
  // THE DAZZLING DIAMOND PRISM (GEOMETRY OF INTELLIGENCE)
  // -------------------------------------------------------------
  ctx.save();
  ctx.translate(prismX, prismY);
  const rot = Math.sin(t * 0.8) * 0.1;
  ctx.rotate(rot);

  // Outer diamond glow
  const glowRad = 80 + Math.sin(t * 3) * 15;
  const pGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, glowRad);
  pGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  pGlow.addColorStop(0.3, 'rgba(56, 189, 248, 0.7)');
  pGlow.addColorStop(0.7, 'rgba(168, 85, 247, 0.4)');
  pGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = pGlow;
  ctx.beginPath();
  ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
  ctx.fill();

  // Diamond facets
  const dW = 55, dH = 80;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(0, -dH);
  ctx.lineTo(dW, 0);
  ctx.lineTo(0, dH);
  ctx.lineTo(-dW, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Internal facet lines
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -dH);
  ctx.lineTo(0, dH);
  ctx.moveTo(-dW, 0);
  ctx.lineTo(dW, 0);
  ctx.stroke();

  ctx.restore();

  // -------------------------------------------------------------
  // REFRACTED SPECTRUM BEAM INTO COSMOS (UPWARD)
  // -------------------------------------------------------------
  ctx.save();
  const beamHeight = 400;
  const beamGrad = ctx.createLinearGradient(prismX, prismY - 60, prismX, prismY - beamHeight);
  beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  beamGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.6)');
  beamGrad.addColorStop(0.8, 'rgba(236, 72, 153, 0.4)');
  beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(prismX - 15, prismY - 60);
  ctx.lineTo(prismX - 250, prismY - beamHeight);
  ctx.lineTo(prismX + 250, prismY - beamHeight);
  ctx.lineTo(prismX + 15, prismY - 60);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // -------------------------------------------------------------
  // CHARACTER: MAGI ELEVATING THE UNIFIED PRISM
  // -------------------------------------------------------------
  const magiX = 960, magiY = 910;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  // Both hands raised to channel the prism
  const rHand = [prismX + 45, prismY + 70];
  const lHand = [prismX - 45, prismY + 70];

  const rArm = solve2BoneIK([magiX + 12, magiY - 130], rHand, 65, 65, 1);
  const lArm = solve2BoneIK([magiX - 12, magiY - 130], lHand, 65, 65, -1);

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

  // -------------------------------------------------------------
  // OUTRO / CHANNEL CREST & TITLE
  // -------------------------------------------------------------
  if (t > 24.0) {
    const endAlpha = Math.min(1.0, (t - 24.0) / 2.0);
    ctx.save();
    ctx.globalAlpha = endAlpha;

    // Channel badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(560, 80, 800, 110, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 36px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('PROGRAMS MAGIC', 960, 130);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px NotoSans';
    ctx.fillText('SUBSCRIBE & EXPLORE THE LIVING ARCHITECTURE OF AI', 960, 165);

    ctx.restore();
  }

  // HUD Insight Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(360, 950, 1200, 90, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE UNIFIED GEOMETRY OF THOUGHT:  Beyond the Boundaries of Language', 960, 985);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Sight, sound, and language are not isolated silos—they are reflections of a single shared universe.', 960, 1015);
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 6 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 6 1080p Render Complete! Output: ${OUTPUT}`);
