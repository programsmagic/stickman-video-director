// B1 Classic Hand-Drawn Layout for AI Sand Hook
import fs from 'node:fs';

const GREEN = '#2F8A4A', RED = '#EC4338', INK = '#191916', BLUE = '#2563EB';
const FIG_TOP = 190, FIG_FEET = 905, FIG_CX = 350;

function fig(name, cx, feetY, scale, extra = {}) {
  return {
    type: 'image',
    path: `art/${name}.png`,
    x: Math.round(cx - FIG_CX * scale),
    y: Math.round(feetY - FIG_FEET * scale),
    w: Math.round(700 * scale),
    ...extra
  };
}

const prop = (name, x, y, w, extra = {}) => ({type: 'image', path: `art/${name}.png`, x, y, w, ...extra});
const text = (t, x, y, size, extra = {}) => ({type: 'text', text: t, x, y, size, ...extra});
const popIn = (layer, at) => ({...layer, from: at, keys: [{t: at, y: layer.y + 18, alpha: 0}, {t: at + 0.25, y: layer.y, alpha: 1}]});

function flip(nameA, nameB, cx, feetY, scale, t0, t1, step = 0.22) {
  const out = [];
  const a = fig(nameA, cx, feetY, scale);
  const b = fig(nameB, cx, feetY, scale);
  for (let t = t0, i = 0; t < t1; t += step, i++) {
    const base = i % 2 ? b : a;
    out.push({
      ...base,
      from: +t.toFixed(3),
      to: +Math.min(t + step, t1).toFixed(3)
    });
  }
  return out;
}

const shots = [];
const sfx = [];
const shot = (start, end, layers) => shots.push({start, end, layers});

// SHOT 1: Look down at your phone (0 - 1.69s)
shot(0, 1.69, [
  popIn(text('LOOK DOWN AT YOUR PHONE.', 100, 100, 58, {bold: true}), 0.1),
  fig('you-calm', 850, 600, 0.65, {to: 0.8}),
  fig('you-amazed', 850, 600, 0.65, {from: 0.8}),
]);
sfx.push({time: 0.2, kind: 'pop', gain: 0.18});

// SHOT 2: It feels like magic, but it is just beach sand (1.69 - 8.11s)
shot(1.69, 8.11, [
  text('IT FEELS LIKE MAGIC.', 100, 90, 54, {bold: true}),
  popIn(text('FUNDAMENTALLY JUST BEACH SAND.', 100, 165, 48, {bold: true, color: RED}), 2.2),
  {type: 'underline', x: 105, y: 240, w: 560, color: RED, keys: [{t: 2.3, progress: 0}, {t: 3.0, progress: 1}]},
  fig('you-amazed', 900, 600, 0.65, {to: 2.0}),
  ...flip('you-think', 'you-skeptic', 900, 600, 0.65, 2.0, 6.42, 0.25),
  {type: 'arrow', x: 380, y: 360, w: 220, keys: [{t: 3.5, progress: 0}, {t: 4.2, progress: 1}]},
]);
sfx.push({time: 2.3, kind: 'paper', gain: 0.15});
sfx.push({time: 3.6, kind: 'pop', gain: 0.12});

// SHOT 3: Sand is quartz crystals - silicon (8.11 - 11.78s)
shot(8.11, 11.78, [
  text('QUARTZ CRYSTALS:', 100, 95, 52, {bold: true}),
  popIn(text('SILICON DIOXIDE (SiO2)', 100, 170, 58, {bold: true, color: GREEN}), 0.6),
  {type: 'underline', x: 105, y: 250, w: 480, color: GREEN, keys: [{t: 0.7, progress: 0}, {t: 1.4, progress: 1}]},
  fig('you-confident', 880, 600, 0.65),
]);
sfx.push({time: 8.8, kind: 'tap', gain: 0.18});

