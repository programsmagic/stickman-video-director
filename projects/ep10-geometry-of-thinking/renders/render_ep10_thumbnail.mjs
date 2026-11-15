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

// 1. Cinematic Background Gradient
const bg = ctx.createRadialGradient(WIDTH * 0.7, HEIGHT * 0.5, 80, WIDTH * 0.5, HEIGHT * 0.5, 750);
bg.addColorStop(0, '#131d36');
bg.addColorStop(0.5, '#0a0f1d');
bg.addColorStop(1, '#03050a');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Stars / Cosmic stardust
let seed = 49120;
for (let i = 0; i < 90; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const sx = (seed / 4294967296) * WIDTH;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const sy = (seed / 4294967296) * (HEIGHT * 0.6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// 2. 3D Glowing Wireframe Loss Landscape (Saddle Point + Mountain Basin)
const cx = 780, cy = 460;
for (let i = 18; i >= 0; i--) {
  const u = (i / 18.0) * 2 - 1; // -1 to 1
  ctx.beginPath();
  let first = true;
  for (let j = 0; j <= 24; j++) {
    const v = (j / 24.0) * 2 - 1;
    // Hyperbolic paraboloid saddle z = u^2 - v^2
    const z = (u * u - v * v * 0.7) * 90;

    // 3D Isometric projection
    const px = cx + (u - v) * 240;
    const py = cy + (u + v) * 90 - z;

    if (first) {
      ctx.moveTo(px, py);
      first = false;
    } else {
      ctx.lineTo(px, py);
    }
  }
  const isZero = Math.abs(u) < 0.15;
  ctx.strokeStyle = isZero ? '#f59e0b' : 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = isZero ? 3.5 : 1.8;
  ctx.stroke();
}

// Golden pool at the bottom valley
const poolGrad = ctx.createRadialGradient(cx, cy + 80, 5, cx, cy + 80, 160);
poolGrad.addColorStop(0, 'rgba(234, 179, 8, 0.85)');
poolGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.35)');
poolGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
ctx.fillStyle = poolGrad;
ctx.beginPath();
ctx.ellipse(cx, cy + 80, 160, 55, 0, 0, Math.PI * 2);
ctx.fill();

// Glowing Negative Gradient Descent Vector Arrow (-∇L)
ctx.strokeStyle = '#ef4444';
ctx.lineWidth = 6;
ctx.beginPath();
ctx.moveTo(cx - 160, cy - 80);
ctx.lineTo(cx, cy + 60);
ctx.stroke();

// Arrowhead
ctx.fillStyle = '#ef4444';
ctx.beginPath();
ctx.moveTo(cx, cy + 60);
ctx.lineTo(cx - 20, cy + 30);
ctx.lineTo(cx - 35, cy + 45);
ctx.closePath();
ctx.fill();

ctx.fillStyle = '#f87171';
ctx.font = 'bold 24px NotoSans';
ctx.textAlign = 'center';
ctx.fillText('-∇L (DESCENT VECTOR)', cx - 140, cy - 100);

// 3. Mascot: Magi on the Cliff Edge
const magiX = 260, magiY = 560;
drawGroundShadow(ctx, magiX, magiY, 70, 18, 0.55);

// Posing Magi holding glowing lantern pointing down the slope
const hipY = magiY - 110;
const torsoY = hipY - 80;
const headY = torsoY - 55;

// Head
ctx.fillStyle = '#ffffff';
ctx.beginPath();
ctx.arc(magiX, headY, 26, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = INK;
ctx.lineWidth = 4;
ctx.stroke();

// Wizard Hat
ctx.fillStyle = '#2563eb';
ctx.beginPath();
ctx.moveTo(magiX - 32, headY - 12);
ctx.lineTo(magiX + 32, headY - 12);
ctx.lineTo(magiX + 8, headY - 75);
ctx.closePath();
ctx.fill();
ctx.strokeStyle = INK;
ctx.lineWidth = 3;
ctx.stroke();

// Yellow Scarf
ctx.fillStyle = '#eab308';
ctx.beginPath();
ctx.ellipse(magiX, headY + 22, 24, 12, 0.1, 0, Math.PI * 2);
ctx.fill();

// Eyes (Curious forward-looking)
ctx.fillStyle = '#0f172a';
ctx.beginPath();
ctx.arc(magiX + 8, headY - 3, 4, 0, Math.PI * 2);
ctx.fill();

// Torso
ctx.strokeStyle = INK;
ctx.lineWidth = 5;
ctx.beginPath();
ctx.moveTo(magiX, headY + 22);
ctx.lineTo(magiX, hipY);
ctx.stroke();

// Legs in active surveyor stance
const lLeg = solve2BoneIK([magiX, hipY], [magiX - 35, magiY], 55, 60, -1);
const rLeg = solve2BoneIK([magiX, hipY], [magiX + 35, magiY], 55, 60, 1);

ctx.beginPath();
ctx.moveTo(magiX, hipY);
ctx.lineTo(lLeg[1][0], lLeg[1][1]);
ctx.lineTo(magiX - 35, magiY);

ctx.moveTo(magiX, hipY);
ctx.lineTo(rLeg[1][0], rLeg[1][1]);
ctx.lineTo(magiX + 35, magiY);
ctx.stroke();

// Right Arm holding high-glow lantern
const lanternX = magiX + 115, lanternY = headY - 10;
const rArm = solve2BoneIK([magiX, torsoY], [lanternX, lanternY], 55, 55, 1);

ctx.beginPath();
ctx.moveTo(magiX, torsoY);
ctx.lineTo(rArm[1][0], rArm[1][1]);
ctx.lineTo(lanternX, lanternY);
ctx.stroke();

// Glowing Lantern
const lGlow = ctx.createRadialGradient(lanternX, lanternY, 8, lanternX, lanternY, 110);
lGlow.addColorStop(0, 'rgba(253, 224, 71, 0.95)');
lGlow.addColorStop(0.4, 'rgba(245, 158, 11, 0.55)');
lGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
ctx.fillStyle = lGlow;
ctx.beginPath();
ctx.arc(lanternX, lanternY, 110, 0, Math.PI * 2);
ctx.fill();

ctx.fillStyle = '#f59e0b';
ctx.fillRect(lanternX - 14, lanternY - 18, 28, 36);
ctx.strokeStyle = '#78350f';
ctx.lineWidth = 3;
ctx.strokeRect(lanternX - 14, lanternY - 18, 28, 36);
ctx.fillStyle = '#ffffff';
ctx.beginPath();
ctx.arc(lanternX, lanternY, 10, 0, Math.PI * 2);
ctx.fill();

// 4. Bold High-CTR Typography
// Top Hook
ctx.fillStyle = '#ffffff';
ctx.font = '900 68px NotoSans';
ctx.textAlign = 'left';
ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
ctx.shadowBlur = 12;
ctx.fillText('HOW AI', 80, 110);
ctx.fillStyle = '#38bdf8';
ctx.fillText('THINKS', 390, 110);

// Subtitle Pill Badge
ctx.shadowBlur = 0;
ctx.fillStyle = '#f59e0b';
ctx.beginPath();
ctx.roundRect(80, 140, 520, 60, 12);
ctx.fill();

ctx.fillStyle = '#0f172a';
ctx.font = 'bold 32px NotoSans';
ctx.textAlign = 'center';
ctx.fillText('IN 700B DIMENSIONS', 340, 182);

// Bottom Hook Ribbon
ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
ctx.strokeStyle = '#38bdf8';
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.roundRect(80, 620, 520, 64, 10);
ctx.fill();
ctx.stroke();

ctx.fillStyle = '#f8fafc';
ctx.font = 'bold 24px NotoSans';
ctx.textAlign = 'center';
ctx.fillText('THE GEOMETRY OF LOSS', 340, 660);

// Save thumbnail to exports/ and projects/
const outExport = path.resolve('exports/EP10-thumbnail.png');
const outProject = path.resolve('projects/ep10-geometry-of-thinking/publishing/thumbnail.png');
fs.mkdirSync(path.dirname(outProject), { recursive: true });

const buf = canvas.toBuffer('image/png');
fs.writeFileSync(outExport, buf);
fs.writeFileSync(outProject, buf);

console.log(`✓ High-CTR 1280x720 Thumbnail Generated:`);
console.log(`  - ${outExport} (${(buf.length / 1024).toFixed(1)} KB)`);
console.log(`  - ${outProject}`);
