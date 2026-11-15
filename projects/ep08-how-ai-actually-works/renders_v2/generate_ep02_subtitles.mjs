import fs from 'node:fs';
import path from 'node:path';

const ACTS = [
  { id: 1, file: 'projects/ep08-how-ai-actually-works/renders_v2/narration/act1.txt', duration: 114.40 },
  { id: 2, file: 'projects/ep08-how-ai-actually-works/renders_v2/narration/act2.txt', duration: 122.96 },
  { id: 3, file: 'projects/ep08-how-ai-actually-works/renders_v2/narration/act3.txt', duration: 121.28 },
  { id: 4, file: 'projects/ep08-how-ai-actually-works/renders_v2/narration/act4.txt', duration: 111.76 },
  { id: 5, file: 'projects/ep08-how-ai-actually-works/renders_v2/narration/act5.txt', duration: 107.64 },
  { id: 6, file: 'projects/ep08-how-ai-actually-works/renders_v2/narration/act6.txt', duration: 120.96 },
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
  // Normalize quotes and clean up text
  const cleaned = text
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  // Split into sentences first
  const sentenceRegex = /([^\.!\?]+[\.!\?]+)/g;
  const rawSentences = cleaned.match(sentenceRegex) || [cleaned];
  
  const phrases = [];
  for (const raw of rawSentences) {
    const s = raw.trim();
    if (!s) continue;
    // If sentence is short, keep as single phrase
    if (s.length <= 54) {
      phrases.push(s);
    } else {
      // Split on punctuation without separating the punctuation
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

function generateSrt() {
  console.log('Generating Precision SRT Subtitles for Episode 02...');
  let cumulativeTime = 0;
  let cueIndex = 1;
  const srtEntries = [];

  for (const act of ACTS) {
    const text = fs.readFileSync(path.resolve(act.file), 'utf8');
    const phrases = splitIntoPhrases(text);

    // Calculate weight per phrase based on character and word count
    const phraseWeights = phrases.map(p => {
      const words = p.split(/\s+/).length;
      const chars = p.length;
      return chars * 0.4 + words * 2.5;
    });

    const totalWeight = phraseWeights.reduce((a, b) => a + b, 0);
    // Allocate 95% of act duration to active speech, with small intro/outro padding
    const usableDuration = act.duration * 0.96;
    const startPadding = act.duration * 0.02;

    let actOffset = cumulativeTime + startPadding;

    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[i];
      const durationFraction = phraseWeights[i] / totalWeight;
      const phraseDuration = durationFraction * usableDuration;
      
      const startTime = actOffset;
      const endTime = actOffset + phraseDuration - 0.06; // slight gap between subtitles

      srtEntries.push({
        index: cueIndex++,
        start: formatTime(startTime),
        end: formatTime(Math.max(startTime + 0.5, endTime)),
        text: phrase
      });

      actOffset += phraseDuration;
    }

    cumulativeTime += act.duration;
  }

  // Format into SRT string
  const srtContent = srtEntries.map(e => `${e.index}\n${e.start} --> ${e.end}\n${e.text}\n`).join('\n');

  const outExport = path.resolve('exports/EP02-How-AI-Actually-Works-Final.en.srt');
  const outBuild = path.resolve('projects/ep08-how-ai-actually-works/build/output/ep02-how-ai-actually-works.en.srt');

  fs.mkdirSync(path.dirname(outExport), { recursive: true });
  fs.mkdirSync(path.dirname(outBuild), { recursive: true });

  fs.writeFileSync(outExport, srtContent, 'utf8');
  fs.writeFileSync(outBuild, srtContent, 'utf8');

  console.log(`✓ Created ${srtEntries.length} precision cues:`);
  console.log(`  -> ${outExport}`);
  console.log(`  -> ${outBuild}`);
}

generateSrt();
