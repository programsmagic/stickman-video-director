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

// 1. Dark Workshop Stage Gradient
const bg = ctx.createRadialGradient(WIDTH * 0.65, HEIGHT * 0.45, 80, WIDTH * 0.5, HEIGHT * 0.5, 750);
bg.addColorStop(0, '#131e36');
bg.addColorStop(0.5, '#0a0f1d');
bg.addColorStop(1, '#020409');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Stardust particles
let seed = 81290;
for (let i = 0; i < 70; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const sx = (seed / 4294967296) * WIDTH;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const sy = (seed / 4294967296) * (HEIGHT * 0.6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// 2. Central Hero Visual: Heavy Guillotine Chopping "STRAWBERRY"
const bladeX = 760, bladeY = 240;

// Guillotine Frame Pillars
ctx.fillStyle = '#334155';
ctx.fillRect(bladeX - 60, 120, 24, 420);
ctx.fillRect(bladeX + 35, 120, 24, 420);
ctx.strokeStyle = '#64748b';
ctx.lineWidth = 3;
ctx.strokeRect(bladeX - 60, 120, 24, 420);
ctx.strokeRect(bladeX + 35, 120, 24, 420);

// Crossbeam
ctx.fillRect(bladeX - 80, 100, 160, 25);
ctx.strokeRect(bladeX - 80, 100, 160, 25);

// Descending Razor Blade (Brass & Chrome)
ctx.fillStyle = '#f59e0b';
ctx.beginPath();
ctx.moveTo(bladeX - 45, bladeY);
ctx.lineTo(bladeX + 45, bladeY);
ctx.lineTo(bladeX + 45, bladeY + 50);
ctx.lineTo(bladeX - 45, bladeY + 80);
ctx.closePath();
ctx.fill();
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 3;
ctx.stroke();

// Sparks at cut point
for (let s = 0; s < 18; s++) {
  const spX = bladeX + (s - 9) * 10;
  const spY = 460 - Math.random() * 40;
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(spX, spY, 3, 0, Math.PI * 2);
  ctx.fill();
}

// Sliced Text Blocks
// Left incoming: "STRAW"
ctx.fillStyle = '#1e3a8a';
ctx.fillRect(520, 440, 180, 65);
ctx.strokeStyle = '#3b82f6';
ctx.lineWidth = 3;
ctx.strokeRect(520, 440, 180, 65);
ctx.fillStyle = '#ffffff';
ctx.font = '900 28px NotoSans';
ctx.textAlign = 'center';
ctx.fillText('STRAW', 610, 483);

// Right outgoing: "BERRY" with Token #7421
ctx.fillStyle = '#b45309';
ctx.fillRect(810, 440, 180, 65);
ctx.strokeStyle = '#f59e0b';
ctx.lineWidth = 3;
ctx.strokeRect(810, 440, 180, 65);
ctx.fillStyle = '#ffffff';
ctx.fillText('BERRY', 900, 475);
ctx.fillStyle = '#fef08a';
ctx.font = 'bold 14px NotoSans';
ctx.fillText('#7421', 900, 495);

// Big Red Buzzer & "TWO! ❌"
ctx.fillStyle = '#ef4444';
ctx.beginPath();
ctx.ellipse(1080, 480, 35, 18, 0, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#991b1b';
ctx.lineWidth = 3;
ctx.stroke();

ctx.fillStyle = '#ffffff';
ctx.beginPath();
ctx.roundRect(1020, 360, 140, 65, 12);
ctx.fill();
ctx.strokeStyle = '#ef4444';
ctx.lineWidth = 3;
ctx.stroke();

ctx.fillStyle = '#dc2626';
ctx.font = '900 32px NotoSans';
ctx.fillText('TWO! ❌', 1090, 405);

// 3. Mascot: Magi on the Left with Magnifying Glass
const magiX = 260, magiY = 560;
drawGroundShadow(ctx, magiX, magiY, 70, 18, 0.55);

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

// Eyes
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

// Legs in active stance
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

// Left Arm holding Magnifying Glass up to the sliced block
const lensX = magiX + 115, lensY = headY + 20;
const lArm = solve2BoneIK([magiX, torsoY], [lensX, lensY], 55, 55, 1);

ctx.beginPath();
ctx.moveTo(magiX, torsoY);
ctx.lineTo(lArm[1][0], lArm[1][1]);
ctx.lineTo(lensX, lensY);
ctx.stroke();

// Magnifying Glass
ctx.strokeStyle = '#f59e0b';
ctx.lineWidth = 5;
ctx.beginPath();
ctx.arc(lensX, lensY, 40, 0, Math.PI * 2);
ctx.stroke();
ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
ctx.fill();

ctx.beginPath();
ctx.moveTo(lensX - 28, lensY + 28);
ctx.lineTo(lensX - 50, lensY + 50);
ctx.stroke();

ctx.fillStyle = '#ffffff';
ctx.font = 'bold 14px NotoSans';
ctx.fillText('NO LETTERS', lensX, lensY - 5);
ctx.fillStyle = '#fbbf24';
ctx.fillText('ID: #1832', lensX, lensY + 16);

// 4. Bold High-CTR Typography
// Top Hook
ctx.fillStyle = '#ffffff';
ctx.font = '900 68px NotoSans';
ctx.textAlign = 'left';
ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
ctx.shadowBlur = 12;
ctx.fillText('WHY AI CAN\'T', 80, 110);
ctx.fillStyle = '#38bdf8';
ctx.fillText('READ', 600, 110);

// Subtitle Pill Badge
ctx.shadowBlur = 0;
ctx.fillStyle = '#f59e0b';
ctx.beginPath();
ctx.roundRect(80, 140, 520, 60, 12);
ctx.fill();

ctx.fillStyle = '#0f172a';
ctx.font = 'bold 32px NotoSans';
ctx.textAlign = 'center';
ctx.fillText('THE STRAWBERRY ILLUSION', 340, 182);

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
ctx.fillText('HOW MACHINES READ WITHOUT EYES', 340, 660);

// Save thumbnail to exports/ and projects/
const outExport = path.resolve('exports/EP11-thumbnail.png');
const outProject = path.resolve('projects/ep11-token-illusion/publishing/thumbnail.png');
fs.mkdirSync(path.dirname(outProject), { recursive: true });

const buf = canvas.toBuffer('image/png');
fs.writeFileSync(outExport, buf);
fs.writeFileSync(outProject, buf);

console.log(`✓ High-CTR 1280x720 Thumbnail Generated:`);
console.log(`  - ${outExport} (${(buf.length / 1024).toFixed(1)} KB)`);
console.log(`  - ${outProject}`);
