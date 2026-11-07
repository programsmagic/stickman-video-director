// Shot layout for EP03. Writes project.json for the Autopilot renderer.
// Times are video seconds (narration time + LEAD). Run: node layout.mjs
import fs from 'node:fs';
import {execSync} from 'node:child_process';

const LEAD = 0.15, TAIL = 5;
const GREEN = '#2F8A4A', RED = '#EC4338', INK = '#191916', GRAY = '#7A8288', BLUE = '#3D7DD8';
const FIG_TOP = 190, FIG_FEET = 905, FIG_CX = 350;

function fig(name, cx, feetY, scale, extra = {}) {
  return {type: 'image', path: `art/${name}.png`, x: Math.round(cx - FIG_CX * scale), y: Math.round(feetY - FIG_FEET * scale), w: Math.round(700 * scale), ...extra};
}
const headTop = (feetY, scale) => feetY - (FIG_FEET - FIG_TOP) * scale;
const prop = (name, x, y, w, extra = {}) => ({type: 'image', path: `art/${name}.png`, x, y, w, ...extra});
const text = (t, x, y, size, extra = {}) => ({type: 'text', text: t, x, y, size, ...extra});
const popIn = (layer, at) => ({...layer, from: at, keys: [{t: at, y: layer.y + 18, alpha: 0}, {t: at + 0.25, y: layer.y, alpha: 1}]});
function flip(a, b, t0, t1, step) {
  const out = [];
  for (let t = t0, i = 0; t < t1; t += step, i++) out.push({...(i % 2 ? b : a), from: +t.toFixed(3), to: +Math.min(t + step, t1).toFixed(3)});
  return out;
}

const shots = [];
const sfx = [];
const shot = (start, end, layers) => shots.push({start, end, layers});

// ───────────── Opening 30.5 s Hook (the sample / preview) ─────────────
// S1 (0 - 5.0s) · "You wake up, and the glowing numbers are gone. Your head feels quiet. Normal, even."
shot(0, 5.0, [
  prop('mirror', 760, 50, 380),
  fig('you-sleepy', 430, 600, 0.62, {to: 2.5}), fig('you-calm', 430, 600, 0.62, {from: 2.5}),
  popIn(text('NO NUMBERS.', 100, 100, 56, {bold: true, color: GREEN}), 1.0),
  popIn(text('QUIET. NORMAL.', 100, 180, 48, {bold: true, color: GRAY}), 3.0),
]);
sfx.push({time: 0.2, kind: 'chime', gain: 0.12}, {time: 2.6, kind: 'paper', gain: 0.1});

// S2 (5.0 - 12.0s) · "Until you step out of your bedroom, close the front door, and take two steps down the hallway."
shot(5.0, 12.0, [
  prop('door', 250, 140, 220),
  ...flip(fig('you-walk-a', 750, 600, 0.62), fig('you-walk-b', 750, 600, 0.62), 0, 7.0, 0.35),
  popIn(text('HALLWAY.', 100, 80, 52, {bold: true}), 2.0),
  popIn(text('TWO STEPS AWAY...', 100, 150, 44, {bold: true, color: BLUE}), 4.5),
]);
sfx.push({time: 5.5, kind: 'tap', gain: 0.12}, {time: 9.5, kind: 'pop', gain: 0.14});

// S3 (12.0 - 20.5s) · "A voice. Faint, clear, and right in your ear. Your roommate, talking inside..."
shot(12.0, 20.5, [
  fig('you-ear', 850, 600, 0.62),
  fig('roommate', 250, 600, 0.60),
  popIn(text('"DID HE WEAR THAT SCARF AGAIN?"', 150, 100, 42, {bold: true, color: RED}), 2.0),
  popIn(text('A VOICE IN YOUR EAR', 250, 180, 46, {bold: true, color: BLUE}), 4.5),
]);
sfx.push({time: 12.5, kind: 'pop', gain: 0.16}, {time: 16.5, kind: 'chime', gain: 0.14});

