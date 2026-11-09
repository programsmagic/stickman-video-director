import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';

const WIDTH = 1280;
const HEIGHT = 720;

// 1. DYNAMIC COOKIE TABLE (ACT 2)
function renderCookieTableFrame() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Wooden Bakery Table
  const tableX = 460, tableY = 240, tableW = 680, tableH = 260;
  ctx.save();
  ctx.fillStyle = '#78350F';
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(tableX, tableY, tableW, tableH, 14);
  ctx.fill(); ctx.stroke();

  // Table Planks
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.4)';
  ctx.lineWidth = 1.5;
  for (let py = tableY + 60; py < tableY + tableH; py += 65) {
    ctx.beginPath(); ctx.moveTo(tableX + 10, py); ctx.lineTo(tableX + tableW - 10, py); ctx.stroke();
  }

  // Table Legs
  ctx.fillStyle = '#451A03';
  ctx.fillRect(tableX + 40, tableY + tableH, 30, 140);
  ctx.fillRect(tableX + tableW - 70, tableY + tableH, 30, 140);

  // Table Placemat Grid
  const gridX = tableX + 50, gridY = tableY + 30, gridW = 340, gridH = 200;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(gridX, gridY, gridW, gridH, 8);
  ctx.fill(); ctx.stroke();

  // Draw 4 Cookies on the Grid
  const c1 = { x: gridX + 70, y: gridY + 50, type: 'plain', label: 'NO', col: '#EF4444' };
  const c2 = { x: gridX + 270, y: gridY + 50, type: 'both', label: 'NO', col: '#EF4444' };
  const c3 = { x: gridX + 70, y: gridY + 150, type: 'sprinkles', label: 'YES!', col: '#10B981' };
  const c4 = { x: gridX + 270, y: gridY + 150, type: 'choc', label: 'YES!', col: '#10B981' };

  function drawRealCookie(cx, cy, type) {
    ctx.save();
    ctx.fillStyle = '#D97706';
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    if (type === 'choc' || type === 'both') {
      ctx.fillStyle = '#451A03';
      ctx.beginPath(); ctx.arc(cx - 8, cy - 6, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 9, cy - 7, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - 3, cy + 9, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    if (type === 'sprinkles' || type === 'both') {
      ctx.fillStyle = '#F43F5E'; ctx.fillRect(cx + 6, cy + 3, 6, 3);
      ctx.fillStyle = '#38BDF8'; ctx.fillRect(cx - 11, cy + 3, 6, 3);
      ctx.fillStyle = '#10B981'; ctx.fillRect(cx, cy - 10, 3, 6);
    }
    ctx.restore();
  }

  [c1, c2, c3, c4].forEach(c => {
    drawRealCookie(c.x, c.y, c.type);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = c.col;
    ctx.textAlign = 'center';
    ctx.fillText(c.label, c.x, c.y + 42);
  });

  // Failing Diagonal Wooden Ruler
  ctx.save();
  ctx.translate(gridX + 170, gridY + 100);
  ctx.rotate(-Math.PI / 4 + 0.08);
  ctx.fillStyle = '#F59E0B';
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-150, -10, 300, 20, 4);
  ctx.fill(); ctx.stroke();

  // Ruler tick marks
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 1.5;
  for (let rx = -140; rx < 140; rx += 14) {
    ctx.beginPath(); ctx.moveTo(rx, -10); ctx.lineTo(rx, rx % 28 === 0 ? 0 : -5); ctx.stroke();
  }
  ctx.restore();

  // Right Side Explanation Card
  const expX = tableX + 410, expY = tableY + 30;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(expX, expY, 230, 200, 10);
  ctx.fill(); ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = '900 15px system-ui, sans-serif';
  ctx.fillStyle = '#EF4444';
  ctx.fillText('WHY 1 RULER FAILS:', expX + 18, expY + 32);

  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#FEF08A';
  ctx.fillText('• YES cookies sit diagonal.', expX + 18, expY + 68);
  ctx.fillText('• NO cookies sit diagonal.', expX + 18, expY + 98);
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('Every straight line slices', expX + 18, expY + 135);
  ctx.fillText('one YES with a NO!', expX + 18, expY + 155);

  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#F87171';
  ctx.fillText('MINSKY & PAPERT (1969)', expX + 18, expY + 185);

  ctx.restore();

  // Title Above Table
  ctx.textAlign = 'center';
  ctx.font = '900 24px system-ui, sans-serif';
  ctx.fillStyle = '#FACC15';
  ctx.fillText('THE 4-COOKIE XOR PUZZLE: 1 STRAIGHT LINE CANNOT SOLVE IT!', tableX + tableW / 2, tableY - 30);

  fs.writeFileSync('/tmp/test_table.png', canvas.toBuffer('image/png'));
  console.log('Saved /tmp/test_table.png');
}

