import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = path.resolve();
const VIDEO_PATH = path.join(ROOT, 'exports/EP17-Test-Time-Compute-Reasoning-Final-1080p.mp4');
const THUMB_PATH = path.join(ROOT, 'exports/EP17-thumbnail.png');
const TOKEN_PATH = path.join(ROOT, '.youtube-tokens.json');
const CLIENT_SECRET_PATH = path.join(ROOT, 'client_secret.json');

console.log('=== YOUTUBE UPLOADER: EPISODE 11 (EP17) ===');

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
    title: 'Test-Time Compute: How AI Learned to Think Before It Speaks (Inside OpenAI o1 & DeepSeek-R1)',
    description: fs.readFileSync(path.join(ROOT, 'projects/ep17-test-time-compute/publishing/metadata.md'), 'utf-8')
      .split('## YouTube Description\n\n')[1]?.trim() || 'Deep-tech breakdown of Test-Time Compute & AI Reasoning by Programs Magic.',
    tags: [
      'test time compute',
      'openai o1 explained',
      'deepseek r1 explained',
      'process reward models',
      'prm vs orm',
      'how ai reasons',
      'monte carlo tree search llm',
      'chain of thought',
      'group relative policy optimization',
      'grpo deepseek',
      'programs magic',
      'ai masterclass'
    ],
    categoryId: '28'
  },
  status: {
    privacyStatus: 'private',
    publishAt: '2027-01-19T19:00:00Z',
    selfDeclaredMadeForKids: false
  }
};

console.log('Uploading Episode 11 (EP17) to YouTube...');
console.log(`Title: ${metadata.snippet.title}`);
console.log(`Scheduled Publish: ${metadata.status.publishAt}`);

const res = await youtube.videos.insert({
  part: ['snippet', 'status'],
  requestBody: metadata,
  media: {
    body: fs.createReadStream(VIDEO_PATH)
  }
});

const videoId = res.data.id;
console.log(`\n🎉 UPLOAD SUCCESSFUL!`);
console.log(`Video ID: ${videoId}`);
console.log(`Watch URL: https://youtu.be/${videoId}`);

if (fs.existsSync(THUMB_PATH)) {
  console.log(`\nUploading thumbnail: ${THUMB_PATH}...`);
  await youtube.thumbnails.set({
    videoId: videoId,
    media: {
      mimeType: 'image/png',
      body: fs.createReadStream(THUMB_PATH)
    }
  });
  console.log(`✓ Thumbnail uploaded successfully!`);
}
