import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, loadImage } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 24;
const DURATION = 427.92;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const PROJECT_DIR = path.resolve('projects/ep07-history-of-ai');
const PORTRAITS_DIR = path.join(PROJECT_DIR, 'assets/portraits');
const AUDIO_MASTER = path.join(PROJECT_DIR, 'build_feynman/narration_master.wav');
const CAPTIONS_FILE = path.join(PROJECT_DIR, 'build_feynman/captions.json');
const TEMP_VIDEO = '/tmp/ep07_temp_feynman.mp4';
const FINAL_OUTPUT = path.resolve('exports/EP07-The-Complete-History-of-AI.mp4');

const captions = JSON.parse(fs.readFileSync(CAPTIONS_FILE, 'utf8'));

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function ease(t) {
  t = clamp(t);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function int(v) {
  return Math.floor(v);
}

// -------------------------------------------------------------
// VECTOR ICON DRAWING HELPERS (ZERO TOFU BOXES GUARANTEED)
// -------------------------------------------------------------
function drawStar(ctx, cx, cy, r, fill = '#FACC15') {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = (i * 72 - 90) * Math.PI / 180;
    const a2 = (i * 72 + 36 - 90) * Math.PI / 180;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r;
    const x2 = cx + Math.cos(a2) * (r * 0.45);
    const y2 = cy + Math.sin(a2) * (r * 0.45);
    if (i === 0) ctx.moveTo(x1, y1);
    else ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGradCap(ctx, x, y, size = 34) {
  ctx.save();
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.35);
  ctx.lineTo(x + size * 0.85, y);
  ctx.lineTo(x, y + size * 0.35);
  ctx.lineTo(x - size * 0.85, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x - size * 0.4, y + size * 0.1, size * 0.8, size * 0.4);
  ctx.restore();
}

function drawPalette(ctx, x, y, size = 18) {
  ctx.save();
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(x - 6, y - 5, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#38BDF8'; ctx.beginPath(); ctx.arc(x + 5, y - 6, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FACC15'; ctx.beginPath(); ctx.arc(x + 6, y + 5, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0F172A'; ctx.beginPath(); ctx.arc(x - 5, y + 6, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawToast(ctx, x, y, size = 42) {
  ctx.save();
  ctx.fillStyle = '#F59E0B';
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x - size * 0.5, y - size * 0.5, size, size * 0.9, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.roundRect(x - size * 0.35, y - size * 0.35, size * 0.7, size * 0.6, 4);
  ctx.fill();
  ctx.restore();
}

function drawCookie(ctx, x, y, type = 'plain') {
  ctx.save();
  ctx.fillStyle = '#D97706';
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (type === 'choc' || type === 'both') {
    ctx.fillStyle = '#451A03';
    ctx.beginPath(); ctx.arc(x - 5, y - 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 6, y - 5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 2, y + 6, 3, 0, Math.PI * 2); ctx.fill();
  }
  if (type === 'sprinkles' || type === 'both') {
    ctx.fillStyle = '#F43F5E'; ctx.fillRect(x + 4, y + 2, 4, 2);
    ctx.fillStyle = '#38BDF8'; ctx.fillRect(x - 7, y + 2, 4, 2);
    ctx.fillStyle = '#10B981'; ctx.fillRect(x, y - 7, 2, 4);
  }
  ctx.restore();
}

function drawClipboard(ctx, x, y, size = 32) {
  ctx.save();
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.roundRect(x - size * 0.45, y - size * 0.55, size * 0.9, size * 1.1, 4);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x - size * 0.25, y - size * 0.65, size * 0.5, size * 0.2);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(x - size * 0.3, y - size * 0.2, size * 0.6, 3);
  ctx.fillRect(x - size * 0.3, y + size * 0.05, size * 0.6, 3);
  ctx.fillRect(x - size * 0.3, y + size * 0.3, size * 0.4, 3);
  ctx.restore();
}

function drawTerminal(ctx, x, y, size = 32) {
  ctx.save();
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(x - size * 0.6, y - size * 0.45, size * 1.2, size * 0.9, 5);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('>_$', x, y + 5);
  ctx.restore();
}

function drawWrench(ctx, x, y, size = 30) {
  ctx.save();
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size * 0.35, y + size * 0.35);
  ctx.lineTo(x + size * 0.2, y - size * 0.2);
  ctx.stroke();
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(x + size * 0.25, y - size * 0.25, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(x + size * 0.25, y - size * 0.25, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// -------------------------------------------------------------
// HISTORICAL PORTRAIT CARD HELPER
// -------------------------------------------------------------
function drawPortraitCard(ctx, img, name, role, year, x, y, w, h, borderColor = '#38BDF8') {
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();

  if (year) {
    ctx.fillStyle = borderColor;
    ctx.beginPath();
    ctx.roundRect(x + w - 82, y + 10, 72, 24, 12);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(year, x + w - 46, y + 26);
  }

  const imgSize = Math.min(w - 30, h - 90);
  const imgX = x + (w - imgSize) / 2;
  const imgY = y + 38;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(imgX, imgY, imgSize, imgSize, 10);
  ctx.clip();

  if (img) {
    const aspect = img.width / img.height;
    let sw, sh, sx, sy;
    if (aspect > 1) {
      sh = img.height; sw = img.height; sx = (img.width - sw) / 2; sy = 0;
    } else {
      sw = img.width; sh = img.width; sx = 0; sy = (img.height - sh) / 4;
    }
    ctx.drawImage(img, sx, sy, sw, sh, imgX, imgY, imgSize, imgSize);
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(imgX, imgY, imgSize, imgSize);

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(name, x + w / 2, y + h - 34);

  ctx.font = '11px monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(role, x + w / 2, y + h - 14);

  ctx.restore();
}

// -------------------------------------------------------------
// LIVING SCENE VECTOR ELEMENTS (TIRED ROBOT, PROFESSOR, TV, TABLE)
// -------------------------------------------------------------
function drawTiredRobot(ctx, x, y, t) {
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

  // Low Battery Badge
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

function drawProfessorBoard(ctx, x, y, t) {
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
  ctx.beginPath(); ctx.arc(profX, profY - 70, 14, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(profX - 10, profY - 73, 8, 6);
  ctx.strokeRect(profX + 2, profY - 73, 8, 6);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(profX, profY - 56); ctx.lineTo(profX, profY - 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(profX, profY - 20); ctx.lineTo(profX - 8, profY + 15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(profX, profY - 20); ctx.lineTo(profX + 8, profY + 15); ctx.stroke();
  const chalkY = profY - 45 + Math.sin(t * 8) * 8;
  ctx.beginPath(); ctx.moveTo(profX, profY - 50); ctx.lineTo(profX - 25, chalkY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(profX, profY - 50); ctx.lineTo(profX + 15, profY - 30); ctx.stroke();

  ctx.restore();
}

function drawMiniPainters(ctx, x, y, w, h, t) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 10);
  ctx.fill(); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#10B981';
  ctx.fillText('1,000 GPU PAINTERS (PIXELS IN PARALLEL)', w / 2, 28);

  const cols = 8, rows = 4;
  const pw = 38, ph = 24;
  const startX = (w - (cols * (pw + 8))) / 2;
  const startY = 46;
  const colors = ['#EF4444', '#38BDF8', '#FACC15', '#10B981', '#EC4899', '#A855F7', '#F97316', '#06B6D4'];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = startX + c * (pw + 8);
      const py = startY + r * (ph + 18);
      const col = colors[(r * cols + c) % colors.length];

      ctx.fillStyle = col;
      ctx.globalAlpha = 0.35 + Math.sin(t * 6 + r + c) * 0.35;
      ctx.fillRect(px, py, pw, ph);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(px, py, pw, ph);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      const mx = px + pw / 2, my = py - 5;
      ctx.beginPath(); ctx.arc(mx, my - 5, 2.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my - 2); ctx.lineTo(mx, my + 3); ctx.stroke();
      const wave = Math.sin(t * 10 + c) * 3;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 4, my + 3 + wave); ctx.stroke();
    }
  }

  ctx.textAlign = 'center';
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#FEF08A';
  ctx.fillText('ALL PIXELS MULTIPLIED AT THE EXACT SAME MILLISECOND!', w / 2, h - 14);

  ctx.restore();
}

function drawRetroTV(ctx, x, y, w, h, t) {
  ctx.save();
  ctx.translate(x, y);

  // TV Cabinet
  ctx.fillStyle = '#5B21B6';
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 20);
  ctx.fill(); ctx.stroke();

  // Rabbit Ear Antenna (Sleek angled tips above right control panel)
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(w - 70, 0); ctx.lineTo(w - 95, -20);
  ctx.moveTo(w - 70, 0); ctx.lineTo(w - 45, -20);
  ctx.stroke();
  ctx.fillStyle = '#EF4444';
  ctx.beginPath(); ctx.arc(w - 95, -20, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w - 45, -20, 3, 0, Math.PI * 2); ctx.fill();

  // CRT Screen Bezel
  const scX = 25, scY = 25, scW = w - 150, scH = h - 50;
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(scX, scY, scW, scH, 16);
  ctx.fill(); ctx.stroke();

  // Screen Content: Dissolving Noise into Sun
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(scX + 4, scY + 4, scW - 8, scH - 8, 12);
  ctx.clip();

  const skyGrad = ctx.createLinearGradient(0, scY, 0, scY + scH);
  skyGrad.addColorStop(0, '#1E1B4B');
  skyGrad.addColorStop(1, '#B45309');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(scX, scY, scW, scH);

  // Sun
  ctx.fillStyle = '#FACC15';
  ctx.shadowColor = '#FACC15';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(scX + scW / 2, scY + scH * 0.55, 45, 0, Math.PI * 2);
  ctx.fill();

  // Procedural Noise dissolving with time
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  const noiseDensity = Math.max(50, 300 - (t % 15) * 16);
  for (let i = 0; i < noiseDensity; i++) {
    const nx = scX + (Math.sin(i * 133.7 + t) * 0.5 + 0.5) * scW;
    const ny = scY + (Math.cos(i * 97.3 + t) * 0.5 + 0.5) * scH;
    ctx.fillRect(nx, ny, 2.5, 2.5);
  }

  // Scanlines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1;
  for (let sy = scY; sy < scY + scH; sy += 4) {
    ctx.beginPath(); ctx.moveTo(scX, sy); ctx.lineTo(scX + scW, sy); ctx.stroke();
  }
  ctx.restore();

  // Right Side Control Panel
  const cpX = w - 110;
  ctx.fillStyle = '#312E81';
  ctx.fillRect(cpX, 25, 85, h - 50);

  // Rotary Dial
  ctx.fillStyle = '#1E1B4B';
  ctx.strokeStyle = '#A78BFA';
  ctx.lineWidth = 2.5;
  const dialAngle = t * 2.5;
  ctx.beginPath(); ctx.arc(cpX + 42, 80, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FACC15';
  ctx.beginPath(); ctx.arc(cpX + 42 + Math.cos(dialAngle) * 14, 80 + Math.sin(dialAngle) * 14, 4.5, 0, Math.PI * 2); ctx.fill();

  ctx.font = 'bold 9.5px monospace';
  ctx.fillStyle = '#C4B5FD';
  ctx.textAlign = 'center';
  ctx.fillText('NOISE DIAL', cpX + 42, 120);

  // Speaker Grille
  ctx.strokeStyle = '#4C1D95';
  ctx.lineWidth = 2.5;
  for (let gy = 150; gy < h - 45; gy += 12) {
    ctx.beginPath(); ctx.moveTo(cpX + 15, gy); ctx.lineTo(cpX + 70, gy); ctx.stroke();
  }

  ctx.restore();
}

// -------------------------------------------------------------
// MASCOT MAGI (STICKMAN CHARACTER DIRECTION)
// -------------------------------------------------------------
function drawMagi(ctx, x, y, options = {}) {
  const { facing = 1, isWalking = false, walkSpeed = 1, armAction = 'idle', t = 0 } = options;

  ctx.save();
  ctx.translate(x, y);

  const cycle = isWalking ? t * 8.5 * walkSpeed : t * 2.2;
  const bounce = isWalking ? Math.abs(Math.sin(cycle)) * 5.5 : Math.sin(t * 2.2) * 1.5;
  const hipY = -70 - bounce;

  // Shadow
  ctx.beginPath();
  ctx.ellipse(0, 0, 38 - bounce * 1.1, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();

  // Bipedal Legs
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const legSwing = isWalking ? Math.sin(cycle) * 26 : 0;
  ctx.beginPath();
  ctx.moveTo(-10, hipY);
  ctx.lineTo(-10 + legSwing * 0.5, hipY + 36);
  ctx.lineTo(-10 + legSwing, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(10, hipY);
  ctx.lineTo(10 - legSwing * 0.5, hipY + 36);
  ctx.lineTo(10 - legSwing, 0);
  ctx.stroke();

  // Torso
  const torsoLean = isWalking ? 4 * (facing || 1) : 0;
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(torsoLean, hipY - 55);
  ctx.stroke();

  const shoulderY = hipY - 55;
  const headY = shoulderY - 26;

  let lElbowX = -15, lElbowY = shoulderY + 20, lHandX = -12, lHandY = shoulderY + 45;
  let rElbowX = 15, rElbowY = shoulderY + 20, rHandX = 12, rHandY = shoulderY + 45;

  if (armAction === 'point_right') {
    rElbowX = 26; rElbowY = shoulderY - 6; rHandX = 52; rHandY = shoulderY - 14;
    lElbowX = -18; lElbowY = shoulderY + 18; lHandX = -6; lHandY = shoulderY + 28;
  } else if (armAction === 'point_up') {
    rElbowX = 20; rElbowY = shoulderY - 25; rHandX = 25; rHandY = shoulderY - 55;
    lElbowX = -18; lElbowY = shoulderY + 18; lHandX = -6; lHandY = shoulderY + 28;
  } else if (armAction === 'inspect_phone') {
    lElbowX = -12; lElbowY = shoulderY + 15; lHandX = 5; lHandY = shoulderY + 10;
    rElbowX = 16; rElbowY = shoulderY + 14; rHandX = 10; rHandY = shoulderY + 10;
  } else if (armAction === 'baffled') {
    lElbowX = -24; lElbowY = shoulderY + 5; lHandX = -28; lHandY = headY;
    rElbowX = 24; rElbowY = shoulderY + 5; rHandX = 28; rHandY = headY;
  } else if (armAction === 'arms_crossed') {
    lElbowX = -18; lElbowY = shoulderY + 20; lHandX = 14; lHandY = shoulderY + 22;
    rElbowX = 18; rElbowY = shoulderY + 22; rHandX = -12; rHandY = shoulderY + 24;
  } else if (armAction === 'thumbs_up') {
    rElbowX = 22; rElbowY = shoulderY - 10; rHandX = 36; rHandY = shoulderY - 32;
    lElbowX = -18; lElbowY = shoulderY + 18; lHandX = -8; lHandY = shoulderY + 28;
  } else if (armAction === 'shiver') {
    const shiverOff = Math.sin(t * 28) * 3;
    lElbowX = -12 + shiverOff; lElbowY = shoulderY + 15; lHandX = 10; lHandY = shoulderY + 18;
    rElbowX = 12 - shiverOff; rElbowY = shoulderY + 15; rHandX = -10; rHandY = shoulderY + 18;
  } else if (armAction === 'magic_wand') {
    rElbowX = 28; rElbowY = shoulderY - 15; rHandX = 50; rHandY = shoulderY - 45;
    lElbowX = -18; lElbowY = shoulderY + 18; lHandX = -8; lHandY = shoulderY + 28;
  } else if (isWalking) {
    const armSwing = Math.sin(cycle) * 22;
    lHandX = -15 - armSwing;
    rHandX = 15 + armSwing;
  }

  // Left Arm
  ctx.beginPath();
  ctx.moveTo(-4 + torsoLean, shoulderY);
  ctx.lineTo(lElbowX, lElbowY);
  ctx.lineTo(lHandX, lHandY);
  ctx.stroke();

  // Right Arm
  ctx.beginPath();
  ctx.moveTo(4 + torsoLean, shoulderY);
  ctx.lineTo(rElbowX, rElbowY);
  ctx.lineTo(rHandX, rHandY);
  ctx.stroke();

  // Magic Wand or Laser Pointer
  if (armAction === 'point_right') {
    ctx.save();
    ctx.fillStyle = '#38BDF8';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(rHandX, rHandY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rHandX, rHandY);
    ctx.lineTo(rHandX + 160, rHandY - 20);
    ctx.stroke();
    ctx.restore();
  } else if (armAction === 'magic_wand') {
    ctx.save();
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rHandX - 8, rHandY + 12);
    ctx.lineTo(rHandX + 22, rHandY - 26);
    ctx.stroke();
    ctx.fillStyle = '#FDE047';
    ctx.shadowColor = '#FACC15';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(rHandX + 22, rHandY - 26, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (armAction === 'inspect_phone') {
    ctx.save();
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(8, shoulderY + 2, 14, 22, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(10, shoulderY + 5, 10, 14);
    ctx.restore();
  }

  // Head
  ctx.beginPath();
  ctx.arc(torsoLean, headY, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#0F172A';
  ctx.fill();
  ctx.stroke();

  // Mascot Glasses
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2.2;
  const glassEyeX = torsoLean + 4;
  ctx.strokeRect(glassEyeX - 6, headY - 4, 11, 8);
  ctx.strokeRect(glassEyeX + 7, headY - 4, 11, 8);
  ctx.beginPath();
  ctx.moveTo(glassEyeX + 5, headY);
  ctx.lineTo(glassEyeX + 7, headY);
  ctx.stroke();

  // Wizard Hat
  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.ellipse(torsoLean, headY - 14, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(torsoLean - 16, headY - 14);
  ctx.lineTo(torsoLean + 10, headY - 48);
  ctx.lineTo(torsoLean + 16, headY - 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FACC15';
  ctx.fillRect(torsoLean - 13, headY - 18, 26, 4);

  // Yellow Scarf
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.ellipse(torsoLean, shoulderY, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const scarfWave = Math.sin(t * 3.5) * 4;
  ctx.beginPath();
  ctx.moveTo(torsoLean - 5, shoulderY);
  ctx.lineTo(torsoLean - 14 + scarfWave, shoulderY + 22);
  ctx.lineTo(torsoLean - 7 + scarfWave, shoulderY + 24);
  ctx.lineTo(torsoLean, shoulderY + 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// -------------------------------------------------------------
// DYNAMIC MICRO-SYNCED CHAPTER VISUALIZER
// -------------------------------------------------------------
function drawChapter(ctx, t, chapterIdx, localT, portraits) {
  // Clear Top-Left Act Header (NO EMOJIS, NO OVERLAP WITH WATERMARK)
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#38BDF8';

  const actHeaders = [
    'ACT 1: THE BEACH, LIGHTNING, & ALAN TURING (1950-1956)',
    'ACT 2: THE ROTTEN MEAT & THE COOKIE PUZZLE (1969-1973)',
    'ACT 3: THE VIDEO GAME SECRET (2006-2012)',
    'ACT 4: HOW AI PAYS ATTENTION (2017)',
    'ACT 5: WHEN MACHINES LEARNED TO DREAM (2020-2024)',
    'ACT 6: AUTONOMOUS AGENTS (2025-2026)'
  ];
  ctx.fillText(actHeaders[chapterIdx], 48, 38);
  ctx.restore();

  const panelX = 390;
  const panelY = 75;
  const panelW = 830;
  const panelH = 390;

  // ===========================================================
  // ACT 1: THE BEACH, THE LIGHTNING, & ALAN TURING (0s - 103.88s)
  // ===========================================================
  if (chapterIdx === 0) {
    // SCENE 1A (0.0s - 8.1s): The Smartphone & Golden Beach Sand
    if (localT < 8.1) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('LOOK AT YOUR PHONE: IT IS FUNDAMENTALLY BEACH SAND!', panelX + 35, panelY + 45);

      ctx.font = '13.5px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('It feels like magic, but inside, it is just a handful of melted sand.', panelX + 35, panelY + 75);

      // Left: Animated Phone
      const phX = panelX + 60;
      const phY = panelY + 110;
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(phX, phY, 130, 220, 16);
      ctx.fill(); ctx.stroke();

      const glowGrad = ctx.createLinearGradient(phX, phY, phX, phY + 190);
      glowGrad.addColorStop(0, '#1E293B');
      glowGrad.addColorStop(1, '#0284C7');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.roundRect(phX + 8, phY + 10, 114, 195, 10);
      ctx.fill();

      // Sand particles falling
      for (let i = 0; i < 28; i++) {
        const py = phY + 50 + ((localT * 40 + i * 16) % 160);
        const px = phX + 20 + Math.sin(i * 9 + localT * 3) * 35 + 35;
        ctx.fillStyle = i % 2 === 0 ? '#FACC15' : '#FEF08A';
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Right: Quartz Crystal & Sand Dunes
      const duneX = panelX + 240;
      const duneW = 540;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(duneX, panelY + 110, duneW, 220, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 17px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('QUARTZ CRYSTAL LATTICE (SiO2)', duneX + 25, panelY + 145);

      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('[*] Sand is composed of silicon dioxide crystals.', duneX + 25, panelY + 180);
      ctx.fillText('[*] Humans melt the quartz at 1,700C to extract pure Silicon.', duneX + 25, panelY + 210);
      ctx.fillText('[*] A modern phone chip contains over 15 BILLION switches!', duneX + 25, panelY + 240);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('HOW DO MICROSCOPIC SWITCHES BECOME "THOUGHT"?', duneX + 25, panelY + 295);
    }

    // SCENE 1B (8.1s - 20.9s): Melting Silicon & Etching Microscopic Switches
    else if (localT < 20.9) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('MELTING SAND -> CARVING BILLIONS OF MICRO-SWITCHES', panelX + 35, panelY + 45);

      ctx.font = '13.5px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Trapping electricity inside silicon wafers to build logic gates.', panelX + 35, panelY + 75);

      // Rotating Silicon Wafer
      const wafX = panelX + 160;
      const wafY = panelY + 225;
      ctx.save();
      ctx.translate(wafX, wafY);
      ctx.beginPath();
      ctx.arc(0, 0, 95, 0, Math.PI * 2);
      ctx.fillStyle = '#1E293B';
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1;
      for (let g = -80; g <= 80; g += 20) {
        ctx.beginPath(); ctx.moveTo(g, -80); ctx.lineTo(g, 80); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-80, g); ctx.lineTo(80, g); ctx.stroke();
      }

      const laserAngle = localT * 4;
      const lx = Math.cos(laserAngle) * 50;
      const ly = Math.sin(laserAngle) * 50;
      ctx.fillStyle = '#F43F5E';
      ctx.shadowColor = '#F43F5E';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Right: Trapped Electricity Logic
      const infoX = panelX + 320;
      const infoW = 460;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(infoX, panelY + 110, infoW, 230, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('MICROSCOPIC TRANSISTOR SWITCHES', infoX + 25, panelY + 145);

      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(infoX + 25, panelY + 205);
      for (let vx = 0; vx < 400; vx += 20) {
        const pulse = Math.sin(localT * 8 + vx * 0.1) > 0 ? 25 : -25;
        ctx.lineTo(infoX + 25 + vx, panelY + 205 + pulse);
      }
      ctx.stroke();

      ctx.font = '12.5px monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('HIGH VOLTAGE (+5V)  -> CURRENT FLOWS -> DATA STORED', infoX + 25, panelY + 265);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('LOW VOLTAGE (0V)    -> NO CURRENT    -> STATE TRAPPED', infoX + 25, panelY + 295);
    }

    // SCENE 1C (20.9s - 27.5s): Physical Toggle Switches (0 = OFF, 1 = ON)
    else if (localT < 27.5) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('WHEN A SWITCH IS OFF = 0. WHEN IT FLIPS ON = 1.', panelX + 35, panelY + 45);

      ctx.font = '13.5px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Every video, game, and algorithm is just billions of these two states.', panelX + 35, panelY + 75);

      const swW = 170;
      const swH = 210;
      const swData = [
        { label: 'SWITCH #1', state: '0 (OFF)', on: false, x: panelX + 35 },
        { label: 'SWITCH #2', state: '1 (ON)', on: true, x: panelX + 235 },
        { label: 'SWITCH #3', state: Math.sin(localT * 6) > 0 ? '1 (ON)' : '0 (OFF)', on: Math.sin(localT * 6) > 0, x: panelX + 435 },
        { label: 'SWITCH #4', state: '1 (ON)', on: true, x: panelX + 635 }
      ];

      swData.forEach(sw => {
        ctx.fillStyle = sw.on ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.85)';
        ctx.strokeStyle = sw.on ? '#38BDF8' : '#64748B';
        ctx.lineWidth = sw.on ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.roundRect(sw.x, panelY + 105, swW, swH, 12);
        ctx.fill(); ctx.stroke();

        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = sw.on ? '#38BDF8' : '#94A3B8';
        ctx.textAlign = 'center';
        ctx.fillText(sw.label, sw.x + swW / 2, panelY + 135);

        ctx.font = '900 68px system-ui, sans-serif';
        ctx.fillStyle = sw.on ? '#FACC15' : '#475569';
        ctx.fillText(sw.on ? '1' : '0', sw.x + swW / 2, panelY + 225);

        ctx.fillStyle = sw.on ? '#10B981' : '#EF4444';
        ctx.beginPath();
        ctx.roundRect(sw.x + 20, panelY + 250, swW - 40, 32, 6);
        ctx.fill();

        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(sw.state, sw.x + swW / 2, panelY + 272);
      });

      ctx.textAlign = 'center';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('ELECTRICITY FLIPPING AT BILLIONS OF CYCLES PER SECOND', panelX + panelW / 2, panelY + 355);
    }

    // SCENE 1D (27.5s - 34.0s): Lightning Striking Beach Sand
    else if (localT < 34.0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('A BEACH OF SAND WITH LIGHTNING FLIPPING SWITCHES!', panelX + 35, panelY + 45);

      for (let rx = 0; rx < 8; rx++) {
        for (let ry = 0; ry < 3; ry++) {
          const bx = panelX + 45 + rx * 94;
          const by = panelY + 105 + ry * 65;
          const flipped = (int(localT * 8 + rx * 3 + ry * 2) % 2 === 0);

          ctx.fillStyle = flipped ? 'rgba(56, 189, 248, 0.3)' : 'rgba(30, 41, 59, 0.8)';
          ctx.strokeStyle = flipped ? '#38BDF8' : '#475569';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(bx, by, 82, 52, 6);
          ctx.fill(); ctx.stroke();

          ctx.font = 'bold 18px monospace';
          ctx.fillStyle = flipped ? '#FACC15' : '#64748B';
          ctx.textAlign = 'center';
          ctx.fillText(flipped ? '1' : '0', bx + 41, by + 33);
        }
      }

      // Lightning Bolt
      ctx.save();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(panelX + panelW / 2, panelY + 80);
      ctx.lineTo(panelX + panelW / 2 - 30, panelY + 170);
      ctx.lineTo(panelX + panelW / 2 + 20, panelY + 220);
      ctx.lineTo(panelX + panelW / 2 - 10, panelY + 300);
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.font = '900 23px system-ui, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('SO HOW ON EARTH DID WE TEACH SAND TO THINK?', panelX + panelW / 2, panelY + 355);
    }

    // SCENE 1E (34.0s - 49.0s): Alan Turing Archival Portrait & Infinite Paper Tape
    else if (localT < 49.0) {
      drawPortraitCard(
        ctx,
        portraits.turing,
        'ALAN TURING',
        'British Math Genius (Cambridge 1950)',
        '1950',
        panelX, panelY, 240, 275,
        '#38BDF8'
      );

      // Turing Machine Animated Tape
      const tmX = panelX + 260;
      const tmW = panelW - 260;
      const tmH = 275;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(tmX, panelY, tmW, tmH, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'left';
      ctx.fillText('THE TURING MACHINE: INFINITE PAPER TAPE', tmX + 25, panelY + 35);

      ctx.font = '12.5px sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Like an endless comic strip with a mechanical read/write head.', tmX + 25, panelY + 65);

      // Rolling Paper Tape Cells
      const tapeY = panelY + 115;
      const cellW = 56;
      const tapeOffset = (localT * 35) % cellW;
      const symbols = ['1', '0', '1', '1', '0', 'B', '1', '0', '1', '0'];

      for (let c = -1; c < 9; c++) {
        const cx = tmX + 20 + c * cellW - tapeOffset;
        const sym = symbols[(c + 12) % symbols.length];
        const isHead = (c === 4);

        ctx.fillStyle = isHead ? 'rgba(56, 189, 248, 0.3)' : 'rgba(30, 41, 59, 0.8)';
        ctx.strokeStyle = isHead ? '#38BDF8' : '#64748B';
        ctx.lineWidth = isHead ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.rect(cx, tapeY, cellW, 60);
        ctx.fill(); ctx.stroke();

        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = isHead ? '#FACC15' : '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(sym, cx + cellW / 2, tapeY + 38);
      }

      const headX = tmX + 20 + 4 * cellW + cellW / 2;
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(headX, tapeY + 70);
      ctx.lineTo(headX - 10, tapeY + 86);
      ctx.lineTo(headX + 10, tapeY + 86);
      ctx.closePath();
      ctx.fill();

      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('READ/WRITE HEAD', headX, tapeY + 104);

      // Quote Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY + 295, panelW, 90, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'italic 15px system-ui, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('"I propose to consider the question: Can machines think?"', panelX + 25, panelY + 332);

      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('-- Alan Turing, "Computing Machinery and Intelligence" (Mind, 1950)', panelX + 25, panelY + 360);
    }

    // SCENE 1F (49.0s - 89.6s): The 7 Turing Variables Decoded One By One
    else if (localT < 89.6) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 19px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('THE 7 FORMAL RULES OF EVERY COMPUTER IN THE UNIVERSE', panelX + 30, panelY + 35);

      ctx.font = '12.5px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('Mathematical 7-Tuple: M = < Q, Sigma, Gamma, delta, q0, B, F >', panelX + 30, panelY + 58);

      const varList = [
        { chip: 'STATE', sym: 'Q', name: 'Mood / Memory State', desc: 'Is the robot reading, calculating, or sleeping?', tStart: 57.8, tEnd: 60.8 },
        { chip: 'ALPHA', sym: 'Sigma', name: 'Input Alphabet', desc: 'The secret numbers it reads (just 0 and 1)', tStart: 60.8, tEnd: 65.3 },
        { chip: 'TAPE ', sym: 'Gamma', name: 'Tape Alphabet', desc: 'All symbols allowed on the infinite comic strip', tStart: 65.3, tEnd: 69.2 },
        { chip: 'RULES', sym: 'delta', name: 'Recipe Book', desc: 'If you see 1: erase it, write 0, step right!', tStart: 69.2, tEnd: 75.3 },
        { chip: 'START', sym: 'q0', name: 'Start Button', desc: 'The starting position where the robot wakes up', tStart: 75.3, tEnd: 79.3 },
        { chip: 'BLANK', sym: 'B', name: 'Blank Box', desc: 'An empty square on the paper waiting for a new idea', tStart: 79.3, tEnd: 84.6 },
        { chip: 'HALT ', sym: 'F', name: 'Finish Line', desc: 'When the puzzle is solved and robot says: I DID IT!', tStart: 84.6, tEnd: 89.6 }
      ];

      varList.forEach((r, idx) => {
        const isCurrent = (localT >= r.tStart && localT < r.tEnd);
        const rowY = panelY + 75 + idx * 42;

        ctx.fillStyle = isCurrent ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.6)';
        ctx.strokeStyle = isCurrent ? '#FACC15' : 'rgba(100, 116, 139, 0.4)';
        ctx.lineWidth = isCurrent ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(panelX + 25, rowY, panelW - 50, 36, 6);
        ctx.fill(); ctx.stroke();

        // Chip Badge
        ctx.fillStyle = isCurrent ? '#FACC15' : '#38BDF8';
        ctx.beginPath();
        ctx.roundRect(panelX + 35, rowY + 6, 60, 24, 4);
        ctx.fill();

        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.fillText(r.chip, panelX + 65, rowY + 22);

        ctx.textAlign = 'left';
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = isCurrent ? '#FEF08A' : '#FFFFFF';
        ctx.fillText(`${r.sym}: ${r.name}`, panelX + 105, rowY + 23);

        ctx.font = '11.5px sans-serif';
        ctx.fillStyle = isCurrent ? '#FFFFFF' : '#94A3B8';
        ctx.fillText(`-- ${r.desc}`, panelX + 325, rowY + 23);

        if (isCurrent) {
          ctx.fillStyle = '#10B981';
          ctx.beginPath();
          ctx.roundRect(panelX + panelW - 135, rowY + 7, 95, 22, 11);
          ctx.fill();
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.fillText('ACTIVE RULE', panelX + panelW - 87, rowY + 22);
          ctx.textAlign = 'left';
        }
      });
    }

    // SCENE 1G (89.6s - 103.88s): Dartmouth 1956 — John McCarthy & Claude Shannon
    else {
      drawPortraitCard(
        ctx,
        portraits.mccarthy,
        'JOHN McCARTHY',
        'Coined "Artificial Intelligence"',
        '1956',
        panelX, panelY, 240, 275,
        '#38BDF8'
      );

      drawPortraitCard(
        ctx,
        portraits.shannon,
        'CLAUDE SHANNON',
        'Father of Information Theory',
        '1956',
        panelX + 260, panelY, 240, 275,
        '#A855F7'
      );

      const dartX = panelX + 520;
      const dartW = panelW - 520;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(dartX, panelY, dartW, 275, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#10B981';
      ctx.textAlign = 'left';
      ctx.fillText('DARTMOUTH 1956', dartX + 20, panelY + 34);

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '12px sans-serif';
      ctx.fillText('[*] 2-Month, 10-Man Summer Study', dartX + 20, panelY + 70);
      ctx.fillText('[*] First Coined Phrase:', dartX + 20, panelY + 100);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('"ARTIFICIAL INTELLIGENCE"', dartX + 20, panelY + 128);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px sans-serif';
      ctx.fillText('They believed 10 scientists', dartX + 20, panelY + 170);
      ctx.fillText('could solve human thinking in', dartX + 20, panelY + 192);
      ctx.fillText('one single summer vacation!', dartX + 20, panelY + 214);

      // Bottom Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY + 295, panelW, 90, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'italic 15px system-ui, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.textAlign = 'left';
      ctx.fillText('"They were wildly wrong about the timeline. But they lit a fire', panelX + 25, panelY + 332);
      ctx.fillText('that would never go out." -- The Birth of Artificial Intelligence', panelX + 25, panelY + 358);
    }
  }

  // ===========================================================
  // ACT 2: THE ROTTEN MEAT & THE COOKIE PUZZLE (104.68s - 183.04s)
  // ===========================================================
  else if (chapterIdx === 1) {
    // SCENE 2A (0.0s - 7.0s): Clumsy 1960s Computer vs Kitchen Toaster
    if (localT < 7.0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('1960s COMPUTERS HAD LESS MEMORY THAN A KITCHEN TOASTER!', panelX + 35, panelY + 45);

      const c1X = panelX + 45;
      const cW = 350;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(c1X, panelY + 95, cW, 255, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText('1960s MAINFRAME COMPUTER', c1X + cW / 2, panelY + 125);

      // Spinning Tape Reels
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c1X + 110, panelY + 185, 35, 0, Math.PI * 2);
      ctx.arc(c1X + 240, panelY + 185, 35, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('4 KILOBYTES RAM', c1X + cW / 2, panelY + 270);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Filled an entire university room!', c1X + cW / 2, panelY + 300);

      // Right: Modern Smart Toaster with Vector Toast
      const c2X = panelX + 435;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(c2X, panelY + 95, cW, 255, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('MODERN KITCHEN TOASTER', c2X + cW / 2, panelY + 125);

      // Draw Vector Toast!
      drawToast(ctx, c2X + cW / 2, panelY + 185, 52);

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('64 MEGABYTES RAM', c2X + cW / 2, panelY + 270);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('16,000x MORE MEMORY THAN 1960 AI!', c2X + cW / 2, panelY + 300);
    }

    // SCENE 2B (7.0s - 24.0s): The Russian Machine Translation Disaster
    else if (localT < 24.0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('THE RUSSIAN MACHINE TRANSLATION DISASTER', panelX + 35, panelY + 45);

      // Input Card
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX + 45, panelY + 80, panelW - 90, 70, 8);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 12.5px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('ORIGINAL PROVERB (INTENDED MEANING: Body is sleepy):', panelX + 65, panelY + 105);
      ctx.font = 'italic 16px system-ui, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('"The spirit is willing, but the flesh is weak."', panelX + 65, panelY + 132);

      // Translation Machine in Middle
      const tmY = panelY + 165;
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(panelX + panelW / 2 - 160, tmY, 320, 42, 8);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = 'bold 12.5px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('[ GEARS ] CLUNKY TRANSLATOR (WORD-FOR-WORD)', panelX + panelW / 2, tmY + 26);

      // Output Card
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(panelX + 45, panelY + 225, panelW - 90, 85, 8);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 12.5px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('RUSSIAN TRANSLATION OUTPUT (ACTUAL RESULT):', panelX + 65, panelY + 252);
      ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillStyle = '#F87171';
      ctx.fillText('"THE VODKA IS GOOD, BUT THE MEAT IS ROTTEN!"', panelX + 65, panelY + 285);

      ctx.textAlign = 'center';
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('EARLY COMPUTERS HAD ZERO REASONING. WORDS WERE JUST NUMBERS WITHOUT MEANING!', panelX + panelW / 2, panelY + 355);
    }

    // SCENE 2C (24.0s - 37.0s): Marvin Minsky Portrait & Perceptrons Book
    else if (localT < 37.0) {
      drawPortraitCard(
        ctx,
        portraits.minsky,
        'MARVIN MINSKY',
        'MIT AI Laboratory Co-Founder',
        '1969',
        panelX, panelY, 240, 275,
        '#EF4444'
      );

      const bkX = panelX + 260;
      const bkW = panelW - 260;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(bkX, panelY, bkW, 275, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.textAlign = 'left';
      ctx.fillText('1969: "PERCEPTRONS" BY MINSKY & PAPERT', bkX + 25, panelY + 35);

      ctx.font = '12.5px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('[*] Mathematically proved single-layer artificial neurons', bkX + 25, panelY + 70);
      ctx.fillText('    could NOT solve basic non-linear logic (XOR).', bkX + 25, panelY + 92);
      ctx.fillText('[*] If a computer brain cannot solve a simple child\'s cookie puzzle,', bkX + 25, panelY + 125);
      ctx.fillText('    how could it ever achieve human intelligence?', bkX + 25, panelY + 147);

      const ny = panelY + 205;
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bkX + 160, ny, 26, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('SUM > T', bkX + 160, ny + 5);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('FAILED ON XOR!', bkX + 320, ny + 5);

      // Bottom Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY + 295, panelW, 90, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#F87171';
      ctx.fillText('THE MATH PROOF THAT BROKE THE AI WORLD:', panelX + 25, panelY + 332);
      ctx.font = '12.5px monospace';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('A single linear decision boundary cannot separate diagonal points on a plane.', panelX + 25, panelY + 360);
    }

    // SCENE 2D (37.0s - 63.0s): The 4-Cookie XOR Puzzle on Bakery Table
    else if (localT < 63.0) {
      // Living Bakery Wooden Table Stage
      const tableX = panelX + 20, tableY = panelY + 45, tableW = panelW - 40, tableH = 295;
      ctx.save();
      ctx.fillStyle = '#78350F';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(tableX, tableY, tableW, tableH, 14);
      ctx.fill(); ctx.stroke();

      // Table Planks
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.45)';
      ctx.lineWidth = 1.5;
      for (let py = tableY + 50; py < tableY + tableH; py += 55) {
        ctx.beginPath(); ctx.moveTo(tableX + 15, py); ctx.lineTo(tableX + tableW - 15, py); ctx.stroke();
      }

      // Placemat Grid for Cookies
      const gridX = tableX + 35, gridY = tableY + 25, gridW = 390, gridH = tableH - 50;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(gridX, gridY, gridW, gridH, 10);
      ctx.fill(); ctx.stroke();

      // 4 Vector Cookies with Sprinkles & Chocolate Chips
      const c1 = { x: gridX + 90, y: gridY + 60, type: 'plain', label: 'NO', col: '#EF4444' };
      const c2 = { x: gridX + gridW - 90, y: gridY + 60, type: 'both', label: 'NO', col: '#EF4444' };
      const c3 = { x: gridX + 90, y: gridY + gridH - 65, type: 'sprinkles', label: 'YES!', col: '#10B981' };
      const c4 = { x: gridX + gridW - 90, y: gridY + gridH - 65, type: 'choc', label: 'YES!', col: '#10B981' };

      [c1, c2, c3, c4].forEach(c => {
        drawCookie(ctx, c.x, c.y, c.type);
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = c.col;
        ctx.textAlign = 'center';
        ctx.fillText(c.label, c.x, c.y + 36);
      });

      // Animated Failing Wooden Ruler with Measurement Ticks
      const rulerAngle = -Math.PI / 4 + Math.sin(localT * 1.6) * 0.12;
      ctx.save();
      ctx.translate(gridX + gridW / 2, gridY + gridH / 2);
      ctx.rotate(rulerAngle);
      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-165, -11, 330, 22, 4);
      ctx.fill(); ctx.stroke();

      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1.5;
      for (let rx = -155; rx < 155; rx += 14) {
        ctx.beginPath(); ctx.moveTo(rx, -11); ctx.lineTo(rx, rx % 28 === 0 ? 0 : -6); ctx.stroke();
      }
      ctx.restore();

      // Explainer Right Box
      const exX = tableX + 445;
      const exW = tableW - 465;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(exX, gridY, exW, gridH, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = '900 15px system-ui, sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.textAlign = 'left';
      ctx.fillText('PHYSICALLY IMPOSSIBLE!', exX + 18, gridY + 32);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('Can 1 straight ruler slice between', exX + 18, gridY + 65);
      ctx.fillText('the YES cookies and NO cookies?', exX + 18, gridY + 85);

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('NO! Cookies sit diagonal!', exX + 18, gridY + 120);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Every straight line groups', exX + 18, gridY + 150);
      ctx.fillText('one YES cookie with a NO cookie.', exX + 18, gridY + 170);

      ctx.font = 'bold 11.5px monospace';
      ctx.fillStyle = '#F87171';
      ctx.fillText('MINSKY & PAPERT (1969)', exX + 18, gridY + 205);

      ctx.restore();

      // Title Above Table
      ctx.textAlign = 'left';
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('THE 4-COOKIE XOR PUZZLE: WHY 1 STRAIGHT RULER FAILS!', panelX + 30, panelY + 30);

      ctx.textAlign = 'center';
      ctx.font = 'bold 12.5px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('SINGLE-LAYER PERCEPTRONS CANNOT SOLVE NON-LINEAR LOGIC', panelX + panelW / 2, panelY + 372);
    }

    // SCENE 2E (63.0s - 78.36s): Sir James Lighthill & First AI Winter
    else {
      drawPortraitCard(
        ctx,
        portraits.lighthill,
        'SIR JAMES LIGHTHILL',
        'UK Science Research Council (1973)',
        '1973',
        panelX, panelY, 240, 275,
        '#38BDF8'
      );

      const fzX = panelX + 260;
      const fzW = panelW - 260;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(fzX, panelY, fzW, 275, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'left';
      ctx.fillText('1973: THE LIGHTHILL REPORT (AI WINTER FREEZE)', fzX + 25, panelY + 35);

      const thermX = fzX + 35;
      const thermY = panelY + 65;
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(thermX, thermY, 30, 160, 15);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#0284C7';
      ctx.beginPath();
      ctx.roundRect(thermX + 4, thermY + 110, 22, 46, 11);
      ctx.fill();

      ctx.font = 'bold 17px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('-50 C', thermX + 45, thermY + 140);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('FUNDING FROZEN', thermX + 45, thermY + 160);

      ctx.font = '12.5px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('[*] Sir James Lighthill concluded AI had failed its promises.', fzX + 165, panelY + 80);
      ctx.fillText('[*] UK and US governments cancelled almost all AI funding.', fzX + 165, panelY + 115);
      ctx.fillText('[*] Universities shut down neural network laboratories.', fzX + 165, panelY + 150);

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('FUNDING CUT: 100% -> 15%', fzX + 165, panelY + 200);

      for (let s = 0; s < 24; s++) {
        const sx = fzX + (s * 41 + localT * 20) % (fzW - 20);
        const sy = panelY + (s * 33 + localT * 35) % (275 - 20);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY + 295, panelW, 90, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'italic 15px system-ui, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('"Governments pulled funding, research halted, and the world entered', panelX + 25, panelY + 332);
      ctx.fillText('the brutal First AI Winter (1974-1980)."', panelX + 25, panelY + 358);
    }
  }

  // ===========================================================
  // ACT 3: THE VIDEO GAME SECRET (183.84s - 256.84s)
  // ===========================================================
  else if (chapterIdx === 2) {
    // SCENE 3A (0.0s - 17.5s): Geoffrey Hinton's Unshakable Faith
    if (localT < 17.5) {
      drawPortraitCard(
        ctx,
        portraits.hinton,
        'GEOFFREY HINTON',
        'Godfather of Deep Learning (Toronto)',
        '2006',
        panelX, panelY, 240, 275,
        '#FACC15'
      );

      const hnX = panelX + 260;
      const hnW = panelW - 260;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(hnX, panelY, hnW, 275, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'left';
      ctx.fillText('HINTON REFUSED TO QUIT THE NEURAL NETWORK DREAM', hnX + 25, panelY + 35);

      ctx.font = '12.5px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('[*] While the entire academic world gave up, Hinton persisted.', hnX + 25, panelY + 70);
      ctx.fillText('[*] He realized neural networks were not broken at all!', hnX + 25, panelY + 95);
      ctx.fillText('[*] They just needed two missing ingredients:', hnX + 25, panelY + 125);

      ctx.font = 'bold 13.5px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('1. MILLIONS OF REAL-WORLD PHOTOS (Data)', hnX + 40, panelY + 160);
      ctx.fillStyle = '#10B981';
      ctx.fillText('2. CHIPS THAT DO THOUSANDS OF CALCULATIONS AT ONCE', hnX + 40, panelY + 190);

      ctx.font = '12.5px sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('And then came the accidental discovery: VIDEO GAMES!', hnX + 25, panelY + 235);

      // Bottom Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY + 295, panelW, 90, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'italic 15px system-ui, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('"The brain has billions of neurons firing at the exact same moment.', panelX + 25, panelY + 332);
      ctx.fillText('Why were we forcing computers to think one thought at a time?"', panelX + 25, panelY + 358);
    }

    // SCENE 3B (17.5s - 28.5s): Video Games Coloring 2 Million Pixels
    else if (localT < 28.5) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('THE VIDEO GAME SECRET: 2 MILLION PIXELS AT 60 FPS!', panelX + 35, panelY + 45);

      const vgX = panelX + 45;
      const vgW = 420;
      const vgH = 260;

      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(vgX, panelY + 80, vgW, vgH, 10);
      ctx.fill(); ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      for (let w = 0; w < vgW; w += 25) {
        ctx.beginPath();
        ctx.moveTo(vgX + w, panelY + 80 + vgH);
        ctx.lineTo(vgX + vgW / 2 + (w - vgW / 2) * 0.2, panelY + 120);
        ctx.stroke();
      }

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'center';
      ctx.fillText('3D GRAPHICS PIPELINE: 60 FRAMES/SEC', vgX + vgW / 2, panelY + 110);

      // Right: GPU Pixel Math Readout
      const rdX = panelX + 490;
      const rdW = panelW - 520;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(rdX, panelY + 80, rdW, vgH, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#10B981';
      ctx.textAlign = 'left';
      ctx.fillText('PARALLEL PIXEL MATH', rdX + 20, panelY + 115);

      ctx.font = '12.5px monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('1080p Resolution:', rdX + 20, panelY + 150);
      ctx.fillStyle = '#FACC15';
      ctx.fillText('1920 x 1080 = 2,073,600 Pixels', rdX + 20, panelY + 175);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('Every pixel requires matrix math', rdX + 20, panelY + 215);
      ctx.fillText('to calculate lighting and reflections.', rdX + 20, panelY + 235);
      ctx.fillText('Gaming GPUs were born for this!', rdX + 20, panelY + 255);
    }

    // SCENE 3C (28.5s - 50.5s): 1 Professor (CPU) vs 1,000 Painters (GPU)
    else if (localT < 50.5) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('1 CPU PROFESSOR  VS  1,000 GPU PAINTERS', panelX + 35, panelY + 38);

      // Left: Professor at Blackboard
      drawProfessorBoard(ctx, panelX + 30, panelY + 58, localT);

      // Right: 1,000 GPU Painters in Parallel
      drawMiniPainters(ctx, panelX + 425, panelY + 58, panelW - 455, 240, localT);

      ctx.textAlign = 'center';
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('COLORING VIDEO GAME PIXELS IS THE EXACT SAME MATH AS BRAIN CELLS!', panelX + panelW / 2, panelY + 360);
    }

    // SCENE 3D (50.5s - 73.0s): AlexNet 2012 — Ilya Sutskever & Hinton
    else {
      drawPortraitCard(
        ctx,
        portraits.sutskever,
        'ILYA SUTSKEVER',
        'AlexNet Co-Creator (Toronto 2012)',
        '2012',
        panelX, panelY, 240, 275,
        '#10B981'
      );

      const alX = panelX + 260;
      const alW = panelW - 260;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(alX, panelY, alW, 275, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#10B981';
      ctx.textAlign = 'left';
      ctx.fillText('OCTOBER 2012: ALEXNET SHOCKS THE WORLD', alX + 25, panelY + 35);

      ctx.font = '12.5px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('[*] Alex Krizhevsky, Ilya Sutskever, and Geoffrey Hinton', alX + 25, panelY + 65);
      ctx.fillText('    trained an 8-layer deep convolutional neural network', alX + 25, panelY + 87);
      ctx.fillText('    on two standard gaming graphics cards (NVIDIA GTX 580).', alX + 25, panelY + 109);

      const scY = panelY + 145;
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(alX + 25, scY, alW - 50, 90, 8);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 12.5px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('IMAGENET CONTEST ERROR RATE (1 MILLION PHOTOS):', alX + 45, scY + 28);

      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('Standard AI: 26.2%', alX + 45, scY + 68);

      ctx.fillStyle = '#10B981';
      ctx.fillText('-> AlexNet: 15.3%', alX + 280, scY + 68);
      drawStar(ctx, alX + 460, scY + 62, 12, '#FACC15');

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY + 295, panelW, 90, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('THE MODERN DEEP LEARNING REVOLUTION WAS OFFICIALLY BORN!', panelX + 25, panelY + 332);
      ctx.font = '12.5px monospace';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('A massive 10.9% error drop that overnight redirected all computer science.', panelX + 25, panelY + 358);
    }
  }

  // ===========================================================
  // ACT 4: HOW AI PAYS ATTENTION (257.64s - 322.12s)
  // ===========================================================
  else if (chapterIdx === 3) {
    // SCENE 4A (0.0s - 11.0s): The Anxious Robot That Forgot Long Sentences
    if (localT < 11.0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('COMPUTERS READ WORD... BY... WORD... AND FORGOT!', panelX + 35, panelY + 45);

      const beltY = panelY + 115;
      const words = ['Once', 'upon', 'a', 'time', 'in', 'a', 'faraway', 'land...', 'LOST!'];

      words.forEach((w, idx) => {
        const wx = panelX + 45 + idx * 82;
        const isForgotten = (idx < 4 || idx === 8);

        ctx.fillStyle = isForgotten ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.25)';
        ctx.strokeStyle = isForgotten ? '#EF4444' : '#38BDF8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(wx, beltY, 74, 60, 6);
        ctx.fill(); ctx.stroke();

        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = isForgotten ? '#EF4444' : '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(w, wx + 37, beltY + 35);
      });

      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX + 45, panelY + 225, panelW - 90, 110, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('THE RECURRENT BOTTLENECK (RNN / LSTM)', panelX + panelW / 2, panelY + 260);

      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('By the time an old neural network reached the 50th word of a paragraph,', panelX + panelW / 2, panelY + 290);
      ctx.fillText('it had already forgotten the subject from the very first sentence!', panelX + panelW / 2, panelY + 312);
    }

    // SCENE 4B (11.0s - 20.0s): 2017 "Attention Is All You Need" Paper
    else if (localT < 20.0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('2017: "ATTENTION IS ALL YOU NEED" -- THE TRANSFORMER', panelX + 35, panelY + 45);

      const pX = panelX + 45;
      const pY = panelY + 80;
      const pW = panelW - 90;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(pX, pY, pW, 255, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 17px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('NEURIPS 2017 // GOOGLE BRAIN & GOOGLE RESEARCH', pX + 25, pY + 38);

      ctx.font = 'italic 14.5px system-ui, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit,', pX + 25, pY + 75);
      ctx.fillText('Llion Jones, Aidan N. Gomez, Lukasz Kaiser, Illia Polosukhin', pX + 25, pY + 100);

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('THE CORE BREAKTHROUGH:', pX + 25, pY + 145);

      ctx.font = '13.5px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('Instead of reading word-by-word sequentially, look at EVERY word', pX + 25, pY + 175);
      ctx.fillText('in an entire document simultaneously, connecting them with Attention!', pX + 25, pY + 200);
    }

    // SCENE 4C (20.0s - 45.0s): The Tired Robot Sentence (Who Was Tired?)
    else if (localT < 45.0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('WHO WAS TIRED? THE STREET? OR THE ROBOT?', panelX + 35, panelY + 38);

      const sentence = ['The', 'robot', "didn't", 'cross', 'the', 'street', 'because', 'IT', 'was', 'too', 'tired.'];
      const startX = panelX + 35;
      const wordY = panelY + 60;

      sentence.forEach((w, idx) => {
        const wx = startX + idx * 70;
        const isIt = (w === 'IT');
        const isRobot = (w === 'robot');
        const isStreet = (w === 'street');

        ctx.fillStyle = isIt ? 'rgba(250, 204, 21, 0.35)' : isRobot ? 'rgba(56, 189, 248, 0.35)' : isStreet ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 41, 59, 0.8)';
        ctx.strokeStyle = isIt ? '#FACC15' : isRobot ? '#38BDF8' : isStreet ? '#EF4444' : '#64748B';
        ctx.lineWidth = (isIt || isRobot) ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.roundRect(wx, wordY, 65, 44, 6);
        ctx.fill(); ctx.stroke();

        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = isIt ? '#FACC15' : isRobot ? '#38BDF8' : '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(w, wx + 32, wordY + 27);
      });

      // Left Explanation Box
      const leftW = 460;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX + 35, panelY + 120, leftW, 235, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('10-YEAR-OLD HUMAN INTUITION:', panelX + 55, panelY + 155);

      ctx.font = '13.5px sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('A child instantly knows: THE ROBOT was tired!', panelX + 55, panelY + 190);

      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('Streets are made of asphalt; they do not get tired.', panelX + 55, panelY + 220);
      ctx.fillText('Robots walk, exhaust batteries, and sit on curbs.', panelX + 55, panelY + 245);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX + 55, panelY + 270, leftW - 40, 65, 8);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('THE WINOGRAD SCHEMA MYSTERY:', panelX + 70, panelY + 295);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('How does a computer mathematically know who "IT" is?', panelX + 70, panelY + 318);

      // Right Living Scene: Slumped Robot on Curb
      drawTiredRobot(ctx, panelX + 655, panelY + 280, localT);

      ctx.textAlign = 'center';
      ctx.font = 'bold 12.5px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('OLD NLP FAILED HERE: COMPUTERS HAD NO COMMON SENSE CONTEXT', panelX + panelW / 2, panelY + 375);
    }

    // SCENE 4D (45.0s - 64.48s): The Attention Laser Beam (IT -> ROBOT)
    else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.fillStyle = '#10B981';
      ctx.fillText('THE ATTENTION LASER BEAM (ATTENTION SCORE: 0.94)', panelX + 35, panelY + 38);

      const sentence = ['The', 'robot', "didn't", 'cross', 'the', 'street', 'because', 'IT', 'was', 'too', 'tired.'];
      const startX = panelX + 35;
      const wordY = panelY + 60;

      let robotCenterX = 0;
      let itCenterX = 0;

      sentence.forEach((w, idx) => {
        const wx = startX + idx * 70;
        const isIt = (w === 'IT');
        const isRobot = (w === 'robot');

        if (isRobot) robotCenterX = wx + 32;
        if (isIt) itCenterX = wx + 32;

        ctx.fillStyle = isIt ? 'rgba(250, 204, 21, 0.45)' : isRobot ? 'rgba(16, 185, 129, 0.45)' : 'rgba(30, 41, 59, 0.8)';
        ctx.strokeStyle = isIt ? '#FACC15' : isRobot ? '#10B981' : '#64748B';
        ctx.lineWidth = (isIt || isRobot) ? 3 : 1.5;
        ctx.beginPath();
        ctx.roundRect(wx, wordY, 65, 44, 6);
        ctx.fill(); ctx.stroke();

        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = isIt ? '#FACC15' : isRobot ? '#10B981' : '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(w, wx + 32, wordY + 27);
      });

      // BLAZING LASER BEAM (IT -> ROBOT)
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.moveTo(itCenterX, wordY + 44);
      ctx.bezierCurveTo(itCenterX - 50, wordY + 110, robotCenterX + 50, wordY + 110, robotCenterX, wordY + 44);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Attention Badge
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.roundRect((itCenterX + robotCenterX) / 2 - 75, wordY + 75, 150, 26, 13);
      ctx.fill();

      ctx.font = '900 12px monospace';
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.fillText('ATTENTION: 0.94', (itCenterX + robotCenterX) / 2, wordY + 93);

      // Left Explanation Card
      const leftW = 460;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX + 35, panelY + 120, leftW, 235, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('MATHEMATICAL ATTENTION AT SCALE:', panelX + 55, panelY + 155);

      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('[*] The word "IT" compares itself with EVERY word at once.', panelX + 55, panelY + 190);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('[*] Dot-product math scores "robot" = 0.94, "street" = 0.02.', panelX + 55, panelY + 220);
      ctx.fillText('[*] The network learns real-world meaning without hand-coded rules!', panelX + 55, panelY + 248);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX + 55, panelY + 275, leftW - 40, 65, 8);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 12.5px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('SCALED TO BILLIONS OF PARAMETERS:', panelX + 70, panelY + 300);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('This single equation powers ChatGPT, Gemini, and Claude!', panelX + 70, panelY + 322);

      // Right Living Scene: Slumped Robot with Attention Ray
      drawTiredRobot(ctx, panelX + 655, panelY + 280, localT);

      // Attention ray shining down on robot
      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(itCenterX, wordY + 44);
      ctx.lineTo(panelX + 655, panelY + 200);
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.font = 'bold 12.5px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('WORDS NO LONGER ISOLATED: CONNECTED BY FULL MULTI-HEAD ATTENTION', panelX + panelW / 2, panelY + 375);
    }
  }

  // ===========================================================
  // ACT 5: WHEN MACHINES LEARNED TO DREAM (2020–2024)
  // ===========================================================
  else if (chapterIdx === 4) {
    // SCENE 5A (0.0s - 11.5s): From Tagging Photos to Dreaming
    if (localT < 11.5) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#A855F7';
      ctx.fillText('FOR 70 YEARS AI ONLY ANALYZED. THEN COMPUTERS LEARNED TO DREAM!', panelX + 35, panelY + 45);

      const a1X = panelX + 45;
      const bW = 350;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(a1X, panelY + 85, bW, 255, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText('OLD AI (1950-2019)', a1X + bW / 2, panelY + 120);

      // Vector Tag Icon
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.roundRect(a1X + bW / 2 - 35, panelY + 155, 70, 35, 6);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('[TAG]', a1X + bW / 2, panelY + 178);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('"This is a cat." "This is a dog."', a1X + bW / 2, panelY + 235);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Passive classification only.', a1X + bW / 2, panelY + 265);

      // Right Box: Generative Diffusion with Vector Palette
      const a2X = panelX + 435;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(a2X, panelY + 85, bW, 255, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#A855F7';
      ctx.fillText('GENERATIVE DIFFUSION (2020+)', a2X + bW / 2, panelY + 120);

      drawPalette(ctx, a2X + bW / 2, panelY + 175, 26);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('CREATE NEW IMAGES FROM NOISE!', a2X + bW / 2, panelY + 235);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('Imagining never-before-seen worlds.', a2X + bW / 2, panelY + 265);
    }

    // SCENE 5B (11.5s - 31.0s): Denoising Television Snow Step by Step
    else if (localT < 31.0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.fillStyle = '#A855F7';
      ctx.fillText('REVERSE DIFFUSION: WIPING AWAY TELEVISION SNOW', panelX + 35, panelY + 35);

      // Living Retro CRT TV on Left
      drawRetroTV(ctx, panelX + 35, panelY + 72, 470, 250, localT);

      // Right Side Schedule Cards
      const cardX = panelX + 525;
      const cardW = panelW - 555;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(cardX, panelY + 72, cardW, 250, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#A855F7';
      ctx.fillText('THE 1,000-STEP DENOISING LOOP', cardX + 20, panelY + 100);

      const dSteps = [
        { label: 'Step 1000: Pure Random Noise', sub: 'Gaussian static snow', col: '#94A3B8' },
        { label: 'Step 750: Faint Shapes', sub: 'Sun & mountain silhouette', col: '#38BDF8' },
        { label: 'Step 250: Color & Outlines', sub: 'Warm sunset gradients', col: '#FACC15' },
        { label: 'Step 0: Masterpiece!', sub: 'Crisp 4K golden landscape', col: '#10B981' }
      ];

      dSteps.forEach((st, idx) => {
        const sy = panelY + 118 + idx * 34;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = st.col;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(cardX + 15, sy, cardW - 30, 28, 6);
        ctx.fill(); ctx.stroke();

        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = st.col;
        ctx.textAlign = 'left';
        ctx.fillText(st.label, cardX + 25, sy + 18);
      });

      ctx.font = 'italic 11px system-ui, sans-serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('The neural net was trained on millions of images.', cardX + 20, panelY + 285);
      ctx.fillText('It knows what real light and shapes look like!', cardX + 20, panelY + 302);

      ctx.textAlign = 'center';
      ctx.font = 'bold 12.5px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('AT EVERY STEP, THE NEURAL NET PREDICTS AND SUBTRACTS NOISE TO REVEAL THE IMAGE!', panelX + panelW / 2, panelY + 365);
    }

    // SCENE 5C (31.0s - 45.48s): Video Generation & Physics Simulation (Sora 2024)
    else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('2024: DIFFUSION + TRANSFORMERS = GENERATIVE VIDEO', panelX + 35, panelY + 45);

      const vidX = panelX + 45;
      const vidY = panelY + 80;
      const vidW = panelW - 90;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(vidX, vidY, vidW, 260, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('SPACETIME PATCH DIFFUSION (SORA & VIDEO GENERATORS)', vidX + 30, vidY + 45);

      ctx.font = '13.5px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('[*] Video is treated as a 3D block of space and time.', vidX + 30, vidY + 85);
      ctx.fillText('[*] Simulating physical gravity, light reflections, and water ripples.', vidX + 30, vidY + 120);
      ctx.fillText('[*] Neural networks are no longer just recognizing objects...', vidX + 30, vidY + 155);

      ctx.font = '900 18px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('THEY ARE BUILDING COMPLETE SIMULATED WORLDS IN SILICON!', vidX + 30, vidY + 215);
    }
  }

  // ===========================================================
  // ACT 6: AUTONOMOUS AGENTS (369.20s - 427.92s)
  // ===========================================================
  else {
    // SCENE 6A (0.0s - 14.0s): Chatbots vs Autonomous Agents
    if (localT < 14.0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#10B981';
      ctx.fillText('BEYOND CHATBOTS: FROM TEXT WORDS TO REAL ACTION', panelX + 35, panelY + 45);

      const cbX = panelX + 45;
      const bW = 350;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cbX, panelY + 85, bW, 255, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText('PASSIVE CHATBOT (2023)', cbX + bW / 2, panelY + 120);

      // Chat Bubble Vector
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(cbX + bW / 2 - 40, panelY + 150, 80, 45, 10);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('[TEXT]', cbX + bW / 2, panelY + 178);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('Answers Questions with Text', cbX + bW / 2, panelY + 235);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Waits for you to copy-paste.', cbX + bW / 2, panelY + 265);

      // Right Box: Autonomous Agent with Terminal Vector
      const agX = panelX + 435;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(agX, panelY + 85, bW, 255, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('AUTONOMOUS AGENT (2026)', agX + bW / 2, panelY + 120);

      drawTerminal(ctx, agX + bW / 2, panelY + 170, 38);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('TAKES ACTION IN REAL TIME!', agX + bW / 2, panelY + 235);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('Runs terminals, edits code & draws video.', agX + bW / 2, panelY + 265);
    }

    // SCENE 6B (14.0s - 38.0s): The 3-Step Agentic Feedback Loop with Vector Icons
    else if (localT < 38.0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('THE 3-STEP AGENTIC FEEDBACK LOOP (SELF-CORRECTION)', panelX + 35, panelY + 45);

      const stW = 230;
      const steps = [
        { num: 'STEP 1', title: 'PLAN', desc: 'Breaks goal into logical tasks', drawIcon: drawClipboard, x: panelX + 40, color: '#38BDF8' },
        { num: 'STEP 2', title: 'EXECUTE TOOLS', desc: 'Runs terminal, edits code & renders', drawIcon: drawTerminal, x: panelX + 300, color: '#FACC15' },
        { num: 'STEP 3', title: 'SELF-CORRECT', desc: 'Reads errors & patches itself!', drawIcon: drawWrench, x: panelX + 560, color: '#10B981' }
      ];

      steps.forEach(st => {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.strokeStyle = st.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(st.x, panelY + 80, stW, 200, 10);
        ctx.fill(); ctx.stroke();

        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = st.color;
        ctx.textAlign = 'center';
        ctx.fillText(st.num, st.x + stW / 2, panelY + 110);

        st.drawIcon(ctx, st.x + stW / 2, panelY + 155, 34);

        ctx.font = 'bold 15px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(st.title, st.x + stW / 2, panelY + 215);

        ctx.font = '11.5px sans-serif';
        ctx.fillStyle = '#CBD5E1';
        ctx.fillText(st.desc, st.x + stW / 2, panelY + 245);
      });

      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX + 40, panelY + 300, panelW - 80, 65, 8);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('IF AN AGENT MAKES A MISTAKE: IT READS THE LOG, DEBUGS, AND TRIES AGAIN!', panelX + panelW / 2, panelY + 338);
    }

    // SCENE 6C (38.0s - 58.72s): Grand Finale — The Fire of Intelligence
    else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '900 24px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('THE FIRE OF INTELLIGENCE: 1950 -> 2026', panelX + panelW / 2, panelY + 48);

      const tbY = panelY + 120;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(panelX + 45, tbY); ctx.lineTo(panelX + panelW - 45, tbY);
      ctx.stroke();

      const epochs = [
        { year: '1950', name: 'Turing Tape', x: panelX + 75 },
        { year: '1956', name: 'Dartmouth', x: panelX + 215 },
        { year: '1969', name: 'XOR Freeze', x: panelX + 355 },
        { year: '2012', name: 'AlexNet GPU', x: panelX + 495 },
        { year: '2017', name: 'Attention', x: panelX + 635 },
        { year: '2026', name: 'Agents', x: panelX + 765 }
      ];

      epochs.forEach(ep => {
        drawStar(ctx, ep.x, tbY, 9, '#FACC15');

        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(ep.year, ep.x, tbY - 18);

        ctx.font = '11.5px sans-serif';
        ctx.fillStyle = '#38BDF8';
        ctx.fillText(ep.name, ep.x, tbY + 24);
      });

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(panelX + 45, panelY + 185, panelW - 90, 160, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'italic 16px system-ui, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('"The story of AI has never been about replacing humanity.', panelX + panelW / 2, panelY + 230);
      ctx.fillText('It has always been our grandest scientific quest:', panelX + panelW / 2, panelY + 262);

      ctx.font = '900 17px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('USING SAND AND LIGHTNING TO UNDERSTAND OUR OWN MINDS."', panelX + panelW / 2, panelY + 304);
    }
  }
}

// -------------------------------------------------------------
// SUBTITLE RENDERER (MULTI-LINE WORD-WRAPPING, ZERO OVERFLOW)
// -------------------------------------------------------------
function drawCaptions(ctx, t) {
  let activeCue = null;
  for (const c of captions) {
    if (t >= c.start && t < c.end) {
      activeCue = c;
      break;
    }
  }
  if (!activeCue) return;

  ctx.save();
  ctx.font = '900 19px system-ui, -apple-system, sans-serif';

  const text = activeCue.text;
  const maxLineWidth = WIDTH - 200; // 1080px max line width

  // Multi-line word-wrapping
  const rawWords = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const w of rawWords) {
    const testLine = currentLine ? `${currentLine} ${w}` : w;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxLineWidth && currentLine) {
      lines.push(currentLine);
      currentLine = w;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  let maxW = 0;
  for (const line of lines) {
    maxW = Math.max(maxW, ctx.measureText(line).width);
  }

  const lineHeight = 26;
  const padX = 24;
  const padY = 10;
  const bgW = Math.min(WIDTH - 120, maxW + padX * 2);
  const bgH = lines.length * lineHeight + padY * 2;
  const bgX = (WIDTH - bgW) / 2;
  const bgY = HEIGHT - 35 - bgH;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(bgX, bgY, bgW, bgH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FEF08A';
  for (let i = 0; i < lines.length; i++) {
    const ly = bgY + padY + i * lineHeight + 18;
    ctx.fillText(lines[i], WIDTH / 2, ly);
  }
  ctx.restore();
}

// -------------------------------------------------------------
// MASTER ANIMATION & RENDER PIPELINE
// -------------------------------------------------------------
async function renderFeynmanEpisode() {
  console.log('======================================================');
  console.log('Rendering 10-Year-Old Feynman Master Episode: Zero-Glitch Edition');
  console.log(`Total Duration: ${DURATION}s (${TOTAL_FRAMES} frames @ ${FPS}fps)`);
  console.log(`Target: ${FINAL_OUTPUT}`);
  console.log('======================================================\n');

  console.log('Loading verified historical portraits...');
  const portraits = {
    turing: await loadImage(path.join(PORTRAITS_DIR, 'turing.jpg')),
    mccarthy: await loadImage(path.join(PORTRAITS_DIR, 'mccarthy.jpg')),
    shannon: await loadImage(path.join(PORTRAITS_DIR, 'shannon.jpg')),
    minsky: await loadImage(path.join(PORTRAITS_DIR, 'minsky.jpg')),
    lighthill: await loadImage(path.join(PORTRAITS_DIR, 'lighthill.jpg')),
    hinton: await loadImage(path.join(PORTRAITS_DIR, 'hinton.jpg')),
    sutskever: await loadImage(path.join(PORTRAITS_DIR, 'sutskever.jpg'))
  };
  console.log('✓ All 7 historical portraits loaded into memory!\n');

  const ffmpeg = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${WIDTH}x${HEIGHT}`,
    '-framerate', String(FPS),
    '-i', 'pipe:0',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '17',
    '-pix_fmt', 'yuv420p',
    TEMP_VIDEO
  ]);

  ffmpeg.stdin.on('error', () => {});
  let ffmpegErr = '';
  ffmpeg.stderr.on('data', d => { ffmpegErr += d.toString(); });

  const completion = new Promise((resolve, reject) => {
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`Encode failed (code ${code}): ${ffmpegErr}`)));
  });

  const actStarts = [0.0, 104.68, 183.84, 257.64, 322.92, 369.20];
  let lastLoggedMin = -1;

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    const curMin = Math.floor(t / 60);
    if (curMin !== lastLoggedMin) {
      lastLoggedMin = curMin;
      console.log(`  Rendering minute ${curMin + 1} of 8 (${int(t)}s / ${Math.floor(DURATION)}s)...`);
    }

    let actIdx = 5;
    for (let c = 0; c < actStarts.length - 1; c++) {
      if (t >= actStarts[c] && t < actStarts[c + 1]) {
        actIdx = c;
        break;
      }
    }
    const localT = t - actStarts[actIdx];

    // Background
    const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 40, WIDTH / 2, HEIGHT / 2, 900);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#05070c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Floor Cyber Grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 580);
      ctx.lineTo(x + (x - WIDTH / 2) * 0.4, HEIGHT);
      ctx.stroke();
    }
    for (let y = 580; y <= HEIGHT; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    // Top-Right Series Watermark (NO OVERLAP WITH ACT TITLE)
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = '900 12px monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText('PROGRAMS MAGIC // THE HISTORY OF AI', WIDTH - 48, 38);
    ctx.restore();

    // Draw Feynman Visualizer
    drawChapter(ctx, t, actIdx, localT, portraits);

    // Magi Movement Choreography (Micro-synced to narration & living scenes)
    let magiX = 180;
    let magiFacing = 1;
    let isWalking = false;
    let armAction = 'idle';

    if (actIdx === 0) {
      if (localT < 8.1) {
        magiX = 165;
        armAction = 'inspect_phone';
      } else if (localT < 20.9) {
        if (localT < 11.5) {
          magiX = 165 + (localT - 8.1) * 12;
          isWalking = true;
        } else {
          magiX = 205;
          armAction = 'magic_wand';
        }
      } else if (localT < 27.5) {
        if (localT < 23.0) {
          magiX = 205 - (localT - 20.9) * 20;
          magiFacing = -1;
          isWalking = true;
        } else {
          magiX = 160;
          magiFacing = 1;
          armAction = 'point_right';
        }
      } else if (localT < 34.0) {
        magiX = 140;
        armAction = 'baffled';
      } else if (localT < 49.0) {
        if (localT < 38.0) {
          magiX = 140 + (localT - 34.0) * 16;
          isWalking = true;
        } else {
          magiX = 204;
          armAction = 'point_right';
        }
      } else if (localT < 89.6) {
        magiX = 180;
        armAction = 'point_up';
      } else {
        if (localT < 93.0) {
          magiX = 180 + (localT - 89.6) * 6;
          isWalking = true;
        } else {
          magiX = 200;
          armAction = 'thumbs_up';
        }
      }
    } else if (actIdx === 1) {
      if (localT < 7.0) {
        magiX = 180;
        armAction = 'point_right';
      } else if (localT < 24.0) {
        if (localT < 10.5) {
          magiX = 180 + (localT - 7.0) * 8;
          isWalking = true;
        } else {
          magiX = 208;
          armAction = 'arms_crossed';
        }
      } else if (localT < 37.0) {
        magiX = 160;
        armAction = 'baffled';
      } else if (localT < 63.0) {
        // Living 4-Cookie XOR Table inspection
        const wander = Math.sin(localT * 0.9) * 22;
        magiX = 175 + wander;
        if (Math.abs(Math.cos(localT * 0.9)) > 0.4) isWalking = true;
        armAction = 'point_right';
      } else {
        magiX = 155;
        armAction = 'shiver';
      }
    } else if (actIdx === 2) {
      if (localT < 17.5) {
        magiX = 180;
        armAction = 'magic_wand';
      } else if (localT < 38.0) {
        // 1 CPU Professor vs 1,000 GPU Painters locomotion
        const wander = Math.sin(localT * 0.8) * 25;
        magiX = 175 + wander;
        if (Math.abs(Math.cos(localT * 0.8)) > 0.4) isWalking = true;
        armAction = 'point_right';
      } else if (localT < 52.0) {
        magiX = 195;
        armAction = 'thumbs_up';
      } else {
        magiX = 180;
        armAction = 'magic_wand';
      }
    } else if (actIdx === 3) {
      if (localT < 11.0) {
        magiX = 160;
        armAction = 'baffled';
      } else if (localT < 20.0) {
        magiX = 180;
        armAction = 'arms_crossed';
      } else if (localT < 45.0) {
        // Walking up to inspect the tired robot on the curb
        if (localT < 24.5) {
          magiX = 150 + (localT - 20.0) * 14;
          isWalking = true;
        } else {
          magiX = 213;
          armAction = 'point_right';
        }
      } else {
        magiX = 180;
        armAction = 'point_up';
      }
    } else if (actIdx === 4) {
      if (localT < 11.5) {
        magiX = 175;
        armAction = 'arms_crossed';
      } else if (localT < 31.0) {
        // Walking up to turn the Retro CRT TV dial
        if (localT < 15.0) {
          magiX = 155 + (localT - 11.5) * 16;
          isWalking = true;
        } else {
          magiX = 211;
          armAction = 'magic_wand';
        }
      } else {
        magiX = 185;
        armAction = 'thumbs_up';
      }
    } else {
      if (localT < 14.0) {
        magiX = 175;
        armAction = 'arms_crossed';
      } else if (localT < 38.0) {
        // Monitoring Autonomous Agent Loop
        const wander = Math.sin(localT * 0.7) * 22;
        magiX = 175 + wander;
        if (Math.abs(Math.cos(localT * 0.7)) > 0.35) isWalking = true;
        armAction = 'point_right';
      } else {
        magiX = 185;
        armAction = 'magic_wand';
      }
    }

    drawMagi(ctx, magiX, 580, {
      facing: magiFacing,
      isWalking,
      armAction,
      t
    });

    drawCaptions(ctx, t);

    const buffer = canvas.data();
    if (!ffmpeg.stdin.write(buffer)) {
      await Promise.race([
        once(ffmpeg.stdin, 'drain'),
        completion.then(() => { throw new Error('Encoder closed early'); })
      ]);
    }
  }

  ffmpeg.stdin.end();
  await completion;

  console.log('\nMuxing video with 24kHz Bodi master narration audio...');
  const finalMux = spawn('ffmpeg', [
    '-v', 'error',
    '-y',
    '-i', TEMP_VIDEO,
    '-i', AUDIO_MASTER,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    FINAL_OUTPUT
  ]);

  await new Promise((res, rej) => {
    finalMux.on('close', code => code === 0 ? res() : rej(new Error('Final mux failed')));
  });

  console.log(`\n🎉 Full Feynman Episode Master Render Complete!`);
  console.log(`Master Video: ${FINAL_OUTPUT}`);
}

renderFeynmanEpisode().catch(err => {
  console.error(err);
  process.exit(1);
});
