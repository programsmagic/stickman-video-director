import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const acts = [
  { name: 'Act 1: Mountain in the Fog', script: 'render_act1_mountain.mjs', out: 'exports/EP10-Act1-MountainInFog-1080p.mp4' },
  { name: 'Act 2: Saddle Points', script: 'render_act2_saddle.mjs', out: 'exports/EP10-Act2-SaddlePoints-1080p.mp4' },
  { name: 'Act 3: Gradient Descent', script: 'render_act3_gradient.mjs', out: 'exports/EP10-Act3-GradientDescent-1080p.mp4' },
  { name: 'Act 4: Backpropagation', script: 'render_act4_backprop.mjs', out: 'exports/EP10-Act4-BackpropPulleys-1080p.mp4' },
  { name: 'Act 5: Momentum & Adam', script: 'render_act5_momentum.mjs', out: 'exports/EP10-Act5-MomentumAdam-1080p.mp4' },
  { name: 'Act 6: The Global Basin', script: 'render_act6_basin.mjs', out: 'exports/EP10-Act6-GlobalBasin-1080p.mp4' }
];

console.log('================================================================');
console.log('🚀 EPISODE 04: THE GEOMETRY OF THINKING — 1080p MASTER PIPELINE');
console.log('================================================================\n');

for (let i = 0; i < acts.length; i++) {
  const act = acts[i];
  const outPath = path.resolve(act.out);
  console.log(`\n▶ [${i + 1}/6] Processing ${act.name}...`);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000000) {
    console.log(`  ✓ Already exists (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB): ${act.out}`);
    continue;
  }
  const scriptPath = path.resolve('projects/ep10-geometry-of-thinking/renders', act.script);
  console.log(`  • Running ${act.script}...`);
  execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
  console.log(`  ✓ Finished: ${act.out}`);
}

console.log('\n================================================================');
console.log('🎬 ASSEMBLING FINAL 1080p FEATURE FILM VIA CONCAT DEMUXER');
console.log('================================================================\n');

const concatList = path.resolve('projects/ep10-geometry-of-thinking/renders/concat_acts.txt');
const fileLines = acts.map(a => `file '${path.resolve(a.out)}'`).join('\n');
fs.writeFileSync(concatList, fileLines);

const FINAL_OUTPUT = path.resolve('exports/EP10-The-Geometry-of-Thinking-Final-1080p.mp4');
console.log(`• Writing concat demuxer list: ${concatList}`);
console.log(`• Concatenating into: ${FINAL_OUTPUT}...`);

execSync(`ffmpeg -v error -y -f concat -safe 0 -i "${concatList}" -c copy "${FINAL_OUTPUT}"`);
console.log(`\n🎉 MASTER 1080p FEATURE READY: ${FINAL_OUTPUT}`);

const probe = execSync(`ffprobe -v error -show_entries format=duration,size:stream=width,height,r_frame_rate,codec_name -of json "${FINAL_OUTPUT}"`).toString();
const info = JSON.parse(probe);
const dur = parseFloat(info.format.duration);
const sizeMB = (parseInt(info.format.size) / (1024 * 1024)).toFixed(2);
console.log(`\n📊 Final Inspection:`);
console.log(`   Resolution: ${info.streams[0].width}x${info.streams[0].height}`);
console.log(`   Frame Rate: ${info.streams[0].r_frame_rate}`);
console.log(`   Duration:   ${dur.toFixed(2)}s (${Math.floor(dur / 60)}m ${Math.round(dur % 60)}s)`);
console.log(`   File Size:  ${sizeMB} MB`);