// S4 (20.5 - 25.0s) · "You freeze. You didn't leave your phone on. You don't have an earpiece in."
shot(20.5, 25.0, [
  fig('you-shocked', 640, 600, 0.62),
  popIn(text('NO PHONE ON.', 120, 100, 54, {bold: true, color: RED}), 0.8),
  popIn(text('NO EARPIECE.', 120, 180, 54, {bold: true, color: RED}), 2.2),
]);
sfx.push({time: 21.0, kind: 'tap', gain: 0.12}, {time: 23.0, kind: 'paper', gain: 0.12});

// S5 (25.0 - 30.63s) · "For the next seven days, whenever you leave a room, you can hear every single sentence spoken about you."
shot(25.0, 30.63, [
  text('7 DAYS.', 90, 60, 66, {bold: true}),
  prop('calendar', 90, 170, 560),
  popIn(text('EVERY WHISPER.', 680, 120, 52, {bold: true, color: RED}), 1.2),
  popIn(text('EVERY SENTENCE.', 680, 190, 44, {bold: true, color: BLUE}), 2.8),
  fig('you-listen-close', 980, 600, 0.62),
]);
sfx.push({time: 25.5, kind: 'chime', gain: 0.15}, {time: 28.0, kind: 'pop', gain: 0.15});

// ───────────── Full film after the 30.63 s sample ─────────────
const CAP = JSON.parse(fs.readFileSync(new URL('./captions.json', import.meta.url)));
const VOICE = Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${new URL('./narration.wav', import.meta.url).pathname}"`));
const END = +(VOICE + LEAD + TAIL).toFixed(3);

function at(snippet, after = 0) {
  const c = CAP.find(c => c.start >= after - 0.05 && c.text.toLowerCase().includes(snippet.toLowerCase()));
  if (!c) throw new Error(`No caption "${snippet}" after ${after}`);
  return c.start;
}

const scenes = [];
function scene(snippet, build) {
  const prev = scenes.at(-1)?.start ?? 30.63;
  scenes.push({start: snippet ? at(snippet, prev + 0.01) : 30.63, build});
}

const S = 0.62, FEET = 600;
const title = (t, x = 80, y = 55, size = 62, extra = {}) => text(t, x, y, size, {bold: true, ...extra});
const day = n => [title(`DAY ${n}`, 80, 40, 70, {color: RED}), {type: 'underline', x: 82, y: 118, w: 200, color: RED, keys: [{t: 0, progress: 0}, {t: 0.5, progress: 1}]}];

// Hook conclusion: Your friends, coworkers, subway stranger, change how you treat people
scene('Your friends.', (r, fx) => {
  fx(0.1, 'pop', 0.1); fx(r('subway') + 0.1, 'chime', 0.12);
  return [
    fig('subway-rider', 300, FEET, 0.6),
    fig('you-listen-close', 800, FEET, S),
    popIn(text('FRIENDS. COWORKERS.', 100, 80, 48, {bold: true}), 0.2),
    popIn(text('STRANGERS ON SUBWAY', 100, 150, 48, {bold: true, color: BLUE}), r('subway')),
  ];
});

scene('And by day seven,', (r, fx) => {
  fx(0.2, 'chime', 0.14);
  return [
    fig('you-calm', 640, FEET, S),
    popIn(text('THE QUIETEST WHISPER', 180, 120, 54, {bold: true, color: RED}), 0.5),
    popIn(text('WILL CHANGE YOUR LIFE', 180, 200, 48, {bold: true}), 2.0),
  ];
});

// DAY 1 — Coffee shop & Spotlight effect
scene('At first, your heart pounds', (r, fx) => {
  fx(0.1, 'paper', 0.1);
  return [...day(1), fig('you-nervous', 400, FEET, S), popIn(text('WHAT DO PEOPLE SAY?', 550, 150, 48, {bold: true, color: RED}), 1.0)];
});

scene('You step outside the coffee shop.', (r, fx) => {
  fx(0.1, 'pop', 0.1); fx(r('They\'re not mocking you'), 'chime', 0.12);
  return [
    fig('salesman', 250, FEET, 0.55), prop('coffee', 310, 330, 60),
    fig('you-skeptic', 850, FEET, S),
    popIn(text('"COOL WIZARD HAT."', 200, 80, 48, {bold: true, color: GREEN}), 1.2),
    popIn(text('NOT MOCKING YOU.', 200, 160, 52, {bold: true}), r('mocking')),
  ];
});

