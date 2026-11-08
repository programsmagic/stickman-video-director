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
// MAGI ANATOMICAL SKELETON
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

  // Laser Pointer Spark
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

  // Hat
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
// FEYNMAN EXPLAINER CHAPTER VISUALIZERS (10-YEAR-OLD CLARITY)
// -------------------------------------------------------------
function drawChapter(ctx, t, chapterIdx, localT, portraits) {
  // ACT 1: THE BEACH, LIGHTNING, & THE 7 TURING RULES (0s to 103.88s)
  if (chapterIdx === 0) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('⚡ ACT 1: THE BEACH, THE LIGHTNING, & ALAN TURING (1950–1956)', 56, 44);

    // 0s to 26s: The Beach Sand & Light Switches
    if (localT < 26.0) {
      const panelX = 420;
      const panelY = 90;
      const panelW = 780;
      const panelH = 370;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 14);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('🏖️ A COMPUTER IS JUST A BEACH OF SAND WITH LIGHTNING!', panelX + 35, panelY + 45);

      ctx.font = '14px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Sand = Silicon crystals (Quartz). Melt it down & carve billions of switches.', panelX + 35, panelY + 75);

      // 4 Giant Switches (OFF = 0, ON = 1)
      const switches = [
        { label: 'SWITCH #1', state: 'OFF (0)', on: false, x: panelX + 50 },
        { label: 'SWITCH #2', state: 'ON (1)', on: true, x: panelX + 225 },
        { label: 'SWITCH #3', state: 'OFF (0)', on: false, x: panelX + 400 },
        { label: 'SWITCH #4', state: 'ON (1)', on: true, x: panelX + 575 }
      ];

      switches.forEach(sw => {
        ctx.fillStyle = sw.on ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.85)';
        ctx.strokeStyle = sw.on ? '#38BDF8' : '#64748B';
        ctx.lineWidth = sw.on ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.roundRect(sw.x, panelY + 115, 155, 180, 12);
        ctx.fill(); ctx.stroke();

        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = sw.on ? '#38BDF8' : '#94A3B8';
        ctx.textAlign = 'center';
        ctx.fillText(sw.label, sw.x + 77, panelY + 145);

        // Big 0 or 1
        ctx.font = '900 64px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = sw.on ? '#FACC15' : '#475569';
        ctx.fillText(sw.on ? '1' : '0', sw.x + 77, panelY + 225);

        ctx.font = 'bold 15px monospace';
        ctx.fillStyle = sw.on ? '#10B981' : '#EF4444';
        ctx.fillText(sw.state, sw.x + 77, panelY + 265);
      });

      ctx.textAlign = 'center';
      ctx.font = '900 20px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('⚡ ELECTRICITY FLIPPING BILLIONS OF SWITCHES AT LIGHT SPEED ⚡', panelX + panelW / 2, panelY + 335);
    }

    // 26s to 75s: Alan Turing & The 7 Variables (Child-Friendly Explainer)
    else if (localT < 75.0) {
      drawPortraitCard(
        ctx,
        portraits.turing,
        'ALAN TURING',
        'British Math Genius (1950)',
        '1950',
        420, 90, 220, 270,
        '#38BDF8'
      );

      // Quote
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
      ctx.fillText('— Alan Turing, "Computing Machinery and Intelligence" (1950)', 445, 438);

      // The 7 Variables Decoded for Kids
      const varX = 660;
      const varY = 90;
      const varW = 540;
      const varH = 270;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(varX, varY, varW, varH, 12);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.textAlign = 'left';
      ctx.fillText('THE 7 RULES OF EVERY COMPUTER IN THE UNIVERSE', varX + 20, varY + 30);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('Turing 7-Tuple: M = ⟨Q, Σ, Γ, δ, q₀, B, F⟩', varX + 20, varY + 50);

      const feynmanRules = [
        { sym: 'Q', icon: '🤖', name: 'Mood / Memory', desc: 'Is the robot reading, writing, or sleeping?' },
        { sym: 'Σ', icon: '🔤', name: 'Alphabet', desc: 'The numbers it understands (just 0 and 1)' },
        { sym: 'Γ', icon: '📜', name: 'Paper Tape', desc: 'All symbols written on the infinite comic strip' },
        { sym: 'δ', icon: '📖', name: 'Recipe Book', desc: 'If you see 1: erase it, write 0, step right!' },
        { sym: 'q₀', icon: '🟢', name: 'Start Button', desc: 'Where the robot wakes up' },
        { sym: 'B', icon: '⬜', name: 'Blank Box', desc: 'An empty square waiting for a new idea' },
        { sym: 'F', icon: '🏁', name: 'Finish Line', desc: 'When the puzzle is solved and robot says: I did it!' }
      ];

      feynmanRules.forEach((r, idx) => {
        const vy = varY + 75 + idx * 26;
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#FACC15';
        ctx.fillText(`${r.icon} ${r.sym}:`, varX + 20, vy);

        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(r.name, varX + 75, vy);

        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(`— ${r.desc}`, varX + 185, vy);
      });
    }

    // 75s to 103.88s: Dartmouth 1956
    else {
      drawPortraitCard(
        ctx,
        portraits.mccarthy,
        'JOHN McCARTHY',
        'Coined "Artificial Intelligence"',
        '1956',
        420, 90, 230, 270,
        '#38BDF8'
      );

      drawPortraitCard(
        ctx,
        portraits.shannon,
        'CLAUDE SHANNON',
        'Father of Information Theory',
        '1956',
        670, 90, 230, 270,
        '#A855F7'
      );

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

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '12px sans-serif';
      ctx.fillText('• 2-Month, 10-Man Study', dartX + 20, dartY + 70);
      ctx.fillText('• First Coined Phrase:', dartX + 20, dartY + 100);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('"ARTIFICIAL INTELLIGENCE"', dartX + 20, dartY + 125);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px sans-serif';
      ctx.fillText('They thought 10 people could', dartX + 20, dartY + 170);
      ctx.fillText('solve human thinking in', dartX + 20, dartY + 190);
      ctx.fillText('one single summer!', dartX + 20, dartY + 210);

      // Bottom Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(420, 375, 780, 85, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'italic 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.textAlign = 'left';
      ctx.fillText('"They were wildly wrong about the timeline. But they lit a fire', 445, 410);
      ctx.fillText('that would never go out." — The Birth of Artificial Intelligence', 445, 435);
    }
  }

  // ACT 2: THE ROTTEN MEAT & THE COOKIE PUZZLE (104.68s to 183.04s)
  else if (chapterIdx === 1) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#EF4444';
    ctx.fillText('❄ ACT 2: THE ROTTEN MEAT & THE COOKIE PUZZLE (1969–1973)', 56, 44);

    // 0s to 26s: The Rotten Meat Disaster
    if (localT < 26.0) {
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
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('😂 THE HILARIOUS 1960s TRANSLATION DISASTER', transX + 35, transY + 45);

      const boxW = 340;
      const boxH = 175;

      // Left Box: What human meant
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(transX + 35, transY + 115, boxW, boxH, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('WHAT HUMANS MEANT:', transX + 50, transY + 145);

      ctx.font = 'italic 16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('"The spirit is willing,', transX + 50, transY + 185);
      ctx.fillText('but the flesh is weak."', transX + 50, transY + 215);

      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Meaning: You want to do your chores, but your body is too sleepy!', transX + 50, transY + 260);

      // Right Box: What computer thought
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(transX + 405, transY + 115, boxW, boxH, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('WHAT THE COMPUTER SAID:', transX + 420, transY + 145);

      ctx.font = '900 18px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('"The vodka is good,', transX + 420, transY + 185);
      ctx.fillText('but the meat is rotten!" 🥩🍸', transX + 420, transY + 215);

      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('Computers had no clue what human feelings or metaphors meant!', transX + 420, transY + 260);

      ctx.textAlign = 'center';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('MEMORY CHECK: 1960s Mainframe (4KB) vs Modern Toaster (64KB)', transX + transW / 2, transY + 335);
    }

    // 26s to 55s: The 4 Cookies & The Straight Ruler (XOR Explained)
    else if (localT < 55.0) {
      drawPortraitCard(
        ctx,
        portraits.minsky,
        'MARVIN MINSKY',
        'MIT AI Lab (Perceptrons 1969)',
        '1969',
        420, 90, 220, 270,
        '#EF4444'
      );

      // The Cookie Plate on Right
      const cookieX = 660;
      const cookieY = 90;
      const cookieW = 540;
      const cookieH = 270;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cookieX, cookieY, cookieW, cookieH, 12);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('🍪 THE 4 COOKIES & THE RULER PUZZLE (XOR)', cookieX + 24, cookieY + 32);

      // 4 Cookies in 2x2 Grid
      const cookies = [
        { label: 'Plain Dough 🍪', valid: 'NO ❌', color: '#EF4444', x: cookieX + 35, y: cookieY + 60 },
        { label: 'ONLY Sprinkles 🌈', valid: 'YES! ✅', color: '#38BDF8', x: cookieX + 285, y: cookieY + 60 },
        { label: 'ONLY Chocolate 🍫', valid: 'YES! ✅', color: '#38BDF8', x: cookieX + 35, y: cookieY + 155 },
        { label: 'Choc + Sprinkles 🍩', valid: 'NO ❌', color: '#EF4444', x: cookieX + 285, y: cookieY + 155 }
      ];

      cookies.forEach(c => {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(c.x, c.y, 220, 78, 10);
        ctx.fill(); ctx.stroke();

        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(c.label, c.x + 18, c.y + 32);

        ctx.font = '900 18px monospace';
        ctx.fillStyle = c.color;
        ctx.fillText(c.valid, c.x + 18, c.y + 60);
      });

      // Bottom Ruler Warning
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(420, 375, 780, 85, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '900 18px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('CAN YOU DRAW ONE STRAIGHT RULER LINE TO SEPARATE YES FROM NO?', 420 + 390, 410);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('IMPOSSIBLE! A straight line cannot separate diagonal cookies. Early AI had only 1 line, so it broke!', 420 + 390, 438);
    }

    // 55s to 78.36s: Sir James Lighthill & The Freeze
    else {
      drawPortraitCard(
        ctx,
        portraits.lighthill,
        'SIR JAMES LIGHTHILL',
        'UK Science Research Council',
        '1973',
        420, 90, 220, 270,
        '#0284C7'
      );

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
      ctx.fillText('THE LIGHTHILL REPORT (1973) // THE FIRST AI WINTER', lightX + 24, lightY + 30);

      // Thermometer
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('❄️ -100%', lightX + 35, lightY + 110);

      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('• Governments pulled university funding.', lightX + 180, lightY + 90);
      ctx.fillText('• Society thought AI was a broken dream.', lightX + 180, lightY + 115);
      ctx.fillText('• For 20 years, neural networks were abandoned.', lightX + 180, lightY + 140);

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.beginPath();
      ctx.roundRect(lightX + 35, lightY + 170, lightW - 70, 75, 8);
      ctx.fill();

      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('THE SECRET THEY DIDN\'T KNOW:', lightX + 50, lightY + 198);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Neural networks weren\'t broken. We just needed MULTIPLE LAYERS!', lightX + 50, lightY + 225);

      // Bottom Quote
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(420, 375, 780, 85, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'italic 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.textAlign = 'left';
      ctx.fillText('"In no part of the field have discoveries produced the major impact that was promised."', 445, 410);
      ctx.fillText('— Sir James Lighthill, freezing AI funding worldwide (1973)', 445, 435);
    }
  }

  // ACT 3: THE VIDEO GAME SECRET (183.84s to 256.84s)
  else if (chapterIdx === 2) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#10B981';
    ctx.fillText('⚡ ACT 3: THE VIDEO GAME SECRET (2006–2012)', 56, 44);

    // 0s to 32s: 1 Professor (CPU) vs 1,000 Painters (GPU)
    if (localT < 32.0) {
      drawPortraitCard(
        ctx,
        portraits.hinton,
        'GEOFFREY HINTON',
        'Refused to give up on AI',
        '2006–2012',
        420, 90, 240, 270,
        '#10B981'
      );

      const splitX = 680;
      const splitY = 90;
      const splitW = 520;
      const splitH = 270;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(splitX, splitY, splitW, splitH, 12);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillStyle = '#10B981';
      ctx.fillText('🎮 1 PROFESSOR (CPU) VS 1,000 PAINTERS (GPU)', splitX + 24, splitY + 32);

      // CPU Box
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(splitX + 24, splitY + 55, 225, 185, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('NORMAL CPU 🧠', splitX + 40, splitY + 85);

      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('Like 1 genius professor.', splitX + 40, splitY + 115);
      ctx.fillText('Solves 1 giant math', splitX + 40, splitY + 135);
      ctx.fillText('equation at a time.', splitX + 40, splitY + 155);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Too slow for brain cells!', splitX + 40, splitY + 185);

      // GPU Box
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(splitX + 270, splitY + 55, 225, 185, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('GAMING GPU 🎨', splitX + 285, splitY + 85);

      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText('Like 1,000 painters!', splitX + 285, splitY + 115);
      ctx.fillText('Multiplies 2,000,000 pixels', splitX + 285, splitY + 135);
      ctx.fillText('at the exact same second!', splitX + 285, splitY + 155);
      ctx.fillStyle = '#FACC15';
      ctx.fillText('Perfect for AI neurons!', splitX + 285, splitY + 185);

      // Bottom Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(420, 375, 780, 85, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = '900 17px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText('COLORING VIDEO GAME PIXELS IS MATHEMATICALLY IDENTICAL TO TRAINING BRAIN CELLS!', 420 + 390, 420);
    }

    // 32s to 73s: AlexNet & Ilya Sutskever
    else {
      drawPortraitCard(
        ctx,
        portraits.sutskever,
        'ILYA SUTSKEVER',
        'Built AlexNet with Hinton (2012)',
        '2012',
        420, 90, 220, 270,
        '#10B981'
      );

      const alexX = 660;
      const alexY = 90;
      const alexW = 540;
      const alexH = 270;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(alexX, alexY, alexW, alexH, 12);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('ALEXNET (OCT 2012) // POWERED BY 2× GAMING GPUs', alexX + 24, alexY + 30);

      // Simple layer blocks
      const blocks = [
        { name: 'Photo (Dog/Cat)', x: alexX + 35, y: alexY + 65 },
        { name: 'Detect Lines', x: alexX + 35, y: alexY + 115 },
        { name: 'Detect Shapes', x: alexX + 35, y: alexY + 165 },
        { name: 'Recognize Face!', x: alexX + 35, y: alexY + 215 }
      ];

      blocks.forEach((b, idx) => {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, 220, 40, 8);
        ctx.fill(); ctx.stroke();

        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Step ${idx + 1}: ${b.name}`, b.x + 18, b.y + 26);
      });

      // Scorecard on Right
      const scX = alexX + 290;
      const scY = alexY + 60;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(scX, scY, 220, 190, 10);
      ctx.fill(); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('IMAGENET CONTEST 2012', scX + 110, scY + 30);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('Normal Computers: 26.2%', scX + 110, scY + 70);

      ctx.font = '900 32px monospace';
      ctx.fillStyle = '#10B981';
      ctx.fillText('15.3%', scX + 110, scY + 120);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#FACC15';
      ctx.fillText('⚡ CRUSHED THE COMPETITION!', scX + 110, scY + 160);

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
      ctx.fillText('"The AI boom didn\'t start in a government lab. It started on a gamer\'s graphics card!"', 445, 410);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('AlexNet: Alex Krizhevsky, Ilya Sutskever, & Geoffrey Hinton (2012)', 445, 435);
    }
  }

  // ACT 4: HOW AI PAYS ATTENTION (257.64s to 322.12s)
  else if (chapterIdx === 3) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('⚡ ACT 4: HOW AI PAYS ATTENTION (2017)', 56, 44);

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

    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('GOOGLE BRAIN (2017) // "ATTENTION IS ALL YOU NEED"', tfX + 24, tfY + 34);

    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#FEF08A';
    ctx.fillText('How does a computer know what a sentence actually means?', tfX + 24, tfY + 60);

    // The Robot Sentence
    const sentenceTokens = [
      { word: 'The', x: tfX + 60, isTarget: false },
      { word: 'ROBOT', x: tfX + 155, isTarget: true },
      { word: 'didn\'t', x: tfX + 270, isTarget: false },
      { word: 'cross', x: tfX + 375, isTarget: false },
      { word: 'street', x: tfX + 475, isTarget: false },
      { word: 'because', x: tfX + 580, isTarget: false },
      { word: 'IT', x: tfX + 685, isTarget: true }
    ];

    sentenceTokens.forEach(tok => {
      ctx.fillStyle = tok.isTarget ? 'rgba(250, 204, 21, 0.25)' : 'rgba(30, 41, 59, 0.85)';
      ctx.strokeStyle = tok.isTarget ? '#FACC15' : '#475569';
      ctx.lineWidth = tok.isTarget ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(tok.x - 30, tfY + 115, 78, 48, 8);
      ctx.fill(); ctx.stroke();

      ctx.font = tok.isTarget ? '900 18px system-ui, sans-serif' : '15px system-ui, sans-serif';
      ctx.fillStyle = tok.isTarget ? '#FACC15' : '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(tok.word, tok.x + 9, tfY + 146);
    });

    // The Laser Beam from IT -> ROBOT
    const itX = tfX + 694;
    const robotX = tfX + 164;
    const arcY = tfY + 163;

    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#FACC15';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(itX, arcY);
    ctx.bezierCurveTo(itX, arcY + 90, robotX, arcY + 90, robotX, arcY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Glowing Laser Badge in Center
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect((itX + robotX) / 2 - 120, arcY + 60, 240, 36, 18);
    ctx.fill(); ctx.stroke();

    ctx.font = '900 13px monospace';
    ctx.fillStyle = '#FACC15';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ ATTENTION LASER (98% MATCH) ⚡', (itX + robotX) / 2, arcY + 83);

    // Question & Answer Explanation below
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.beginPath();
    ctx.roundRect(tfX + 45, tfY + 280, tfW - 90, 70, 8);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('WHO WAS TIRED? THE STREET OR THE ROBOT?', tfX + tfW / 2, tfY + 308);

    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('The Transformer looks at all words at the same time and connects "IT" directly to "ROBOT"!', tfX + tfW / 2, tfY + 334);

    ctx.restore();
  }

  // ACT 5: WHEN MACHINES LEARNED TO DREAM (322.92s to 368.40s)
  else if (chapterIdx === 4) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#EC4899';
    ctx.fillText('✨ ACT 5: WHEN MACHINES LEARNED TO DREAM (2020–2024)', 56, 44);

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

    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = '#EC4899';
    ctx.fillText('DIFFUSION (2020) // TURNING TELEVISION SNOW INTO DREAMS', diffX + 24, diffY + 34);

    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#FEF08A';
    ctx.fillText('Teaching computers to wipe away static noise until a masterpiece appears.', diffX + 24, diffY + 58);

    const steps = [
      { t: 'Step 1: TV Snow', desc: 'Pure static noise', noise: 1.0 },
      { t: 'Step 2: Shapes', desc: 'Blurry silhouettes', noise: 0.65 },
      { t: 'Step 3: Details', desc: 'Lighting & texture', noise: 0.25 },
      { t: 'Step 4: Masterpiece!', desc: 'Crystal-clear dream', noise: 0.0 }
    ];

    steps.forEach((st, idx) => {
      const bx = diffX + 45 + idx * 175;
      const by = diffY + 95;
      const bw = 145;
      const bh = 175;

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = idx === 3 ? '#EC4899' : 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = idx === 3 ? 2.5 : 1;
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
        ctx.beginPath(); ctx.arc(cx, cy, 42, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = idx === 3 ? '#EC4899' : '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(st.t, bx + bw / 2, by + bh + 22);

      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(st.desc, bx + bw / 2, by + bh + 38);
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
    ctx.fillText('◄ WIPING AWAY NOISE UNTIL ART APPEARS ◄', diffX + diffW / 2, diffY + 340);
    ctx.restore();
  }

  // ACT 6: AUTONOMOUS AGENTS (369.20s to 427.92s)
  else if (chapterIdx === 5) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText('⚡ ACT 6: AUTONOMOUS AGENTS (2025–2026)', 56, 44);

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

    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = '#FACC15';
    ctx.fillText('BEYOND CHATBOTS: ARTIFICIAL INTELLIGENCE WITH HANDS & TOOLS', agX + 24, agY + 34);

    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('A chatbot only talks. An Autonomous Agent plans, writes code, tests, and fixes bugs!', agX + 24, agY + 56);

    // 4 Agent Team Stages
    const agentTeam = [
      { title: '1. Plan the Goal', icon: '🧠', desc: 'Breaks big mission into easy steps', x: agX + 35, y: agY + 95 },
      { title: '2. Use the Hands', icon: '🛠️', desc: 'Runs terminal, edits files, draws images', x: agX + 400, y: agY + 95 },
      { title: '3. Run the Code', icon: '💻', desc: 'Executes the real software in sandbox', x: agX + 35, y: agY + 205 },
      { title: '4. Fix Own Mistakes!', icon: '🛡️', desc: 'Reads errors and self-debugs until it works', x: agX + 400, y: agY + 205 }
    ];

    agentTeam.forEach(m => {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(m.x, m.y, 345, 85, 10);
      ctx.fill(); ctx.stroke();

      ctx.font = '24px sans-serif';
      ctx.fillText(m.icon, m.x + 20, m.y + 40);

      ctx.textAlign = 'left';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillStyle = '#FACC15';
      ctx.fillText(m.title, m.x + 58, m.y + 34);

      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(m.desc, m.x + 58, m.y + 60);
    });

    // Grand Finale Timeline Bridge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(agX + 35, agY + 310, agW - 70, 45, 8);
    ctx.fill(); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#10B981';
    ctx.fillText('1950 (TURING TAPE) ══════════════════════════════ 2026 (AUTONOMOUS AGENTS)', agX + agW / 2, agY + 338);

    ctx.restore();
  }
}

// -------------------------------------------------------------
// BROADCAST SUBTITLES (BOTTOM BAND)
// -------------------------------------------------------------
function drawCaptions(ctx, t) {
  const currentCue = captions.find(c => t >= c.start && t <= c.end);
  if (!currentCue) return;

  const text = currentCue.text;
  ctx.save();
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';

  const textWidth = ctx.measureText(text).width;
  const badgeW = Math.min(WIDTH - 80, textWidth + 36);
  const badgeH = 46;
  const badgeX = WIDTH / 2;
  const badgeY = HEIGHT - 52;

  ctx.fillStyle = 'rgba(11, 15, 25, 0.94)';
  ctx.beginPath();
  ctx.roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 23);
  ctx.fill();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, badgeX, badgeY + 7, badgeW - 20);

  ctx.restore();
}

// -------------------------------------------------------------
// MASTER RENDER PIPELINE
// -------------------------------------------------------------
async function renderFeynmanEpisode() {
  console.log(`\n======================================================`);
  console.log(`Rendering 10-Year-Old Feynman Master Episode: The History of AI`);
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

    // Series Watermark
    ctx.font = '900 12px monospace';
    ctx.fillStyle = '#FACC15';
    ctx.fillText('PROGRAMS MAGIC // THE HISTORY OF AI (FEYNMAN MASTER)', 48, 48);

    // Draw Feynman Visualizer
    drawChapter(ctx, t, actIdx, localT, portraits);

    // Magi Movement Choreography
    let magiX = 220;
    let magiFacing = 1;
    let isWalking = false;
    let armAction = 'idle';

    if (actIdx === 0) {
      if (localT < 3.5) {
        magiX = 80 + (localT / 3.5) * 140;
        isWalking = true;
      } else {
        magiX = 220;
        armAction = 'point_right';
      }
    } else if (actIdx === 1) {
      if (localT > 55.0) {
        magiX = 200;
        armAction = 'shiver';
      } else {
        magiX = 220;
        armAction = 'point_right';
      }
    } else if (actIdx === 2) {
      if (localT < 3.0) {
        magiX = 140 + (localT / 3.0) * 80;
        isWalking = true;
      } else {
        magiX = 220;
        armAction = 'point_right';
      }
    } else if (actIdx === 3) {
      magiX = 220;
      armAction = 'point_right';
    } else if (actIdx === 4) {
      magiX = 220;
      armAction = 'point_right';
    } else {
      if (localT > 30.0) {
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

  console.log(`\n🎉 Full Feynman Episode Master Render Complete!`);
  console.log(`Master Video: ${FINAL_OUTPUT}`);
}

renderFeynmanEpisode().catch(err => {
  console.error(err);
  process.exit(1);
});

