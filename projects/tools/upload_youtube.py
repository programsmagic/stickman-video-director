#!/usr/bin/env python3
"""YouTube automated uploader and scheduler for the stickman video generator.

Uploads videos, applies algorithm-optimized metadata, attaches thumbnails and captions,
and schedules each video for peak viewer engagement.

Usage:
  python3 upload_youtube.py --auth-only
  python3 upload_youtube.py --schedule
  python3 upload_youtube.py --episode 1 --privacy unlisted
  python3 upload_youtube.py --episode all --privacy unlisted --playlist
"""

import argparse
import glob
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
TOKEN_FILE = ROOT_DIR / "token.json"

# Algorithmic peak scheduling calendar:
# Target audience: Global English (US/UK/Canada/EU/India).
# Peak window: Tuesday & Thursday at 2:00 PM EST (19:00 UTC / 11:30 PM IST).
OPTIMAL_SCHEDULE = {
    1: "2026-11-10T19:00:00Z",  # Tuesday: EP01 Premiere
    2: "2026-11-12T19:00:00Z",  # Thursday: EP02 (48 hrs later to trigger binge watch)
    3: "2026-11-17T19:00:00Z",  # Tuesday: EP03
    4: "2026-11-24T19:00:00Z",  # Tuesday: EP04
    5: "2026-12-01T19:00:00Z",  # Tuesday: EP05
    6: "2026-12-08T19:00:00Z",  # Tuesday: EP06 (Season 1 Finale)
}


def find_client_secret():
    if (ROOT_DIR / "client_secret.json").exists():
        return ROOT_DIR / "client_secret.json"
    matches = list(ROOT_DIR.glob("client_secret*.json"))
    if matches:
        return matches[0]
    return None


def get_authenticated_service():
    client_secret_file = find_client_secret()
    if not client_secret_file:
        print("Error: client_secret.json not found in workspace root.")
        sys.exit(1)

    creds = None
    if TOKEN_FILE.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        except Exception as e:
            print(f"Warning: cached token.json invalid ({e}), requesting fresh login.")

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing expired YouTube access token...")
            creds.refresh(Request())
        else:
            print("\n=======================================================")
            print("Action Required: Opening browser for Google login...")
            print("Please approve access for YouTube Uploads.")
            print("=======================================================\n")
            flow = InstalledAppFlow.from_client_secrets_file(str(client_secret_file), SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
        print(f"✓ Authentication token saved to {TOKEN_FILE}")

    youtube = build("youtube", "v3", credentials=creds)
    return youtube


def get_channel_info(youtube):
    channels_response = youtube.channels().list(mine=True, part="snippet,contentDetails,statistics").execute()
    items = channels_response.get("items", [])
    if not items:
        return None
    channel = items[0]
    return {
        "id": channel["id"],
        "title": channel["snippet"]["title"],
        "subscribers": channel["statistics"].get("subscriberCount", "N/A"),
        "videos": channel["statistics"].get("videoCount", "N/A"),
    }


def parse_metadata(ep_num):
    ep_dirs = sorted(ROOT_DIR.glob(f"projects/ep0{ep_num}*"))
    if not ep_dirs:
        raise FileNotFoundError(f"Project directory for EP{ep_num:02d} not found")
    ep_dir = ep_dirs[0]
    meta_file = ep_dir / "publishing" / "metadata.md"

    if not meta_file.exists():
        raise FileNotFoundError(f"Metadata file {meta_file} not found")

    content = meta_file.read_text(encoding="utf-8")

    title_match = re.search(r"## 2\. Title options\s*\n1\.\s*(.+)", content)
    title = title_match.group(1).strip() if title_match else f"Episode {ep_num}"

    desc_match = re.search(r"## 3\. Description \(paste-ready\)\s*\n```[a-z]*\n(.*?)```", content, re.DOTALL)
    description = desc_match.group(1).strip() if desc_match else ""

    tags_match = re.search(r"## Tags\s*\n(?:```[a-z]*\n)?(.*?)(?:```|\n##|$)", content, re.DOTALL)
    tags_str = tags_match.group(1).strip() if tags_match else ""
    tags = [t.strip() for t in tags_str.split(",") if t.strip()]

    video_matches = list(ROOT_DIR.glob(f"exports/EP0{ep_num}-*.mp4"))
    srt_matches = list(ROOT_DIR.glob(f"exports/EP0{ep_num}-*.en.srt"))
    thumb_matches = list(ROOT_DIR.glob(f"exports/EP0{ep_num}-thumbnail.png"))

    if not video_matches:
        raise FileNotFoundError(f"Video exports/EP0{ep_num}-*.mp4 not found")

    return {
        "num": ep_num,
        "title": title,
        "description": description,
        "tags": tags,
        "video_path": video_matches[0],
        "srt_path": srt_matches[0] if srt_matches else None,
        "thumb_path": thumb_matches[0] if thumb_matches else None,
    }


def upload_video(youtube, ep_data, privacy_status="private", publish_at=None):
    print(f"\n==========================================")
    print(f"Uploading EP{ep_data['num']:02d}: {ep_data['title']}")
    if publish_at:
        print(f"Status: SCHEDULED for {publish_at} (Peak Audience Window)")
    else:
        print(f"Status: {privacy_status.upper()}")
    print(f"File: {ep_data['video_path'].name}")
    print(f"==========================================")

    status_dict = {
        "selfDeclaredMadeForKids": False,
    }

    if publish_at:
        status_dict["privacyStatus"] = "private"
        status_dict["publishAt"] = publish_at
    else:
        status_dict["privacyStatus"] = privacy_status

    body = {
        "snippet": {
            "title": ep_data["title"],
            "description": ep_data["description"],
            "tags": ep_data["tags"],
            "categoryId": "27",  # 27 = Education
            "defaultLanguage": "en",
            "defaultAudioLanguage": "en",
        },
        "status": status_dict,
    }

    media = MediaFileUpload(str(ep_data["video_path"]), chunksize=1024 * 1024 * 5, resumable=True, mimetype="video/mp4")
    request = youtube.videos().insert(part=",".join(body.keys()), body=body, media_body=media)

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"  Uploading: {int(status.progress() * 100)}%", end="\r", flush=True)

    video_id = response["id"]
    print(f"\n  ✓ Video uploaded! Video ID: {video_id}")
    print(f"  URL: https://youtu.be/{video_id}")

    # Set Custom Thumbnail
    if ep_data["thumb_path"] and ep_data["thumb_path"].exists():
        try:
            print(f"  Uploading thumbnail: {ep_data['thumb_path'].name}...")
            youtube.thumbnails().set(
                videoId=video_id,
                media_body=MediaFileUpload(str(ep_data["thumb_path"]), mimetype="image/png"),
            ).execute()
            print(f"  ✓ Thumbnail set successfully!")
        except Exception as e:
            print(f"  ⚠ Thumbnail error: {e}")

    # Upload Captions Track
    if ep_data["srt_path"] and ep_data["srt_path"].exists():
        try:
            print(f"  Uploading subtitle track: {ep_data['srt_path'].name}...")
            caption_body = {
                "snippet": {
                    "videoId": video_id,
                    "language": "en",
                    "name": "English",
                    "isDraft": False,
                }
            }
            youtube.captions().insert(
                part="snippet",
                body=caption_body,
                media_body=MediaFileUpload(str(ep_data["srt_path"]), mimetype="*/*"),
            ).execute()
            print(f"  ✓ Captions track uploaded successfully!")
        except Exception as e:
            print(f"  ⚠ Captions upload note: {e}")

    return video_id


