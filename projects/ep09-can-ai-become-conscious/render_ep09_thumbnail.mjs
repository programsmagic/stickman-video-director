import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require(
  path.resolve('skills/directing-stickman-videos/node_modules/@napi-rs/canvas')
);
import { drawFigure, COLORS, INK, solve2BoneIK, drawGroundShadow } from '../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280, HEIGHT = 720;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

console.log('=== RENDERING HIGH-CTR YOUTUBE THUMBNAIL (EPISODE 03) ===');

// 1. Deep Midnight Cosmic Blue Background with Vignette
const bg = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 100, WIDTH / 2, HEIGHT / 2, 800);
bg.addColorStop(0, '#0F172A');
bg.addColorStop(1, '#020617');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// 2. Neon Geometric Circuit Lines on Right Side
ctx.save();
ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
ctx.lineWidth = 2;
for (let y = 140; y <= 620; y += 70) {
  ctx.beginPath();
  ctx.moveTo(700, y);
  ctx.lineTo(1200, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(1200, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#A855F7';
  ctx.fill();
}
ctx.restore();

// 3. Grounding Shadows
drawGroundShadow(ctx, 280, 620, 95, 20, 0.45);
drawGroundShadow(ctx, 880, 620, 120, 24, 0.45);

// 4. Character Magi on Left Side (Rule of Thirds)
drawFigure(ctx, {
  torso: 4,
  head: 8,
  facing: 'right',
  eyes: 'wide',
  brows: 'raised',
  mouth: 'o',
  scarf: true,
  accessory: 'wizard-hat',
  targetArmL: [-40, 20],
  targetArmR: [80, -20], // Holding magnifying lens forward
  legL: [-12, -6],
  legR: [14, 10]
}, {
  x: 280,
  y: 490,
  r: 80,
  seed: 99
});

// 5. Giant Android Silhouette on Right Side
ctx.save();
const headX = 880, headY = 380, hr = 130;
// Glowing neural skull glow
const skullGlow = ctx.createRadialGradient(headX, headY, 20, headX, headY, 220);
skullGlow.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
skullGlow.addColorStop(0.7, 'rgba(168, 85, 247, 0.15)');
skullGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
ctx.fillStyle = skullGlow;
ctx.beginPath();
ctx.arc(headX, headY, 220, 0, Math.PI * 2);
ctx.fill();

// Head outline
ctx.strokeStyle = '#38BDF8';
ctx.lineWidth = 5;
ctx.beginPath();
ctx.arc(headX, headY, hr, 0, Math.PI * 2);
ctx.stroke();

// Internal Clockwork Gears & Circuit Cutaway
ctx.strokeStyle = '#F59E0B';
ctx.lineWidth = 3;
// Center gear
ctx.beginPath();
ctx.arc(headX, headY, 45, 0, Math.PI * 2);
ctx.stroke();
for (let g = 0; g < 8; g++) {
  const ang = (g * Math.PI) / 4;
  ctx.beginPath();
  ctx.moveTo(headX + Math.cos(ang) * 45, headY + Math.sin(ang) * 45);
  ctx.lineTo(headX + Math.cos(ang) * 58, headY + Math.sin(ang) * 58);
  ctx.stroke();
}

// Giant Glowing Question Mark in Empty Center Void
ctx.font = 'bold 96px NotoSans';
ctx.fillStyle = '#EC4899';
ctx.textAlign = 'center';
ctx.shadowColor = '#EC4899';
ctx.shadowBlur = 24;
ctx.fillText('?', headX, headY + 34);
ctx.restore();

// 6. X-Ray Scanner Cone from Magi's Hand to Android Head
ctx.save();
const beam = ctx.createLinearGradient(360, 470, headX, headY);
beam.addColorStop(0, 'rgba(56, 189, 248, 0.5)');
beam.addColorStop(1, 'rgba(236, 72, 153, 0.1)');
ctx.fillStyle = beam;
ctx.beginPath();
ctx.moveTo(360, 470);
ctx.lineTo(headX - 60, headY - 100);
ctx.lineTo(headX - 60, headY + 100);
ctx.closePath();
ctx.fill();
ctx.restore();

// 7. Bold High-Contrast Text Hook (Mobile-First 3-Color Rule)
ctx.save();
ctx.textAlign = 'center';

// Top Category Badge
ctx.font = 'bold 24px NotoSans';
ctx.fillStyle = '#38BDF8';
ctx.fillText('THE HARDEST QUESTION IN SCIENCE', WIDTH / 2, 70);

// Primary Hook Text
ctx.font = '900 82px NotoSans';
ctx.fillStyle = '#FFFFFF';
ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
ctx.shadowBlur = 20;
ctx.fillText('CAN AI BECOME', WIDTH / 2, 160);

ctx.font = '900 86px NotoSans';
ctx.fillStyle = '#FDE047';
ctx.shadowColor = '#F59E0B';
ctx.shadowBlur = 30;
ctx.fillText('CONSCIOUS?', WIDTH / 2, 250);

// Bottom Mystery Pill
ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
ctx.strokeStyle = '#EC4899';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.roundRect(WIDTH / 2 - 280, 620, 560, 65, 32);
ctx.fill();
ctx.stroke();

ctx.font = 'bold 28px NotoSans';
ctx.fillStyle = '#F8FAFC';
ctx.shadowBlur = 0;
ctx.fillText('THE CHINESE ROOM & THE GHOST IN SILICON', WIDTH / 2, 663);
ctx.restore();

// Write Thumbnail
const OUT1 = path.resolve('exports/EP09-thumbnail.png');
const OUT2 = path.resolve('projects/ep09-can-ai-become-conscious/publishing/thumbnail.png');
const buffer = canvas.toBuffer('image/png');
fs.mkdirSync(path.dirname(OUT2), { recursive: true });
fs.writeFileSync(OUT1, buffer);
fs.writeFileSync(OUT2, buffer);

console.log(`🎉 Thumbnail saved to:`);
console.log(`   - ${OUT1}`);
console.log(`   - ${OUT2}`);
