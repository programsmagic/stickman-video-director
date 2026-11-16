import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ROOT = path.resolve();
const VIDEO_PATH = path.join(ROOT, 'exports/EP18-KVCache-GPU-Inference-Final-1080p.mp4');
const THUMB_PATH = path.join(ROOT, 'exports/EP18-thumbnail.png');
const TOKEN_PATH = path.join(ROOT, '.youtube-tokens.json');
const CLIENT_SECRET_PATH = path.join(ROOT, 'client_secret.json');

console.log('=== YOUTUBE UPLOADER: EPISODE 12 (EP18) ===');

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
    title: 'Why $40,000 GPUs Sit 99% Idle: KV Cache, PagedAttention & The Memory Wall Explained',
    description: `Why do the world’s most powerful AI supercomputers spend over 99% of their time waiting on memory? Inside the physics and systems architecture of large language model inference: the Memory Wall, the quadratic KV Cache explosion, UC Berkeley’s PagedAttention (vLLM), Stanford’s FlashAttention, and Speculative Decoding.

PART 12 OF THE PROGRAMS MAGIC AI MASTERCLASS (From First Principles to AI Expert)

TIMESTAMPS:
00:00 - The Memory Wall (Why H100s Sit 99% Idle)
01:06 - The KV Cache & The Quadratic Time Bomb
02:14 - The Arithmetic of Memory Explosion (Llama-70B Reality Check)
03:14 - The Fragmentation Crisis & PagedAttention (vLLM)
04:33 - FlashAttention: The SRAM Highway & Online Softmax
05:38 - Grouped-Query Attention & Speculative Decoding

KEY PAPERS & CONCEPTS COVERED:
• PagedAttention & vLLM: Efficient Memory Management for Large Language Model Serving with PagedAttention (Kwon et al., SOSP 2023)
• FlashAttention & FlashAttention-2: Fast and Memory-Efficient Exact Attention with IO-Awareness (Dao et al., NeurIPS 2022 / ICLR 2024)
• Roofline Model & AI Memory Wall: AI and Memory Wall (Gholami et al., IEEE Micro 2024)
• Speculative Decoding: Fast Inference from Transformers via Speculative Decoding (Leviathan et al., ICML 2023)
• Grouped-Query Attention (GQA): Training Generalized Multi-Query Transformer Models (Ainslie et al., Google Research, 2023)

SUBSCRIBE to Programs Magic for deep-dive technical AI masterclasses every Tuesday at 19:00 UTC.

#AI #MachineLearning #KVCache #vLLM #FlashAttention #GPU #DeepLearning #ComputerScience`,
    tags: [
      'kv cache',
      'pagedattention',
      'vllm',
      'flashattention',
      'gpu inference',
      'memory wall',
      'h100',
      'transformer architecture',
      'grouped query attention',
      'speculative decoding',
      'ai systems',
      'llm serving',
      'programs magic',
      'computer systems'
    ],
    categoryId: '28' // Science & Technology
  },
  status: {
    privacyStatus: 'private',
    publishAt: '2027-01-26T19:00:00Z',
    selfDeclaredMadeForKids: false
  }
};

console.log('Uploading Episode 12 to YouTube Studio as scheduled release:');
console.log(`  • Title: ${metadata.snippet.title}`);
console.log(`  • Scheduled Release: ${metadata.status.publishAt}`);

const res = await youtube.videos.insert({
  part: ['snippet', 'status'],
  requestBody: metadata,
  media: {
    body: fs.createReadStream(VIDEO_PATH)
  }
});

const videoId = res.data.id;
console.log(`\n🎉 Upload successful! Video ID: ${videoId}`);
console.log(`Watch URL: https://youtu.be/${videoId}`);
console.log(`Studio URL: https://studio.youtube.com/video/${videoId}/edit`);

if (fs.existsSync(THUMB_PATH)) {
  console.log(`Uploading thumbnail: ${THUMB_PATH}...`);
  await youtube.thumbnails.set({
    videoId,
    media: {
      body: fs.createReadStream(THUMB_PATH)
    }
  });
  console.log('✓ Thumbnail uploaded successfully!');
}
