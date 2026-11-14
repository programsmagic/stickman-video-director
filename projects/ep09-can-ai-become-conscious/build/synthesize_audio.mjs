import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const dir = path.resolve('projects/ep09-can-ai-become-conscious/build/narration');
const acts = ['act1', 'act2', 'act3', 'act4', 'act5'];

console.log('--- Synthesizing Episode 09 Narration (Gemini Bodi Studio Voice) ---');

for (const act of acts) {
  const txt = path.join(dir, `${act}.txt`);
  const wav = path.join(dir, `${act}.wav`);

  if (fs.existsSync(wav)) {
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

console.log('\n🎉 All 5 acts of Episode 09 voice narration synthesized!');

