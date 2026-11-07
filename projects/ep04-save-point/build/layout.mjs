// Shot layout for EP04. Writes project.json for the Autopilot renderer.
// Times are video seconds (narration time + LEAD). Run: node layout.mjs
import fs from 'node:fs';
import {execSync} from 'node:child_process';

const LEAD = 0.15, TAIL = 5;
const GREEN = '#2F8A4A', RED = '#EC4338', INK = '#191916', GRAY = '#7A8288', BLUE = '#3D7DD8';
// Figure PNGs are 700x1000 with drawing spanning y~190-905 and hip at x=350.
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
// S1 (0 - 5.5s) · "You wake up at seven in the morning, and floating in front of your chest is a translucent menu."
shot(0, 5.5, [
  prop('clock', 120, 80, 160),
  text('07:00 AM', 290, 150, 48, {bold: true, color: BLUE}),
  fig('you-sleepy', 850, 620, 0.62, {to: 2.2}), fig('you-amazed', 850, 620, 0.62, {from: 2.2}),
  popIn(text('SAVE POINT CREATED', 400, 260, 44, {bold: true, color: GREEN}), 2.8),
  popIn(text('DAY 1 · 07:00 AM', 450, 320, 32, {bold: true, color: GRAY}), 3.4),
]);
sfx.push({time: 0.2, kind: 'chime', gain: 0.15}, {time: 2.8, kind: 'pop', gain: 0.18});

// S2 (5.5 - 11.0s) · "Save point created. At first, you think you're still dreaming. You swipe your hand through it..."
shot(5.5, 11.0, [
  popIn(text('SAVE POINT CREATED', 400, 260, 44, {bold: true, color: GREEN}), 0),
  popIn(text('ELECTRIC HUM', 470, 320, 30, {bold: true, color: BLUE}), 4.5),
  fig('you-ear', 850, 620, 0.62),
]);
sfx.push({time: 6.0, kind: 'tap', gain: 0.14}, {time: 9.8, kind: 'paper', gain: 0.12});

// S3 (11.0 - 19.5s) · "Then small text appears beneath it: Tap your wrists together twice to reload."
shot(11.0, 19.5, [
  popIn(text('TAP WRISTS TWICE', 120, 100, 56, {bold: true, color: RED}), 2.5),
  {type: 'underline', x: 120, y: 170, w: 420, color: RED, keys: [{t: 2.6, progress: 0}, {t: 3.2, progress: 1}]},
  popIn(text('TO RELOAD', 120, 190, 48, {bold: true}), 3.5),
  fig('you-wrist-tap', 850, 620, 0.62),
]);
sfx.push({time: 14.7, kind: 'pop', gain: 0.14}, {time: 17.2, kind: 'chime', gain: 0.16});

// S4 (19.5 - 25.5s) · "You look out the window. The streets are moving, buses are running, the world is completely normal."
shot(19.5, 25.5, [
  prop('building', 80, 140, 300),
  prop('car', 420, 460, 240),
  fig('you-skeptic', 950, 620, 0.62),
  popIn(text('NORMAL WORLD.', 100, 70, 52, {bold: true}), 2.0),
]);
sfx.push({time: 21.3, kind: 'paper', gain: 0.1});

// S5 (25.5 - 30.35s) · "Except for you. For the next seven days, you have one active save point."
shot(25.5, 30.35, [
  text('7 DAYS.', 90, 60, 66, {bold: true}),
  prop('calendar', 90, 170, 560),
  popIn(text('ONE SAVE POINT.', 700, 120, 48, {bold: true, color: GREEN}), 1.2),
  popIn(text('ZERO CONSEQUENCES.', 660, 190, 42, {bold: true, color: RED}), 2.5),
  fig('you-amazed', 980, 620, 0.62),
]);
sfx.push({time: 26.6, kind: 'chime', gain: 0.15}, {time: 28.0, kind: 'pop', gain: 0.15});

// ───────────── Full film after the 30.0 s sample ─────────────
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
  const prev = scenes.at(-1)?.start ?? 30.0;
  scenes.push({start: snippet ? at(snippet, prev + 0.01) : 30.0, build});
}

const S = 0.62, FEET = 600;
const title = (t, x = 80, y = 55, size = 62, extra = {}) => text(t, x, y, size, {bold: true, ...extra});
const day = n => [title(`DAY ${n}`, 80, 40, 70, {color: RED}), {type: 'underline', x: 82, y: 118, w: 200, color: RED, keys: [{t: 0, progress: 0}, {t: 0.5, progress: 1}]}];

