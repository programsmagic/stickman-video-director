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

// 1. Deep Arena Tech Background Gradient
const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
bg.addColorStop(0, '#040714');
bg.addColorStop(0.5, '#0c1630');
bg.addColorStop(1, '#050916');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Cyber grid perspective floor
ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
ctx.lineWidth = 1.5;
for (let x = -200; x <= WIDTH + 200; x += 90) {
  ctx.beginPath();
  ctx.moveTo(x, 460);
  ctx.lineTo((x - 640) * 2.4 + 640, HEIGHT);
  ctx.stroke();
}
for (let y = 460; y <= HEIGHT; y += 42) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(WIDTH, y);
  ctx.stroke();
}

// 2. Center-Right: The Glowing Computational Stallion & DPO Tuning Fork
const hx = 860, hy = 430;

// Stallion Ambient Energy Glow
const sGlow = ctx.createRadialGradient(hx, hy - 40, 50, hx, hy - 40, 320);
sGlow.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
sGlow.addColorStop(0.5, 'rgba(56, 189, 248, 0.25)');
sGlow.addColorStop(0.8, 'rgba(168, 85, 247, 0.1)');
sGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
ctx.fillStyle = sGlow;
ctx.beginPath();
ctx.arc(hx, hy - 40, 320, 0, Math.PI * 2);
ctx.fill();

// Draw Computational Stallion (Vector Geometry)
ctx.strokeStyle = '#10b981';
ctx.lineWidth = 4;
ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';

// Torso / Body
ctx.beginPath();
ctx.ellipse(hx, hy - 60, 110, 65, -0.15, 0, Math.PI * 2);
ctx.fill();
ctx.stroke();

// Neck & Head
ctx.beginPath();
ctx.moveTo(hx - 80, hy - 90);
ctx.lineTo(hx - 130, hy - 170); // Neck front
ctx.lineTo(hx - 170, hy - 150); // Muzzle top
ctx.lineTo(hx - 190, hy - 130); // Nose
ctx.lineTo(hx - 150, hy - 110); // Jaw
ctx.lineTo(hx - 90, hy - 50);   // Chest
ctx.closePath();
ctx.fill();
ctx.stroke();

// Glowing Eye
ctx.fillStyle = '#f59e0b';
ctx.beginPath();
ctx.arc(hx - 145, hy - 140, 6, 0, Math.PI * 2);
ctx.fill();

// Mane of Binary Code / Lasers
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 2.5;
for (let m = 0; m < 7; m++) {
  ctx.beginPath();
  ctx.moveTo(hx - 120 + m * 16, hy - 160 + m * 14);
  ctx.lineTo(hx - 100 + m * 16, hy - 200 + m * 8);
  ctx.stroke();
}

// Front Legs
ctx.strokeStyle = '#10b981';
ctx.lineWidth = 5;
ctx.beginPath();
ctx.moveTo(hx - 80, hy - 20);
ctx.lineTo(hx - 90, hy + 70);
ctx.lineTo(hx - 85, hy + 170); // Hoof
ctx.stroke();

// Hind Legs
ctx.beginPath();
ctx.moveTo(hx + 80, hy - 30);
ctx.lineTo(hx + 110, hy + 60);
ctx.lineTo(hx + 95, hy + 170); // Hoof
ctx.stroke();

// Golden Reins extending to Stickman Magi
ctx.strokeStyle = '#f59e0b';
ctx.lineWidth = 3.5;
ctx.beginPath();
ctx.moveTo(hx - 165, hy - 125);
ctx.quadraticCurveTo(560, 480, 370, 420);
ctx.stroke();

// KL Divergence Electric Fence on Far Right
ctx.strokeStyle = '#a855f7';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.moveTo(1160, 160);
ctx.lineTo(1160, 620);
ctx.stroke();

// Voltage sparks
for (let sp = 0; sp < 6; sp++) {
  const spy = 200 + sp * 70;
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1160, spy);
  ctx.lineTo(1140, spy + 15);
  ctx.lineTo(1175, spy + 25);
  ctx.lineTo(1150, spy + 40);
  ctx.stroke();
}

ctx.fillStyle = '#a855f7';
ctx.font = 'bold 16px monospace';
ctx.fillText('KL TETHER: D_KL', 1080, 145);

