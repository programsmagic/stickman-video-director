#!/usr/bin/env node
/**
 * Universal Scene JSON Validator (Master Blueprint Section 6.3 & 6.4)
 * Schema Version: 1.0
 * 
 * Usage:
 *   node projects/tools/scene_validator.mjs path/to/scene.json
 *   node projects/tools/scene_validator.mjs path/to/storyboard.json
 */
import fs from 'node:fs';
import path from 'node:path';

export function validateScene(scene, basePath = process.cwd()) {
  const errors = [];
  const warnings = [];

  if (!scene || typeof scene !== 'object') {
    return { valid: false, errors: ['Scene payload must be an object'], warnings };
  }

  // 1. Schema Version
  if (!scene.schemaVersion || scene.schemaVersion !== '1.0') {
    errors.push(`Invalid or missing schemaVersion: expected "1.0", got "${scene.schemaVersion}"`);
  }

  // 2. Identifiers
  if (!scene.episodeId || typeof scene.episodeId !== 'string') {
    errors.push('Missing or invalid episodeId (expected non-empty string)');
  }
  if (!scene.sceneId || typeof scene.sceneId !== 'string') {
    errors.push('Missing or invalid sceneId (expected non-empty string)');
  }

  // 3. Timing and Resolution
  if (typeof scene.duration !== 'number' || scene.duration <= 0) {
    errors.push(`Invalid duration: ${scene.duration} (expected positive number of seconds)`);
  }
  if (!Number.isInteger(scene.fps) || scene.fps <= 0) {
    errors.push(`Invalid fps: ${scene.fps} (expected positive integer)`);
  }
  if (!scene.resolution || typeof scene.resolution.width !== 'number' || typeof scene.resolution.height !== 'number') {
    errors.push('Invalid resolution: must have positive integer width and height');
  }

  // 4. Renderer
  const validRenderers = ['canvas', 'manim', 'threejs', 'blender', 'remotion', 'comfyui'];
  if (!scene.renderer || !validRenderers.includes(scene.renderer)) {
    errors.push(`Invalid renderer: "${scene.renderer}". Expected one of: ${validRenderers.join(', ')}`);
  }

  // 5. Narration Asset Check
  if (scene.narration) {
    if (typeof scene.narration.start !== 'number' || typeof scene.narration.end !== 'number') {
      errors.push('Narration must specify start and end timestamps in seconds');
    } else if (scene.narration.end > (scene.duration + 0.5)) {
      warnings.push(`Narration end (${scene.narration.end}s) exceeds scene duration (${scene.duration}s)`);
    }

    if (scene.narration.asset) {
      const narPath = path.isAbsolute(scene.narration.asset)
        ? scene.narration.asset
        : path.resolve(basePath, scene.narration.asset);
      if (!fs.existsSync(narPath)) {
        warnings.push(`Narration audio file does not exist at path: ${narPath}`);
      }
    }
  }

  // 6. Beats Validation
  if (Array.isArray(scene.beats)) {
    let lastTime = -1;
    scene.beats.forEach((beat, idx) => {
      if (typeof beat.at !== 'number' || beat.at < 0) {
        errors.push(`Beat #${idx} has invalid timestamp 'at': ${beat.at}`);
      } else {
        if (beat.at < lastTime) {
          warnings.push(`Beat #${idx} timestamp (${beat.at}s) is out of chronological order (previous was ${lastTime}s)`);
        }
        lastTime = beat.at;
        if (beat.at > scene.duration) {
          errors.push(`Beat #${idx} timestamp (${beat.at}s) exceeds scene duration (${scene.duration}s)`);
        }
      }
      if (!beat.action) {
        errors.push(`Beat #${idx} missing required 'action' field`);
      }
    });
  }

  // 7. Audio Cues
  if (Array.isArray(scene.audio)) {
    scene.audio.forEach((cue, idx) => {
      if (typeof cue.at !== 'number' || cue.at < 0 || cue.at > scene.duration) {
        warnings.push(`Audio cue #${idx} timestamp (${cue.at}s) is out of scene range (0 - ${scene.duration}s)`);
      }
      if (typeof cue.gain === 'number' && (cue.gain < 0 || cue.gain > 2.0)) {
        warnings.push(`Audio cue #${idx} gain (${cue.gain}) is unusually high or negative`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scene_validator.mjs <path-to-scene-or-storyboard.json>');
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const basePath = path.dirname(path.resolve(filePath));

    const scenes = Array.isArray(parsed) ? parsed : (parsed.scenes || [parsed]);
    console.log(`Validating ${scenes.length} scene(s) in: ${filePath}`);

    let totalErrors = 0;
    let totalWarnings = 0;

    scenes.forEach((sc, idx) => {
      const res = validateScene(sc, basePath);
      const name = sc.sceneId || `Scene #${idx + 1}`;
      if (!res.valid) {
        console.error(`❌ [FAIL] ${name}:`);
        res.errors.forEach(e => console.error(`   - Error: ${e}`));
        totalErrors += res.errors.length;
      } else {
        console.log(`✅ [PASS] ${name}`);
      }
      if (res.warnings.length > 0) {
        res.warnings.forEach(w => console.warn(`   ⚠️ Warning: ${w}`));
        totalWarnings += res.warnings.length;
      }
    });

    if (totalErrors > 0) {
      console.error(`\nValidation FAILED with ${totalErrors} error(s) and ${totalWarnings} warning(s).`);
      process.exit(1);
    } else {
      console.log(`\nValidation PASSED successfully with ${totalWarnings} warning(s).`);
      process.exit(0);
    }
  } catch (err) {
    console.error(`Error reading or parsing scene file: ${err.message}`);
    process.exit(1);
  }
}
