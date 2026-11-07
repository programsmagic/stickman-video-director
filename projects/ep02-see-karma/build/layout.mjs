// Shot layout for EP02. Writes project.json for the Autopilot renderer.
// Times are video seconds (narration time + LEAD). Run: node layout.mjs
import fs from 'node:fs';
import {execSync} from 'node:child_process';

const LEAD = 0.15, TAIL = 5;
const GREEN = '#2F8A4A', RED = '#EC4338', INK = '#191916', GRAY = '#7A8288';
// Figure PNGs are 700×1000 with the drawing spanning y≈190–905 and the hip at x=350.
const FIG_TOP = 190, FIG_FEET = 905, FIG_CX = 350;

function fig(name, cx, feetY, scale, extra = {}) {
  return {type: 'image', path: `art/${name}.png`, x: Math.round(cx - FIG_CX * scale), y: Math.round(feetY - FIG_FEET * scale), w: Math.round(700 * scale), ...extra};
}
const headTop = (feetY, scale) => feetY - (FIG_FEET - FIG_TOP) * scale;
const prop = (name, x, y, w, extra = {}) => ({type: 'image', path: `art/${name}.png`, x, y, w, ...extra});
const text = (t, x, y, size, extra = {}) => ({type: 'text', text: t, x, y, size, ...extra});
// Pop-in: rise 18 units and fade in over 0.25 s.
const popIn = (layer, at) => ({...layer, from: at, keys: [{t: at, y: layer.y + 18, alpha: 0}, {t: at + 0.25, y: layer.y, alpha: 1}]});
// Alternate two drawings every `step` seconds between t0 and t1 (hand-drawn flipbook).
function flip(a, b, t0, t1, step) {
  const out = [];
  for (let t = t0, i = 0; t < t1; t += step, i++) out.push({...(i % 2 ? b : a), from: +t.toFixed(3), to: +Math.min(t + step, t1).toFixed(3)});
  return out;
}

const shots = [];
const sfx = [];
const shot = (start, end, layers) => shots.push({start, end, layers});

// ───────────── Opening 30.5 s Hook (the sample / preview) ─────────────
// S1 · "You wake up, look in the mirror, and there's a number above your head again."
{
  const refl = 0.42, sw = 2.05;
  shot(0, 5.0, [
    prop('mirror', 760, 50, 380),
    fig('you-sleepy', 430, 600, 0.62, {to: sw}), fig('you-startled', 430, 600, 0.62, {from: sw}),
    fig('you-sleepy-m', 950, 515, refl, {to: sw}), fig('you-startled-m', 950, 515, refl, {from: sw}),
    prop('sink', 800, 400, 300),
    popIn(text('+73', 900, Math.round(headTop(515, refl)) - 62, 48, {bold: true, color: GREEN}), 2.3),
  ]);
  sfx.push({time: 2.35, kind: 'pop', gain: 0.18});
}

// S2 · "But this time, it isn't money. Plus seventy-three. It's your karma."
{
  const a = fig('you-swat-a', 950, 600, 0.62), b = fig('you-swat-b', 950, 600, 0.62);
  shot(5.0, 10.5, [
    popIn(text("NOT MONEY.", 100, 80, 54, {bold: true, color: RED}), 0.5),
    popIn(text('+73', 100, 160, 110, {bold: true, color: GREEN}), 2.6),
    {type: 'underline', x: 105, y: 295, w: 220, color: GREEN, keys: [{t: 2.7, progress: 0}, {t: 3.4, progress: 1}]},
    popIn(text("YOUR KARMA.", 100, 320, 58, {bold: true}), 4.3),
    text('+73', 885, Math.round(headTop(600, 0.62)) - 60, 38, {bold: true, color: GREEN}),
    {...a, to: 0.6}, ...flip(b, a, 0.6, 5.5, 0.24),
  ]);
  sfx.push({time: 5.6, kind: 'paper', gain: 0.12}, {time: 7.7, kind: 'chime', gain: 0.14}, {time: 9.4, kind: 'tap', gain: 0.12});
}

