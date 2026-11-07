// Shot layout for EP01. Writes project.json for the Autopilot renderer.
// Times are video seconds (narration time + LEAD). Run: node layout.mjs
import fs from 'node:fs';
import {execSync} from 'node:child_process';

const LEAD = 0.15, TAIL = 5;
const GREEN = '#2F8A4A', RED = '#EC4338', INK = '#191916';
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

// S1 · "You wake up, look in the mirror, and there's a number floating above your head."
{
  const refl = 0.42, sw = 2.2;
  shot(0, 4.85, [
    prop('mirror', 760, 50, 380),
    fig('you-sleepy', 430, 600, 0.62, {to: sw}), fig('you-startled', 430, 600, 0.62, {from: sw}),
    // Reflection first, then the sink in front of it hides its legs.
    fig('you-sleepy-m', 950, 515, refl, {to: sw}), fig('you-startled-m', 950, 515, refl, {from: sw}),
    prop('sink', 800, 400, 300),
    popIn(text('$41,200', 868, Math.round(headTop(515, refl)) - 62, 44, {bold: true, color: GREEN}), 2.75),
  ]);
  sfx.push({time: 2.8, kind: 'pop', gain: 0.18});
}

// S2 · "Forty-one thousand, two hundred dollars."
{
  const a = fig('you-swat-a', 950, 600, 0.62), b = fig('you-swat-b', 950, 600, 0.62);
  shot(4.85, 7.55, [
    text('$41,200', 100, 150, 128, {bold: true, color: GREEN}),
    {type: 'underline', x: 105, y: 305, w: 450, color: GREEN, keys: [{t: 0.2, progress: 0}, {t: 0.9, progress: 1}]},
    text('$41,200', 875, Math.round(headTop(600, 0.62)) - 60, 34, {bold: true, color: GREEN}),
    {...a, to: 0.55}, ...flip(b, a, 0.55, 2.7, 0.22),
  ]);
  sfx.push({time: 4.95, kind: 'paper', gain: 0.12});
}

// S3 · "Your exact income this year. Every dollar, from every source."
{
  shot(7.55, 12.35, [
    text('YOUR EXACT INCOME.', 380, 80, 58, {bold: true}),
    popIn(text('EVERY DOLLAR. EVERY SOURCE.', 380, 165, 40, {bold: true, color: RED}), 2.35),
    fig('you-confused', 190, 600, 0.6),
    popIn(prop('paycheck', 400, 320, 190), 2.45), popIn(prop('bill', 625, 335, 180), 2.8),
    popIn(prop('coins', 850, 300, 115), 3.25), popIn(prop('house', 1010, 290, 150), 3.6),
  ]);
  for (const t of [10.0, 10.35, 10.8, 11.15]) sfx.push({time: t, kind: 'tap', gain: 0.1});
}

// S4 · "You look out the window."
shot(12.35, 13.95, [prop('window', 640, 80, 420), fig('you-window', 450, 600, 0.6)]);

// S5 · "Everyone has one."
{
  const s = 0.5, top = Math.round(headTop(600, s)) - 52;
  const people = [['p-barista', 150, '$29,000'], ['p-suit', 390, '$34,000'], ['p-dogwalker', 630, '$1,250,000'], ['p-jogger', 880, '$96,500'], ['p-kid', 1120, '$340,000']];
  const layers = [prop('dog', 668, 515, 115)];
  people.forEach(([name, cx, amount], i) => {
    layers.push(fig(name, cx, 600, s));
    layers.push(popIn(text(amount, cx - amount.length * 9.5, top, 34, {bold: true, color: GREEN, w: 260}), 0.05 + i * 0.28));
    sfx.push({time: 13.95 + 0.1 + i * 0.28, kind: 'pop', gain: 0.08});
  });
  shot(13.95, 15.6, layers);
}

// S6 · "For the next seven days, you can see what every single person earns."
shot(15.6, 19.55, [
  text('7 DAYS.', 90, 60, 66, {bold: true}),
  {...prop('calendar', 90, 170, 560), keys: [{t: 0, alpha: 0}, {t: 0.35, alpha: 1}]},
  popIn(text('EVERY SALARY.', 90, 455, 52, {bold: true, color: RED}), 1.4),
  fig('you-amazed', 960, 600, 0.62),
]);
sfx.push({time: 15.7, kind: 'paper', gain: 0.1}, {time: 17.0, kind: 'chime', gain: 0.1});

// S7 · "And by day seven, one of those numbers is going to ruin your life."
shot(19.55, 23.6, [
  text('7 DAYS.', 90, 60, 66, {bold: true}),
  prop('calendar', 90, 170, 560, {to: 0.45}), prop('calendar-day7', 90, 170, 560, {from: 0.45}),
  popIn(text('$?,???,???', 700, 110, 58, {bold: true, color: RED}), 1.4),
  fig('you-amazed', 960, 600, 0.62, {to: 2.6}), fig('you-nervous', 960, 600, 0.62, {from: 2.6}),
]);
sfx.push({time: 20.05, kind: 'tap', gain: 0.12}, {time: 21.0, kind: 'pop', gain: 0.14});

// ───────────── Full film after the approved 23.6 s sample ─────────────
// Scenes start on caption cues found by snippet, so re-recorded narration
// only needs new captions, not new numbers here.
const CAP = JSON.parse(fs.readFileSync(new URL('./captions.json', import.meta.url)));
const VOICE = Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${new URL('./narration.wav', import.meta.url).pathname}"`));
const END = +(VOICE + LEAD + TAIL).toFixed(3);
function at(snippet, after) {
  const c = CAP.find(c => c.start >= after - 0.05 && c.text.includes(snippet));
  if (!c) throw new Error(`No caption "${snippet}" after ${after}`);
  return c.start;
}
const scenes = [];
// scene(snippet, build): build receives r(snippet) → seconds into the scene, and fx(rel, kind, gain).
function scene(snippet, build) {
  const prev = scenes.at(-1)?.start ?? 23.6;
  scenes.push({start: snippet ? at(snippet, prev + 0.01) : 23.6, build});
}
const S = 0.62, FEET = 600;
const num = (t, cx, scale = S, size = 34, extra = {}, feet = FEET) => text(t, Math.round(cx - t.length * size * 0.26), Math.round(headTop(feet, scale)) - size - 22, size, {bold: true, color: GREEN, w: 400, ...extra});
// Seated figures are placed as if standing with feet at SIT_FEET, so their legs clear the caption band.
const SIT_FEET = 690;
const numSit = (t, cx, scale = S, size = 34) => num(t, cx, scale, size, {}, SIT_FEET);
const title = (t, x = 80, y = 55, size = 62, extra = {}) => text(t, x, y, size, {bold: true, ...extra});
const day = n => [title(`DAY ${n}`, 80, 40, 70, {color: RED}), {type: 'underline', x: 82, y: 118, w: 200, color: RED, keys: [{t: 0, progress: 0}, {t: 0.5, progress: 1}]}];
const fadeOut = (layer, t0, t1) => ({...layer, keys: [{t: t0, alpha: 1}, {t: t1, alpha: 0}]});

