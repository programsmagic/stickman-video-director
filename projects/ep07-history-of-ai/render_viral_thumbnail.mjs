import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// =========================================================================
// THE MILLION-VIEW THUMBNAIL FORMULA:
// 1. Extreme contrast (Deep Void #04060a vs Supernova Cyan #38bdf8 & Gold #facc15)
// 2. Ultra-minimal text: ONLY 2 WORDS ("THINKING SAND") readable at 50px mobile icon size
// 3. Visual Story: Magi holding a glowing rock/silicon crystal that radiates an entire AI neural galaxy
// =========================================================================

// 1. Cinematic Deep Space Background
const bgGrad = ctx.createRadialGradient(WIDTH * 0.72, HEIGHT * 0.42, 60, WIDTH * 0.5, HEIGHT * 0.5, 950);
bgGrad.addColorStop(0, '#131e33');
bgGrad.addColorStop(0.35, '#0a101d');
bgGrad.addColorStop(0.75, '#04070e');
bgGrad.addColorStop(1, '#010205');
ctx.fillStyle = bgGrad;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Cyber perspective floor grid with glowing horizon
ctx.save();
ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
ctx.lineWidth = 1.5;
const vanishingY = 360;
for (let x = -300; x <= WIDTH + 300; x += 70) {
  ctx.beginPath();
  ctx.moveTo(x, HEIGHT);
  ctx.lineTo(WIDTH * 0.45 + (x - WIDTH * 0.45) * 0.12, vanishingY);
  ctx.stroke();
}
for (let y = HEIGHT; y >= vanishingY; y -= 38) {
  const norm = (y - vanishingY) / (HEIGHT - vanishingY);
  ctx.strokeStyle = `rgba(56, 189, 248, ${norm * 0.22})`;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(WIDTH, y);
  ctx.stroke();
}
ctx.restore();

// 2. Giant Glowing AI Core / Neural Supernova (Right Center)
ctx.save();
const coreX = 890;
const coreY = 350;

// Giant atmospheric halo
const outerAura = ctx.createRadialGradient(coreX, coreY, 20, coreX, coreY, 400);
outerAura.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
outerAura.addColorStop(0.3, 'rgba(139, 92, 246, 0.35)');
outerAura.addColorStop(0.65, 'rgba(236, 72, 153, 0.12)');
outerAura.addColorStop(1, 'transparent');
ctx.fillStyle = outerAura;
ctx.beginPath();
ctx.arc(coreX, coreY, 400, 0, Math.PI * 2);
ctx.fill();

