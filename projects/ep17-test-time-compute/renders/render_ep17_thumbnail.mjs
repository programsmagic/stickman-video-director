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

// 1. Deep Cosmic Indigo Background
const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
bg.addColorStop(0, '#030718');
bg.addColorStop(0.5, '#0a1232');
bg.addColorStop(1, '#04081c');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Perspective Floor Grid
ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
ctx.lineWidth = 1.5;
for (let x = -200; x <= WIDTH + 200; x += 90) {
  ctx.beginPath();
  ctx.moveTo(x, 480);
  ctx.lineTo((x - 640) * 2.4 + 640, HEIGHT);
  ctx.stroke();
}
for (let y = 480; y <= HEIGHT; y += 42) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(WIDTH, y);
  ctx.stroke();
}

// 2. Right Side: Glowing Monte Carlo Tree of Thoughts (MCTS)
const rootX = 940, rootY = 560;

// Ambient radial glow behind the tree
const treeGlow = ctx.createRadialGradient(rootX, rootY - 180, 50, rootX, rootY - 180, 360);
treeGlow.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
treeGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.20)');
treeGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
ctx.fillStyle = treeGlow;
ctx.beginPath();
ctx.arc(rootX, rootY - 180, 360, 0, Math.PI * 2);
ctx.fill();

// Recursive Tree Branches
function drawBranch(x0, y0, x1, y1, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2 + 15, (y0 + y1) / 2, x1, y1);
  ctx.stroke();
}

// Main Trunk
drawBranch(rootX, rootY, rootX - 60, rootY - 110, 8, '#38bdf8');
drawBranch(rootX, rootY, rootX + 70, rootY - 110, 8, '#f59e0b');

// Tier 1 Branches
drawBranch(rootX - 60, rootY - 110, rootX - 140, rootY - 210, 5, '#38bdf8');
drawBranch(rootX - 60, rootY - 110, rootX - 20, rootY - 220, 5, '#f43f5e'); // Pruned dead end
drawBranch(rootX + 70, rootY - 110, rootX + 30, rootY - 210, 5, '#10b981');
drawBranch(rootX + 70, rootY - 110, rootX + 150, rootY - 210, 5, '#f59e0b');

// Tier 2 Branches
drawBranch(rootX - 140, rootY - 210, rootX - 190, rootY - 310, 3.5, '#38bdf8');
drawBranch(rootX - 140, rootY - 210, rootX - 100, rootY - 320, 3.5, '#38bdf8');
drawBranch(rootX + 150, rootY - 210, rootX + 110, rootY - 320, 3.5, '#fbbf24');
drawBranch(rootX + 150, rootY - 210, rootX + 210, rootY - 310, 3.5, '#f43f5e'); // Dead end

// Nodes (Thought States)
const nodes = [
  { x: rootX, y: rootY, label: 'x0', color: '#ffffff', r: 16 },
  { x: rootX - 60, y: rootY - 110, label: 'PRM: +0.9', color: '#38bdf8', r: 14 },
  { x: rootX + 70, y: rootY - 110, label: 'PRM: +0.7', color: '#f59e0b', r: 14 },
  { x: rootX - 140, y: rootY - 210, label: 'Step 2: Valid', color: '#38bdf8', r: 13 },
  { x: rootX - 20, y: rootY - 220, label: '❌ Error', color: '#f43f5e', r: 12 },
  { x: rootX + 30, y: rootY - 210, label: 'Step 2b', color: '#10b981', r: 12 },
  { x: rootX + 150, y: rootY - 210, label: 'Step 2c', color: '#f59e0b', r: 13 },
  { x: rootX - 190, y: rootY - 310, label: 'Eureka! 🏆', color: '#22c55e', r: 18 },
  { x: rootX - 100, y: rootY - 320, label: 'Verified', color: '#38bdf8', r: 12 },
  { x: rootX + 110, y: rootY - 320, label: 'Sub-goal', color: '#fbbf24', r: 12 },
  { x: rootX + 210, y: rootY - 310, label: '❌ Pruned', color: '#f43f5e', r: 12 }
];

for (const n of nodes) {
  ctx.fillStyle = n.color;
  ctx.beginPath();
  ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Label tag
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px NotoSans, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(n.label, n.x, n.y - n.r - 8);
}

// 3. Top Glowing Thought Scratchpad Card
ctx.save();
ctx.translate(660, 60);
ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.roundRect(0, 0, 560, 115, 14);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#38bdf8';
ctx.font = 'bold 15px monospace';
ctx.textAlign = 'left';
ctx.fillText('<thought>', 22, 32);

ctx.fillStyle = '#fde047';
ctx.font = 'italic bold 17px NotoSans, sans-serif';
ctx.fillText('"Wait, let me rethink this... Triangle ABC is isosceles!"', 22, 64);

