#!/usr/bin/env python3
"""Update live YouTube video thumbnail with the new professional thumbnail."""

import sys
from pathlib import Path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
TOKEN_FILE = ROOT_DIR / "token.json"
THUMB_FILE = ROOT_DIR / "exports" / "EP07-thumbnail.png"
VIDEO_ID = "N9caezm0gMc"

if not TOKEN_FILE.exists():
    print(f"Error: {TOKEN_FILE} not found.")
    sys.exit(1)

creds = Credentials.from_authorized_user_file(str(TOKEN_FILE))
youtube = build("youtube", "v3", credentials=creds)

print(f"Uploading new professional thumbnail to YouTube Video ID: {VIDEO_ID}...")
res = youtube.thumbnails().set(
    videoId=VIDEO_ID,
    media_body=MediaFileUpload(str(THUMB_FILE), mimetype="image/png")
).execute()
print("✓ New professional thumbnail applied successfully to YouTube!")
print(f"  Watch Link: https://youtu.be/{VIDEO_ID}")

