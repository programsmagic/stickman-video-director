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

// 1. Deep Tech Background Gradient
const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
bg.addColorStop(0, '#040711');
bg.addColorStop(0.5, '#0a1329');
bg.addColorStop(1, '#050914');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Cyber grid perspective floor
ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
ctx.lineWidth = 1.5;
for (let x = 0; x <= WIDTH; x += 80) {
  ctx.beginPath();
  ctx.moveTo(x, 480);
  ctx.lineTo((x - 640) * 2.2 + 640, HEIGHT);
  ctx.stroke();
}
for (let y = 480; y <= HEIGHT; y += 40) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(WIDTH, y);
  ctx.stroke();
}

// 2. Center: Glowing ReAct Three-Gear Mechanism
const cx = 720, cy = 340;

// Outer energy glow
const glow = ctx.createRadialGradient(cx, cy, 40, cx, cy, 320);
glow.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
glow.addColorStop(0.5, 'rgba(245, 158, 11, 0.2)');
glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
ctx.fillStyle = glow;
ctx.beginPath();
ctx.arc(cx, cy, 320, 0, Math.PI * 2);
ctx.fill();

// Helper to draw a mechanical gear
function drawGear(gx, gy, r, teeth, color, label) {
  ctx.save();
  ctx.translate(gx, gy);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Teeth
  for (let i = 0; i < teeth; i++) {
    const a = (i * Math.PI * 2) / teeth;
    ctx.fillStyle = color;
    ctx.fillRect(Math.cos(a) * (r - 4) - 6, Math.sin(a) * (r - 4) - 6, 12, 12);
  }

  // Inner hub
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px NotoSans';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);

  ctx.restore();
}

// Three interlocking gears
drawGear(cx - 100, cy - 60, 95, 12, '#38bdf8', 'THOUGHT');
drawGear(cx + 100, cy - 60, 95, 12, '#f59e0b', 'ACTION');
drawGear(cx, cy + 90, 85, 10, '#10b981', 'OBSERVE');

// Lightning energy arcs connecting gears
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.moveTo(cx - 60, cy - 60);
ctx.lineTo(cx + 60, cy - 60);
ctx.moveTo(cx + 60, cy - 10);
ctx.lineTo(cx + 20, cy + 50);
ctx.moveTo(cx - 20, cy + 50);
ctx.lineTo(cx - 60, cy - 10);
ctx.stroke();

// 3. Right: Broken Glass Bell Jar & Robotic Mechanical Hand
const jarX = 1100, jarY = 460;
// Broken glass fragments
ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(jarX - 50, jarY - 140);
ctx.lineTo(jarX - 70, jarY - 80);
ctx.lineTo(jarX - 90, jarY - 120);
ctx.moveTo(jarX + 50, jarY - 140);
ctx.lineTo(jarX + 80, jarY - 70);
ctx.lineTo(jarX + 60, jarY - 20);
ctx.stroke();

// Robotic arm reaching out from jar
ctx.strokeStyle = '#94a3b8';
ctx.lineWidth = 8;
ctx.beginPath();
ctx.moveTo(jarX, jarY);
ctx.lineTo(jarX - 70, jarY - 90);
ctx.lineTo(jarX - 160, jarY - 60);
ctx.stroke();

// Robotic gripper holding terminal prompt tool
ctx.fillStyle = '#38bdf8';
ctx.fillRect(jarX - 190, jarY - 85, 50, 45);
ctx.fillStyle = '#0f172a';
ctx.font = 'bold 18px NotoSans';
ctx.textAlign = 'center';
ctx.fillText('>_', jarX - 165, jarY - 57);

// Warning Tag over Jar
ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
ctx.strokeStyle = '#ef4444';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.roundRect(jarX - 100, jarY - 210, 200, 38, 8);
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#fca5a5';
ctx.font = 'bold 15px NotoSans';
ctx.textAlign = 'center';
ctx.fillText('UNCAGED AUTONOMY', jarX, jarY - 186);

// 4. Left: Mascot Magi Commanding the System
const magiX = 260, magiY = 560;
drawGroundShadow(ctx, magiX, magiY, 90, 16);

// 2-Bone IK arms: Left hand holding wrench tool, Right hand gesturing at ReAct gears
const rHand = [cx - 160, cy - 20];
const lHand = [magiX - 60, magiY - 100];

const rArm = solve2BoneIK([magiX + 15, magiY - 140], rHand, 75, 75, 1);
const lArm = solve2BoneIK([magiX - 15, magiY - 140], lHand, 60, 60, -1);

drawFigure(ctx, {
  x: magiX,
  y: magiY,
  scale: 1.45,
  color: INK,
  fillColor: '#ffffff',
  hat: 'wizard',
  scarf: true,
  expression: 'happy',
  blinking: false,
  breathing: 0,
  lHandTarget: lArm ? [lArm[1][0], lArm[1][1]] : undefined,
  rHandTarget: rArm ? [rArm[1][0], rArm[1][1]] : undefined
});

// Tool in left hand (Golden Caliper / Wrench)
ctx.save();
ctx.translate(lHand[0], lHand[1]);
ctx.rotate(-0.4);
ctx.fillStyle = '#f59e0b';
ctx.fillRect(-6, -25, 12, 35);
ctx.fillRect(-14, -32, 28, 10);
ctx.restore();

// 5. High-Impact Typography & Channel Branding
// Top Badge
ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
ctx.strokeStyle = '#f59e0b';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.roundRect(60, 45, 420, 44, 8);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#fbbf24';
ctx.font = 'bold 20px NotoSans';
ctx.textAlign = 'center';
ctx.fillText('EPISODE 08 • COMPLETE MASTERCLASS', 270, 74);

// Big Bold Catchy Headline
ctx.fillStyle = '#ffffff';
ctx.font = '900 68px NotoSans';
ctx.textAlign = 'left';
ctx.fillText('HOW AI AGENTS', 60, 160);

ctx.fillStyle = '#38bdf8';
ctx.fillText('ACTUALLY WORK', 60, 235);

// Subtitle Pills
ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.roundRect(60, 265, 520, 52, 10);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#e0f2fe';
ctx.font = 'bold 22px NotoSans';
ctx.fillText('REACT • TOOL CALLING • SELF-CORRECTION', 80, 300);

// Save output to exports/EP14-thumbnail.png and publishing dir
const OUT_DIR = path.resolve('exports');
const outThumb = path.join(OUT_DIR, 'EP14-thumbnail.png');
const pubThumb = path.resolve('projects/ep14-autonomous-agents/publishing/thumbnail.png');

const buf = canvas.toBuffer('image/png');
fs.writeFileSync(outThumb, buf);
fs.writeFileSync(pubThumb, buf);

console.log(`🎉 High-CTR 1280x720 Thumbnail Rendered: ${outThumb}`);
