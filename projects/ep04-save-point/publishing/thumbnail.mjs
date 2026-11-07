// EP04 thumbnail (1280×720), composed from the film's own code-drawn art.
// Run: node thumbnail.mjs  →  thumbnail.png
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createCanvas, loadImage, GlobalFonts} = require('../../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas');
GlobalFonts.registerFromPath(new URL('../../../skills/directing-stickman-videos/assets/fonts/Caveat.ttf', import.meta.url).pathname, 'Hand');

const W = 1280, H = 720, GREEN = '#2F8A4A', RED = '#EC4338', INK = '#191916', BLUE = '#3D7DD8';
const art = name => loadImage(new URL(`../build/art/${name}.png`, import.meta.url).pathname);
const c = createCanvas(W, H), ctx = c.getContext('2d');

// B1 paper with a faint grid.
ctx.fillStyle = '#FDFDFC'; ctx.fillRect(0, 0, W, H);
ctx.strokeStyle = 'rgba(76,90,105,.06)'; ctx.lineWidth = 1;
for (let x = 32.5; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
for (let y = 16.5; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

async function figure(name, hipX, headTopY, scale) {
  const img = await art(name);
  ctx.drawImage(img, hipX - 350 * scale, headTopY - 190 * scale, 700 * scale, 1000 * scale);
}
function label(txt, x, y, size, fill, align = 'center') {
  ctx.font = `bold ${size}px Hand`; ctx.textAlign = align; ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.14; ctx.strokeStyle = '#FDFDFC'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}

await figure('you-wrist-tap', 320, 240, 0.95);
await figure('friend-confused', 960, 260, 0.90);

label('SAVE POINT', 320, 140, 78, GREEN);
label('DAY 1 · 07:00 AM', 320, 200, 42, BLUE);

label('RELOAD?', 850, 140, 110, RED);
label('TAP WRISTS TWICE', 850, 210, 46, INK);

// Marker circle around RELOAD?
ctx.strokeStyle = RED; ctx.lineWidth = 9; ctx.lineCap = 'round';
ctx.beginPath(); ctx.ellipse(850, 150, 280, 85, -0.04, 0.15, Math.PI * 2 - 0.05); ctx.stroke();

// Marker arrow from Magi toward reload
ctx.beginPath(); ctx.moveTo(460, 310); ctx.quadraticCurveTo(560, 240, 680, 210); ctx.stroke();
ctx.beginPath(); ctx.moveTo(650, 185); ctx.lineTo(682, 208); ctx.lineTo(650, 235); ctx.stroke();

fs.writeFileSync(new URL('./thumbnail.png', import.meta.url), c.toBuffer('image/png'));
console.log('thumbnail.png 1280×720');

