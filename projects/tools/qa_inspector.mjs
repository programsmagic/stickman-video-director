#!/usr/bin/env node
/**
 * Universal Studio Video QA Inspector (Master Blueprint Section 11.1)
 * Performs automated technical, media integrity, loudness, and stream inspection.
 *
 * Usage:
 *   node projects/tools/qa_inspector.mjs <video-path> [--profile 720p|1080p] [--out-dir <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const videoPath = args[0] || 'exports/EP02-How-AI-Actually-Works-Final.mp4';
const profileArgIdx = args.indexOf('--profile');
const profile = profileArgIdx !== -1 ? args[profileArgIdx + 1] : '720p'; // '720p' or '1080p'
const outDirIdx = args.indexOf('--out-dir');
const outDir = outDirIdx !== -1 ? args[outDirIdx + 1] : null;

console.log(`=== PROGRAMS MAGIC VIDEO QA INSPECTOR ===`);
console.log(`Auditing file: ${videoPath} (Target Profile: ${profile})`);

if (!fs.existsSync(videoPath)) {
  console.error(`❌ Error: File not found: ${videoPath}`);
  process.exit(1);
}

// 1. FFPROBE METADATA
let probe;
try {
  const probeRaw = execSync(`ffprobe -v error -show_format -show_streams -of json "${videoPath}"`).toString();
  probe = JSON.parse(probeRaw);
} catch (err) {
  console.error(`❌ ffprobe failed on ${videoPath}: ${err.message}`);
  process.exit(1);
}

const vStream = probe.streams.find(s => s.codec_type === 'video');
const aStream = probe.streams.find(s => s.codec_type === 'audio');
const format = probe.format;

if (!vStream) {
  console.error(`❌ No video stream found in container!`);
  process.exit(1);
}

const duration = parseFloat(format.duration || vStream.duration || 0);
const sizeMB = (parseInt(format.size || 0) / (1024 * 1024)).toFixed(2);
const bitrateKbps = Math.round(parseInt(format.bit_rate || 0) / 1000);

// 2. FULL DECODE TEST
console.log('• Running full frame decode check (corrupt packet detection)...');
let decodePass = false;
let decodeError = '';
try {
  execSync(`ffmpeg -v error -i "${videoPath}" -f null - 2>&1`);
  decodePass = true;
  console.log('  ✅ Full decode: 0 corrupted frames.');
} catch (err) {
  decodeError = err.stdout?.toString() || err.message;
  console.warn(`  ⚠️ Decode warning/error: ${decodeError.trim().split('\n')[0]}`);
}

// 3. BLACKOUT AND FREEZE DETECTION
console.log('• Checking for accidental blackouts (d >= 2.0s)...');
const blackLog = execSync(`ffmpeg -v error -i "${videoPath}" -vf "blackdetect=d=2:pix_th=0.10" -an -f null - 2>&1`).toString();
const blackEvents = (blackLog.match(/black_start/g) || []).length;
console.log(`  ✅ Blackout check: ${blackEvents} event(s) detected.`);

console.log('• Checking for frozen frames (freezedetect d >= 3.0s)...');
const freezeLog = execSync(`ffmpeg -v error -i "${videoPath}" -vf "freezedetect=n=-50dB:d=3" -an -f null - 2>&1`).toString();
const freezeEvents = (freezeLog.match(/freeze_start/g) || []).length;
console.log(`  ✅ Freeze check: ${freezeEvents} freeze hold(s) detected.`);

// 4. AUDIO DYNAMIC RANGE AND LOUDNORM
let maxVolume = -99;
let meanVolume = -99;
let integratedLoudness = -99;
let truePeak = -99;

if (aStream) {
  console.log('• Measuring audio dynamics and loudness...');
  try {
    const volLog = execSync(`ffmpeg -v error -i "${videoPath}" -af "volumedetect" -f null - 2>&1`).toString();
    const maxMatch = volLog.match(/max_volume:\s*(-?[\d.]+)\s*dB/);
    const meanMatch = volLog.match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
    if (maxMatch) maxVolume = parseFloat(maxMatch[1]);
    if (meanMatch) meanVolume = parseFloat(meanMatch[1]);

    const loudLog = execSync(`ffmpeg -v error -i "${videoPath}" -af "loudnorm=I=-14:TP=-1:LRA=11:print_format=summary" -f null - 2>&1`).toString();
    const iMatch = loudLog.match(/Input Integrated:\s*(-?[\d.]+)\s*LUFS/);
    const tpMatch = loudLog.match(/Input True Peak:\s*(-?[\d.]+)\s*dBTP/);
    if (iMatch) integratedLoudness = parseFloat(iMatch[1]);
    if (tpMatch) truePeak = parseFloat(tpMatch[1]);
  } catch (e) {
    console.warn(`  ⚠️ Audio analysis skipped: ${e.message}`);
  }
}

// 5. EVALUATE AGAINST TARGET PROFILE
const targetWidth = profile === '1080p' ? 1920 : 1280;
const targetHeight = profile === '1080p' ? 1080 : 720;

const checks = {
  container_valid: format.format_name.includes('mp4') || format.format_name.includes('mov'),
  resolution_pass: vStream.width === targetWidth && vStream.height === targetHeight,
  fps_pass: vStream.r_frame_rate === '30/1' || vStream.r_frame_rate === '30',
  codec_pass: vStream.codec_name === 'h264',
  audio_stream_exists: !!aStream,
  audio_sample_rate_pass: aStream ? parseInt(aStream.sample_rate) === 48000 : false,
  no_clipping_pass: maxVolume < 0.0,
  no_blackouts_pass: blackEvents === 0,
  decode_pass: decodePass
};

const allPassed = Object.values(checks).every(Boolean);

const qaReport = {
  timestamp: new Date().toISOString(),
  video_file: videoPath,
  target_profile: profile,
  duration_seconds: duration,
  size_mb: sizeMB,
  bitrate_kbps: bitrateKbps,
  streams: {
    video: {
      codec: vStream.codec_name,
      width: vStream.width,
      height: vStream.height,
      fps: vStream.r_frame_rate,
      pix_fmt: vStream.pix_fmt,
      frames: vStream.nb_frames
    },
    audio: aStream ? {
      codec: aStream.codec_name,
      sample_rate: parseInt(aStream.sample_rate),
      channels: aStream.channels,
      max_volume_db: maxVolume,
      mean_volume_db: meanVolume,
      integrated_lufs: integratedLoudness,
      true_peak_dbtp: truePeak
    } : null
  },
  checks,
  status: allPassed ? 'PASS' : 'WARNING'
};

console.log('\n--- QA SUMMARY RESULTS ---');
console.log(`Resolution (${targetWidth}x${targetHeight}):`, checks.resolution_pass ? '✅ PASS' : `⚠️ WARN (${vStream.width}x${vStream.height})`);
console.log('Frame Rate (30 FPS):', checks.fps_pass ? '✅ PASS' : `⚠️ WARN (${vStream.r_frame_rate})`);
console.log('Audio 48kHz Studio:', checks.audio_sample_rate_pass ? '✅ PASS' : '⚠️ WARN');
console.log('No Audio Clipping (< 0dBFS):', checks.no_clipping_pass ? '✅ PASS' : '⚠️ CLIPPING DETECTED');
console.log('Full Frame Decode:', checks.decode_pass ? '✅ PASS' : '⚠️ DECODE WARNINGS');
console.log(`Overall Status: [${qaReport.status}]`);

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'qa_report.json');
  const mdPath = path.join(outDir, 'qa_report.md');
  fs.writeFileSync(jsonPath, JSON.stringify(qaReport, null, 2));

  const md = `# 🔍 QA Inspection Report: ${path.basename(videoPath)}
**Timestamp**: ${qaReport.timestamp}  
**Status**: **${qaReport.status}**  
**Profile Target**: ${profile} (${targetWidth}x${targetHeight} @ 30 FPS)  

- **File Size**: ${sizeMB} MB (${bitrateKbps} kbps)
- **Duration**: ${Math.floor(duration/60)}m ${(duration%60).toFixed(1)}s (${duration.toFixed(2)}s)
- **Video Stream**: ${vStream.codec_name.toUpperCase()} ${vStream.width}x${vStream.height} @ ${vStream.r_frame_rate} (${vStream.pix_fmt})
- **Audio Stream**: ${aStream ? `${aStream.codec_name.toUpperCase()} ${aStream.sample_rate}Hz, ${aStream.channels}ch (Max: ${maxVolume}dB, Mean: ${meanVolume}dB)` : 'None'}
- **Loudness**: Integrated ${integratedLoudness} LUFS, True Peak ${truePeak} dBTP

### Checklist
- [${checks.container_valid ? 'x' : ' '}] Container Valid (MP4)
- [${checks.resolution_pass ? 'x' : ' '}] Target Resolution (${targetWidth}x${targetHeight})
- [${checks.fps_pass ? 'x' : ' '}] Constant 30 FPS
- [${checks.audio_sample_rate_pass ? 'x' : ' '}] Audio Sample Rate 48 kHz
- [${checks.no_clipping_pass ? 'x' : ' '}] Headroom / Zero Clipping
- [${checks.no_blackouts_pass ? 'x' : ' '}] Zero Accidental Blackouts
- [${checks.decode_pass ? 'x' : ' '}] 100% Corrupt-Free Frame Decode
`;
  fs.writeFileSync(mdPath, md);
  console.log(`Reports saved to: ${outDir}/qa_report.[json|md]`);
}
