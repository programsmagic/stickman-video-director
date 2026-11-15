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

// 1. Cosmic Omnimodal Gradient Background
const bg = ctx.createRadialGradient(WIDTH * 0.72, HEIGHT * 0.45, 100, WIDTH * 0.5, HEIGHT * 0.5, 750);
bg.addColorStop(0, '#1a103c');
bg.addColorStop(0.5, '#0b0d24');
bg.addColorStop(1, '#03040c');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Stardust particles
let seed = 58201;
for (let i = 0; i < 90; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const sx = (seed / 4294967296) * WIDTH;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const sy = (seed / 4294967296) * (HEIGHT * 0.75);
  ctx.fillStyle = i % 3 === 0 ? 'rgba(236, 72, 153, 0.5)' : (i % 2 === 0 ? 'rgba(56, 189, 248, 0.5)' : 'rgba(250, 204, 21, 0.5)');
  ctx.beginPath();
  ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// 2. Hero Visual: The 3 Sensory Streams Converging into Central Omnimodal Prism (X: 860, Y: 360)
const prismX = 860, prismY = 350;

// Central Omnimodal Core Glow
const coreGlow = ctx.createRadialGradient(prismX, prismY, 20, prismX, prismY, 240);
coreGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
coreGlow.addColorStop(0.2, 'rgba(56, 189, 248, 0.5)');
coreGlow.addColorStop(0.5, 'rgba(236, 72, 153, 0.3)');
coreGlow.addColorStop(0.8, 'rgba(250, 204, 21, 0.15)');
coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
ctx.fillStyle = coreGlow;
ctx.beginPath();
ctx.arc(prismX, prismY, 240, 0, Math.PI * 2);
ctx.fill();

// Stream 1 (Top-Left): Vision 16x16 Mosaic Tiles (Cyan)
const vStreamX = prismX - 220, vStreamY = prismY - 160;
ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
ctx.fillRect(vStreamX - 100, vStreamY - 50, 160, 100);
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 3;
ctx.strokeRect(vStreamX - 100, vStreamY - 50, 160, 100);

// Mosaic 16x16 grid patches inside
for (let gy = -40; gy < 40; gy += 20) {
  for (let gx = -90; gx < 50; gx += 20) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vStreamX + gx, vStreamY + gy, 18, 18);
  }
}
ctx.fillStyle = '#38bdf8';
ctx.font = 'bold 15px NotoSans';
ctx.fillText('16×16 PATCHES', vStreamX - 90, vStreamY - 58);

// Cyan laser beam from Vision stream into Prism
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 6;
ctx.beginPath();
ctx.moveTo(vStreamX + 60, vStreamY);
ctx.lineTo(prismX - 40, prismY - 20);
ctx.stroke();

// Stream 2 (Bottom-Left): Audio Mel-Spectrogram Waves (Gold)
const aStreamX = prismX - 220, aStreamY = prismY + 160;
ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
ctx.fillRect(aStreamX - 100, aStreamY - 50, 160, 100);
ctx.strokeStyle = '#facc15';
ctx.lineWidth = 3;
ctx.strokeRect(aStreamX - 100, aStreamY - 50, 160, 100);

// Spectrogram frequency heatbars
for (let b = -90; b < 50; b += 12) {
  const barH = 20 + Math.sin(b * 0.2) * 25 + Math.cos(b * 0.4) * 15;
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(aStreamX + b, aStreamY + 40 - barH, 8, barH);
}
ctx.fillStyle = '#facc15';
ctx.font = 'bold 15px NotoSans';
ctx.fillText('MEL-SPECTROGRAM', aStreamX - 90, aStreamY - 58);

// Gold sound beam into Prism
ctx.strokeStyle = '#facc15';
ctx.lineWidth = 6;
ctx.beginPath();
ctx.moveTo(aStreamX + 60, aStreamY);
ctx.lineTo(prismX - 40, prismY + 20);
ctx.stroke();

// Stream 3 (Right): Text Token Sequence (Magenta)
const tStreamX = prismX + 220, tStreamY = prismY;
ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
ctx.fillRect(tStreamX - 40, tStreamY - 60, 180, 120);
ctx.strokeStyle = '#ec4899';
ctx.lineWidth = 3;
ctx.strokeRect(tStreamX - 40, tStreamY - 60, 180, 120);

