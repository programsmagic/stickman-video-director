import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const dir = path.resolve('projects/ep10-geometry-of-thinking/build/narration');
const acts = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6'];

console.log('--- Synthesizing Episode 04 Narration (Gemini Bodi Studio Voice) ---');

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

console.log('\n🎉 All 6 acts of Episode 04 voice narration synthesized!');