// Hook conclusion (30.5 - ~51s)
scene('No matter what happens', (r, fx) => {
  fx(0.1, 'pop', 0.1); fx(r('two taps') + 0.1, 'chime', 0.12);
  return [
    fig('you-wrist-tap', 640, FEET, S),
    popIn(text('BACK TO 07:00 AM', 200, 100, 52, {bold: true, color: BLUE}), r('two taps')),
    popIn(text('WITH ALL MEMORIES INTACT', 200, 170, 36, {bold: true, color: GRAY}), r('two taps') + 0.8),
  ];
});

scene('At first, it feels like godhood', (r, fx) => {
  fx(0.2, 'chime', 0.15); fx(r('terrifying prison'), 'pop', 0.15);
  return [
    fig('you-cape', 350, FEET, S, {to: r('terrifying prison')}),
    fig('you-nervous', 350, FEET, S, {from: r('terrifying prison')}),
    popIn(text('GODHOOD.', 750, 120, 64, {bold: true, color: GREEN}), 0.2),
    popIn(text('OR A PRISON?', 750, 200, 54, {bold: true, color: RED}), r('terrifying prison')),
  ];
});

// DAY 1 (from ~51s)
scene('At first, it\'s just pure', (r, fx) => {
  fx(0.1, 'paper', 0.1);
  return [...day(1), ...flip(fig('you-walk-a', 640, FEET, S), fig('you-walk-b', 640, FEET, S), 0, 60, 0.35), prop('building', 980, 150, 230), prop('building', 60, 190, 190)];
});

scene('At the coffee shop', (r, fx) => {
  fx(0.1, 'pop', 0.1); fx(r('They blush'), 'chime', 0.12);
  return [
    fig('salesman', 250, FEET, 0.55), prop('coffee', 310, 330, 60),
    fig('you-give', 800, FEET, S),
    popIn(text('NO FEAR.', 100, 80, 60, {bold: true, color: GREEN}), 1.5),
    popIn(text('GOT THE NUMBER', 450, 480, 38, {bold: true, color: GREEN}), r('They blush')),
  ];
});

scene('Then you see your boss', (r, fx) => {
  fx(r('face turns purple'), 'pop', 0.15); fx(r('tap your wrists'), 'chime', 0.15);
  return [
    fig('boss-sweat', 320, FEET, 0.65),
    fig('you-grin', 850, FEET, S, {to: r('tap your wrists')}),
    fig('you-wrist-tap', 850, FEET, S, {from: r('tap your wrists')}),
    popIn(text('"YOU\'RE FIRED!"', 100, 80, 58, {bold: true, color: RED}), r('screams')),
    popIn(text('RESET.', 850, 100, 64, {bold: true, color: BLUE}), r('tap your wrists')),
  ];
});

scene('Back in bed', (r, fx) => {
  fx(0.2, 'chime', 0.15);
  return [
    prop('clock', 120, 80, 160),
    text('07:00 AM', 290, 150, 48, {bold: true, color: BLUE}),
    fig('you-sleepy', 850, 620, 0.62),
    popIn(text('LIVING WITHOUT FEAR', 100, 300, 52, {bold: true}), 2.0),
    popIn(text('FEELS LIKE A SUPERPOWER', 100, 370, 44, {bold: true, color: GREEN}), 3.5),
  ];
});

// DAY 2 & 3 (from ~111s)
scene('By day two', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('three hundred percent'), 'chime', 0.15);
  return [
    ...day(2),
    prop('graph', 120, 160, 480),
    popIn(text('+300% NOON SPIKE', 140, 120, 46, {bold: true, color: GREEN}), r('three hundred percent')),
    fig('you-calm', 900, FEET, S),
  ];
});

scene('Until five o\'clock on day three.', (r, fx) => {
  fx(0.1, 'pop', 0.1); fx(r('Maximization Paralysis'), 'tap', 0.12);
  return [
    ...day(3),
    fig('you-nervous', 400, FEET, S),
    popIn(prop('pizza', 650, 250, 140), 2.0),
    popIn(text('PIZZA OR SUSHI?', 620, 150, 44, {bold: true}), 2.5),
    popIn(text('MAXIMIZATION PARALYSIS', 100, 480, 48, {bold: true, color: RED}), r('Maximization Paralysis')),
  ];
});

// DAY 4 & 5 (from ~188s)
scene('On day four', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('runs a red light'), 'pop', 0.15);
  return [
    ...day(4),
    prop('car', 200, 350, 320),
    prop('bike', 700, 380, 200),
    fig('you-shocked', 1050, FEET, S),
    popIn(text('CAR CRASH · 02:15 PM', 100, 80, 52, {bold: true, color: RED}), r('runs a red light')),
  ];
});

