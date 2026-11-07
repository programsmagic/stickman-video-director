// EP01 thumbnail (1280×720), composed from the film's own code-drawn art.
// Run: node thumbnail.mjs  →  thumbnail.png
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createCanvas, loadImage, GlobalFonts} = require('../../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas');
GlobalFonts.registerFromPath(new URL('../../../skills/directing-stickman-videos/assets/fonts/Caveat.ttf', import.meta.url).pathname, 'Hand');

const W = 1280, H = 720, GREEN = '#2F8A4A', RED = '#EC4338', INK = '#191916';
const art = name => loadImage(new URL(`../build/art/${name}.png`, import.meta.url).pathname);
const c = createCanvas(W, H), ctx = c.getContext('2d');

// B1 paper with a faint grid.
ctx.fillStyle = '#FDFDFC'; ctx.fillRect(0, 0, W, H);
ctx.strokeStyle = 'rgba(76,90,105,.06)'; ctx.lineWidth = 1;
for (let x = 32.5; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
for (let y = 16.5; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

// Figure PNGs are 700×1000; the drawing's head top is at y≈190 and the hip at x=350.
async function figure(name, hipX, headTopY, scale) {
  const img = await art(name);
  ctx.drawImage(img, hipX - 350 * scale, headTopY - 190 * scale, 700 * scale, 1000 * scale);
}
function label(txt, x, y, size, fill, align = 'center') {
  ctx.font = `bold ${size}px Hand`; ctx.textAlign = align; ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.14; ctx.strokeStyle = '#FDFDFC'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}

await figure('you-drop', 280, 250, 0.92);
await figure('janitor', 960, 270, 0.92);

// The two numbers: yours small, the janitor's huge and circled.
label('$55,000', 280, 150, 76, GREEN);
label('$9,800,000', 900, 200, 150, GREEN);
ctx.strokeStyle = RED; ctx.lineWidth = 9; ctx.lineCap = 'round';
ctx.beginPath(); ctx.ellipse(905, 150, 360, 105, -0.04, 0.15, Math.PI * 2 - 0.05); ctx.stroke();
// Marker arrow from the shocked face toward the janitor's number.
ctx.beginPath(); ctx.moveTo(420, 330); ctx.quadraticCurveTo(470, 250, 560, 235); ctx.stroke();
ctx.beginPath(); ctx.moveTo(530, 210); ctx.lineTo(562, 234); ctx.lineTo(528, 258); ctx.stroke();

fs.writeFileSync(new URL('./thumbnail.png', import.meta.url), c.toBuffer('image/png'));
console.log('thumbnail.png 1280×720');
