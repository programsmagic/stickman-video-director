import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const dir = path.resolve('projects/ep08-how-ai-actually-works/renders_v2/narration');
const acts = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6'];

console.log('--- Synthesizing EP02 Narration (Gemini Bodi Studio Voice) ---');

for (const act of acts) {
  const txt = path.join(dir, `${act}.txt`);
  const wav = path.join(dir, `${act}.wav`);
  const receipt = `${wav}.request.json`;

  // Clear any stale receipts
  if (fs.existsSync(receipt) && !fs.existsSync(wav)) {
    fs.unlinkSync(receipt);
    console.log(`Cleared stale receipt for ${act}`);
  }

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

console.log('\n🎉 All 6 acts of EP02 voice narration synthesized!');

