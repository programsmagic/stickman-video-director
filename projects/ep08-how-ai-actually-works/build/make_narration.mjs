import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BUILD_DIR = path.resolve('projects/ep08-how-ai-actually-works/build');
const NARRATION_DIR = path.join(BUILD_DIR, 'narration');
fs.mkdirSync(NARRATION_DIR, { recursive: true });

const segments = [
  { id: 'seg1', text: "Ask an AI: how many R's are in strawberry?", pad: 0.25 },
  { id: 'seg2a', text: "It slams the buzzer and screams: TWO!", pad: 0.15 },
  { id: 'seg2b', text: "Completely wrong.", pad: 0.25 },
  { id: 'seg3a', text: "Because 'berry' has two R's,", pad: 0.15 },
  { id: 'seg3b', text: "and it never bothered to spell it out.", pad: 0.25 },
  { id: 'seg4a', text: "Enter the reasoning model:", pad: 0.15 },
  { id: 'seg4b', text: "Generating secret thinking tokens.", pad: 0.25 },
  { id: 'seg5', text: "One, two, three. Solved.", pad: 0.4 }
];

const filesToConcat = [];
let currentTime = 0.15; // LEAD
const captions = [];

for (const item of segments) {
  const wavPath = path.join(NARRATION_DIR, `${item.id}.wav`);
  execSync(`say -v Samantha "${item.text}" -o "${wavPath}" --data-format=LEI16@24000`);
  
  const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${wavPath}"`).toString().trim());

  captions.push({
    start: +(currentTime).toFixed(3),
    end: +(currentTime + dur).toFixed(3),
    text: item.text
  });

  filesToConcat.push(wavPath);
  currentTime += dur;

  if (item.pad > 0) {
    const padPath = path.join(NARRATION_DIR, `pad_${item.id}.wav`);
    execSync(`ffmpeg -v error -y -f lavfi -i anullsrc=r=24000:cl=mono -t ${item.pad} "${padPath}"`);
    filesToConcat.push(padPath);
    currentTime += item.pad;
  }
}

const concatListPath = path.join(NARRATION_DIR, 'concat.txt');
fs.writeFileSync(concatListPath, filesToConcat.map(f => `file '${f}'`).join('\n'));

const masterWav = path.join(BUILD_DIR, 'narration.wav');
execSync(`ffmpeg -v error -y -f concat -safe 0 -i "${concatListPath}" -c:a pcm_s16le -ar 48000 "${masterWav}"`);

const totalDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${masterWav}"`).toString().trim());
console.log(`Master narration generated: ${masterWav} (Duration: ${totalDur}s)`);

fs.writeFileSync(path.join(BUILD_DIR, 'captions.json'), JSON.stringify(captions, null, 2));
console.log(`Captions generated: ${captions.length} cues`);
