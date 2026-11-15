import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';

const ROOT_DIR = path.resolve();
const RENDERS_DIR = path.join(ROOT_DIR, 'projects/ep12-physics-of-diffusion/renders');
const EXPORTS_DIR = path.join(ROOT_DIR, 'exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

const acts = [
  { id: 1, name: 'The One-Way Arrow of Entropy', script: 'render_act1_entropy.mjs', output: 'EP12-Act1-Entropy-1080p.mp4' },
  { id: 2, name: 'The Forward Destroyer', script: 'render_act2_destroyer.mjs', output: 'EP12-Act2-Destroyer-1080p.mp4' },
  { id: 3, name: 'Langevin Dynamics & The Score Needle', script: 'render_act3_score_needle.mjs', output: 'EP12-Act3-ScoreNeedle-1080p.mp4' },
  { id: 4, name: 'The Latent U-Net Sculptor', script: 'render_act4_latent_unet.mjs', output: 'EP12-Act4-LatentUNet-1080p.mp4' },
  { id: 5, name: 'Classifier-Free Guidance & Prompt Compass', script: 'render_act5_guidance.mjs', output: 'EP12-Act5-Guidance-1080p.mp4' },
  { id: 6, name: 'Flow Matching & The Cosmic Reversal', script: 'render_act6_flow_matching.mjs', output: 'EP12-Act6-FlowMatching-1080p.mp4' }
];

console.log('================================================================');
console.log('🚀 EPISODE 06: THE PHYSICS OF DIFFUSION — 1080p MASTER PIPELINE');
console.log('================================================================\n');

for (const act of acts) {
  const outPath = path.join(EXPORTS_DIR, act.output);
  console.log(`\n▶ [${act.id}/6] Processing Act ${act.id}: ${act.name}...`);

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000000) {
    console.log(`  ✓ Already rendered: ${act.output} (${(fs.statSync(outPath).size / (1024 * 1024)).toFixed(2)} MB)`);
    continue;
  }

  console.log(`  • Running ${act.script}...`);
  const scriptPath = path.join(RENDERS_DIR, act.script);
  const res = spawnSync('node', [scriptPath], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`❌ Failed to render Act ${act.id}: ${act.name}`);
    process.exit(1);
  }
  console.log(`  ✓ Finished: ${act.output}`);
}

console.log('\n================================================================');
console.log('🎬 ASSEMBLING FINAL 1080p FEATURE FILM VIA CONCAT DEMUXER');
console.log('================================================================\n');

const concatListPath = path.join(RENDERS_DIR, 'concat_acts.txt');
const finalOutput = path.join(EXPORTS_DIR, 'EP12-The-Physics-of-Diffusion-Final-1080p.mp4');

const concatLines = acts.map(a => `file '${path.join(EXPORTS_DIR, a.output)}'`).join('\n');
fs.writeFileSync(concatListPath, concatLines + '\n');
console.log(`• Writing concat demuxer list: ${concatListPath}`);
console.log(`• Concatenating into: ${finalOutput}...`);

execSync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${finalOutput}"`, { stdio: 'inherit' });

console.log(`\n🎉 MASTER 1080p FEATURE READY: ${finalOutput}`);

const probe = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -of json "${finalOutput}"`).toString();
const info = JSON.parse(probe).streams[0];
console.log(`\n📊 Final Inspection:`);
console.log(`   Resolution: ${info.width}x${info.height}`);
console.log(`   Frame Rate: ${info.r_frame_rate}`);
console.log(`   Duration:   ${parseFloat(info.duration).toFixed(2)}s (${Math.floor(parseFloat(info.duration) / 60)}m ${Math.floor(parseFloat(info.duration) % 60)}s)`);
console.log(`   File Size:  ${(fs.statSync(finalOutput).size / (1024 * 1024)).toFixed(2)} MB\n`);
