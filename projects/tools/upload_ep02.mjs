#!/usr/bin/env node
/**
 * Dedicated YouTube Uploader and Scheduler for Episode 02:
 * "How AI Actually Works (Inside the Minds of GPT, Gemini & DeepSeek)"
 * 
 * Features:
 * - Pure native Node.js (Zero npm dependencies)
 * - Automatic OAuth2 token refresh from token.json
 * - Resumable chunked video upload
 * - Custom 1280x720 thumbnail attachment
 * - Closed captions (.en.srt) attachment
 * - Algorithmic peak scheduling (Tuesday 2:00 PM EST / 19:00 UTC)
 * - Pinned discussion comment posting
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve();
const TOKEN_PATH = path.join(ROOT_DIR, 'token.json');

const VIDEO_PATH = path.resolve('exports/EP02-How-AI-Actually-Works-Final.mp4');
const THUMB_PATH = path.resolve('exports/EP02-thumbnail.png');
const SRT_PATH = path.resolve('exports/EP02-How-AI-Actually-Works-Final.en.srt');
const META_PATH = path.resolve('projects/ep08-how-ai-actually-works/publishing/metadata.md');

// Optimal Peak Algorithmic Schedule:
// Target: Global English (US/EU/Asia). Peak window: Tuesday 2:00 PM EST (19:00 UTC / 11:30 PM IST / 12:30 AM IST Nov 18)
const DEFAULT_SCHEDULE_TIME = '2026-11-17T19:00:00.000Z';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    privacy: 'scheduled', // 'scheduled', 'unlisted', 'private', 'public'
    publishAt: DEFAULT_SCHEDULE_TIME,
    skipSrt: false,
    skipThumb: false,
    skipComment: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--privacy' && args[i + 1]) {
      options.privacy = args[++i];
    } else if (args[i] === '--publish-at' && args[i + 1]) {
      options.publishAt = args[++i];
      options.privacy = 'scheduled';
    } else if (args[i] === '--unlisted') {
      options.privacy = 'unlisted';
    } else if (args[i] === '--private') {
      options.privacy = 'private';
    } else if (args[i] === '--public') {
      options.privacy = 'public';
    }
  }
  return options;
}

function parseMetadata() {
  const content = fs.readFileSync(META_PATH, 'utf8');

  // Title
  const titleMatch = content.match(/## 📺 Video Title Options.*?\n1\.\s*\*\*(.*?)\*\*/s);
  const title = titleMatch ? titleMatch[1].trim() : 'How AI Actually Works: Inside the Minds of GPT, Gemini & DeepSeek';

  // Description
  const descMatch = content.match(/## 📌 YouTube Description.*?\n```markdown\n(.*?)```/s);
  let description = descMatch ? descMatch[1].trim() : '';
  // YouTube Data API rejects < and > in video description
  description = description.replace(/</g, '[').replace(/>/g, ']');

  // Tags
  const tagsMatch = content.match(/## 🏷️ High-Intent 2026 YouTube Tags.*?\n```text\n(.*?)```/s);
  const rawTags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean) : [];

  // Pinned comment
  const commentMatch = content.match(/## 💬 Pinned Comment.*?\n```text\n(.*?)```/s);
  const comment = commentMatch ? commentMatch[1].trim() : '';

  // Clean tags within 400 char total limit
  const tags = [];
  let charCount = 0;
  for (const t of rawTags) {
    const clean = t.replace(/[^\w\s-]/g, '').trim();
    if (clean && charCount + clean.length + 1 <= 400) {
      tags.push(clean);
      charCount += clean.length + 1;
    }
  }

  return { title, description, tags, comment };
}

async function getAccessToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`token.json not found in ${ROOT_DIR}. Please authenticate first.`);
  }

  const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

  // Refresh token via OAuth2 endpoint
  console.log('Authenticating with YouTube API...');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: tokenData.client_id,
      client_secret: tokenData.client_secret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }

  tokenData.token = data.access_token;
  tokenData.expiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));

  return data.access_token;
}

async function verifyChannel(accessToken) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  const channel = data.items?.[0];
  if (!channel) {
    throw new Error('Failed to retrieve YouTube channel info.');
  }
  console.log(`✓ Connected to Channel: ${channel.snippet.title} (ID: ${channel.id})`);
  console.log(`  Subscribers: ${channel.statistics?.subscriberCount || 'N/A'}`);
  return channel;
}