// S3 · "Every kind thing you've ever done, minus every cruel one, added into a single score."
{
  shot(10.5, 16.5, [
    text('EVERY KIND THING.', 80, 60, 48, {bold: true, color: GREEN}),
    popIn(text('MINUS EVERY CRUEL ONE.', 80, 125, 42, {bold: true, color: RED}), 2.3),
    prop('scale-tip', 460, 210, 320),
    fig('you-think', 200, 600, 0.58),
    popIn(prop('heart', 440, 200, 70), 0.8),
    popIn(text('SINGLE SCORE: +73', 820, 320, 42, {bold: true, color: GREEN, w: 420}), 4.2),
  ]);
  sfx.push({time: 11.3, kind: 'tap', gain: 0.1}, {time: 12.9, kind: 'tap', gain: 0.1}, {time: 14.8, kind: 'chime', gain: 0.12});
}

// S4 · "Everyone has one."
{
  const s = 0.5, top = Math.round(headTop(600, s)) - 52;
  const ppl = [['shouter', 200, '-38', RED], ['salesman', 460, '+0', GRAY], ['oldman', 720, '+1,400', GREEN], ['girl', 980, '+90', GREEN], ['mum-kid', 1140, '+210', GREEN]];
  const layers = [prop('balloon', 940, 260, 65)];
  ppl.forEach(([name, cx, score, col], i) => {
    layers.push(fig(name, cx, 600, s));
    layers.push(popIn(text(score, cx - score.length * 9.5, top, 34, {bold: true, color: col, w: 260}), 0.05 + i * 0.25));
    sfx.push({time: 16.5 + 0.1 + i * 0.25, kind: 'pop', gain: 0.08});
  });
  shot(16.5, 18.5, layers);
}

// S5 · "For the next seven days, you can see exactly how good, or how bad, everyone really is."
shot(18.5, 24.5, [
  text('7 DAYS.', 90, 60, 66, {bold: true}),
  {...prop('calendar', 90, 170, 560), keys: [{t: 0, alpha: 0}, {t: 0.35, alpha: 1}]},
  popIn(text('EVERY KARMA.', 90, 455, 52, {bold: true, color: RED}), 2.5),
  fig('you-amazed', 960, 600, 0.62),
]);
sfx.push({time: 18.7, kind: 'paper', gain: 0.1}, {time: 21.0, kind: 'chime', gain: 0.12});

// S6 · "And by day seven, the lowest number in the city will belong to someone you'd never expect."
shot(24.5, 30.5, [
  text('7 DAYS.', 90, 60, 66, {bold: true}),
  prop('calendar', 90, 170, 560, {to: 0.45}), prop('calendar-day7', 90, 170, 560, {from: 0.45}),
  popIn(text('- ?,???', 720, 110, 62, {bold: true, color: RED}), 1.5),
  popIn(text('THE LOWEST NUMBER IN THE CITY', 640, 200, 34, {bold: true, color: RED, w: 600}), 2.6),
  fig('you-amazed', 960, 600, 0.62, {to: 2.2}), fig('you-nervous', 960, 600, 0.62, {from: 2.2}),
]);
sfx.push({time: 25.0, kind: 'tap', gain: 0.12}, {time: 26.1, kind: 'pop', gain: 0.14});

// ───────────── Full film after the 30.5 s sample ─────────────
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
  const prev = scenes.at(-1)?.start ?? 30.5;
  scenes.push({start: snippet ? at(snippet, prev + 0.01) : 30.5, build});
}

