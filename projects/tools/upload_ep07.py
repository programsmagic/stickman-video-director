#!/usr/bin/env python3
"""Dedicated YouTube Uploader for Flagship Episode 07: The Complete History of AI."""

import os
import re
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
TOKEN_FILE = ROOT_DIR / "token.json"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]

EP07_VIDEO = ROOT_DIR / "exports" / "EP07-The-Complete-History-of-AI.mp4"
EP07_THUMB = ROOT_DIR / "exports" / "EP07-thumbnail.png"
EP07_SRT = ROOT_DIR / "exports" / "EP07-The-Complete-History-of-AI.en.srt"
EP07_META = ROOT_DIR / "projects" / "ep07-history-of-ai" / "publishing" / "metadata.md"

def get_authenticated_service():
    if not TOKEN_FILE.exists():
        print(f"Error: {TOKEN_FILE} not found. Please authenticate first.")
        sys.exit(1)

    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            print("Refreshing expired YouTube access token...")
            creds.refresh(Request())
            with open(TOKEN_FILE, "w") as f:
                f.write(creds.to_json())
            print(f"✓ Authentication token refreshed and saved.")
        else:
            print("Error: Refresh token not found or invalid.")
            sys.exit(1)

    return build("youtube", "v3", credentials=creds)

def parse_metadata():
    content = EP07_META.read_text(encoding="utf-8")

    title_match = re.search(r"## 📺 Video Title Options.*?\n1\.\s*\*\*(.*?)\*\*", content, re.DOTALL)
    title = title_match.group(1).strip() if title_match else "How We Taught Sand to Think: The Complete History of AI (1950–2026)"

    desc_match = re.search(r"## 📌 YouTube Description.*?\n```markdown\n(.*?)```", content, re.DOTALL)
    description = desc_match.group(1).strip() if desc_match else ""

    tags_match = re.search(r"## 🏷️ High-Intent 2026 YouTube Tags.*?\n```text\n(.*?)```", content, re.DOTALL)
    tags_str = tags_match.group(1).strip() if tags_match else ""
    raw_tags = [t.strip() for t in tags_str.split(",") if t.strip()]

    # Sanitize and ensure total character length < 400 (YouTube hard limit is 500)
    cleaned_tags = []
    current_len = 0
    for t in raw_tags:
        clean = re.sub(r"[^\w\s-]", "", t).strip()
        if clean and current_len + len(clean) + 1 <= 400:
            cleaned_tags.append(clean)
            current_len += len(clean) + 1

    return title, description, cleaned_tags

def main():
    print("=======================================================")
    print("YOUTUBE UPLOADER: EPISODE 07 FLAGSHIP DOCUMENTARY")
    print("=======================================================\n")

    if not EP07_VIDEO.exists():
        print(f"Error: Master video {EP07_VIDEO} not found!")
        sys.exit(1)

    import argparse
    parser = argparse.ArgumentParser(description="Upload EP07 Flagship to YouTube")
    parser.add_argument("--delete-old", type=str, help="Old YouTube video ID to delete", default=None)
    args = parser.parse_args()

    youtube = get_authenticated_service()

    if args.delete_old:
        try:
            print(f"Cleaning up previous draft video ID: {args.delete_old}...")
            youtube.videos().delete(id=args.delete_old).execute()
            print(f"✓ Deleted old video {args.delete_old} successfully.")
        except Exception as e:
            print(f"⚠ Note when deleting old draft: {e}")

    channel_res = youtube.channels().list(mine=True, part="snippet,statistics").execute()
    channel = channel_res["items"][0]
    print(f"✓ Connected to Channel: {channel['snippet']['title']} (ID: {channel['id']})")
    print(f"  Subscribers: {channel['statistics'].get('subscriberCount', 'N/A')}\n")

    title, description, tags = parse_metadata()
    print(f"Title: {title}")
    print(f"Video file: {EP07_VIDEO.name} ({os.path.getsize(EP07_VIDEO) / (1024*1024):.1f} MB)")
    print(f"Privacy Status: PRIVATE (Ready for review & schedule)\n")

    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": "27",  # Education
            "defaultLanguage": "en",
            "defaultAudioLanguage": "en",
        },
        "status": {
            "privacyStatus": "private",
            "selfDeclaredMadeForKids": False,
        }
    }

    media = MediaFileUpload(
        str(EP07_VIDEO),
        mimetype="video/mp4",
        chunksize=1024 * 1024 * 5,
        resumable=True
    )

    print("Uploading video stream to YouTube...")
    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media
    )

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"  Uploading: {int(status.progress() * 100)}%", end="\r", flush=True)

    video_id = response["id"]
    print(f"\n✓ Video Upload Complete!")
    print(f"  Video ID: {video_id}")
    print(f"  Private Studio Link: https://studio.youtube.com/video/{video_id}/edit")
    print(f"  Watch Link: https://youtu.be/{video_id}\n")

    # Upload Custom Thumbnail
    if EP07_THUMB.exists():
        try:
            print(f"Uploading High-Impact Thumbnail: {EP07_THUMB.name}...")
            youtube.thumbnails().set(
                videoId=video_id,
                media_body=MediaFileUpload(str(EP07_THUMB), mimetype="image/png")
            ).execute()
            print("✓ Custom thumbnail applied successfully!")
        except Exception as e:
            print(f"⚠ Thumbnail upload notice: {e}")

    # Upload English Captions Track
    if EP07_SRT.exists():
        try:
            print(f"Uploading English Subtitles Track: {EP07_SRT.name}...")
            caption_body = {
                "snippet": {
                    "videoId": video_id,
                    "language": "en",
                    "name": "English",
                    "isDraft": False
                }
            }
            youtube.captions().insert(
                part="snippet",
                body=caption_body,
                media_body=MediaFileUpload(str(EP07_SRT), mimetype="*/*")
            ).execute()
            print("✓ Subtitle track attached successfully!")
        except Exception as e:
            print(f"⚠ Captions upload notice: {e}")

    print("\n=======================================================")
    print("SUCCESS: EPISODE 07 IS SAFELY UPLOADED IN PRIVATE STATUS")
    print(f"Video URL: https://youtu.be/{video_id}")
    print("=======================================================")

if __name__ == "__main__":
    main()
