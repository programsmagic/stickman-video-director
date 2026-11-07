// Shot layout for EP06 ("What If You Could See Every Single Lie?").
// Writes project.json for the Autopilot renderer.
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

// ───────────── Opening 35.09 s Hook (the sample / preview) ─────────────
// S1 (0 - 7.57s) · "You wake up at seven in the morning and pour yourself a glass of water..."
shot(0, 7.57, [
  fig('you-sleepy', 420, 600, S, {to: 3.5}), fig('you-calm', 420, 600, S, {from: 3.5}),
  prop('mug', 450, 420, 100),
  popIn(text('7:00 AM', 100, 100, 56, {bold: true, color: BLUE}), 1.0),
  popIn(text('A QUIET MORNING IN THE KITCHEN', 100, 180, 42, {bold: true, color: GRAY}), 3.5),
]);
sfx.push({time: 0.2, kind: 'chime', gain: 0.12}, {time: 4.0, kind: 'pop', gain: 0.12});

// S2 (7.57 - 13.29s) · "Your roommate walks into the kitchen, rubs his eyes, and smiles. Morning..."
shot(7.57, 13.29, [
  fig('roommate', 880, 600, 0.62),
  fig('you-calm', 350, 600, S),
  popIn(text('"MORNING. SLEEP WELL?"', 550, 120, 44, {bold: true}), 1.5),
]);
sfx.push({time: 8.5, kind: 'pop', gain: 0.12});

// S3 (13.29 - 23.15s) · "Yeah, slept like a rock, you reply. And right above your lips, a bright crimson box flashes: Lie. Rated 84%."
shot(13.29, 23.15, [
  fig('you-amazed', 400, 600, S),
  fig('roommate', 880, 600, 0.62),
  popIn(text('[ LIE: 84% ]', 280, 150, 64, {bold: true, color: RED}), 3.6),
  popIn(text('CRIMSON TAG FLASHING', 280, 230, 42, {bold: true, color: RED}), 4.8),
]);
sfx.push({time: 14.0, kind: 'paper', gain: 0.1}, {time: 17.8, kind: 'chime', gain: 0.18});

// S4 (23.15 - 28.71s) · "You freeze. Your roommate looks at the breakfast you made and says, thanks, this tastes amazing."
shot(23.15, 28.71, [
  fig('you-shocked', 350, 600, S),
  fig('roommate-eating', 880, 600, 0.62),
  popIn(text('"THANKS, THIS TASTES AMAZING"', 480, 120, 42, {bold: true}), 2.0),
]);
sfx.push({time: 24.0, kind: 'pop', gain: 0.12});

// S5 (28.71 - 35.09s) · "Floating right above his mouth in bold red letters: Lie. He thinks it is cold and bland."
shot(28.71, 35.09, [
  fig('you-shocked', 350, 600, S),
  fig('roommate-eating', 880, 600, 0.62),
  popIn(text('[ LIE: COLD & BLAND ]', 620, 140, 56, {bold: true, color: RED}), 2.3),
  popIn(text('EVERY WORD IS VERIFIED', 120, 90, 48, {bold: true}), 3.5),
]);
sfx.push({time: 31.3, kind: 'chime', gain: 0.2});

// ───────────── Full film after the 35.09 s sample ─────────────
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
  const prev = scenes.at(-1)?.start ?? 35.09;
  scenes.push({start: snippet ? at(snippet, prev + 0.01) : 35.09, build});
}

const title = (t, x = 80, y = 55, size = 62, extra = {}) => text(t, x, y, size, {bold: true, ...extra});
const day = n => [title(`DAY ${n}`, 80, 40, 70, {color: RED}), {type: 'underline', x: 82, y: 118, w: 200, color: RED, keys: [{t: 0, progress: 0}, {t: 0.5, progress: 1}]}];

// Green for truth, crimson for deception
scene('For the next seven days,', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('absolute truth'), 'chime', 0.15); fx(r('deception'), 'pop', 0.15);
  return [
    fig('you-skeptic', 640, FEET, S),
    popIn(text('[ TRUTH: 100% ]', 160, 100, 56, {bold: true, color: GREEN}), r('absolute truth')),
    popIn(text('[ LIE: DECEPTION ]', 680, 100, 56, {bold: true, color: RED}), r('deception')),
    popIn(text('THE 7-DAY PERCEPTION EXPERIMENT', 250, 220, 46, {bold: true}), 2.0),
  ];
});

