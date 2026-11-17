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

// 1. BACKGROUND: Deep Cosmic Observatory / Quantum Laboratory
const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
bg.addColorStop(0, '#030712');
bg.addColorStop(0.5, '#0c1222');
bg.addColorStop(1, '#050515');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Perspective Floor Grid
ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
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

// Subtle background stars / feature nodes
const nodes = [
  { x: 150, y: 120, r: 2, c: 'rgba(255, 255, 255, 0.4)' },
  { x: 340, y: 90, r: 2.5, c: 'rgba(56, 189, 248, 0.5)' },
  { x: 500, y: 140, r: 2, c: 'rgba(234, 179, 8, 0.4)' },
  { x: 750, y: 80, r: 3, c: 'rgba(236, 72, 153, 0.4)' },
  { x: 1150, y: 130, r: 2, c: 'rgba(56, 189, 248, 0.5)' },
  { x: 1220, y: 250, r: 2.5, c: 'rgba(255, 255, 255, 0.4)' }
];
nodes.forEach(n => {
  ctx.fillStyle = n.c;
  ctx.beginPath();
  ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
  ctx.fill();
});

// 2. CENTRAL FOCAL OBJECT: Optical Diamond Prism & Glass Brain Dissection
const prismX = 720, prismY = 320;
drawGroundShadow(ctx, prismX + 40, 580, 220, 25);

// Laser beam hitting prism
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 8;
ctx.beginPath();
ctx.moveTo(510, 320);
ctx.lineTo(prismX, 320);
ctx.stroke();

// White beam label
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 16px NotoSans, sans-serif';
ctx.textAlign = 'right';
ctx.fillText('POLYSEMANTIC RESIDUAL STREAM', 495, 315);
ctx.fillStyle = '#94a3b8';
ctx.font = '13px NotoSans, sans-serif';
ctx.fillText('(Dense Overlapping Superposition)', 495, 335);

// Diamond Prism
ctx.beginPath();
ctx.moveTo(prismX, prismY - 140);
ctx.lineTo(prismX + 130, prismY + 110);
ctx.lineTo(prismX - 130, prismY + 110);
ctx.closePath();
const prismGrad = ctx.createLinearGradient(prismX - 100, prismY - 100, prismX + 100, prismY + 100);
prismGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
prismGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.35)');
prismGrad.addColorStop(1, 'rgba(236, 72, 153, 0.35)');
ctx.fillStyle = prismGrad;
ctx.fill();
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 3.5;
ctx.stroke();

// Refracted Monosemantic Beams exiting the prism
const beams = [
  { angle: -0.38, color: '#f97316', label: 'GOLDEN GATE BRIDGE (Clamped 10x)', yOff: -120 },
  { angle: -0.18, color: '#eab308', label: 'DECEPTION DETECTOR', yOff: -45 },
  { angle: 0.05, color: '#10b981', label: 'INDUCTION HEAD CIRCUIT [A][B]', yOff: 35 },
  { angle: 0.28, color: '#38bdf8', label: 'SUPERINTELLIGENCE OVERSIGHT', yOff: 110 }
];

beams.forEach(b => {
  const startX = prismX + 70;
  const startY = prismY - 10;
  const endX = prismX + 460;
  const endY = startY + b.yOff;

  ctx.strokeStyle = b.color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Feature badge at end
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = b.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(endX - 10, endY - 18, 300, 36, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = b.color;
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(b.label, endX + 8, endY + 5);
});

// SAE PRISM BADGE
ctx.fillStyle = '#0f172a';
ctx.strokeStyle = '#a855f7';
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.roundRect(prismX - 100, prismY + 125, 200, 40, 10);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#c084fc';
ctx.font = 'bold 16px NotoSans, sans-serif';
ctx.textAlign = 'center';
ctx.fillText('SPARSE AUTOENCODER', prismX, prismY + 151);

// 3. STICKMAN CHARACTER: Chief AI Neuroscientist / Mechanistic Detective
drawGroundShadow(ctx, 330, 600, 75, 16);
drawFigure(ctx, {
  head: { x: 330, y: 350, r: 28 },
  torso: {
    start: { x: 330, y: 378 },
    end: { x: 330, y: 485 }
  },
  leftArm: {
    upper: { start: { x: 330, y: 395 }, end: { x: 280, y: 430 } },
    forearm: { start: { x: 280, y: 430 }, end: { x: 260, y: 410 } } // Hand holding laser pointer
  },
  rightArm: {
    upper: { start: { x: 330, y: 395 }, end: { x: 385, y: 420 } },
    forearm: { start: { x: 385, y: 420 }, end: { x: 440, y: 390 } } // Pointing dramatically at prism
  },
  leftLeg: {
    upper: { start: { x: 330, y: 485 }, end: { x: 305, y: 540 } },
    lower: { start: { x: 305, y: 540 }, end: { x: 300, y: 600 } }
  },
  rightLeg: {
    upper: { start: { x: 330, y: 485 }, end: { x: 360, y: 540 } },
    lower: { start: { x: 360, y: 540 }, end: { x: 375, y: 598 } }
  },
  facing: 'right',
  expression: 'amazed',
  coatColor: '#ffffff',
  lineColor: '#ffffff',
  lineWidth: 4.5
});

// Character Prop: High-tech holographic laser wand
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(250, 420);
ctx.lineTo(290, 395);
ctx.stroke();

// 4. BOLD HIGH-CTR YOUTUBE TITLE TEXT (Top Left)
// Top pill badge
ctx.fillStyle = '#dc2626';
ctx.beginPath();
ctx.roundRect(50, 45, 270, 38, 8);
ctx.fill();
ctx.fillStyle = '#ffffff';
ctx.font = '900 18px NotoSans, sans-serif';
ctx.textAlign = 'center';
ctx.fillText('🔥 MASTERCLASS GRAND FINALE', 185, 70);

// Line 1: THE MIND OF AGI
ctx.fillStyle = '#facc15';
ctx.font = '900 68px NotoSans, sans-serif';
ctx.textAlign = 'left';
ctx.fillText('THE MIND OF AGI', 50, 150);

// Line 2: UNLOCKING THE BLACK BOX
ctx.fillStyle = '#ffffff';
ctx.font = '900 50px NotoSans, sans-serif';
ctx.fillText('INSIDE THE BLACK BOX', 50, 215);

// Line 3: Monosemanticity & Superalignment Subtitle
ctx.fillStyle = '#38bdf8';
ctx.font = 'bold 26px NotoSans, sans-serif';
ctx.fillText('Sparse Autoencoders • Golden Gate Claude • Circuits', 50, 260);

// 5. SERIES COMPLETION BADGE (Bottom Left)
ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
ctx.strokeStyle = '#eab308';
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.roundRect(50, 580, 210, 85, 12);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#eab308';
ctx.font = '900 16px NotoSans, sans-serif';
ctx.textAlign = 'center';
ctx.fillText('★ 13 OF 13 COMPLETED ★', 155, 612);

ctx.fillStyle = '#ffffff';
ctx.font = 'bold 15px NotoSans, sans-serif';
ctx.fillText('THE COMPLETE AI SERIES', 155, 642);

// SAVE TO BOTH TARGET LOCATIONS
const outExports = path.resolve('exports/EP19-thumbnail.png');
const outPub = path.resolve('projects/ep19-interpretability-superintelligence/publishing/thumbnail.png');

const buf = canvas.toBuffer('image/png');
fs.writeFileSync(outExports, buf);
fs.writeFileSync(outPub, buf);

console.log(`✅ Thumbnail rendered successfully:`);
console.log(`   - ${outExports}`);
console.log(`   - ${outPub}`);
