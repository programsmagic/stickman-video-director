#!/usr/bin/env python3
import sys
from pathlib import Path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import re

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
TOKEN_FILE = ROOT_DIR / "token.json"
META_FILE = ROOT_DIR / "projects" / "ep07-history-of-ai" / "publishing" / "metadata.md"
VIDEO_ID = "EbMXwhr_45k"

creds = Credentials.from_authorized_user_file(str(TOKEN_FILE))
youtube = build("youtube", "v3", credentials=creds)

content = META_FILE.read_text(encoding="utf-8")
desc_match = re.search(r"## 📌 YouTube Description.*?\n```markdown\n(.*?)```", content, re.DOTALL)
description = desc_match.group(1).strip() if desc_match else ""

res = youtube.videos().list(part="snippet", id=VIDEO_ID).execute()
if res["items"]:
    item = res["items"][0]
    snippet = item["snippet"]
    snippet["description"] = description
    youtube.videos().update(part="snippet", body={"id": VIDEO_ID, "snippet": snippet}).execute()
    print("✓ Successfully updated live YouTube description with 33-page companion book link!")
else:
    print(f"Video {VIDEO_ID} not found.")

