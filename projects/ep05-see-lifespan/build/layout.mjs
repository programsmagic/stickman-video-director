// Shot layout for EP05. Writes project.json for the Autopilot renderer.
// Times are video seconds (narration time + LEAD). Run: node layout.mjs
import fs from 'node:fs';
import {execSync} from 'node:child_process';

const LEAD = 0.15, TAIL = 5;
const GREEN = '#2F8A4A', RED = '#EC4338', INK = '#191916', GRAY = '#7A8288', BLUE = '#3D7DD8';
const FIG_TOP = 190, FIG_FEET = 905, FIG_CX = 350;
const S = 0.62, FEET = 600;

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

// ───────────── Opening 31.01 s Hook (the sample / preview) ─────────────
// S1 (0 - 6.81s) · "You wake up at midnight, look in the mirror, and the voices in your head are gone."
shot(0, 6.81, [
  prop('mirror', 760, 50, 380),
  fig('you-sleepy', 430, 600, 0.62, {to: 2.5}), fig('you-amazed', 430, 600, 0.62, {from: 2.5}),
  popIn(text('52Y : 184D : 14H', 100, 100, 52, {bold: true, color: BLUE}), 3.5),
  popIn(text('COUNTDOWN BEGINS', 100, 170, 42, {bold: true, color: GRAY}), 4.8),
]);
sfx.push({time: 0.2, kind: 'chime', gain: 0.12}, {time: 3.5, kind: 'pop', gain: 0.15});

// S2 (6.81 - 16.03s) · "Instead, ticking silently on your forehead is a luminous digital clock. Fifty-two years..."
shot(6.81, 16.03, [
  fig('you-amazed', 850, 600, 0.62),
  popIn(text('52 YEARS', 120, 90, 64, {bold: true, color: BLUE}), 1.8),
  popIn(text('COUNTING WITH EVERY HEARTBEAT', 120, 170, 38, {bold: true}), 4.0),
]);
sfx.push({time: 8.5, kind: 'paper', gain: 0.1}, {time: 12.0, kind: 'tap', gain: 0.12});

// S3 (16.03 - 21.85s) · "You touch your brow. Cold skin. But the digits remain. You step out onto your balcony."
shot(16.03, 21.85, [
  prop('building', 80, 140, 300),
  fig('you-skeptic', 920, 600, 0.62),
  popIn(text('BALCONY VIEW', 120, 90, 48, {bold: true}), 2.0),
]);
sfx.push({time: 16.5, kind: 'pop', gain: 0.12});

// S4 (21.85 - 27.39s) · "A street cleaner is sweeping autumn leaves. Above his head: four years, two months."
shot(21.85, 27.39, [
  fig('you-calm', 300, 600, S),
  popIn(text('STREET CLEANER: 4 YEARS', 450, 120, 44, {bold: true, color: GRAY}), 1.5),
  popIn(text('TEENAGER: 68 YEARS', 450, 200, 48, {bold: true, color: GREEN}), 4.0),
]);
sfx.push({time: 23.0, kind: 'paper', gain: 0.1}, {time: 25.5, kind: 'chime', gain: 0.12});

// S5 (27.39 - 31.01s) · "A teenager laughs on a skateboard: sixty-eight years."
shot(27.39, 31.01, [
  text('EVERYONE HAS A CLOCK.', 100, 80, 52, {bold: true}),
  popIn(text('COUNTING DOWN.', 100, 160, 48, {bold: true, color: RED}), 1.5),
  fig('you-amazed', 950, 600, 0.62),
]);
sfx.push({time: 28.0, kind: 'chime', gain: 0.14});

// ───────────── Full film after the 31.01 s sample ─────────────
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
  const prev = scenes.at(-1)?.start ?? 31.01;
  scenes.push({start: snippet ? at(snippet, prev + 0.01) : 31.01, build});
}

const title = (t, x = 80, y = 55, size = 62, extra = {}) => text(t, x, y, size, {bold: true, ...extra});
const day = n => [title(`DAY ${n}`, 80, 40, 70, {color: RED}), {type: 'underline', x: 82, y: 118, w: 200, color: RED, keys: [{t: 0, progress: 0}, {t: 0.5, progress: 1}]}];

