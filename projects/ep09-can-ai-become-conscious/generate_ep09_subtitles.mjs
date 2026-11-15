import fs from 'node:fs';
import path from 'node:path';

const ACTS = [
  { id: 1, file: 'projects/ep09-can-ai-become-conscious/build/narration/act1.txt', duration: 56.36 },
  { id: 2, file: 'projects/ep09-can-ai-become-conscious/build/narration/act2.txt', duration: 64.60 },
  { id: 3, file: 'projects/ep09-can-ai-become-conscious/build/narration/act3.txt', duration: 67.96 },
  { id: 4, file: 'projects/ep09-can-ai-become-conscious/build/narration/act4.txt', duration: 72.04 },
  { id: 5, file: 'projects/ep09-can-ai-become-conscious/build/narration/act5.txt', duration: 71.48 },
];

function formatTime(seconds) {
  const pad = (n, w = 2) => String(Math.floor(n)).padStart(w, '0');
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function splitIntoPhrases(text) {
  const cleaned = text
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  const sentenceRegex = /([^\.!\?]+[\.!\?]+)/g;
  const rawSentences = cleaned.match(sentenceRegex) || [cleaned];
  
  const phrases = [];
  for (const raw of rawSentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length <= 54) {
      phrases.push(s);
    } else {
      const parts = s.split(/,\s+|;\s+|--\s+|\s+--\s+/);
      let buf = '';
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (!p) continue;
        if (!buf) {
          buf = p;
        } else if (buf.length + p.length < 54) {
          buf += ', ' + p;
        } else {
          phrases.push(buf);
          buf = p;
        }
      }
      if (buf.trim()) phrases.push(buf.trim());
    }
  }
  return phrases.filter(p => p.length > 1 && !/^[,\.\?!;:\-]+$/.test(p));
}

let srtCues = [];
let cueIndex = 1;
let timelineOffset = 0;

console.log('=== GENERATING WORD-ALIGNED SUBTITLES FOR EPISODE 03 (EP09) ===');

for (const act of ACTS) {
  const rawText = fs.readFileSync(path.resolve(act.file), 'utf8');
  const phrases = splitIntoPhrases(rawText);
  
  const totalChars = phrases.reduce((acc, p) => acc + p.length, 0);
  const totalActDuration = act.duration;
  
  let actCursor = 0.4;
  const usableDuration = totalActDuration - 0.8;
  
  for (const phrase of phrases) {
    const fraction = phrase.length / totalChars;
    const dur = Math.max(1.5, fraction * usableDuration);
    const startSec = timelineOffset + actCursor;
    const endSec = Math.min(timelineOffset + totalActDuration - 0.1, startSec + dur - 0.15);
    
    srtCues.push({
      index: cueIndex++,
      start: formatTime(startSec),
      end: formatTime(endSec),
      text: phrase
    });
    
    actCursor += dur;
  }
  
  console.log(`Act ${act.id}: ${phrases.length} cues generated across ${act.duration}s`);
  timelineOffset += act.duration;
}

const srtContent = srtCues.map(c => `${c.index}\n${c.start} --> ${c.end}\n${c.text}\n`).join('\n');

const OUT_PATH_1 = path.resolve('exports/EP09-Can-AI-Become-Conscious-Final.en.srt');
const OUT_PATH_2 = path.resolve('exports/EP03-Can-AI-Ever-Become-Conscious.en.srt');
fs.writeFileSync(OUT_PATH_1, srtContent);
fs.writeFileSync(OUT_PATH_2, srtContent);

console.log(`\n🎉 Success! Wrote ${srtCues.length} subtitle cues to:`);
console.log(`   - ${OUT_PATH_1}`);
console.log(`   - ${OUT_PATH_2}`);