const S = 0.62, FEET = 600, SIT_FEET = 690;
const num = (t, cx, scale = S, size = 34, extra = {}, feet = FEET) => {
  const col = t.startsWith('-') ? RED : (t === '+0' ? GRAY : GREEN);
  return text(t, Math.round(cx - t.length * size * 0.26), Math.round(headTop(feet, scale)) - size - 22, size, {bold: true, color: col, w: 400, ...extra});
};
const numSit = (t, cx, scale = S, size = 34) => num(t, cx, scale, size, {}, SIT_FEET);
const title = (t, x = 80, y = 55, size = 62, extra = {}) => text(t, x, y, size, {bold: true, ...extra});
const day = n => [title(`DAY ${n}`, 80, 40, 70, {color: RED}), {type: 'underline', x: 82, y: 118, w: 200, color: RED, keys: [{t: 0, progress: 0}, {t: 0.5, progress: 1}]}];
const fadeOut = (layer, t0, t1) => ({...layer, keys: [{t: t0, alpha: 1}, {t: t1, alpha: 0}]});

// DAY 1 — THE STREET
scene(null, () => [...day(1), ...flip(fig('you-walk-a', 640, FEET, S), fig('you-walk-b', 640, FEET, S), 0, 60, 0.35), num('+73', 640), prop('building', 980, 150, 230), prop('building', 60, 190, 190)]);

scene('The barista', (r, fx) => {
  fx(0.1, 'pop', 0.1); fx(r('four hundred') + 0.1, 'chime', 0.12);
  return [fig('salesman', 260, FEET, 0.55), prop('coffee', 320, 330, 60), popIn(num('+410', 260, 0.55, 38), r('four hundred')),
    fig('you-walk-a', 900, FEET, S, {to: 1.0}), fig('you-skeptic', 900, FEET, S, {from: 1.0}), num('+73', 900)];
});

scene('The man yelling', (r, fx) => {
  fx(r('minus thirty-eight'), 'pop', 0.14); fx(r('Fair enough'), 'tap', 0.1);
  return [fig('shouter', 360, FEET, 0.58), popIn(num('-38', 360, 0.58, 42), r('minus thirty-eight')),
    fig('you-skeptic', 880, FEET, S), num('+73', 880),
    popIn(title('FAIR ENOUGH.', 740, 60, 48), r('Fair enough'))];
});

scene('expensive suit', (r, fx) => {
  fx(r('Plus two thousand'), 'chime', 0.15);
  return [fig('cutter', 420, FEET, 0.6), popIn(num('+2,300', 420, 0.6, 46), r('Plus two thousand')),
    fig('you-skeptic', 950, FEET, S, {to: r('Plus two thousand')}), fig('you-surprised', 950, FEET, S, {from: r('Plus two thousand')}), num('+73', 950),
    popIn(title("YOU DON'T KNOW WHAT HE DID.", 80, 60, 44), r("You don't know"))];
});

scene('little girl', (r, fx) => {
  fx(r('Plus ninety'), 'pop', 0.12);
  return [fig('mum-kid', 380, FEET, 0.55), fig('girl', 520, FEET, 0.45), prop('balloon', 470, 260, 65),
    popIn(num('+90', 520, 0.45, 36), r('Plus ninety')),
    fig('you-confused', 960, FEET, S), num('+73', 960),
    popIn(text('Already beating you.', 760, 120, 38, {bold: true, color: RED}), r('Already beating you'))];
});

scene('Lesson one', (r, fx) => {
  fx(r("can't see goodness"), 'paper', 0.1);
  return [title('LESSON ONE', 80, 70, 54, {color: RED}), popIn(title("YOU CAN'T SEE GOODNESS", 80, 180, 78), 0.5), popIn(title("FROM THE OUTSIDE.", 80, 280, 78, {color: GREEN}), r("can't see goodness")),
    fig('shouter', 880, FEET, 0.5), num('-38', 880, 0.5), fig('cutter', 1080, FEET, 0.5), num('+2,300', 1080, 0.5)];
});