// DAY 1 — THE STREET
scene(null, (r, fx) => [...day(1), ...flip(fig('you-walk-a', 640, FEET, S), fig('you-walk-b', 640, FEET, S), 0, 60, 0.35), num('$41,200', 640), prop('building', 980, 150, 230), prop('building', 60, 190, 190)]);
scene('The guy in the expensive', (r, fx) => {
  fx(0.1, 'pop', 0.1); fx(r('the barista') + 0.1, 'pop', 0.1);
  return [fig('p-barista', 240, FEET, 0.55), prop('coffee', 300, 330, 60), popIn(num('$29,000', 240, 0.55), r('the barista')),
    fig('p-suit', 560, FEET, 0.55), popIn(num('$34,000', 560, 0.55), 0.1), fig('you-skeptic', 980, FEET, S, {from: 0.8}), fig('you-walk-a', 980, FEET, S, {to: 0.8})];
});
scene('The lady in sweatpants', (r, fx) => {
  fx(r('Over a million'), 'chime', 0.12);
  return [fig('p-dogwalker', 380, FEET, 0.6), prop('dog', 470, 500, 130, {keys: [{t: 0, x: 440}, {t: 2, x: 480}, {t: 4, x: 470}]}),
    popIn(num('$1,250,000', 380, 0.6, 46), r('Over a million') - 0.3), fig('you-skeptic', 950, FEET, S, {to: r('Over a million')}), fig('you-surprised', 950, FEET, S, {from: r('Over a million')})];
});
scene('Lesson one', (r, fx) => {
  fx(r('you cannot tell'), 'paper', 0.1);
  return [title('LESSON ONE', 80, 70, 54, {color: RED}), popIn(title('CLOTHES LIE.', 80, 180, 92), 0.6), popIn(title("NUMBERS DON'T.", 80, 310, 92, {color: GREEN}), r('you cannot tell')),
    fig('p-suit', 900, FEET, 0.5), num('$34,000', 900, 0.5), fig('p-dogwalker', 1120, FEET, 0.5), num('$1,250,000', 1120, 0.5)];
});
scene('It gets stranger', (r, fx) => {
  fx(r('The kid on the skateboard') + 0.3, 'pop', 0.12);
  return [title('IT GETS STRANGER.', 80, 60, 54), fig('skater', 420, 560, 0.5, {keys: [{t: 0, x: 150}, {t: 3, x: 230}, {t: 7, x: 250}]}), prop('skateboard', 330, 540, 200, {keys: [{t: 0, x: 330}, {t: 3, x: 410}, {t: 7, x: 430}]}),
    popIn(text('$340,000', 380, 140, 46, {bold: true, color: GREEN}), r('The kid on the skateboard') + 0.3),
    popIn(text('> YOUR WHOLE OFFICE FLOOR', 660, 300, 40, {bold: true, color: RED, w: 600}), r('office floor')),
    popIn(text('(skateboarding videos)', 660, 380, 36), r('He posts videos'))];
});
scene('The nurse who just worked', (r, fx) => {
  fx(r('makes a fifth'), 'tap', 0.12);
  return [fig('skater', 230, FEET, 0.45), num('$340,000', 230, 0.45), ...flip(fig('nurse', 760, FEET, S), fig('nurse', 770, FEET, S, {}), 0, 60, 0.4),
    popIn(text('12-HOUR NIGHT SHIFT', 330, 480, 42, {bold: true}), 0.6), popIn(num('$71,000', 760, S, 46), r('makes a fifth'))];
});
scene('You stand on the corner', (r, fx) => {
  const ppl = [['p-barista', 110, '$29,000'], ['p-suit', 290, '$34,000'], ['nurse', 470, '$71,000'], ['p-jogger', 830, '$96,500'], ['skater', 1010, '$340,000'], ['p-dogwalker', 1180, '$1,250,000']];
  fx(r('what the world actually'), 'chime', 0.1);
  return [...ppl.flatMap(([n, cx, a], i) => [fig(n, cx, FEET, 0.42), popIn(num(a, cx, 0.42, 28), 0.2 + i * 0.4)]),
    fig('you-surprised', 650, FEET, 0.5), num('$41,200', 650, 0.5, 30),
    popIn(title('WHAT THE WORLD ACTUALLY PAYS FOR.', 120, 50, 50, {color: RED}), r('what the world actually'))];
});