// DPO Mathematical Tuning Fork (Floating Center)
const tfX = 640, tfY = 240;
ctx.strokeStyle = '#f59e0b';
ctx.lineWidth = 5;
ctx.beginPath();
// Handle
ctx.moveTo(tfX, tfY + 60);
ctx.lineTo(tfX, tfY + 110);
// Prongs base
ctx.moveTo(tfX - 30, tfY);
ctx.lineTo(tfX - 30, tfY + 40);
ctx.quadraticCurveTo(tfX, tfY + 60, tfX + 30, tfY + 40);
ctx.lineTo(tfX + 30, tfY);
ctx.stroke();

// Crystal resonance rings
ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.arc(tfX, tfY + 20, 70, 0, Math.PI * 2);
ctx.stroke();

ctx.fillStyle = '#f59e0b';
ctx.font = 'bold 20px NotoSans, sans-serif';
ctx.fillText('DPO TUNING FORK', tfX - 85, tfY - 20);

// 3. Stickman Magi on Left Holding the Golden Reins
drawGroundShadow(ctx, 290, 620, 75);

const figure = {
  head: { x: 290, y: 310, radius: 36, tilt: 0.1 },
  body: {
    spine: [
      { x: 290, y: 346 },
      { x: 288, y: 400 },
      { x: 285, y: 460 }
    ],
    width: 6
  },
  leftArm: {
    ik: {
      target: { x: 370, y: 420 }, // Holding golden reins
      pole: { x: 340, y: 360 }
    },
    upperLength: 68,
    lowerLength: 72
  },
  rightArm: {
    ik: {
      target: { x: 220, y: 410 }, // Holding alignment tablet
      pole: { x: 190, y: 380 }
    },
    upperLength: 65,
    lowerLength: 68
  },
  leftLeg: {
    ik: {
      target: { x: 315, y: 620 },
      pole: { x: 335, y: 540 }
    },
    upperLength: 82,
    lowerLength: 85
  },
  rightLeg: {
    ik: {
      target: { x: 255, y: 620 },
      pole: { x: 235, y: 540 }
    },
    upperLength: 82,
    lowerLength: 85
  },
  accessories: [
    { type: 'glasses', color: '#f59e0b', scale: 1.2 }
  ]
};

drawFigure(ctx, figure, {
  color: '#ffffff',
  lineWidth: 5.5,
  fillColor: 'rgba(255,255,255,0.05)'
});

// Alignment Tablet prop in right hand
ctx.fillStyle = '#1e293b';
ctx.strokeStyle = '#10b981';
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.roundRect(170, 390, 70, 95, 8);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#10b981';
ctx.font = 'bold 12px monospace';
ctx.fillText('RLHF: OK', 180, 415);
ctx.fillStyle = '#38bdf8';
ctx.fillText('DPO: ACTV', 180, 438);
ctx.fillStyle = '#f59e0b';
ctx.fillText('REFUSAL:0', 180, 460);

// 4. Bold High-CTR Typography & Badges
// Master Badge (Top Left)
ctx.fillStyle = '#f59e0b';
ctx.beginPath();
ctx.roundRect(60, 45, 360, 46, 10);
ctx.fill();
ctx.fillStyle = '#0f172a';
ctx.font = '900 22px NotoSans, sans-serif';
ctx.fillText('🔥 MASTERCLASS EPISODE 10', 75, 76);

// Main Giant Headline
ctx.fillStyle = '#ffffff';
ctx.font = '900 68px NotoSans, sans-serif';
ctx.fillText('HOW WE TAMED', 60, 155);

// Electric Green Accent
ctx.fillStyle = '#10b981';
ctx.fillText('THE SILICON BEAST', 60, 230);

// Sub-banner on top right
ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.roundRect(830, 45, 390, 52, 12);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#38bdf8';
ctx.font = 'bold 22px NotoSans, sans-serif';
ctx.fillText('⚡ RLHF vs DPO EXPLAINED', 870, 79);

// Bottom High-Intrigue Pill
ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
ctx.strokeStyle = '#f59e0b';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.roundRect(60, 620, 520, 58, 29);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#f59e0b';
ctx.font = '900 24px NotoSans, sans-serif';
ctx.fillText('🐎 FROM RAW BASE TO ALIGNED AI', 80, 658);

// Save outputs
const outExport = path.resolve('exports/EP16-thumbnail.png');
const outProject = path.resolve('projects/ep16-post-training-alignment/publishing/thumbnail.png');

fs.mkdirSync(path.dirname(outProject), { recursive: true });
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outExport, buffer);
fs.writeFileSync(outProject, buffer);

console.log(`✓ Thumbnail written to:\n  - ${outExport}\n  - ${outProject}`);
