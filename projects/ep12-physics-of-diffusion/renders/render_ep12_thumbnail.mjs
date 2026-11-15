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
  solve2BoneIK,
  drawGroundShadow
} from '../../tools/stickman.mjs';

GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/Caveat.ttf', 'CaveatHand');
GlobalFonts.registerFromPath('skills/directing-stickman-videos/assets/fonts/NotoSans.ttf', 'NotoSans');

const WIDTH = 1280, HEIGHT = 720;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// 1. Celestial Deep Navy Background
const bg = ctx.createRadialGradient(WIDTH * 0.7, HEIGHT * 0.45, 100, WIDTH * 0.5, HEIGHT * 0.5, 750);
bg.addColorStop(0, '#151c3d');
bg.addColorStop(0.5, '#0b0f24');
bg.addColorStop(1, '#03050d');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Stardust particles
let seed = 49201;
for (let i = 0; i < 90; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const sx = (seed / 4294967296) * WIDTH;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const sy = (seed / 4294967296) * (HEIGHT * 0.75);
  ctx.fillStyle = i % 3 === 0 ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// 2. Hero Visual: The Noise-to-Art Gateway on the right (X: 820, Y: 360)
const gateX = 820, gateY = 350;

// Dual-portal background glow
const portalGlow = ctx.createRadialGradient(gateX, gateY, 40, gateX, gateY, 260);
portalGlow.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
portalGlow.addColorStop(0.6, 'rgba(236, 72, 153, 0.15)');
portalGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
ctx.fillStyle = portalGlow;
ctx.beginPath();
ctx.arc(gateX, gateY, 260, 0, Math.PI * 2);
ctx.fill();

// Left Half of Portal: Pure Gaussian Static & Entropy
ctx.save();
ctx.beginPath();
ctx.rect(gateX - 220, gateY - 180, 220, 360);
ctx.clip();

ctx.fillStyle = '#1e293b';
ctx.fillRect(gateX - 220, gateY - 180, 220, 360);

// Procedural white & grey static grains
for (let y = gateY - 170; y < gateY + 170; y += 8) {
  for (let x = gateX - 210; x < gateX - 10; x += 8) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const lum = 40 + Math.floor((seed / 4294967296) * 190);
    ctx.fillStyle = `rgb(${lum}, ${lum}, ${lum})`;
    ctx.fillRect(x, y, 7, 7);
  }
}

// Entropy tag
ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
ctx.fillRect(gateX - 200, gateY + 120, 140, 32);
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 15px NotoSans';
ctx.fillText('PURE NOISE', gateX - 185, gateY + 142);
ctx.restore();

// Right Half of Portal: Golden Masterpiece Crystallization
ctx.save();
ctx.beginPath();
ctx.rect(gateX, gateY - 180, 220, 360);
ctx.clip();

const artGrad = ctx.createLinearGradient(gateX, gateY - 180, gateX + 220, gateY + 180);
artGrad.addColorStop(0, '#0f172a');
artGrad.addColorStop(0.5, '#1e1b4b');
artGrad.addColorStop(1, '#311042');
ctx.fillStyle = artGrad;
ctx.fillRect(gateX, gateY - 180, 220, 360);

// Stylized Golden Celestial Astronaut Sun
const sunGrad = ctx.createRadialGradient(gateX + 110, gateY - 20, 10, gateX + 110, gateY - 20, 90);
sunGrad.addColorStop(0, '#fef08a');
sunGrad.addColorStop(0.5, '#f59e0b');
sunGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
ctx.fillStyle = sunGrad;
ctx.beginPath();
ctx.arc(gateX + 110, gateY - 20, 90, 0, Math.PI * 2);
ctx.fill();

// Neon Nebula strokes
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(gateX + 20, gateY + 60);
ctx.bezierCurveTo(gateX + 60, gateY + 20, gateX + 140, gateY + 90, gateX + 200, gateY + 40);
ctx.stroke();

ctx.strokeStyle = '#ec4899';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.moveTo(gateX + 30, gateY + 90);
ctx.bezierCurveTo(gateX + 90, gateY + 130, gateX + 160, gateY + 80, gateX + 210, gateY + 110);
ctx.stroke();

// Art Masterpiece tag
ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
ctx.fillRect(gateX + 60, gateY + 120, 140, 32);
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 15px NotoSans';
ctx.fillText('FINAL ART', gateX + 85, gateY + 142);
ctx.restore();

// Portal Dividing Border & Laser Reversal Beam
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 5;
ctx.strokeRect(gateX - 220, gateY - 180, 440, 360);

// Center dividing laser
ctx.strokeStyle = '#facc15';
ctx.lineWidth = 6;
ctx.beginPath();
ctx.moveTo(gateX, gateY - 180);
ctx.lineTo(gateX, gateY + 180);
ctx.stroke();

