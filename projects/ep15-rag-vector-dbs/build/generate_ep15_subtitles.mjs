import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BUILD_DIR = path.resolve('projects/ep15-rag-vector-dbs/build');
const NARRATION_DIR = path.join(BUILD_DIR, 'narration');

const acts = [
  { id: 'act1', name: 'The Infinite Obsidian Library (The Context Window Trap)' },
  { id: 'act2', name: 'The Geometry of Meaning: 1,536-D Vector Embeddings' },
  { id: 'act3', name: 'The HNSW Spiderweb: Searching Millions in Milliseconds' },
  { id: 'act4', name: 'The Art of Chunking & The Hybrid BM25 Bridge' },
  { id: 'act5', name: 'The Cross-Encoder Reranker: Exposing Semantic Impostors' },
  { id: 'act6', name: 'Agentic RAG: Self-Reflection & The Living Memory' }
];

console.log('=== Generating Precision Subtitles for Episode 09: RAG & Vector Databases ===');

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

const outPath = path.resolve('exports/EP15-RAG-Vector-DBs-Final.en.srt');
fs.writeFileSync(outPath, srtContent.trim() + '\n', 'utf8');

console.log(`✓ Wrote ${allCues.length} precision subtitle cues to: ${outPath}`);
