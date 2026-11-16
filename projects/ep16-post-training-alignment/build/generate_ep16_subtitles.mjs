import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BUILD_DIR = path.resolve('projects/ep16-post-training-alignment/build');
const NARRATION_DIR = path.join(BUILD_DIR, 'narration');

const acts = [
  { id: 'act1', name: 'The Wild Computational Stallion' },
  { id: 'act2', name: 'Supervised Fine-Tuning (SFT & The Demonstrator)' },
  { id: 'act3', name: 'Preference Duels & The Bradley-Terry Reward Model' },
  { id: 'act4', name: 'PPO & The KL Divergence Electric Fence' },
  { id: 'act5', name: 'Direct Preference Optimization (DPO & The Math Shortcut)' },
  { id: 'act6', name: 'Refusal Steering Vectors & The Aligned Mind' }
];

console.log('=== Generating Precision Subtitles for Episode 10: Post-Training & Alignment ===');

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
      const sentDur = words.length * secPerWord;
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

function formatSRTTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

let srtContent = '';
allCues.forEach((cue, idx) => {
  srtContent += `${idx + 1}\n`;
  srtContent += `${formatSRTTime(cue.start)} --> ${formatSRTTime(cue.end)}\n`;
  srtContent += `${cue.text}\n\n`;
});

const outPath = path.resolve('exports/EP16-Post-Training-Alignment-Final.en.srt');
fs.writeFileSync(outPath, srtContent.trim() + '\n', 'utf8');

console.log(`✓ Wrote ${allCues.length} precision subtitle cues to: ${outPath}`);