// DAY 2 — KEVIN
scene('walk into work', () => [...day(2), prop('desk', 330, 270, 400), prop('chair', 300, 380, 120), fig('you-sit-type', 380, SIT_FEET, S), numSit('+73', 380), ...flip(prop('building', 1000, 160, 200), prop('building', 1000, 162, 200), 0, 60, 0.6)]);

scene('Kevin is at', (r, fx) => {
  fx(0.1, 'pop', 0.12); fx(r('teamwork') + 0.5, 'paper', 0.1);
  return [prop('desk', 80, 270, 360), fig('you-sit-type', 140, SIT_FEET, 0.55, {to: 1.2}), fig('you-sit-snap', 140, SIT_FEET, 0.55, {from: 1.2}), numSit('+73', 140, 0.55),
    prop('desk', 720, 270, 400), fig('kevin-phone', 1000, SIT_FEET, S), popIn(numSit('+880', 980, S, 44), 0.1), popIn(title('KEVIN.', 760, 50, 60), 0),
    popIn(text('> 10× YOUR NUMBER', 400, 160, 46, {bold: true, color: RED}), r('ten times'))];
});

scene('covers night shifts', (r, fx) => {
  fx(r('clock') || 0.5, 'tap', 0.1); fx(r('shrugs'), 'paper', 0.1);
  return [prop('clock', 120, 80, 120), text('2:00 AM', 130, 230, 32, {bold: true}),
    fig('kevin-stand', 500, FEET, 0.58), prop('coffee', 560, 340, 55), num('+880', 500, 0.58),
    fig('you-think', 980, FEET, S), num('+73', 980),
    popIn(text('"Didn\'t seem like the kind of thing you announce."', 260, 450, 36, {bold: true, color: GREEN, w: 800}), r('Didn\'t seem')),
    popIn(title('YOU WERE WRONG ABOUT THIS, TOO.', 120, 50, 48, {color: RED}), r('You were wrong'))];
});

// DAY 3 — THE FREE GIFT
scene('free sample', (r, fx) => {
  fx(0.1, 'pop', 0.1);
  return [...day(3), prop('kiosk', 260, 200, 300), fig('salesman', 380, FEET, 0.55), popIn(num('+0', 380, 0.55, 36), 0.5),
    prop('sign-sample', 140, 100, 180),
    fig('you-walk-a', 900, FEET, S), num('+73', 900),
    popIn(title('A GIFT OR A HOOK?', 550, 60, 50, {color: RED}), r('difference between a gift'))];
});

scene('can of Coke', (r, fx) => {
  fx(r('raffle tickets'), 'pop', 0.12);
  return [title('THE RECIPROCITY EXPERIMENT', 80, 50, 48),
    prop('can', 180, 260, 90), text('FAVOR', 185, 430, 32, {bold: true}),
    prop('tickets-1', 480, 240, 160), text('NO COKE', 520, 460, 30, {bold: true}),
    popIn(prop('tickets-2', 760, 200, 160), r('twice as many')),
    popIn(text('2× TICKETS SOLD', 740, 460, 32, {bold: true, color: GREEN}), r('twice as many')),
    fig('you-think', 1100, FEET, 0.5), num('+73', 1100, 0.5)];
});

scene('reciprocity', (r, fx) => {
  fx(0.2, 'paper', 0.1);
  return [title('RECIPROCITY', 80, 60, 62, {color: RED}),
    popIn(text('When someone gives you something, you feel forced to give back.', 80, 160, 38, {w: 1100}), 0.8),
    popIn(text('Supermarkets do not give free food to be nice.', 80, 250, 40, {bold: true, color: GREEN, w: 1100}), r('supermarkets')),
    prop('sign-sample', 540, 350, 220)];
});