// Terrifying truth
scene('Instead, by day seven,', (r, fx) => {
  fx(0.1, 'chime', 0.14);
  return [
    fig('you-confused', 640, FEET, S),
    popIn(text('HONESTY DOES NOT SAVE RELATIONSHIPS', 120, 100, 48, {bold: true, color: RED}), r('save relationships')),
    popIn(text('KINDNESS DOES', 120, 180, 58, {bold: true, color: GREEN}), r('Kindness')),
    popIn(text('POLITE LIES PROTECT CIVILIZATION', 120, 280, 44, {bold: true, color: GRAY}), r('polite lies')),
  ];
});

// Day 1 & 2 - Meeting at work
scene('By noon on day one,', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('bonus'), 'chime', 0.16);
  return [
    ...day(1),
    fig('boss', 880, FEET, 0.65),
    fig('you-calm', 350, FEET, S),
    popIn(text('"APPRECIATE EVERYONE\'S EXTRA HOURS"', 380, 140, 42, {bold: true}), 2.0),
    popIn(text('[ LIE: ONLY CARES ABOUT HIS BONUS ]', 380, 210, 46, {bold: true, color: RED}), r('bonus')),
  ];
});

// Colleague whisper
scene('A colleague leans over and whispers,', (r, fx) => {
  fx(0.1, 'pop', 0.12); fx(r('single word'), 'chime', 0.14);
  return [
    fig('colleague-whisper', 860, FEET, 0.62),
    fig('you-nervous', 380, FEET, S),
    popIn(text('"YOUR PRESENTATION WAS FANTASTIC"', 420, 130, 42, {bold: true}), 1.5),
    popIn(text('[ LIE: DID NOT LISTEN TO A SINGLE WORD ]', 260, 210, 46, {bold: true, color: RED}), r('single word')),
  ];
});

// Feldman discovery
scene('Psychologist Robert Feldman discovered', (r, fx) => {
  fx(0.1, 'chime', 0.15);
  return [
    fig('you-think', 640, FEET, S),
    popIn(text('ROBERT FELDMAN RESEARCH', 140, 90, 52, {bold: true, color: BLUE}), 0.5),
    popIn(text('2 TO 3 LIES EVERY 10 MINUTES', 140, 170, 58, {bold: true, color: RED}), r('two to three lies')),
    popIn(text('RADICAL HONESTY IS PSYCHOLOGICAL WARFARE', 100, 280, 44, {bold: true}), r('psychological warfare')),
  ];
});

// Civilization survives on white lies (engine oil)
scene('Imagine if everyone said,', (r, fx) => {
  fx(0.1, 'paper', 0.12); fx(r('motor oil'), 'chime', 0.14);
  return [
    fig('you-skeptic', 350, FEET, S),
    popIn(text('"I AM BORED OF TALKING TO YOU"', 450, 120, 44, {bold: true, color: RED}), 1.0),
    popIn(text('"YOUR HAIRCUT LOOKS TERRIBLE"', 450, 200, 44, {bold: true, color: RED}), r('haircut')),
    popIn(text('WHITE LIES ARE SOCIAL MOTOR OIL', 200, 310, 48, {bold: true, color: GREEN}), r('motor oil')),
  ];
});

// Day 2 end - Terrified to speak
scene('By the end of your second day,', (r, fx) => {
  fx(0.1, 'pop', 0.12);
  return [
    ...day(2),
    fig('you-nervous', 640, FEET, S),
    popIn(text('TERRIFIED TO SPEAK', 200, 100, 56, {bold: true, color: RED}), 1.5),
    popIn(text('JUST TRYING TO SURVIVE THE INTERACTION', 120, 190, 46, {bold: true}), r('survive the interaction')),
  ];
});

// Day 4 - Deeper lies
scene('By day four,', (r, fx) => {
  fx(0.1, 'paper', 0.12); fx(r('tear you apart'), 'chime', 0.14);
  return [
    ...day(4),
    fig('you-sad', 640, FEET, S),
    popIn(text('THE DEEPER LIES', 200, 100, 58, {bold: true, color: RED}), 1.5),
    popIn(text('TEARING DOWN THE ILLUSION', 160, 190, 48, {bold: true}), r('tear you apart')),
  ];
});