// DAY 2 — THE OFFICE
scene('Then you walk into work', () => [...day(2), prop('desk', 330, 270, 400), prop('chair', 300, 380, 120), fig('you-sit-type', 380, SIT_FEET, S), numSit('$41,200', 380), ...flip(prop('building', 1000, 160, 200), prop('building', 1000, 162, 200), 0, 60, 0.6)]);
scene('Kevin.', (r, fx) => {
  fx(0.1, 'pop', 0.12); fx(r('calls it teamwork') + 0.8, 'paper', 0.1);
  return [prop('desk', 80, 270, 360), fig('you-sit-type', 140, SIT_FEET, 0.55), numSit('$41,200', 140, 0.55),
    prop('desk', 720, 270, 400), fig('kevin-phone', 1000, SIT_FEET, S), popIn(numSit('$58,000', 980, S, 40), 0.1), popIn(title('KEVIN.', 760, 50, 60), 0),
    popIn(text('"TEAMWORK"', 760, 125, 44, {bold: true, color: RED}), r('calls it teamwork') + 0.8)];
});
scene('Kevin makes almost', (r, fx) => {
  fx(r('than you') + 0.2, 'tap', 0.2);
  return [prop('desk', 80, 270, 360), fig('you-sit-type', 140, SIT_FEET, 0.55, {to: r('than you')}), fig('you-sit-snap', 140, SIT_FEET, 0.55, {from: r('than you')}), numSit('$41,200', 140, 0.55),
    prop('desk', 720, 270, 400), fig('kevin-phone', 1000, SIT_FEET, S), numSit('$58,000', 980, S, 40),
    popIn(title('+ $16,800', 470, 160, 80, {color: RED}), 0.8)];
});
scene("And here's the uncomfortable", (r, fx) => {
  const qs = [['q1', 180], ['q4', 430], ['q3', 680], ['q2', 930]];
  fx(r('nobody talks about pay'), 'paper', 0.1);
  return [...qs.flatMap(([n, cx], i) => [fig(n, cx, FEET, 0.5), popIn(num('$ ? ? ?', cx, 0.5, 36, {color: RED}), r('nobody talks') + i * 0.3)]),
    popIn(title('NOBODY TALKS ABOUT PAY.', 80, 50, 54), 0.3), popIn(text('gaps hide for years', 1000, 300, 40, {bold: true, color: RED, w: 260}), r('so gaps like this'))];
});
scene("That's exactly why", (r, fx) => {
  fx(r('Several U.S.'), 'pop', 0.1); fx(r('European Union'), 'pop', 0.1);
  return [popIn(title('SALARY RANGES IN JOB ADS', 80, 50, 54), 0.2), popIn(prop('map', 120, 160, 560), r('Several U.S.') - 0.3),
    popIn(text('pay gaps must be explained', 700, 230, 40, {bold: true, color: GREEN, w: 360}), r('European Union') + 0.8), fig('you-think', 1150, FEET, 0.55)];
});
scene('The secret salary is slowly', (r, fx) => {
  fx(0.6, 'paper', 0.12);
  return [title('THE SECRET SALARY', 120, 200, 86), {type: 'line', points: [[110, 260], [880, 250]], color: RED, lineWidth: 9, keys: [{t: 0.4, progress: 0}, {t: 1.2, progress: 1}]},
    popIn(title("...IS DYING.", 140, 330, 66, {color: RED}), 1.2), fig('you-grin', 1060, FEET, S, {from: r("You're just seeing it")}), fig('you-think', 1060, FEET, S, {to: r("You're just seeing it")})];
});

// DAY 3 — THE RAISE
scene('So you do something', (r, fx) => {
  fx(r('You ask for a raise'), 'tap', 0.2); fx(r('You ask for a raise') + 0.25, 'tap', 0.2);
  return [...day(3), prop('door-boss', 780, 210, 200), ...flip(fig('you-folder', 560, FEET, S), fig('you-confident', 560, FEET, S), 0, r('You ask for a raise'), 1.2),
    fig('you-folder', 560, FEET, S, {from: r('You ask for a raise')}), prop('folder', 640, 300, 90), num('$41,200', 560),
    popIn(title('ASK FOR A RAISE.', 80, 200, 56), r('You ask for a raise')), popIn(text('unfair advantage', 80, 290, 44, {bold: true, color: RED}), r('unfair advantage'))];
});
scene('You can see the budget', (r, fx) => {
  fx(0.15, 'pop', 0.12);
  return [prop('desk', 620, 300, 380), fig('boss', 960, FEET, S), num('$212,000', 960), popIn(prop('doc-budget', 700, 130, 230), 0.1),
    fig('you-folder', 300, FEET, S), num('$41,200', 300), popIn(text('what the role is worth', 380, 40, 40, {bold: true, color: GREEN, w: 420}), r('You know what the role'))];
});
scene("You don't guess", (r, fx) => {
  fx(r('You say a number'), 'pop', 0.14);
  return [popIn(title('NO GUESSING.', 80, 80, 64), 0), popIn(title('NO SORRY.', 80, 170, 64), r("You don't apologize")),
    fig('you-confident', 520, FEET, S, {from: r('You say a number')}), fig('you-folder', 520, FEET, S, {to: r('You say a number')}),
    popIn(text('"$55,000."', 660, 180, 72, {bold: true, color: GREEN}), r('You say a number')), fig('boss', 1020, FEET, S)];
});
scene('Fifty-five?', (r, fx) => {
  fx(1.3, 'chime', 0.14);
  return [fig('boss-sweat', 950, FEET, S, {to: 0.9}), fig('boss-nod', 950, FEET, S, {from: 0.9}), popIn(text('"...fifty-five?"', 820, 120, 50, {bold: true}), 0.1),
    fig('you-grin', 330, FEET, S), text('$41,200', 260, 98, 40, {bold: true, color: GREEN, to: 1.3}), popIn(text('$55,000', 260, 98, 46, {bold: true, color: GREEN}), 1.3),
    {type: 'line', points: [[255, 125], [400, 118]], color: RED, lineWidth: 6, from: 1.1, to: 1.3}];
});
scene('Negotiation researchers', (r, fx) => {
  fx(r('that silence can cost') + 0.2, 'paper', 0.1);
  return [title('MOST PEOPLE NEVER ASK.', 80, 50, 56), prop('coins-big', 330, 160, 150, {from: r('over a whole career')}), prop('coins-small', 680, 160, 150, {from: r('over a whole career')}),
    popIn(text('ASKED', 340, 545, 40, {bold: true, color: GREEN}), r('over a whole career')), popIn(text("DIDN'T ASK", 660, 545, 40, {bold: true, color: RED}), r('over a whole career') + 0.3),
    popIn(text('= a fortune over a career', 860, 300, 40, {bold: true, color: RED, w: 380}), r('that silence can cost'))];
});
scene("You didn't need superpowers", (r, fx) => {
  fx(r('You just needed') + 0.4, 'chime', 0.1);
  return [fig('you-cheer', 640, FEET, S, {from: r('You just needed')}), fig('you-confident', 640, FEET, S, {to: r('You just needed')}), num('$55,000', 640),
    popIn(title('JUST ASK.', 80, 160, 90, {color: GREEN}), r('You just needed') + 0.4)];
});

