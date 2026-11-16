import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const dir = path.resolve('projects/ep16-post-training-alignment/build/narration');
const acts = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6'];

console.log('--- Synthesizing Episode 10 Narration (Gemini Bodi Studio Voice) ---');

for (const act of acts) {
  const txt = path.join(dir, `${act}.txt`);
  const wav = path.join(dir, `${act}.wav`);

  if (fs.existsSync(wav) && fs.statSync(wav).size > 1000) {
    console.log(`✓ ${act}.wav already exists, skipping.`);
    continue;
  }

  console.log(`\nSynthesizing ${act} with Gemini Bodi...`);
  try {
    const cmd = `node skills/directing-stickman-videos/scripts/gemini-media.mjs speech --model gemini-3.8-flash-tts --voice Bodi --text "${txt}" --output "${wav}" --allow-network`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✓ Generated: ${wav}`);
  } catch (err) {
    console.error(`Error synthesizing ${act}:`, err.message);
    throw err;
  }
}

console.log('\n🎉 All 6 acts of Episode 10 voice narration synthesized!');

// Assemble full_feature.wav using FFmpeg concat
const fullWav = path.join(dir, 'full_feature.wav');
console.log('\nAssembling master full_feature.wav...');
const concatList = path.join(dir, 'concat.txt');
const listContent = acts.map(a => `file '${path.join(dir, `${a}.wav`)}'`).join('\n');
fs.writeFileSync(concatList, listContent);

execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${fullWav}"`, { stdio: 'inherit' });
fs.unlinkSync(concatList);
console.log(`✓ Master audio complete: ${fullWav}`);