// Central Reverse Vector Arrow: ∇x log p(x)
const arrowY = gateY - 10;
ctx.fillStyle = '#facc15';
ctx.strokeStyle = '#000000';
ctx.lineWidth = 3;

// Left-to-right reverse arrow
ctx.beginPath();
ctx.moveTo(gateX - 60, arrowY - 16);
ctx.lineTo(gateX + 20, arrowY - 16);
ctx.lineTo(gateX + 20, arrowY - 32);
ctx.lineTo(gateX + 65, arrowY);
ctx.lineTo(gateX + 20, arrowY + 32);
ctx.lineTo(gateX + 20, arrowY + 16);
ctx.lineTo(gateX - 60, arrowY + 16);
ctx.closePath();
ctx.fill();
ctx.stroke();

// Score Function Formula Badge
ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.roundRect(gateX - 110, gateY - 130, 220, 40, 8);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#38bdf8';
ctx.font = 'bold 20px NotoSans';
ctx.textAlign = 'center';
ctx.fillText('∇x log p(x)', gateX, gateY - 103);
ctx.textAlign = 'left';

// 3. Left Hero Character: Magi with Surveyor Staff & Compass
const magiX = 260, magiY = 570;
drawGroundShadow(ctx, magiX, magiY, 75, 14);

// Analytical IK Hand targets
const staffTopX = magiX + 110, staffTopY = 310;
const rArm = solve2BoneIK([magiX, magiY - 130], [staffTopX - 10, staffTopY + 90], 48, 48, 1);
const compassX = magiX - 85, compassY = magiY - 120;
const lArm = solve2BoneIK([magiX, magiY - 130], [compassX + 15, compassY + 10], 48, 48, -1);

drawFigure(ctx, {
  x: magiX,
  y: magiY,
  scale: 1.15,
  color: INK,
  fillColor: '#ffffff',
  hat: 'wizard',
  scarf: true,
  expression: 'curious',
  blinking: false,
  lHandTarget: lArm ? [lArm[1][0], lArm[1][1]] : undefined,
  rHandTarget: rArm ? [rArm[1][0], rArm[1][1]] : undefined
});

// Crystal Surveyor Staff in Right Hand
ctx.strokeStyle = '#ca8a04';
ctx.lineWidth = 7;
ctx.beginPath();
ctx.moveTo(staffTopX, staffTopY);
ctx.lineTo(staffTopX + 25, magiY + 5);
ctx.stroke();

// Crystal headpiece
ctx.fillStyle = '#38bdf8';
ctx.beginPath();
ctx.arc(staffTopX, staffTopY, 16, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 3;
ctx.stroke();

// Glowing Score Compass in Left Hand
ctx.fillStyle = '#78350f';
ctx.beginPath();
ctx.arc(compassX, compassY, 26, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#facc15';
ctx.lineWidth = 4;
ctx.stroke();

// Compass needle
ctx.strokeStyle = '#ef4444';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(compassX, compassY);
ctx.lineTo(compassX + 14, compassY - 16);
ctx.stroke();

ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(compassX, compassY);
ctx.lineTo(compassX - 14, compassY + 16);
ctx.stroke();

// 4. Punchy CTR Typography (Left & Top)
// Top Badge
ctx.fillStyle = '#f59e0b';
ctx.beginPath();
ctx.roundRect(50, 45, 340, 44, 8);
ctx.fill();

ctx.fillStyle = '#0f172a';
ctx.font = 'bold 22px NotoSans';
ctx.fillText('REVERSE THERMODYNAMICS', 66, 75);

// Main Hook Titles
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 74px NotoSans';
ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
ctx.shadowBlur = 15;
ctx.fillText('HOW AI', 50, 165);

ctx.fillStyle = '#38bdf8';
ctx.fillText('CREATES', 360, 165);

ctx.fillStyle = '#facc15';
ctx.font = 'bold 84px CaveatHand';
ctx.fillText('FROM NOTHING', 50, 245);
ctx.shadowBlur = 0;

// Sub-callout badge
ctx.fillStyle = '#dc2626';
ctx.beginPath();
ctx.roundRect(50, 275, 390, 48, 8);
ctx.fill();

ctx.fillStyle = '#ffffff';
ctx.font = 'bold 22px NotoSans';
ctx.fillText('⚡ THE PHYSICS OF DIFFUSION', 68, 307);

// 5. Save Output
const outPath = path.resolve('exports/EP12-thumbnail.png');
const pubThumb = path.resolve('projects/ep12-physics-of-diffusion/publishing/thumbnail.png');
fs.mkdirSync(path.dirname(pubThumb), { recursive: true });

fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
fs.copyFileSync(outPath, pubThumb);
console.log(`✓ High-CTR 1280x720 Thumbnail saved to: ${outPath}`);
