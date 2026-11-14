import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, ImageData, GlobalFonts } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };

function drawGlowCard(ctx, x, y, w, h, r, fill, stroke, glowColor, glowBlur = 15) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  if (glowBlur > 0 && glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowBlur;
  }
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();
}

async function* readFrames(stream, frameSize) {
  let buf = Buffer.alloc(0);
  for await (const chunk of stream) {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= frameSize) {
      const frame = buf.subarray(0, frameSize);
      buf = buf.subarray(frameSize);
      yield frame;
    }
  }
}

// ===========================================================================
// SHORT 2: DEEPSEEK'S 64-CHEF SECRET
// ===========================================================================
export async function renderShort2() {
  const sourceVideo = path.resolve('exports/EP08-MoE-Kitchen-Masterpiece.mp4');
  const outFile = path.resolve('exports/shorts/Short02-DeepSeek-MoE-Kitchen-9x16.mp4');
  const tempVideo = '/tmp/short02_raw.mp4';
  const tempAudio = '/tmp/short02_audio.wav';

  const DURATION = 44.5;
  const TOTAL_FRAMES = Math.ceil(DURATION * FPS);

  console.log(`\n======================================================`);
  console.log(`Rendering Short 2: DeepSeek's 64-Chef Secret (${TOTAL_FRAMES} frames, ${DURATION}s)`);
  console.log(`======================================================`);

  // 1. Extract audio
  console.log('1. Extracting 48kHz audio slice...');
  await new Promise((res, rej) => {
    const p = spawn('ffmpeg', [
      '-v', 'error', '-y',
      '-ss', '0.0',
      '-t', `${DURATION}`,
      '-i', sourceVideo,
      '-c:a', 'pcm_s16le',
      '-ar', '48000',
      tempAudio
    ]);
    p.on('close', code => code === 0 ? res() : rej(new Error('Audio extract failed')));
  });

  // 2. Decoder
  console.log('2. Spawning source frame decoder...');
  const decoder = spawn('ffmpeg', [
    '-v', 'error',
    '-ss', '0.0',
    '-t', `${DURATION}`,
    '-i', sourceVideo,
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', '1280x720',
    '-r', `${FPS}`,
    '-'
  ]);

  // 3. Encoder
  console.log('3. Spawning vertical 1080x1920 encoder...');
  const encoder = spawn('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', `${WIDTH}x${HEIGHT}`,
    '-r', `${FPS}`,
    '-i', '-',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    tempVideo
  ]);

  const frameSize = 1280 * 720 * 4;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const frameCanvas = createCanvas(1280, 720);
  const fctx = frameCanvas.getContext('2d');

  const captions = [
    { start: 0.0, end: 5.5, title: "PHYSICS WALL", line1: "AI models hit a wall of physics:", line2: "HUNDREDS OF BILLIONS OF WEIGHTS!", highlight: "BILLIONS" },
    { start: 5.5, end: 10.2, title: "POWER CRISIS", line1: "Running every weight for every word", line2: "NEEDS A NUCLEAR POWER PLANT!", highlight: "NUCLEAR" },
    { start: 10.2, end: 15.2, title: "THE SOLUTION", line1: "Enter Mixture of Experts (MoE):", line2: "A 5-star kitchen with 64 master chefs!", highlight: "64 master chefs!" },
    { start: 15.2, end: 19.0, title: "SPECIALIZATION", line1: "Each chef is a specialized expert", line2: "in coding, calculus, science, or law!", highlight: "specialized expert" },
    { start: 19.0, end: 26.0, title: "SMART ROUTING", line1: "When calculus is ordered, you don't wake", line2: "the pastry chef or sushi master!", highlight: "calculus" },
    { start: 26.0, end: 31.0, title: "SLEEP TO SAVE", line1: "Instead, 62 chefs instantly sleep (Zzz),", line2: "SAVING 95% OF THE POWER!", highlight: "SAVING 95%" },
    { start: 31.0, end: 34.8, title: "2 CHEFS COOK", line1: "Only the 2 calculus experts", line2: "SPRING INTO ACTION AND COOK!", highlight: "CALCULUS EXPERTS" },
    { start: 34.8, end: 39.8, title: "DEEPSEEK SECRET", line1: "In DeepSeek-V3: 671 Billion total,", line2: "ONLY 37 BILLION ACTIVE PER TOKEN!", highlight: "37 BILLION ACTIVE" },
    { start: 39.8, end: 44.5, title: "GIANT MIND", line1: "You get the mind of a giant,", line2: "AT A FRACTION OF THE ELECTRIC BILL!", highlight: "FRACTION" }
  ];

  let frameCount = 0;

  for await (const frameData of readFrames(decoder.stdout, frameSize)) {
    if (frameCount >= TOTAL_FRAMES) break;
    const t = frameCount / FPS;

    const imgData = new ImageData(new Uint8ClampedArray(frameData), 1280, 720);
    fctx.putImageData(imgData, 0, 0);

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, '#0C0A09');
    bgGrad.addColorStop(0.3, '#1C1917');
    bgGrad.addColorStop(0.7, '#0C0A09');
    bgGrad.addColorStop(1, '#000000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Warm floating embers
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    for (let p = 0; p < 25; p++) {
      const px = (p * 51 + t * 18) % WIDTH;
      const py = (p * 79 + HEIGHT - (t * 35 + p * 55) % HEIGHT) % HEIGHT;
      const pr = 2 + (p % 3);
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Header
    drawGlowCard(ctx, WIDTH / 2 - 150, 70, 300, 44, 22, '#F59E0B', null, '#F59E0B', 12);
    ctx.fillStyle = '#000000';
    ctx.font = '900 20px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ ARCHITECTURE SECRET', WIDTH / 2, 99);

    ctx.save();
    ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 46px NotoSans';
    ctx.fillText("DEEPSEEK'S 64-CHEF SECRET", WIDTH / 2, 175);
    ctx.restore();

    ctx.fillStyle = '#D6D3D1';
    ctx.font = '700 22px NotoSans';
    ctx.fillText('Mixture-of-Experts Architecture Explained', WIDTH / 2, 215);

    // Captions
    const currentCap = captions.find(c => t >= c.start && t < c.end) || captions[captions.length - 1];
    drawGlowCard(ctx, 40, 250, WIDTH - 80, 160, 24, 'rgba(28, 25, 23, 0.95)', 'rgba(245, 158, 11, 0.5)', 'rgba(245, 158, 11, 0.3)', 15);

    ctx.fillStyle = '#F59E0B';
    ctx.font = '900 16px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText(`• ${currentCap.title} •`, WIDTH / 2, 285);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '900 28px NotoSans';
    ctx.fillText(currentCap.line1, WIDTH / 2, 325);

    ctx.fillStyle = currentCap.highlight && currentCap.line2.includes(currentCap.highlight) ? '#FACC15' : '#FFFFFF';
    ctx.font = '900 32px NotoSans';
    ctx.fillText(currentCap.line2, WIDTH / 2, 375);

    // Main Video Frame
    const vidX = 20;
    const vidY = 440;
    const vidW = 1040;
    const vidH = 585;

    drawGlowCard(ctx, vidX - 4, vidY - 4, vidW + 8, vidH + 8, 20, 'rgba(41, 37, 36, 0.6)', '#F59E0B', 'rgba(245, 158, 11, 0.4)', 20);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(vidX, vidY, vidW, vidH, 16);
    ctx.clip();
    ctx.drawImage(frameCanvas, vidX, vidY, vidW, vidH);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(vidX, vidY, vidW, vidH, 16);
    ctx.stroke();

    // Infographic Dashboard
    const dashY = 1060;
    const dashH = 590;
    drawGlowCard(ctx, 40, dashY, WIDTH - 80, dashH, 24, 'rgba(28, 25, 23, 0.95)', 'rgba(245, 158, 11, 0.4)', 'rgba(0, 0, 0, 0.5)', 15);

    ctx.fillStyle = '#F59E0B';
    ctx.font = '900 20px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText('🍳 64-CHEF MoE RESTAURANT SIMULATION', 75, dashY + 45);

    ctx.fillStyle = '#A8A29E';
    ctx.font = '600 16px NotoSans';
    ctx.textAlign = 'right';
    ctx.fillText(t >= 26.0 ? '62 SLEEPING · 2 ACTIVE' : 'ALL 64 CHEFS READY', WIDTH - 75, dashY + 45);

    // 8x8 Grid of 64 Chef Icons
    const gridCols = 8;
    const gridRows = 8;
    const cellW = 100;
    const cellH = 26;
    const gridStartX = 75;
    const gridStartY = dashY + 68;

    const areChefsSleeping = t >= 26.0;

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const chefIdx = r * gridCols + c + 1;
        const cx = gridStartX + c * (cellW + 16);
        const cy = gridStartY + r * (cellH + 5);

        const isActive = (chefIdx === 18 || chefIdx === 42);

        let cellFill = '#292524';
        let cellStroke = '#44403C';
        let cellText = `#${chefIdx}`;
        let textColor = '#A8A29E';

        if (areChefsSleeping) {
          if (isActive) {
            cellFill = 'rgba(245, 158, 11, 0.4)';
            cellStroke = '#F59E0B';
            cellText = `🔥 #${chefIdx}`;
            textColor = '#FEF08A';
          } else {
            cellFill = 'rgba(15, 23, 42, 0.5)';
            cellStroke = 'rgba(56, 189, 248, 0.2)';
            cellText = `Zzz #${chefIdx}`;
            textColor = '#64748B';
          }
        } else {
          cellFill = 'rgba(245, 158, 11, 0.15)';
          cellStroke = 'rgba(245, 158, 11, 0.4)';
          textColor = '#E7E5E4';
        }

        ctx.fillStyle = cellFill;
        ctx.strokeStyle = cellStroke;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cellW, cellH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = 'bold 12px NotoSans';
        ctx.textAlign = 'center';
        ctx.fillText(cellText, cx + cellW / 2, cy + 18);
      }
    }

    // Parameter Stats Cards
    const statY = dashY + 330;
    const statW = (WIDTH - 180) / 2;

    // Left Card: Total Weights
    drawGlowCard(ctx, 65, statY, statW, 110, 16, 'rgba(41, 37, 36, 0.6)', 'rgba(168, 162, 158, 0.3)', null, 0);
    ctx.fillStyle = '#A8A29E';
    ctx.font = 'bold 14px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL PARAMETERS', 85, statY + 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 28px NotoSans';
    ctx.fillText('671 BILLION', 85, statY + 68);
    ctx.fillStyle = '#78716C';
    ctx.font = '13px NotoSans';
    ctx.fillText('64 Total Experts in Net', 85, statY + 92);

    // Right Card: Active Per Token
    const isActHighlighted = t >= 26.0;
    drawGlowCard(ctx, 85 + statW, statY, statW, 110, 16, isActHighlighted ? 'rgba(245, 158, 11, 0.2)' : 'rgba(41, 37, 36, 0.6)', isActHighlighted ? '#F59E0B' : 'rgba(168, 162, 158, 0.3)', isActHighlighted ? '#F59E0B' : null, isActHighlighted ? 15 : 0);
    ctx.fillStyle = isActHighlighted ? '#F59E0B' : '#A8A29E';
    ctx.font = 'bold 14px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText('ACTIVE PER TOKEN', 105 + statW, statY + 30);
    ctx.fillStyle = '#10B981';
    ctx.font = '900 28px NotoSans';
    ctx.fillText('37 BILLION', 105 + statW, statY + 68);
    ctx.fillStyle = '#A8A29E';
    ctx.font = '13px NotoSans';
    ctx.fillText('Only Top-2 Experts Compute', 105 + statW, statY + 92);

    // Power Savings Progress Meter
    const meterY = dashY + 460;
    drawGlowCard(ctx, 65, meterY, WIDTH - 130, 105, 16, '#0C0A09', 'rgba(16, 185, 129, 0.4)', null, 0);

    const powerSaved = t >= 26.0 ? 94.5 : 0;
    ctx.fillStyle = '#10B981';
    ctx.font = '900 16px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText('⚡ ELECTRICITY SAVINGS EFFICIENCY', 85, meterY + 32);

    ctx.font = '900 22px NotoSans';
    ctx.textAlign = 'right';
    ctx.fillText(`${powerSaved.toFixed(1)}% SAVED`, WIDTH - 85, meterY + 32);

    // Progress Bar Track
    const barX = 85;
    const barY = meterY + 50;
    const barW = WIDTH - 170;
    const barH = 34;

    ctx.fillStyle = '#1C1917';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 17);
    ctx.fill();

    // Fill
    const fillRatio = clamp((t - 24) / 4);
    const curW = barW * (t >= 24 ? fillRatio * 0.945 : 0.05);
    ctx.save();
    ctx.fillStyle = '#10B981';
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(20, curW), barH, 17);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText(t >= 26 ? '62 Sleeping Chefs = 95% Energy Cut' : 'Standard Dense Model = 100% Load', barX + barW / 2, barY + 22);

    // CTA
    const ctaY = 1720;
    const ctaBounce = Math.sin(t * 7) * 4;
    drawGlowCard(ctx, 90, ctaY + ctaBounce, WIDTH - 180, 76, 38, 'rgba(28, 25, 23, 0.95)', '#F59E0B', '#F59E0B', 18);

    ctx.fillStyle = '#F59E0B';
    ctx.font = '900 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('▶️ WATCH FULL EPISODE @PROGRAMSMAGIC ◀️', WIDTH / 2, ctaY + 48 + ctaBounce);

    const outBuffer = canvas.data();
    if (!encoder.stdin.write(outBuffer)) {
      await once(encoder.stdin, 'drain');
    }

    frameCount++;
    if (frameCount % 150 === 0) {
      console.log(`Rendered frame ${frameCount}/${TOTAL_FRAMES} (${(frameCount / TOTAL_FRAMES * 100).toFixed(1)}%)`);
    }
  }

  encoder.stdin.end();

  await new Promise((res, rej) => {
    encoder.on('close', code => code === 0 ? res() : rej(new Error('Encoder failed')));
  });

  console.log('4. Muxing with 48kHz audio...');
  await new Promise((res, rej) => {
    const mux = spawn('ffmpeg', [
      '-v', 'error', '-y',
      '-i', tempVideo,
      '-i', tempAudio,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-movflags', '+faststart',
      '-shortest',
      outFile
    ]);
    mux.on('close', code => code === 0 ? res() : rej(new Error('Muxing failed')));
  });

  console.log(`✓ Short 2 rendered successfully: ${outFile}`);
}

