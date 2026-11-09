import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

export function drawTiredRobot(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);

  const breathe = Math.sin(t * 1.8) * 2;
  const slumpY = breathe;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 45, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Curb sidewalk
  ctx.fillStyle = '#334155';
  ctx.fillRect(-80, 0, 160, 16);
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(-80, 16, 160, 40);

  // Metal body (box)
  ctx.fillStyle = '#64748B';
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-22, -65 + slumpY, 44, 55, 6);
  ctx.fill(); ctx.stroke();

  // Robot Head (slumping forward)
  const headAngle = 0.18 + Math.sin(t * 1.8) * 0.05;
  ctx.save();
  ctx.translate(0, -70 + slumpY);
  ctx.rotate(headAngle);

  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-18, -32, 36, 32, 6);
  ctx.fill(); ctx.stroke();

  // Antenna
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(0, -44);
  ctx.stroke();
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#EF4444' : '#7F1D1D';
  ctx.beginPath();
  ctx.arc(0, -46, 4, 0, Math.PI * 2);
  ctx.fill();

  // Sleepy visor eyes
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(-12, -22, 24, 10);
  ctx.fillStyle = '#38BDF8';
  ctx.globalAlpha = 0.45 + Math.sin(t * 3) * 0.25;
  ctx.fillRect(-9, -19, 6, 4);
  ctx.fillRect(3, -19, 6, 4);
  ctx.globalAlpha = 1.0;

  ctx.restore();

  // Slumping stick arms resting on knees
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, -55 + slumpY);
  ctx.lineTo(-28, -25);
  ctx.lineTo(-20, -5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(18, -55 + slumpY);
  ctx.lineTo(28, -25);
  ctx.lineTo(20, -5);
  ctx.stroke();

  // Sitting legs
  ctx.beginPath();
  ctx.moveTo(-12, -15);
  ctx.lineTo(-24, 0);
  ctx.lineTo(-24, 18);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(12, -15);
  ctx.lineTo(24, 0);
  ctx.lineTo(24, 18);
  ctx.stroke();

  // Low Battery Badge (NO EMOJI TO AVOID TOFU)
  const badgeY = -105 + slumpY;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = Math.sin(t * 5) > 0 ? '#EF4444' : '#F59E0B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-55, badgeY, 110, 24, 12);
  ctx.fill(); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#EF4444';
  ctx.fillText('LOW: 2% BATTERY', 0, badgeY + 16);

  ctx.restore();
}

export function drawProfessorBoard(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);

  // Wooden Blackboard Frame
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(0, 0, 320, 220, 8);
  ctx.fill(); ctx.stroke();

  // Blackboard Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('1 CPU: BRILLIANT PROFESSOR', 160, 28);

  // Professor Math scribbles
  ctx.textAlign = 'left';
  ctx.font = '14px monospace';
  ctx.fillStyle = '#FEF08A';
  ctx.fillText('Problem #1: 1492 * 839', 24, 65);
  ctx.fillText('  Step 1: 1492 * 9 = 13428', 24, 90);
  ctx.fillText('  Step 2: 1492 * 30 = 44760', 24, 115);
  ctx.fillText('  Step 3: 1492 * 800 = 1193600', 24, 140);
  ctx.fillStyle = '#10B981';
  ctx.fillText('Result = 1,251,788', 24, 175);

  ctx.fillStyle = '#EF4444';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('[ 1 EQUATION AT A TIME ]', 24, 202);

  // Stick Professor
  const profX = 360, profY = 190;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  // Head
  ctx.beginPath(); ctx.arc(profX, profY - 70, 14, 0, Math.PI * 2); ctx.stroke();
  // Glasses
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(profX - 10, profY - 73, 8, 6);
  ctx.strokeRect(profX + 2, profY - 73, 8, 6);
  // Torso
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(profX, profY - 56); ctx.lineTo(profX, profY - 20); ctx.stroke();
  // Legs
  ctx.beginPath(); ctx.moveTo(profX, profY - 20); ctx.lineTo(profX - 8, profY + 15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(profX, profY - 20); ctx.lineTo(profX + 8, profY + 15); ctx.stroke();
  // Chalk arm writing on board
  const chalkY = profY - 45 + Math.sin(t * 8) * 8;
  ctx.beginPath(); ctx.moveTo(profX, profY - 50); ctx.lineTo(profX - 25, chalkY); ctx.stroke();
  // Left arm
  ctx.beginPath(); ctx.moveTo(profX, profY - 50); ctx.lineTo(profX + 15, profY - 30); ctx.stroke();

  ctx.restore();
}

export function drawMiniPainters(ctx, x, y, w, h, t) {
  ctx.save();
  ctx.translate(x, y);

  // Background Box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 10);
  ctx.fill(); ctx.stroke();

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#10B981';
  ctx.fillText('1,000 GPU PAINTERS (PIXELS IN PARALLEL)', w / 2, 28);

  // Grid of mini pixels being painted simultaneously
  const cols = 8;
  const rows = 4;
  const pw = 40, ph = 26;
  const startX = (w - (cols * (pw + 8))) / 2;
  const startY = 48;

  const colors = ['#EF4444', '#38BDF8', '#FACC15', '#10B981', '#EC4899', '#A855F7', '#F97316', '#06B6D4'];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = startX + c * (pw + 8);
      const py = startY + r * (ph + 18);
      const col = colors[(r * cols + c) % colors.length];

      // Pixel box
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.35 + Math.sin(t * 6 + r + c) * 0.35;
      ctx.fillRect(px, py, pw, ph);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(px, py, pw, ph);

      // Mini painter stickman above pixel
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      const mx = px + pw / 2, my = py - 6;
      // Head
      ctx.beginPath(); ctx.arc(mx, my - 6, 3, 0, Math.PI * 2); ctx.stroke();
      // Body & arm with paint roller
      ctx.beginPath(); ctx.moveTo(mx, my - 3); ctx.lineTo(mx, my + 3); ctx.stroke();
      const wave = Math.sin(t * 10 + c) * 4;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 4, my + 4 + wave); ctx.stroke();
    }
  }

  ctx.textAlign = 'center';
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#FEF08A';
  ctx.fillText('ALL PIXELS MULTIPLIED AT THE EXACT SAME MILLISECOND!', w / 2, h - 14);

  ctx.restore();
}

console.log('Helpers defined and tested!');

