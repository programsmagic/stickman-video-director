import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = path.resolve();
const VIDEO_PATH = path.join(ROOT, 'exports/EP16-Post-Training-Alignment-Final-1080p.mp4');
const THUMB_PATH = path.join(ROOT, 'exports/EP16-thumbnail.png');
const TOKEN_PATH = path.join(ROOT, '.youtube-tokens.json');
const CLIENT_SECRET_PATH = path.join(ROOT, 'client_secret.json');

console.log('=== YOUTUBE UPLOADER: EPISODE 10 (EP16) ===');

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
    title: 'How We Tamed AI: The Secret Math of RLHF, DPO & Alignment',
    description: fs.readFileSync(path.join(ROOT, 'projects/ep16-post-training-alignment/publishing/metadata.md'), 'utf-8')
      .split('```markdown')[1]?.split('```')[0]?.trim() || 'Deep-tech breakdown of AI post-training and alignment by Programs Magic.',
    tags: [
      'rlhf explained',
      'dpo explained',
      'direct preference optimization',
      'how ai alignment works',
      'reinforcement learning human feedback',
      'supervised fine tuning sft',
      'reward model bradley terry',
      'kl divergence penalty',
      'refusal steering vectors',
      'instructgpt explained',
      'programs magic',
      'stickman ai explainer'
    ],
    categoryId: '28' // Science & Technology
  },
  status: {
    privacyStatus: 'private',
    publishAt: '2027-01-12T19:00:00.000Z',
    selfDeclaredMadeForKids: false
  }
};

console.log('• Metadata prepared for upload:');
console.log('  Title:', metadata.snippet.title);
console.log('  Publish At:', metadata.status.publishAt);

try {
  console.log('\nStarting resumable media upload...');
  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: metadata,
    media: {
      body: fs.createReadStream(VIDEO_PATH)
    }
  });

  const videoId = res.data.id;
  console.log(`\n🎉 SUCCESS! Video uploaded.`);
  console.log(`   Video ID: ${videoId}`);
  console.log(`   Watch URL: https://youtu.be/${videoId}`);
  console.log(`   Studio Edit: https://studio.youtube.com/video/${videoId}/edit`);

  if (fs.existsSync(THUMB_PATH)) {
    console.log('\nUploading custom high-CTR 1080p thumbnail...');
    await youtube.thumbnails.set({
      videoId: videoId,
      media: {
        body: fs.createReadStream(THUMB_PATH)
      }
    });
    console.log('✓ Custom thumbnail uploaded successfully!');
  }
} catch (err) {
  console.error('\n❌ Upload failed:', err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
}