// 2. RETRO CRT TV (ACT 5)
function renderRetroTVFrame() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const tvX = 420, tvY = 130, tvW = 540, tvH = 380;

  // TV Cabinet
  ctx.save();
  ctx.fillStyle = '#5B21B6';
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(tvX, tvY, tvW, tvH, 20);
  ctx.fill(); ctx.stroke();

  // Rabbit Ear Antenna
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tvX + tvW / 2, tvY);
  ctx.lineTo(tvX + tvW / 2 - 80, tvY - 70);
  ctx.moveTo(tvX + tvW / 2, tvY);
  ctx.lineTo(tvX + tvW / 2 + 80, tvY - 70);
  ctx.stroke();

  // CRT Screen Bezel
  const scX = tvX + 30, scY = tvY + 30, scW = 360, scH = tvH - 60;
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

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, scY, 0, scY + scH);
  skyGrad.addColorStop(0, '#1E1B4B');
  skyGrad.addColorStop(1, '#B45309');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(scX, scY, scW, scH);

  // Glowing Sun
  ctx.fillStyle = '#FACC15';
  ctx.shadowColor = '#FACC15';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(scX + scW / 2, scY + scH * 0.55, 48, 0, Math.PI * 2);
  ctx.fill();

  // Procedural Noise dissolving (simulated step 250)
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  for (let i = 0; i < 280; i++) {
    const nx = scX + (Math.sin(i * 133.7) * 0.5 + 0.5) * scW;
    const ny = scY + (Math.cos(i * 97.3) * 0.5 + 0.5) * scH;
    ctx.fillRect(nx, ny, 2.5, 2.5);
  }

  // CRT Scanlines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1;
  for (let sy = scY; sy < scY + scH; sy += 4) {
    ctx.beginPath(); ctx.moveTo(scX, sy); ctx.lineTo(scX + scW, sy); ctx.stroke();
  }
  ctx.restore();

  // Right Side Control Panel (Dials)
  const cpX = tvX + 410;
  ctx.fillStyle = '#312E81';
  ctx.fillRect(cpX, tvY + 30, 100, tvH - 60);

  // Rotary Dial 1 (Tuning)
  ctx.fillStyle = '#1E1B4B';
  ctx.strokeStyle = '#A78BFA';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cpX + 50, tvY + 90, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FACC15';
  ctx.beginPath(); ctx.arc(cpX + 50 + 16, tvY + 90, 5, 0, Math.PI * 2); ctx.fill();

  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#C4B5FD';
  ctx.textAlign = 'center';
  ctx.fillText('NOISE DIAL', cpX + 50, tvY + 135);

  // Speaker Grille
  ctx.strokeStyle = '#4C1D95';
  ctx.lineWidth = 3;
  for (let gy = tvY + 180; gy < tvY + tvH - 60; gy += 14) {
    ctx.beginPath(); ctx.moveTo(cpX + 15, gy); ctx.lineTo(cpX + 85, gy); ctx.stroke();
  }
  ctx.restore();

  // Title
  ctx.textAlign = 'center';
  ctx.font = '900 24px system-ui, sans-serif';
  ctx.fillStyle = '#A78BFA';
  ctx.fillText('REVERSE DIFFUSION: WIPING AWAY TELEVISION STATIC TO REVEAL IMAGES', tvX + tvW / 2, tvY - 35);

  fs.writeFileSync('/tmp/test_tv.png', canvas.toBuffer('image/png'));
  console.log('Saved /tmp/test_tv.png');
}

renderCookieTableFrame();
renderRetroTVFrame();