// Token blocks
['[Eagle: 491]', '[Soaring: 882]', '[Sky: 104]'].forEach((tok, idx) => {
  ctx.fillStyle = 'rgba(236, 72, 153, 0.3)';
  ctx.fillRect(tStreamX - 30, tStreamY - 45 + idx * 32, 160, 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px NotoSans';
  ctx.fillText(tok, tStreamX - 20, tStreamY - 28 + idx * 32);
});
ctx.fillStyle = '#ec4899';
ctx.font = 'bold 15px NotoSans';
ctx.fillText('TEXT TOKENS', tStreamX - 30, tStreamY - 70);

// Magenta text beam into Prism
ctx.strokeStyle = '#ec4899';
ctx.lineWidth = 6;
ctx.beginPath();
ctx.moveTo(tStreamX - 40, tStreamY);
ctx.lineTo(prismX + 40, prismY);
ctx.stroke();

// Central Diamond Prism of Omnimodality
ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
ctx.beginPath();
ctx.moveTo(prismX, prismY - 70);
ctx.lineTo(prismX + 60, prismY);
ctx.lineTo(prismX, prismY + 70);
ctx.lineTo(prismX - 60, prismY);
ctx.closePath();
ctx.fill();
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 5;
ctx.stroke();

// Refracted Spectrum Rays shooting from Prism
const colors = ['#38bdf8', '#facc15', '#ec4899', '#10b981', '#a855f7'];
colors.forEach((col, idx) => {
  const angle = -Math.PI / 4 + (idx * Math.PI) / 8;
  ctx.strokeStyle = col;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(prismX, prismY);
  ctx.lineTo(prismX + Math.cos(angle) * 140, prismY + Math.sin(angle) * 140);
  ctx.stroke();
});

// Central Prism Label
ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.roundRect(prismX - 110, prismY + 90, 220, 38, 8);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#ffffff';
ctx.font = 'bold 16px NotoSans';
ctx.textAlign = 'center';
ctx.fillText('UNIFIED EMBEDDING', prismX, prismY + 115);
ctx.textAlign = 'left';

// 3. Left Hero Character: Magi with Optical Prism & Staff
const magiX = 260, magiY = 570;
drawGroundShadow(ctx, magiX, magiY, 75, 14);

const staffTopX = magiX + 110, staffTopY = 310;
const rArm = solve2BoneIK([magiX, magiY - 130], [staffTopX - 10, staffTopY + 90], 48, 48, 1);
const prismHandX = magiX - 70, prismHandY = magiY - 110;
const lArm = solve2BoneIK([magiX, magiY - 130], [prismHandX, prismHandY], 48, 48, -1);

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

// Crystal Surveyor Staff
ctx.strokeStyle = '#ca8a04';
ctx.lineWidth = 7;
ctx.beginPath();
ctx.moveTo(staffTopX, staffTopY);
ctx.lineTo(staffTopX + 25, magiY + 5);
ctx.stroke();

ctx.fillStyle = '#38bdf8';
ctx.beginPath();
ctx.arc(staffTopX, staffTopY, 16, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 3;
ctx.stroke();

// Optical Tuning Prism in Left Hand
ctx.fillStyle = '#facc15';
ctx.beginPath();
ctx.moveTo(prismHandX, prismHandY - 24);
ctx.lineTo(prismHandX + 22, prismHandY + 18);
ctx.lineTo(prismHandX - 22, prismHandY + 18);
ctx.closePath();
ctx.fill();
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 3;
ctx.stroke();

// 4. Punchy CTR Typography (Left & Top)
// Top Badge
ctx.fillStyle = '#8b5cf6';
ctx.beginPath();
ctx.roundRect(50, 45, 340, 44, 8);
ctx.fill();

ctx.fillStyle = '#ffffff';
ctx.font = 'bold 22px NotoSans';
ctx.fillText('GPT-4o & GEMINI DECODED', 66, 75);

// Main Hook Titles
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 74px NotoSans';
ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
ctx.shadowBlur = 15;
ctx.fillText('HOW AI', 50, 165);

ctx.fillStyle = '#ec4899';
ctx.fillText('SEES & HEARS', 360, 165);

ctx.fillStyle = '#facc15';
ctx.font = 'bold 82px CaveatHand';
ctx.fillText('AT ONCE!', 50, 245);
ctx.shadowBlur = 0;

// Sub-callout badge
ctx.fillStyle = '#0284c7';
ctx.beginPath();
ctx.roundRect(50, 275, 410, 48, 8);
ctx.fill();

ctx.fillStyle = '#ffffff';
ctx.font = 'bold 22px NotoSans';
ctx.fillText('⚡ THE MULTIMODAL MIND', 68, 307);

// 5. Save Output
const outPath = path.resolve('exports/EP13-thumbnail.png');
const pubThumb = path.resolve('projects/ep13-multimodal-mind/publishing/thumbnail.png');
fs.mkdirSync(path.dirname(pubThumb), { recursive: true });

fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
fs.copyFileSync(outPath, pubThumb);
console.log(`✓ High-CTR 1280x720 Thumbnail saved to: ${outPath}`);
