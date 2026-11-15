import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '../../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';
import { solve2BoneIK } from '../../tools/stickman.mjs';

const WIDTH = 1280;
const HEIGHT = 720;

const PROJECT_DIR = path.resolve('projects/ep08-how-ai-actually-works');
const OUT_PROJECT = path.join(PROJECT_DIR, 'publishing/thumbnail.png');
const OUT_EXPORTS = path.resolve('exports/EP02-thumbnail.png');

function drawStickman(ctx, x, y, scale = 1.0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Glow aura around Magi
  ctx.save();
  ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
  ctx.shadowBlur = 24;

  // Head
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, -90, 24, 0, Math.PI * 2);
  ctx.fillStyle = '#0F172A';
  ctx.fill();
  ctx.stroke();

  // Magi's eye with curious wide gaze
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.arc(10, -92, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Torso
  ctx.beginPath();
  ctx.moveTo(0, -66);
  ctx.lineTo(0, 10);
  ctx.stroke();

  // Series signature: Yellow Scarf
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-12, -64);
  ctx.lineTo(14, -64);
  ctx.lineTo(6, -46);
  ctx.stroke();

  // Scarf tails flowing back
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-8, -62);
  ctx.quadraticCurveTo(-26, -55, -34, -40);
  ctx.stroke();

  ctx.restore(); // remove shadow

  // Legs with 2-bone IK
  const hip = [0, 10];
  const leftFoot = [-28, 110];
  const rightFoot = [32, 110];

  const leftLeg = solve2BoneIK(hip, leftFoot, 52, 52, 1);
  const rightLeg = solve2BoneIK(hip, rightFoot, 52, 52, -1);

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;

  // Draw Left Leg
  ctx.beginPath();
  ctx.moveTo(leftLeg[0][0], leftLeg[0][1]);
  ctx.lineTo(leftLeg[1][0], leftLeg[1][1]);
  ctx.lineTo(leftLeg[2][0], leftLeg[2][1]);
  ctx.stroke();

  // Draw Right Leg
  ctx.beginPath();
  ctx.moveTo(rightLeg[0][0], rightLeg[0][1]);
  ctx.lineTo(rightLeg[1][0], rightLeg[1][1]);
  ctx.lineTo(rightLeg[2][0], rightLeg[2][1]);
  ctx.stroke();

  // Arms: Right hand holds a glowing cyber magnifying glass towards the center
  const shoulder = [0, -54];
  const targetLens = [95, -45];
  const arm = solve2BoneIK(shoulder, targetLens, 46, 46, -1);

  ctx.beginPath();
  ctx.moveTo(arm[0][0], arm[0][1]);
  ctx.lineTo(arm[1][0], arm[1][1]);
  ctx.lineTo(arm[2][0], arm[2][1]);
  ctx.stroke();

  // Left arm raised in wonder
  const leftHand = [-45, -75];
  const leftArm = solve2BoneIK(shoulder, leftHand, 40, 40, 1);
  ctx.beginPath();
  ctx.moveTo(leftArm[0][0], leftArm[0][1]);
  ctx.lineTo(leftArm[1][0], leftArm[1][1]);
  ctx.lineTo(leftArm[2][0], leftArm[2][1]);
  ctx.stroke();

  // Cyber Magnifying Glass
  ctx.save();
  ctx.translate(targetLens[0], targetLens[1]);
  ctx.rotate(-0.2);

  // Handle
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(30, -10);
  ctx.stroke();

  // Glass Rim
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 5;
  ctx.shadowColor = '#0284C7';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(62, -20, 32, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
  ctx.fill();
  ctx.stroke();

  // Inner beam from lens
  const beamGrad = ctx.createRadialGradient(62, -20, 2, 62, -20, 36);
  beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  beamGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.4)');
  beamGrad.addColorStop(1, 'rgba(14, 165, 233, 0.0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.arc(62, -20, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.restore();
}

