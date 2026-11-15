import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const acts = [
  { name: 'Act 1: Word Guillotine', script: 'render_act1_guillotine.mjs', out: 'exports/EP11-Act1-WordGuillotine-1080p.mp4' },
  { name: 'Act 2: Strawberry Paradox', script: 'render_act2_strawberry.mjs', out: 'exports/EP11-Act2-StrawberryParadox-1080p.mp4' },
  { name: 'Act 3: BPE Vocabulary Vault', script: 'render_act3_bpe_vault.mjs', out: 'exports/EP11-Act3-BPEVault-1080p.mp4' },
  { name: 'Act 4: Glitch Token Magikarp', script: 'render_act4_glitch_magikarp.mjs', out: 'exports/EP11-Act4-GlitchMagikarp-1080p.mp4' },
  { name: 'Act 5: The Global Token Tax', script: 'render_act5_token_tax.mjs', out: 'exports/EP11-Act5-TokenTax-1080p.mp4' },
  { name: 'Act 6: Token-Free Byte Future', script: 'render_act6_byte_future.mjs', out: 'exports/EP11-Act6-ByteFuture-1080p.mp4' }
];

console.log('================================================================');
console.log('🚀 EPISODE 05: THE TOKEN ILLUSION — 1080p MASTER PIPELINE');
console.log('================================================================\n');

for (let i = 0; i < acts.length; i++) {
  const act = acts[i];
  const outPath = path.resolve(act.out);
  console.log(`\n▶ [${i + 1}/6] Processing ${act.name}...`);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000000) {
    console.log(`  ✓ Already exists (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB): ${act.out}`);
    continue;
  }
  const scriptPath = path.resolve('projects/ep11-token-illusion/renders', act.script);
  console.log(`  • Running ${act.script}...`);
  execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
  console.log(`  ✓ Finished: ${act.out}`);
}

console.log('\n================================================================');
console.log('🎬 ASSEMBLING FINAL 1080p FEATURE FILM VIA CONCAT DEMUXER');
console.log('================================================================\n');

const concatList = path.resolve('projects/ep11-token-illusion/renders/concat_acts.txt');
const fileLines = acts.map(a => `file '${path.resolve(a.out)}'`).join('\n');
fs.writeFileSync(concatList, fileLines);

const FINAL_OUTPUT = path.resolve('exports/EP11-The-Token-Illusion-Final-1080p.mp4');
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