ctx.fillStyle = '#4ade80';
ctx.font = 'bold 16px NotoSans, sans-serif';
ctx.fillText('AHA! Backtracking complete. Solution verified ✓', 22, 95);
ctx.restore();

// 4. Stickman Magi on Left (Gazing at the Reasoning Tree with Magnifying Glass)
const magiX = 340, magiY = 560;
drawGroundShadow(ctx, magiX, magiY, 75);

const figure = {
  head: { x: magiX, y: 340, radius: 36, tilt: 0.15 },
  body: {
    spine: [
      { x: magiX, y: 376 },
      { x: magiX + 2, y: 440 },
      { x: magiX + 4, y: 505 }
    ],
    width: 6.5
  },
  leftArm: {
    ik: {
      target: { x: magiX - 55, y: 460 },
      pole: { x: magiX - 45, y: 420 }
    },
    upperLength: 70,
    lowerLength: 72
  },
  rightArm: {
    ik: {
      target: { x: magiX + 90, y: 370 }, // Raising magnifying lens
      pole: { x: magiX + 50, y: 410 }
    },
    upperLength: 70,
    lowerLength: 74
  },
  leftLeg: {
    ik: {
      target: { x: magiX + 35, y: magiY },
      pole: { x: magiX + 45, y: 530 }
    },
    upperLength: 88,
    lowerLength: 90
  },
  rightLeg: {
    ik: {
      target: { x: magiX - 35, y: magiY },
      pole: { x: magiX - 25, y: 530 }
    },
    upperLength: 88,
    lowerLength: 90
  },
  accessories: [
    { type: 'glasses', color: '#f59e0b', scale: 1.2 }
  ]
};

drawFigure(ctx, figure, {
  color: '#ffffff',
  lineWidth: 6,
  fillColor: 'rgba(255,255,255,0.08)'
});

// Magnifying Lens in Magi's Hand
ctx.save();
ctx.translate(magiX + 90, 370);
ctx.rotate(0.3);
// Handle
ctx.strokeStyle = '#94a3b8';
ctx.lineWidth = 6;
ctx.beginPath();
ctx.moveTo(0, 0);
ctx.lineTo(-25, 45);
ctx.stroke();
// Glass Rim
ctx.strokeStyle = '#f59e0b';
ctx.lineWidth = 5;
ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
ctx.beginPath();
ctx.arc(28, -28, 38, 0, Math.PI * 2);
ctx.fill();
ctx.stroke();
// Lens Glint
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.arc(28, -28, 26, -0.8, -0.2);
ctx.stroke();
ctx.restore();

// 5. Massive High-CTR Typography Banners on Left
// Badge 1: OPENAI o1 & DEEPSEEK-R1
ctx.fillStyle = '#0284c7';
ctx.beginPath();
ctx.roundRect(60, 48, 360, 44, 8);
ctx.fill();

ctx.fillStyle = '#ffffff';
ctx.font = 'bold 20px NotoSans, sans-serif';
ctx.textAlign = 'left';
ctx.fillText('OPENAI o1 • DEEPSEEK-R1', 82, 78);

// Main Hook 1
ctx.fillStyle = '#ffffff';
ctx.font = '900 68px NotoSans, sans-serif';
ctx.fillText('HOW AI', 60, 165);

// Main Hook 2 (Gold)
ctx.fillStyle = '#f59e0b';
ctx.font = '900 68px NotoSans, sans-serif';
ctx.fillText('LEARNED', 60, 240);

// Main Hook 3 (Cyan)
ctx.fillStyle = '#38bdf8';
ctx.font = '900 68px NotoSans, sans-serif';
ctx.fillText('TO THINK', 60, 315);

// Subtitle Pill: THE SECOND SCALING LAW
ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
ctx.strokeStyle = '#10b981';
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.roundRect(60, 345, 380, 52, 10);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#34d399';
ctx.font = 'bold 20px NotoSans, sans-serif';
ctx.fillText('⚡ TEST-TIME COMPUTE & PRMs', 78, 378);

// Save thumbnail to exports and publishing directories
const OUT_EXPORTS = path.resolve('exports/EP17-thumbnail.png');
const OUT_PUB = path.resolve('projects/ep17-test-time-compute/publishing/thumbnail.png');

fs.mkdirSync(path.dirname(OUT_PUB), { recursive: true });

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(OUT_EXPORTS, buffer);
fs.writeFileSync(OUT_PUB, buffer);

console.log(`\n🎉 High-CTR 1280x720 Thumbnail Generated:`);
console.log(`  • ${OUT_EXPORTS}`);
console.log(`  • ${OUT_PUB}`);
