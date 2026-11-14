import fs from 'node:fs';
import path from 'node:path';

const LEAD = 0.15, TAIL = 0.5;
const NARRATION_DUR = 18.660;
const TOTAL_DUR = +(NARRATION_DUR + LEAD + TAIL).toFixed(3); // 19.310

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

const prop = (name, x, y, w, extra = {}) => ({ type: 'image', path: `art/${name}.png`, x, y, w, ...extra });
const text = (t, x, y, size, extra = {}) => ({ type: 'text', text: t, x, y, size, ...extra });

const popIn = (layer, at) => ({
  ...layer,
  from: at,
  keys: [
    { t: at, y: layer.y + 20, alpha: 0 },
    { t: +(at + 0.22).toFixed(3), y: layer.y, alpha: 1 }
  ]
});

function flip(a, b, t0, t1, step) {
  const out = [];
  for (let t = t0, i = 0; t < t1 - 0.01; t += step, i++) {
    const from = +t.toFixed(3);
    const to = +Math.min(t + step, t1).toFixed(3);
    if (from < to) out.push({ ...(i % 2 ? b : a), from, to });
  }
  return out;
}

const shots = [];
const sfx = [];

function shot(start, end, rawLayers) {
  const span = +(end - start).toFixed(3);
  const layers = rawLayers.map(l => {
    const out = { ...l };
    if (out.from !== undefined) out.from = +Math.min(out.from, span - 0.01).toFixed(3);
    if (out.to !== undefined) out.to = +Math.min(out.to, span - 0.005).toFixed(3);
    if (out.keys) {
      out.keys = out.keys.map(k => ({ ...k, t: +Math.min(k.t, span - 0.005).toFixed(3) }));
    }
    return out;
  });
  shots.push({ start: +start.toFixed(3), end: +end.toFixed(3), layers });
}

// -------------------------------------------------------------
// SHOT 1 (0 to 3.35s): The Game Show Question (span: 3.35s)
// "Ask an AI: how many R's are in strawberry?"
// -------------------------------------------------------------
{
  const span = 3.35;
  const hA = fig('magi-host-a', 260, 580, 0.58);
  const hB = fig('magi-host-b', 260, 580, 0.58);
  const bA = fig('bot-nervous-a', 1040, 580, 0.58);
  const bB = fig('bot-nervous-b', 1040, 580, 0.58);

  shot(0, span, [
    ...flip(hA, hB, 0, span, 0.24),
    prop('podium', 220, 370, 180),
    ...flip(bA, bB, 0, span, 0.18),
    prop('buzzer-idle', 830, 450, 150),
    popIn(text("HOW MANY R's IN STRAWBERRY?", 200, 75, 54, { bold: true, color: '#191916' }), 0.35),
    {
      type: 'underline',
      x: 200,
      y: 145,
      w: 860,
      color: '#E8B32A',
      keys: [{ t: 0.6, progress: 0 }, { t: 2.2, progress: 1 }]
    }
  ]);
  sfx.push(
    { time: 0.4, kind: 'pop', gain: 0.15 },
    { time: 1.8, kind: 'tap', gain: 0.12 }
  );
}

// -------------------------------------------------------------
// SHOT 2 (3.35 to 7.45s): The Violent Buzzer Slam & Failure (span: 4.10s)
// "It slams the buzzer and screams: TWO! Completely wrong."
// -------------------------------------------------------------
{
  shot(3.35, 7.45, [
    fig('magi-shock', 230, 580, 0.62),
    prop('podium', 220, 370, 180),
    popIn(text("WAIT WHAT?!", 140, 180, 50, { bold: true, color: '#6B4BD8' }), 0.6),
    fig('bot-slam', 950, 600, 0.62),
    prop('buzzer-pressed', 830, 470, 150),
    popIn(text("TWO!!", 780, 170, 96, { bold: true, color: '#EC4338' }), 0.2),
    {
      ...prop('cross-x', 900, 140, 220),
      from: 1.1,
      keys: [
        { t: 1.1, y: -150, alpha: 0 },
        { t: 1.4, y: 140, alpha: 1 }
      ]
    },
    popIn(text("WRONG.", 910, 375, 58, { bold: true, color: '#EC4338' }), 1.5)
  ]);
  sfx.push(
    { time: 3.55, kind: 'tap', gain: 0.25 },
    { time: 4.1, kind: 'pop', gain: 0.16 },
    { time: 4.6, kind: 'pop', gain: 0.22 },
    { time: 5.0, kind: 'paper', gain: 0.15 }
  );
}