scene('Psychologists call this the spotlight effect.', (r, fx) => {
  fx(0.1, 'paper', 0.12);
  return [
    fig('you-calm', 640, FEET, S),
    popIn(text('THE SPOTLIGHT EFFECT', 160, 100, 56, {bold: true, color: BLUE}), 0.5),
    popIn(text('PEOPLE NOTICE YOU 50% LESS THAN YOU THINK', 100, 200, 36, {bold: true}), 2.5),
    popIn(text('AN EXTRA IN EVERYONE ELSE\'S MOVIE', 120, 320, 44, {bold: true, color: GRAY}), 5.0),
  ];
});

// DAY 2 — The Office & Kevin
scene('Then day two arrives,', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('jaw drops'), 'chime', 0.14);
  return [
    ...day(2),
    prop('desk', 250, 380, 320),
    fig('you-amazed', 850, FEET, S),
    popIn(text('KEVIN IN THE BREAK ROOM', 100, 80, 48, {bold: true}), 1.0),
    popIn(text('"MAGI DESERVES THE CREDIT."', 150, 160, 46, {bold: true, color: GREEN}), r('jaw drops')),
  ];
});

scene('Researchers who study workplace', (r, fx) => {
  fx(0.1, 'tap', 0.12);
  return [
    fig('you-kind', 640, FEET, S),
    popIn(text('WORKPLACE PSYCHOLOGY', 180, 100, 52, {bold: true, color: BLUE}), 0.5),
    popIn(text('COWORKERS DEFEND YOU IN SILENCE', 140, 190, 42, {bold: true}), 2.5),
  ];
});

// DAY 3 & 4 — Social grooming & Evolution
scene('On day three,', (r, fx) => {
  fx(0.1, 'paper', 0.1);
  return [...day(3), fig('you-listen-close', 500, FEET, S), popIn(text('LISTENING TO SUBWAY WHISPERS', 150, 100, 46, {bold: true}), 1.0)];
});

scene('On day four,', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('social grooming'), 'chime', 0.12);
  return [
    ...day(4),
    fig('you-skeptic', 640, FEET, S),
    popIn(text('GOSSIP IS SOCIAL GROOMING', 140, 100, 54, {bold: true, color: RED}), 0.5),
    popIn(text('ANCIENT TRIBES USED IT TO SURVIVE', 140, 190, 40, {bold: true}), 3.0),
  ];
});

// DAY 6 — The Boss defends you
scene('On day six,', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('heart sinks'), 'pop', 0.15);
  return [
    ...day(6),
    fig('you-sad', 850, FEET, S),
    popIn(text('"SOMEONE ELSE ON THIS ACCOUNT."', 100, 100, 46, {bold: true, color: RED}), 1.5),
    popIn(text('HEART SINKS.', 100, 180, 52, {bold: true, color: RED}), r('heart sinks')),
  ];
});

scene('And then another voice speaks.', (r, fx) => {
  fx(0.1, 'chime', 0.15); fx(r('boss'), 'pop', 0.15);
  return [
    fig('boss-sweat', 300, FEET, 0.65),
    fig('you-amazed', 850, FEET, S),
    popIn(text('"THAT\'S NOT FAIR."', 150, 80, 56, {bold: true, color: GREEN}), 0.5),
    popIn(text('YOUR BOSS DEFENDS YOU.', 150, 160, 48, {bold: true, color: BLUE}), 2.0),
    popIn(text('NO AUDIENCE. NO KARMA SCORE.', 150, 240, 40, {bold: true, color: GRAY}), 5.0),
  ];
});

scene('There is no praise on earth sweeter', (r, fx) => {
  fx(0.1, 'chime', 0.15);
  return [
    fig('you-calm', 640, FEET, S),
    popIn(text('SWEETEST PRAISE ON EARTH', 140, 120, 54, {bold: true, color: GREEN}), 0.5),
    popIn(text('THE PRAISE YOU WERE NEVER MEANT TO HEAR', 100, 210, 40, {bold: true}), 2.5),
  ];
});