scene('drops by one', (r, fx) => {
  fx(r('drops by one'), 'tap', 0.12);
  return [fig('you-skeptic', 640, FEET, S, {to: r('drops by one')}), fig('you-nervous', 640, FEET, S, {from: r('drops by one')}),
    text('+73', 640, Math.round(headTop(FEET, S)) - 56, 44, {bold: true, color: GREEN, to: r('drops by one')}),
    popIn(text('+72', 640, Math.round(headTop(FEET, S)) - 56, 44, {bold: true, color: GREEN}), r('drops by one')),
    popIn(title('-1 FOR BUYING STUFF YOU DIDN\'T NEED', 120, 80, 44, {color: RED}), r('drops by one'))];
});

// DAY 4 — FARMING KARMA
scene('farm karma', (r, fx) => {
  fx(0.1, 'chime', 0.15);
  return [...day(4), fig('you-cape', 240, FEET, 0.62), num('+72', 240, 0.62),
    title('FARMING KARMA', 500, 60, 56, {color: RED}),
    popIn(fig('oldman', 680, FEET, 0.5), 1.5), popIn(prop('groceries', 640, 420, 110), 1.5),
    popIn(fig('door-woman', 980, FEET, 0.5), 2.8),
    popIn(text('+74... +75...', 500, 160, 46, {bold: true, color: GREEN}), r('Plus seventy-four'))];
});

scene('helped eleven people', (r, fx) => {
  fx(0.2, 'tap', 0.12);
  return [fig('you-sit-sad', 640, SIT_FEET, S), numSit('+75', 640),
    title('11 PEOPLE HELPED. +4 POINTS.', 200, 70, 50, {color: RED}),
    popIn(text('Kindness as a performance barely counts.', 240, 160, 42, {bold: true, w: 800}), r('performance'))];
});

scene('hot chocolates', (r, fx) => {
  fx(r('hand one to a stranger'), 'pop', 0.12);
  return [prop('busstop', 180, 140, 360),
    fig('cold-woman', 340, FEET, 0.55), num('-2', 340, 0.55),
    fig('you-give', 780, FEET, S), num('+75', 780), prop('hotcocoa', 700, 380, 80)];
});

scene('Plus six', (r, fx) => {
  fx(0.1, 'chime', 0.18);
  return [prop('busstop', 180, 140, 360),
    fig('warm-woman', 340, FEET, 0.55), popIn(prop('heart', 320, 180, 70), 0.1), num('+12', 340, 0.55),
    fig('you-surprised', 780, FEET, S), popIn(num('+81', 780, S, 48), 0.1),
    popIn(title('+6 IN ONE SECOND.', 480, 60, 60, {color: GREEN}), 0.2)];
});

scene('psychologists actually tested', (r, fx) => {
  fx(0.2, 'paper', 0.1);
  return [title('KUMAR & EPLEY (2022)', 80, 50, 48),
    popIn(title('WE CONSTANTLY UNDERESTIMATE', 80, 160, 60), 0.5),
    popIn(title('HOW MUCH SMALL KINDNESS MEANS.', 80, 260, 60, {color: GREEN}), r('underestimate')),
    fig('you-cheer', 960, FEET, 0.58)];
});

// DAY 5 — THE RIPPLE
scene('woman from the bus stop', (r, fx) => {
  fx(0.2, 'pop', 0.1);
  return [...day(5), prop('sign-hospital', 120, 60, 260),
    fig('door-woman', 520, FEET, 0.55), num('+15', 520, 0.55),
    fig('crutch-man', 780, FEET, 0.55), prop('crutches', 740, 360, 90), num('+80', 780, 0.55),
    fig('you-walk-a', 1100, FEET, 0.5), num('+81', 1100, 0.5)];
});

scene('man on crutches', (r, fx) => {
  fx(0.2, 'pop', 0.1);
  return [title('THE CHAIN CONTINUES...', 80, 60, 48),
    fig('crutch-man', 300, FEET, 0.55), num('+84', 300, 0.55),
    fig('baby-mum', 660, FEET, 0.55), prop('baby', 710, 380, 85), num('+220', 660, 0.55),
    fig('you-walk-a', 1060, FEET, 0.5), num('+81', 1060, 0.5)];
});

