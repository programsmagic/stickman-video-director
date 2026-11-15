#!/usr/bin/env node
/**
 * Dedicated YouTube Uploader and Scheduler for Episode 03:
 * "Can AI Ever Become Conscious? (The Chinese Room, Qualia & Inside the Minds of Silicon)"
 * 
 * Features:
 * - Pure native Node.js (Zero npm dependencies)
 * - Automatic OAuth2 token refresh from token.json
 * - Resumable chunked video upload
 * - Custom 1280x720 thumbnail attachment
 * - Closed captions (.en.srt) attachment
 * - Algorithmic peak scheduling (Tuesday, Nov 24, 2026 @ 19:00 UTC)
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve();
const TOKEN_PATH = path.join(ROOT_DIR, 'token.json');

const VIDEO_PATH = path.resolve('exports/EP09-Can-AI-Become-Conscious-Final.mp4');
const THUMB_PATH = path.resolve('exports/EP09-thumbnail.png');
const SRT_PATH = path.resolve('exports/EP09-Can-AI-Become-Conscious-Final.en.srt');
const META_PATH = path.resolve('projects/ep09-can-ai-become-conscious/publishing/metadata.md');

// Optimal Release Date: Tuesday, Nov 24, 2026 at 19:00 UTC (2:00 PM EST)
const DEFAULT_SCHEDULE_TIME = '2026-11-24T19:00:00.000Z';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    privacy: 'scheduled',
    publishAt: DEFAULT_SCHEDULE_TIME,
    skipSrt: false,
    skipThumb: false,
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
  const title = titleMatch ? titleMatch[1].trim() : 'Can AI Ever Become Conscious? (The Chinese Room, Qualia & Inside the Minds of Silicon)';

  // Description
  const descMatch = content.match(/## 📌 YouTube Description.*?\n```markdown\n(.*?)```/s);
  let description = descMatch ? descMatch[1].trim() : '';
  description = description.replace(/</g, '[').replace(/>/g, ']');

  const tags = [
    'AI', 'Consciousness', 'Philosophy of Mind', 'Chinese Room', 'John Searle',
    'Qualia', 'David Chalmers', 'Hard Problem of Consciousness', 'Integrated Information Theory',
    'Giulio Tononi', 'Phi', 'Philosophical Zombie', 'Artificial Intelligence', 'ChatGPT',
    'Gemini', 'DeepSeek', 'Neuroscience', 'Computer Science', 'Singularity'
  ];

  return { title, description, tags };
}

async function loadAuth() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`Token file not found at ${TOKEN_PATH}. Run 'node projects/tools/auth_youtube.mjs' first.`);
  }

  const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

  // Refresh token if needed
  const isExpired = !tokenData.expiry_date || Date.now() > (tokenData.expiry_date - 60000);
  if (isExpired && tokenData.refresh_token) {
    console.log('• Access token expired. Refreshing using OAuth refresh token...');
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: tokenData.client_id,
        client_secret: tokenData.client_secret,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshRes.ok) {
      const errText = await refreshRes.text();
      throw new Error(`Token refresh failed (${refreshRes.status}): ${errText}`);
    }

    const newTokens = await refreshRes.json();
    tokenData.access_token = newTokens.access_token;
    tokenData.expiry_date = Date.now() + (newTokens.expires_in * 1000);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
    console.log('✅ Access token successfully refreshed.');
  }

  return tokenData.access_token;
}

async function uploadVideo(accessToken, options, metadata) {
  const stat = fs.statSync(VIDEO_PATH);
  const fileSize = stat.size;
  console.log(`• Preparing resumable upload for: ${path.basename(VIDEO_PATH)} (${(fileSize / (1024*1024)).toFixed(2)} MB)...`);

  const initialBody = {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: '28', // Science & Technology
      defaultLanguage: 'en',
      defaultAudioLanguage: 'en',
    },
    status: {
      privacyStatus: options.privacy === 'scheduled' ? 'private' : options.privacy,
      selfDeclaredMadeForKids: false,
    },
  };

  if (options.privacy === 'scheduled' && options.publishAt) {
    initialBody.status.publishAt = options.publishAt;
  }

  const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': fileSize.toString(),
    },
    body: JSON.stringify(initialBody),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Failed to initiate video upload (${initRes.status}): ${errText}`);
  }

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) throw new Error('No upload location header returned by YouTube API.');

  console.log('• Uploading binary video stream...');
  const fileBuffer = fs.readFileSync(VIDEO_PATH);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': fileSize.toString(),
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Video stream upload failed (${uploadRes.status}): ${errText}`);
  }

  const uploadedData = await uploadRes.json();
  console.log(`✅ Video uploaded successfully! Video ID: ${uploadedData.id}`);
  return uploadedData.id;
}

async function uploadThumbnail(accessToken, videoId) {
  if (!fs.existsSync(THUMB_PATH)) {
    console.warn(`⚠️ Thumbnail file not found at ${THUMB_PATH}. Skipping thumbnail.`);
    return;
  }

  console.log(`• Uploading custom thumbnail from: ${path.basename(THUMB_PATH)}...`);
  const thumbBuffer = fs.readFileSync(THUMB_PATH);
  const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'image/png',
    },
    body: thumbBuffer,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`⚠️ Thumbnail upload warning (${res.status}): ${errText}`);
  } else {
    console.log('✅ Custom thumbnail attached successfully.');
  }
}

async function uploadCaptions(accessToken, videoId) {
  if (!fs.existsSync(SRT_PATH)) {
    console.warn(`⚠️ SRT file not found at ${SRT_PATH}. Skipping closed captions.`);
    return;
  }

  console.log(`• Uploading closed captions from: ${path.basename(SRT_PATH)}...`);
  const srtContent = fs.readFileSync(SRT_PATH, 'utf8');
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    snippet: {
      videoId: videoId,
      language: 'en',
      name: 'English',
      isDraft: false,
    },
  };

  const multipartBody = Buffer.concat([
    Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata)),
    Buffer.from(delimiter + 'Content-Type: text/plain\r\n\r\n' + srtContent),
    Buffer.from(closeDelimiter),
  ]);

  const res = await fetch('https://www.googleapis.com/upload/youtube/v3/captions?part=snippet', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': multipartBody.length.toString(),
    },
    body: multipartBody,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`⚠️ Captions upload warning (${res.status}): ${errText}`);
  } else {
    console.log('✅ English closed captions attached successfully.');
  }
}

async function main() {
  console.log('=== YOUTUBE PUBLISHER: EPISODE 03 ===');
  const options = parseArgs();
  const metadata = parseMetadata();

  console.log(`Title: ${metadata.title}`);
  console.log(`Privacy: ${options.privacy.toUpperCase()}`);
  if (options.privacy === 'scheduled') {
    console.log(`Scheduled Release: ${options.publishAt}`);
  }

  const accessToken = await loadAuth();
  const videoId = await uploadVideo(accessToken, options, metadata);

  if (!options.skipThumb) await uploadThumbnail(accessToken, videoId);
  if (!options.skipSrt) await uploadCaptions(accessToken, videoId);

  console.log('\n======================================================');
  console.log('🎉 EPISODE 03 RELEASE PACKAGE COMPLETE!');
  console.log(`📺 Watch URL: https://youtu.be/${videoId}`);
  console.log(`🛠️ Studio URL: https://studio.youtube.com/video/${videoId}/edit`);
  console.log(`📅 Premiere Time: ${options.publishAt}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('\n❌ Upload Failed:', err.message);
  process.exit(1);
});
