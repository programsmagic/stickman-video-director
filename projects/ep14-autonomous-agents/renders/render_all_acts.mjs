import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';

const ROOT_DIR = path.resolve();
const RENDERS_DIR = path.join(ROOT_DIR, 'projects/ep14-autonomous-agents/renders');
const EXPORTS_DIR = path.join(ROOT_DIR, 'exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

const acts = [
  { id: 1, name: 'The Caged Oracle', script: 'render_act1_caged_oracle.mjs', output: 'EP14-Act1-CagedOracle-1080p.mp4' },
  { id: 2, name: 'The ReAct Symphony', script: 'render_act2_react_symphony.mjs', output: 'EP14-Act2-ReActSymphony-1080p.mp4' },
  { id: 3, name: 'Tool Calling & The Grammar of Silicon', script: 'render_act3_tool_calling.mjs', output: 'EP14-Act3-ToolCalling-1080p.mp4' },
  { id: 4, name: 'The Environment Execution Loop', script: 'render_act4_environment_loop.mjs', output: 'EP14-Act4-EnvironmentLoop-1080p.mp4' },
  { id: 5, name: 'Self-Correction & Reflexion', script: 'render_act5_self_correction.mjs', output: 'EP14-Act5-SelfCorrection-1080p.mp4' },
  { id: 6, name: 'Multi-Agent Swarms & The Future of Work', script: 'render_act6_multi_agent_swarms.mjs', output: 'EP14-Act6-MultiAgentSwarms-1080p.mp4' }
];

console.log('================================================================');
console.log('🚀 EPISODE 08: THE ARCHITECTURE OF AUTONOMOUS AGENTS — 1080p');
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
const finalOutput = path.join(EXPORTS_DIR, 'EP14-Autonomous-Agents-Final-1080p.mp4');

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