// DAY 7 — Deliberately not listening & The Lifespan cliffhanger
scene('On day seven,', (r, fx) => {
  fx(0.1, 'paper', 0.1);
  return [
    ...day(7),
    ...flip(fig('you-walk-a', 640, FEET, S), fig('you-walk-b', 640, FEET, S), 0, 60, 0.35),
    popIn(text('DELIBERATELY NOT LISTENING', 140, 100, 50, {bold: true, color: BLUE}), 1.0),
    popIn(text('PEACE SETTLES IN', 140, 180, 46, {bold: true, color: GREEN}), 4.0),
  ];
});

scene('At 11:59 p.m.,', (r, fx) => {
  fx(0.1, 'pop', 0.14); fx(r('silence'), 'chime', 0.15);
  return [
    prop('clock', 120, 80, 160),
    text('11:59 PM', 290, 150, 48, {bold: true, color: RED}),
    fig('you-relieved', 850, 620, 0.62),
    popIn(text('SUPERPOWER IS GONE.', 100, 320, 52, {bold: true}), 2.0),
  ];
});

scene('So tomorrow morning,', (r, fx) => {
  fx(0.1, 'chime', 0.15);
  return [
    fig('you-kind', 640, FEET, S),
    popIn(text('TRUE MEASURE OF FRIENDSHIP:', 120, 100, 52, {bold: true, color: GREEN}), 0.5),
    popIn(text('WHO DEFENDS YOUR NAME IN AN EMPTY ROOM', 100, 200, 42, {bold: true}), 2.5),
  ];
});

scene('Tomorrow, the silence continues.', (r, fx) => {
  fx(0.1, 'pop', 0.15); fx(r('lifespan'), 'chime', 0.2);
  return [
    fig('you-shocked', 350, FEET, S),
    popIn(title('WHAT IF YOU COULD SEE...', 100, 60, 52, {color: RED}), 0.5),
    popIn(text('EVERYONE\'S LIFESPAN?', 450, 180, 56, {bold: true, color: RED}), r('lifespan')),
    popIn(text('SUBSCRIBE FOR EPISODE 5', 450, 320, 46, {bold: true, color: GREEN}), r('subscribe')),
  ];
});

scenes.forEach((sc, i) => {
  const start = +sc.start.toFixed(3), end = i + 1 < scenes.length ? +scenes[i + 1].start.toFixed(3) : END;
  const r = snippet => {
    try {
      return +(at(snippet, start) - start).toFixed(3);
    } catch {
      return 1.0;
    }
  };
  const fx = (rel, kind, gain) => sfx.push({time: +(start + rel).toFixed(3), kind, gain});
  const span = Math.floor((end - start) * 1000) / 1000;
  const layers = sc.build(r, fx)
    .filter(l => (l.from ?? 0) < span - 0.01)
    .map(l => (l.to !== undefined && l.to > span ? {...l, to: span} : l))
    .filter(l => l.to === undefined || l.to > (l.from ?? 0));
  shot(start, end, layers);
});

// Hat lift
const HAT_LIFT = 78;
for (const sh of shots) {
  const magi = sh.layers.filter(l => /^art\/you-/.test(l.path || '')).map(l => ({cx: l.x + l.w / 2, top: l.y + 190 * l.w / 700, s: l.w / 700}));
  for (const l of sh.layers) {
    if (l.type !== 'text') continue;
    const mid = l.x + l.text.length * (l.size || 52) * 0.26;
    const m = magi.find(f => Math.abs(f.cx - mid) < 140 && l.y < f.top);
    if (!m) continue;
    const dy = Math.round(HAT_LIFT * m.s);
    l.y -= dy; if (l.keys) l.keys = l.keys.map(k => (k.y !== undefined ? {...k, y: k.y - dy} : k));
  }
}

const captions = JSON.parse(fs.readFileSync(new URL('./captions.json', import.meta.url)));
const project = {
  version: 1, style: 'B1', width: 1280, height: 720, fps: 30,
  voice: {path: 'narration.wav', lead: LEAD, tail: TAIL},
  captions, shots, sfx: sfx.sort((a, b) => a.time - b.time),
};
fs.writeFileSync(new URL('./project.json', import.meta.url), JSON.stringify(project, null, 1));
console.log(`${shots.length} shots, ${captions.length} captions, ${sfx.length} sfx, shots end ${shots.at(-1).end}s`);

