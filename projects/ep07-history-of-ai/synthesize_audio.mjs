import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DIR = path.resolve('projects/ep07-history-of-ai/build/narration');
const CHAPTERS = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6'];
const NARRATION_MASTER = path.resolve('projects/ep07-history-of-ai/build/narration.wav');

async function runCommand(cmd, args) {
  return new Promise((res, rej) => {
    const proc = spawn(cmd, args, { stdio: 'inherit' });
    proc.on('close', code => code === 0 ? res() : rej(new Error(`${cmd} exited with ${code}`)));
  });
}

async function synthesizeChapter(ch) {
  const txtPath = path.join(DIR, `${ch}.txt`);
  const wavPath = path.join(DIR, `${ch}.wav`);
  if (fs.existsSync(wavPath)) {
    console.log(`✓ ${ch}.wav already exists, skipping.`);
    return;
  }
  console.log(`\nSynthesizing ${ch} with Gemini Bodi...`);
  await runCommand('node', [
    'skills/directing-stickman-videos/scripts/gemini-media.mjs',
    'speech',
    '--model', 'gemini-3.8-flash-tts',
    '--voice', 'Bodi',
    '--text', txtPath,
    '--output', wavPath,
    '--allow-network'
  ]);
}

async function main() {
  for (const ch of CHAPTERS) {
    await synthesizeChapter(ch);
  }

  // Generate 0.8s silent gap wav
  const gapWav = path.join(DIR, 'gap.wav');
  if (!fs.existsSync(gapWav)) {
    await runCommand('ffmpeg', [
      '-v', 'error', '-y',
      '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
      '-t', '0.8',
      gapWav
    ]);
  }

  // Create concat list
  const listFile = path.join(DIR, 'concat.txt');
  let listContent = '';
  CHAPTERS.forEach((ch, idx) => {
    listContent += `file '${path.join(DIR, `${ch}.wav`)}'\n`;
    if (idx < CHAPTERS.length - 1) {
      listContent += `file '${gapWav}'\n`;
    }
  });
  fs.writeFileSync(listFile, listContent);

  console.log('\nConcatenating full narration master wav...');
  await runCommand('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'concat', '-safe', '0',
    '-i', listFile,
    '-c', 'copy',
    NARRATION_MASTER
  ]);

  console.log(`\n🎉 Full narration master ready: ${NARRATION_MASTER}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