// DAY 3, LATER — LEO
scene('After work, your best friend Leo', (r, fx) => {
  const items = [['NEW CAR', 'Leo has the new car'], ['THE WATCH', 'The watch'], ['WEEKEND TRIPS', 'The weekend trips'], ['THE PHOTOS', 'The photos']];
  items.forEach(([, s]) => fx(r(s), 'pop', 0.09));
  return [fig('leo-car', 760, FEET, S), prop('car', 520, 360, 460, {keys: [{t: 0, x: 1300}, {t: 1.2, x: 520}]}),
    ...items.map(([t, s], i) => popIn(text(t, 80, 130 + i * 70, 44, {bold: true, color: i % 2 ? RED : INK}), r(s))), fig('you-surprised', 1150, FEET, 0.5, {from: 1.2})];
});
scene('And a number barely higher', (r, fx) => {
  fx(0.5, 'pop', 0.12);
  return [fig('leo-quiet', 820, FEET, S), popIn(num('$52,000', 820, S, 46), 0.5), fig('you-skeptic', 360, FEET, S), num('$55,000', 360, S, 40)];
});
scene("For years you've felt", (r, fx) => {
  fx(r('Leo is falling too'), 'tap', 0.14);
  return [prop('card', 700, 200, 240, {to: r('Leo is falling too'), keys: [{t: 0, w: 240}, {t: 2, w: 300}]}), prop('card-cracked', 680, 200, 320, {from: r('Leo is falling too')}),
    fig('leo-quiet', 300, FEET, S), num('$52,000', 300), popIn(text('...just more quietly.', 680, 420, 44, {bold: true, color: RED}), r('Just more quietly'))];
});
scene('Researchers studying lottery', (r, fx) => {
  const xs = [80, 330, 580, 830, 1080];
  fx(r('The bigger a neighbour') + 0.2, 'jingle', 0.12); fx(r('went bankrupt'), 'tap', 0.12);
  return [title('LOTTERY STUDY · CANADA', 80, 50, 50), ...xs.map((x, i) => prop('house', x, 300, 150, i === 2 ? {} : {keys: [{t: r('borrowed'), y: 300}, {t: r('borrowed') + 1, y: 305}]})),
    popIn(text('WON!', 600, 230, 50, {bold: true, color: GREEN}), r('The bigger a neighbour') + 0.2),
    ...[0, 1, 3, 4].map(i => popIn(text('LOANS', xs[i] + 20, 470, 32, {bold: true, w: 160}), r('borrowed') + i * 0.12)),
    ...[1, 3].map(i => popIn(text('BANKRUPT', xs[i] - 5, 520, 32, {bold: true, color: RED}), r('went bankrupt')))];
});
scene('Not because they won', (r, fx) => {
  fx(r('Because they tried'), 'paper', 0.1);
  return [popIn(title('NOT LUCK.', 80, 120, 80), 0), popIn(title('KEEPING UP.', 80, 240, 80, {color: RED}), r('Because they tried')), fig('you-think', 1000, FEET, S)];
});
scene('You decide two things', (r, fx) => {
  fx(r('stop comparing'), 'tap', 0.1); fx(r("ask him if he's okay"), 'tap', 0.1);
  return [fig('you-calm', 300, FEET, 0.44), fig('leo-quiet', 1050, FEET, 0.44), popIn(text("1. STOP COMPARING TO LEO'S PHOTOS.", 80, 90, 42, {bold: true}), r('stop comparing')),
    popIn(text("2. ASK IF HE'S OKAY.", 80, 160, 42, {bold: true, color: GREEN}), r("ask him if he's okay")), popIn(prop('heart', 640, 330, 90), r("ask him if he's okay") + 0.4)];
});

// DAY 4 — THE DATE
scene('That night, you have a date', (r, fx) => {
  fx(r('Maya earns') + 0.4, 'pop', 0.12);
  return [...day(4), prop('table-date', 430, 360, 420), fig('you-sit-table', 360, SIT_FEET, S), numSit('$55,000', 360), fig('maya-sit', 920, SIT_FEET, S), popIn(numSit('$186,000', 920, S, 46), r('Maya earns') + 0.4),
    popIn(text('3x', 600, 160, 70, {bold: true, color: RED}), r('Maya earns') + 1.2)];
});
scene('And for a second', (r, fx) => {
  fx(r('something ugly'), 'tap', 0.1);
  return [prop('table-date', 430, 360, 420), fig('you-sit-sad', 360, SIT_FEET, S), fig('maya-sit', 920, SIT_FEET, S), numSit('$186,000', 920),
    popIn(prop('cloud', 280, 130, 180), r('something ugly')), ...flip(prop('cloud', 280, 130, 180), prop('cloud', 284, 134, 180), r('something ugly') + 0.3, r('something ugly') + 3, 0.3)];
});
scene('Psychologists have a name', (r, fx) => {
  fx(r('Social comparison'), 'paper', 0.12);
  return [popIn(title('SOCIAL COMPARISON', 80, 60, 70, {color: RED}), r('Social comparison')), prop('seesaw', 420, 330, 440, {keys: [{t: 0, angle: 0}, {t: 4, angle: -0.04}, {t: 8, angle: 0.03}]}),
    fig('q1', 470, 380, 0.3), fig('q3', 800, 470, 0.3), popIn(text('what we have', 80, 150, 40, {bold: true}), r("We don't judge")), popIn(text('vs. what THEY have', 820, 150, 40, {bold: true, color: RED}), r('We judge them'))];
});
scene("Maya didn't change", (r, fx) => {
  fx(r('You decide not'), 'pop', 0.1);
  return [prop('table-date', 430, 360, 420), fig('you-sit-sad', 360, SIT_FEET, S, {to: r('You decide not')}), fig('you-sit-smile', 360, SIT_FEET, S, {from: r('You decide not')}),
    fig('maya-sit', 920, SIT_FEET, S, {to: 1.2}), fig('maya-laugh', 920, SIT_FEET, S, {from: 1.2}), numSit('$186,000', 920), fadeOut(prop('cloud', 280, 130, 180), r('You decide not'), r('You decide not') + 0.4)];
});
scene('She pays for dessert', (r, fx) => {
  fx(0.3, 'pop', 0.1);
  return [prop('table-date', 430, 360, 420), fig('you-sit-smile', 360, SIT_FEET, S), fig('maya-pay', 920, SIT_FEET, S), popIn(prop('card', 620, 250, 120), 0.3), popIn(title('SHE PAYS.', 80, 60, 56), 0.2), popIn(title('YOU LET HER.', 760, 60, 56, {color: GREEN}), r('You let her'))];
});
scene('On the walk to the station', (r, fx) => {
  fx(r('three sisters'), 'pop', 0.1); fx(r('one late night'), 'chime', 0.1);
  return [fig('maya-walk', 1050, FEET, 0.55), num('$186,000', 1050, 0.55), popIn(prop('bunks', 140, 210, 380), r('grew up sharing') - 0.2),
    popIn(text('1 ROOM. 4 SISTERS.', 140, 100, 52, {bold: true}), r('three sisters')), popIn(prop('lamp', 640, 300, 120), r('one late night')),
    popIn(text('one late night at a time', 520, 500, 42, {bold: true, color: GREEN, w: 460}), r('one late night') + 0.6)];
});
scene('You realize you were jealous', (r, fx) => {
  fx(r('You never once'), 'paper', 0.1);
  return [fig('you-sad', 330, FEET, 0.55), fig('maya-walk', 950, FEET, 0.55), num('$186,000', 950, 0.55), popIn(title('JEALOUS OF THE NUMBER.', 80, 30, 50), 0.2), popIn(title('NOT THE WORK.', 80, 95, 50, {color: RED}), r('You never once'))];
});
scene('Walking home', (r, fx) => {
  fx(r('Would you be happier'), 'pop', 0.1);
  return [prop('moon', 1010, 60, 150), ...flip(fig('you-walk-a', 420, FEET, S), fig('you-walk-b', 420, FEET, S), 0, 60, 0.35),
    popIn(text('$186,000 = happier?', 640, 230, 52, {bold: true, color: RED}), r('Would you be happier'))];
});
scene('Scientists have argued', (r, fx) => {
  fx(r('One famous study'), 'paper', 0.1);
  return [title('MONEY vs. HAPPINESS', 80, 50, 60), popIn(text('2010: happiness stops rising at some income?', 80, 170, 42, {bold: true, w: 1100}), r('One famous study')),
    {type: 'line', points: [[160, 470], [500, 300], [1000, 300]], color: RED, lineWidth: 7, from: r('above a certain') - 0.2, keys: [{t: r('above a certain') - 0.2, progress: 0}, {t: r('above a certain') + 1, progress: 1}]}];
});
scene('Newer research found', (r, fx) => {
  fx(r('just more slowly'), 'chime', 0.1);
  return [popIn(prop('graph', 120, 140, 540), 0), popIn(text('2023: it keeps rising for most people', 700, 160, 40, {bold: true, color: GREEN, w: 520}), r('happiness keeps rising')),
    popIn(text('...just more slowly.', 700, 290, 44, {bold: true}), r('just more slowly')), popIn(text('each extra $ matters less', 700, 380, 40, {bold: true, color: RED, w: 520}), r('Each extra dollar'))];
});
scene('More money helps', (r, fx) => {
  fx(0.2, 'pop', 0.1);
  return [prop('graph', 120, 140, 540), fig('you-walk-a', 560, 330, 0.25, {keys: [{t: 0, x: 380, y: 290}, {t: 4, x: 520, y: 200}]}),
    popIn(title('MORE MONEY HELPS.', 720, 160, 48, {color: GREEN}), 0.2), popIn(text('but the climb gets steeper', 720, 260, 40, {bold: true, w: 520}), r('But the climb')), popIn(text('and the view changes less', 720, 340, 40, {bold: true, color: RED, w: 520}), r('and the view'))];
});

