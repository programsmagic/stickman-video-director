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
const VOICE = path.resolve('projects/ep12-physics-of-diffusion/build/narration/act6.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP12-Act6-FlowMatching-1080p.mp4');
const SFX_FILE = '/tmp/ep12_act6_sfx.wav';
const MIX_FILE = '/tmp/ep12_act6_mix.wav';

console.log(`=== EP12 ACT 6: FLOW MATCHING & THE COSMIC REVERSAL ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 39104;
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

  // Cosmic stardust chimes from t = 1.0s to 12.0s
  addStereo(1.0, 11.0,
    (t) => Math.sin(2 * Math.PI * (1200 + Math.sin(t * 3) * 400) * t) * 0.15 * Math.exp(-((t % 0.8)) * 5),
    (t) => Math.sin(2 * Math.PI * (1220 + Math.sin(t * 3) * 400) * t) * 0.15 * Math.exp(-((t % 0.8)) * 5),
    0.35
  );

  // Staff impact cosmic thunder at t = 12.0s
  addStereo(12.0, 3.5,
    (t) => Math.sin(2 * Math.PI * 65 * Math.exp(-t * 2) * t) * Math.exp(-t * 1.5) + noise() * 0.3 * Math.exp(-t * 3),
    (t) => Math.sin(2 * Math.PI * 70 * Math.exp(-t * 2) * t) * Math.exp(-t * 1.5) + noise() * 0.3 * Math.exp(-t * 3),
    0.70
  );

  // 4 Straight laser highway pulses at t = 22s, 24s, 26s, 28s
  [22.0, 24.0, 26.0, 28.0].forEach((pt, idx) => {
    addStereo(pt, 0.6,
      (t) => Math.sin(2 * Math.PI * (500 + idx * 150) * t) * Math.exp(-t * 8),
      (t) => Math.sin(2 * Math.PI * (510 + idx * 150) * t) * Math.exp(-t * 8),
      0.50
    );
  });

  // Majestic orchestral harp swell at t = 40.0s
  addStereo(40.0, 10.0,
    (t) => Math.sin(2 * Math.PI * 523.25 * t) * 0.2 + Math.sin(2 * Math.PI * 659.25 * t) * 0.2 + Math.sin(2 * Math.PI * 783.99 * t) * 0.2,
    (t) => Math.sin(2 * Math.PI * 528.25 * t) * 0.2 + Math.sin(2 * Math.PI * 664.25 * t) * 0.2 + Math.sin(2 * Math.PI * 788.99 * t) * 0.2,
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

  // Background: Majestic Deep Cosmic Starlight Sky
  const grad = ctx.createRadialGradient(WIDTH * 0.65, HEIGHT * 0.45, 100, WIDTH * 0.5, HEIGHT * 0.5, 900);
  grad.addColorStop(0, '#11183c');
  grad.addColorStop(0.5, '#070c22');
  grad.addColorStop(1, '#02040c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Background swirling nebula stardust
  let sSeed = 29401;
  const numStars = 150;
  for (let i = 0; i < numStars; i++) {
    sSeed = (Math.imul(sSeed, 1664525) + 1013904223) >>> 0;
    const sx = (sSeed / 4294967296) * WIDTH;
    sSeed = (Math.imul(sSeed, 1664525) + 1013904223) >>> 0;
    const sy = (sSeed / 4294967296) * HEIGHT;
    ctx.fillStyle = i % 4 === 0 ? 'rgba(56, 189, 248, 0.6)' : 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center Stage: Flow Matching Straight Highways (X: 1180, Y: 460)
  const cosmicX = 1180, cosmicY = 460;

  if (t < 12.0) {
    // Old Brownian Random Walk: Chaotic tangled glowing threads
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 2;
    for (let w = 0; w < 12; w++) {
      ctx.beginPath();
      let wx = cosmicX - 350;
      let wy = cosmicY - 180 + w * 30;
      ctx.moveTo(wx, wy);
      for (let s = 0; s < 18; s++) {
        wx += 35;
        wy += (Math.sin(s * 1.5 + w) * 25);
        ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    }

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 20px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('CLASSICAL SDE: Meandering Brownian Random Walks (50-1000 Steps)', cosmicX, cosmicY + 220);
  } else {
    // Flow Matching: Straight-Line Deterministic Laser Highways
    const highwayProgress = Math.min(1.0, (t - 12.0) / 4.0);

    for (let h = 0; h < 10; h++) {
      const hy = cosmicY - 180 + h * 38;
      const startX = cosmicX - 350;
      const endX = startX + 700 * highwayProgress;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX, hy);
      ctx.lineTo(endX, hy);
      ctx.stroke();

      // High-speed laser pulses along straight highways
      if (t >= 20.0) {
        const pulseT = ((t * 2.5 + h * 0.15) % 1.0);
        const px = startX + 700 * pulseT;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(px, hy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('FLOW MATCHING: Straight Vector Fields  dx/dt = v_t(x)  (4-10 Steps!)', cosmicX, cosmicY + 230);
  }

  // The Grand Cosmic Masterpiece Artwork crystallizes at (cosmicX, cosmicY) after t = 36s
  if (t >= 36.0) {
    const artAlpha = Math.min(1.0, (t - 36.0) / 5.0);

    ctx.save();
    ctx.globalAlpha = artAlpha;

    // Glowing golden celestial orb
    const orb = ctx.createRadialGradient(cosmicX, cosmicY, 20, cosmicX, cosmicY, 180);
    orb.addColorStop(0, '#fef08a');
    orb.addColorStop(0.4, '#f59e0b');
    orb.addColorStop(0.8, '#ec4899');
    orb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(cosmicX, cosmicY, 180, 0, Math.PI * 2);
    ctx.fill();

    // Stylized Astronaut and Golden Horse in Starlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cosmicX - 30, cosmicY - 40, 40, 0, Math.PI * 2); // Helmet
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(cosmicX - 20, cosmicY - 40, 24, 28, 0, 0, Math.PI * 2); // Visor
    ctx.fill();

    // Horse head silhouette
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.moveTo(cosmicX - 80, cosmicY + 110);
    ctx.lineTo(cosmicX + 60, cosmicY + 40);
    ctx.lineTo(cosmicX + 90, cosmicY - 20);
    ctx.lineTo(cosmicX + 130, cosmicY + 10);
    ctx.lineTo(cosmicX + 100, cosmicY + 60);
    ctx.lineTo(cosmicX + 50, cosmicY + 130);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Character: Magi planting the Surveyor Staff (X: 380, Y: 800)
  const magiX = 380, magiY = 800;
  drawGroundShadow(ctx, magiX, magiY, 80, 16);

  // Staff coordinates
  const staffX = magiX + 110, staffY = magiY - 220;
  const rHand = [staffX, staffY + 80];
  const lHand = [magiX - 40, magiY - 140]; // Left hand waving to audience

  const rArm = solve2BoneIK([magiX + 10, magiY - 130], rHand, 55, 55, 1);
  const lArm = solve2BoneIK([magiX - 10, magiY - 130], lHand, 50, 50, -1);

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

  // Crystal Surveyor Staff
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(staffX, staffY);
  ctx.lineTo(staffX + 10, magiY + 5);
  ctx.stroke();

  // Crystal crown
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(staffX, staffY, 18, 0, Math.PI * 2);
  ctx.fill();

  // Shockwave ring when planted at t = 12s
  if (t >= 12.0 && t < 15.0) {
    const swAge = t - 12.0;
    const swR = swAge * 280;
    ctx.strokeStyle = `rgba(250, 204, 21, ${Math.max(0, 1 - swAge / 3.0)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(staffX + 10, magiY + 5, swR, swR * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Subscribe Badge / End Card (after t = 44s)
  if (t >= 44.0) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
    ctx.beginPath();
    ctx.roundRect(140, 110, 320, 56, 12);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('▶ SUBSCRIBE', 300, 147);
  }

  // HUD Insight Banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(360, 930, 1200, 95, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE FROZEN MIRACLE:  Every AI Image Is Reverse Thermodynamics', 960, 970);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('A universe of noise, bent backwards through the laws of statistical physics until beauty emerges from the void.', 960, 1000);
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
