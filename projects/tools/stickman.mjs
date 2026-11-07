// Code-drawn B1 stick figures and props: wobbly ink lines on a transparent
// canvas, so every pose of the recurring character stays identical in design.
//
// Usage: node stickman.mjs ART_SPEC.json OUTPUT_DIR
// ART_SPEC: {"assets": {"name": {"figure": {...pose}} | {"prop": "clock", ...}}}
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {createCanvas, GlobalFonts} = require('../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas');
GlobalFonts.registerFromPath(new URL('../../skills/directing-stickman-videos/assets/fonts/Caveat.ttf', import.meta.url).pathname, 'Hand');
// Hand lettering; shrinks to maxW when given so labels never overflow their prop.
const hand = (ctx, txt, x, y, size, color = INK, align = 'center', maxW = Infinity) => {
  ctx.font = `bold ${size}px Hand`;
  const fit = Math.min(size, size * maxW / ctx.measureText(txt).width);
  ctx.font = `bold ${fit}px Hand`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(txt, x, y);
};

export const INK = '#1d1d1b';
export const COLORS = {
  scarf: '#E8B32A', red: '#EC4338', green: '#4CAF6A', blue: '#3D7DD8', paper: '#FFF4C7',
  glass: '#E6F0F4', skin: '#FFFFFF', navy: '#2B3A55', brown: '#9B6B43', gray: '#B9BEC4', purple: '#6B4BD8',
};

// Figure canvas: hip anchored at a fixed point so swapping poses never jumps.
export const FIG = {width: 700, height: 1000, hipX: 350, hipY: 600, r: 78};

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Pen line: smooth low-frequency wobble perpendicular to the stroke.
function wobbly(ctx, pts, {width = 6.5, color = INK, seed = 1, amp = 1.4, close = false, fill} = {}) {
  const rand = rng(seed), out = [];
  const all = close ? [...pts, pts[0]] : pts;
  for (let i = 0; i < all.length - 1; i++) {
    const [ax, ay] = all[i], [bx, by] = all[i + 1], len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.ceil(len / 14)), nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
    const ph1 = rand() * 6.28, ph2 = rand() * 6.28;
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n, w = (Math.sin(t * 3.1 + ph1) + 0.5 * Math.sin(t * 7.3 + ph2)) * amp * Math.sin(Math.PI * t);
      out.push([ax + (bx - ax) * t + nx * w, ay + (by - ay) * t + ny * w]);
    }
  }
  ctx.beginPath(); out.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function ellipsePts(cx, cy, rx, ry, rot = 0, n = 28) {
  return Array.from({length: n}, (_, i) => {
    const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
  });
}

