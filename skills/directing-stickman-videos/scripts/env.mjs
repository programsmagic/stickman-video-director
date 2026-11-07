// Loads .env files and manages multi-key rotation for Gemini API
import fs from 'node:fs';
import path from 'node:path';

function findEnvFile() {
  let curr = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(curr, '.env');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return null;
}

export function loadEnv() {
  const envPath = findEnvFile();
  if (envPath) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) continue;
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key && !(key in process.env)) {
          process.env[key] = val;
        }
      }
    } catch {
      // Ignore file read error if permissions/format issue
    }
  }
}

export function getGeminiKeys() {
  loadEnv();

  const keys = [];

  // 1. Check GEMINI_API_KEYS (comma, semicolon, or newline delimited)
  if (process.env.GEMINI_API_KEYS) {
    const split = process.env.GEMINI_API_KEYS.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    keys.push(...split);
  }

  // 2. Check numbered keys: GEMINI_API_KEY_1, GEMINI_API_KEY_2, ...
  const numbered = Object.keys(process.env)
    .filter(k => /^GEMINI_API_KEY_\d+$/i.test(k))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      return numA - numB;
    })
    .map(k => process.env[k]?.trim())
    .filter(Boolean);
  keys.push(...numbered);

  // 3. Check single GEMINI_API_KEY
  if (process.env.GEMINI_API_KEY?.trim()) {
    keys.push(process.env.GEMINI_API_KEY.trim());
  }

  // Filter out placeholders and duplicates
  const cleaned = [];
  const seen = new Set();
  for (const k of keys) {
    if (!k || k.includes('your_api_key') || seen.has(k)) continue;
    seen.add(k);
    cleaned.push(k);
  }

  // Ensure process.env.GEMINI_API_KEY is populated with the first valid key
  if (cleaned.length > 0 && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = cleaned[0];
  }

  return cleaned;
}