scene('pays for the coffee', (r, fx) => {
  fx(0.2, 'chime', 0.12);
  return [title('ONE HOT CHOCOLATE STARTED THIS.', 120, 60, 50, {color: GREEN}),
    prop('hotcocoa', 160, 280, 100), text('→', 320, 320, 60, {bold: true}),
    prop('sign-hospital', 380, 280, 180), text('→', 610, 320, 60, {bold: true}),
    prop('baby', 670, 290, 100), text('→', 820, 320, 60, {bold: true}),
    prop('coffee', 880, 280, 80),
    popIn(text('3 more good things you never saw.', 280, 480, 42, {bold: true}), r('Three more good things'))];
});

scene('generosity spread', (r, fx) => {
  fx(0.2, 'paper', 0.1);
  return [title('FOWLER & CHRISTAKIS (PNAS)', 80, 50, 48),
    popIn(title('GENEROSITY SPREADS 3 STEPS AWAY.', 80, 160, 56, {color: GREEN}), 0.6),
    popIn(text('Each extra bit of sharing multiplied across groups.', 80, 270, 38, {w: 1100}), r('multiplied')),
    fig('you-cheer', 980, FEET, 0.55)];
});

scene('Selfishness spread', (r, fx) => {
  fx(0.1, 'tap', 0.15);
  return [title('SELFISHNESS SPREADS JUST AS EASILY.', 80, 50, 52, {color: RED}),
    fig('cutter', 220, FEET, 0.5), num('-15', 220, 0.5),
    text('→', 380, 340, 60, {bold: true, color: RED}),
    fig('shover', 540, FEET, 0.5), num('-30', 540, 0.5),
    text('→', 700, 340, 60, {bold: true, color: RED}),
    fig('shouter', 860, FEET, 0.5), num('-50', 860, 0.5),
    popIn(title('WHICH CHAIN ARE YOU STARTING TODAY?', 120, 500, 46, {color: RED}), r('The only choice'))];
});

// DAY 6 — EVERYONE CAN SEE
scene('something changes', (r, fx) => {
  fx(0.1, 'chime', 0.15);
  return [...day(6), prop('tv', 420, 180, 440),
    popIn(title('BREAKING: EVERYONE CAN SEE KARMA', 140, 80, 46, {color: RED}), 0.5),
    fig('you-startled', 1050, FEET, S), num('+81', 1050)];
});

scene('good deeds for the camera', (r, fx) => {
  fx(0.2, 'pop', 0.12);
  return [title('THE WORLD GOES CRAZY', 80, 50, 54, {color: RED}),
    fig('filmer', 180, FEET, 0.5), num('+45', 180, 0.5),
    prop('leaderboard', 440, 180, 300),
    prop('sign-500', 840, 240, 220),
    popIn(text('GOOD DEEDS FOR THE CAMERA', 120, 540, 42, {bold: true}), 0.8)];
});

scene('Leo calls you', (r, fx) => {
  fx(0.1, 'pop', 0.12);
  return [fig('leo-phone', 360, FEET, 0.6), num('-14', 360, 0.6, 42),
    fig('you-phone', 880, FEET, S), num('+81', 880),
    popIn(text('"What if people only ever see the worst thing I did?"', 180, 100, 40, {bold: true, color: RED, w: 900}), r('What if people'))];
});

scene('loses his job', (r, fx) => {
  fx(0.2, 'pop', 0.1);
  return [fig('jobless', 260, FEET, 0.55), prop('officebox', 310, 430, 120), num('+1,950', 260, 0.55, 38),
    fig('whisper-a', 680, FEET, 0.5), fig('whisper-b', 840, FEET, 0.5),
    popIn(text('"He must have deserved it."', 600, 150, 38, {bold: true, color: RED}), r('deserved it')),
    fig('you-skeptic', 1100, FEET, 0.5), num('+81', 1100, 0.5)];
});