// The jogger with 1h 14m
scene('And then you see a young,', (r, fx) => {
  fx(0.1, 'pop', 0.12); fx(r('Zero years') + 0.1, 'chime', 0.16);
  return [
    fig('jogger', 300, FEET, 0.65),
    fig('you-shocked', 850, FEET, S),
    popIn(text('00Y : 00D : 01H : 14M', 150, 100, 52, {bold: true, color: RED}), r('Zero years')),
    popIn(text('GLOWING DARK RED', 200, 180, 44, {bold: true, color: RED}), r('Zero years') + 1.0),
  ];
});

scene('At first, your instinct is sheer panic.', (r, fx) => {
  fx(0.1, 'paper', 0.1);
  return [
    ...day(1),
    fig('you-nervous', 400, FEET, S),
    popIn(text('INVISIBLE TRAPDOORS', 550, 150, 50, {bold: true, color: RED}), 1.0),
  ];
});

scene('At the subway station,', (r, fx) => {
  fx(0.1, 'pop', 0.1); fx(r('worthless'), 'chime', 0.12);
  return [
    fig('you-skeptic', 640, FEET, S),
    popIn(text('SUBWAY COMMUTE', 150, 80, 52, {bold: true}), 0.5),
    popIn(text('60 YEARS LEFT = ZERO URGENCY', 100, 170, 44, {bold: true, color: GRAY}), 3.0),
    popIn(text('WHEN TIME FEELS INFINITE, IT FEELS CHEAP', 80, 270, 42, {bold: true, color: RED}), r('worthless')),
  ];
});

scene('Roman philosopher Seneca wrote', (r, fx) => {
  fx(0.1, 'chime', 0.14);
  return [
    fig('you-calm', 640, FEET, S),
    popIn(text('SENECA (2,000 YEARS AGO)', 140, 100, 52, {bold: true, color: BLUE}), 0.5),
    popIn(text('"YOU LIVE AS IF DESTINED TO LIVE FOREVER"', 80, 200, 42, {bold: true}), 2.5),
  ];
});

// DAY 2 & 3
scene('On day two', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('truck'), 'pop', 0.15);
  return [
    ...day(2),
    prop('car', 250, 360, 300),
    fig('you-sad', 850, FEET, S),
    popIn(text('NEWS REPORT: 01:15 AM', 100, 80, 50, {bold: true, color: RED}), 1.0),
    popIn(text('IT WASN\'T A WARNING. IT WAS A FACT.', 100, 160, 42, {bold: true}), r('truck')),
  ];
});

scene('By day three', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('two days'), 'pop', 0.14);
  return [
    ...day(3),
    fig('courier', 300, FEET, 0.6),
    fig('you-nervous', 850, FEET, S),
    popIn(text('COURIER: 2 DAYS LEFT', 150, 100, 52, {bold: true, color: RED}), r('two days')),
    popIn(text('DO YOU WARN HIM?', 200, 180, 46, {bold: true}), r('two days') + 2.0),
  ];
});

scene('Psychologists call this Terror Management Theory:', (r, fx) => {
  fx(0.1, 'tap', 0.12);
  return [
    fig('you-calm', 640, FEET, S),
    popIn(text('TERROR MANAGEMENT THEORY', 120, 100, 54, {bold: true, color: BLUE}), 0.5),
    popIn(text('ROUTINES SUPPRESS MORTALITY AWARENESS', 100, 190, 40, {bold: true}), 2.5),
    popIn(text('PREMATURE GRIEF', 240, 310, 48, {bold: true, color: RED}), 6.0),
  ];
});

// DAY 4 & 5 — The Library Intervention
scene('On day four', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('thirty-five minutes'), 'chime', 0.12);
  return [
    ...day(4),
    fig('student', 300, FEET, 0.6),
    fig('you-listen-close', 850, FEET, S),
    popIn(text('STUDENT: 35 MINUTES LEFT', 150, 100, 50, {bold: true, color: RED}), r('thirty-five')),
  ];
});

scene('She steps onto the crosswalk.', (r, fx) => {
  fx(0.1, 'pop', 0.15);
  return [
    fig('you-shocked', 350, FEET, S),
    fig('student', 700, FEET, 0.6),
    popIn(text('SABOTAGED THE ACCIDENT', 120, 80, 52, {bold: true, color: GREEN}), 1.5),
  ];
});