// DAY 5 — HOME
scene('On day five', (r, fx) => {
  fx(r("Your dad's number") + 0.3, 'pop', 0.12); fx(r('before the raise'), 'tap', 0.12);
  return [...day(5), prop('stove', 820, 340, 220), fig('dad', 1100, FEET, S), popIn(num('$37,000', 1100, S, 46), r("Your dad's number") + 0.3), fig('you-surprised', 560, FEET, S), num('$55,000', 560),
    popIn(text('less than your OLD $41,200', 80, 170, 40, {bold: true, color: RED, w: 600}), r('before the raise'))];
});
scene('The bike', (r, fx) => {
  ['The bike', 'The school trips', 'The laptop'].forEach(s => fx(r(s), 'pop', 0.1)); fx(r('All of it'), 'chime', 0.1);
  return [popIn(prop('bike', 100, 220, 260), 0), popIn(prop('backpack', 470, 230, 150), r('The school trips')), popIn(prop('laptop-gift', 750, 230, 240), r('The laptop')),
    popIn(title('ALL FROM $37,000.', 160, 470, 64, {color: GREEN}), r('All of it'))];
});
scene('You realize a salary tells', (r, fx) => {
  fx(r('It tells you nothing'), 'paper', 0.1);
  return [prop('stove', 820, 340, 220), fig('dad', 1100, FEET, S), num('$37,000', 1100), fig('you-think', 600, FEET, 0.55),
    popIn(title('WHAT THEY EARN...', 80, 30, 50), 0.2), popIn(title('...IS NOT WHAT THEY GAVE.', 80, 95, 50, {color: RED}), r('It tells you nothing'))];
});
scene('Later, you ask your dad', (r, fx) => {
  fx(r('He laughs'), 'pop', 0.1);
  return [prop('table-home', 430, 360, 420), fig('you-sit-listen', 360, SIT_FEET, S), fig('dad-laugh', 920, SIT_FEET, S, {from: r('He laughs')}), fig('dad', 950, FEET, S, {to: r('He laughs')}),
    popIn(text('"Of course I did."', 680, 90, 44, {bold: true}), r('Of course I did')), popIn(text('"But I wanted to be home for dinner more."', 300, 170, 42, {bold: true, color: GREEN, w: 900}), r('But I wanted'))];
});
scene('After dinner, you find your mum', (r, fx) => {
  ['Every column', 'Every bill paid', 'For thirty years'].forEach(s => fx(r(s), 'tap', 0.1));
  return [prop('table-mum', 600, 360, 420), fig('mum-sit', 1000, SIT_FEET, S), popIn(numSit('$24,000', 1000, S, 40), 0.6),
    popIn(text('+ every column balanced', 80, 140, 42, {bold: true, color: GREEN}), r('Every column')), popIn(text('+ every bill paid', 80, 220, 42, {bold: true, color: GREEN}), r('Every bill paid')),
    popIn(text('30 YEARS', 80, 300, 56, {bold: true, color: RED}), r('For thirty years')), popIn(text('nobody went without', 80, 400, 42, {bold: true}), r('But nobody'))];
});
scene('You sit down next to her', (r, fx) => {
  fx(r('teach you'), 'paper', 0.1);
  return [prop('table-mum', 600, 360, 420), fig('you-sit-listen', 520, SIT_FEET, S), fig('mum-sit', 1000, SIT_FEET, S, {to: r('teach you')}), fig('mum-smile', 1000, SIT_FEET, S, {from: r('teach you')}),
    popIn(prop('heart', 760, 150, 80), r('teach you') + 0.4), popIn(title('"TEACH ME."', 80, 100, 60, {color: GREEN}), r('teach you'))];
});