// Concentric celestial energy rings
for (let r = 90; r <= 290; r += 45) {
  ctx.beginPath();
  ctx.ellipse(coreX, coreY, r, r * 0.76, Math.PI / 5, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(56, 189, 248, ${0.55 - (r / 290) * 0.35})`;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([14, 18]);
  ctx.stroke();
}
ctx.setLineDash([]);

// Neural Nodes & Constellation Beams
const nodes = [
  { x: coreX - 110, y: coreY - 70 },
  { x: coreX + 110, y: coreY - 80 },
  { x: coreX, y: coreY - 130 },
  { x: coreX - 130, y: coreY + 60 },
  { x: coreX + 90, y: coreY + 70 },
  { x: coreX - 20, y: coreY + 140 },
  { x: coreX + 40, y: coreY - 10 },
  { x: coreX - 50, y: coreY + 10 },
];

ctx.strokeStyle = 'rgba(168, 85, 247, 0.65)';
ctx.lineWidth = 3;
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    ctx.beginPath();
    ctx.moveTo(nodes[i].x, nodes[i].y);
    ctx.lineTo(nodes[j].x, nodes[j].y);
    ctx.stroke();
  }
}

nodes.forEach((n, idx) => {
  ctx.beginPath();
  ctx.arc(n.x, n.y, idx < 3 ? 16 : 10, 0, Math.PI * 2);
  ctx.fillStyle = idx % 2 === 0 ? '#38bdf8' : '#e879f9';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 24;
  ctx.fill();
});

// Burning Center Core (The Fire of Intelligence)
const coreBall = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, 55);
coreBall.addColorStop(0, '#FFFFFF');
coreBall.addColorStop(0.4, '#FACC15');
coreBall.addColorStop(0.8, '#F97316');
coreBall.addColorStop(1, 'transparent');
ctx.fillStyle = coreBall;
ctx.beginPath();
ctx.arc(coreX, coreY, 55, 0, Math.PI * 2);
ctx.fill();
ctx.restore();

// 3. Hero Character: Magi in Epic Stance (Left Center)
ctx.save();
const magiX = 410;
const magiY = 610;
ctx.translate(magiX, magiY);

// Shadow
ctx.beginPath();
ctx.ellipse(0, 0, 85, 16, 0, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
ctx.fill();

// White Skeleton Legs
ctx.strokeStyle = '#FFFFFF';
ctx.lineWidth = 7.5;
ctx.lineCap = 'round';
// Back leg
ctx.beginPath();
ctx.moveTo(-18, -120);
ctx.lineTo(-34, -60);
ctx.lineTo(-28, 0);
ctx.stroke();
// Front leg
ctx.beginPath();
ctx.moveTo(18, -120);
ctx.lineTo(30, -60);
ctx.lineTo(38, 0);
ctx.stroke();

// Torso
ctx.beginPath();
ctx.moveTo(0, -120);
ctx.lineTo(10, -210);
ctx.stroke();

// Head
const headY = -250;
ctx.beginPath();
ctx.arc(10, headY, 38, 0, Math.PI * 2);
ctx.fillStyle = '#FFFFFF';
ctx.fill();
ctx.strokeStyle = '#020617';
ctx.lineWidth = 4.5;
ctx.stroke();

// Glasses
ctx.strokeStyle = '#020617';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.arc(22, headY - 4, 12, 0, Math.PI * 2);
ctx.arc(42, headY - 4, 12, 0, Math.PI * 2);
ctx.moveTo(34, headY - 4);
ctx.lineTo(30, headY - 4);
ctx.stroke();

// Eyes
ctx.fillStyle = '#020617';
ctx.beginPath();
ctx.arc(24, headY - 4, 4, 0, Math.PI * 2);
ctx.arc(44, headY - 4, 4, 0, Math.PI * 2);
ctx.fill();

// Scarf (Vibrant Neon Yellow)
ctx.fillStyle = '#FACC15';
ctx.beginPath();
ctx.roundRect(-10, -218, 42, 18, 9);
ctx.fill();
// Trailing scarf with wind motion
ctx.beginPath();
ctx.moveTo(-6, -210);
ctx.bezierCurveTo(-45, -195, -75, -180, -110, -185);
ctx.lineWidth = 12;
ctx.strokeStyle = '#FACC15';
ctx.stroke();

// Wizard Hat
ctx.fillStyle = '#6366F1';
ctx.beginPath();
ctx.ellipse(10, -284, 52, 12, 0, 0, Math.PI * 2);
ctx.fill();
ctx.beginPath();
ctx.moveTo(-28, -284);
ctx.quadraticCurveTo(15, -375, 45, -390);
ctx.quadraticCurveTo(28, -315, 42, -284);
ctx.closePath();
ctx.fill();
// Star
ctx.fillStyle = '#FACC15';
ctx.beginPath();
ctx.arc(18, -325, 8, 0, Math.PI * 2);
ctx.fill();

// Arms: Left arm resting with magic tablet, Right arm holding glowing silicon rock towards core
ctx.strokeStyle = '#FFFFFF';
ctx.lineWidth = 7;
// Left arm
ctx.beginPath();
ctx.moveTo(4, -202);
ctx.lineTo(-28, -160);
ctx.lineTo(-14, -135);
ctx.stroke();
// Right arm extended forward
ctx.beginPath();
ctx.moveTo(14, -202);
ctx.lineTo(65, -195);
ctx.lineTo(110, -225);
ctx.stroke();

// Hand holding the glowing Sand Crystal / Silicon Chip
const handX = 112;
const handY = -228;
ctx.save();
// Glowing rock / silicon hexagon
ctx.fillStyle = '#FACC15';
ctx.shadowColor = '#38BDF8';
ctx.shadowBlur = 35;
ctx.beginPath();
for (let i = 0; i < 6; i++) {
  const ha = (i * Math.PI) / 3;
  const hx = handX + Math.cos(ha) * 18;
  const hy = handY + Math.sin(ha) * 18;
  if (i === 0) ctx.moveTo(hx, hy);
  else ctx.lineTo(hx, hy);
}
ctx.closePath();
ctx.fill();

// Electric lightning beam connecting Silicon Chip to the AI Supernova Core
ctx.strokeStyle = '#38BDF8';
ctx.lineWidth = 3.5;
ctx.beginPath();
ctx.moveTo(handX + 16, handY);
ctx.bezierCurveTo(handX + 150, handY - 40, coreX - 180, coreY - 20, coreX - 120, coreY - 20);
ctx.stroke();
ctx.restore();

ctx.restore();

// 4. THE VIRAL TYPOGRAPHY (ULTRA-BOLD, HIGH RETENTION, MAXIMUM CONTRAST)
// We use ONLY 2 HERO WORDS: "THINKING SAND"
ctx.save();
const textX = 75;

// Small Red Live Pill: "1950 ➔ 2026"
const pillY = 95;
ctx.fillStyle = '#EF4444';
ctx.beginPath();
ctx.roundRect(textX, pillY, 240, 42, 21);
ctx.fill();
ctx.fillStyle = '#FFFFFF';
ctx.font = '900 20px system-ui, -apple-system, sans-serif';
ctx.fillText('🔴 1950 ➔ 2026', textX + 28, pillY + 28);

// Line 1: "THINKING" (Huge Pure White)
ctx.font = '900 110px system-ui, -apple-system, sans-serif';
ctx.lineWidth = 22;
ctx.strokeStyle = '#020617';
ctx.strokeText('THINKING', textX, 235);
ctx.fillStyle = '#FFFFFF';
ctx.fillText('THINKING', textX, 235);

// Line 2: "SAND" (Huge Neon Gold)
ctx.font = '900 135px system-ui, -apple-system, sans-serif';
ctx.lineWidth = 26;
ctx.strokeStyle = '#020617';
ctx.strokeText('SAND', textX, 355);
const goldGrad = ctx.createLinearGradient(textX, 260, textX, 360);
goldGrad.addColorStop(0, '#FEF08A');
goldGrad.addColorStop(0.5, '#FACC15');
goldGrad.addColorStop(1, '#EAB308');
ctx.fillStyle = goldGrad;
ctx.fillText('SAND', textX, 355);

// Curiosity Question Sub-badge: "HOW DID IT WAKE UP?"
const qGrad = ctx.createLinearGradient(textX, 400, textX + 380, 400);
qGrad.addColorStop(0, '#38BDF8');
qGrad.addColorStop(1, '#A855F7');
ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
ctx.lineWidth = 2.5;
ctx.beginPath();
ctx.roundRect(textX, 385, 390, 52, 12);
ctx.fill();
ctx.stroke();

ctx.font = '900 22px system-ui, -apple-system, sans-serif';
ctx.fillStyle = '#38BDF8';
ctx.fillText('⚡ HOW DID IT WAKE UP?', textX + 24, 419);

ctx.restore();

// 5. Output
const buffer = canvas.toBuffer('image/png');
const outPath = path.resolve('exports/EP07-thumbnail.png');
const outPub = path.resolve('projects/ep07-history-of-ai/publishing/thumbnail.png');
const outArt = '/Users/prashantmishra/.gemini/antigravity/brain/bdfeb373-5174-479b-bf19-4f6ab9d0f198/ep07-thumbnail.png';

fs.writeFileSync(outPath, buffer);
fs.writeFileSync(outPub, buffer);
fs.writeFileSync(outArt, buffer);

console.log('✓ Million-View Thumbnail Generated Successfully!');

