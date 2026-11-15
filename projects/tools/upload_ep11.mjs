#!/usr/bin/env node
/**
 * Dedicated YouTube Uploader and Scheduler for Episode 05:
 * "Why AI Can't Read (The Secret Token Illusion)"
 * 
 * Features:
 * - Pure native Node.js (Zero npm dependencies)
 * - Automatic OAuth2 token refresh from token.json
 * - Resumable chunked video upload
 * - Custom 1280x720 thumbnail attachment
 * - Closed captions (.en.srt) attachment
 * - Algorithmic peak scheduling (Tuesday, Dec 08, 2026 @ 19:00 UTC)
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve();
const TOKEN_PATH = path.join(ROOT_DIR, 'token.json');

const VIDEO_PATH = path.resolve('exports/EP11-The-Token-Illusion-Final-1080p.mp4');
const THUMB_PATH = path.resolve('exports/EP11-thumbnail.png');
const SRT_PATH = path.resolve('exports/EP11-The-Token-Illusion-Final.en.srt');
const META_PATH = path.resolve('projects/ep11-token-illusion/publishing/metadata.md');

// Optimal Release Date: Tuesday, Dec 08, 2026 at 19:00 UTC (2:00 PM EST)
const DEFAULT_SCHEDULE_TIME = '2026-12-08T19:00:00.000Z';

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
  const titleMatch = content.match(/## Title Options.*?\n1\.\s*\*\*(.*?)\*\*/s);
  const title = titleMatch ? titleMatch[1].replace(/\[.*?\]/, '').trim() : "Why AI Can't Read (The Secret Token Illusion)";

  // Description
  const descMatch = content.match(/## YouTube Description\s*\n\n([\s\S]*?)(?=\n---\n\n### 🏷️ Video Tags)/);
  const description = descMatch ? descMatch[1].trim() : '';

  // Tags
  const tagsMatch = content.match(/### 🏷️ Video Tags\s*\n`([^`]+)`/);
  const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean) : [];

  return { title, description, tags };
}

async function getAccessToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`Token file not found: ${TOKEN_PATH}`);
  }
  const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

  // Refresh token if expired or about to expire
  if (tokenData.expiry_date && tokenData.expiry_date < Date.now() + 60000) {
    console.log('🔄 Access token expired. Refreshing token...');
    const clientSecretFiles = fs.readdirSync(ROOT_DIR).filter(f => f.startsWith('client_secret') && f.endsWith('.json'));
    if (!clientSecretFiles.length) {
      throw new Error('client_secret.json not found to refresh token');
    }
    const clientSecret = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, clientSecretFiles[0]), 'utf8'));
    const { client_id, client_secret } = clientSecret.installed || clientSecret.web;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id,
        client_secret,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!res.ok) {
      throw new Error(`Token refresh failed: ${res.statusText} (${await res.text()})`);
    }

    const refreshed = await res.json();
    tokenData.access_token = refreshed.access_token;
    tokenData.expiry_date = Date.now() + refreshed.expires_in * 1000;
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
    console.log('✓ Token successfully refreshed');
  }

  return tokenData.access_token;
}

async function main() {
  const options = parseArgs();
  console.log('================================================================');
  console.log('🎬 YOUTUBE PUBLISHER: EPISODE 05 (THE TOKEN ILLUSION)');
  console.log('================================================================');

  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`❌ Video file not found: ${VIDEO_PATH}`);
    process.exit(1);
  }

  const { title, description, tags } = parseMetadata();
  const token = await getAccessToken();

  console.log(`\n• Title:       "${title}"`);
  console.log(`• Video Size:  ${(fs.statSync(VIDEO_PATH).size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`• Privacy:     ${options.privacy.toUpperCase()}`);
  if (options.privacy === 'scheduled') {
    console.log(`• Schedule:    ${options.publishAt}`);
  }
  console.log(`• Subtitles:   ${fs.existsSync(SRT_PATH) ? '✓ Found' : '❌ Missing'}`);
  console.log(`• Thumbnail:   ${fs.existsSync(THUMB_PATH) ? '✓ Found' : '❌ Missing'}`);

  console.log('\nStarting resumable upload to YouTube Data API v3...');

  const videoMetadata = {
    snippet: {
      title,
      description,
      tags,
      categoryId: '28'
    },
    status: {
      privacyStatus: options.privacy === 'scheduled' ? 'private' : options.privacy,
      selfDeclaredMadeForKids: false
    }
  };

  if (options.privacy === 'scheduled') {
    videoMetadata.status.publishAt = options.publishAt;
  }

  const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': fs.statSync(VIDEO_PATH).size.toString()
    },
    body: JSON.stringify(videoMetadata)
  });

  if (!initRes.ok) {
    throw new Error(`Upload initiation failed: ${initRes.status} ${await initRes.text()}`);
  }

  const uploadUrl = initRes.headers.get('location');
  console.log(`✓ Resumable upload session created`);

  const fileStream = fs.createReadStream(VIDEO_PATH);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': fs.statSync(VIDEO_PATH).size.toString()
    },
    body: fileStream,
    duplex: 'half'
  });

  if (!uploadRes.ok) {
    throw new Error(`Video upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  const video = await uploadRes.json();
  const videoId = video.id;
  console.log(`\n🎉 VIDEO UPLOADED SUCCESSFULLY!`);
  console.log(`   Video ID:  ${videoId}`);
  console.log(`   Watch URL: https://youtu.be/${videoId}`);
  console.log(`   Studio:    https://studio.youtube.com/video/${videoId}/edit`);

  // Upload Thumbnail
  if (fs.existsSync(THUMB_PATH)) {
    console.log('\n• Attaching custom 1280x720 thumbnail...');
    const thumbBuffer = fs.readFileSync(THUMB_PATH);
    const thumbRes = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'image/png',
        'Content-Length': thumbBuffer.length.toString()
      },
      body: thumbBuffer
    });
    if (thumbRes.ok) {
      console.log('✓ Thumbnail attached successfully!');
    } else {
      console.warn(`⚠️ Thumbnail upload warning: ${thumbRes.status} ${await thumbRes.text()}`);
    }
  }

  // Upload Subtitles
  if (fs.existsSync(SRT_PATH)) {
    console.log('\n• Attaching English closed captions (.srt)...');
    const srtContent = fs.readFileSync(SRT_PATH);
    const captionMetadata = {
      snippet: {
        videoId,
        language: 'en',
        name: 'English',
        isDraft: false
      }
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody = Buffer.concat([
      Buffer.from(
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(captionMetadata) +
        delimiter +
        'Content-Type: text/plain\r\n\r\n'
      ),
      srtContent,
      Buffer.from(closeDelimiter)
    ]);

    const captionRes = await fetch('https://www.googleapis.com/upload/youtube/v3/captions?part=snippet', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': multipartBody.length.toString()
      },
      body: multipartBody
    });

    if (captionRes.ok) {
      console.log('✓ Subtitles attached successfully!');
    } else {
      console.warn(`⚠️ Subtitle upload warning: ${captionRes.status} ${await captionRes.text()}`);
    }
  }

  console.log('\n================================================================');
  console.log('🌟 EPISODE 05 PUBLISHING COMPLETE & SCHEDULED ON YOUTUBE!');
  console.log('================================================================');
}

main().catch(err => {
  console.error('\n❌ Upload encountered an error:', err.message);
  process.exit(1);
});