scene('just-world belief', (r, fx) => {
  fx(0.2, 'paper', 0.1);
  return [title('THE JUST-WORLD BELIEF', 80, 50, 54, {color: RED}),
    prop('scale-tip', 460, 200, 340),
    popIn(title('BAD LUCK ≠ BAD PERSON.', 80, 170, 60), 0.6),
    popIn(text('We blame victims because it makes us feel safe.', 80, 270, 40, {w: 1100}), r('feel safe')),
    popIn(title('AND IT MAKES US CRUEL.', 80, 360, 54, {color: RED}), r('cruel'))];
});

// DAY 7 — THE LOWEST NUMBER
scene('Remember the lowest', (r, fx) => {
  fx(0.1, 'tap', 0.12);
  return [...day(7), text('- ?,???', 560, 140, 70, {bold: true, color: RED}),
    fig('you-confused', 960, FEET, S), num('+81', 960),
    popIn(title('WHO HAS THE LOWEST NUMBER?', 120, 60, 50), 0.5)];
});

scene('parking meter', (r, fx) => {
  fx(0.2, 'pop', 0.15);
  return [prop('meter', 340, 260, 110),
    fig('officer', 500, FEET, 0.58), num('-4,120', 500, 0.58, 48),
    popIn(title("HER NUMBER ISN'T HER.", 100, 60, 58, {color: RED}), r("isn't low because")),
    fig('you-walk-a', 980, FEET, S), num('+81', 980)];
});

scene('faint and small', (r, fx) => {
  fx(0.2, 'chime', 0.15);
  return [prop('meter', 340, 260, 110),
    fig('officer', 500, FEET, 0.58), num('-4,120', 500, 0.58, 48),
    popIn(num('+3,600', 500, 0.58, 38, {color: GREEN}), 0.2),
    popIn(title('THE RED NUMBER WAS OURS.', 100, 60, 58, {color: RED}), r('was ours')),
    fig('you-skeptic', 980, FEET, S), num('+81', 980)];
});

scene('hard job well', (r, fx) => {
  fx(r('small smile') || 0.5, 'chime', 0.12);
  return [fig('officer-smile', 440, FEET, 0.58), num('+3,600', 440, 0.58, 38),
    fig('you-kind', 800, FEET, S), num('+81', 800),
    popIn(text('"Nobody has said that in 11 years."', 240, 100, 42, {bold: true, color: GREEN}), 0.8),
    popIn(text('A ticket reminded a father to fix his brakes before a family trip.', 180, 480, 36, {bold: true, w: 900}), r('fix his brakes'))];
});

// ENDING
scene('numbers fade', (r, fx) => {
  fx(0.2, 'paper', 0.1);
  return [title('MIDNIGHT.', 80, 60, 60),
    fadeOut(text('+410', 200, 240, 44, {bold: true, color: GREEN}), 1.0, 2.5),
    fadeOut(text('-38', 500, 240, 44, {bold: true, color: RED}), 1.0, 2.5),
    fadeOut(text('+880', 800, 240, 44, {bold: true, color: GREEN}), 1.0, 2.5),
    popIn(title('THE NUMBERS FADE AWAY.', 80, 160, 52), 0.5),
    fig('you-calm', 980, FEET, S), num('+81', 980)];
});

scene('Plus eighty-one', (r, fx) => {
  fx(0.1, 'chime', 0.12);
  return [prop('mirror', 760, 50, 380), fig('you-calm', 430, FEET, S), fig('you-calm-m', 950, 515, 0.42), prop('sink', 800, 400, 300),
    num('+81', 950, 0.42, 42, {}, 515),
    popIn(title('+81. HIGHER THAN A WEEK AGO.', 80, 80, 46, {color: GREEN}), 0.2),
    popIn(text("It wasn't the grand gestures.", 80, 180, 42, {bold: true}), r("grand gestures"))];
});

