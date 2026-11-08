import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createCanvas } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 24;
const DURATION = 10;
const TOTAL_FRAMES = FPS * DURATION;
const AUDIO_FILE = path.resolve('exports/demo_agentic_voice.wav');
const OUTPUT_FILE = path.resolve('exports/demo-hybrid-pro-stickman-10s.mp4');

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Helper: ease in out
function ease(x) {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
}

// 1. EXACT CURRENT STICKMAN (MAGI)
function drawCurrentMagi(ctx, x, y, t, options = {}) {
  const { isWalking = false, pointing = false } = options;

  ctx.save();
  ctx.translate(x, y);

  const walkPhase = isWalking ? Math.sin(t * 7) : 0;
  const bounce = isWalking ? Math.abs(Math.sin(t * 7)) * 5 : Math.sin(t * 2) * 1.5;
  const hipY = -60 - bounce;

  // Contact shadow
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 36 - bounce * 1.2, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30, 35, 42, 0.18)';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 3.8;
  ctx.lineCap = 'round';

  // Legs (Classic stickman line style)
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(walkPhase * 18 - 14, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(-walkPhase * 18 + 14, 0);
  ctx.stroke();

  // Torso
  const chestY = hipY - 75;
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(0, chestY);
  ctx.stroke();

  // Arms
  if (pointing) {
    // Left arm relaxed
    ctx.beginPath();
    ctx.moveTo(0, chestY + 14);
    ctx.lineTo(-18, chestY + 50);
    ctx.stroke();

    // Right arm pointing at center stage
    ctx.beginPath();
    ctx.moveTo(0, chestY + 14);
    ctx.lineTo(35, chestY + 2);
    ctx.lineTo(75, chestY - 15);
    ctx.stroke();

    // Pointing finger hand
    ctx.fillStyle = '#1E232A';
    ctx.beginPath();
    ctx.arc(77, chestY - 16, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Normal walking / idle arms
    ctx.beginPath();
    ctx.moveTo(0, chestY + 14);
    ctx.lineTo(-walkPhase * 18 - 12, chestY + 45);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, chestY + 14);
    ctx.lineTo(walkPhase * 18 + 12, chestY + 45);
    ctx.stroke();
  }

  // Yellow Scarf (Our iconic Magi scarf)
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.roundRect(-14, chestY - 8, 28, 14, 4);
  ctx.fill();
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Scarf tail
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(6, chestY);
  ctx.quadraticCurveTo(18 + Math.sin(t * 4) * 4, chestY + 25, 26 + Math.sin(t * 5) * 6, chestY + 45);
  ctx.stroke();

  // Head
  const headY = chestY - 30;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.arc(0, headY, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Glasses (Magi iconic)
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(-8, headY - 2, 7.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(8, headY - 2, 7.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.5, headY - 2);
  ctx.lineTo(0.5, headY - 2);
  ctx.stroke();

  // Eyes (Classic dots with slight gaze)
  ctx.fillStyle = '#1E232A';
  const gaze = pointing ? 2 : 0;
  ctx.beginPath();
  ctx.arc(-8 + gaze, headY - 2, 2.5, 0, Math.PI * 2);
  ctx.arc(8 + gaze, headY - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#1E232A';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(-5, headY + 11);
  ctx.quadraticCurveTo(0, headY + 14, 5, headY + 11);
  ctx.stroke();

  // Wizard Hat
  ctx.fillStyle = '#4B5563';
  ctx.strokeStyle = '#1F2937';
  ctx.lineWidth = 2.8;

  // Brim
  ctx.beginPath();
  ctx.ellipse(0, headY - 20, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cone
  ctx.beginPath();
  ctx.moveTo(-23, headY - 20);
  ctx.lineTo(2, headY - 80);
  ctx.lineTo(23, headY - 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gold band
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.ellipse(0, headY - 23, 23, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// 2. MOTION-CANVAS STYLE TECH GRAPHICS (Glowing Agentic Workflow Pipeline)
function drawTechWorkflow(ctx, x, y, t, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  // Workflow Container Box (Sleek Glassmorphic Tech Slate)
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = 'rgba(229, 231, 235, 0.9)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  ctx.beginPath();
  ctx.roundRect(0, 0, 680, 240, 16);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  // Tech Card Header
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AUTONOMOUS MULTI-AGENT LOOP', 24, 34);

  // Status Badge
  ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
  ctx.beginPath();
  ctx.roundRect(540, 18, 115, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#059669';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('● ENGINE ACTIVE', 597, 34);

  // The 3 Connected Workflow Nodes
  const nodes = [
    { name: '1. INTENT', sub: 'Goal Ingestion', x: 100, y: 130, color: '#3B82F6' },
    { name: '2. PLANNER', sub: 'Subagent Team', x: 340, y: 130, color: '#8B5CF6' },
    { name: '3. ACTOR', sub: 'Tool Execution', x: 570, y: 130, color: '#10B981' }
  ];

  // Connecting Data Pipes (Bézier conduits with moving pulses)
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(a.x + 42, a.y);
    ctx.lineTo(b.x - 42, b.y);
    ctx.stroke();

    // Glowing Pulse along conduit
    const pulseT = (t * 1.8 + i * 0.5) % 1;
    const pulseX = (a.x + 42) + (b.x - 42 - (a.x + 42)) * pulseT;
    ctx.save();
    ctx.fillStyle = a.color;
    ctx.shadowColor = a.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(pulseX, a.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw Nodes
  nodes.forEach((n, idx) => {
    // Outer breathing halo
    const pulse = Math.sin(t * 4 + idx * 2) * 4;
    ctx.save();
    ctx.fillStyle = n.color;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 38 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Node body
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = n.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Node core icon / dot
    ctx.fillStyle = n.color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Node labels
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(n.name, n.x, n.y + 54);

    ctx.fillStyle = '#64748B';
    ctx.font = '11px sans-serif';
    ctx.fillText(n.sub, n.x, n.y + 70);
  });

  ctx.restore();
}

// 3. VOX / JOHNNY HARRIS STYLE PAPER-CUT DOCUMENT WITH HIGHLIGHTER & STAMP
function drawVoxDocument(ctx, x, y, t, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(-0.025); // Authentic slight paper tilt

  // Paper Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 16;

  // Paper Base (warm cream off-white texture)
  ctx.fillStyle = '#FBF9F5';
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0, 0, 480, 260, 8);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  // Document Header
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('DOCUMENT CLASSIFIED // ARCHIVE #402', 28, 36);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('SYSTEM EFFICIENCY METRICS', 28, 68);

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(28, 82);
  ctx.lineTo(452, 82);
  ctx.stroke();

  // Document Text Lines
  ctx.fillStyle = '#334155';
  ctx.font = '14px sans-serif';
  ctx.fillText('• Human Prompt Wait: ELIMINATED', 28, 115);
  ctx.fillText('• Task Completion: 10.4x FASTER', 28, 142);
  ctx.fillText('• Autonomous Error Correction: ACTIVE', 28, 169);

  // VOX HIGHLIGHTER EFFECT (Sweeping yellow marker)
  const hlProgress = Math.max(0, Math.min(1, (t - 6.2) * 2.2));
  if (hlProgress > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(254, 240, 138, 0.75)'; // Soft yellow fluorescent
    ctx.beginPath();
    ctx.roundRect(24, 126, 320 * hlProgress, 24, 4);
    ctx.fill();
    ctx.restore();
  }

  // VOX RUBBER STAMP EFFECT ([VERIFIED] with impact slam)
  if (t > 7.4) {
    const stampProgress = Math.min(1, (t - 7.4) * 5);
    const stampScale = 1.6 - (stampProgress * 0.6); // Slams down from large to 1.0
    const stampAlpha = Math.min(1, stampProgress * 2);

    ctx.save();
    ctx.translate(350, 175);
    ctx.scale(stampScale, stampScale);
    ctx.rotate(0.12); // Angled rubber stamp

    ctx.strokeStyle = `rgba(220, 38, 38, ${stampAlpha * 0.85})`;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(-75, -24, 150, 48);

    ctx.fillStyle = `rgba(220, 38, 38, ${stampAlpha * 0.85})`;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VERIFIED', 0, 7);
    ctx.restore();
  }

  ctx.restore();
}

async function renderHybridDemo() {
  const tempVideo = '/tmp/hybrid_temp.mp4';
  console.log(`Rendering Hybrid Pro Explainer Preview frames to ${tempVideo}...`);

  const ffmpeg = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${WIDTH}x${HEIGHT}`,
    '-framerate', String(FPS),
    '-i', 'pipe:0',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    tempVideo
  ]);

  let ffmpegErr = '';
  ffmpeg.stderr.on('data', d => { ffmpegErr += d.toString(); });

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    // Subtle logarithmic camera push-in
    const zoom = 1.0 + (t / DURATION) * 0.035;
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);

    // Warm minimalist background with studio floor
    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Modern studio grid
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.04)';
    ctx.lineWidth = 1.0;
    for (let gx = 0; gx < WIDTH; gx += 48) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, HEIGHT);
      ctx.stroke();
    }
    for (let gy = 0; gy < HEIGHT; gy += 48) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(WIDTH, gy);
      ctx.stroke();
    }

    // TOP BANNER (Series branding)
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('THE AGENTIC FUTURE // EPISODE 01', 56, 52);

    // Topic Title
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('From Prompting to Autonomous Action', 56, 88);

    // 1. Current Stickman Magi (Walks in, stops, then points)
    let magiX = 220;
    let isWalking = false;
    let pointing = false;

    if (t < 2.2) {
      isWalking = true;
      magiX = 80 + (t / 2.2) * 140; // walks from 80 to 220
    } else {
      isWalking = false;
      magiX = 220;
      pointing = true; // points at the tech graph!
    }

    drawCurrentMagi(ctx, magiX, 580, t, { isWalking, pointing });

    // 2. Motion Canvas Style Tech Workflow (Appears at t=2.0s with ease in)
    const techAlpha = ease((t - 1.8) * 1.5);
    drawTechWorkflow(ctx, 420, 140, t, techAlpha);

    // 3. Vox-Style Paper Cutout Document (Slides in at t=5.0s with ease)
    const docAlpha = ease((t - 4.8) * 1.8);
    const docYOffset = (1 - docAlpha) * 40;
    drawVoxDocument(ctx, 480, 420 + docYOffset, t, docAlpha);

    ctx.restore();

    // Pipe raw RGBA buffer to ffmpeg
    const buffer = canvas.data();
    ffmpeg.stdin.write(buffer);
  }

  ffmpeg.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpeg.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg video encode failed (code ${code}): ${ffmpegErr}`));
    });
  });

  console.log('Muxing narration audio into final video...');
  const mux = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-i', tempVideo,
    '-i', AUDIO_FILE,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    OUTPUT_FILE
  ]);

  await new Promise((resolve, reject) => {
    mux.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg audio mux failed with code ${code}`));
    });
  });

  console.log(`✓ Hybrid Pro video rendered successfully with Bodi voiceover: ${OUTPUT_FILE}`);
}

renderHybridDemo().catch(err => {
  console.error(err);
  process.exit(1);
});
