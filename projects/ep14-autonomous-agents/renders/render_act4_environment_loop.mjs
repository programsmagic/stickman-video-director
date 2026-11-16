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
const VOICE = path.resolve('projects/ep14-autonomous-agents/build/narration/act4.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP14-Act4-EnvironmentLoop-1080p.mp4');
const SFX_FILE = '/tmp/ep14_act4_sfx.wav';
const MIX_FILE = '/tmp/ep14_act4_mix.wav';

console.log(`=== EP14 ACT 4: THE ENVIRONMENT EXECUTION LOOP ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 91823;
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

  // Keyboard rapid typing clicks (t = 5.0 to 12.0)
  for (let s = 5.0; s < 12.0; s += 0.15) {
    addStereo(s, 0.04,
      (t) => (Math.sin(2 * Math.PI * 2200 * t) + noise() * 0.4) * Math.exp(-t * 80),
      (t) => (Math.sin(2 * Math.PI * 2220 * t) + noise() * 0.4) * Math.exp(-t * 80),
      0.35
    );
  }

  // Robotic servo whir (t = 16.0 to 22.0)
  addStereo(16.0, 6.0,
    (t) => Math.sin(2 * Math.PI * (350 + Math.sin(t * 4) * 80) * t) * 0.2,
    (t) => Math.sin(2 * Math.PI * (355 + Math.sin(t * 4) * 80) * t) * 0.2,
    0.35
  );

  // Data packet feedback chime at t = 28.0s
  addStereo(28.0, 1.8,
    (t) => (Math.sin(2 * Math.PI * 1046.5 * t) + Math.sin(2 * Math.PI * 1318.5 * t) * 0.6) * Math.exp(-t * 4),
    (t) => (Math.sin(2 * Math.PI * 1052 * t) + Math.sin(2 * Math.PI * 1324 * t) * 0.6) * Math.exp(-t * 4),
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

  // Background: Cyber Workshop Atmosphere
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, '#040814');
  bgGrad.addColorStop(0.5, '#0b162c');
  bgGrad.addColorStop(1, '#050916');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Title Banner
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE ENVIRONMENT EXECUTION HARNESS', 960, 68);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '18px NotoSans';
  ctx.fillText('Bridging In-Context Predictions to Real-World Physical Computation', 960, 102);

  // Secure Sandbox Perimeter Box
  const sbX = 580, sbY = 160, sbW = 1200, sbH = 580;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(sbX, sbY, sbW, sbH, 16);
  ctx.fill();
  ctx.stroke();

  // Sandbox Security Badge
  ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(sbX + 40, sbY + 25, 340, 38, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('SECURE ISOLATED SANDBOX', sbX + 210, sbY + 50);

  // 1. Terminal Console Window (Inside Sandbox)
  const termX = sbX + 40, termY = sbY + 85, termW = 540, termH = 260;
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(termX, termY, termW, termH, 10);
  ctx.fill();
  ctx.stroke();

  // Terminal title bar
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(termX, termY, termW, 32, [10, 10, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(termX + 20, termY + 16, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(termX + 38, termY + 16, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(termX + 56, termY + 16, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('bash - sandbox session', termX + 75, termY + 21);

  // Terminal commands running
  const termLines = [
    '$ git status',
    'On branch main',
    'Your branch is up to date with origin/main.',
    '$ npm test',
    '✓ 14 test suites passed (100%)'
  ];
  ctx.font = 'bold 15px monospace';
  termLines.forEach((tl, idx) => {
    ctx.fillStyle = tl.startsWith('$') ? '#38bdf8' : tl.startsWith('✓') ? '#10b981' : '#cbd5e1';
    ctx.fillText(tl, termX + 20, termY + 65 + idx * 32);
  });

  // 2. Web Browser Viewport Window (Inside Sandbox)
  const browX = sbX + 620, browY = sbY + 85, browW = 540, browH = 260;
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(browX, browY, browW, browH, 10);
  ctx.fill();
  ctx.stroke();

  // Browser Address bar
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(browX, browY, browW, 38, [10, 10, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.roundRect(browX + 40, browY + 8, browW - 60, 24, 6);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = '13px monospace';
  ctx.fillText('https://docs.deepmind.com/api/v2/agents', browX + 55, browY + 24);

  // Simulated Web DOM structure
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(browX + 30, browY + 60, 200, 22);
  ctx.fillStyle = '#334155';
  ctx.fillRect(browX + 30, browY + 95, browW - 60, 14);
  ctx.fillRect(browX + 30, browY + 120, browW - 120, 14);
  ctx.fillRect(browX + 30, browY + 145, browW - 90, 14);

  // 3. Robotic Arm executing tools in sandbox
  const armBaseX = sbX + 580, armBaseY = sbY + 480;
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(armBaseX, armBaseY, 35, 0, Math.PI * 2);
  ctx.fill();

  const armAngle1 = -0.6 + Math.sin(t * 1.5) * 0.3;
  const joint1X = armBaseX + Math.cos(armAngle1) * 140;
  const joint1Y = armBaseY + Math.sin(armAngle1) * 140;

  const armAngle2 = 0.8 + Math.cos(t * 1.5) * 0.3;
  const gripperX = joint1X + Math.cos(armAngle2) * 120;
  const gripperY = joint1Y + Math.sin(armAngle2) * 120;

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(armBaseX, armBaseY);
  ctx.lineTo(joint1X, joint1Y);
  ctx.lineTo(gripperX, gripperY);
  ctx.stroke();

  // Gripper joint
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(gripperX, gripperY, 16, 0, Math.PI * 2);
  ctx.fill();

  // 4. Returning Observation Stream (Conveyor back to Agent)
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sbX + 40, sbY + 460);
  ctx.lineTo(sbX - 120, sbY + 540);
  ctx.lineTo(480, 800);
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 18px NotoSans';
  ctx.fillText('OBSERVATION FEEDBACK STREAM (stdout / exit code 0)', sbX + 60, sbY + 450);

  // Character: Magi monitoring on the left
  const magiX = 320, magiY = 880;
  drawGroundShadow(ctx, magiX, magiY, 75, 14);

  // Arm IK targets: Right hand holding monitor tablet
  const rHand = [magiX + 60, magiY - 110];
  const lHand = [magiX - 45, magiY - 80];

  const rArm = solve2BoneIK([magiX + 12, magiY - 130], rHand, 60, 60, 1);
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

  // Tablet in Magi's right hand
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rHand[0] - 15, rHand[1] - 30, 65, 50, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(rHand[0] - 8, rHand[1] - 22, 50, 8);
  ctx.fillRect(rHand[0] - 8, rHand[1] - 10, 35, 6);

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
  ctx.fillText('THE ENVIRONMENT:  Where Thoughts Become Real-World Actions', 960, 980);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('The AI delegates computation to the operating system, receiving objective ground truth in return.', 960, 1010);
  ctx.textAlign = 'left';

  // Stream raw bytes into FFmpeg stdin
  const rawBytes = Buffer.from(canvas.data());
  const ok = ffmpeg.stdin.write(rawBytes);
  if (!ok) await once(ffmpeg.stdin, 'drain');

  if (frame % 200 === 0 || frame === TOTAL_FRAMES - 1) {
    console.log(`Act 4 1080p Render: ${((frame / TOTAL_FRAMES) * 100).toFixed(1)}% (${frame}/${TOTAL_FRAMES})`);
  }
}

ffmpeg.stdin.end();
await once(ffmpeg, 'close');
console.log(`\n🎉 Act 4 1080p Render Complete! Output: ${OUTPUT}`);
