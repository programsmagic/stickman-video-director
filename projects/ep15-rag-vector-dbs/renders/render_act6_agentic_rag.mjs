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
const VOICE = path.resolve('projects/ep15-rag-vector-dbs/build/narration/act6.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP15-Act6-AgenticRAG-1080p.mp4');
const SFX_FILE = '/tmp/ep15_act6_sfx.wav';
const MIX_FILE = '/tmp/ep15_act6_mix.wav';

console.log(`=== EP15 ACT 6: AGENTIC RAG & THE LIVING MIND ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 93814;
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

  // Holographic console hum
  addStereo(0.5, dur - 1.0,
    (t) => Math.sin(2 * Math.PI * 80 * t) * 0.15,
    (t) => Math.sin(2 * Math.PI * 82 * t) * 0.15,
    0.20
  );

  // Reflection token pings (t = 8.0s, 16.0s, 24.0s)
  const refPings = [8.0, 16.0, 24.0];
  const rFreqs = [1046, 1318, 1568];
  for (let k = 0; k < refPings.length; k++) {
    addStereo(refPings[k], 1.2,
      (t) => Math.sin(2 * Math.PI * rFreqs[k] * t) * Math.exp(-t * 6),
      (t) => Math.sin(2 * Math.PI * (rFreqs[k] + 4) * t) * Math.exp(-t * 6),
      0.45
    );
  }

  // Grand library illumination resonance (t = 36.0s to dur)
  addStereo(36.0, dur - 36.0,
    (t) => (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 880 * t) * 0.4 + Math.sin(2 * Math.PI * 1760 * t) * 0.2) * (0.2 + 0.05 * Math.sin(t * 1.5)),
    (t) => (Math.sin(2 * Math.PI * 443 * t) + Math.sin(2 * Math.PI * 885 * t) * 0.4 + Math.sin(2 * Math.PI * 1765 * t) * 0.2) * (0.2 + 0.05 * Math.cos(t * 1.5)),
    0.40
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

  // Background: Cosmic Neural Dawn
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(0.5, '#08122a');
  bg.addColorStop(1, '#020614');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Perspective Cyber Floor
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.lineWidth = 1.5;
  for (let x = -300; x <= WIDTH + 300; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 680);
    ctx.lineTo((x - 960) * 2.4 + 960, HEIGHT);
    ctx.stroke();
  }
  for (let y = 680; y <= HEIGHT; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Left Side: Self-RAG Reflection Token HUD
  const hudX = 400, hudY = 380;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(hudX - 240, hudY - 190, 480, 420, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px NotoSans, sans-serif';
  ctx.fillText('SELF-RAG COGNITIVE REFLECTION', hudX - 180, hudY - 155);

  // Token 1: [Retrieve]
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(hudX - 210, hudY - 120, 420, 65, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('[Retrieve: YES]', hudX - 190, hudY - 95);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Autonomous Decision: Fact lookup required', hudX - 190, hudY - 72);

  // Token 2: [IsRel]
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(hudX - 210, hudY - 40, 420, 65, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('[IsRel: RELEVANT]', hudX - 190, hudY - 15);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Relevance Critique: Passage directly answers prompt', hudX - 190, hudY + 8);

  // Token 3: [IsSup]
  ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(hudX - 210, hudY + 40, 420, 65, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('[IsSup: FULLY GROUNDED]', hudX - 190, hudY + 65);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px NotoSans, sans-serif';
  ctx.fillText('Attribution: Zero hallucination, strict factual backing', hudX - 190, hudY + 88);

  // Corrective RAG Web Fallback Badge
  ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(hudX - 210, hudY + 120, 420, 50, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a855f7';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('Corrective RAG: Autonomous Web Fallback Enabled', hudX - 190, hudY + 150);

  // Right Side: Grand Illumination of the Infinite Library Cosmos
  const cosX = 1380, cosY = 400;

  // Giant Celestial Radial Glow
  const cosGlow = ctx.createRadialGradient(cosX, cosY, 40, cosX, cosY, 320);
  cosGlow.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
  cosGlow.addColorStop(0.5, 'rgba(16, 185, 129, 0.2)');
  cosGlow.addColorStop(0.8, 'rgba(245, 158, 11, 0.1)');
  cosGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = cosGlow;
  ctx.beginPath();
  ctx.arc(cosX, cosY, 320, 0, Math.PI * 2);
  ctx.fill();

  // Floating Constellation of Knowledge Nodes
  const numNodes = 14;
  const nodes = [];
  for (let k = 0; k < numNodes; k++) {
    const angle = (k / numNodes) * Math.PI * 2 + t * 0.15;
    const dist = 110 + (k % 3) * 60;
    nodes.push({
      x: cosX + Math.cos(angle) * dist,
      y: cosY + Math.sin(angle) * dist,
      color: k % 3 === 0 ? '#38bdf8' : k % 3 === 1 ? '#10b981' : '#f59e0b'
    });
  }

  // Connecting laser bridges
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if ((i + j) % 3 === 0) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }

  // Draw glowing knowledge stars
  for (const nd of nodes) {
    ctx.fillStyle = nd.color;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Center Core: Living External Brain
  const corePulse = Math.sin(t * 5) * 5;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cosX, cosY, 26 + corePulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 20px NotoSans, sans-serif';
  ctx.fillText('THE LIVING MEMORY', cosX - 105, cosY + 70);

  // 3. Stickman Magi Looking up at the Living External Mind
  const magiX = 870, magiY = 720;
  const breath = idleBreath(frame);

  drawGroundShadow(ctx, magiX, magiY, 70);

  const figure = {
    head: { x: magiX, y: 390 + breath, radius: 34, tilt: 0.18 },
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
        target: { x: hudX + 180, y: hudY + 40 }, // Resting hand on HUD
        pole: { x: magiX - 45, y: 460 }
      },
      upperLength: 68,
      lowerLength: 70
    },
    rightArm: {
      ik: {
        target: { x: cosX - 140, y: cosY - 20 }, // Extending hand to the living memory
        pole: { x: magiX + 45, y: 460 }
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

  // Top Master Badge
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(80, 40, 720, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans, sans-serif';
  ctx.fillText('EPISODE 09 • AGENTIC RAG & THE VERIFIED LIVING MIND', 105, 74);

  const rawBytes = Buffer.from(canvas.data());
  const canWrite = ffmpeg.stdin.write(rawBytes);
  if (!canWrite) {
    await once(ffmpeg.stdin, 'drain');
  }

  if (frame % 300 === 0 || frame === TOTAL_FRAMES - 1) {
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
