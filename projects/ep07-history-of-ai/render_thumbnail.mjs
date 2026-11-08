import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// 1. Dark Cinematic Background
const bgGrad = ctx.createRadialGradient(WIDTH * 0.6, HEIGHT * 0.45, 80, WIDTH * 0.5, HEIGHT * 0.5, 900);
bgGrad.addColorStop(0, '#1a2333');
bgGrad.addColorStop(0.5, '#0b0f19');
bgGrad.addColorStop(1, '#05070c');
ctx.fillStyle = bgGrad;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Futuristic Cyber Grid floor in perspective
ctx.save();
ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
ctx.lineWidth = 1.5;
const vanishingY = 320;
for (let x = -200; x <= WIDTH + 200; x += 60) {
  ctx.beginPath();
  ctx.moveTo(x, HEIGHT);
  ctx.lineTo(WIDTH / 2 + (x - WIDTH / 2) * 0.15, vanishingY);
  ctx.stroke();
}
for (let y = HEIGHT; y >= vanishingY; y -= 35) {
  const norm = (y - vanishingY) / (HEIGHT - vanishingY);
  ctx.strokeStyle = `rgba(56, 189, 248, ${norm * 0.18})`;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(WIDTH, y);
  ctx.stroke();
}
ctx.restore();

// 2. Binary / Neural floating particles & circuit lines
ctx.save();
ctx.font = 'bold 13px monospace';
const binarySnippets = [
  '01000001 01001001', 'ATTENTION(Q,K,V)', 'L = E[||x - x_t||]',
  'W_grad += lr * dL', 'TURING_TEST: PASS', 'AGENT_LOOP: AUTONOMOUS'
];
for (let i = 0; i < 28; i++) {
  const px = (i * 47) % WIDTH;
  const py = 60 + (i * 29) % 360;
  ctx.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.22)' : 'rgba(234, 179, 8, 0.18)';
  ctx.fillText(binarySnippets[i % binarySnippets.length], px, py);
}
ctx.restore();

// 3. Right Side: Giant Glowing Neural AI Core / Autonomous Brain
ctx.save();
const coreX = 940;
const coreY = 340;

// Deep outer aura
const brainAura = ctx.createRadialGradient(coreX, coreY, 20, coreX, coreY, 320);
brainAura.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
brainAura.addColorStop(0.4, 'rgba(139, 92, 246, 0.25)');
brainAura.addColorStop(0.8, 'rgba(236, 72, 153, 0.08)');
brainAura.addColorStop(1, 'transparent');
ctx.fillStyle = brainAura;
ctx.beginPath();
ctx.arc(coreX, coreY, 320, 0, Math.PI * 2);
ctx.fill();

// Concentric energy rings
for (let r = 70; r <= 220; r += 38) {
  ctx.beginPath();
  ctx.ellipse(coreX, coreY, r, r * 0.72, Math.PI / 6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 16]);
  ctx.stroke();
}
ctx.setLineDash([]);

// Neural Nodes & Synapses
const nodes = [
  { x: coreX - 80, y: coreY - 60 },
  { x: coreX + 90, y: coreY - 70 },
  { x: coreX, y: coreY - 100 },
  { x: coreX - 90, y: coreY + 50 },
  { x: coreX + 70, y: coreY + 60 },
  { x: coreX, y: coreY + 110 },
  { x: coreX - 30, y: coreY },
  { x: coreX + 30, y: coreY - 10 },
];
ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
ctx.lineWidth = 2.5;
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
  ctx.arc(n.x, n.y, idx < 2 ? 14 : 9, 0, Math.PI * 2);
  ctx.fillStyle = idx % 2 === 0 ? '#38bdf8' : '#e879f9';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 18;
  ctx.fill();
});
ctx.restore();

// 4. Character: Magi in Heroic Explainer Stance (Left-Center)
ctx.save();
const magiX = 460;
const magiY = 600;
ctx.translate(magiX, magiY);

