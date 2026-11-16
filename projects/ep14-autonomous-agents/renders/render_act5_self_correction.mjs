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
const VOICE = path.resolve('projects/ep14-autonomous-agents/build/narration/act5.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP14-Act5-SelfCorrection-1080p.mp4');
const SFX_FILE = '/tmp/ep14_act5_sfx.wav';
const MIX_FILE = '/tmp/ep14_act5_mix.wav';

console.log(`=== EP14 ACT 5: SELF-CORRECTION & REFLEXION ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 74912;
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

  // Error buzzer sound at t = 4.0s
  addStereo(4.0, 1.2,
    (t) => (Math.sin(2 * Math.PI * 180 * t) + noise() * 0.3) * Math.exp(-t * 2.5),
    (t) => (Math.sin(2 * Math.PI * 185 * t) + noise() * 0.3) * Math.exp(-t * 2.5),
    0.45
  );

  // Reflexion mirror hum (t = 14.0 to 32.0)
  addStereo(14.0, 18.0,
    (t) => Math.sin(2 * Math.PI * (440 + Math.sin(t * 0.5) * 20) * t) * 0.12,
    (t) => Math.sin(2 * Math.PI * (443 + Math.sin(t * 0.5) * 20) * t) * 0.12,
    0.30
  );

  // Keyboard rapid edit click at t = 26.0s
  for (let s = 26.0; s < 28.5; s += 0.15) {
    addStereo(s, 0.05,
      (t) => (Math.sin(2 * Math.PI * 2500 * t) + noise() * 0.4) * Math.exp(-t * 80),
      (t) => (Math.sin(2 * Math.PI * 2520 * t) + noise() * 0.4) * Math.exp(-t * 80),
      0.30
    );
  }

  // Success chime / ding at t = 36.0s
  addStereo(36.0, 2.0,
    (t) => (Math.sin(2 * Math.PI * 1046.5 * t) + Math.sin(2 * Math.PI * 2093 * t) * 0.5) * Math.exp(-t * 4),
    (t) => (Math.sin(2 * Math.PI * 1050 * t) + Math.sin(2 * Math.PI * 2100 * t) * 0.5) * Math.exp(-t * 4),
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

  // Background: Cybernetic Testing Laboratory
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, '#060a16');
  bgGrad.addColorStop(0.5, '#0b152d');
  bgGrad.addColorStop(1, '#050814');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Title Banner
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('SELF-CORRECTION & REFLEXION: LEARNING FROM MISTAKES', 960, 68);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '18px NotoSans';
  ctx.fillText('Shinn et al. (MIT & Princeton, 2023) — Linguistic Reinforcement Learning', 960, 102);

  // 1. Left Panel: The Initial Failure (Stack Trace)
  const failX = 140, failY = 180, failW = 480, failH = 460;
  ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
  ctx.strokeStyle = t < 26.0 ? '#ef4444' : 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(failX, failY, failW, failH, 12);
  ctx.fill();
  ctx.stroke();

  // Status Badge
  ctx.fillStyle = t < 26.0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(100, 116, 139, 0.2)';
  ctx.strokeStyle = t < 26.0 ? '#ef4444' : '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(failX + 30, failY + 25, 220, 36, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = t < 26.0 ? '#fca5a5' : '#94a3b8';
  ctx.font = 'bold 16px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText(t < 26.0 ? 'FAIL: ERROR OBSERVED' : 'ERROR PARSED', failX + 140, failY + 48);

  // Stack trace text
  const errorLines = [
    'TypeError: Cannot read properties',
    'of undefined (reading "execute")',
    '',
    'at AgentRunner.step (runner.mjs:42)',
    'at processTicks (internal/process:78)',
    '',
    'Exit Code: 1 (Process Terminated)'
  ];
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  errorLines.forEach((el, idx) => {
    ctx.fillStyle = el.startsWith('TypeError') ? '#f87171' : el.startsWith('Exit') ? '#ef4444' : '#94a3b8';
    ctx.fillText(el, failX + 30, failY + 110 + idx * 30);
  });

  // 2. Center: The Reflexion Mirror
  const mirX = 720, mirY = 160, mirW = 480, mirH = 500;
  ctx.save();
  const mirGrad = ctx.createLinearGradient(mirX, mirY, mirX + mirW, mirY + mirH);
  mirGrad.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
  mirGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.12)');
  mirGrad.addColorStop(1, 'rgba(16, 185, 129, 0.15)');

  ctx.fillStyle = mirGrad;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(mirX, mirY, mirW, mirH, 16);
  ctx.fill();
  ctx.stroke();

  // Mirror Header
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE REFLEXION WORKING MEMORY', mirX + mirW / 2, mirY + 45);

  // Self-reflection notes inside mirror
  const refNotes = [
    '• DIAGNOSIS:',
    '  Runner tried to call "execute" before',
    '  tool initialization completed.',
    '',
    '• VERBAL HEURISTIC:',
    '  "I must await initialize() first',
    '  before dispatching the tool call."',
    '',
    '• TRAJECTORY BACKTRACK:',
    '  Rewriting runner.mjs line 41...'
  ];
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  refNotes.forEach((rn, idx) => {
    ctx.fillStyle = rn.startsWith('•') ? '#fbbf24' : rn.startsWith('  "I must') ? '#34d399' : '#e2e8f0';
    ctx.fillText(rn, mirX + 30, mirY + 100 + idx * 26);
  });
  ctx.restore();

  // 3. Right Panel: Successful Recovery
  const succX = 1300, succY = 180, succW = 480, succH = 460;
  const succAlpha = t > 24.0 ? 1.0 : 0.35;
  ctx.save();
  ctx.globalAlpha = succAlpha;

  ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(succX, succY, succW, succH, 12);
  ctx.fill();
  ctx.stroke();

  // Success Badge
  ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(succX + 30, succY + 25, 240, 36, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#6ee7b7';
  ctx.font = 'bold 16px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('SUCCESS: AUTONOMOUS FIX', succX + 150, succY + 48);

  const fixLines = [
    '$ node runner.mjs',
    '• Initializing sandbox environment...',
    '• Executing tool with valid arguments...',
    '• Response received: 200 OK',
    '',
    '✓ All 14 tests passing!',
    '✓ Zero human intervention required.'
  ];
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  fixLines.forEach((fl, idx) => {
    ctx.fillStyle = fl.startsWith('✓') ? '#34d399' : fl.startsWith('$') ? '#38bdf8' : '#e2e8f0';
    ctx.fillText(fl, succX + 30, succY + 110 + idx * 30);
  });
  ctx.restore();

  // Character: Magi standing in the center-left
  const magiX = 540, magiY = 880;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  // Arm IK targets: Pointing at Reflexion mirror
  const rHand = [mirX + 40, mirY + 280];
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
    expression: t > 28.0 ? 'happy' : 'curious',
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
  ctx.fillText('REFLEXION:  An Error is Not a Crash, It Is an Observation', 960, 980);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('By storing reflective lessons in working memory, the agent backtracks and self-repairs in real time.', 960, 1010);
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
