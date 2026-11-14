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

// Helper to draw a glowing rounded box
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

// ---------------------------------------------------------------------------
// SHORT 1: THE STRAWBERRY TRAP THAT BROKE FAST AI
// ---------------------------------------------------------------------------
export async function renderShort1() {
  const sourceVideo = path.resolve('exports/EP08-Act4-Reasoning-Detective-Masterpiece.mp4');
  const outFile = path.resolve('exports/shorts/Short01-The-Strawberry-Trap-9x16.mp4');
  const tempVideo = '/tmp/short01_raw.mp4';
  const tempAudio = '/tmp/short01_audio.wav';

  const DURATION = 40.5;
  const TOTAL_FRAMES = Math.ceil(DURATION * FPS);

  console.log(`\n======================================================`);
  console.log(`Rendering Short 1: The Strawberry Trap (${TOTAL_FRAMES} frames, ${DURATION}s)`);
  console.log(`======================================================`);

  // 1. Extract 48kHz audio directly from 0.0 to 40.5s
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

  // 2. Spawn video decoder for source frames
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

  // 3. Spawn video encoder for 1080x1920 vertical output
  console.log('3. Spawning vertical 1080x1920 video encoder...');
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
    { start: 0.0, end: 4.8, title: "FATAL FLAW", line1: "For years, fast AI had a fatal flaw:", line2: "THEY WERE TOO FAST!", highlight: "TOO FAST!" },
    { start: 4.8, end: 10.2, title: "NO SCRATCHPAD", line1: "Because they generate tokens instantly,", line2: "they failed simple logic traps!", highlight: "logic traps!" },
    { start: 10.2, end: 15.2, title: "THE TRAP", line1: "Ask an older AI:", line2: "\"How many r's are in strawberry?\"", highlight: "\"strawberry\"" },
    { start: 15.2, end: 20.5, title: "BLURTED WRONG", line1: "And it instantly blurted: TWO!", line2: "Because it never spelled the letters!", highlight: "TWO!" },
    { start: 20.5, end: 26.2, title: "ENTER SPECIES 2", line1: "Enter Species Two: The Reasoning Models!", line2: "(OpenAI o1 & DeepSeek-R1)", highlight: "Reasoning Models!" },
    { start: 26.2, end: 31.0, title: "DEEP BREATH", line1: "Instead of blurting out the first word,", line2: "they take a deep breath...", highlight: "take a deep breath" },
    { start: 31.0, end: 36.0, title: "THINKING TOKENS", line1: "They generate thousands of hidden tokens:", line2: "An internal scratchpad to verify facts!", highlight: "internal scratchpad" },
    { start: 36.0, end: 40.5, title: "SELF-CORRECTION", line1: "AI talks to itself, breaks puzzles down,", line2: "and checks its own work!", highlight: "checks its own work!" }
  ];

  let frameCount = 0;

  for await (const frameData of readFrames(decoder.stdout, frameSize)) {
    if (frameCount >= TOTAL_FRAMES) break;
    const t = frameCount / FPS;

    // 1. Draw source video into frameCanvas
    const imgData = new ImageData(new Uint8ClampedArray(frameData), 1280, 720);
    fctx.putImageData(imgData, 0, 0);

    // 2. Render Vertical Background
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.3, '#1E1B4B');
    bgGrad.addColorStop(0.7, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Subtle animated particles
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    for (let p = 0; p < 25; p++) {
      const px = (p * 47 + t * 15) % WIDTH;
      const py = (p * 83 + HEIGHT - (t * 40 + p * 60) % HEIGHT) % HEIGHT;
      const pr = 2 + (p % 3);
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. TOP HEADER
    drawGlowCard(ctx, WIDTH / 2 - 130, 70, 260, 44, 22, '#EF4444', null, '#EF4444', 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('🚨 AI LOGIC TRAP', WIDTH / 2, 99);

    ctx.save();
    ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 48px NotoSans';
    ctx.fillText('THE STRAWBERRY TRAP', WIDTH / 2, 175);
    ctx.restore();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 22px NotoSans';
    ctx.fillText('Why Fast AI Models Failed Simple Logic', WIDTH / 2, 215);

    // 4. UPPER-MIDDLE DYNAMIC PUNCHY CAPTIONS
    const currentCap = captions.find(c => t >= c.start && t < c.end) || captions[captions.length - 1];
    drawGlowCard(ctx, 40, 250, WIDTH - 80, 160, 24, 'rgba(15, 23, 42, 0.94)', 'rgba(56, 189, 248, 0.5)', 'rgba(56, 189, 248, 0.3)', 15);

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

    // 5. MAIN MASTERPIECE VIDEO FRAME (y: 440 - 1040)
    const vidX = 20;
    const vidY = 440;
    const vidW = 1040;
    const vidH = 585;

    drawGlowCard(ctx, vidX - 4, vidY - 4, vidW + 8, vidH + 8, 20, 'rgba(30, 41, 59, 0.5)', '#38BDF8', 'rgba(56, 189, 248, 0.4)', 20);

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

    // 6. LOWER-MIDDLE INFOGRAPHIC DASHBOARD (y: 1060 - 1650)
    const dashY = 1060;
    const dashH = 590;
    drawGlowCard(ctx, 40, dashY, WIDTH - 80, dashH, 24, 'rgba(15, 23, 42, 0.95)', 'rgba(239, 68, 68, 0.4)', 'rgba(0, 0, 0, 0.5)', 15);

    ctx.fillStyle = '#EF4444';
    ctx.font = '900 20px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText('⚡ REAL-TIME LOGIC BREAKDOWN', 75, dashY + 45);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 16px NotoSans';
    ctx.textAlign = 'right';
    ctx.fillText('BENCHMARK: LETTER COUNTING', WIDTH - 75, dashY + 45);

    const letters = ['S', 'T', 'R', 'A', 'W', 'B', 'E', 'R', 'R', 'Y'];
    const boxW = 82;
    const boxH = 75;
    const startX = 65;
    const boxY = dashY + 70;

    letters.forEach((char, i) => {
      const bx = startX + i * (boxW + 12);
      const isR = char === 'R';
      const boxFill = isR ? (t < 20.5 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)') : 'rgba(30, 41, 59, 0.6)';
      const boxStroke = isR ? (t < 20.5 ? '#EF4444' : '#10B981') : 'rgba(148, 163, 184, 0.3)';

      drawGlowCard(ctx, bx, boxY, boxW, boxH, 12, boxFill, boxStroke, isR ? boxStroke : null, isR ? 12 : 0);

      ctx.fillStyle = isR ? (t < 20.5 ? '#EF4444' : '#10B981') : '#F8FAFC';
      ctx.font = '900 36px NotoSans';
      ctx.textAlign = 'center';
      ctx.fillText(char, bx + boxW / 2, boxY + 46);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 14px NotoSans';
      ctx.fillText(`${i + 1}`, bx + boxW / 2, boxY + 68);
    });

    const compY = dashY + 175;
    const compW = (WIDTH - 180) / 2;

    const isFastHighlight = t < 20.5;
    drawGlowCard(ctx, 65, compY, compW, 175, 16, isFastHighlight ? 'rgba(239, 68, 68, 0.15)' : 'rgba(30, 41, 59, 0.4)', isFastHighlight ? '#EF4444' : 'rgba(148, 163, 184, 0.2)', isFastHighlight ? '#EF4444' : null, isFastHighlight ? 15 : 0);

    ctx.fillStyle = '#EF4444';
    ctx.font = '900 18px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText('❌ FAST CHATBOT', 85, compY + 35);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 18px NotoSans';
    ctx.fillText('Answer: "TWO r\'s"', 85, compY + 70);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px NotoSans';
    ctx.fillText('• Instant token generation', 85, compY + 105);
    ctx.fillText('• No thinking scratchpad', 85, compY + 130);
    ctx.fillText('• Memorized "berry" pattern', 85, compY + 155);

    const isReasoningHighlight = t >= 20.5;
    drawGlowCard(ctx, 85 + compW, compY, compW, 175, 16, isReasoningHighlight ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.4)', isReasoningHighlight ? '#10B981' : 'rgba(148, 163, 184, 0.2)', isReasoningHighlight ? '#10B981' : null, isReasoningHighlight ? 15 : 0);

    ctx.fillStyle = '#10B981';
    ctx.font = '900 18px NotoSans';
    ctx.textAlign = 'left';
    ctx.fillText('✅ REASONING MODEL (o1 / R1)', 105 + compW, compY + 35);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 18px NotoSans';
    ctx.fillText('Answer: "THREE r\'s"', 105 + compW, compY + 70);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px NotoSans';
    ctx.fillText('• Generates <think> tokens', 105 + compW, compY + 105);
    ctx.fillText('• Spells out every letter', 105 + compW, compY + 130);
    ctx.fillText('• Self-verifies calculations', 105 + compW, compY + 155);

    const termY = dashY + 370;
    drawGlowCard(ctx, 65, termY, WIDTH - 130, 190, 16, '#0B0F19', 'rgba(56, 189, 248, 0.3)', null, 0);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SYSTEM LOG: INTERNAL SCRATCHPAD [<think> TOKENS]', 85, termY + 30);

    const tokenCount = Math.floor(lerp(128, 4096, clamp((t - 15) / 25)));
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`TOKENS: ${tokenCount}`, WIDTH - 85, termY + 30);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';

    if (t < 20.5) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText('> older_llm.predict("how many r\'s in strawberry?")', 85, termY + 65);
      ctx.fillText('> [LOG] Direct probability lookup: "berry" -> 2 r\'s', 85, termY + 95);
      ctx.fillText('> [OUTPUT] "There are 2 r\'s in strawberry."', 85, termY + 125);
      ctx.fillStyle = '#F87171';
      ctx.fillText('❌ ERROR: Letter 3 was completely ignored!', 85, termY + 155);
    } else {
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('> <think>', 85, termY + 65);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('  Let me spell out the word: s-t-r-a-w-b-e-r-r-y', 85, termY + 95);
      ctx.fillText('  Index 3 is "r". Index 8 is "r". Index 9 is "r".', 85, termY + 125);
      ctx.fillStyle = '#10B981';
      ctx.fillText('  Total count = 3. Final answer: 3 r\'s. </think>', 85, termY + 155);
    }

    // 7. BOTTOM CALL TO ACTION
    const ctaY = 1720;
    const ctaBounce = Math.sin(t * 7) * 4;
    drawGlowCard(ctx, 90, ctaY + ctaBounce, WIDTH - 180, 76, 38, 'rgba(15, 23, 42, 0.95)', '#FACC15', '#FACC15', 18);

    ctx.fillStyle = '#FACC15';
    ctx.font = '900 24px NotoSans';
    ctx.textAlign = 'center';
    ctx.fillText('▶️ WATCH FULL EPISODE @PROGRAMSMAGIC ◀️', WIDTH / 2, ctaY + 48 + ctaBounce);

    // 8. Pipe finished frame to encoder
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

  // 9. Mux with 48kHz audio track
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

  console.log(`✓ Short 1 rendered successfully: ${outFile}`);
}

renderShort1().catch(err => {
  console.error(err);
  process.exit(1);
});
