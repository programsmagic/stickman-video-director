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
const VOICE = path.resolve('projects/ep13-multimodal-mind/build/narration/act5.wav');

while (!fs.existsSync(VOICE)) {
  execSync('sleep 1');
}

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${VOICE}"`).toString().trim());
const TOTAL_FRAMES = Math.ceil(FPS * dur);

const OUT_DIR = path.resolve('exports');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUTPUT = path.join(OUT_DIR, 'EP13-Act5-Omnimodality-1080p.mp4');
const SFX_FILE = '/tmp/ep13_act5_sfx.wav';
const MIX_FILE = '/tmp/ep13_act5_mix.wav';

console.log(`=== EP13 ACT 5: NATIVE OMNIMODALITY VS FRANKENSTEIN PIPELINES ===`);
console.log(`Duration: ${dur.toFixed(2)}s | Total Frames: ${TOTAL_FRAMES} (1080p @ ${FPS}fps)`);

// 1. PROCEDURAL 48 kHz STEREO FOLEY
{
  const rate = 48000, n = Math.ceil(dur * rate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  let seed = 49182;
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

  // Ambient lab hum
  addStereo(0.5, dur - 1.0,
    (t) => Math.sin(2 * Math.PI * 60 * t) * 0.1,
    (t) => Math.sin(2 * Math.PI * 61 * t) * 0.1,
    0.20
  );

  // Clunky pipeline gear grind (t = 4.0 to 18.0)
  addStereo(4.0, 14.0,
    (t) => {
      const g = (noise() * 0.3 + Math.sin(2 * Math.PI * (80 + 30 * Math.sin(t * 5)) * t) * 0.4);
      return g * (0.8 + 0.2 * Math.sin(t * 12));
    },
    (t) => {
      const g = (noise() * 0.3 + Math.sin(2 * Math.PI * (82 + 30 * Math.sin(t * 5)) * t) * 0.4);
      return g * (0.8 + 0.2 * Math.cos(t * 12));
    },
    0.35
  );

  // Steam hiss / prosody crushed buzzer (t = 17.5)
  addStereo(17.5, 2.0,
    (t) => noise() * Math.exp(-t * 2) * 0.4,
    (t) => noise() * Math.exp(-t * 2) * 0.4,
    0.40
  );

  // Native omnimodal crystal resonance ignition (t = 26.0)
  addStereo(26.0, 8.0,
    (t) => Math.sin(2 * Math.PI * (220 + t * 40) * t) * Math.min(1, t) * Math.exp(-t * 0.15) * 0.3,
    (t) => Math.sin(2 * Math.PI * (224 + t * 40) * t) * Math.min(1, t) * Math.exp(-t * 0.15) * 0.3,
    0.45
  );

  // Fast 280ms quantum chime & ping (t = 42.0)
  addStereo(42.0, 1.5,
    (t) => (Math.sin(2 * Math.PI * 1046.5 * t) + Math.sin(2 * Math.PI * 2093 * t) * 0.5) * Math.exp(-t * 5),
    (t) => (Math.sin(2 * Math.PI * 1050 * t) + Math.sin(2 * Math.PI * 2100 * t) * 0.5) * Math.exp(-t * 5),
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

  // Background: Dark tech architectural gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, '#070b14');
  bgGrad.addColorStop(0.5, '#0b1424');
  bgGrad.addColorStop(1, '#050810');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Stage dividing line
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(960, 100);
  ctx.lineTo(960, 920);
  ctx.stroke();
  ctx.setLineDash([]);

  // Title Banner
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE ARCHITECTURAL SHIFT: FROM PIPELINES TO NATIVE OMNIMODALITY', 960, 68);

  // -------------------------------------------------------------
  // LEFT PANEL: THE FRANKENSTEIN PIPELINE (3 SEPARATE MODELS)
  // -------------------------------------------------------------
  const leftAlpha = t < 26.0 ? 1.0 : 0.45;
  ctx.save();
  ctx.globalAlpha = leftAlpha;

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('THE CLUNKY PIPELINE: 3 SEPARATE MODELS', 480, 120);

  // Subtitle
  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans';
  ctx.fillText('Speech-to-Text  ➔  Text LLM  ➔  Text-to-Speech', 480, 148);

  // 3 Sequential Stage Boxes
  const stages = [
    { title: '1. ASR (Whisper)', desc: 'Audio ➔ Raw Text', y: 200, color: '#f59e0b' },
    { title: '2. Language Model', desc: 'Predict Next Word', y: 350, color: '#38bdf8' },
    { title: '3. TTS Synthesizer', desc: 'Text ➔ Synthetic Audio', y: 500, color: '#ec4899' }
  ];

  stages.forEach((stg, i) => {
    // Stage Box
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = stg.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(240, stg.y, 480, 95, 12);
    ctx.fill();
    ctx.stroke();

    // Stage Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText(stg.title, 270, stg.y + 40);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px NotoSans';
    ctx.fillText(stg.desc, 270, stg.y + 70);

    // Rotating mechanical cog / gear next to box
    const gearX = 660, gearY = stg.y + 47;
    const gearRot = t * (i % 2 === 0 ? 3 : -3);
    ctx.save();
    ctx.translate(gearX, gearY);
    ctx.rotate(gearRot);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();
    for (let c = 0; c < 8; c++) {
      const a = (c * Math.PI) / 4;
      ctx.fillRect(Math.cos(a) * 20 - 3, Math.sin(a) * 20 - 3, 6, 6);
    }
    ctx.restore();

    // Arrow down to next
    if (i < 2) {
      const arrowY = stg.y + 95;
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(480, arrowY + 5);
      ctx.lineTo(480, arrowY + 50);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.moveTo(480, arrowY + 55);
      ctx.lineTo(473, arrowY + 45);
      ctx.lineTo(487, arrowY + 45);
      ctx.fill();
    }
  });

  // Pipeline flaws box
  ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(160, 630, 640, 150, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 20px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('CRUSHED IN TRANSLATION:', 190, 665);

  const flaws = [
    '• Sarcasm, whispers & crying tone stripped away',
    '• Turn-taking lag: 2,500ms – 4,000ms latency',
    '• Cannot interrupt: system is deaf while speaking'
  ];
  ctx.font = '16px NotoSans';
  ctx.fillStyle = '#e2e8f0';
  flaws.forEach((flaw, idx) => {
    ctx.fillText(flaw, 190, 700 + idx * 26);
  });

  // High latency meter
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(160, 805, 640, 32);
  ctx.fillStyle = '#ef4444';
  const lagBarW = Math.min(640, 640 * (Math.min(t, 20.0) / 20.0));
  ctx.fillRect(160, 805, lagBarW, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('LATENCY: +3,200 ms (Clunky & Unnatural)', 480, 827);

  ctx.restore();

  // -------------------------------------------------------------
  // RIGHT PANEL: NATIVE OMNIMODAL STREAM (GPT-4o & GEMINI)
  // -------------------------------------------------------------
  const rightAlpha = t >= 24.0 ? 1.0 : 0.4;
  ctx.save();
  ctx.globalAlpha = rightAlpha;

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 24px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('NATIVE OMNIMODALITY: SINGLE ATTENTION STREAM', 1440, 120);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px NotoSans';
  ctx.fillText('End-to-End Multimodal Transformer Core (No Translations)', 1440, 148);

  // Large Unified Transformer Core Box
  const coreX = 1140, coreY = 200, coreW = 600, coreH = 395;
  const coreGrad = ctx.createLinearGradient(coreX, coreY, coreX + coreW, coreY + coreH);
  coreGrad.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
  coreGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.18)');
  coreGrad.addColorStop(1, 'rgba(168, 85, 247, 0.15)');

  ctx.fillStyle = coreGrad;
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(coreX, coreY, coreW, coreH, 16);
  ctx.fill();
  ctx.stroke();

  // Core header
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 22px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('UNIFIED OMNIMODAL TRANSFORMER', coreX + coreW / 2, coreY + 45);

  // Dynamic Token Stream conveyor inside core
  const tokens = [
    { type: 'AUDIO', label: 'Pitch/Tone (80-ch)', color: '#f59e0b' },
    { type: 'VISION', label: 'Frame Patch 16x16', color: '#06b6d4' },
    { type: 'TEXT', label: 'Word Token', color: '#a855f7' },
    { type: 'AUDIO', label: 'Inflection Wave', color: '#f59e0b' },
    { type: 'VISION', label: 'Facial Emotion', color: '#06b6d4' }
  ];

  const streamOffset = (t * 80) % 180;
  ctx.save();
  ctx.beginPath();
  ctx.rect(coreX + 20, coreY + 70, coreW - 40, 210);
  ctx.clip();

  for (let k = -1; k < 6; k++) {
    const item = tokens[(k + 10) % tokens.length];
    const tokX = coreX + 40 + k * 180 - streamOffset;
    const tokY = coreY + 95;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(tokX, tokY, 160, 95, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = item.color;
    ctx.font = 'bold 16px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText(item.type, tokX + 80, tokY + 35);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '13px NotoSans';
    ctx.fillText(item.label, tokX + 80, tokY + 65);
  }
  ctx.restore();

  // Shared Cross-Attention Lasers inside core
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 1.5;
  for (let line = 0; line < 5; line++) {
    const lx1 = coreX + 60 + line * 110;
    const ly1 = coreY + 290;
    const lx2 = coreX + 120 + ((line * 2) % 5) * 90;
    const ly2 = coreY + 360;
    ctx.beginPath();
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(lx2, ly2);
    ctx.stroke();
  }

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'italic 16px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('Continuous Full Self-Attention Across All Sensory Dimensions', coreX + coreW / 2, coreY + 370);

  // Omnimodal strengths box
  ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(1120, 630, 640, 150, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#6ee7b7';
  ctx.font = 'bold 20px NotoSans';
  ctx.textAlign = 'left';
  ctx.fillText('EMERGENT CAPABILITIES:', 1150, 665);

  const perks = [
    '• Real-time prosody: hears laughter, sighs & whispers',
    '• Interruption handling: listens while talking natively',
    '• Shared unified latents: zero loss of cross-modal context'
  ];
  ctx.font = '16px NotoSans';
  ctx.fillStyle = '#e2e8f0';
  perks.forEach((perk, idx) => {
    ctx.fillText(perk, 1150, 700 + idx * 26);
  });

  // Fast latency meter
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(1120, 805, 640, 32);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(1120, 805, 120, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px NotoSans';
  ctx.textAlign = 'center';
  ctx.fillText('RESPONSE LATENCY: 280 ms (Conversational Speed of Sound)', 1440, 827);

  ctx.restore();

  // -------------------------------------------------------------
  // CHARACTER: MAGI IN THE CENTER
  // -------------------------------------------------------------
  const magiX = 960, magiY = 880;
  drawGroundShadow(ctx, magiX, magiY, 70, 14);

  // Magi points to the left initially, then shifts to the right as omnimodality is praised
  let rHand, lHand;
  if (t < 24.0) {
    // Pointing with left hand to left Frankenstein pipeline
    lHand = [magiX - 120, magiY - 140];
    rHand = [magiX + 30, magiY - 80];
  } else {
    // Gesturing enthusiastically with both hands to right Omnimodal core
    rHand = [magiX + 130, magiY - 150];
    lHand = [magiX - 40, magiY - 90];
  }

  const rArm = solve2BoneIK([magiX + 10, magiY - 130], rHand, 60, 60, 1);
  const lArm = solve2BoneIK([magiX - 10, magiY - 130], lHand, 60, 60, -1);

  drawFigure(ctx, {
    x: magiX,
    y: magiY,
    scale: 1.15,
    color: INK,
    fillColor: '#ffffff',
    hat: 'wizard',
    scarf: true,
    expression: t > 24.0 ? 'happy' : 'curious',
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
  ctx.fillText('NATIVE OMNIMODALITY:  Audio, Video & Text Ingested Without Translation', 960, 980);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '16px NotoSans';
  ctx.fillText('By processing raw sensory tokens in a single Transformer, AI grasps tone, timing, and emotion natively.', 960, 1010);
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
