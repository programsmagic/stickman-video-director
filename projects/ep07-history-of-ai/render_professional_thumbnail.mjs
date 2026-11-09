import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;

const PROJECT_DIR = path.resolve('projects/ep07-history-of-ai');
const ASSETS_DIR = path.join(PROJECT_DIR, 'assets');
const BACKGROUND_ART = '/Users/prashantmishra/.gemini/antigravity/brain/bdfeb373-5174-479b-bf19-4f6ab9d0f198/sand_to_think_ai_history_thumbnail_1794200161108.jpg';

const OUTPUT_THUMB_PROJECT = path.join(PROJECT_DIR, 'publishing/thumbnail.png');
const OUTPUT_THUMB_EXPORTS = path.resolve('exports/EP07-thumbnail.png');
const OUTPUT_THUMB_BOOK = path.join(PROJECT_DIR, 'book/images/thumbnail.png');

async function renderProfessionalThumbnail() {
  console.log('Rendering World-Class Professional YouTube Thumbnail for EP07...');
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // 1. Draw Cinematic Background Art
  if (fs.existsSync(BACKGROUND_ART)) {
    const bgImg = await loadImage(BACKGROUND_ART);
    ctx.drawImage(bgImg, 0, 0, WIDTH, HEIGHT);
  } else {
    // Fallback dark gradient
    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, '#020617');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // 2. Cinematic Left-Side Vignette (Ensures 100% Text Readability at Mobile Size)
  const textGrad = ctx.createLinearGradient(0, 0, 750, 0);
  textGrad.addColorStop(0, 'rgba(2, 6, 23, 0.94)');
  textGrad.addColorStop(0.45, 'rgba(2, 6, 23, 0.82)');
  textGrad.addColorStop(0.75, 'rgba(2, 6, 23, 0.40)');
  textGrad.addColorStop(1, 'rgba(2, 6, 23, 0.0)');
  ctx.fillStyle = textGrad;
  ctx.fillRect(0, 0, 850, HEIGHT);

  // Top Edge Dark Vignette
  const topGrad = ctx.createLinearGradient(0, 0, 0, 180);
  topGrad.addColorStop(0, 'rgba(2, 6, 23, 0.85)');
  topGrad.addColorStop(1, 'rgba(2, 6, 23, 0.0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, WIDTH, 180);

  // 3. Top Eyebrow Badges
  const badgeY = 68;

  // Red Badge: 1950 -> 2026
  ctx.save();
  const redGrad = ctx.createLinearGradient(60, badgeY, 230, badgeY);
  redGrad.addColorStop(0, '#DC2626');
  redGrad.addColorStop(1, '#EF4444');
  ctx.fillStyle = redGrad;
  ctx.strokeStyle = '#FCA5A5';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(60, badgeY - 26, 175, 42, 21);
  ctx.fill(); ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '900 18px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('1950  ➔  2026', 147, badgeY + 1);
  ctx.restore();

  // Secondary Gold Badge: 76-YEAR DOCUMENTARY
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = 'rgba(250, 204, 21, 0.4)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.roundRect(250, badgeY - 26, 245, 42, 21);
  ctx.fill(); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 15px monospace';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('THE COMPLETE STORY', 372, badgeY + 1);
  ctx.restore();

  // 4. GIGANTIC HIGH-IMPACT HEADLINE (DESIGNED FOR MOBILE CTR)
  const textX = 60;
  const line1Y = 195;
  const line2Y = 295;

  ctx.save();
  ctx.textAlign = 'left';

  // Line 1: HOW SAND
  ctx.font = '900 96px Impact, system-ui, sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#020617';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 8;
  ctx.strokeText('HOW SAND', textX, line1Y);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('HOW SAND', textX, line1Y);

  // Line 2: LEARNED TO THINK
  ctx.font = '900 86px Impact, system-ui, sans-serif';
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#020617';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 8;
  ctx.strokeText('LEARNED TO THINK', textX, line2Y);

  const goldGrad = ctx.createLinearGradient(textX, line2Y - 70, textX, line2Y);
  goldGrad.addColorStop(0, '#FEF08A');
  goldGrad.addColorStop(1, '#FACC15');
  ctx.fillStyle = goldGrad;
  ctx.fillText('LEARNED TO THINK', textX, line2Y);

  ctx.restore();

  // 5. Subtitle Hook Banner
  const subY = 350;
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.roundRect(textX, subY, 490, 48, 10);
  ctx.fill(); ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = '900 17px monospace';
  ctx.fillStyle = '#38BDF8';
  ctx.fillText('FROM ROCKS & LIGHTNING TO SUPERINTELLIGENCE', textX + 22, subY + 30);
  ctx.restore();

  // 6. Draw Magi (The Wizard Stickman) Inspecting with Wonder
  // Positioned on the left, looking up/right toward the glowing brain!
  const magiX = 180;
  const magiY = 670;
  const scale = 1.25;

  ctx.save();
  ctx.translate(magiX, magiY);
  ctx.scale(scale, scale);

  // Character Shadow / Halo
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 45, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const hipY = -75;
  const shoulderY = hipY - 60;
  const headY = shoulderY - 28;

  // Legs
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(-12, hipY); ctx.lineTo(-18, hipY + 40); ctx.lineTo(-24, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(12, hipY); ctx.lineTo(16, hipY + 40); ctx.lineTo(20, 0);
  ctx.stroke();

  // Torso (leaning forward in curiosity)
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(8, shoulderY);
  ctx.stroke();

  // Arms (Holding Glowing Magic Wand Pointing toward the Brain)
  // Left arm on hip
  ctx.beginPath();
  ctx.moveTo(8, shoulderY);
  ctx.lineTo(-14, shoulderY + 22);
  ctx.lineTo(-4, shoulderY + 40);
  ctx.stroke();

  // Right arm raised, holding wand pointing up-right
  const handX = 58;
  const handY = shoulderY - 32;
  ctx.beginPath();
  ctx.moveTo(8, shoulderY);
  ctx.lineTo(34, shoulderY - 10);
  ctx.lineTo(handX, handY);
  ctx.stroke();

  // Glowing Wand
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(handX - 5, handY + 12);
  ctx.lineTo(handX + 35, handY - 45);
  ctx.stroke();

  // Wand Tip Star / Glowing Orb
  const tipX = handX + 35;
  const tipY = handY - 45;

  ctx.save();
  ctx.fillStyle = '#FACC15';
  ctx.shadowColor = '#FACC15';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(tipX, tipY, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 2.5;
  for (let sp = 0; sp < 4; sp++) {
    const ang = sp * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(tipX + Math.cos(ang) * 5, tipY + Math.sin(ang) * 5);
    ctx.lineTo(tipX + Math.cos(ang) * 18, tipY + Math.sin(ang) * 18);
    ctx.stroke();
  }
  ctx.restore();

  // Yellow Flowing Scarf
  ctx.fillStyle = '#FACC15';
  ctx.strokeStyle = '#CA8A04';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-4, shoulderY - 6, 26, 12, 5);
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(2, shoulderY);
  ctx.quadraticCurveTo(-15, shoulderY + 20, -22, shoulderY + 40);
  ctx.lineTo(-14, shoulderY + 42);
  ctx.quadraticCurveTo(-8, shoulderY + 24, 8, shoulderY + 6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Head
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(12, headY, 18, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Curious / Awe-struck Glasses
  ctx.fillStyle = '#38BDF8';
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(8, headY - 6, 12, 10, 3);
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(22, headY - 6, 10, 10, 3);
  ctx.fill(); ctx.stroke();

  // Wide Curious Pupils looking up-right
  ctx.fillStyle = '#0F172A';
  ctx.beginPath(); ctx.arc(16, headY - 1, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(28, headY - 1, 3.5, 0, Math.PI * 2); ctx.fill();

  // Open 'O' Mouth in Wonder
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.ellipse(22, headY + 8, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Purple Wizard Hat with Golden Star
  ctx.save();
  ctx.translate(10, headY - 12);
  ctx.rotate(0.12);

  // Hat Brim
  ctx.fillStyle = '#6366F1';
  ctx.strokeStyle = '#4338CA';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Hat Cone
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.quadraticCurveTo(-5, -25, 6, -38);
  ctx.quadraticCurveTo(10, -22, 16, 0);
  ctx.closePath();
  ctx.fillStyle = '#4F46E5';
  ctx.fill(); ctx.stroke();

  // Golden Hat Star
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.arc(0, -18, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // 7. Dynamic Hand-Drawn Annotation Arrow (Guiding Eye from Sand to Brain)
  ctx.save();
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
  ctx.shadowBlur = 16;

  // Arc arrow curving from Sand/Lightning over the circuits toward the brain
  ctx.beginPath();
  ctx.moveTo(330, 480);
  ctx.quadraticCurveTo(460, 420, 580, 460);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(555, 435);
  ctx.lineTo(585, 462);
  ctx.lineTo(550, 482);
  ctx.stroke();

  // Handwritten Annotation Badge beside Arrow
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(405, 385, 140, 36, 8);
  ctx.fill(); ctx.stroke();

  ctx.font = '900 16px system-ui, sans-serif';
  ctx.fillStyle = '#DC2626';
  ctx.textAlign = 'center';
  ctx.fillText('HOW?! ➔', 475, 409);
  ctx.restore();

  // Save to Disk
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(OUTPUT_THUMB_PROJECT, buffer);
  fs.writeFileSync(OUTPUT_THUMB_EXPORTS, buffer);
  fs.writeFileSync(OUTPUT_THUMB_BOOK, buffer);

  console.log(`✓ Thumbnail successfully saved to:`);
  console.log(`  - ${OUTPUT_THUMB_PROJECT}`);
  console.log(`  - ${OUTPUT_THUMB_EXPORTS}`);
  console.log(`  - ${OUTPUT_THUMB_BOOK}`);
}

renderProfessionalThumbnail().catch(err => {
  console.error('Thumbnail generation error:', err);
  process.exit(1);
});