// -------------------------------------------------------------
// SHOT 3 (7.45 to 11.55s): Second-Hand Embarrassment (span: 4.10s)
// "Because 'berry' has two R's, and it never bothered to spell it out."
// -------------------------------------------------------------
{
  const span = 4.1;
  const fA = fig('magi-facepalm-a', 360, 580, 0.62);
  const fB = fig('magi-facepalm-b', 360, 580, 0.62);

  shot(7.45, 11.55, [
    ...flip(fA, fB, 0, span, 0.22),
    popIn(text("IT ONLY SAW 'BERRY'.", 590, 160, 52, { bold: true, color: '#191916' }), 0.35),
    popIn(text("BERRY = 2 R's", 590, 240, 56, { bold: true, color: '#EC4338' }), 1.1),
    {
      type: 'underline',
      x: 590,
      y: 315,
      w: 360,
      color: '#EC4338',
      keys: [{ t: 1.2, progress: 0 }, { t: 1.9, progress: 1 }]
    },
    popIn(text("DID NOT SPELL IT OUT!", 590, 345, 46, { bold: true, color: '#B45309' }), 1.8)
  ]);
  sfx.push(
    { time: 7.8, kind: 'paper', gain: 0.14 },
    { time: 8.55, kind: 'pop', gain: 0.16 },
    { time: 9.3, kind: 'tap', gain: 0.12 }
  );
}

// -------------------------------------------------------------
// SHOT 4 (11.55 to 15.75s): The Detective & Hidden Thinking (span: 4.20s)
// "Enter the reasoning model: Generating secret thinking tokens."
// -------------------------------------------------------------
{
  const span = 4.2;
  const dA = fig('detective-think-a', 280, 580, 0.62);
  const dB = fig('detective-think-b', 280, 580, 0.62);

  shot(11.55, 15.75, [
    ...flip(dA, dB, 0, span, 0.22),
    popIn(prop('think-cloud', 240, 90, 240), 0.45),
    popIn(text("SECRET SCRATCHPAD:", 580, 80, 48, { bold: true, color: '#6B4BD8' }), 1.1),
    {
      ...prop('notepad-strawberry', 580, 150, 480),
      from: 1.2,
      keys: [
        { t: 1.2, y: 680, alpha: 0 },
        { t: 1.7, y: 150, alpha: 1 }
      ]
    }
  ]);
  sfx.push(
    { time: 11.9, kind: 'pop', gain: 0.16 },
    { time: 12.7, kind: 'paper', gain: 0.18 },
    { time: 13.4, kind: 'chime', gain: 0.15 }
  );
}

// -------------------------------------------------------------
// SHOT 5 (15.75 to TOTAL_DUR): The Triumphant Victory (span: 3.56s)
// "One, two, three. Solved."
// -------------------------------------------------------------
{
  shot(15.75, TOTAL_DUR, [
    fig('detective-solved', 300, 580, 0.65),
    popIn(prop('check-mark', 880, 120, 200), 0.3),
    popIn(text("3 R's! SOLVED.", 650, 230, 68, { bold: true, color: '#2F8A4A' }), 0.5),
    {
      type: 'underline',
      x: 650,
      y: 315,
      w: 430,
      color: '#2F8A4A',
      keys: [{ t: 0.7, progress: 0 }, { t: 1.5, progress: 1 }]
    },
    popIn(text("REASONING MODELS WIN.", 650, 360, 48, { bold: true, color: '#191916' }), 1.1)
  ]);
  sfx.push(
    { time: 16.1, kind: 'chime', gain: 0.22 },
    { time: 16.6, kind: 'pop', gain: 0.18 },
    { time: 17.4, kind: 'chime', gain: 0.24 }
  );
}

const captions = JSON.parse(fs.readFileSync(new URL('./captions.json', import.meta.url)));
const project = {
  version: 1,
  style: 'B1',
  width: 1280,
  height: 720,
  fps: 30,
  voice: { path: 'narration.wav', lead: LEAD, tail: TAIL },
  captions,
  shots,
  sfx: sfx.sort((a, b) => a.time - b.time)
};

fs.writeFileSync(new URL('./project.json', import.meta.url), JSON.stringify(project, null, 1));
console.log(`✓ Project written: ${shots.length} shots, ${captions.length} captions, ${sfx.length} sfx, end time ${shots.at(-1).end}s (Target total: ${TOTAL_DUR}s)`);