// Magi Ground Shadow
ctx.beginPath();
ctx.ellipse(0, 0, 75, 14, 0, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
ctx.fill();

// Proportional Legs
ctx.strokeStyle = '#FFFFFF';
ctx.lineWidth = 6;
ctx.lineCap = 'round';
// Left leg
ctx.beginPath();
ctx.moveTo(-16, -110);
ctx.lineTo(-30, -55);
ctx.lineTo(-24, 0);
ctx.stroke();
// Right leg
ctx.beginPath();
ctx.moveTo(16, -110);
ctx.lineTo(24, -55);
ctx.lineTo(32, 0);
ctx.stroke();

// Torso
ctx.beginPath();
ctx.moveTo(0, -110);
ctx.lineTo(8, -195);
ctx.stroke();

// Head
const headY = -232;
ctx.beginPath();
ctx.arc(8, headY, 36, 0, Math.PI * 2);
ctx.fillStyle = '#FFFFFF';
ctx.fill();
ctx.lineWidth = 4;
ctx.strokeStyle = '#0F172A';
ctx.stroke();

// Glasses
ctx.strokeStyle = '#0F172A';
ctx.lineWidth = 3.5;
ctx.beginPath();
ctx.arc(18, headY - 4, 11, 0, Math.PI * 2);
ctx.arc(36, headY - 4, 11, 0, Math.PI * 2);
ctx.moveTo(29, headY - 4);
ctx.lineTo(25, headY - 4);
ctx.stroke();

// Eye glints
ctx.fillStyle = '#0F172A';
ctx.beginPath();
ctx.arc(20, headY - 4, 3.5, 0, Math.PI * 2);
ctx.arc(38, headY - 4, 3.5, 0, Math.PI * 2);
ctx.fill();

// Yellow iconic scarf
ctx.fillStyle = '#FACC15';
ctx.beginPath();
ctx.roundRect(-8, -200, 38, 16, 8);
ctx.fill();
// Scarf tails flowing dynamically backward
ctx.beginPath();
ctx.moveTo(-4, -192);
ctx.bezierCurveTo(-35, -180, -60, -165, -85, -170);
ctx.lineWidth = 10;
ctx.strokeStyle = '#FACC15';
ctx.lineCap = 'round';
ctx.stroke();

// Iconic Wizard Hat
ctx.fillStyle = '#6366F1';
ctx.beginPath();
ctx.ellipse(8, -264, 46, 10, 0, 0, Math.PI * 2);
ctx.fill();
ctx.beginPath();
ctx.moveTo(-24, -264);
ctx.quadraticCurveTo(12, -345, 38, -360);
ctx.quadraticCurveTo(24, -290, 36, -264);
ctx.closePath();
ctx.fill();
// Gold Star on hat
ctx.fillStyle = '#FACC15';
ctx.beginPath();
ctx.arc(16, -295, 7, 0, Math.PI * 2);
ctx.fill();

// Arms: Right arm gesturing towards the AI Core, Left arm bent naturally
ctx.strokeStyle = '#FFFFFF';
ctx.lineWidth = 6;
// Left arm
ctx.beginPath();
ctx.moveTo(4, -188);
ctx.lineTo(-24, -150);
ctx.lineTo(-12, -125);
ctx.stroke();
// Right arm reaching proportionally towards AI core
ctx.beginPath();
ctx.moveTo(12, -188);
ctx.lineTo(55, -180);
ctx.lineTo(95, -205);
ctx.stroke();
// Pointer spark at fingertip
ctx.fillStyle = '#38BDF8';
ctx.shadowColor = '#38BDF8';
ctx.shadowBlur = 24;
ctx.beginPath();
ctx.arc(97, -207, 10, 0, Math.PI * 2);
ctx.fill();
ctx.restore();

// 5. Giant Impact Hero Typography (Left side, stacked, ultra readable at thumbnail scale)
ctx.save();

// Badge pill: "1950 → 2026 DOC"
const badgeY = 95;
ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
ctx.beginPath();
ctx.roundRect(70, badgeY, 260, 42, 21);
ctx.fill();
ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
ctx.shadowBlur = 18;
ctx.fillStyle = '#FFFFFF';
ctx.font = '900 19px system-ui, -apple-system, sans-serif';
ctx.letterSpacing = '1px';
ctx.fillText('🔴 1950 → 2026 DOC', 96, badgeY + 28);

// Main Title: "HOW WE TAUGHT" (Line 1)
ctx.shadowBlur = 0;
const titleX = 70;
ctx.font = '900 78px system-ui, -apple-system, sans-serif';

// Deep stroke/shadow for readability
ctx.lineWidth = 14;
ctx.strokeStyle = '#05070c';
ctx.strokeText('HOW WE TAUGHT', titleX, 225);
ctx.fillStyle = '#FFFFFF';
ctx.fillText('HOW WE TAUGHT', titleX, 225);

// Main Title: "SAND TO THINK" (Line 2 - Neon Gold)
ctx.lineWidth = 16;
ctx.strokeStyle = '#05070c';
ctx.strokeText('SAND TO THINK', titleX, 315);
const goldGrad = ctx.createLinearGradient(titleX, 250, titleX, 320);
goldGrad.addColorStop(0, '#FEF08A');
goldGrad.addColorStop(0.5, '#FACC15');
goldGrad.addColorStop(1, '#EAB308');
ctx.fillStyle = goldGrad;
ctx.fillText('SAND TO THINK', titleX, 315);

// Sub-hook pill: "TURING TO AUTONOMOUS AGENTS"
const hookGrad = ctx.createLinearGradient(titleX, 360, titleX + 480, 420);
hookGrad.addColorStop(0, '#38BDF8');
hookGrad.addColorStop(1, '#818CF8');
ctx.font = '900 32px system-ui, -apple-system, sans-serif';
ctx.lineWidth = 8;
ctx.strokeStyle = '#05070c';
ctx.strokeText('TURING ➔ AGENTS', titleX, 375);
ctx.fillStyle = hookGrad;
ctx.fillText('TURING ➔ AGENTS', titleX, 375);

// Bottom badge: "100% FACTUAL & CITATIONS"
ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.roundRect(titleX, 420, 320, 48, 10);
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#94A3B8';
ctx.font = 'bold 18px monospace';
ctx.fillText('⚡ ACADEMICALLY VERIFIED', titleX + 22, 451);

ctx.restore();

// 6. Save out thumbnail to projects and exports
const buffer = canvas.toBuffer('image/png');
const outPub = path.resolve('projects/ep07-history-of-ai/publishing/thumbnail.png');
const outExp = path.resolve('exports/EP07-thumbnail.png');

fs.writeFileSync(outPub, buffer);
fs.writeFileSync(outExp, buffer);
console.log(`Thumbnail generated successfully:`);
console.log(` - ${outPub}`);
console.log(` - ${outExp}`);