// DAY 6 — EVERYONE CAN SEE
scene('Then, on day six', (r, fx) => {
  fx(r('something changes'), 'pop', 0.14);
  return [...day(6), popIn(prop('tv', 440, 150, 400), r('something changes'))];
});
scene("It isn't just you anymore", (r, fx) => {
  const row = [['q1', 160, '$48,000'], ['q3', 400, '$63,500'], ['q4', 640, '$22,000'], ['q2', 880, '$410,000'], ['q5', 1120, '$31,000']];
  row.forEach((_, i) => fx(r('Everyone can see') + i * 0.3, 'pop', 0.07));
  return [popIn(title('EVERYONE CAN SEE.', 80, 50, 60, {color: RED}), r('Everyone can see')), ...row.flatMap(([n, cx, a], i) => [fig(n, cx, FEET, 0.48), popIn(num(a, cx, 0.48, 30), r('Everyone can see') + i * 0.3)])];
});
scene('And the world goes a little', (r, fx) => {
  fx(0.5, 'tap', 0.12);
  return [title('THE WORLD GOES CRAZY.', 80, 50, 56), ...flip(fig('n-angry-a', 260, FEET, 0.55), fig('n-angry-a', 265, FEET, 0.55, {}), 0, 60, 0.25), fig('n-angry-b', 560, FEET, 0.55), num('$31,000', 260, 0.55), num('$96,000', 560, 0.55),
    fig('n-sad', 950, FEET, 0.55), popIn(prop('hat', 895, 200, 110), 0.8)];
});
scene('Landlords start raising', (r, fx) => {
  fx(0.6, 'pop', 0.1); fx(r('Charities'), 'pop', 0.1);
  return [prop('house', 120, 260, 220), popIn(prop('sign-rent', 120, 160, 220), 0.6), popIn(text('$310,000 tenant', 120, 500, 36, {bold: true, color: GREEN}), 0.9),
    prop('building', 820, 140, 200), popIn(prop('sign-donate', 560, 320, 230), r('Charities')), popIn(text('richest doors only', 560, 460, 36, {bold: true, color: RED}), r('Charities') + 0.6)];
});
scene('And for the first time', (r, fx) => {
  fx(r('exactly how big'), 'tap', 0.1);
  const eyes = [['q1', 760], ['q4', 960], ['q3', 1160]];
  return [...flip(fig('boss-walk-a', 300, FEET, S, {keys: [{t: 0, x: 40}, {t: 5, x: 200}]}), fig('boss-walk-b', 300, FEET, S, {keys: [{t: 0, x: 40}, {t: 5, x: 200}]}), 0, 60, 0.35),
    text('$212,000', 120, 95, 44, {bold: true, color: GREEN, keys: [{t: 0, x: 90}, {t: 5, x: 250}]}), ...eyes.map(([n, cx]) => fig(n, cx, FEET, 0.45)),
    popIn(title('THE GAP.', 700, 60, 70, {color: RED}), r('exactly how big'))];
});
scene('At your office', (r, fx) => {
  fx(r('Even Kevin'), 'pop', 0.12);
  return [prop('door-hr', 60, 210, 200), ...['q1', 'q2', 'q3', 'q4', 'q5'].map((n, i) => fig(n, 360 + i * 150, FEET, 0.45)), fig('kevin-stand', 1150, FEET, 0.45, {from: r('Even Kevin')}),
    popIn(text('KEVIN?!', 1080, 160, 50, {bold: true, color: RED, w: 190}), r('Even Kevin'))];
});
scene('You finally ask him', (r, fx) => {
  fx(r('He looks embarrassed'), 'tap', 0.1);
  return [fig('you-skeptic', 380, FEET, 0.55), num('$55,000', 380, 0.55), fig('kevin-stand', 880, FEET, 0.55, {to: r('He looks embarrassed')}), fig('kevin-embarrassed', 880, FEET, 0.55, {from: r('He looks embarrassed')}), num('$58,000', 880, 0.55),
    popIn(text('"How do you make more than me?"', 80, 30, 44, {bold: true, w: 900}), 0.3)];
});
scene('When they offered me', (r, fx) => {
  fx(r('They said yes'), 'chime', 0.12);
  return [popIn(text('YEARS AGO...', 80, 50, 44, {bold: true, color: RED}), 0), fig('kevin-ask', 360, FEET, 0.55), fig('boss', 900, FEET, 0.55),
    popIn(text('"I just asked for more."', 80, 120, 48, {bold: true}), r('I just asked')), popIn(text('"YES."', 880, 120, 56, {bold: true, color: GREEN}), r('They said yes'))];
});
scene("That's it.", (r, fx) => {
  fx(0.3, 'pop', 0.1);
  return [popIn(title('ONE SENTENCE.', 80, 160, 90), 0.2), popIn(title('YEARS AGO.', 80, 290, 90, {color: RED}), r('years ago')), fig('kevin-embarrassed', 1050, FEET, S)];
});
scene("That's the thing about salaries", (r, fx) => {
  fx(r('A small difference'), 'pop', 0.1); fx(r('because every raise'), 'paper', 0.1);
  return [popIn(prop('stairs', 120, 200, 560), r('A small difference')), popIn(text('small gap at the start...', 720, 220, 44, {bold: true, w: 520}), r('A small difference')),
    popIn(text('...follows you for years.', 720, 300, 44, {bold: true, color: RED, w: 520}), r('follows you for years')),
    popIn(text('every raise builds on it', 720, 400, 40, {bold: true, color: GREEN, w: 520}), r('because every raise'))];
});
scene("Here's the wild part", (r, fx) => {
  fx(r('This has actually'), 'chime', 0.12); fx(r('In Norway'), 'pop', 0.12);
  return [popIn(title('THIS ACTUALLY HAPPENED.', 80, 50, 60, {color: RED}), r('This has actually')), popIn(prop('sign-norway', 120, 200, 280), r('In Norway')),
    popIn(prop('doc-public', 520, 200, 280), r('public records')), fig('you-surprised', 1050, FEET, S)];
});
scene('And in 2001', (r, fx) => {
  fx(0.2, 'pop', 0.12); fx(r('in seconds'), 'tap', 0.12);
  return [popIn(title('2001: ONLINE.', 80, 50, 64), 0.1), prop('desk', 140, 260, 420), fig('n-search', 180, SIT_FEET, 0.55), popIn(prop('laptop-search', 640, 160, 420), r('those records went online')),
    popIn(text('anyone. in seconds.', 690, 470, 44, {bold: true, color: RED}), r('in seconds'))];
});
scene('Economists studied', (r, fx) => {
  fx(r('the happiness gap'), 'paper', 0.12);
  return [title('WHAT HAPPENED NEXT?', 80, 50, 56), popIn(prop('thermo-rich', 300, 170, 130, {keys: [{t: r('the happiness gap'), y: 190}, {t: r('the happiness gap') + 1, y: 160}]}), r('When everyone')),
    popIn(prop('thermo-poor', 520, 170, 130, {keys: [{t: r('the happiness gap'), y: 160}, {t: r('the happiness gap') + 1, y: 200}]}), r('When everyone') + 0.3),
    popIn(title('THE GAP GREW.', 760, 260, 64, {color: RED}), r('people grew') - 0.3)];
});
scene("Seeing other people's numbers", (r, fx) => {
  fx(r('feel poorer'), 'tap', 0.1);
  return [fig('n-sad', 640, FEET, S), num('$48,000', 640), popIn(text('not richer.', 80, 140, 56, {bold: true}), r('richer')), popIn(text('just FELT poorer.', 80, 230, 56, {bold: true, color: RED}), r('feel poorer'))];
});
scene('Years later, Norway', (r, fx) => {
  fx(r('so people could see'), 'pop', 0.12);
  return [prop('laptop-search', 120, 150, 420, {to: r('so people could see')}), prop('laptop-eye', 120, 150, 420, {from: r('so people could see')}),
    popIn(title('SEARCHES = TRACEABLE.', 600, 160, 50), 0.4), popIn(text('they can see who looked', 600, 260, 44, {bold: true, color: RED, w: 600}), r('so people could see'))];
});
scene('Searches fell from', (r, fx) => {
  fx(0.3, 'pop', 0.1); fx(r('about two million'), 'pop', 0.1);
  return [title('SEARCHES PER YEAR', 80, 50, 54), popIn(prop('sign-16m', 150, 190, 300), 0.3), {type: 'arrow', x: 480, y: 360, w: 240, keys: [{t: r('about two million') - 0.6, progress: 0}, {t: r('about two million'), progress: 1}]},
    popIn(prop('sign-2m', 780, 400, 150), r('about two million'))];
});