async function renderThumbnail() {
  console.log('Rendering Definitive YouTube Thumbnail for Episode 02...');
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // 1. Deep Space Tech Cyber Background
  const bgGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bgGrad.addColorStop(0, '#020617');
  bgGrad.addColorStop(0.5, '#0B132B');
  bgGrad.addColorStop(1, '#030712');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. 3D Perspective Neural Coordinate Grid
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1.5;
  const horizonY = 320;
  const vanishX = 860;

  // Perspective floor grid lines
  for (let x = -200; x <= WIDTH + 400; x += 110) {
    ctx.beginPath();
    ctx.moveTo(vanishX, horizonY);
    ctx.lineTo(x, HEIGHT + 50);
    ctx.stroke();
  }
  // Horizontal depth lines
  for (let i = 0; i <= 10; i++) {
    const t = Math.pow(i / 10, 2.2);
    const y = horizonY + t * (HEIGHT - horizonY);
    ctx.beginPath();
    ctx.moveTo(350, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Glowing Attention Flashlight Beams (Right Center)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const beamCenters = [
    { x: 780, y: 160, color: '#38BDF8', label: 'Q' },
    { x: 920, y: 120, color: '#FACC15', label: 'K' },
    { x: 1060, y: 160, color: '#EC4899', label: 'V' }
  ];

  const focusX = 920;
  const focusY = 460;

  for (const b of beamCenters) {
    const beam = ctx.createRadialGradient(b.x, b.y, 5, focusX, focusY, 260);
    beam.addColorStop(0, b.color + 'aa');
    beam.addColorStop(0.7, b.color + '22');
    beam.addColorStop(1, 'transparent');
    ctx.fillStyle = beam;

    ctx.beginPath();
    ctx.moveTo(b.x - 25, b.y);
    ctx.lineTo(focusX - 35, focusY);
    ctx.lineTo(focusX + 35, focusY);
    ctx.lineTo(b.x + 25, b.y);
    ctx.closePath();
    ctx.fill();

    // Source Emitter Orbs
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 14, 0, Math.PI * 2);
    ctx.fill();

    // Q, K, V Badges
    ctx.shadowBlur = 0;
    ctx.font = '900 16px monospace';
    ctx.fillStyle = '#020617';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x, b.y + 5);
  }
  ctx.restore();

  // 4. Central Glowing High-Dimensional Vector Crystal
  ctx.save();
  ctx.shadowColor = '#38BDF8';
  ctx.shadowBlur = 40;
  const crystalGrad = ctx.createRadialGradient(focusX, focusY, 10, focusX, focusY, 90);
  crystalGrad.addColorStop(0, '#FFFFFF');
  crystalGrad.addColorStop(0.4, '#38BDF8');
  crystalGrad.addColorStop(0.8, '#818CF8');
  crystalGrad.addColorStop(1, 'rgba(129, 140, 248, 0)');
  ctx.fillStyle = crystalGrad;
  ctx.beginPath();
  ctx.arc(focusX, focusY, 90, 0, Math.PI * 2);
  ctx.fill();

  // Inner floating formula: King - Man + Woman = Queen
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#F8FAFC';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 12;
  ctx.textAlign = 'center';
  ctx.fillText('KING - MAN + WOMAN', focusX, focusY - 14);
  ctx.font = '900 24px monospace';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('= QUEEN', focusX, focusY + 18);
  ctx.restore();

  // 5. MoE 64-Chef Kitchen Callout (Floating Glass Card at Top Right)
  ctx.save();
  const cardX = 940;
  const cardY = 520;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(cardX - 120, cardY - 40, 250, 75, 14);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '900 18px system-ui, sans-serif';
  ctx.fillStyle = '#34D399';
  ctx.fillText('64-CHEF KITCHEN', cardX + 5, cardY - 12);

  ctx.font = 'bold 15px monospace';
  ctx.fillStyle = '#F1F5F9';
  ctx.fillText('62 SLEEPING • 2 ACTIVE', cardX + 5, cardY + 16);
  ctx.restore();

  // 6. Left-Side Contrast Dark Gradient (Guarantees 100% mobile text readability)
  const leftGrad = ctx.createLinearGradient(0, 0, 760, 0);
  leftGrad.addColorStop(0, 'rgba(2, 6, 23, 0.96)');
  leftGrad.addColorStop(0.5, 'rgba(2, 6, 23, 0.88)');
  leftGrad.addColorStop(0.8, 'rgba(2, 6, 23, 0.45)');
  leftGrad.addColorStop(1, 'rgba(2, 6, 23, 0.0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, 800, HEIGHT);

  // 7. Top Badges (Episode 02 & Model Ecosystem)
  const badgeY = 70;

  // Blue Badge: EPISODE 02
  ctx.save();
  const blueGrad = ctx.createLinearGradient(60, badgeY, 230, badgeY);
  blueGrad.addColorStop(0, '#0284C7');
  blueGrad.addColorStop(1, '#0EA5E9');
  ctx.fillStyle = blueGrad;
  ctx.strokeStyle = '#BAE6FD';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(14, 165, 233, 0.6)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.roundRect(60, badgeY - 26, 170, 42, 21);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '900 18px system-ui, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('EPISODE 02', 145, badgeY + 2);
  ctx.restore();

  // Gold Badge: GPT • GEMINI • DEEPSEEK
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = 'rgba(250, 204, 21, 0.4)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(248, badgeY - 26, 280, 42, 21);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 15px monospace';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('GPT • GEMINI • DEEPSEEK', 388, badgeY + 2);
  ctx.restore();

  // 8. GIANT HIGH-CTR HEADLINE
  const textX = 60;
  const line1Y = 200;
  const line2Y = 305;

  ctx.save();
  ctx.textAlign = 'left';

  // Line 1: HOW AI
  ctx.font = '900 102px Impact, system-ui, sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#020617';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 8;
  ctx.strokeText('HOW AI', textX, line1Y);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('HOW AI', textX, line1Y);

  // Line 2: ACTUALLY THINKS
  ctx.font = '900 90px Impact, system-ui, sans-serif';
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#020617';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 8;
  ctx.strokeText('ACTUALLY THINKS', textX, line2Y);

  const goldGrad = ctx.createLinearGradient(textX, line2Y - 70, textX, line2Y);
  goldGrad.addColorStop(0, '#FEF08A');
  goldGrad.addColorStop(1, '#FACC15');
  ctx.fillStyle = goldGrad;
  ctx.fillText('ACTUALLY THINKS', textX, line2Y);
  ctx.restore();

  // 9. Subtitle Pill: 12,288-D VECTORS • ATTENTION • REASONING
  const subY = 360;
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(textX, subY, 510, 50, 12);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = '900 17px monospace';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('12,288-D VECTORS • ATTENTION • 64 CHEFS', textX + 20, subY + 31);
  ctx.restore();

  // 10. Draw Magi Inspecting with Wonder (Positioned at Left-Center examining the beam)
  drawStickman(ctx, 420, 520, 1.45);

  // 11. Write Outputs
  const buf = canvas.toBuffer('image/png');
  fs.mkdirSync(path.dirname(OUT_PROJECT), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_EXPORTS), { recursive: true });

  // Remove old symlink if present
  if (fs.existsSync(OUT_EXPORTS)) {
    try {
      const stat = fs.lstatSync(OUT_EXPORTS);
      if (stat.isSymbolicLink()) fs.unlinkSync(OUT_EXPORTS);
    } catch (e) {}
  }

  fs.writeFileSync(OUT_PROJECT, buf);
  fs.writeFileSync(OUT_EXPORTS, buf);

  console.log(`✓ Thumbnail successfully rendered (1280x720):`);
  console.log(`  -> ${OUT_PROJECT}`);
  console.log(`  -> ${OUT_EXPORTS}`);
}

renderThumbnail();
