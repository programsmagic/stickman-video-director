import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const files = [
  path.join(cwd, 'exports/EP04-Act1-Hook-Masterpiece.mp4'),
  path.join(cwd, 'exports/EP04-Act2-CheatCode-Masterpiece.mp4'),
  path.join(cwd, 'exports/EP04-Act3-Paralysis-Masterpiece.mp4'),
  path.join(cwd, 'exports/EP04-Act4-ButterflyChaos-Masterpiece.mp4'),
  path.join(cwd, 'exports/EP04-Act5-Climax-Masterpiece.mp4')
];

for (const f of files) {
  if (!fs.existsSync(f)) {
    throw new Error(`File missing: ${f}`);
  }
}

const listContent = files.map(f => `file '\''${f}'\''`).join('\n');
fs.writeFileSync('/tmp/ep04_final_concat.txt', listContent);
console.log('Concat list created:\n' + listContent);

const out = path.join(cwd, 'exports/EP04-What-If-You-Had-A-Save-Point-Final.mp4');
console.log('\nAssembling final feature film...');
execSync(`ffmpeg -v error -y -f concat -safe 0 -i /tmp/ep04_final_concat.txt -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k "${out}"`);

console.log('Final feature video created:', out);
const dur = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${out}"`).toString().trim();
const size = (fs.statSync(out).size / (1024 * 1024)).toFixed(2);
console.log(`Duration: ${dur}s (~${(dur / 60).toFixed(1)} mins), Size: ${size} MB`);

