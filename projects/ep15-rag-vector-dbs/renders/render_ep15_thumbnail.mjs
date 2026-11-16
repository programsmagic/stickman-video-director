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

// 1. Deep Space Tech Background Gradient
const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
bg.addColorStop(0, '#030712');
bg.addColorStop(0.5, '#0b132b');
bg.addColorStop(1, '#050a18');
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

// 2. Center: Glowing 3D Vector Hypersphere & HNSW Graph Constellation
const cx = 740, cy = 360;

// Giant Radial Glow
const glow = ctx.createRadialGradient(cx, cy, 50, cx, cy, 340);
glow.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
glow.addColorStop(0.4, 'rgba(139, 92, 246, 0.25)');
glow.addColorStop(0.8, 'rgba(245, 158, 11, 0.1)');
glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
ctx.fillStyle = glow;
ctx.beginPath();
ctx.arc(cx, cy, 340, 0, Math.PI * 2);
ctx.fill();

// Manim-style 3D coordinate sphere rings
ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.ellipse(cx, cy, 220, 220, 0, 0, Math.PI * 2);
ctx.stroke();

ctx.strokeStyle = 'rgba(139, 92, 246, 0.45)';
ctx.beginPath();
ctx.ellipse(cx, cy, 220, 80, -0.3, 0, Math.PI * 2);
ctx.stroke();

ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
ctx.beginPath();
ctx.ellipse(cx, cy, 80, 220, 0.4, 0, Math.PI * 2);
ctx.stroke();

// HNSW Multi-Layer Express Nodes & Edges
const nodes = [
  { x: cx - 140, y: cy - 90, label: 'q (Query)', color: '#38bdf8', r: 12 },
  { x: cx + 120, y: cy - 70, label: 'd1 (Match)', color: '#10b981', r: 14 },
  { x: cx + 80, y: cy + 110, label: 'd2', color: '#64748b', r: 8 },
  { x: cx - 110, y: cy + 90, label: 'd3', color: '#64748b', r: 8 },
  { x: cx + 20, y: cy - 140, label: 'Layer 2 Hop', color: '#f59e0b', r: 10 },
  { x: cx + 180, y: cy + 30, label: 'd4', color: '#64748b', r: 8 },
  { x: cx - 60, y: cy - 30, label: 'Layer 1', color: '#a855f7', r: 9 }
];

// Connecting laser edges
ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
ctx.lineWidth = 1.5;
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    ctx.beginPath();
    ctx.moveTo(nodes[i].x, nodes[i].y);
    ctx.lineTo(nodes[j].x, nodes[j].y);
    ctx.stroke();
  }
}

// Highlighted Query -> Match Vector Laser
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(nodes[0].x, nodes[0].y);
ctx.lineTo(nodes[1].x, nodes[1].y);
ctx.stroke();

// Cosine angle arc & label
ctx.fillStyle = '#f59e0b';
ctx.font = 'bold 22px NotoSans, sans-serif';
ctx.fillText('cos(θ) = 0.98', cx - 20, cy - 95);

// Draw nodes
for (const n of nodes) {
  ctx.fillStyle = n.color;
  ctx.beginPath();
  ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px NotoSans, sans-serif';
  ctx.fillText(n.label, n.x - 20, n.y - n.r - 6);
}

// 3. Stickman Magi on Left, pointing at the vector match
drawGroundShadow(ctx, 270, 620, 75);

const figure = {
  head: { x: 270, y: 310, radius: 36, tilt: -0.15 },
  body: {
    spine: [
      { x: 270, y: 346 },
      { x: 268, y: 400 },
      { x: 265, y: 460 }
    ],
    width: 6
  },
  leftArm: {
    ik: {
      target: { x: cx - 130, y: cy - 80 }, // Pointing directly to query node
      pole: { x: 330, y: 340 }
    },
    upperLength: 68,
    lowerLength: 72
  },
  rightArm: {
    ik: {
      target: { x: 220, y: 430 }, // Holding tablet/caliper
      pole: { x: 190, y: 390 }
    },
    upperLength: 65,
    lowerLength: 68
  },
  leftLeg: {
    ik: {
      target: { x: 295, y: 620 },
      pole: { x: 315, y: 540 }
    },
    upperLength: 82,
    lowerLength: 85
  },
  rightLeg: {
    ik: {
      target: { x: 235, y: 620 },
      pole: { x: 215, y: 540 }
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

// Caliper/Tablet prop in right hand
ctx.fillStyle = '#1e293b';
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.roundRect(170, 410, 70, 90, 8);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#38bdf8';
ctx.font = 'bold 12px monospace';
ctx.fillText('1,536-D', 180, 435);
ctx.fillStyle = '#10b981';
ctx.fillText('HNSW: OK', 180, 458);
ctx.fillStyle = '#f59e0b';
ctx.fillText('TOP-1: 98%', 180, 480);

// 4. Bold High-CTR Typography & Badges
// Master Badge (Top Left)
ctx.fillStyle = '#f59e0b';
ctx.beginPath();
ctx.roundRect(60, 45, 340, 46, 10);
ctx.fill();
ctx.fillStyle = '#0f172a';
ctx.font = '900 22px NotoSans, sans-serif';
ctx.fillText('🔥 MASTERCLASS EPISODE 09', 75, 76);

// Main Giant Headline
ctx.fillStyle = '#ffffff';
ctx.font = '900 68px NotoSans, sans-serif';
ctx.fillText('HOW RAG', 60, 155);

// Electric Cyan Accent
ctx.fillStyle = '#38bdf8';
ctx.fillText('ACTUALLY WORKS', 60, 230);

// Sub-banner on top right
ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
ctx.strokeStyle = '#10b981';
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.roundRect(830, 45, 390, 52, 12);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#10b981';
ctx.font = 'bold 22px NotoSans, sans-serif';
ctx.fillText('⚡ 100M VECTORS IN 5ms', 855, 79);

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
ctx.fillText('❌ NO MORE HALLUCINATIONS', 95, 658);

// Save outputs
const outExport = path.resolve('exports/EP15-thumbnail.png');
const outProject = path.resolve('projects/ep15-rag-vector-dbs/publishing/thumbnail.png');

fs.mkdirSync(path.dirname(outProject), { recursive: true });
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outExport, buffer);
fs.writeFileSync(outProject, buffer);

console.log(`✓ Thumbnail written to:\n  - ${outExport}\n  - ${outProject}`);