// Friend at coffee
scene('You meet your closest friend for coffee.', (r, fx) => {
  fx(0.1, 'pop', 0.12); fx(r('cries himself'), 'chime', 0.16);
  return [
    fig('friend-confused', 850, FEET, 0.62),
    fig('you-calm', 350, FEET, S),
    popIn(text('"I\'M COMPLETELY OVER IT"', 450, 120, 44, {bold: true}), 2.5),
    popIn(text('[ LIE: CRIES HIMSELF TO SLEEP ]', 350, 200, 50, {bold: true, color: RED}), r('cries himself')),
  ];
});

// Not malice, shame
scene('Here, the crimson tag is not malice.', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('bleeding wounds'), 'chime', 0.14);
  return [
    fig('you-listen-close', 640, FEET, S),
    popIn(text('LIES BORN FROM SHAME, NOT MALICE', 120, 100, 50, {bold: true, color: BLUE}), 0.5),
    popIn(text('HIDING OUR BLEEDING WOUNDS', 160, 190, 52, {bold: true, color: RED}), r('bleeding wounds')),
  ];
});

// Friend tells the truth (promotion envy)
scene('are we good', (r, fx) => {
  fx(0.1, 'pop', 0.12); fx(r('One hundred percent'), 'chime', 0.2);
  return [
    fig('friend-vulnerable', 850, FEET, 0.62),
    fig('you-amazed', 350, FEET, S),
    popIn(text('"I WAS ENVIOUS OF YOUR PROMOTION"', 380, 120, 44, {bold: true}), 3.5),
    popIn(text('[ TRUTH: 100% ]', 480, 200, 60, {bold: true, color: GREEN}), r('One hundred percent')),
  ];
});

// Meeting without armor
scene('Hearing an ugly truth feels ten times', (r, fx) => {
  fx(0.1, 'chime', 0.16);
  return [
    fig('you-relieved', 640, FEET, S),
    popIn(text('AN UGLY TRUTH > A BEAUTIFUL LIE', 120, 90, 54, {bold: true, color: GREEN}), 0.5),
    popIn(text('A HUMAN BEING WITHOUT ARMOR', 150, 180, 52, {bold: true, color: BLUE}), r('without armor')),
  ];
});

// Day 6 - Looking in the mirror
scene('On the evening of day six,', (r, fx) => {
  fx(0.1, 'paper', 0.12);
  return [
    ...day(6),
    fig('you-calm', 640, FEET, S),
    popIn(text('5 DAYS OF JUDGING THE WORLD', 140, 100, 52, {bold: true}), 2.0),
    popIn(text('NOW COMES THE HARDEST TEST', 140, 180, 48, {bold: true, color: RED}), 4.5),
  ];
});

// Bathroom mirror self-lies
scene('So you walk into your bathroom.', (r, fx) => {
  fx(0.1, 'pop', 0.12); fx(r('Crimson flash'), 'chime', 0.16);
  return [
    prop('mirror', 780, 50, 380),
    fig('you-sad', 420, FEET, S),
    popIn(text('"I AM HAPPY WITH WHERE I AM"', 120, 100, 44, {bold: true}), 3.0),
    popIn(text('[ LIE ]', 260, 180, 64, {bold: true, color: RED}), r('Crimson flash')),
  ];
});

// Second self-lie
scene('I do not care what people think', (r, fx) => {
  fx(0.1, 'pop', 0.12); fx(r('forgiven'), 'chime', 0.16);
  return [
    prop('mirror', 780, 50, 380),
    fig('you-cry', 420, FEET, S),
    popIn(text('"I DON\'T CARE WHAT PEOPLE THINK" → [ LIE ]', 80, 100, 42, {bold: true, color: RED}), 0.5),
    popIn(text('"I HAVE FORGIVEN EVERYONE" → [ LIE ]', 80, 180, 42, {bold: true, color: RED}), r('forgiven')),
  ];
});