// DAY 7 — THE JANITOR
scene('Remember the number', (r, fx) => {
  fx(r('ruin your life'), 'tap', 0.14);
  return [prop('calendar-day7', 90, 170, 560), popIn(text('$?,???,???', 700, 110, 58, {bold: true, color: RED}), 0.2), fig('you-nervous', 960, FEET, S, {from: r('ruin your life')}), fig('you-calm', 960, FEET, S, {to: r('ruin your life')})];
});
scene('On day seven', (r, fx) => [...day(7), ...flip(fig('you-walk-a', 640, FEET, S), fig('you-walk-b', 640, FEET, S), 0, 60, 0.35), num('$55,000', 640), prop('building', 980, 150, 230)]);
scene("It's above the quiet janitor", (r, fx) => {
  fx(r('thirty years'), 'paper', 0.1);
  return [...flip(fig('janitor', 640, FEET, S), fig('janitor', 650, FEET, S, {}), 0, 60, 0.45), text('$?,???,???', 520, 100, 48, {bold: true, color: RED}), popIn(text('30 YEARS HERE', 900, 260, 44, {bold: true}), r('thirty years')), fig('you-calm', 200, FEET, 0.5)];
});
scene('Nine point eight million', (r, fx) => {
  fx(0.1, 'chime', 0.16); fx(1.2, 'paper', 0.14);
  return [fig('janitor', 900, FEET, S), popIn(text('$9,800,000', 600, 90, 72, {bold: true, color: GREEN}), 0.05), fig('you-calm', 300, FEET, S, {to: 1.1}), fig('you-drop', 300, FEET, S, {from: 1.1}),
    popIn(prop('coffee-spill', 300, 520, 150), 1.2)];
});
scene('He bought the building', (r, fx) => {
  ['Saved every month', 'Never told anyone'].forEach(s => fx(r(s), 'tap', 0.1));
  return [popIn(prop('doc-shares', 80, 140, 280), 0.2), popIn(text('SAVED EVERY MONTH.', 420, 180, 50, {bold: true, color: GREEN}), r('Saved every month')),
    popIn(text('TOLD NO ONE.', 420, 270, 50, {bold: true, color: RED}), r('Never told anyone')), fig('janitor', 1080, FEET, 0.55)];
});
scene('Today, the dividends', (r, fx) => {
  fx(r('in the office combined'), 'chime', 0.12);
  return [prop('coins-big', 140, 150, 180), popIn(title('DIVIDENDS', 80, 60, 46, {color: GREEN}), 0.1), ...['q1', 'q2', 'q4', 'q5', 'kevin-stand'].map((n, i) => fig(n, 560 + i * 150, FEET, 0.4)),
    popIn(text('> the whole office combined', 520, 120, 44, {bold: true, color: RED, w: 720}), r('in the office combined'))];
});
scene('He waves at you', (r, fx) => {
  fx(0.2, 'pop', 0.08);
  return [...flip(fig('janitor-wave', 880, FEET, S), fig('janitor', 880, FEET, S), 0, 60, 0.4), num('$9,800,000', 880, S, 40), fig('you-surprised', 360, FEET, S, {to: r('Same as always')}), fig('you-wave', 360, FEET, S, {from: r('Same as always')}),
    popIn(text('same as always', 520, 470, 40, {bold: true}), r('Same as always'))];
});
scene('At lunch, you sit', (r, fx) => {
  fx(r('Why are you still here'), 'pop', 0.1); fx(r('He shrugs'), 'tap', 0.1);
  return [prop('dock', 340, 430, 600), fig('you-sit-listen', 480, SIT_FEET, 0.55), fig('janitor-sit', 820, SIT_FEET, 0.55, {to: r('He shrugs')}), fig('janitor-shrug', 820, SIT_FEET, 0.55, {from: r('He shrugs'), to: r('I like the work')}),
    fig('janitor-talk', 820, SIT_FEET, 0.55, {from: r('I like the work')}), popIn(text('"Why are you still here?"', 80, 25, 42, {bold: true}), r('Why are you still here')),
    popIn(text('"I like the work. I like the people."', 80, 80, 40, {bold: true, color: GREEN, w: 1100}), r('I like the work')),
    popIn(text('"I never needed anyone to know my number."', 80, 135, 40, {bold: true, color: RED, w: 1100}), r('never needed anyone'))];
});
scene('You ask him if he ever felt', (r, fx) => {
  fx(r('it was everything'), 'chime', 0.14);
  return [prop('dock', 340, 430, 600), fig('you-sit-listen', 480, SIT_FEET, 0.55), fig('janitor-talk', 820, SIT_FEET, 0.55),
    prop('coins-small', 1060, 120, 150, {to: r('it was everything')}), prop('coins-big', 1060, 120, 150, {from: r('it was everything')}),
    popIn(text('"Most months, it felt like nothing."', 80, 90, 42, {bold: true, w: 900}), r('Most months')), popIn(text('"...then it was everything."', 80, 170, 46, {bold: true, color: GREEN, w: 900}), r('it was everything'))];
});
scene('Then he gives you the only', (r, fx) => {
  ['Spend less', 'Own things', 'stop looking'].forEach(s => fx(r(s), 'pop', 0.1));
  return [fig('janitor-wave', 1100, FEET, 0.55), popIn(title('SPEND LESS THAN YOU MAKE.', 80, 120, 52), r('Spend less')), popIn(title('OWN THINGS THAT PAY YOU.', 80, 210, 52, {color: GREEN}), r('Own things')),
    popIn(title("STOP COMPARING NUMBERS.", 80, 300, 52, {color: RED}), r('stop looking'))];
});
scene("It didn't ruin your life", (r, fx) => {
  fx(r('It ruined the way'), 'chime', 0.1);
  return [fig('you-calm', 1000, FEET, 0.55, {to: r('It ruined the way')}), fig('you-grin', 1000, FEET, 0.55, {from: r('It ruined the way')}), num('$55,000', 1000, 0.55),
    popIn(text("It didn't ruin your life.", 80, 80, 50, {bold: true}), 0.1), popIn(text('It ruined how you judged people.', 80, 160, 50, {bold: true, color: GREEN, w: 1100}), r('It ruined the way'))];
});