// SHOT 4: Melt sand, carve billions of switches, trap electricity (11.78 - 20.95s)
shot(11.78, 20.95, [
  text('MELT SAND +', 80, 80, 48, {bold: true}),
  text('TRAP ELECTRICITY', 80, 135, 48, {bold: true}),
  popIn(text('BILLIONS OF MICROSCOPIC SWITCHES', 80, 210, 42, {bold: true, color: BLUE}), 2.5),
  prop('cloud', 950, 60, 180),
  {type: 'line', points: [[1040, 240], [1020, 300], [1050, 320], [1030, 390]], color: '#EAB308', lineWidth: 5, keys: [{t: 1.5, progress: 0}, {t: 2.0, progress: 1}]},
  ...flip('you-walk-a', 'you-walk-b', 650, 600, 0.65, 0.5, 8.5, 0.22),
]);
sfx.push({time: 13.5, kind: 'pop', gain: 0.2});
sfx.push({time: 16.0, kind: 'tap', gain: 0.18});

// SHOT 5: OFF = 0, ON = 1 (20.95 - 27.5s)
shot(20.95, 27.5, [
  popIn(text('SWITCH OFF  =  0', 100, 120, 62, {bold: true, color: RED}), 0.2),
  popIn(text('SWITCH ON   =  1', 100, 220, 62, {bold: true, color: GREEN}), 2.6),
  {type: 'underline', x: 105, y: 310, w: 420, color: GREEN, keys: [{t: 2.7, progress: 0}, {t: 3.4, progress: 1}]},
  fig('you-tap', 900, 600, 0.65),
]);
sfx.push({time: 21.2, kind: 'tap', gain: 0.22});
sfx.push({time: 23.6, kind: 'tap', gain: 0.22});

// SHOT 6: Sand + Lightning -> Teaching sand to think! (27.5 - 34.2s)
shot(27.5, 34.2, [
  text('A BEACH OF SAND', 80, 75, 46, {bold: true}),
  text('DANCING WITH LIGHTNING.', 80, 130, 46, {bold: true}),
  popIn(text('HOW DID WE TEACH', 80, 210, 52, {bold: true, color: GREEN}), 3.2),
  popIn(text('SAND TO THINK?', 80, 270, 52, {bold: true, color: GREEN}), 3.2),
  {type: 'underline', x: 85, y: 345, w: 380, color: GREEN, keys: [{t: 3.4, progress: 0}, {t: 4.4, progress: 1}]},
  fig('you-amazed', 950, 600, 0.65, {to: 3.0}),
  ...flip('you-cheer', 'you-grin', 950, 600, 0.65, 3.0, 6.7, 0.22),
]);
sfx.push({time: 28.0, kind: 'pop', gain: 0.18});
sfx.push({time: 31.0, kind: 'paper', gain: 0.18});

// Semantic single-line captions for B1 engine
const captions = [
  {"start": 0, "end": 1.69, "text": "Look down at your phone."},
  {"start": 1.69, "end": 4.5, "text": "It feels like magic, but inside,"},
  {"start": 4.5, "end": 8.11, "text": "it is fundamentally just a handful of sand from the beach."},
  {"start": 8.11, "end": 11.78, "text": "Sand is made of tiny quartz crystals called silicon."},
  {"start": 11.78, "end": 16.0, "text": "Humans figured out that if you melt sand down"},
  {"start": 16.0, "end": 18.5, "text": "and carve billions of microscopic switches into it,"},
  {"start": 18.5, "end": 20.95, "text": "you can trap electricity inside."},
  {"start": 20.95, "end": 23.48, "text": "When a switch is OFF, it means ZERO."},
  {"start": 23.48, "end": 25.67, "text": "When it flips ON, it means ONE."},
  {"start": 25.67, "end": 27.5, "text": "That is all a computer is:"},
  {"start": 27.5, "end": 30.96, "text": "a beach of sand with lightning flipping switches."},
  {"start": 30.96, "end": 34.0, "text": "So how on earth did we teach sand to think?"}
];

const project = {
  version: 1,
  style: 'B1',
  width: 1280,
  height: 720,
  fps: 30,
  voice: {path: 'narration.wav', lead: 0, tail: 0},
  captions,
  shots,
  sfx: sfx.sort((a, b) => a.time - b.time)
};

fs.writeFileSync(new URL('./project.json', import.meta.url), JSON.stringify(project, null, 2));
console.log(`Generated project.json: ${shots.length} shots, ${captions.length} captions, ${sfx.length} sfx.`);
