import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';

const ROOT_DIR = path.resolve();
const RENDERS_DIR = path.join(ROOT_DIR, 'projects/ep13-multimodal-mind/renders');
const EXPORTS_DIR = path.join(ROOT_DIR, 'exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

const acts = [
  { id: 1, name: 'The Sensory Tower of Babel', script: 'render_act1_babel.mjs', output: 'EP13-Act1-Babel-1080p.mp4' },
  { id: 2, name: 'Vision Transformers & 16x16 Patches', script: 'render_act2_vit_patches.mjs', output: 'EP13-Act2-ViTPatches-1080p.mp4' },
  { id: 3, name: 'Mel-Spectrograms: Turning Sound to Sight', script: 'render_act3_mel_spectrogram.mjs', output: 'EP13-Act3-MelSpectrogram-1080p.mp4' },
  { id: 4, name: 'CLIP & The Shared Celestial Sphere', script: 'render_act4_clip_sphere.mjs', output: 'EP13-Act4-CLIPSphere-1080p.mp4' },
  { id: 5, name: 'Native Omnimodality vs Frankenstein Pipelines', script: 'render_act5_omnimodality.mjs', output: 'EP13-Act5-Omnimodality-1080p.mp4' },
  { id: 6, name: 'The Unified Geometry of Thought', script: 'render_act6_unified_mind.mjs', output: 'EP13-Act6-UnifiedMind-1080p.mp4' }
];

console.log('================================================================');
console.log('🚀 EPISODE 07: THE MULTIMODAL MIND — 1080p MASTER PIPELINE');
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
const finalOutput = path.join(EXPORTS_DIR, 'EP13-The-Multimodal-Mind-Final-1080p.mp4');

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
