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
const VOICE = path.resolve('projects/ep14-autonomous-agents/build/narration/act6.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP14-Act6-MultiAgentSwarms-1080p.mp4');
const SFX_FILE = '/tmp/ep14_act6_sfx.wav';
const MIX_FILE = '/tmp/ep14_act6_mix.wav';

console.log(`=== EP14 ACT 6: MULTI-AGENT SWARMS & THE FUTURE OF WORK ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 89213;
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
    (t) => Math.sin(2 * Math.PI * 55 * t) * 0.15,
    (t) => Math.sin(2 * Math.PI * 56 * t) * 0.15,
    0.25
  );

  // Swarm message pulses across board (t = 6.0 to 28.0)
  for (let s = 6.0; s < 28.0; s += 2.5) {
    addStereo(s, 0.4,
      (t) => Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 12),
      (t) => Math.sin(2 * Math.PI * 1210 * t) * Math.exp(-t * 12),
      0.30
    );
  }

  // Harmonic chord crescendo at t = 24.0s
  addStereo(24.0, 16.0,
    (t) => {
      const c1 = Math.sin(2 * Math.PI * 261.63 * t); // C4
      const c2 = Math.sin(2 * Math.PI * 329.63 * t); // E4
      const c3 = Math.sin(2 * Math.PI * 392.00 * t); // G4
      return (c1 + c2 * 0.8 + c3 * 0.7) * Math.min(t / 6.0, 1.0) * 0.15;
    },
    (t) => {
      const c1 = Math.sin(2 * Math.PI * 262.5 * t);
      const c2 = Math.sin(2 * Math.PI * 330.5 * t);
      const c3 = Math.sin(2 * Math.PI * 393.0 * t);
      return (c1 + c2 * 0.8 + c3 * 0.7) * Math.min(t / 6.0, 1.0) * 0.15;
    },
    0.35
  );

  // Grand finale chime at t = 42.0s
  addStereo(42.0, 5.0,
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

  // Background: Deep Cosmic Constellation
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, '#030612');
  bgGrad.addColorStop(0.5, '#071026');
  bgGrad.addColorStop(1, '#02040d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Starfield
  let sSeed = 68412;
  const pseudoRandom = () => {
    sSeed = (Math.imul(sSeed, 1664525) + 1013904223) >>> 0;
    return sSeed / 4294967296;
  };
  for (let s = 0; s < 160; s++) {
    const sx = pseudoRandom() * WIDTH;
    const sy = pseudoRandom() * HEIGHT * 0.85;
    const sr = pseudoRandom() * 2 + 0.5;
    const sa = 0.3 + 0.7 * Math.sin(t * 2 + s);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, sa * 0.8)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center: Shared Luminous Message Board
  const mbX = 960, mbY = 460;
  const mbW = 640, mbH = 340;

  // Board Glow
  const boardGlow = ctx.createRadialGradient(mbX, mbY, 40, mbX, mbY, 380);
  boardGlow.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
  boardGlow.addColorStop(0.6, 'rgba(168, 85, 247, 0.15)');
  boardGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = boardGlow;
  ctx.beginPath();
  ctx.arc(mbX, mbY, 380, 0, Math.PI * 2);
  ctx.fill();

  // Board Surface
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(mbX - mbW / 2, mbY - mbH / 2, mbW, mbH, 16);
  ctx.fill();
  ctx.stroke();

  // Board Header
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('SHARED SWARM MESSAGE BOARD', mbX, mbY - mbH / 2 + 40);

  // Live Swarm Messages
  const swarmMsgs = [
    { sender: '@researcher', text: 'Fetched RFC schema: 4 tools defined', color: '#38bdf8' },
    { sender: '@coder', text: 'Implemented feature in isolated worktree', color: '#f59e0b' },
    { sender: '@tester', text: 'All 28 unit tests PASS (0 regressions)', color: '#10b981' },
    { sender: '@reviewer', text: 'Security audit verified: 0 vulnerabilities', color: '#c084fc' }
  ];
  ctx.font = '15px monospace';
  ctx.textAlign = 'left';
  swarmMsgs.forEach((sm, idx) => {
    const msgY = mbY - mbH / 2 + 95 + idx * 52;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.fillRect(mbX - mbW / 2 + 25, msgY - 22, mbW - 50, 40);

    ctx.fillStyle = sm.color;
    ctx.fillText(sm.sender, mbX - mbW / 2 + 40, msgY + 4);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(': ' + sm.text, mbX - mbW / 2 + 160, msgY + 4);
  });

  // Four Swarm Nodes
  const nodes = [
    { name: 'RESEARCHER', x: mbX - 440, y: mbY - 140, color: '#38bdf8' },
    { name: 'CODER', x: mbX + 440, y: mbY - 140, color: '#f59e0b' },
    { name: 'TESTER', x: mbX - 440, y: mbY + 140, color: '#10b981' },
    { name: 'REVIEWER', x: mbX + 440, y: mbY + 140, color: '#c084fc' }
  ];

  nodes.forEach((nd) => {
    // Laser data bus connecting node to board
    ctx.strokeStyle = nd.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nd.x, nd.y);
    ctx.lineTo(mbX + (nd.x > mbX ? mbW / 2 : -mbW / 2), nd.y);
    ctx.stroke();

    // Node Box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = nd.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(nd.x - 100, nd.y - 45, 200, 90, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText(nd.name, nd.x, nd.y - 8);

    ctx.fillStyle = nd.color;
    ctx.font = 'bold 13px NotoSans';
    ctx.fillText('AUTONOMOUS AGENT', nd.x, nd.y + 18);
  });

  // Character: Magi as the Coordinator below
  const magiX = 960, magiY = 910;
  drawGroundShadow(ctx, magiX, magiY, 80, 16);

  // Both hands raised commanding the swarm
  const rHand = [mbX + 120, mbY + 160];
  const lHand = [mbX - 120, mbY + 160];

  const rArm = solve2BoneIK([magiX + 14, magiY - 130], rHand, 65, 65, 1);
  const lArm = solve2BoneIK([magiX - 14, magiY - 130], lHand, 65, 65, -1);

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

  // End-slate branding (t > 26s)
  if (t > 26.0) {
    const endAlpha = Math.min(1.0, (t - 26.0) / 2.0);
    ctx.save();
    ctx.globalAlpha = endAlpha;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(560, 75, 800, 110, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 36px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('PROGRAMS MAGIC', 960, 125);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px NotoSans';
    ctx.fillText('SUBSCRIBE & MASTER THE LIVING ARCHITECTURE OF AI', 960, 160);

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
  ctx.fillText('MULTI-AGENT SWARMS:  From Chatbot to Autonomous Software Engineering', 960, 985);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Specialized roles collaborating over shared message boards represent the true future of work.', 960, 1015);
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