function arcPts(cx, cy, rx, ry, a0, a1, n = 14) {
  return Array.from({length: n + 1}, (_, i) => {
    const a = a0 + (a1 - a0) * (i / n);
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
}

const rad = d => (d * Math.PI) / 180;
// Angle 0 points down, 90 points right, 180 up, -90 left.
const dir = (deg, len) => [Math.sin(rad(deg)) * len, Math.cos(rad(deg)) * len];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

const DEFAULT_POSE = {
  torso: 0, head: 0, facing: 'front',
  armL: [-20, -10], armR: [20, 10], legL: [-12, -6], legR: [12, 6],
  eyes: 'normal', brows: 'neutral', mouth: 'smile', marks: [], scarf: true, accessory: null,
};

export function drawFigure(ctx, pose, {x = FIG.hipX, y = FIG.hipY, r = FIG.r, seed = 7, mirror = false} = {}) {
  const p = {...DEFAULT_POSE, ...pose};
  ctx.save(); ctx.translate(x, y); if (mirror) ctx.scale(-1, 1);
  let s = seed;
  const line = (pts, o = {}) => wobbly(ctx, pts, {width: r * 0.085, seed: s++, amp: r * 0.018, ...o});
  const hip = [0, 0], neck = add(hip, dir(180 + p.torso, r * 3.1)), shoulder = add(hip, dir(180 + p.torso, r * 2.75));
  const head = add(neck, dir(180 + p.torso + p.head, r * 1.12));

  // Legs and arms: upper + lower segment, absolute angles.
  const limb = (from, [a1, a2], l1, l2) => { const j = add(from, dir(a1, l1)); return [from, j, add(j, dir(a2, l2))]; };
  const legs = [limb(hip, p.legL, r * 1.9, r * 1.95), limb(hip, p.legR, r * 1.9, r * 1.95)];
  const arms = [limb(shoulder, p.armL, r * 1.45, r * 1.4), limb(shoulder, p.armR, r * 1.45, r * 1.4)];
  const face = p.facing === 'right' ? 1 : p.facing === 'left' ? -1 : 0;

  const acc0 = new Set([p.accessory, ...(p.accessories || [])].filter(Boolean));
  if (acc0.has('cape')) wobbly(ctx, [add(neck, [-r * 0.5, r * 0.15]), add(neck, [r * 0.5, r * 0.15]), add(hip, [r * 1.4, r * 0.9]), add(hip, [-r * 1.4, r * 0.9])], {width: r * 0.06, seed: s++, amp: 0.8, close: true, fill: COLORS.red});
  for (const leg of legs) {
    line(leg);
    const [fx, fy] = leg[2], toe = face || (leg[2][0] < 0 ? -0.6 : 0.6);
    wobbly(ctx, ellipsePts(fx + toe * r * 0.18, fy + r * 0.04, r * 0.3, r * 0.13), {width: r * 0.07, seed: s++, amp: 0.6, close: true, fill: INK});
  }
  line([hip, neck]);
  const acc = new Set([p.accessory, ...(p.accessories || [])].filter(Boolean));
  const apron = color => wobbly(ctx, [add(shoulder, [-r * 0.45, r * 0.35]), add(shoulder, [r * 0.45, r * 0.35]), add(hip, [r * 0.6, r * 0.9]), add(hip, [-r * 0.6, r * 0.9])], {width: r * 0.05, seed: s++, amp: 0.6, close: true, fill: color});
  if (acc.has('tie')) wobbly(ctx, [add(shoulder, [0, r * 0.25]), add(shoulder, [-r * 0.16, r * 0.9]), add(shoulder, [0, r * 1.25]), add(shoulder, [r * 0.16, r * 0.9])], {width: r * 0.05, seed: s++, amp: 0.5, close: true, fill: COLORS.red});
  if (acc.has('apron')) apron(COLORS.green);
  if (acc.has('scrubs')) apron('#7FC4D8');
  if (acc.has('apron-red')) apron(COLORS.red);
  if (acc.has('uniform')) apron('#8A8F96');
  for (const arm of arms) {
    line(arm);
    wobbly(ctx, ellipsePts(arm[2][0], arm[2][1], r * 0.17, r * 0.13), {width: r * 0.06, seed: s++, amp: 0.4, close: true, fill: '#fff'});
  }
  // Objects held in the right hand.
  const [hx2, hy2] = arms[1][2];
  if (acc.has('phone')) wobbly(ctx, [[hx2 - r * 0.18, hy2 - r * 0.5], [hx2 + r * 0.18, hy2 - r * 0.5], [hx2 + r * 0.18, hy2 + r * 0.1], [hx2 - r * 0.18, hy2 + r * 0.1]], {width: r * 0.05, seed: s++, amp: 0.3, close: true, fill: COLORS.navy});
  if (acc.has('coffee')) wobbly(ctx, [[hx2 - r * 0.2, hy2 - r * 0.45], [hx2 + r * 0.2, hy2 - r * 0.45], [hx2 + r * 0.15, hy2 + r * 0.1], [hx2 - r * 0.15, hy2 + r * 0.1]], {width: r * 0.05, seed: s++, amp: 0.3, close: true, fill: COLORS.brown});
  if (acc.has('broom')) {
    line([add([hx2, hy2], [0, -r * 1.6]), add([hx2, hy2], [0, r * 2.2])], {width: r * 0.07, color: COLORS.brown});
    wobbly(ctx, [add([hx2, hy2], [-r * 0.35, r * 2.2]), add([hx2, hy2], [r * 0.35, r * 2.2]), add([hx2, hy2], [r * 0.5, r * 2.8]), add([hx2, hy2], [-r * 0.5, r * 2.8])], {width: r * 0.05, seed: s++, amp: 0.5, close: true, fill: COLORS.scarf});
  }
  if (p.scarf) {
    const ang = rad(p.torso), band = ellipsePts(neck[0], neck[1] + r * 0.12, r * 0.62, r * 0.2, ang);
    wobbly(ctx, band, {width: r * 0.06, seed: s++, amp: 0.6, close: true, fill: COLORS.scarf});
    const t0 = add(neck, [r * 0.3, r * 0.2]);
    wobbly(ctx, [t0, add(t0, [r * 0.38, 0]), add(t0, [r * 0.42, r * 1.05]), add(t0, [r * 0.06, r * 1.0])], {width: r * 0.06, seed: s++, amp: 0.5, close: true, fill: COLORS.scarf});
    for (let i = 0; i < 3; i++) line([add(t0, [r * (0.1 + i * 0.12), r * 1.0]), add(t0, [r * (0.1 + i * 0.12), r * 1.18])], {width: r * 0.04});
  }

  // Head and face.
  const [hx, hy] = head, fx = face * r * 0.32;
  if (acc.has('hair-long')) wobbly(ctx, [[hx - r * 1.05, hy - r * 0.2], [hx - r * 0.85, hy - r * 0.95], [hx, hy - r * 1.15], [hx + r * 0.85, hy - r * 0.95], [hx + r * 1.05, hy - r * 0.2], [hx + r * 1.0, hy + r * 1.25], [hx - r * 1.0, hy + r * 1.25]], {width: r * 0.06, seed: s++, amp: 0.8, close: true, fill: '#5B3A29'});
  if (acc.has('bun')) wobbly(ctx, ellipsePts(hx, hy - r * 1.15, r * 0.38, r * 0.3), {width: r * 0.06, seed: s++, amp: 0.4, close: true, fill: '#8A8F96'});
  wobbly(ctx, ellipsePts(hx, hy, r, r * 0.98), {width: r * 0.085, seed: s++, amp: r * 0.015, close: true, fill: '#fff'});
  if (acc.has('wizard-hat')) {
    // programs magic mascot "Magi": a purple wizard hat leaning back, gold band and star.
    const lean = face >= 0 ? 1 : -1, brimY = hy - r * 0.72;
    wobbly(ctx, [[hx - r * 0.95, brimY], [hx + r * 0.95, brimY], [hx + lean * r * 0.95, hy - r * 2.05], [hx + lean * r * 1.25, hy - r * 2.2], [hx + lean * r * 0.55, hy - r * 1.95]], {width: r * 0.07, seed: s++, amp: 0.6, close: true, fill: COLORS.purple});
    wobbly(ctx, [[hx - r * 0.9, brimY - r * 0.05], [hx + r * 0.9, brimY - r * 0.05], [hx + r * 0.82, brimY - r * 0.3], [hx - r * 0.82, brimY - r * 0.3]], {width: r * 0.05, seed: s++, amp: 0.4, close: true, fill: COLORS.scarf});
    wobbly(ctx, ellipsePts(hx, brimY + r * 0.02, r * 1.3, r * 0.2), {width: r * 0.07, seed: s++, amp: 0.5, close: true, fill: COLORS.purple});
    const sx = hx + lean * r * 0.32, sy = hy - r * 1.42, star = Array.from({length: 10}, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.12 : r * 0.28; return [sx + Math.cos(a) * rr, sy + Math.sin(a) * rr]; });
    wobbly(ctx, star, {width: r * 0.035, seed: s++, amp: 0.2, close: true, fill: COLORS.scarf});
  }
  if (acc.has('cap')) {
    wobbly(ctx, [...arcPts(hx, hy - r * 0.1, r * 1.02, r * 0.95, Math.PI, 2 * Math.PI)], {width: r * 0.07, seed: s++, amp: 0.5, close: true, fill: acc.has('cap-blue') ? COLORS.blue : COLORS.red});
    line([[hx + (face >= 0 ? 0 : -1.5) * r, hy - r * 0.12], [hx + (face >= 0 ? 1.5 : 0) * r, hy - r * 0.12]], {width: r * 0.1});
  }
  const ex = [-r * 0.33 + fx, r * 0.33 + fx], ey = hy - r * 0.08;
  const eye = (cx, cy) => {
    if (p.eyes === 'closed') line(arcPts(cx, cy, r * 0.13, r * 0.07, 0, Math.PI), {width: r * 0.06});
    else if (p.eyes === 'squint') line([[cx - r * 0.13, cy], [cx + r * 0.13, cy]], {width: r * 0.07});
    else {
      const big = p.eyes === 'wide' ? 1.45 : 1;
      wobbly(ctx, ellipsePts(cx, cy, r * 0.085 * big, r * 0.14 * big), {width: 1, seed: s++, amp: 0.2, close: true, fill: INK});
    }
  };
  ex.forEach(e => eye(hx + e, ey));
  if (acc.has('glasses')) { ex.forEach((e, i) => wobbly(ctx, ellipsePts(hx + e, ey, r * 0.24, r * 0.22), {width: r * 0.05, seed: s + i, amp: 0.3, close: true})); line([[hx + ex[0] + r * 0.24, ey], [hx + ex[1] - r * 0.24, ey]], {width: r * 0.04}); }
  if (acc.has('sunglasses')) { ex.forEach((e, i) => wobbly(ctx, ellipsePts(hx + e, ey + r * 0.03, r * 0.27, r * 0.19), {width: r * 0.05, seed: s + i, amp: 0.3, close: true, fill: INK})); line([[hx + ex[0], ey], [hx + ex[1], ey]], {width: r * 0.06}); }
  const by = ey - r * 0.32, bw = r * 0.16;
  const brow = (cx, side) => {
    const shapes = {
      neutral: [[-bw, 0], [bw, 0]], raised: [[-bw, -r * 0.08], [0, -r * 0.17], [bw, -r * 0.08]],
      // side: -1 left eye, 1 right eye; the inner end is toward the nose.
      angry: [[-bw * side, r * 0.08], [bw * side, -r * 0.1]], sad: [[-bw * side, -r * 0.1], [bw * side, r * 0.08]],
    };
    let shape = shapes[p.brows] || shapes.neutral;
    if (p.brows === 'one-up') shape = side > 0 ? shapes.raised : shapes.neutral;
    line(shape.map(([dx, dy]) => [cx + dx, by + dy]), {width: r * 0.065});
  };
  brow(hx + ex[0], -1); brow(hx + ex[1], 1);
  const mx = hx + fx * 0.8, my = hy + r * 0.42;
  const mouths = {
    smile: () => line(arcPts(mx, my - r * 0.12, r * 0.28, r * 0.2, 0.2, Math.PI - 0.2)),
    grin: () => wobbly(ctx, [...arcPts(mx, my - r * 0.14, r * 0.36, r * 0.32, 0, Math.PI)], {width: r * 0.07, seed: s++, amp: 0.5, close: true, fill: '#fff'}),
    frown: () => line(arcPts(mx, my + r * 0.12, r * 0.26, r * 0.16, Math.PI + 0.25, 2 * Math.PI - 0.25)),
    flat: () => line([[mx - r * 0.2, my], [mx + r * 0.2, my]]),
    o: () => wobbly(ctx, ellipsePts(mx, my, r * 0.12, r * 0.15), {width: r * 0.07, seed: s++, amp: 0.4, close: true, fill: '#fff'}),
    open: () => wobbly(ctx, ellipsePts(mx, my + r * 0.02, r * 0.22, r * 0.25), {width: r * 0.07, seed: s++, amp: 0.5, close: true, fill: '#5a2a26'}),
    wavy: () => line(Array.from({length: 7}, (_, i) => [mx - r * 0.24 + i * r * 0.08, my + (i % 2 ? -1 : 1) * r * 0.05])),
  };
  (mouths[p.mouth] || mouths.smile)();
  if (acc.has('mustache')) wobbly(ctx, [[mx - r * 0.32, my - r * 0.05], [mx, my - r * 0.2], [mx + r * 0.32, my - r * 0.05], [mx, my - r * 0.1]], {width: r * 0.05, seed: s++, amp: 0.3, close: true, fill: '#6B6F75'});
  for (const m of p.marks) {
    if (m === 'sweat') wobbly(ctx, [[hx + r * 1.05, hy - r * 0.5], [hx + r * 1.2, hy - r * 0.15], [hx + r * 1.05, hy - r * 0.05], [hx + r * 0.92, hy - r * 0.15]], {width: r * 0.05, seed: s++, amp: 0.3, close: true, fill: '#BFE3F5'});
    if (m === 'shock') for (const a of acc.has('wizard-hat') ? [-95, -70, 70, 95] : [-60, -30, 0, 30, 60]) line([add(head, dir(180 + a, r * 1.25)), add(head, dir(180 + a, r * 1.6))], {width: r * 0.06});
    if (m === 'zzz') ctx.font = `bold ${r * 0.5}px sans-serif`, ctx.fillStyle = INK, ctx.fillText('z z', hx + r * 0.9, hy - r * 0.9);
  }
  ctx.restore();
}

// Props: simple hand-drawn objects, drawn into a canvas of the given size.
const PROPS = {
  mirror(ctx, w, h) {
    wobbly(ctx, [[20, 20], [w - 20, 20], [w - 20, h - 20], [20, h - 20]], {width: 9, seed: 3, close: true, fill: COLORS.glass, color: '#5b6b78'});
    wobbly(ctx, [[w * 0.18, h * 0.12], [w * 0.32, h * 0.04 + 30]], {width: 5, seed: 4, color: '#ffffff'});
    wobbly(ctx, [[w * 0.14, h * 0.2], [w * 0.36, h * 0.08 + 40]], {width: 5, seed: 5, color: '#ffffff'});
  },
  window(ctx, w, h) {
    wobbly(ctx, [[20, 20], [w - 20, 20], [w - 20, h - 20], [20, h - 20]], {width: 9, seed: 11, close: true, fill: '#EEF6FB'});
    wobbly(ctx, [[w / 2, 20], [w / 2, h - 20]], {width: 7, seed: 12});
    wobbly(ctx, [[20, h / 2], [w - 20, h / 2]], {width: 7, seed: 13});
    wobbly(ctx, [[0, h - 14], [w, h - 14]], {width: 10, seed: 14});
  },
  sink(ctx, w, h) {
    wobbly(ctx, [[10, 30], [w - 10, 30], [w - 60, h - 10], [60, h - 10]], {width: 8, seed: 21, close: true, fill: '#ffffff'});
    wobbly(ctx, [[w / 2, 30], [w / 2, 0], [w / 2 + 50, 0]], {width: 8, seed: 22});
  },
  calendar(ctx, w, h, o = {}) {
    wobbly(ctx, [[10, 40], [w - 10, 40], [w - 10, h - 10], [10, h - 10]], {width: 7, seed: 31, close: true, fill: '#fff'});
    wobbly(ctx, [[10, 40], [w - 10, 40], [w - 10, 100], [10, 100]], {width: 7, seed: 32, close: true, fill: COLORS.red});
    const cols = 7, cw = (w - 40) / cols;
    for (let i = 0; i < cols; i++) {
      wobbly(ctx, [[20 + i * cw + 6, 120], [20 + (i + 1) * cw - 6, 120], [20 + (i + 1) * cw - 6, h - 30], [20 + i * cw + 6, h - 30]], {width: 4, seed: 40 + i, close: true});
      ctx.fillStyle = INK; ctx.font = `bold ${cw * 0.45}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), 20 + (i + 0.5) * cw, (120 + h - 30) / 2 + cw * 0.16);
    }
    if (o.circle) wobbly(ctx, ellipsePts(20 + 6.5 * cw, (120 + h - 30) / 2, cw * 0.62, (h - 150) * 0.62), {width: 6, seed: 51, close: true, color: COLORS.red});
  },
  paycheck(ctx, w, h) {
    wobbly(ctx, [[10, 10], [w - 10, 10], [w - 10, h - 10], [10, h - 10]], {width: 6, seed: 61, close: true, fill: COLORS.paper});
    for (let i = 0; i < 3; i++) wobbly(ctx, [[30, 40 + i * 28], [w * (0.5 + 0.1 * i), 40 + i * 28]], {width: 4, seed: 62 + i});
    wobbly(ctx, [[w * 0.55, h - 40], [w - 30, h - 40]], {width: 5, seed: 66});
    ctx.fillStyle = COLORS.green; ctx.font = `bold ${h * 0.3}px sans-serif`; ctx.fillText('$', w - 70, h * 0.45);
  },
  bill(ctx, w, h) {
    wobbly(ctx, [[10, 10], [w - 10, 10], [w - 10, h - 10], [10, h - 10]], {width: 6, seed: 71, close: true, fill: '#CDEBC9'});
    wobbly(ctx, ellipsePts(w / 2, h / 2, h * 0.28, h * 0.28), {width: 5, seed: 72, close: true, fill: '#fff'});
    ctx.fillStyle = COLORS.green; ctx.font = `bold ${h * 0.36}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('$', w / 2, h / 2 + h * 0.13);
  },
  coins(ctx, w, h) {
    for (let i = 0; i < 4; i++) wobbly(ctx, ellipsePts(w / 2, h - 30 - i * 26, w * 0.38, 18), {width: 6, seed: 81 + i, close: true, fill: COLORS.scarf});
  },
  house(ctx, w, h) {
    wobbly(ctx, [[w * 0.15, h * 0.45], [w * 0.85, h * 0.45], [w * 0.85, h - 10], [w * 0.15, h - 10]], {width: 6, seed: 91, close: true, fill: '#fff'});
    wobbly(ctx, [[w * 0.05, h * 0.5], [w / 2, 10], [w * 0.95, h * 0.5]], {width: 6, seed: 92, close: true, fill: COLORS.red});
    wobbly(ctx, [[w * 0.42, h - 10], [w * 0.42, h * 0.68], [w * 0.58, h * 0.68], [w * 0.58, h - 10]], {width: 5, seed: 93, fill: COLORS.brown});
  },
  dog(ctx, w, h) {
    const l = (pts, sd) => wobbly(ctx, pts, {width: 6, seed: sd});
    wobbly(ctx, ellipsePts(w * 0.45, h * 0.55, w * 0.28, h * 0.16), {width: 6, seed: 101, close: true, fill: '#fff'});
    wobbly(ctx, ellipsePts(w * 0.78, h * 0.38, w * 0.13, h * 0.13), {width: 6, seed: 102, close: true, fill: '#fff'});
    wobbly(ctx, ellipsePts(w * 0.72, h * 0.3, w * 0.05, h * 0.09, 0.5), {width: 5, seed: 103, close: true, fill: COLORS.brown});
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(w * 0.82, h * 0.36, 4, 0, 7); ctx.fill();
    for (const x of [0.25, 0.35, 0.55, 0.65]) l([[w * x, h * 0.65], [w * x, h * 0.92]], 104 + x * 10);
    l([[w * 0.17, h * 0.5], [w * 0.06, h * 0.32]], 109);
  },
};

const box = (ctx, x0, y0, x1, y1, o = {}) => wobbly(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], {width: 6, close: true, ...o});
Object.assign(PROPS, {
  desk(ctx, w, h) {
    box(ctx, 10, h * 0.45, w - 10, h * 0.55, {seed: 201, fill: '#E9D9C4'});
    wobbly(ctx, [[30, h * 0.55], [30, h - 5]], {width: 6, seed: 202}); wobbly(ctx, [[w - 30, h * 0.55], [w - 30, h - 5]], {width: 6, seed: 203});
    box(ctx, w * 0.45, 15, w * 0.85, h * 0.36, {seed: 204, fill: '#DCEAF3'});
    wobbly(ctx, [[w * 0.65, h * 0.36], [w * 0.65, h * 0.45]], {width: 7, seed: 205});
    box(ctx, w * 0.2, h * 0.39, w * 0.42, h * 0.44, {seed: 206, width: 4, fill: '#fff'});
  },
  chair(ctx, w, h) {
    box(ctx, w * 0.1, h * 0.5, w * 0.9, h * 0.6, {seed: 211, fill: COLORS.navy});
    wobbly(ctx, [[w * 0.15, h * 0.5], [w * 0.1, 10]], {width: 8, seed: 212});
    wobbly(ctx, [[w / 2, h * 0.6], [w / 2, h * 0.9]], {width: 7, seed: 213});
    wobbly(ctx, [[w * 0.15, h - 10], [w * 0.85, h - 10]], {width: 7, seed: 214});
  },
  folder(ctx, w, h) { box(ctx, 10, 20, w - 10, h - 10, {seed: 221, fill: COLORS.scarf}); box(ctx, 10, 10, w * 0.4, 25, {seed: 222, fill: COLORS.scarf}); },
  doc(ctx, w, h, o) {
    box(ctx, 10, 10, w - 10, h - 10, {seed: 231, fill: '#fff'});
    for (let i = 0; i < 3; i++) wobbly(ctx, [[30, 40 + i * 24], [w * 0.7, 40 + i * 24]], {width: 3, seed: 232 + i});
    if (o.label) hand(ctx, o.label, w / 2, h - 30, h * 0.2, o.color || COLORS.green, 'center', w - 36);
  },
  door(ctx, w, h, o) {
    box(ctx, 15, 15, w - 15, h - 5, {seed: 241, fill: '#E9D9C4'});
    wobbly(ctx, ellipsePts(w * 0.78, h * 0.55, 9, 9), {width: 4, seed: 242, close: true, fill: COLORS.scarf});
    if (o.label) { box(ctx, w * 0.25, h * 0.15, w * 0.75, h * 0.3, {seed: 243, fill: '#fff', width: 4}); hand(ctx, o.label, w / 2, h * 0.27, h * 0.11); }
  },
  table(ctx, w, h, o) {
    wobbly(ctx, ellipsePts(w / 2, h * 0.45, w * 0.46, h * 0.1), {width: 6, seed: 251, close: true, fill: o.cloth || '#F7E3E1'});
    wobbly(ctx, [[w / 2, h * 0.55], [w / 2, h - 10]], {width: 8, seed: 252}); wobbly(ctx, [[w * 0.35, h - 10], [w * 0.65, h - 10]], {width: 7, seed: 253});
    if (o.candle) { box(ctx, w / 2 - 8, h * 0.2, w / 2 + 8, h * 0.42, {seed: 254, fill: '#fff', width: 4}); wobbly(ctx, ellipsePts(w / 2, h * 0.15, 8, 15), {width: 3, seed: 255, close: true, fill: COLORS.scarf}); }
    if (o.plates) for (const x of [0.25, 0.75]) wobbly(ctx, ellipsePts(w * x, h * 0.43, w * 0.1, h * 0.035), {width: 4, seed: 256 + x * 10, close: true, fill: '#fff'});
    if (o.notebook) { box(ctx, w * 0.25, h * 0.33, w * 0.5, h * 0.42, {seed: 258, fill: '#fff', width: 4}); box(ctx, w * 0.58, h * 0.33, w * 0.72, h * 0.42, {seed: 259, fill: COLORS.gray, width: 4}); }
  },
  car(ctx, w, h) {
    wobbly(ctx, [[20, h * 0.75], [20, h * 0.5], [w * 0.25, h * 0.45], [w * 0.38, h * 0.18], [w * 0.68, h * 0.18], [w * 0.8, h * 0.45], [w - 20, h * 0.52], [w - 20, h * 0.75]], {width: 7, seed: 261, close: true, fill: COLORS.red});
    wobbly(ctx, [[w * 0.42, h * 0.24], [w * 0.64, h * 0.24], [w * 0.73, h * 0.44], [w * 0.33, h * 0.44]], {width: 5, seed: 262, close: true, fill: COLORS.glass});
    for (const x of [0.24, 0.78]) wobbly(ctx, ellipsePts(w * x, h * 0.76, h * 0.15, h * 0.15), {width: 6, seed: 263 + x * 10, close: true, fill: '#3a3a3a'});
  },
  card(ctx, w, h, o) {
    box(ctx, 10, 10, w - 10, h - 10, {seed: 271, fill: COLORS.blue});
    box(ctx, 30, h * 0.35, 75, h * 0.55, {seed: 272, fill: COLORS.scarf, width: 4});
    if (o.cracked) wobbly(ctx, [[w * 0.55, 10], [w * 0.5, h * 0.35], [w * 0.6, h * 0.55], [w * 0.52, h - 10]], {width: 5, seed: 273, color: '#fff'});
  },
  bunks(ctx, w, h) {
    for (const x0 of [10, w * 0.52]) {
      const x1 = x0 + w * 0.45;
      wobbly(ctx, [[x0, 10], [x0, h - 5]], {width: 6, seed: 281 + x0}); wobbly(ctx, [[x1, 10], [x1, h - 5]], {width: 6, seed: 282 + x0});
      for (const y of [h * 0.35, h * 0.8]) box(ctx, x0, y - 18, x1, y, {seed: 283 + y + x0, fill: '#F2C9C4', width: 5});
    }
  },
  lamp(ctx, w, h) {
    wobbly(ctx, [[w * 0.3, h - 10], [w * 0.7, h - 10]], {width: 6, seed: 291}); wobbly(ctx, [[w / 2, h - 10], [w / 2, h * 0.35]], {width: 6, seed: 292});
    wobbly(ctx, [[w * 0.2, h * 0.35], [w * 0.8, h * 0.35], [w * 0.65, 10], [w * 0.35, 10]], {width: 5, seed: 293, close: true, fill: COLORS.scarf});
    for (const a of [-0.6, 0, 0.6]) wobbly(ctx, [[w / 2 + Math.sin(a) * w * 0.35, h * 0.45 + Math.cos(a) * 10], [w / 2 + Math.sin(a) * w * 0.5, h * 0.55 + Math.cos(a) * 20]], {width: 3, seed: 294 + a * 10, color: COLORS.scarf});
  },
  stove(ctx, w, h) {
    box(ctx, 10, h * 0.4, w - 10, h - 5, {seed: 301, fill: '#fff'});
    box(ctx, w * 0.2, h * 0.55, w * 0.8, h * 0.85, {seed: 302, fill: COLORS.gray, width: 4});
    wobbly(ctx, [[w * 0.3, h * 0.4], [w * 0.3, h * 0.22], [w * 0.7, h * 0.22], [w * 0.7, h * 0.4]], {width: 6, seed: 303, fill: COLORS.red});
    for (const x of [0.4, 0.5, 0.6]) wobbly(ctx, [[w * x, h * 0.18], [w * x + 8, h * 0.1], [w * x - 4, h * 0.02]], {width: 3, seed: 304 + x * 10, color: COLORS.gray});
  },
  bike(ctx, w, h) {
    for (const x of [0.22, 0.78]) wobbly(ctx, ellipsePts(w * x, h * 0.65, h * 0.28, h * 0.28), {width: 6, seed: 311 + x * 10, close: true});
    wobbly(ctx, [[w * 0.22, h * 0.65], [w * 0.45, h * 0.35], [w * 0.7, h * 0.35], [w * 0.78, h * 0.65], [w * 0.5, h * 0.65], [w * 0.45, h * 0.35]], {width: 6, seed: 313, color: COLORS.red});
    wobbly(ctx, [[w * 0.68, h * 0.35], [w * 0.66, h * 0.15], [w * 0.76, h * 0.12]], {width: 5, seed: 314});
    if (true) { wobbly(ctx, ellipsePts(w * 0.55, h * 0.12, 18, 10, 0.4), {width: 4, seed: 315, close: true, fill: COLORS.blue}); }
  },
  backpack(ctx, w, h) { wobbly(ctx, [[w * 0.2, h * 0.25], [w * 0.8, h * 0.25], [w * 0.85, h - 10], [w * 0.15, h - 10]], {width: 6, seed: 321, close: true, fill: COLORS.blue}); wobbly(ctx, arcPts(w / 2, h * 0.25, w * 0.2, h * 0.18, Math.PI, 2 * Math.PI), {width: 6, seed: 322}); box(ctx, w * 0.3, h * 0.55, w * 0.7, h * 0.75, {seed: 323, width: 4, fill: '#9CC1F0'}); },
  laptop(ctx, w, h, o) {
    box(ctx, w * 0.12, 10, w * 0.88, h * 0.7, {seed: 331, fill: '#DCEAF3'});
    wobbly(ctx, [[0, h * 0.72], [w, h * 0.72], [w * 0.92, h - 8], [w * 0.08, h - 8]], {width: 6, seed: 332, close: true, fill: COLORS.gray});
    if (o.search) {
      box(ctx, w * 0.2, h * 0.28, w * 0.8, h * 0.42, {seed: 333, fill: '#fff', width: 4});
      hand(ctx, o.search, w * 0.23, h * 0.385, h * 0.11, INK, 'left');
      if (o.flag) { box(ctx, w * 0.2, h * 0.08, w * 0.34, h * 0.22, {seed: 334, fill: COLORS.red, width: 3}); wobbly(ctx, [[w * 0.25, h * 0.08], [w * 0.25, h * 0.22]], {width: 7, seed: 335, color: '#fff'}); wobbly(ctx, [[w * 0.2, h * 0.15], [w * 0.34, h * 0.15]], {width: 7, seed: 336, color: '#fff'}); wobbly(ctx, [[w * 0.25, h * 0.08], [w * 0.25, h * 0.22]], {width: 3, seed: 337, color: COLORS.navy}); wobbly(ctx, [[w * 0.2, h * 0.15], [w * 0.34, h * 0.15]], {width: 3, seed: 338, color: COLORS.navy}); }
      if (o.eye) { wobbly(ctx, ellipsePts(w * 0.72, h * 0.15, 22, 12), {width: 4, seed: 339, close: true, fill: '#fff'}); wobbly(ctx, ellipsePts(w * 0.72, h * 0.15, 7, 7), {width: 2, seed: 340, close: true, fill: INK}); }
    }
    if (o.ribbon) { wobbly(ctx, [[w / 2, 10], [w / 2, h - 8]], {width: 9, seed: 341, color: COLORS.red}); wobbly(ctx, ellipsePts(w / 2 - 18, 18, 18, 10, 0.4), {width: 5, seed: 342, close: true, color: COLORS.red}); wobbly(ctx, ellipsePts(w / 2 + 18, 18, 18, 10, -0.4), {width: 5, seed: 343, close: true, color: COLORS.red}); }
  },
  tv(ctx, w, h, o) {
    box(ctx, 10, 10, w - 10, h * 0.85, {seed: 351, fill: '#fff'}); box(ctx, 30, 30, w - 30, h * 0.75, {seed: 352, fill: '#EEF3F7', width: 4});
    box(ctx, 30, h * 0.52, w - 30, h * 0.72, {seed: 353, fill: COLORS.red, width: 4}); hand(ctx, o.label || 'BREAKING', w / 2, h * 0.68, h * 0.15, '#fff');
    wobbly(ctx, [[w * 0.35, h - 5], [w * 0.5, h * 0.85], [w * 0.65, h - 5]], {width: 5, seed: 354});
  },
  sign(ctx, w, h, o) {
    box(ctx, 10, 10, w - 10, h - 10, {seed: 361, fill: o.fill || '#fff'}); hand(ctx, o.label || '', w / 2, h * 0.5 + Math.min(h * 0.5, w) * 0.33, h * 0.5, o.color || INK, 'center', w - 40);
  },
  stairs(ctx, w, h) {
    for (const [x0, lift, color] of [[10, 1, COLORS.green], [w * 0.52, 0, COLORS.gray]]) {
      const steps = 5, sw = w * 0.45 / steps, sh = (h - 40) / (steps + 1), pts = [[x0, h - 10]];
      for (let i = 0; i < steps; i++) { const y = h - 10 - (i + 1 + lift) * sh; pts.push([x0 + i * sw, y], [x0 + (i + 1) * sw, y]); }
      pts.push([x0 + steps * sw, h - 10]); wobbly(ctx, pts, {width: 5, seed: 371 + x0, close: true, fill: color});
    }
  },
  seesaw(ctx, w, h) { wobbly(ctx, [[20, h * 0.25], [w - 20, h * 0.75]], {width: 9, seed: 381}); wobbly(ctx, [[w / 2 - 40, h - 10], [w / 2, h * 0.5], [w / 2 + 40, h - 10]], {width: 6, seed: 382, close: true, fill: COLORS.gray}); },
  graph(ctx, w, h) {
    wobbly(ctx, [[40, 10], [40, h - 30], [w - 10, h - 30]], {width: 6, seed: 391});
    const pts = Array.from({length: 30}, (_, i) => { const t = (i + 1) / 30; return [40 + t * (w - 70), h - 30 - Math.log(1 + 9 * t) / Math.log(10) * (h - 70)]; });
    wobbly(ctx, [[40, h - 30], ...pts], {width: 7, seed: 392, color: COLORS.green});
    hand(ctx, 'INCOME', w - 70, h - 2, 26); ctx.save(); ctx.translate(26, h / 2); ctx.rotate(-Math.PI / 2); hand(ctx, 'HAPPINESS', 0, 0, 26); ctx.restore();
  },
  map(ctx, w, h) {
    wobbly(ctx, [[20, h * 0.3], [w * 0.2, h * 0.15], [w * 0.42, h * 0.2], [w * 0.45, h * 0.55], [w * 0.3, h * 0.75], [w * 0.1, h * 0.6]], {width: 6, seed: 401, close: true, fill: '#CDEBC9'});
    wobbly(ctx, [[w * 0.6, h * 0.25], [w * 0.8, h * 0.12], [w * 0.95, h * 0.3], [w * 0.88, h * 0.6], [w * 0.65, h * 0.65]], {width: 6, seed: 402, close: true, fill: '#CDEBC9'});
    hand(ctx, 'U.S. STATES', w * 0.25, h * 0.92, 34); hand(ctx, 'EU', w * 0.78, h * 0.9, 34);
    for (const [x, y] of [[0.15, 0.35], [0.3, 0.4], [0.22, 0.55], [0.36, 0.3]]) wobbly(ctx, ellipsePts(w * x, h * y, 14, 12), {width: 3, seed: 403 + x * 100, close: true, fill: COLORS.green});
  },
  thermo(ctx, w, h, o) {
    const level = o.level ?? 0.5, c = o.color || COLORS.red;
    wobbly(ctx, [[w * 0.35, 10], [w * 0.65, 10], [w * 0.65, h - 60], [w * 0.35, h - 60]], {width: 6, seed: 411, close: true, fill: '#fff'});
    wobbly(ctx, ellipsePts(w / 2, h - 40, w * 0.28, w * 0.28), {width: 6, seed: 412, close: true, fill: c});
    box(ctx, w * 0.42, 10 + (h - 70) * (1 - level), w * 0.58, h - 55, {seed: 413, fill: c, width: 3});
    if (o.label) hand(ctx, o.label, w / 2, h * 0.05 + 30, 30);
  },
  cointower(ctx, w, h, o) { const n = o.n || 8; for (let i = 0; i < n; i++) wobbly(ctx, ellipsePts(w / 2, h - 25 - i * 28, w * 0.38, 16), {width: 5, seed: 421 + i, close: true, fill: COLORS.scarf}); },
  dock(ctx, w, h) { box(ctx, 10, h * 0.4, w - 10, h - 5, {seed: 431, fill: '#D8DCE0'}); for (let i = 1; i < 4; i++) wobbly(ctx, [[w * i / 4, h * 0.4], [w * i / 4, h - 5]], {width: 3, seed: 432 + i}); },
  moon(ctx, w, h) { wobbly(ctx, ellipsePts(w / 2, h / 2, w * 0.4, h * 0.4), {width: 6, seed: 441, close: true, fill: '#FFF4C7'}); for (const [x, y] of [[0.1, 0.1], [0.9, 0.15], [0.88, 0.88]]) for (const a of [0, Math.PI / 2]) wobbly(ctx, [[w * x - Math.cos(a) * 9, h * y - Math.sin(a) * 9], [w * x + Math.cos(a) * 9, h * y + Math.sin(a) * 9]], {width: 4, seed: 442 + x * 10 + a, color: COLORS.scarf}); },
  subscribe(ctx, w, h) { wobbly(ctx, [[10, 10], [w - 10, 10], [w - 10, h - 10], [10, h - 10]], {width: 7, seed: 451, close: true, fill: COLORS.red}); hand(ctx, 'SUBSCRIBE', w / 2, h * 0.68, h * 0.45, '#fff'); },
  skateboard(ctx, w, h) { wobbly(ctx, [[10, h * 0.3], [w - 10, h * 0.3], [w - 30, h * 0.55], [30, h * 0.55]], {width: 6, seed: 461, close: true, fill: COLORS.scarf}); for (const x of [0.25, 0.75]) wobbly(ctx, ellipsePts(w * x, h * 0.75, 12, 12), {width: 5, seed: 462 + x * 10, close: true, fill: INK}); },
  building(ctx, w, h, o) {
    box(ctx, 10, 10, w - 10, h - 5, {seed: 471, fill: o.fill || '#fff'});
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) box(ctx, 30 + c * (w - 60) / 3 + 8, 30 + r * (h - 60) / 4 + 8, 30 + (c + 1) * (w - 60) / 3 - 8, 30 + (r + 1) * (h - 60) / 4 - 8, {seed: 472 + r * 3 + c, width: 3, fill: '#DCEAF3'});
  },
  clock(ctx, w, h, o) {
    wobbly(ctx, ellipsePts(w / 2, h / 2, w * 0.42, h * 0.42), {width: 7, seed: 481, close: true, fill: '#fff'});
    for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * Math.PI; wobbly(ctx, [[w / 2 + Math.sin(a) * w * 0.34, h / 2 - Math.cos(a) * h * 0.34], [w / 2 + Math.sin(a) * w * 0.38, h / 2 - Math.cos(a) * h * 0.38]], {width: 4, seed: 482 + i}); }
    const m = (o.minute ?? 0) / 60 * 2 * Math.PI;
    wobbly(ctx, [[w / 2, h / 2], [w / 2, h * 0.2]], {width: 7, seed: 495}); wobbly(ctx, [[w / 2, h / 2], [w / 2 + Math.sin(m) * w * 0.32, h / 2 - Math.cos(m) * h * 0.32]], {width: 5, seed: 496});
  },
  coffee(ctx, w, h, o) {
    wobbly(ctx, [[w * 0.2, h * 0.2], [w * 0.8, h * 0.2], [w * 0.7, h - 10], [w * 0.3, h - 10]], {width: 6, seed: 501, close: true, fill: '#fff'});
    if (o.spill) wobbly(ctx, [[0, h - 5], [w * 0.3, h - 25], [w * 0.6, h - 8], [w, h - 20], [w * 0.9, h], [w * 0.1, h]], {width: 4, seed: 502, close: true, fill: COLORS.brown});
  },
  heart(ctx, w, h) { wobbly(ctx, [[w / 2, h - 10], [10, h * 0.4], [w * 0.25, 10], [w / 2, h * 0.3], [w * 0.75, 10], [w - 10, h * 0.4]], {width: 6, seed: 511, close: true, fill: COLORS.red}); },
  cloud(ctx, w, h) { wobbly(ctx, [[w * 0.1, h * 0.7], [w * 0.15, h * 0.35], [w * 0.4, h * 0.2], [w * 0.65, h * 0.25], [w * 0.9, h * 0.45], [w * 0.85, h * 0.75]], {width: 5, seed: 521, close: true, fill: '#9AA3AD'}); for (const x of [0.35, 0.55, 0.75]) wobbly(ctx, [[w * x, h * 0.8], [w * x - 8, h - 5]], {width: 4, seed: 522 + x * 10, color: COLORS.blue}); },
  kiosk(ctx, w, h) {
    box(ctx, 10, h * 0.45, w - 10, h - 5, {seed: 541, fill: '#fff'});
    wobbly(ctx, [[0, h * 0.45], [w * 0.15, 10], [w * 0.85, 10], [w, h * 0.45]], {width: 6, seed: 542, close: true, fill: COLORS.red});
    for (let i = 1; i < 5; i++) wobbly(ctx, [[w * i / 5, h * 0.45], [w * (0.15 + 0.7 * i / 5), 10]], {width: 4, seed: 543 + i, color: '#fff'});
    hand(ctx, 'FREE!', w / 2, h * 0.78, h * 0.2, COLORS.green, 'center', w - 30);
  },
  can(ctx, w, h) { box(ctx, w * 0.15, 10, w * 0.85, h - 10, {seed: 551, fill: COLORS.red}); wobbly(ctx, [[w * 0.2, h * 0.45], [w * 0.5, h * 0.35], [w * 0.8, h * 0.45]], {width: 5, seed: 552, color: '#fff'}); },
  tickets(ctx, w, h, o) {
    const n = o.n || 4;
    for (let i = 0; i < n; i++) box(ctx, 10, h - 20 - (i + 1) * 30, w - 10, h - 20 - i * 30, {seed: 561 + i, fill: COLORS.paper, width: 4});
    hand(ctx, o.label || '', w / 2, h - 2, 26, INK, 'center', w);
  },
  groceries(ctx, w, h) { wobbly(ctx, [[w * 0.15, h * 0.3], [w * 0.85, h * 0.3], [w * 0.8, h - 10], [w * 0.2, h - 10]], {width: 6, seed: 571, close: true, fill: '#E9D9C4'}); wobbly(ctx, ellipsePts(w * 0.35, h * 0.25, 18, 18), {width: 4, seed: 572, close: true, fill: COLORS.red}); wobbly(ctx, [[w * 0.55, h * 0.3], [w * 0.62, 10]], {width: 9, seed: 573, color: COLORS.green}); },
  busstop(ctx, w, h) {
    wobbly(ctx, [[w * 0.12, h - 5], [w * 0.12, 20]], {width: 7, seed: 581});
    wobbly(ctx, ellipsePts(w * 0.12, 45, 38, 38), {width: 6, seed: 582, close: true, fill: COLORS.blue}); hand(ctx, 'BUS', w * 0.12, 57, 30, '#fff');
    box(ctx, w * 0.3, h * 0.25, w - 10, h * 0.32, {seed: 583, fill: COLORS.gray}); wobbly(ctx, [[w * 0.32, h * 0.32], [w * 0.32, h - 5]], {width: 5, seed: 584}); wobbly(ctx, [[w - 14, h * 0.32], [w - 14, h - 5]], {width: 5, seed: 585});
    box(ctx, w * 0.35, h * 0.7, w - 20, h * 0.75, {seed: 586, fill: COLORS.brown, width: 4});
  },
  crutches(ctx, w, h) { for (const x of [0.3, 0.7]) { wobbly(ctx, [[w * x, 10], [w * x, h - 5]], {width: 7, seed: 591 + x * 10, color: COLORS.gray}); wobbly(ctx, [[w * x - 20, 12], [w * x + 20, 12]], {width: 8, seed: 593 + x * 10}); } },
  baby(ctx, w, h) { wobbly(ctx, ellipsePts(w / 2, h * 0.6, w * 0.4, h * 0.35), {width: 5, seed: 601, close: true, fill: '#BFE3F5'}); wobbly(ctx, ellipsePts(w * 0.35, h * 0.35, w * 0.2, w * 0.2), {width: 5, seed: 602, close: true, fill: '#fff'}); wobbly(ctx, ellipsePts(w * 0.35, h * 0.4, 7, 9), {width: 3, seed: 603, close: true, fill: '#5a2a26'}); },
  scale(ctx, w, h, o) {
    const tilt = o.tilt ?? 0.15;
    wobbly(ctx, [[w / 2, 30], [w / 2, h - 20]], {width: 7, seed: 611}); wobbly(ctx, [[w * 0.3, h - 15], [w * 0.7, h - 15]], {width: 8, seed: 612});
    const lx = w * 0.12, rx = w * 0.88, ly = 60 - tilt * 120, ry = 60 + tilt * 120;
    wobbly(ctx, [[lx, ly], [rx, ry]], {width: 6, seed: 613});
    for (const [x, y] of [[lx, ly], [rx, ry]]) { wobbly(ctx, [[x, y], [x - 40, y + 70], [x + 40, y + 70]], {width: 3, seed: 614 + x}); wobbly(ctx, arcPts(x, y + 70, 48, 22, 0, Math.PI), {width: 5, seed: 616 + x, fill: COLORS.scarf}); }
  },
  meter(ctx, w, h) { wobbly(ctx, [[w / 2, h * 0.45], [w / 2, h - 5]], {width: 8, seed: 621, color: COLORS.gray}); box(ctx, w * 0.2, 10, w * 0.8, h * 0.45, {seed: 622, fill: '#fff'}); box(ctx, w * 0.3, h * 0.08, w * 0.7, h * 0.22, {seed: 623, fill: COLORS.glass, width: 4}); },
  officebox(ctx, w, h) { box(ctx, 10, h * 0.35, w - 10, h - 5, {seed: 631, fill: '#E9D9C4'}); wobbly(ctx, [[w * 0.25, h * 0.35], [w * 0.3, 10], [w * 0.38, h * 0.35]], {width: 6, seed: 632, color: COLORS.green}); box(ctx, w * 0.5, h * 0.12, w * 0.7, h * 0.35, {seed: 633, fill: COLORS.blue, width: 4}); },
  phonemsg(ctx, w, h, o) {
    box(ctx, 20, 10, w - 20, h - 10, {seed: 641, fill: COLORS.navy}); box(ctx, 35, 40, w - 35, h - 40, {seed: 642, fill: '#fff', width: 4});
    box(ctx, 50, 70, w - 50, 130, {seed: 643, fill: '#CDEBC9', width: 3}); hand(ctx, o.label || '', w / 2, 112, 30, INK, 'center', w - 110);
  },
  balloon(ctx, w, h) { wobbly(ctx, ellipsePts(w / 2, h * 0.3, w * 0.4, h * 0.28), {width: 5, seed: 651, close: true, fill: COLORS.red}); wobbly(ctx, [[w / 2, h * 0.58], [w * 0.45, h * 0.8], [w * 0.55, h - 5]], {width: 3, seed: 652}); },
  leaderboard(ctx, w, h) {
    box(ctx, 10, 10, w - 10, h - 10, {seed: 661, fill: '#fff'}); hand(ctx, 'TOP KARMA', w / 2, 60, 44, COLORS.red, 'center', w - 40);
    ['1. +9,410', '2. +8,872', '3. +8,101'].forEach((t, i) => hand(ctx, t, 40, 120 + i * 52, 38, i ? INK : COLORS.green, 'left', w - 80));
  },
  hotcocoa(ctx, w, h) {
    wobbly(ctx, [[w * 0.2, h * 0.4], [w * 0.8, h * 0.4], [w * 0.7, h - 10], [w * 0.3, h - 10]], {width: 6, seed: 671, close: true, fill: COLORS.brown});
    for (const x of [0.38, 0.5, 0.62]) wobbly(ctx, [[w * x, h * 0.35], [w * x + 8, h * 0.2], [w * x - 4, h * 0.05]], {width: 3, seed: 672 + x * 10, color: COLORS.gray});
  },
  hat(ctx, w, h) { wobbly(ctx, [[w * 0.25, h * 0.7], [w * 0.3, 10], [w * 0.7, 10], [w * 0.75, h * 0.7]], {width: 6, seed: 531, close: true, fill: INK}); wobbly(ctx, [[5, h * 0.75], [w - 5, h * 0.75]], {width: 9, seed: 532}); },
});

export function renderAsset(spec, seed = 7) {
  if (spec.figure) {
    const c = createCanvas(FIG.width, FIG.height), ctx = c.getContext('2d');
    drawFigure(ctx, spec.figure, {seed, mirror: spec.mirror});
    return c;
  }
  const [w, h] = spec.size || [300, 300], c = createCanvas(w, h);
  PROPS[spec.prop](c.getContext('2d'), w, h, spec);
  return c;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const [specFile, outDir] = process.argv.slice(2);
  if (!specFile || !outDir) throw new Error('Usage: node stickman.mjs ART_SPEC.json OUTPUT_DIR');
  const {assets} = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  fs.mkdirSync(outDir, {recursive: true});
  let seed = 7;
  for (const [name, spec] of Object.entries(assets)) {
    const canvas = renderAsset(spec, spec.seed ?? seed);
    fs.writeFileSync(path.join(outDir, `${name}.png`), canvas.toBuffer('image/png'));
  }
  console.log(`${Object.keys(assets).length} assets → ${outDir}`);
}