scene('You look at her forehead.', (r, fx) => {
  fx(0.1, 'chime', 0.14); fx(r('Sixteen minutes'), 'pop', 0.16);
  return [
    fig('you-sad', 640, FEET, S),
    popIn(text('SHIFTED BY 16 MINUTES', 180, 100, 54, {bold: true, color: RED}), r('Sixteen')),
    popIn(text('YOU MERELY POSTPONED IT', 180, 190, 46, {bold: true}), r('Sixteen') + 2.0),
    popIn(text('CANNOT OUTSMART THE LEDGER', 140, 310, 48, {bold: true, color: GRAY}), 6.0),
  ];
});

// DAY 6 — Parents' Kitchen
scene('On day six', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('three years'), 'chime', 0.14);
  return [
    ...day(6),
    fig('mum-kitchen', 250, FEET, 0.6),
    fig('dad-crossword', 500, FEET, 0.6),
    fig('you-kind', 900, FEET, S),
    popIn(text('MOM: 7 YEARS · DAD: 3 YEARS', 100, 80, 48, {bold: true, color: BLUE}), 2.0),
  ];
});

scene('Standing in that kitchen,', (r, fx) => {
  fx(0.1, 'pop', 0.12); fx(r('Six'), 'chime', 0.16);
  return [
    fig('you-calm', 640, FEET, S),
    popIn(text('THE BRUTAL ARITHMETIC:', 180, 100, 52, {bold: true, color: RED}), 0.5),
    popIn(text('2 VISITS PER YEAR = ONLY 6 MORE VISITS', 80, 190, 44, {bold: true}), 2.5),
    popIn(text('THE PRESENT IS WHERE LOVE LIVES', 120, 310, 46, {bold: true, color: GREEN}), 6.0),
  ];
});

// DAY 7 — The Frame of the Painting
scene('Day seven arrives.', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('reverence'), 'chime', 0.15);
  return [
    ...day(7),
    fig('you-calm', 640, FEET, S),
    popIn(text('MIDNIGHT MIRROR', 220, 100, 54, {bold: true, color: BLUE}), 0.5),
    popIn(text('FEAR IS GONE. REVERENCE REMAINS.', 100, 190, 44, {bold: true}), 2.5),
  ];
});

scene('A painting is only beautiful because', (r, fx) => {
  fx(0.1, 'chime', 0.16);
  return [
    fig('you-kind', 640, FEET, S),
    popIn(text('A PAINTING NEEDS A FRAME', 160, 100, 54, {bold: true, color: GREEN}), 0.5),
    popIn(text('MUSIC ONLY HURTS BECAUSE IT ENDS', 120, 190, 44, {bold: true}), 2.5),
    popIn(text('LOVE BURNS BECAUSE LOSS IS REAL', 140, 290, 44, {bold: true, color: BLUE}), 5.0),
  ];
});

scene('The digital clock reaches eleven', (r, fx) => {
  fx(0.1, 'pop', 0.15); fx(r('dissolve'), 'chime', 0.2);
  return [
    fig('you-relieved', 640, FEET, S),
    popIn(text('11:59:59... DISSOLVED.', 180, 100, 54, {bold: true, color: GREEN}), r('dissolve')),
    popIn(text('NO SPOILERS. NO COUNTDOWN.', 160, 190, 46, {bold: true}), r('dissolve') + 2.0),
    popIn(text('THE ONLY DAY THAT MATTERS IS TODAY', 100, 310, 44, {bold: true, color: BLUE}), r('dissolve') + 4.5),
  ];
});

// Season Finale teaser
scene('Tomorrow, the countdown disappears.', (r, fx) => {
  fx(0.1, 'chime', 0.2);
  return [
    fig('you-amazed', 350, FEET, S),
    popIn(title('SEASON 1 FINALE TEASER', 100, 60, 52, {color: RED}), 0.5),
    popIn(text('WHAT IF YOU COULD SEE...', 450, 180, 50, {bold: true}), 1.5),
    popIn(text('EVERY SINGLE LIE?', 450, 260, 60, {bold: true, color: RED}), r('lie')),
    popIn(text('SUBSCRIBE FOR THE FINALE', 450, 380, 46, {bold: true, color: GREEN}), r('Subscribe')),
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
