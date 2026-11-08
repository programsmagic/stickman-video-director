#!/usr/bin/env python3
"""
Post Community Discussion Comments & Questions to YouTube Videos.

Note: YouTube API enforces that comments can only be posted once a video
is PUBLIC or UNLISTED. While a video is in SCHEDULED / PRIVATE status,
YouTube's backend disables comment threads (returning 'commentsDisabled').

Run this script once an episode goes live to instantly publish the pinned discussion comment:
    python projects/tools/post_comments.py
"""

import sys
from pathlib import Path
import googleapiclient.discovery
from google.oauth2.credentials import Credentials

ROOT = Path(__file__).resolve().parents[2]
TOKEN_FILE = ROOT / "token.json"

COMMENTS = {
    "sJRTmcEZjUY": (
        "🎯 EPISODE 1 DISCUSSION:\n"
        "If you woke up tomorrow and could see everyone's salary for 7 days, whose number would you check first: "
        "your boss, your partner, or your best friend? Be honest. 👇"
    ),
    "hBf_FabN38M": (
        "🎯 EPISODE 2 DISCUSSION:\n"
        "If everyone's morality score was visible floating above their head, what is one quiet good deed you did that nobody knows about? "
        "Drop your answer below! 👇"
    ),
    "NSeP5Y2jFbA": (
        "🎯 EPISODE 3 DISCUSSION:\n"
        "Would you rather know what everyone really says about you behind your back, or stay blissfully ignorant? "
        "Drop your answer below 👇"
    ),
    "bIXJItPcxEo": (
        "🎯 EPISODE 4 DISCUSSION:\n"
        "If you could set ONE save point in your life and reload it anytime, what age or moment would you choose? 👇"
    ),
    "PS45LXd8LXw": (
        "🎯 EPISODE 5 DISCUSSION:\n"
        "If you saw your own countdown clock and had 10 years left, what's the first thing you would quit doing today? 👇"
    ),
    "8ETfc1dFXV4": (
        "🎯 EPISODE 6 FINALE DISCUSSION:\n"
        "Can a relationship survive 100% honesty with zero polite lies? What's the biggest 'white lie' you tell regularly? 👇"
    ),
}

def main():
    if not TOKEN_FILE.exists():
        print(f"Error: {TOKEN_FILE} not found. Authenticate first.")
        sys.exit(1)

    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    youtube = googleapiclient.discovery.build("youtube", "v3", credentials=creds)

    print("Checking comment availability for Season 1 episodes...\n")

    for vid, comment_text in COMMENTS.items():
        try:
            body = {
                "snippet": {
                    "videoId": vid,
                    "topLevelComment": {
                        "snippet": {
                            "textOriginal": comment_text
                        }
                    }
                }
            }
            res = youtube.commentThreads().insert(part="snippet", body=body).execute()
            print(f"✓ Video {vid}: Comment posted successfully! (Comment ID: {res['id']})")
        except Exception as e:
            err_msg = str(e)
            if "commentsDisabled" in err_msg:
                print(f"⏳ Video {vid}: Still Scheduled/Private (YouTube locks comment creation until the public premiere).")
            else:
                print(f"⚠ Video {vid}: {err_msg}")

    print("\nNote: In YouTube Studio, you can pin any posted comment with 1 click: ⋮ -> Pin.")

if __name__ == "__main__":
    main()