// ENDING
scene('At midnight, the numbers fade', (r, fx) => {
  const row = [['p-barista', 160, '$29,000'], ['p-suit', 400, '$34,000'], ['janitor', 640, '$9,800,000'], ['p-jogger', 880, '$96,500'], ['p-dogwalker', 1120, '$1,250,000']];
  return [prop('moon', 1060, 30, 130), prop('clock', 60, 30, 130), ...row.flatMap(([n, cx, a], i) => [fig(n, cx, FEET, 0.45), fadeOut(num(a, cx, 0.45, 28), 0.5 + i * 0.35, 1 + i * 0.35)])];
});
scene('The last one to go is your own', (r, fx) => {
  fx(r('A price someone'), 'paper', 0.1);
  return [prop('mirror', 760, 50, 380), fig('you-calm', 540, FEET, S), fig('you-calm-m', 950, 515, 0.42), prop('sink', 800, 400, 300),
    fadeOut(text('$55,000', 870, 160, 44, {bold: true, color: GREEN}), r('A price someone') + 2, r('A price someone') + 3),
    popIn(text('a grade?', 80, 80, 50, {bold: true, color: RED}), r('felt like a grade')), popIn(text('a price for your time.', 80, 160, 50, {bold: true, color: GREEN, w: 600}), r('A price someone'))];
});
scene('It says nothing about your dad', (r, fx) => {
  ["your dad's cooking", "your mum's notebook", 'or the janitor'].forEach(s => fx(r(s), 'pop', 0.1));
  return [popIn(prop('stove', 120, 230, 220), r("your dad's cooking")), popIn(prop('table-mum', 420, 300, 380), r("your mum's notebook")), popIn(fig('janitor-wave', 1050, FEET, 0.5), r('or the janitor')),
    title('A NUMBER SAYS NOTHING ABOUT...', 80, 50, 50)];
});
scene("Here's what seven days", (r, fx) => {
  const lessons = [["1. YOU CAN'T READ WEALTH FROM CLOTHES.", "You can't read wealth"], ['2. NOT KNOWING COSTS MONEY. ASK.', 'Not knowing'], ['3. COMPARING STEALS HAPPINESS.', 'Comparing numbers'], ['4. THE NUMBER IS THE LEAST INTERESTING PART.', 'And the number above']];
  lessons.forEach(([, s]) => fx(r(s), 'tap', 0.1));
  return [title('7 DAYS TAUGHT YOU:', 80, 50, 60, {color: RED}), ...lessons.map(([t, s], i) => popIn(text(t, 80, 160 + i * 85, 44, {bold: true, color: i % 2 ? GREEN : INK, w: 1120}), r(s)))];
});
scene('Tomorrow, you wake up', (r, fx) => {
  fx(r('Karma'), 'chime', 0.16);
  return [prop('mirror', 760, 50, 380), fig('you-calm', 430, FEET, S, {to: r('Karma')}), fig('you-startled', 430, FEET, 0.62, {from: r('Karma')}), fig('you-calm-m', 950, 515, 0.42), prop('sink', 800, 400, 300),
    popIn(text('+73', 900, 150, 56, {bold: true, color: GREEN}), r('Karma')), popIn(text('Not money.', 80, 90, 50, {bold: true}), r('Not money')), popIn(title('KARMA.', 80, 170, 80, {color: RED}), r('Karma'))];
});
scene('If you want to see what happens', (r, fx) => {
  fx(r('subscribe') + 0.4, 'tap', 0.16);
  return [popIn(prop('subscribe', 470, 300, 340), r('subscribe')), fig('you-calm', 300, FEET, S, {to: r('subscribe') + 0.3}), fig('you-tap', 300, FEET, S, {from: r('subscribe') + 0.3}),
    popIn(title("NEXT: WHAT IF YOU COULD SEE EVERYONE'S KARMA?", 80, 60, 46, {color: RED}), 0.2), popIn(text('the numbers change again...', 470, 460, 44, {bold: true}), r('Because tomorrow'))];
});

scenes.forEach((sc, i) => {
  const start = +sc.start.toFixed(3), end = i + 1 < scenes.length ? +scenes[i + 1].start.toFixed(3) : END;
  const r = snippet => +(at(snippet, start) - start).toFixed(3);
  const fx = (rel, kind, gain) => sfx.push({time: +(start + rel).toFixed(3), kind, gain});
  // Flipbooks and late pop-ins can overrun a short shot: clip them to its span.
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
    if (l.type !== 'text' || !/^[$+]/.test(l.text)) continue;
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
