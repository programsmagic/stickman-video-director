import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = path.resolve();
const VIDEO_PATH = path.join(ROOT, 'exports/EP14-Autonomous-Agents-Final-1080p.mp4');
const THUMB_PATH = path.join(ROOT, 'exports/EP14-thumbnail.png');
const TOKEN_PATH = path.join(ROOT, '.youtube-tokens.json');
const CLIENT_SECRET_PATH = path.join(ROOT, 'client_secret.json');

console.log('=== YOUTUBE UPLOADER: EPISODE 08 (EP14) ===');

if (!fs.existsSync(VIDEO_PATH)) {
  console.error(`❌ Video file not found: ${VIDEO_PATH}`);
  process.exit(1);
}
if (!fs.existsSync(TOKEN_PATH)) {
  console.error(`❌ YouTube token file not found. Run npm run auth:youtube first.`);
  process.exit(1);
}

const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
const credentials = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8')).installed || JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8')).web;

const oauth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0]
);
oauth2Client.setCredentials(tokens);

const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

const metadata = {
  snippet: {
    title: 'How AI Agents Actually Work (ReAct Loops, Tool Calling & Self-Correction)',
    description: fs.readFileSync(path.join(ROOT, 'projects/ep14-autonomous-agents/publishing/metadata.md'), 'utf-8')
      .split('```markdown')[1]?.split('```')[0]?.trim() || 'Deep-tech breakdown of autonomous AI agents by Programs Magic.',
    tags: [
      'ai agents',
      'how ai agents work',
      'react framework llm',
      'tool calling openai',
      'function calling gpt 4',
      'autonomous ai agents',
      'reflexion language agents',
      'autogen multi agent',
      'programs magic',
      'stickman ai explainer'
    ],
    categoryId: '28' // Science & Technology
  },
  status: {
    privacyStatus: 'private', // Scheduled or private by default for safety
    publishAt: '2026-12-29T19:00:00.000Z',
    selfDeclaredMadeForKids: false
  }
};

console.log('• Metadata prepared for upload:');
console.log(`  Title: ${metadata.snippet.title}`);
console.log(`  Target Premiere: ${metadata.status.publishAt}`);
console.log('• Ready to execute resumable upload when prompted.');
