import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';

const ROOT_DIR = path.resolve();
const RENDERS_DIR = path.join(ROOT_DIR, 'projects/ep19-interpretability-superintelligence/renders');
const EXPORTS_DIR = path.join(ROOT_DIR, 'exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

const acts = [
  { id: 1, name: 'The Black Box Dilemma & Polysemantic Neurons', script: 'render_act1_black_box_polysemantic.mjs', output: 'EP19-Act1-BlackBoxPolysemantic-1080p.mp4' },
  { id: 2, name: 'Sparse Autoencoders (The Prisms of the Mind)', script: 'render_act2_sparse_autoencoders.mjs', output: 'EP19-Act2-SparseAutoencoders-1080p.mp4' },
  { id: 3, name: 'The Golden Gate Claude Experiment & Causal Steering', script: 'render_act3_golden_gate_claude.mjs', output: 'EP19-Act3-GoldenGateClaude-1080p.mp4' },
  { id: 4, name: 'Transformer Circuits & Induction Heads', script: 'render_act4_transformer_circuits_induction.mjs', output: 'EP19-Act4-TransformerCircuitsInduction-1080p.mp4' },
  { id: 5, name: 'Superalignment & Scalable Oversight', script: 'render_act5_superalignment_oversight.mjs', output: 'EP19-Act5-SuperalignmentOversight-1080p.mp4' },
  { id: 6, name: 'The Grand Synthesis (From Sand to Superintelligence)', script: 'render_act6_grand_synthesis_agi.mjs', output: 'EP19-Act6-GrandSynthesisAGI-1080p.mp4' }
];

console.log('================================================================');
console.log('🚀 EPISODE 13: MECHANISTIC INTERPRETABILITY & SUPERINTELLIGENCE (GRAND FINALE)');
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
const finalOutput = path.join(EXPORTS_DIR, 'EP19-Mechanistic-Interpretability-AGI-Final-1080p.mp4');

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