async function uploadVideo(accessToken, options, metadata) {
  const stats = fs.statSync(VIDEO_PATH);
  const fileSize = stats.size;
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);

  console.log('\n======================================================');
  console.log(`YOUTUBE UPLOADER: EPISODE 02 FLAGSHIP MASTERPIECE`);
  console.log(`======================================================`);
  console.log(`Title: ${metadata.title}`);
  console.log(`File: ${path.basename(VIDEO_PATH)} (${fileSizeMB} MB)`);

  const statusObj = {
    selfDeclaredMadeForKids: false,
  };

  if (options.privacy === 'scheduled') {
    statusObj.privacyStatus = 'private';
    statusObj.publishAt = options.publishAt;
    console.log(`Release Schedule: TUESDAY, NOVEMBER 17, 2026 @ 19:00 UTC (Peak Audience Window)`);
  } else {
    statusObj.privacyStatus = options.privacy;
    console.log(`Privacy Status: ${options.privacy.toUpperCase()}`);
  }

  const initialBody = {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: '27', // Education
      defaultLanguage: 'en',
      defaultAudioLanguage: 'en',
    },
    status: statusObj,
  };

  // Step 1: Initialize Resumable Upload Session
  console.log('\n1. Initializing Resumable Upload Session...');
  const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(fileSize),
      'X-Upload-Content-Type': 'video/mp4',
    },
    body: JSON.stringify(initialBody),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Failed to initialize upload: ${initRes.status} ${errText}`);
  }

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('No upload location header returned from YouTube.');
  }

  // Step 2: Upload Video File in 10MB Chunks
  console.log('2. Uploading Video Data in Chunks...');
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
  const fileBuffer = fs.readFileSync(VIDEO_PATH);

  let uploadedBytes = 0;
  let videoResource = null;

  while (uploadedBytes < fileSize) {
    const endBytes = Math.min(uploadedBytes + CHUNK_SIZE, fileSize);
    const chunk = fileBuffer.subarray(uploadedBytes, endBytes);

    const chunkRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${uploadedBytes}-${endBytes - 1}/${fileSize}`,
      },
      body: chunk,
    });

    uploadedBytes = endBytes;
    const percent = ((uploadedBytes / fileSize) * 100).toFixed(1);
    process.stdout.write(`  Upload Progress: ${percent}% (${(uploadedBytes / 1024 / 1024).toFixed(1)} / ${fileSizeMB} MB)\r`);

    if (chunkRes.status === 200 || chunkRes.status === 201) {
      videoResource = await chunkRes.json();
      break;
    } else if (chunkRes.status !== 308) {
      const errText = await chunkRes.text();
      throw new Error(`Unexpected upload response: ${chunkRes.status} ${errText}`);
    }
  }

  console.log('\n✓ Master Video Upload Complete!');
  const videoId = videoResource.id;
  console.log(`  Video ID: ${videoId}`);
  console.log(`  Studio Link: https://studio.youtube.com/video/${videoId}/edit`);
  console.log(`  Watch URL:   https://youtu.be/${videoId}`);

  // Step 3: Attach Custom Thumbnail
  if (fs.existsSync(THUMB_PATH)) {
    console.log('\n3. Attaching High-CTR Custom Thumbnail...');
    const thumbBuffer = fs.readFileSync(THUMB_PATH);
    const thumbRes = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/png',
      },
      body: thumbBuffer,
    });
    if (thumbRes.ok) {
      console.log('  ✓ Custom thumbnail successfully attached!');
    } else {
      console.log('  ⚠ Warning attaching thumbnail:', await thumbRes.text());
    }
  }

  // Step 4: Attach Closed Captions Track (.srt)
  if (fs.existsSync(SRT_PATH)) {
    console.log('\n4. Attaching Precision Closed Captions (.en.srt)...');
    const srtContent = fs.readFileSync(SRT_PATH, 'utf8');
    const boundary = '-------314159265358979323846';
    const metadataPart = JSON.stringify({
      snippet: {
        videoId: videoId,
        language: 'en',
        name: 'English',
        isDraft: false,
      },
    });

    const multipartBody = 
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadataPart}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${srtContent}\r\n` +
      `--${boundary}--\r\n`;

    const capRes = await fetch('https://www.googleapis.com/upload/youtube/v3/captions?uploadType=multipart&part=snippet', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (capRes.ok) {
      console.log('  ✓ English subtitles attached successfully!');
    } else {
      console.log('  ⚠ Subtitle note:', await capRes.text());
    }
  }

  // Step 5: Post Pinned Discussion Comment
  if (metadata.comment) {
    console.log('\n5. Posting Discussion Comment...');
    try {
      const commentRes = await fetch('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            videoId: videoId,
            topLevelComment: {
              snippet: {
                textOriginal: metadata.comment,
              },
            },
          },
        }),
      });

      if (commentRes.ok) {
        console.log('  ✓ Discussion comment posted (Ready to pin in YouTube Studio)!');
      } else {
        console.log('  ⚠ Note on comment posting:', await commentRes.text());
      }
    } catch (e) {
      console.log('  ⚠ Comment post note:', e.message);
    }
  }

  console.log('\n======================================================');
  console.log('🎉 EPISODE 02 PUBLISHING & SCHEDULING COMPLETE!');
  console.log(`Video URL: https://youtu.be/${videoId}`);
  if (options.privacy === 'scheduled') {
    console.log(`Scheduled to go LIVE on: Tuesday, November 17, 2026 at 19:00 UTC (2:00 PM EST)`);
  }
  console.log('======================================================\n');

  return videoId;
}

async function main() {
  const options = parseArgs();
  const metadata = parseMetadata();
  const accessToken = await getAccessToken();
  await verifyChannel(accessToken);
  await uploadVideo(accessToken, options, metadata);
}

main().catch(err => {
  console.error('\n❌ Execution Error:', err);
  process.exit(1);
});

