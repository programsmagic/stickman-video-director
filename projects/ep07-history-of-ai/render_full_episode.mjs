import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createCanvas, loadImage } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 24;
const DURATION = 314.80;
const TOTAL_FRAMES = Math.ceil(FPS * DURATION);

const PROJECT_DIR = path.resolve('projects/ep07-history-of-ai');
const PORTRAITS_DIR = path.join(PROJECT_DIR, 'assets/portraits');
const AUDIO_MASTER = path.join(PROJECT_DIR, 'build/narration.wav');
const CAPTIONS_FILE = path.join(PROJECT_DIR, 'build/captions.json');
const TEMP_VIDEO = '/tmp/ep07_temp_video.mp4';
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
// HISTORICAL PORTRAIT CARD HELPER
// -------------------------------------------------------------
function drawPortraitCard(ctx, img, name, role, year, x, y, w, h, borderColor = '#38BDF8') {
  ctx.save();
  // Card base
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();

  // Year Badge in top-right
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

  // Portrait circular or rounded-rect frame
  const imgSize = Math.min(w - 30, h - 90);
  const imgX = x + (w - imgSize) / 2;
  const imgY = y + 38;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(imgX, imgY, imgSize, imgSize, 10);
  ctx.clip();

  if (img) {
    // Draw scaled center-crop
    const aspect = img.width / img.height;
    let sw, sh, sx, sy;
    if (aspect > 1) {
      sh = img.height;
      sw = img.height;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = img.width;
      sx = 0;
      sy = (img.height - sh) / 4;
    }
    ctx.drawImage(img, sx, sy, sw, sh, imgX, imgY, imgSize, imgSize);
  }
  ctx.restore();

  // Subtle border around photo
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(imgX, imgY, imgSize, imgSize);

  // Name & Role
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
// ANATOMICALLY GROUNDED MAGI WITH HIGH-CONTRAST SKELETON
// -------------------------------------------------------------
function drawMagi(ctx, x, y, options = {}) {
  const {
    facing = 1,
    isWalking = false,
    walkSpeed = 1,
    armAction = 'idle',
    t = 0
  } = options;

  ctx.save();
  ctx.translate(x, y);

  const cycle = isWalking ? t * 8.5 * walkSpeed : t * 2.2;
  const bounce = isWalking ? Math.abs(Math.sin(cycle)) * 5.5 : Math.sin(t * 2.2) * 1.5;
  const hipY = -70 - bounce;

  // Ground shadow
  ctx.beginPath();
  ctx.ellipse(0, 0, 38 - bounce * 1.1, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();

  // Bipedal Legs (Fixed skeleton)
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const legSwing = isWalking ? Math.sin(cycle) * 26 : 0;
  // Left leg
  ctx.beginPath();
  ctx.moveTo(-10, hipY);
  ctx.lineTo(-10 + legSwing * 0.5, hipY + 36);
  ctx.lineTo(-10 + legSwing, 0);
  ctx.stroke();

  // Right leg
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

  // Arms with fixed skeletal proportions (28px upper, 26px forearm)
  let lElbowX = -15, lElbowY = shoulderY + 20, lHandX = -12, lHandY = shoulderY + 45;
  let rElbowX = 15, rElbowY = shoulderY + 20, rHandX = 12, rHandY = shoulderY + 45;

  if (armAction === 'point_right') {
    rElbowX = 26;
    rElbowY = shoulderY - 6;
    rHandX = 52;
    rHandY = shoulderY - 14;
    lElbowX = -18;
    lElbowY = shoulderY + 18;
    lHandX = -6;
    lHandY = shoulderY + 28;
  } else if (armAction === 'arms_crossed') {
    lElbowX = -18;
    lElbowY = shoulderY + 20;
    lHandX = 14;
    lHandY = shoulderY + 22;
    rElbowX = 18;
    rElbowY = shoulderY + 22;
    rHandX = -12;
    rHandY = shoulderY + 24;
  } else if (armAction === 'thumbs_up') {
    rElbowX = 22;
    rElbowY = shoulderY - 10;
    rHandX = 36;
    rHandY = shoulderY - 32;
    lElbowX = -18;
    lElbowY = shoulderY + 18;
    lHandX = -8;
    lHandY = shoulderY + 28;
  } else if (armAction === 'shiver') {
    const shiverOff = Math.sin(t * 28) * 3;
    lElbowX = -12 + shiverOff;
    lElbowY = shoulderY + 15;
    lHandX = 10;
    lHandY = shoulderY + 18;
    rElbowX = 12 - shiverOff;
    rElbowY = shoulderY + 15;
    rHandX = -10;
    rHandY = shoulderY + 18;
  } else if (isWalking) {
    const armSwing = Math.sin(cycle) * 22;
    lHandX = -15 - armSwing;
    rHandX = 15 + armSwing;
  }

  // Draw Left Arm
  ctx.beginPath();
  ctx.moveTo(-4 + torsoLean, shoulderY);
  ctx.lineTo(lElbowX, lElbowY);
  ctx.lineTo(lHandX, lHandY);
  ctx.stroke();

  // Draw Right Arm
  ctx.beginPath();
  ctx.moveTo(4 + torsoLean, shoulderY);
  ctx.lineTo(rElbowX, rElbowY);
  ctx.lineTo(rHandX, rHandY);
  ctx.stroke();

  // Laser Pointer Spark when pointing
  if (armAction === 'point_right') {
    ctx.save();
    ctx.fillStyle = '#38BDF8';
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(rHandX, rHandY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Laser beam towards diagram
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rHandX, rHandY);
    ctx.lineTo(rHandX + 160, rHandY - 50);
    ctx.stroke();
    ctx.restore();
  } else if (armAction === 'thumbs_up') {
    ctx.save();
    ctx.fillStyle = '#FACC15';
    ctx.shadowColor = '#FACC15';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(rHandX, rHandY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Head
  ctx.beginPath();
  ctx.arc(torsoLean, headY, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Glasses
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  const glassX = facing === 1 ? torsoLean + 4 : torsoLean - 4;
  ctx.beginPath();
  ctx.arc(glassX, headY - 1, 6, 0, Math.PI * 2);
  ctx.arc(glassX + (facing === 1 ? 11 : -11), headY - 1, 6, 0, Math.PI * 2);
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(glassX + (facing === 1 ? 1 : -1), headY - 1, 2, 0, Math.PI * 2);
  ctx.arc(glassX + (facing === 1 ? 12 : -10), headY - 1, 2, 0, Math.PI * 2);
  ctx.fill();

  // Scarf
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.roundRect(torsoLean - 12, shoulderY - 6, 26, 9, 4);
  ctx.fill();
  const scarfWave = Math.sin(t * 4.5) * 6;
  ctx.beginPath();
  ctx.moveTo(torsoLean - 8, shoulderY);
  ctx.quadraticCurveTo(torsoLean - 24, shoulderY + 8 + scarfWave, torsoLean - 30, shoulderY + 18 + scarfWave);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#FACC15';
  ctx.stroke();

  // Wizard Hat
  ctx.fillStyle = '#6366F1';
  ctx.beginPath();
  ctx.ellipse(torsoLean, headY - 16, 26, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(torsoLean - 14, headY - 16);
  ctx.quadraticCurveTo(torsoLean + 4, headY - 55, torsoLean + 16, headY - 62);
  ctx.quadraticCurveTo(torsoLean + 10, headY - 25, torsoLean + 16, headY - 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(torsoLean + 6, headY - 38, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// -------------------------------------------------------------
// HISTORICAL CHAPTER VISUALIZER WITH PORTRAITS & 7 VARIABLES
// -------------------------------------------------------------
function drawChapter(ctx, t, chapterIdx, localT, portraits) {
  // CHAPTER 1: 1950-1956 THE DREAM OF THINKING SAND
  if (chapterIdx === 0) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('⚡ ERA: THE TURING CONVERGENCE & DARTMOUTH (1950–1956)', 56, 44);

    // ACT 1A: 0s to 15s - MELTED SAND TO SILICON LOGIC
    if (localT < 15.0) {
      const sandX = 420;
      const sandY = 90;
      const sandW = 780;
      const sandH = 370;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(sandX, sandY, sandW, sandH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('MELTED SAND (QUARTZ SiO₂) ➔ SILICON LOGIC GATES', sandX + 35, sandY + 45);

      ctx.font = '14px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Humanity melted down rocks, carved micro-switches, and infused electricity.', sandX + 35, sandY + 75);

      // Silicon Wafer Lattice
      for (let rx = 0; rx < 8; rx++) {
        for (let ry = 0; ry < 4; ry++) {
          const sx = sandX + 65 + rx * 88;
          const sy = sandY + 125 + ry * 50;
          const isFlipped = (int(localT * 4 + rx * 2 + ry) % 3 === 0);

          ctx.fillStyle = isFlipped ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.8)';
          ctx.strokeStyle = isFlipped ? '#38BDF8' : '#475569';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(sx, sy, 72, 38, 6);
          ctx.fill(); ctx.stroke();

          ctx.font = 'bold 16px monospace';
          ctx.fillStyle = isFlipped ? '#FACC15' : '#64748B';
          ctx.textAlign = 'center';
          ctx.fillText(isFlipped ? 'BIT: 1' : 'BIT: 0', sx + 36, sy + 24);
        }
      }

      ctx.textAlign = 'center';
      ctx.font = '900 22px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('HOW DID WE TEACH SAND TO THINK?', sandX + sandW / 2, sandY + 340);
    }

    // ACT 1B: 15s to 38s - ALAN TURING & THE 7 FORMAL VARIABLES
    else if (localT < 38.0) {
      // Turing Portrait Card on Left
      drawPortraitCard(
        ctx,
        portraits.turing,
        'ALAN TURING',
        'Mathematician • Cambridge',
        '1950',
        420, 90, 220, 270,
        '#38BDF8'
      );

      // Quote & Paper Banner below Turing
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(420, 375, 780, 85, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'italic 16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('"I propose to consider the question: Can machines think?"', 445, 410);

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('— Alan Turing, "Computing Machinery and Intelligence", Mind (1950)', 445, 438);

      // THE 7 FORMAL VARIABLES OF A TURING MACHINE (Right Panel)
      const varX = 660;
      const varY = 90;
      const varW = 540;
      const varH = 270;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(varX, varY, varW, varH, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'left';
      ctx.fillText('THE 7 FORMAL TURING VARIABLES', varX + 24, varY + 30);

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('M = ⟨ Q, Σ, Γ, δ, q₀, B, F ⟩', varX + 24, varY + 52);

      // The 7 Variables Detailed List
      const turingVars = [
        { sym: 'Q', name: 'Finite Set of Machine States' },
        { sym: 'Σ', name: 'Input Alphabet (e.g. {0, 1})' },
        { sym: 'Γ', name: 'Tape Alphabet (Symbols on Physical Tape)' },
        { sym: 'δ', name: 'Transition Function: Q × Γ → Q × Γ × {L, R}' },
        { sym: 'q₀', name: 'Initial Start State (q₀ ∈ Q)' },
        { sym: 'B', name: 'Blank Symbol (B ∈ Γ \\ Σ)' },
        { sym: 'F', name: 'Set of Final / Accepting States (F ⊆ Q)' }
      ];

      turingVars.forEach((v, idx) => {
        const vy = varY + 80 + idx * 26;
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#FACC15';
        ctx.fillText(`• ${v.sym}:`, varX + 24, vy);

        ctx.font = '12px monospace';
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(v.name, varX + 68, vy);
      });
    }

    // ACT 1C: 38s to 59.8s - 1956 DARTMOUTH CONFERENCE (McCARTHY & SHANNON)
    else {
      // John McCarthy Card
      drawPortraitCard(
        ctx,
        portraits.mccarthy,
        'JOHN McCARTHY',
        'Dartmouth / Stanford (Father of AI)',
        '1956',
        420, 90, 230, 270,
        '#38BDF8'
      );

      // Claude Shannon Card
      drawPortraitCard(
        ctx,
        portraits.shannon,
        'CLAUDE SHANNON',
        'Bell Labs / MIT (Father of Info Theory)',
        '1956',
        670, 90, 230, 270,
        '#A855F7'
      );

      // Dartmouth Founding Board on Right
      const dartX = 920;
      const dartY = 90;
      const dartW = 280;
      const dartH = 270;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(dartX, dartY, dartW, dartH, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#10B981';
      ctx.textAlign = 'left';
      ctx.fillText('DARTMOUTH 1956', dartX + 20, dartY + 34);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Summer AI Research Project', dartX + 20, dartY + 56);

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '12px sans-serif';
      ctx.fillText('• 2-Month, 10-Man Study', dartX + 20, dartY + 95);
      ctx.fillText('• First Coined Phrase:', dartX + 20, dartY + 125);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('"ARTIFICIAL INTELLIGENCE"', dartX + 20, dartY + 150);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px sans-serif';
      ctx.fillText('Organizers:', dartX + 20, dartY + 190);
      ctx.fillText('McCarthy, Minsky,', dartX + 20, dartY + 210);
      ctx.fillText('Rochester, & Shannon.', dartX + 20, dartY + 230);

      // Bottom Quote
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(420, 375, 780, 85, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'italic 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.textAlign = 'left';
      ctx.fillText('"Every aspect of learning or intelligence can in principle be so precisely described', 445, 410);
      ctx.fillText('that a machine can be made to simulate it." — Dartmouth Proposal (1955)', 445, 435);
    }
  }

  // CHAPTER 2: 1974-1993 THE TWO FREEZES: THE AI WINTERS
  else if (chapterIdx === 1) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#EF4444';
    ctx.fillText('❄ ERA: THE TWO FREEZES & THE XOR CRISIS (1974–1993)', 56, 44);

    // ACT 2A: 0s to 18s - THE RUSSIAN MACHINE TRANSLATION DISASTER
    if (localT < 18.0) {
      const transX = 420;
      const transY = 90;
      const transW = 780;
      const transH = 370;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(transX, transY, transW, transH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('1960s MACHINE TRANSLATION DISASTER', transX + 35, transY + 45);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('A 1960s top-tier mainframe had less memory than a modern kitchen toaster.', transX + 35, transY + 75);

      // Side-by-side Translation failure card
      const boxW = 340;
      const boxH = 170;

      // Left Box: Intended
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(transX + 35, transY + 115, boxW, boxH, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('ORIGINAL PROVERB (RUSSIAN)', transX + 50, transY + 145);

      ctx.font = 'italic 16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('"The spirit is willing,', transX + 50, transY + 185);
      ctx.fillText('but the flesh is weak."', transX + 50, transY + 215);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Biblical metaphor (Matthew 26:41)', transX + 50, transY + 255);

      // Right Box: Actual Machine Output
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(transX + 405, transY + 115, boxW, boxH, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('ACTUAL COMPUTER TRANSLATION', transX + 420, transY + 145);

      ctx.font = '900 18px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('"The vodka is good,', transX + 420, transY + 185);
      ctx.fillText('but the meat is rotten." 🥩🍸', transX + 420, transY + 215);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('❌ Total lack of real-world contextual understanding', transX + 420, transY + 255);

      ctx.textAlign = 'center';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('ALPAC REPORT (1966) CANCELS ALL MACHINE TRANSLATION FUNDING', transX + transW / 2, transY + 335);
    }

    // ACT 2B: 18s to 38s - MARVIN MINSKY & THE XOR COLLAPSE
    else if (localT < 38.0) {
      // Marvin Minsky Portrait Card
      drawPortraitCard(
        ctx,
        portraits.minsky,
        'MARVIN MINSKY',
        'Co-founder MIT AI Lab',
        '1969',
        420, 90, 220, 270,
        '#EF4444'
      );

      // XOR Graph on Right
      const xorX = 660;
      const xorY = 90;
      const xorW = 540;
      const xorH = 270;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(xorX, xorY, xorW, xorH, 12);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('MINSKY & PAPERT (1969) // PERCEPTRONS XOR', xorX + 24, xorY + 30);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Proved single-layer neural networks cannot compute XOR', xorX + 24, xorY + 50);

      // Coordinate plane
      const gX = xorX + 50;
      const gY = xorY + 220;
      const gSpan = 160;

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gX, gY); ctx.lineTo(gX + gSpan + 20, gY);
      ctx.moveTo(gX, gY); ctx.lineTo(gX, gY - gSpan - 20);
      ctx.stroke();

      const xorPts = [
        { x: 0, y: 0, val: 0 }, { x: 1, y: 0, val: 1 },
        { x: 0, y: 1, val: 1 }, { x: 1, y: 1, val: 0 }
      ];

      xorPts.forEach(p => {
        const px = gX + p.x * gSpan;
        const py = gY - p.y * gSpan;
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fillStyle = p.val === 1 ? '#38BDF8' : '#EF4444';
        ctx.fill();
      });

      // Rotating line failing
      const angle = Math.sin(localT * 2) * 0.45 - 0.4;
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(gX + 10, gY - 10);
      ctx.lineTo(gX + 10 + Math.cos(angle) * 190, gY - 10 - Math.sin(angle) * 190);
      ctx.stroke();
      ctx.setLineDash([]);

      // Explanation box on right side of graph
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.beginPath();
      ctx.roundRect(xorX + 260, xorY + 80, 260, 160, 8);
      ctx.fill();

      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('FATAL BOTTLENECK:', xorX + 275, xorY + 110);

      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('• (0,1) and (1,0) = 1 (Blue)', xorX + 275, xorY + 135);
      ctx.fillText('• (0,0) and (1,1) = 0 (Red)', xorX + 275, xorY + 155);
      ctx.fillText('• No single line can separate them', xorX + 275, xorY + 180);

      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('➔ Led to belief neural nets', xorX + 275, xorY + 210);
      ctx.fillText('   were a mathematical dead end', xorX + 275, xorY + 226);

      // Bottom Quote
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(420, 375, 780, 85, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'italic 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('"Our intuitive judgment that the extension to multi-layer systems is sterile', 445, 410);
      ctx.fillText('has perhaps prevented us from seeking their properties." — Minsky & Papert (1969)', 445, 435);
    }

    // ACT 2C: 38s to 61.6s - SIR JAMES LIGHTHILL & THE 1973 FREEZE
    else {
      // Sir James Lighthill Portrait Card
      drawPortraitCard(
        ctx,
        portraits.lighthill,
        'SIR JAMES LIGHTHILL',
        'UK Science Research Council',
        '1973',
        420, 90, 220, 270,
        '#0284C7'
      );

      // The Lighthill Report & Funding Crash on Right
      const lightX = 660;
      const lightY = 90;
      const lightW = 540;
      const lightH = 270;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(lightX, lightY, lightW, lightH, 12);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('THE LIGHTHILL REPORT (1973) // UK & DARPA', lightX + 24, lightY + 30);

      // Funding Plunge Graph
      const fX = lightX + 35;
      const fY = lightY + 65;
      const fW = 240;
      const fH = 140;

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fX, fY); ctx.lineTo(fX, fY + fH); ctx.lineTo(fX + fW, fY + fH);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(fX, fY + 15);
      ctx.lineTo(fX + fW * 0.35, fY + 20);
      ctx.lineTo(fX + fW * 0.55, fY + fH - 15);
      ctx.lineTo(fX + fW, fY + fH - 10);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Frost overlay icons
      ctx.font = '24px sans-serif';
      ctx.fillText('❄️', lightX + lightW - 45, lightY + 38);

      // Funding details on right
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('AI FUNDING: -85%', lightX + 310, lightY + 80);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('• Lighthill concludes AI failed', lightX + 310, lightY + 110);
      ctx.fillText('  all major scientific claims.', lightX + 310, lightY + 130);
      ctx.fillText('• DARPA cuts university grants.', lightX + 310, lightY + 155);
      ctx.fillText('• 1987: Second AI Winter hits', lightX + 310, lightY + 185);
      ctx.fillText('  as Expert Systems collapse.', lightX + 310, lightY + 205);

      // Bottom Quote
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(420, 375, 780, 85, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'italic 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('"In no part of the field have discoveries produced the major impact that was promised."', 445, 410);
      ctx.fillText('— Sir James Lighthill, "Artificial Intelligence: A General Survey" (1973)', 445, 435);
    }
  }

  // CHAPTER 3: 2006-2012 THE GPU & DEEP LEARNING REVOLUTION
  else if (chapterIdx === 2) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#10B981';
    ctx.fillText('⚡ ERA: THE DEEP LEARNING SPARK (2006–2012)', 56, 44);

    // ACT 3A: 0s to 24s - GEOFFREY HINTON & THE GPU DISCOVERY
    if (localT < 24.0) {
      // Geoffrey Hinton Portrait Card
      drawPortraitCard(
        ctx,
        portraits.hinton,
        'GEOFFREY HINTON',
        'Univ of Toronto (Turing & Nobel Laureate)',
        '2006–2012',
        420, 90, 240, 270,
        '#10B981'
      );

      // GPU Matrix Multiplication Card on Right
      const gpuX = 680;
      const gpuY = 90;
      const gpuW = 520;
      const gpuH = 270;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(gpuX, gpuY, gpuW, gpuH, 12);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('THE GPU GAMBLE // NVIDIA CUDA (2009)', gpuX + 24, gpuY + 30);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Gaming GPUs: Rendering pixels = Multiplying matrices', gpuX + 24, gpuY + 50);

      // Matrix Math visual
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.beginPath();
      ctx.roundRect(gpuX + 24, gpuY + 70, 470, 175, 8);
      ctx.fill();

      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('PARALLEL TILE MULTIPLY: C = A × B', gpuX + 45, gpuY + 105);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('• CPU: 4 to 8 Heavy Sequential Cores', gpuX + 45, gpuY + 140);
      ctx.fillText('• GPU: 512+ Streaming Parallel Cores', gpuX + 45, gpuY + 168);
      ctx.fillText('• 100x Acceleration on Neural Weight Updates', gpuX + 45, gpuY + 196);

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('Hinton, LeCun, Bengio: The math wasn\'t dead—we needed compute.', gpuX + 45, gpuY + 228);

      // Bottom Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(420, 375, 780, 85, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'italic 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('"It wasn\'t that neural networks were wrong. It was that we didn\'t have enough data,', 445, 410);
      ctx.fillText('and our computers were a million times too slow." — Geoffrey Hinton', 445, 435);
    }

    // ACT 3B: 24s to 56.7s - ALEXNET & ILYA SUTSKEVER (IMAGENET 2012)
    else {
      // Ilya Sutskever Portrait Card
      drawPortraitCard(
        ctx,
        portraits.sutskever,
        'ILYA SUTSKEVER',
        'AlexNet Co-author / Chief Scientist',
        '2012',
        420, 90, 220, 270,
        '#10B981'
      );

      // AlexNet Architecture & ImageNet Scorecard
      const netX = 660;
      const netY = 90;
      const netW = 540;
      const netH = 270;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(netX, netY, netW, netH, 12);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('OCT 2012 // ALEXNET ON 2× NVIDIA GTX 580', netX + 24, netY + 30);

      // Layers
      const layers = [
        { x: netX + 45, count: 5, label: 'Input' },
        { x: netX + 115, count: 7, label: 'Conv1' },
        { x: netX + 185, count: 7, label: 'Conv2' },
        { x: netX + 255, count: 5, label: 'Dense' }
      ];

      for (let l = 0; l < layers.length - 1; l++) {
        const la = layers[l];
        const lb = layers[l + 1];
        for (let na = 0; na < la.count; na++) {
          const ya = netY + 65 + na * 26;
          for (let nb = 0; nb < lb.count; nb++) {
            const yb = netY + 65 + nb * 26;
            const p = (Math.sin(localT * 8 + na + nb) + 1) * 0.12;
            ctx.strokeStyle = `rgba(16, 185, 129, ${p})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(la.x, ya); ctx.lineTo(lb.x, yb); ctx.stroke();
          }
        }
      }

      layers.forEach(lay => {
        for (let n = 0; n < lay.count; n++) {
          const ny = netY + 65 + n * 26;
          ctx.fillStyle = '#10B981';
          ctx.beginPath(); ctx.arc(lay.x, ny, 4, 0, Math.PI * 2); ctx.fill();
        }
      });

      // Scorecard on Right side
      const scX = netX + 310;
      const scY = netY + 55;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(scX, scY, 205, 195, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('IMAGENET 2012', scX + 102, scY + 30);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('Prior Error: 26.2%', scX + 102, scY + 70);

      ctx.font = '900 28px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('15.3%', scX + 102, scY + 120);

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('⚡ -10.9% DROP!', scX + 102, scY + 155);

      // Bottom Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(420, 375, 780, 85, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('"ImageNet Classification with Deep Convolutional Neural Networks"', 445, 410);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Alex Krizhevsky, Ilya Sutskever, & Geoffrey Hinton — NeurIPS (2012)', 445, 435);
    }
  }

  // CHAPTER 4: 2017 ATTENTION IS ALL YOU NEED
  else if (chapterIdx === 3) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('⚡ ERA: THE TRANSFORMER BLUEPRINT (2017)', 56, 44);

    const tfX = 420;
    const tfY = 90;
    const tfW = 780;
    const tfH = 370;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(tfX, tfY, tfW, tfH, 14);
    ctx.fill(); ctx.stroke();

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('VASWANI ET AL. (GOOGLE BRAIN 2017) // "ATTENTION IS ALL YOU NEED"', tfX + 24, tfY + 34);

    ctx.font = '13px monospace';
    ctx.fillStyle = '#FEF08A';
    ctx.fillText('Attention(Q, K, V) = softmax(Q Kᵀ / √dₖ) V', tfX + 24, tfY + 58);

    // Sentence Tokens with Attention Arcs
    const qTokens = [
      { label: '"The"', x: tfX + 80, y: tfY + 115 },
      { label: '"animal"', x: tfX + 180, y: tfY + 115 },
      { label: '"street"', x: tfX + 280, y: tfY + 115 },
      { label: '"it"', x: tfX + 380, y: tfY + 115 },
      { label: '"tired"', x: tfX + 480, y: tfY + 115 }
    ];

    const kTokens = [
      { label: '"The"', x: tfX + 80, y: tfY + 265 },
      { label: '"animal"', x: tfX + 180, y: tfY + 265 },
      { label: '"street"', x: tfX + 280, y: tfY + 265 },
      { label: '"it"', x: tfX + 380, y: tfY + 265 },
      { label: '"tired"', x: tfX + 480, y: tfY + 265 }
    ];

    for (let qi = 0; qi < qTokens.length; qi++) {
      for (let ki = 0; ki < kTokens.length; ki++) {
        const q = qTokens[qi];
        const k = kTokens[ki];
        const isStrong = (qi === 3 && ki === 1);

        ctx.strokeStyle = isStrong
          ? `rgba(250, 204, 21, ${0.7 + Math.sin(localT * 6) * 0.3})`
          : 'rgba(56, 189, 248, 0.08)';
        ctx.lineWidth = isStrong ? 3.5 : 1;

        ctx.beginPath();
        ctx.moveTo(q.x, q.y + 16);
        ctx.bezierCurveTo(q.x, q.y + 70, k.x, k.y - 70, k.x, k.y - 16);
        ctx.stroke();

        if (isStrong) {
          const flowP = (localT * 1.6) % 1.0;
          const bx = Math.pow(1 - flowP, 3) * q.x +
                     3 * Math.pow(1 - flowP, 2) * flowP * q.x +
                     3 * (1 - flowP) * Math.pow(flowP, 2) * k.x +
                     Math.pow(flowP, 3) * k.x;
          const by = Math.pow(1 - flowP, 3) * (q.y + 16) +
                     3 * Math.pow(1 - flowP, 2) * flowP * (q.y + 70) +
                     3 * (1 - flowP) * Math.pow(flowP, 2) * (k.y - 70) +
                     Math.pow(flowP, 3) * (k.y - 16);

          ctx.fillStyle = '#FACC15';
          ctx.shadowColor = '#FACC15';
          ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.arc(bx, by, 5.5, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    [qTokens, kTokens].forEach((row, isK) => {
      row.forEach((tok, idx) => {
        const isHighlight = tok.label === '"it"' || tok.label === '"animal"';
        ctx.fillStyle = isHighlight ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.8)';
        ctx.strokeStyle = isHighlight ? '#38BDF8' : 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = isHighlight ? 2 : 1;

        ctx.beginPath();
        ctx.roundRect(tok.x - 36, tok.y - 16, 72, 32, 16);
        ctx.fill(); ctx.stroke();

        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = isHighlight ? '#FFFFFF' : '#94A3B8';
        ctx.textAlign = 'center';
        ctx.fillText(tok.label, tok.x, tok.y + 4);

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = isK ? '#A855F7' : '#38BDF8';
        ctx.fillText(isK ? `K[${idx}]` : `Q[${idx}]`, tok.x, tok.y + (isK ? 26 : -22));
      });
    });

    // 8 Authors Credit Card on Right
    const authX = tfX + 570;
    const authY = tfY + 110;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(authX, authY, 185, 235, 10);
    ctx.fill(); ctx.stroke();

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.textAlign = 'center';
    ctx.fillText('THE 8 AUTHORS (GOOGLE)', authX + 92, authY + 26);

    const authors = ['Vaswani', 'Shazeer', 'Parmar', 'Uszkoreit', 'Jones', 'Gomez', 'Kaiser', 'Polosukhin'];
    authors.forEach((a, idx) => {
      ctx.font = '11px monospace';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(`• ${a}`, authX + 92, authY + 54 + idx * 22);
    });

    ctx.restore();
  }

  // CHAPTER 5: 2020-2024 WHEN MACHINES LEARNED TO IMAGINE
  else if (chapterIdx === 4) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#EC4899';
    ctx.fillText('✨ ERA: GENERATIVE DIFFUSION & VIDEO (2020–2024)', 56, 44);

    const diffX = 420;
    const diffY = 90;
    const diffW = 780;
    const diffH = 370;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(diffX, diffY, diffW, diffH, 14);
    ctx.fill(); ctx.stroke();

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#EC4899';
    ctx.fillText('HO, JAIN, & ABBEEL (2020) // DENOISING DIFFUSION PROBABILISTIC MODELS', diffX + 24, diffY + 34);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#FEF08A';
    ctx.fillText('Reverse Denoising: q(x_{t-1} | x_t, x_0) // Sora & Latent Video Transformers', diffX + 24, diffY + 58);

    const steps = [
      { t: 't = 1000', label: 'Gaussian Noise', noise: 1.0 },
      { t: 't = 600', label: 'Coarse Shapes', noise: 0.65 },
      { t: 't = 200', label: 'Fine Texture', noise: 0.25 },
      { t: 't = 0', label: 'Photoreal Video', noise: 0.0 }
    ];

    steps.forEach((st, idx) => {
      const bx = diffX + 45 + idx * 175;
      const by = diffY + 95;
      const bw = 145;
      const bh = 175;

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = idx === 3 ? '#EC4899' : 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = idx === 3 ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 8);
      ctx.fill(); ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(bx + 4, by + 4, bw - 8, bh - 8, 6);
      ctx.clip();

      if (st.noise > 0.1) {
        for (let i = 0; i < 280; i++) {
          const nx = bx + ((i * 37 + int(localT * 10)) % (bw - 8));
          const ny = by + ((i * 59 + int(localT * 8)) % (bh - 8));
          const alpha = (Math.sin(i + localT * 5) + 1) * 0.45 * st.noise;
          ctx.fillStyle = `rgba(236, 72, 153, ${alpha})`;
          ctx.fillRect(nx, ny, 2.5, 2.5);
        }
      } else {
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 45);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.4, '#EC4899');
        grad.addColorStop(1, '#6366F1');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 42, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = idx === 3 ? '#EC4899' : '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(st.t, bx + bw / 2, by + bh + 22);

      ctx.font = '10px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(st.label, bx + bw / 2, by + bh + 38);
    });

    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(diffX + 60, diffY + 345);
    ctx.lineTo(diffX + diffW - 60, diffY + 345);
    ctx.stroke();

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#EC4899';
    ctx.textAlign = 'center';
    ctx.fillText('◄ REVERSE DENOISING TRAJECTORY (LATENT SPACE) ◄', diffX + diffW / 2, diffY + 340);
    ctx.restore();
  }

  // CHAPTER 6: 2025-2026 THE AGENTIC HORIZON
  else if (chapterIdx === 5) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText('⚡ ERA: THE AGENTIC HORIZON (2025–2026)', 56, 44);

    const agX = 420;
    const agY = 90;
    const agW = 780;
    const agH = 370;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(agX, agY, agW, agH, 14);
    ctx.fill(); ctx.stroke();

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText('BEYOND CHATBOTS // AUTONOMOUS AGENTIC ARCHITECTURE', agX + 24, agY + 34);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Goal Decomposition ➔ Tool Orchestration (APIs/CLI) ➔ Self-Correction', agX + 24, agY + 56);

    // Circular Autonomous Execution Loop
    const loopCenterX = agX + 220;
    const loopCenterY = agY + 220;
    const loopRadius = 110;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(loopCenterX, loopCenterY, loopRadius, 0, Math.PI * 2);
    ctx.stroke();

    const stages = [
      { label: 'PLAN', icon: '🧠', angle: 0 },
      { label: 'ACT', icon: '⚡', angle: Math.PI / 2 },
      { label: 'TEST', icon: '💻', angle: Math.PI },
      { label: 'REFINE', icon: '🛡️', angle: 3 * Math.PI / 2 }
    ];

    stages.forEach(st => {
      const sx = loopCenterX + Math.cos(st.angle) * loopRadius;
      const sy = loopCenterY + Math.sin(st.angle) * loopRadius;

      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(st.icon, sx, sy + 6);

      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText(st.label, sx, sy + 38);
    });

    const orbitAngle = (localT * 2.2) % (Math.PI * 2);
    const opX = loopCenterX + Math.cos(orbitAngle) * loopRadius;
    const opY = loopCenterY + Math.sin(orbitAngle) * loopRadius;

    ctx.fillStyle = '#FACC15';
    ctx.shadowColor = '#FACC15';
    ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(opX, opY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('AUTONOMOUS', loopCenterX, loopCenterY - 4);
    ctx.fillText('AGENT LOOP', loopCenterX, loopCenterY + 12);

    // Right Side Live Telemetry HUD
    const hudX = agX + 440;
    const hudY = agY + 95;
    const hudW = 300;
    const hudH = 245;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 8);
    ctx.fill(); ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('LIVE EXECUTION TELEMETRY', hudX + 18, hudY + 28);

    const lossProg = clamp(localT / 25.0);
    const lossVal = lerp(1.42, 0.001, ease(lossProg)).toFixed(4);

    ctx.font = '900 24px monospace';
    ctx.fillStyle = '#10B981';
    ctx.fillText(`L: ${lossVal}`, hudX + 18, hudY + 62);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('TASK SUCCESS: 99.8%', hudX + 160, hudY + 60);

    const mgX = hudX + 20;
    const mgY = hudY + 90;
    const mgW = hudW - 40;
    const mgH = 100;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mgX, mgY); ctx.lineTo(mgX, mgY + mgH); ctx.lineTo(mgX + mgW, mgY + mgH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mgX, mgY + 10);
    for (let i = 0; i <= 30; i++) {
      const nx = i / 30;
      const ny = Math.exp(-nx * 3.5);
      ctx.lineTo(mgX + nx * mgW, mgY + (1 - ny) * mgH);
    }
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#10B981';
    ctx.fillText('STATUS: FULL AUTONOMOUS VERIFICATION', hudX + 18, hudY + 225);
    ctx.restore();
  }
}

// -------------------------------------------------------------
// CAPTION OVERLAY RENDERING (BOTTOM BROADCAST BAND)
// -------------------------------------------------------------
function drawCaptions(ctx, t) {
  const currentCue = captions.find(c => t >= c.start && t <= c.end);
  if (!currentCue) return;

  const text = currentCue.text;
  ctx.save();
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';

  const textWidth = ctx.measureText(text).width;
  const badgeW = textWidth + 36;
  const badgeH = 46;
  const badgeX = WIDTH / 2;
  const badgeY = HEIGHT - 52;

  ctx.fillStyle = 'rgba(11, 15, 25, 0.92)';
  ctx.beginPath();
  ctx.roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 23);
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, badgeX, badgeY + 7);

  ctx.restore();
}

// -------------------------------------------------------------
// MASTER FULL EPISODE RENDER PIPELINE
// -------------------------------------------------------------
async function renderFullEpisode() {
  console.log(`\n======================================================`);
  console.log(`Rendering Historical Research Master Episode: The Complete History of AI`);
  console.log(`Total Duration: ${DURATION}s (${TOTAL_FRAMES} frames @ 24fps)`);
  console.log(`Target: ${FINAL_OUTPUT}`);
  console.log(`======================================================\n`);

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
  console.log('✓ All 7 historical portraits loaded successfully into GPU memory!\n');

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

  const chapterStarts = [0.0, 59.80, 121.44, 178.12, 230.04, 271.44];
  let lastLoggedMin = -1;

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const t = frame / FPS;

    const curMin = Math.floor(t / 60);
    if (curMin !== lastLoggedMin) {
      lastLoggedMin = curMin;
      console.log(`  Rendering minute ${curMin + 1} of 6 (${int(t)}s / ${Math.floor(DURATION)}s)...`);
    }

    let chapterIdx = 5;
    for (let c = 0; c < chapterStarts.length - 1; c++) {
      if (t >= chapterStarts[c] && t < chapterStarts[c + 1]) {
        chapterIdx = c;
        break;
      }
    }
    const localT = t - chapterStarts[chapterIdx];

    // Background
    const bgGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 40, WIDTH / 2, HEIGHT / 2, 900);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#05070c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Perspective Floor Cyber Grid
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

    // Top Brand Badge
    ctx.font = '900 12px monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText('PROGRAMS MAGIC // AI DOCUMENTARY SERIES', 48, 48);

    // Draw Technical Visualizer with Portraits & 7 Variables
    drawChapter(ctx, t, chapterIdx, localT, portraits);

    // Magi Movement Choreography per Chapter
    let magiX = 220;
    let magiFacing = 1;
    let isWalking = false;
    let armAction = 'idle';

    if (chapterIdx === 0) {
      if (localT < 3.5) {
        magiX = 80 + (localT / 3.5) * 140;
        isWalking = true;
      } else {
        magiX = 220;
        armAction = 'point_right';
      }
    } else if (chapterIdx === 1) {
      magiX = 200 + Math.sin(localT * 0.5) * 30;
      armAction = 'shiver';
    } else if (chapterIdx === 2) {
      if (localT < 3.0) {
        magiX = 140 + (localT / 3.0) * 80;
        isWalking = true;
      } else {
        magiX = 220;
        armAction = 'point_right';
      }
    } else if (chapterIdx === 3) {
      magiX = 220;
      armAction = 'point_right';
    } else if (chapterIdx === 4) {
      magiX = 220;
      armAction = 'point_right';
    } else {
      if (localT > 25.0) {
        magiX = 200;
        armAction = 'thumbs_up';
      } else {
        magiX = 200;
        armAction = 'arms_crossed';
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

  console.log(`\n🎉 Full Episode Master Render Complete!`);
  console.log(`Master Video: ${FINAL_OUTPUT}`);
}

renderFullEpisode().catch(err => {
  console.error(err);
  process.exit(1);
});
