import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const EXPORTS_DIR = path.resolve('exports');
const ACTS = [
  path.join(EXPORTS_DIR, 'EP02-Act1-AI-Zoo-Masterpiece.mp4'),
  path.join(EXPORTS_DIR, 'EP02-Act2-Coordinates-Masterpiece.mp4'),
  path.join(EXPORTS_DIR, 'EP02-Act3-Attention-Masterpiece.mp4'),
  path.join(EXPORTS_DIR, 'EP02-Act4-Reasoning-Masterpiece.mp4'),
  path.join(EXPORTS_DIR, 'EP02-Act5-MoE-Masterpiece.mp4'),
  path.join(EXPORTS_DIR, 'EP02-Act6-Autonomous-Masterpiece.mp4')
];

const MASTER_FEATURE = path.join(EXPORTS_DIR, 'EP02-How-AI-Actually-Works-Final.mp4');
const CONCAT_LIST = '/tmp/ep02_concat_list.txt';

console.log('=== ASSEMBLING EPISODE 02: HOW AI ACTUALLY WORKS (FULL FEATURE) ===');

// Check all act files exist
for (const act of ACTS) {
  if (!fs.existsSync(act)) {
    console.error(`Waiting or missing act file: ${act}`);
    process.exit(1);
  }
}

// Generate concat demuxer list with single quotes
const lines = ACTS.map(f => `file '${f}'`).join('\n');
fs.writeFileSync(CONCAT_LIST, lines, 'utf8');
console.log('✓ Concat list created:');
console.log(lines);

console.log('\nStitching full feature film with ffmpeg concat demuxer...');
execSync(`ffmpeg -v error -y -f concat -safe 0 -i "${CONCAT_LIST}" -c copy "${MASTER_FEATURE}"`);
console.log(`🎉 Master Feature Film Assembled: ${MASTER_FEATURE}`);

// Verify duration
const dur = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${MASTER_FEATURE}"`).toString().trim();
const totalSec = parseFloat(dur);
const min = Math.floor(totalSec / 60);
const sec = (totalSec % 60).toFixed(1);
console.log(`Total Master Runtime: ${totalSec.toFixed(2)}s (${min}m ${sec}s)`);

// Extract showcase keyframes
const showcaseDir = '/Users/prashantmishra/.gemini/antigravity/brain/db9bac9a-3426-45bb-9f51-83659698b1f1/ep02_showcase';
fs.mkdirSync(showcaseDir, { recursive: true });

const keyframes = [
  { video: ACTS[0], time: '00:01:25', name: 'ep02_act1_species_terrariums.png' },
  { video: ACTS[1], time: '00:01:35', name: 'ep02_act2_supermarket_vectors.png' },
  { video: ACTS[2], time: '00:01:10', name: 'ep02_act3_qkv_attention.png' },
  { video: ACTS[3], time: '00:01:05', name: 'ep02_act4_reasoning_scratchpad.png' },
  { video: ACTS[4], time: '00:00:55', name: 'ep02_act5_moe_kitchen.png' },
  { video: ACTS[5], time: '00:01:40', name: 'ep02_act6_sand_to_galaxy.png' }
];

console.log('\nExtracting high-resolution showcase keyframes for QA artifact...');
keyframes.forEach(kf => {
  const out = path.join(showcaseDir, kf.name);
  execSync(`ffmpeg -v error -y -ss ${kf.time} -i "${kf.video}" -vframes 1 "${out}"`);
  console.log(`✓ Saved: ${out}`);
});

console.log('🎉 Assembly & Keyframe Extraction Complete!');