// Self-deception root
scene('The tears start running down your cheeks.', (r, fx) => {
  fx(0.1, 'chime', 0.14);
  return [
    fig('you-sad', 640, FEET, S),
    popIn(text('THE MOST DANGEROUS DECEIVER...', 140, 90, 50, {bold: true}), 1.5),
    popIn(text('WAS NEVER THEM. IT WAS YOU.', 140, 180, 56, {bold: true, color: RED}), r('It was you')),
  ];
});

// Speaking the truth to self
scene('You stare into the mirror and finally say', (r, fx) => {
  fx(0.1, 'pop', 0.12); fx(r('vanishes'), 'chime', 0.2);
  return [
    prop('mirror', 780, 50, 380),
    fig('you-calm', 420, FEET, S),
    popIn(text('"I AM TERRIFIED OF BEING ALONE."', 100, 100, 44, {bold: true}), 2.5),
    popIn(text('"AND I AM TRYING MY BEST."', 100, 170, 44, {bold: true}), 4.5),
    popIn(text('[ TRUTH: ABSOLUTE ]', 160, 270, 64, {bold: true, color: GREEN}), r('Absolute')),
  ];
});

// DAY 7 - Grand Series Finale Resolution
scene('Midnight arrives on the seventh day.', (r, fx) => {
  fx(0.1, 'chime', 0.2);
  return [
    title('SEASON 1 FINALE RESOLUTION', 80, 40, 60, {color: BLUE}),
    fig('you-relieved', 640, FEET, S),
    popIn(text('MIDNIGHT: THE POWERS DISSOLVE', 140, 120, 50, {bold: true}), 1.0),
  ];
});

// Recapping the 6 powers of Season 1
scene('Over the last six weeks,', (r, fx) => {
  fx(0.1, 'paper', 0.1); fx(r('karma'), 'chime', 0.12); fx(r('save points'), 'pop', 0.12);
  return [
    fig('you-calm', 300, FEET, S),
    popIn(text('1. SALARIES → WEALTH ≠ PEACE', 450, 80, 42, {bold: true}), 1.0),
    popIn(text('2. KARMA → MORALITY IS INTERNAL', 450, 150, 42, {bold: true}), r('karma')),
    popIn(text('3. WHISPERS → FREEDOM FROM APPROVAL', 450, 220, 42, {bold: true}), r('behind your back')),
    popIn(text('4. SAVE POINTS → MISTAKES MAKE LIFE', 450, 290, 42, {bold: true}), r('save points')),
    popIn(text('5. LIFESPANS → MORTALITY MAKES TODAY SACRED', 450, 360, 42, {bold: true, color: BLUE}), r('clocks of mortality')),
  ];
});

// The final moral
scene('seeing every lie', (r, fx) => {
  fx(0.1, 'chime', 0.18);
  return [
    fig('you-confident', 640, FEET, S),
    popIn(text('TRUTH WITHOUT EMPATHY IS CRUELTY', 100, 100, 50, {bold: true, color: RED}), r('cruelty')),
    popIn(text('HONESTY REQUIRES VULNERABILITY', 100, 200, 50, {bold: true, color: GREEN}), r('vulnerability')),
  ];
});

// The morning coffee with barista
scene('You step outside onto the morning sidewalk.', (r, fx) => {
  fx(0.1, 'pop', 0.12); fx(r('Thank you'), 'chime', 0.2);
  return [
    fig('barista', 880, FEET, 0.62),
    fig('you-smile', 350, FEET, S),
    prop('coffee', 580, 400, 110),
    popIn(text('"HAVE A WONDERFUL DAY"', 480, 120, 44, {bold: true}), 2.5),
    popIn(text('"THANK YOU." (ABSOLUTE TRUTH)', 200, 240, 52, {bold: true, color: GREEN}), r('Thank you')),
  ];
});

// Season 1 Complete Ending Card
scene('in your heart', (r, fx) => {
  fx(0.1, 'chime', 0.25);
  return [
    fig('you-grin', 640, FEET, S),
    popIn(title('SEASON 1 COMPLETE', 80, 50, 68, {color: GREEN}), 0.5),
    popIn(text('THANK YOU FOR WATCHING THE PERCEPTION SERIES', 80, 160, 44, {bold: true}), 1.5),
    popIn(text('SUBSCRIBE FOR SEASON 2: THE ANOMALY', 80, 260, 48, {bold: true, color: BLUE}), 3.0),
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