scene('message', (r, fx) => {
  fx(0.2, 'pop', 0.12); fx(r('heart') || 1.8, 'chime', 0.1);
  return [prop('msg-mum', 460, 160, 360),
    fig('you-phone', 200, FEET, S), num('+81', 200),
    popIn(prop('heart', 680, 340, 80), 1.8)];
});

scene('coffee machine', (r, fx) => {
  fx(0.2, 'chime', 0.12);
  return [title('ONE MORE COFFEE FOR KEVIN.', 140, 60, 50),
    fig('kevin-grin', 380, FEET, 0.58),
    fig('you-give', 760, FEET, S), prop('coffee', 680, 380, 60),
    popIn(title('SOME KINDNESS NOBODY WILL COUNT.', 120, 480, 44, {color: GREEN}), r('nobody will ever count')),
    popIn(title('IT STILL COUNTS.', 440, 540, 50, {color: GREEN}), r('still counts'))];
});

scene('taught you', (r, fx) => {
  const lessons = [
    ["1. YOU CAN'T SEE GOODNESS FROM THE OUTSIDE.", "goodness from the outside"],
    ["2. SMALL KINDNESS TRAVELS FURTHER THAN YOU THINK.", "further than you think"],
    ["3. BAD LUCK DOESN'T MEAN A BAD PERSON.", "bad person"],
    ["4. SOMETIMES THE LOWEST NUMBER WAS WRITTEN BY OTHERS.", "lowest number"],
  ];
  lessons.forEach(([, s]) => fx(r(s), 'tap', 0.1));
  return [title('7 DAYS TAUGHT YOU:', 80, 45, 56, {color: RED}),
    ...lessons.map(([t, s], i) => popIn(text(t, 80, 140 + i * 80, 40, {bold: true, color: i % 2 ? GREEN : INK, w: 1120}), r(s))),
    popIn(title("BE THE GOOD PART OF SOMEONE'S DAY.", 140, 500, 50, {color: RED}), r("good part of someone's day") || 15.0)];
});

scene('hearing whispers', (r, fx) => {
  fx(0.1, 'chime', 0.16);
  return [fig('you-ear', 640, FEET, S),
    popIn(fig('whisper-a', 240, FEET, 0.5), 0.8),
    popIn(fig('whisper-b', 1040, FEET, 0.5), 1.2),
    popIn(title("NEXT: WHAT IF YOU COULD HEAR", 120, 60, 52, {color: RED}), 0.2),
    popIn(title("WHAT EVERYONE SAYS BEHIND YOUR BACK?", 80, 130, 46, {color: RED}), 0.8)];
});

scene('subscribe', (r, fx) => {
  fx(r('subscribe') + 0.4, 'tap', 0.16);
  return [popIn(prop('subscribe', 470, 280, 340), r('subscribe')),
    fig('you-calm', 300, FEET, S, {to: r('subscribe') + 0.3}), fig('you-tap', 300, FEET, S, {from: r('subscribe') + 0.3}),
    popIn(title("WHAT IF YOU COULD HEAR EVERY WHISPER?", 100, 70, 48, {color: RED}), 0.2),
    popIn(text('tomorrow, the whispers begin...', 460, 450, 42, {bold: true}), r('whispers begin'))];
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

// Magi's wizard hat rises ~1.2 head-radii above the head: lift numbers that sit over him.
const HAT_LIFT = 78;
for (const sh of shots) {
  const magi = sh.layers.filter(l => /^art\/you-/.test(l.path || '')).map(l => ({cx: l.x + l.w / 2, top: l.y + 190 * l.w / 700, s: l.w / 700}));
  for (const l of sh.layers) {
    if (l.type !== 'text' || !/^[$+\-]/.test(l.text)) continue;
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