scene('You have seven hours', (r, fx) => {
  fx(0.1, 'chime', 0.12); fx(r('slammed directly into'), 'pop', 0.18);
  return [
    fig('you-walk-a', 300, FEET, S),
    fig('cyclist', 550, FEET, 0.6),
    popIn(text('DELAYED THE CYCLIST...', 100, 80, 48, {bold: true, color: GREEN}), 1.5),
    popIn(text('BUT THE VAN HIT THE BUS.', 100, 150, 52, {bold: true, color: RED}), r('slammed directly into')),
  ];
});

scene('In complex systems', (r, fx) => {
  fx(0.1, 'tap', 0.12);
  return [
    fig('you-skeptic', 640, FEET, S),
    popIn(text('CHAOS THEORY', 200, 120, 60, {bold: true, color: RED}), 0.5),
    popIn(text('ELIMINATING FRICTION DISPLACES ENERGY', 120, 200, 38, {bold: true}), 2.0),
    popIn(text('LIVED TUESDAY 19 TIMES', 220, 320, 46, {bold: true, color: GRAY}), 5.0),
  ];
});

// DAY 6 (from ~273s)
scene('On day six', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('heartfelt, honest'), 'chime', 0.12);
  return [
    ...day(6),
    fig('you-kind', 400, FEET, S),
    fig('friend-cry', 750, FEET, 0.62),
    prop('coffee', 560, 360, 60),
    popIn(text('DEEPEST HUMAN CONNECTION', 100, 80, 48, {bold: true, color: GREEN}), r('heartfelt, honest')),
  ];
});

scene('Then, right before you go to bed', (r, fx) => {
  fx(r('shatters across'), 'pop', 0.18); fx(r('tap your wrists'), 'chime', 0.15);
  return [
    prop('coffee-spill', 500, 450, 120),
    fig('you-shocked', 350, FEET, S, {to: r('tap your wrists')}),
    fig('you-wrist-tap', 350, FEET, S, {from: r('tap your wrists')}),
    popIn(text('BROKEN MUG.', 100, 80, 54, {bold: true, color: RED}), r('shatters')),
    popIn(text('JUST RELOAD.', 750, 120, 52, {bold: true, color: BLUE}), r('tap your wrists')),
  ];
});

scene('The mug is sitting safely', (r, fx) => {
  fx(0.1, 'chime', 0.12); fx(r('total confusion'), 'pop', 0.14);
  return [
    fig('you-amazed', 350, FEET, S),
    fig('friend-confused', 750, FEET, 0.62),
    popIn(text('"I NEVER SAID THAT."', 600, 100, 52, {bold: true, color: RED}), r('total confusion')),
    popIn(text('THE MEMORY WAS ERASED.', 100, 240, 48, {bold: true}), 4.0),
    popIn(text('YOU ARE COMPLETELY ALONE.', 100, 310, 46, {bold: true, color: GRAY}), 7.0),
  ];
});

// DAY 7 (from ~361s)
scene('Day seven arrives', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('Psychologist Carl Jung'), 'chime', 0.14);
  return [
    ...day(7),
    fig('you-calm', 640, FEET, S),
    popIn(text('SAVE POINT EXPIRES IN 5 MIN', 150, 100, 48, {bold: true, color: RED}), 1.0),
    popIn(text('"TO BE ALIVE IS TO BEAR TENSION"', 100, 200, 42, {bold: true, color: BLUE}), r('Psychologist Carl Jung')),
  ];
});

scene('The menu flashes', (r, fx) => {
  fx(0.1, 'pop', 0.14); fx(r('clock strikes twelve'), 'chime', 0.2);
  return [
    fig('you-relieved', 640, FEET, S),
    popIn(text('PROMPT DISSOLVES.', 220, 120, 56, {bold: true, color: GREEN}), r('clock strikes twelve')),
    popIn(text('LIFE IS UNCERTAIN. AND REAL.', 120, 220, 48, {bold: true}), r('clock strikes twelve') + 2.0),
  ];
});

scene('If you had one real-life save point', (r, fx) => {
  fx(0.1, 'chime', 0.15);
  return [
    fig('you-calm', 300, FEET, S),
    popIn(title('WHAT WOULD YOU DO?', 100, 70, 54, {color: RED}), 0.2),
    popIn(text('Would you fix a mistake...', 400, 220, 44, {bold: true}), 1.5),
    popIn(text('...or fear what you might erase?', 400, 300, 44, {bold: true, color: BLUE}), 3.5),
    popIn(text('DROP YOUR ANSWER BELOW', 350, 440, 42, {bold: true, color: GREEN}), 5.5),
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
