import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const EXPORTS_DIR = path.resolve('exports');
const ACTS = [
  path.join(EXPORTS_DIR, 'EP09-Act1-Illusion-Masterpiece.mp4'),
  path.join(EXPORTS_DIR, 'EP09-Act2-ChineseRoom-Masterpiece.mp4'),
  path.join(EXPORTS_DIR, 'EP09-Act3-PZombie-Masterpiece.mp4'),
  path.join(EXPORTS_DIR, 'EP09-Act4-IIT-Phi-Masterpiece.mp4'),
  path.join(EXPORTS_DIR, 'EP09-Act5-Singularity-Masterpiece.mp4')
];

const MASTER_FEATURE = path.join(EXPORTS_DIR, 'EP09-Can-AI-Become-Conscious-Final.mp4');
const CONCAT_LIST = '/tmp/ep09_concat_list.txt';

console.log('=== ASSEMBLING EPISODE 09 FULL FEATURE FILM ===');

// Check all act files exist
for (const act of ACTS) {
  if (!fs.existsSync(act)) {
    throw new Error(`Missing act file: ${act}`);
  }
}

// Generate concat demuxer list with single quotes
const lines = ACTS.map(f => `file '${f}'`).join('\n');
fs.writeFileSync(CONCAT_LIST, lines, 'utf8');
console.log('✓ Concat list created:');
console.log(lines);

console.log('\nStitching feature film with ffmpeg concat demuxer...');
execSync(`ffmpeg -v error -y -f concat -safe 0 -i "${CONCAT_LIST}" -c copy "${MASTER_FEATURE}"`);
console.log(`🎉 Master Feature Film Assembled: ${MASTER_FEATURE}`);

// Verify duration
const dur = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${MASTER_FEATURE}"`).toString().trim();
console.log(`Total Runtime: ${parseFloat(dur).toFixed(2)}s (${(parseFloat(dur) / 60).toFixed(2)} minutes)`);