def create_or_update_playlist(youtube, video_ids, privacy="public"):
    title = "The Perception Paradox: What If You Could See Everyone's ___? (Season 1 Full Series)"
    description = (
        "What if human beings were stripped of every polite illusion?\n\n"
        "In Season 1 of 'The Perception Paradox,' mascot Magi experiences six impossible seven-day superpowers: "
        "seeing everyone's salary, seeing their karma score, overhearing whispers behind his back, creating an "
        "infinite real-life save point, watching countdown clocks of human mortality, and detecting every spoken lie.\n\n"
        "Watch the complete 6-part series in order.\n\n"
        "Subscribe for Season 2: The Anomaly."
    )

    print(f"\nCreating Playlist: '{title}'...")
    playlist_res = youtube.playlists().insert(
        part="snippet,status",
        body={
            "snippet": {"title": title, "description": description},
            "status": {"privacyStatus": privacy},
        },
    ).execute()

    playlist_id = playlist_res["id"]
    print(f"✓ Playlist created! ID: {playlist_id} (https://www.youtube.com/playlist?list={playlist_id})")

    for idx, vid in enumerate(video_ids):
        try:
            youtube.playlistItems().insert(
                part="snippet",
                body={
                    "snippet": {
                        "playlistId": playlist_id,
                        "position": idx,
                        "resourceId": {"kind": "youtube#video", "videoId": vid},
                    }
                },
            ).execute()
            print(f"  Added video {vid} at position {idx + 1}")
        except Exception as e:
            print(f"  Playlist item note: {e}")

    return playlist_id


def main():
    parser = argparse.ArgumentParser(description="Upload and schedule Season 1 videos to YouTube")
    parser.add_argument("--auth-only", action="store_true", help="Authorize Google account and exit")
    parser.add_argument("--schedule", action="store_true", help="Upload and schedule all 6 episodes for peak release dates")
    parser.add_argument("--episode", choices=["1", "2", "3", "4", "5", "6", "all"], help="Episode number to upload")
    parser.add_argument("--privacy", choices=["private", "unlisted", "public"], default="unlisted", help="Privacy status (if not scheduled)")
    parser.add_argument("--playlist", action="store_true", help="Create and populate Season 1 playlist")
    args = parser.parse_args()

    youtube = get_authenticated_service()
    channel = get_channel_info(youtube)
    if channel:
        print(f"\n✓ Connected to YouTube Channel: {channel['title']} (ID: {channel['id']})")
        print(f"  Subscribers: {channel['subscribers']} · Videos: {channel['videos']}")
    else:
        print("\n✓ Connected to YouTube API successfully!")

    if args.auth_only:
        return

    if args.schedule:
        print("\n=======================================================")
        print("LAUNCHING ALGORITHMIC PEAK SCHEDULE (SEASON 1)")
        print("=======================================================")
        uploaded_ids = []
        for ep_num in range(1, 7):
            publish_time = OPTIMAL_SCHEDULE[ep_num]
            data = parse_metadata(ep_num)
            vid = upload_video(youtube, data, publish_at=publish_time)
            uploaded_ids.append(vid)

        create_or_update_playlist(youtube, uploaded_ids, privacy="public")
        print("\n🎉 All 6 episodes uploaded, scheduled, and added to the official Season 1 Playlist!")
        return

    if not args.episode:
        print("\nSpecify --schedule to auto-schedule all episodes, or --episode 1 to upload individually.")
        return

    episodes = [int(args.episode)] if args.episode != "all" else [1, 2, 3, 4, 5, 6]
    uploaded_ids = []

    for ep in episodes:
        data = parse_metadata(ep)
        vid = upload_video(youtube, data, privacy_status=args.privacy)
        uploaded_ids.append(vid)

    if args.playlist and uploaded_ids:
        create_or_update_playlist(youtube, uploaded_ids, privacy=args.privacy)

    print("\n🎉 All requested uploads completed successfully!")


if __name__ == "__main__":
    main()
