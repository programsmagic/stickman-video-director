import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const artifactDir = '/Users/prashantmishra/.gemini/antigravity/brain/db9bac9a-3426-45bb-9f51-83659698b1f1/ep09_showcase';
fs.mkdirSync(artifactDir, { recursive: true });

const exportsDir = path.resolve('exports');

const screenshots = [
  { video: 'EP09-Act1-Illusion-Masterpiece.mp4', time: '00:00:22', name: 'act1_marionette_illusion.png' },
  { video: 'EP09-Act2-ChineseRoom-Masterpiece.mp4', time: '00:00:26', name: 'act2_chinese_room.png' },
  { video: 'EP09-Act3-PZombie-Masterpiece.mp4', time: '00:00:46', name: 'act3_pzombie_skull.png' },
  { video: 'EP09-Act4-IIT-Phi-Masterpiece.mp4', time: '00:00:32', name: 'act4_iit_recurrent_web.png' },
  { video: 'EP09-Act5-Singularity-Masterpiece.mp4', time: '00:00:48', name: 'act5_cosmic_candle.png' }
];

console.log('Extracting high-resolution showcase keyframes for artifact...');

screenshots.forEach(sc => {
  const videoPath = path.join(exportsDir, sc.video);
  const outPath = path.join(artifactDir, sc.name);
  execSync(`ffmpeg -v error -y -ss ${sc.time} -i "${videoPath}" -vframes 1 "${outPath}"`);
  console.log(`✓ Saved: ${outPath}`);
});

console.log('🎉 All showcase screenshots extracted!');

