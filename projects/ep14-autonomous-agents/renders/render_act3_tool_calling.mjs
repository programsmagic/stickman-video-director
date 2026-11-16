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
const VOICE = path.resolve('projects/ep14-autonomous-agents/build/narration/act3.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP14-Act3-ToolCalling-1080p.mp4');
const SFX_FILE = '/tmp/ep14_act3_sfx.wav';
const MIX_FILE = '/tmp/ep14_act3_mix.wav';

console.log(`=== EP14 ACT 3: TOOL CALLING & THE GRAMMAR OF SILICON ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 58291;
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

  // Heavy hydraulic press clamp sounds
  const addHydraulicStamp = (t0) => {
    // Air hiss
    addStereo(t0, 0.4,
      (t) => noise() * 0.3 * (1 - t / 0.4),
      (t) => noise() * 0.3 * (1 - t / 0.4),
      0.30
    );
    // Metallic impact thud
    addStereo(t0 + 0.3, 0.8,
      (t) => (Math.sin(2 * Math.PI * 120 * t) + noise() * 0.4) * Math.exp(-t * 6),
      (t) => (Math.sin(2 * Math.PI * 122 * t) + noise() * 0.4) * Math.exp(-t * 6),
      0.60
    );
  };

  addHydraulicStamp(6.0);
  addHydraulicStamp(18.0);
  addHydraulicStamp(32.0);

  // Digital validation chime at t = 24.0s
  addStereo(24.0, 1.5,
    (t) => (Math.sin(2 * Math.PI * 880 * t) + Math.sin(2 * Math.PI * 1760 * t) * 0.5) * Math.exp(-t * 5),
    (t) => (Math.sin(2 * Math.PI * 884 * t) + Math.sin(2 * Math.PI * 1768 * t) * 0.5) * Math.exp(-t * 5),
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

  // Background: Precision Engineering Blueprint
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, '#060b18');
  bgGrad.addColorStop(0.5, '#0d1833');
  bgGrad.addColorStop(1, '#050a16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Blueprint grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Title Banner
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('STRUCTURED TOOL CALLING: CONSTRAINED LOGIT DECODING', 960, 68);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px NotoSans';
  ctx.fillText('Transforming Unstructured Thoughts into Deterministic JSON Function Calls', 960, 102);

  // Left Section: Unstructured Natural Language Input Stream
  const inX = 140, inY = 220;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(inX, inY, 360, 440, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 20px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('UNSTRUCTURED THOUGHTS', inX + 180, inY + 40);

  const rawLines = [
    'I need to inspect the current',
    'repository files to locate',
    'the failing test file...',
    '',
    'Maybe I should run the ls',
    'command with the -la flag',
    'in the terminal console?'
  ];
  ctx.font = 'italic 16px NotoSans';
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'left';
  rawLines.forEach((l, i) => {
    ctx.fillText(l, inX + 25, inY + 90 + i * 28);
  });

  // Center Hydraulic Stamping Press
  const pressX = 660, pressY = 220, pressW = 600, pressH = 440;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(pressX, pressY, pressW, pressH, 16);
  ctx.fill();
  ctx.stroke();

  // Press Header
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('HYDRAULIC SCHEMA STAMPING PRESS', pressX + pressW / 2, pressY + 45);

  // Stamping ram movement
  const clamp = Math.abs(Math.sin(t * 2.5));
  const ramY = pressY + 70 + clamp * 30;

  ctx.fillStyle = '#475569';
  ctx.fillRect(pressX + 60, ramY, pressW - 120, 25);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(pressX + 80, ramY + 25, pressW - 160, 15);

  // Stamped JSON Code Block
  const jsonBoxY = pressY + 160;
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(pressX + 40, jsonBoxY, pressW - 80, 240, 10);
  ctx.fill();
  ctx.stroke();

  const codeLines = [
    '{',
    '  "name": "run_command",',
    '  "arguments": {',
    '    "command": "ls -la",',
    '    "timeout": 5000',
    '  }',
    '}'
  ];
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'left';
  codeLines.forEach((cl, idx) => {
    if (cl.includes('"name"') || cl.includes('"arguments"')) ctx.fillStyle = '#38bdf8';
    else if (cl.includes('"ls -la"')) ctx.fillStyle = '#fbbf24';
    else if (cl.includes('5000')) ctx.fillStyle = '#a78bfa';
    else ctx.fillStyle = '#e2e8f0';
    ctx.fillText(cl, pressX + 70, jsonBoxY + 45 + idx * 28);
  });

  // Right Section: Validated Tool Execution Socket
  const outX = 1420, outY = 220;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(outX, outY, 360, 440, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 20px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('DETERMINISTIC API CALL', outX + 180, outY + 40);

  const perks = [
    '• Logits constrained by schema grammar',
    '• Zero regex parsing hallucinations',
    '• Valid parameter types guaranteed',
    '• Instant machine-to-machine execution'
  ];
  ctx.font = '16px NotoSans';
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'left';
  perks.forEach((p, i) => {
    ctx.fillText(p, outX + 25, outY + 110 + i * 36);
  });

  // Caliper overlay checking the JSON block
  const calX = pressX + 400, calY = jsonBoxY + 120;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(calX, calY - 40);
  ctx.lineTo(calX, calY + 40);
  ctx.lineTo(calX + 25, calY + 40);
  ctx.moveTo(calX, calY - 40);
  ctx.lineTo(calX + 25, calY - 40);
  ctx.stroke();

  // Character: Magi inspecting the JSON Stamp
  const magiX = 540, magiY = 880;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  // Arm IK targets: Right hand pointing with caliper at JSON code
  const rHand = [pressX + 80, jsonBoxY + 80];
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
  ctx.fillText('TOOL CALLING:  Turning Probabilities into Deterministic Function Calls', 960, 980);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('The model ceases to be a chatbot and becomes a high-speed API compiler.', 960, 1010);
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 3 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 3 1080p Render Complete! Output: ${OUTPUT}`);
