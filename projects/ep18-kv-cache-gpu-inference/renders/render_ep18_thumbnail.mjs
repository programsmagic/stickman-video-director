import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require(
  path.resolve('skills/directing-stickman-videos/node_modules/@napi-rs/canvas')
);
import {
  drawFigure,
  COLORS,
  INK,
  drawGroundShadow
} from '../../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280, HEIGHT = 720;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// 1. BACKGROUND: Deep Cyber Silicon Laboratory
const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
bg.addColorStop(0, '#020617');
bg.addColorStop(0.5, '#09132e');
bg.addColorStop(1, '#020617');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Perspective Floor Grid
ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
ctx.lineWidth = 1.5;
for (let x = -200; x <= WIDTH + 200; x += 90) {
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * 0.25, 460);
  ctx.lineTo(x, HEIGHT);
  ctx.stroke();
}
for (let y = 460; y <= HEIGHT; y += 40) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(WIDTH, y);
  ctx.stroke();
}

// 2. CENTRAL FOCAL OBJECT: Massive NVIDIA H100 GPU Die & Idle Meter
const chipX = 720, chipY = 170, chipW = 500, chipH = 460;
drawGroundShadow(ctx, chipX + chipW / 2, 650, chipW * 0.45, 24);

// Chip Heat Spreader
ctx.fillStyle = '#0f172a';
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.roundRect(chipX, chipY, chipW, chipH, 20);
ctx.fill();
ctx.stroke();

// Metallic border & screws
ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
ctx.lineWidth = 2;
ctx.strokeRect(chipX + 15, chipY + 15, chipW - 30, chipH - 30);

// GPU Header
ctx.fillStyle = '#38bdf8';
ctx.font = 'bold 28px NotoSans, sans-serif';
ctx.textAlign = 'center';
ctx.fillText('NVIDIA H100 TENSOR CORE', chipX + chipW / 2, chipY + 58);

ctx.fillStyle = '#94a3b8';
ctx.font = 'bold 16px NotoSans, sans-serif';
ctx.fillText('2,000 TFLOPs FP16 • 3.35 TB/s HBM3', chipX + chipW / 2, chipY + 86);

// Dial / Utilization Gauge
const dialX = chipX + chipW / 2, dialY = chipY + 230, radius = 95;

// Outer dial arc
ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
ctx.lineWidth = 18;
ctx.lineCap = 'round';
ctx.beginPath();
ctx.arc(dialX, dialY, radius, Math.PI * 0.8, Math.PI * 2.2);
ctx.stroke();

// Idle red/orange arc
ctx.strokeStyle = '#ef4444';
ctx.lineWidth = 18;
ctx.beginPath();
ctx.arc(dialX, dialY, radius, Math.PI * 0.8, Math.PI * 0.84);
ctx.stroke();

// Idle Text Display
ctx.fillStyle = '#ef4444';
ctx.font = '900 68px NotoSans, sans-serif';
ctx.textAlign = 'center';
ctx.fillText('99%', dialX, dialY + 18);

ctx.fillStyle = '#fca5a5';
ctx.font = 'bold 20px NotoSans, sans-serif';
ctx.fillText('IDLE TIME', dialX, dialY + 48);

// Warning Banner under chip
ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
ctx.strokeStyle = '#ef4444';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.roundRect(chipX + 40, chipY + 360, chipW - 80, 68, 10);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#f87171';
ctx.font = 'bold 20px NotoSans, sans-serif';
ctx.fillText('⚠ THE MEMORY WALL BOTTLENECK', chipX + chipW / 2, chipY + 394);
ctx.fillStyle = '#fecaca';
ctx.font = '14px NotoSans, sans-serif';
ctx.fillText('Suffocating on 1 FLOP per byte loaded from VRAM', chipX + chipW / 2, chipY + 416);

// 3. STICKMAN CHARACTER (Left Foreground: Magi / Systems Architect)
const stickX = 310, stickY = 520;
drawGroundShadow(ctx, stickX, 640, 80, 18);

drawFigure(ctx, {
  x: stickX,
  y: stickY,
  scale: 1.45,
  facing: 'right',
  expression: 'surprised',
  handL: { x: stickX - 50, y: stickY - 90 }, // holding diagnostic voltmeter
  handR: { x: stickX + 90, y: stickY - 80 }, // pointing at 99% idle gauge
  footL: { x: stickX - 35, y: 640 },
  footR: { x: stickX + 35, y: 640 },
  headRadius: 32,
  torsoLength: 90,
  legLength: 85,
  armLength: 60,
  showEyes: true,
  blink: false
});

// Diagnostic Probe Wire in hand
ctx.strokeStyle = '#fbbf24';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.moveTo(stickX + 90, stickY - 80);
ctx.bezierCurveTo(stickX + 200, stickY - 60, chipX - 50, dialY + 20, dialX - 40, dialY + 40);
ctx.stroke();

// 4. BOLD HIGH-CTR YOUTUBE TITLE TYPOGRAPHY (Left Side)
// Eyebrow Tag
ctx.fillStyle = '#38bdf8';
ctx.font = '900 22px NotoSans, sans-serif';
ctx.textAlign = 'left';
ctx.fillText('THE $40,000 SILICON CRISIS', 70, 95);

// Main Hook 1
ctx.fillStyle = '#fbbf24';
ctx.font = '900 64px NotoSans, sans-serif';
ctx.fillText('THE GPU TRAP', 68, 160);

// Main Hook 2
ctx.fillStyle = '#ffffff';
ctx.font = '900 48px NotoSans, sans-serif';
ctx.fillText('KV CACHE & vLLM', 70, 222);

// Pill Badges (Key tech solutions)
const pills = ['PagedAttention', 'FlashAttention', 'Speculative 3x'];
pills.forEach((p, idx) => {
  const px = 70 + idx * 175;
  const py = 250;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(px, py, 160, 36, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p, px + 80, py + 24);
});

// Save thumbnail outputs
const EXPORTS_DIR = path.resolve('exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });
const PUB_DIR = path.resolve('projects/ep18-kv-cache-gpu-inference/publishing');
fs.mkdirSync(PUB_DIR, { recursive: true });

const out1 = path.join(EXPORTS_DIR, 'EP18-thumbnail.png');
const out2 = path.join(PUB_DIR, 'thumbnail.png');

const buf = canvas.toBuffer('image/png');
fs.writeFileSync(out1, buf);
fs.writeFileSync(out2, buf);

console.log(`\n🎉 High-CTR 1280x720 Thumbnail rendered:`);
console.log(`  • ${out1}`);
console.log(`  • ${out2}`);
