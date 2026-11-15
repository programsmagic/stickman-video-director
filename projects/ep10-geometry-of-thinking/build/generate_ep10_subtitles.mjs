import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BUILD_DIR = path.resolve('projects/ep10-geometry-of-thinking/build');
const NARRATION_DIR = path.join(BUILD_DIR, 'narration');

const acts = [
  { id: 'act1', name: 'The Mountain in the Fog' },
  { id: 'act2', name: 'Saddle Points & The Loss Surface' },
  { id: 'act3', name: 'Gradient Descent & The Altimeter' },
  { id: 'act4', name: 'The Pulley System of Backpropagation' },
  { id: 'act5', name: 'Momentum & The Hydraulic Boots' },
  { id: 'act6', name: 'The Global Basin & Generalization' }
];

console.log('=== Generating Precision Subtitles for Episode 04: The Geometry of Thinking ===');

let globalTime = 0.0;
const allCues = [];

for (let i = 0; i < acts.length; i++) {
  const act = acts[i];
  const txtPath = path.join(NARRATION_DIR, `${act.id}.txt`);
  const wavPath = path.join(NARRATION_DIR, `${act.id}.wav`);

  if (!fs.existsSync(txtPath) || !fs.existsSync(wavPath)) {
    console.error(`Missing file for ${act.id}`);
    continue;
  }

  const text = fs.readFileSync(txtPath, 'utf8').trim();
  const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${wavPath}"`).toString().trim());

  // Split text into semantic sentences
  const rawSentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
  const sentences = rawSentences.map(s => s.trim()).filter(Boolean);

  const totalWords = text.split(/\s+/).length;
  const secPerWord = dur / totalWords;

  let actLocalTime = 0.0;
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    const sentDur = words.length * secPerWord;

    // If sentence is long (> 10 words), break into 2 natural phrases
    if (words.length > 10) {
      const mid = Math.ceil(words.length / 2);
      const part1 = words.slice(0, mid).join(' ');
      const part2 = words.slice(mid).join(' ');
      const dur1 = mid * secPerWord;
      const dur2 = (words.length - mid) * secPerWord;

      allCues.push({
        start: globalTime + actLocalTime,
        end: globalTime + actLocalTime + dur1 - 0.05,
        text: part1
      });
      actLocalTime += dur1;

      allCues.push({
        start: globalTime + actLocalTime,
        end: globalTime + actLocalTime + dur2 - 0.05,
        text: part2
      });
      actLocalTime += dur2;
    } else {
      allCues.push({
        start: globalTime + actLocalTime,
        end: globalTime + actLocalTime + sentDur - 0.05,
        text: sentence
      });
      actLocalTime += sentDur;
    }
  }

  globalTime += dur;
}

// Convert seconds to SRT timestamp 00:00:00,000
function formatSrtTime(sec) {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

let srtContent = '';
for (let idx = 0; idx < allCues.length; idx++) {
  const cue = allCues[idx];
  srtContent += `${idx + 1}\n`;
  srtContent += `${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n`;
  srtContent += `${cue.text}\n\n`;
}

const outSrt = path.resolve('exports/EP10-The-Geometry-of-Thinking-Final.en.srt');
fs.writeFileSync(outSrt, srtContent.trim() + '\n');
console.log(`✓ Generated ${allCues.length} subtitle cues: ${outSrt}`);