// ===========================================================================
// SHORT 3: WHAT IF YOU HAD A REAL-LIFE SAVE POINT?
// ===========================================================================
export async function renderShort3() {
  const sourceVideo = path.resolve('exports/EP04-Act2-CheatCode-Masterpiece.mp4');
  const outFile = path.resolve('exports/shorts/Short03-Save-Point-Cheat-Code-9x16.mp4');
  const tempVideo = '/tmp/short03_raw.mp4';
  const tempAudio = '/tmp/short03_audio.wav';
  const tempVoiceRaw = '/tmp/short03_voice_raw.wav';
  const tempSfx = '/tmp/short03_sfx.wav';

  const DURATION = 45.0;
  const TOTAL_FRAMES = Math.ceil(DURATION * FPS);

  console.log(`\n======================================================`);
  console.log(`Rendering Short 3: Real-Life Save Point (${TOTAL_FRAMES} frames, ${DURATION}s)`);
  console.log(`======================================================`);

  // 1. Synthesize Procedural Foley aligned to the 45s Short
  console.log('1. Synthesizing procedural Foley for Short 3...');
  {
    const rate = 48000;
    const n = Math.ceil(DURATION * rate);
    const samples = new Float32Array(n);
    let seed = 91823;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    const addChime = (sec, freq = 900, vol = 0.25) => {
      const s = Math.floor(sec * rate);
      for (let i = 0; i < rate * 1.2; i++) {
        const t = i / rate;
        const env = Math.exp(-t * 3.5);
        const wave = Math.sin(2 * Math.PI * freq * t) * 0.5 + Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.3;
        if (s + i < n) samples[s + i] += wave * env * vol;
      }
    };

    const addNapkinSlide = (sec, vol = 0.28) => {
      const s = Math.floor(sec * rate);
      for (let i = 0; i < rate * 0.4; i++) {
        const t = i / rate;
        const env = Math.sin(Math.PI * (t / 0.4));
        const noise = (rand() - 0.5) * env * vol;
        if (s + i < n) samples[s + i] += noise;
      }
    };

    const addBuzzer = (sec, vol = 0.3) => {
      const s = Math.floor(sec * rate);
      for (let i = 0; i < rate * 0.6; i++) {
        const t = i / rate;
        const env = Math.exp(-t * 4);
        const tone = Math.sin(2 * Math.PI * 180 * t) * 0.6 + Math.sin(2 * Math.PI * 360 * t) * 0.4;
        if (s + i < n) samples[s + i] += tone * env * vol;
      }
    };

    const addWristTap = (sec, vol = 0.38) => {
      const s = Math.floor(sec * rate);
      for (let i = 0; i < rate * 0.15; i++) {
        const t = i / rate;
        const env = Math.exp(-t * 45);
        const snap = (rand() - 0.5) * 0.6 + Math.sin(2 * Math.PI * 520 * t) * 0.4;
        if (s + i < n) samples[s + i] += snap * env * vol;
      }
    };

    const addRewindWhoosh = (sec, vol = 0.4) => {
      const s = Math.floor(sec * rate);
      for (let i = 0; i < rate * 1.0; i++) {
        const t = i / rate;
        const freq = 300 + 1200 * (t / 1.0);
        const env = Math.sin(Math.PI * (t / 1.0));
        const noise = ((rand() - 0.5) * 0.5 + Math.sin(2 * Math.PI * freq * t) * 0.5) * env * vol;
        if (s + i < n) samples[s + i] += noise;
      }
    };

    // Cues
    addChime(4.0, 1050, 0.22);    // Fear zeroed chime
    addNapkinSlide(23.5, 0.3);   // Crush slides napkin
    addBuzzer(36.0, 0.35);       // Boss screams YOU'RE FIRED
    addWristTap(39.8, 0.4);      // Wrist tap 1
    addWristTap(40.2, 0.4);      // Wrist tap 2
    addRewindWhoosh(40.6, 0.45); // Rewind flash
    addChime(42.5, 880, 0.25);   // Morning bed reset chime

    const buf = Buffer.alloc(44 + n * 2);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + n * 2, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(rate, 24);
    buf.writeUInt32LE(rate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(n * 2, 40);

    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      buf.writeInt16LE(Math.floor(s < 0 ? s * 32768 : s * 32767), 44 + i * 2);
    }
    fs.writeFileSync(tempSfx, buf);
  }

  // 2. Extract Voice from ch1.wav (53.0 to 98.0s)
  console.log('2. Slicing Bodi narration audio...');
  await new Promise((res, rej) => {
    const p = spawn('ffmpeg', [
      '-v', 'error', '-y',
      '-ss', '53.0',
      '-t', `${DURATION}`,
      '-i', 'projects/ep04-save-point/build/narration/ch1.wav',
      '-c:a', 'pcm_s16le',
      '-ar', '48000',
      tempVoiceRaw
    ]);
    p.on('close', code => code === 0 ? res() : rej(new Error('Voice slice failed')));
  });

  // 3. Mix Voice + Foley
  console.log('3. Mixing Voice + Foley into 48kHz audio track...');
  await new Promise((res, rej) => {
    const mix = spawn('ffmpeg', [
      '-v', 'error', '-y',
      '-i', tempVoiceRaw,
      '-i', tempSfx,
      '-filter_complex', '[0:a]volume=1.05[v];[1:a]volume=0.85[s];[v][s]amix=inputs=2:duration=first:dropout_transition=2[out]',
      '-map', '[out]',
      '-c:a', 'pcm_s16le',
      '-ar', '48000',
      tempAudio
    ]);
    mix.on('close', code => code === 0 ? res() : rej(new Error('Audio mix failed')));
  });

  // 4. Decode video with timing mapping
  // To match 45s:
  // 0 - 8s: fear gauges (video t = 4 to 16, factor ~1.5x)
  // 8 - 25s: crush napkin (video t = 18 to 38)
  // 25 - 38s: boss screaming (video t = 42 to 56)
  // 38 - 45s: wrist tap reset (video t = 57 to 64)
  console.log('4. Spawning video decoder with time mapping...');
  const decoder = spawn('ffmpeg', [
    '-v', 'error',
    '-ss', '4.0',
    '-t', '57.0',
    '-i', sourceVideo,
    '-vf', 'setpts=0.789*PTS', // 57s mapped to 45s
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', '1280x720',
    '-r', `${FPS}`,
    '-'
  ]);

  console.log('5. Spawning vertical 1080x1920 encoder...');
  const encoder = spawn('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', `${WIDTH}x${HEIGHT}`,
    '-r', `${FPS}`,
    '-i', '-',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    tempVideo
  ]);

  const frameSize = 1280 * 720 * 4;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  const frameCanvas = createCanvas(1280, 720);
  const fctx = frameCanvas.getContext('2d');

  const captions = [
    { start: 0.0, end: 4.5, title: "SILENT MANAGER", line1: "Your whole life, fear was your manager:", line2: "FEAR OF LOOKING STUPID & REJECTION!", highlight: "FEAR" },
    { start: 4.5, end: 8.5, title: "FEAR DROPS TO 0%", line1: "Fear of losing money... today it drops to:", line2: "ZERO PERCENT! PURE FREEDOM!", highlight: "ZERO PERCENT!" },
    { start: 8.5, end: 14.0, title: "COFFEE SHOP", line1: "At the coffee shop, your 6-month crush", line2: "is standing right by the counter...", highlight: "crush" },
    { start: 14.0, end: 20.0, title: "NO HESITATION", line1: "Normally you calculate 47 reasons to freeze.", line2: "Today? You say the boldest compliment!", highlight: "boldest compliment!" },
    { start: 20.0, end: 26.0, title: "THE NAPKIN", line1: "They blush, they smile...", line2: "THEY HAND YOU THEIR NUMBER ON A NAPKIN!", highlight: "NUMBER ON A NAPKIN" },
    { start: 26.0, end: 32.0, title: "THE BOSS TRAP", line1: "Then you see your boss pulling in.", line2: "You tell him what you think of Saturday emails!", highlight: "Saturday emails!" },
    { start: 32.0, end: 38.5, title: "YOU'RE FIRED!", line1: "His face turns purple:", line2: "HE SCREAMS THAT YOU'RE FIRED!", highlight: "YOU'RE FIRED!" },
    { start: 38.5, end: 45.0, title: "DOUBLE WRIST TAP", line1: "You smile. Tap your wrists together twice:", line2: "BACK IN BED AT 7:00 AM! (RESET)", highlight: "BACK IN BED" }
  ];

  let frameCount = 0;

  for await (const frameData of readFrames(decoder.stdout, frameSize)) {
    if (frameCount >= TOTAL_FRAMES) break;
    const t = frameCount / FPS;

    const imgData = new ImageData(new Uint8ClampedArray(frameData), 1280, 720);
    fctx.putImageData(imgData, 0, 0);

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, '#020617');
    bgGrad.addColorStop(0.3, '#0F172A');
    bgGrad.addColorStop(0.7, '#020617');
    bgGrad.addColorStop(1, '#000000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Cyan glowing particles
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    for (let p = 0; p < 25; p++) {
      const px = (p * 49 + t * 16) % WIDTH;
      const py = (p * 81 + HEIGHT - (t * 38 + p * 58) % HEIGHT) % HEIGHT;
      const pr = 2 + (p % 3);
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Header
    drawGlowCard(ctx, WIDTH / 2 - 150, 70, 300, 44, 22, '#10B981', null, '#10B981', 12);
    ctx.fillStyle = '#000000';
    ctx.font = '900 20px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('⏳ REAL-LIFE SAVE POINT', WIDTH / 2, 99);

    ctx.save();
    ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 46px NotoSans';
    ctx.fillText("WHAT IF YOU HAD A SAVE POINT?", WIDTH / 2, 175);
    ctx.restore();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 22px NotoSans';
    ctx.fillText('The Psychology of Living Without Consequences', WIDTH / 2, 215);

    // Dynamic Captions
    const currentCap = captions.find(c => t >= c.start && t < c.end) || captions[captions.length - 1];
    drawGlowCard(ctx, 40, 250, WIDTH - 80, 160, 24, 'rgba(15, 23, 42, 0.95)', 'rgba(56, 189, 248, 0.5)', 'rgba(56, 189, 248, 0.3)', 15);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 16px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText(`• ${currentCap.title} •`, WIDTH / 2, 285);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '900 28px NotoSans';
    ctx.fillText(currentCap.line1, WIDTH / 2, 325);

    ctx.fillStyle = currentCap.highlight && currentCap.line2.includes(currentCap.highlight) ? '#FACC15' : '#FFFFFF';
    ctx.font = '900 32px NotoSans';
    ctx.fillText(currentCap.line2, WIDTH / 2, 375);

    // Main Video Frame
    const vidX = 20;
    const vidY = 440;
    const vidW = 1040;
    const vidH = 585;

    drawGlowCard(ctx, vidX - 4, vidY - 4, vidW + 8, vidH + 8, 20, 'rgba(30, 41, 59, 0.6)', '#38BDF8', 'rgba(56, 189, 248, 0.4)', 20);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(vidX, vidY, vidW, vidH, 16);
    ctx.clip();
    ctx.drawImage(frameCanvas, vidX, vidY, vidW, vidH);
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(vidX, vidY, vidW, vidH, 16);
    ctx.stroke();

    // Infographic HUD
    const dashY = 1060;
    const dashH = 590;
    drawGlowCard(ctx, 40, dashY, WIDTH - 80, dashH, 24, 'rgba(15, 23, 42, 0.95)', 'rgba(56, 189, 248, 0.4)', 'rgba(0, 0, 0, 0.5)', 15);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 20px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText('🎮 REAL-LIFE SAVE POINT SYSTEM HUD', 75, dashY + 45);

    ctx.fillStyle = '#10B981';
    ctx.font = '700 16px NotoSans';
    ctx.textAlign = 'right';
    ctx.fillText('DAY 1 · 07:00 AM [ACTIVE]', WIDTH - 75, dashY + 45);

    // Live Fear Meter Dropping
    const fearVal = t < 2.0 ? 98 : (t < 8.0 ? lerp(98, 0, ease((t - 2.0) / 6.0)) : 0);
    const fearBoxY = dashY + 70;
    drawGlowCard(ctx, 65, fearBoxY, WIDTH - 130, 110, 16, '#0B0F19', 'rgba(239, 68, 68, 0.3)', null, 0);

    ctx.fillStyle = fearVal > 20 ? '#EF4444' : '#10B981';
    ctx.font = 'bold 16px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText('LIVE PSYCHOLOGICAL FEAR GAUGE', 85, fearBoxY + 32);

    ctx.font = '900 22px NotoSans';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(fearVal)}% ${fearVal === 0 ? '(FEARLESS)' : ''}`, WIDTH - 85, fearBoxY + 32);

    const fBarX = 85;
    const fBarY = fearBoxY + 50;
    const fBarW = WIDTH - 170;
    const fBarH = 34;

    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(fBarX, fBarY, fBarW, fBarH, 17);
    ctx.fill();

    ctx.save();
    ctx.fillStyle = fearVal > 20 ? '#EF4444' : '#10B981';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(fBarX, fBarY, Math.max(20, fBarW * (fearVal / 100)), fBarH, 17);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText(fearVal > 20 ? 'Standard Anxiety Manager Active' : '✨ Zero Fear: Boldness Superpower Unlocked!', fBarX + fBarW / 2, fBarY + 22);

    // 2 Simulation Event Cards
    const evY = dashY + 200;
    const evW = (WIDTH - 180) / 2;

    // Card 1: Crush Napkin Event
    const isCrushActive = t >= 8.5 && t < 26.0;
    drawGlowCard(ctx, 65, evY, evW, 160, 16, isCrushActive ? 'rgba(244, 63, 94, 0.15)' : 'rgba(30, 41, 59, 0.4)', isCrushActive ? '#F43F5E' : 'rgba(148, 163, 184, 0.2)', isCrushActive ? '#F43F5E' : null, isCrushActive ? 15 : 0);

    ctx.fillStyle = '#F43F5E';
    ctx.font = '900 17px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText('☕ CAFE CRUSH NAPKIN', 85, evY + 32);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 16px NotoSans';
    ctx.fillText('Outcome: 555-0199', 85, evY + 65);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px NotoSans';
    ctx.fillText('• 0 hesitation speaking', 85, evY + 95);
    ctx.fillText('• Direct bold compliment', 85, evY + 120);
    ctx.fillText('• Phone number secured!', 85, evY + 145);

    // Card 2: Boss Screaming Event
    const isBossActive = t >= 26.0 && t < 38.5;
    drawGlowCard(ctx, 85 + evW, evY, evW, 160, 16, isBossActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(30, 41, 59, 0.4)', isBossActive ? '#EF4444' : 'rgba(148, 163, 184, 0.2)', isBossActive ? '#EF4444' : null, isBossActive ? 15 : 0);

    ctx.fillStyle = '#EF4444';
    ctx.font = '900 17px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText("🏢 BOSS: YOU'RE FIRED!", 105 + evW, evY + 32);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 16px NotoSans';
    ctx.fillText('Consequence: 0% REAL', 105 + evW, evY + 65);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px NotoSans';
    ctx.fillText('• Speaks true thoughts', 105 + evW, evY + 95);
    ctx.fillText('• Boss face turns purple', 105 + evW, evY + 120);
    ctx.fillText('• Wrist tap erases timeline', 105 + evW, evY + 145);

    // Reset Trigger Terminal
    const termY = dashY + 380;
    const isReset = t >= 38.5;
    drawGlowCard(ctx, 65, termY, WIDTH - 130, 185, 16, '#0B0F19', isReset ? '#38BDF8' : 'rgba(56, 189, 248, 0.3)', isReset ? '#38BDF8' : null, isReset ? 15 : 0);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('RELOAD TRIGGER: [TAP WRISTS TWICE]', 85, termY + 30);

    ctx.fillStyle = isReset ? '#10B981' : '#FACC15';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(isReset ? '<< STATE RELOADED <<' : 'READY TO REWIND', WIDTH - 85, termY + 30);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';

    if (t < 38.5) {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('> Gesture detector: standby...', 85, termY + 65);
      ctx.fillText('> Memories: accumulating freely without risk', 85, termY + 95);
      ctx.fillText('> Reality: consequence-free sandbox mode', 85, termY + 125);
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('⚡ Two taps will restore 07:00 AM state instantaneously', 85, termY + 155);
    } else {
      ctx.fillStyle = '#FACC15';
      ctx.fillText('> [GESTURE DETECTED] Wrist tap #1 ... Wrist tap #2!', 85, termY + 65);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('> [REWIND] Collapsing timeline... Restoring Day 1 07:00 AM', 85, termY + 95);
      ctx.fillStyle = '#10B981';
      ctx.fillText('✓ Wake up in bed. Boss has 0 memory. Experience preserved!', 85, termY + 125);
      ctx.fillText('✓ Lesson: Consequences are just data.', 85, termY + 155);
    }

    // CTA
    const ctaY = 1720;
    const ctaBounce = Math.sin(t * 7) * 4;
    drawGlowCard(ctx, 90, ctaY + ctaBounce, WIDTH - 180, 76, 38, 'rgba(15, 23, 42, 0.95)', '#10B981', '#10B981', 18);

    ctx.fillStyle = '#10B981';
    ctx.font = '900 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('▶️ WATCH FULL EPISODE @PROGRAMSMAGIC ◀️', WIDTH / 2, ctaY + 48 + ctaBounce);

    const outBuffer = canvas.data();
    if (!encoder.stdin.write(outBuffer)) {
      await once(encoder.stdin, 'drain');
    }

    frameCount++;
    if (frameCount % 150 === 0) {
      console.log(`Rendered frame ${frameCount}/${TOTAL_FRAMES} (${(frameCount / TOTAL_FRAMES * 100).toFixed(1)}%)`);
    }
  }

  encoder.stdin.end();

  await new Promise((res, rej) => {
    encoder.on('close', code => code === 0 ? res() : rej(new Error('Encoder failed')));
  });

  console.log('6. Muxing with 48kHz audio...');
  await new Promise((res, rej) => {
    const mux = spawn('ffmpeg', [
      '-v', 'error', '-y',
      '-i', tempVideo,
      '-i', tempAudio,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-movflags', '+faststart',
      '-shortest',
      outFile
    ]);
    mux.on('close', code => code === 0 ? res() : rej(new Error('Muxing failed')));
  });

  console.log(`✓ Short 3 rendered successfully: ${outFile}`);
}

async function main() {
  console.log('Rendering Shorts 2 and 3...');
  await renderShort2();
  await renderShort3();
  console.log('\n🎉 ALL SHORTS RENDERING COMPLETE!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
