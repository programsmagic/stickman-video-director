#!/usr/bin/env python3
"""Update live Episode 07 on YouTube with Million-View Viral Packaging."""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from googleapiclient.http import MediaFileUpload
from projects.tools.upload_ep07 import get_authenticated_service
VIDEO_ID = "Yglwneiq6Wk"
THUMB_PATH = ROOT_DIR / "exports" / "EP07-thumbnail.png"

VIRAL_TITLE = "How We Taught Sand to Think"

VIRAL_DESCRIPTION = """If sand can learn to think when infused with electricity... what makes the human brain any different?

In 1950, a top-tier computer had less memory than a modern kitchen toaster. Today, autonomous neural agents write code, simulate physical reality, and orchestrate complex workflows. How did humanity teach melted rocks to think?

In this documentary, Magi breaks down the complete 76-year journey of Artificial Intelligence: from Alan Turing's 1950 thought experiment and the euphoric 1956 Dartmouth conference, through the brutal freezes of the AI Winters and the logical failure of XOR, to the accidental GPU gaming revolution, Transformers ("Attention Is All You Need"), generative diffusion, and modern Autonomous Agents.

Every historical milestone and mathematical algorithm in this video is academically cited and verified against original research papers.

⏱️ TIMESTAMPS & CHAPTERS:
0:00 - The Dream of Thinking Sand (1950–1956)
0:59 - The Two Freezes: The AI Winters (1974–1993)
2:01 - The GPU Gamble: The Deep Learning Spark (2006–2012)
2:58 - Attention Is All You Need (2017)
3:50 - When Machines Learned to Imagine (2020–2024)
4:31 - The Agentic Horizon: Beyond Chatbots (2025–2026)

🔬 ACADEMIC CITATIONS & RESEARCH PAPERS:
• Turing, A. M. (1950). "Computing Machinery and Intelligence." Mind, 59(236), 433–460.
• McCarthy, J., Minsky, M. L., Rochester, N., & Shannon, C. E. (1955). "A Proposal for the Dartmouth Summer Research Project on Artificial Intelligence."
• Minsky, M., & Papert, S. (1969). "Perceptrons: An Introduction to Computational Geometry." MIT Press.
• Lighthill, J. (1973). "Artificial Intelligence: A General Survey." Science Research Council.
• Krizhevsky, A., Sutskever, I., & Hinton, G. E. (2012). "ImageNet Classification with Deep Convolutional Neural Networks." NeurIPS.
• Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). "Attention Is All You Need." NeurIPS.
• Ho, J., Jain, A., & Abbeel, P. (2020). "Denoising Diffusion Probabilistic Models." NeurIPS.

🎨 Animation & Production:
Character: Magi (Programs Magic)
Visual Direction: Physically Grounded Skeletal Kinematics + Theatrical Blocking + Minimalist Line Art
Audio & Narration: Google Gemini Deep Speech Engine (Bodi 24kHz)
Master Resolution: 1280×720 Progressive Widescreen 24 FPS (FastStart)

#AI #ArtificialIntelligence #HistoryOfAI #AutonomousAgents #DeepLearning #MachineLearning #TechDocumentary #ComputerScience #Transformers #NeuralNetworks
"""

VIRAL_TAGS = [
    "history of ai",
    "how we taught sand to think",
    "thinking sand",
    "complete history of artificial intelligence",
    "alan turing 1950",
    "ai winter lighthill report",
    "perceptrons xor problem",
    "alexnet 2012 deep learning",
    "nvidia gpu ai revolution",
    "attention is all you need",
    "transformer architecture explained",
    "diffusion models explained",
    "autonomous agents 2026",
    "computer science documentary",
    "programs magic"
]

def main():
    youtube = get_authenticated_service()

    print(f"Updating YouTube Video: {VIDEO_ID}...")

    # 1. Update snippet metadata
    update_body = {
        "id": VIDEO_ID,
        "snippet": {
            "title": VIRAL_TITLE,
            "description": VIRAL_DESCRIPTION.strip(),
            "tags": VIRAL_TAGS,
            "categoryId": "27",  # Education
            "defaultLanguage": "en",
            "defaultAudioLanguage": "en"
        }
    }

    res = youtube.videos().update(part="snippet", body=update_body).execute()
    print(f"✓ Video metadata updated!")
    print(f"  New Title: {res['snippet']['title']}")

    # 2. Update Thumbnail
    if THUMB_PATH.exists():
        print(f"Updating Max-Resolution Thumbnail: {THUMB_PATH.name}...")
        youtube.thumbnails().set(
            videoId=VIDEO_ID,
            media_body=MediaFileUpload(str(THUMB_PATH), mimetype="image/png")
        ).execute()
        print("✓ New viral thumbnail uploaded successfully!")

    print(f"\nLive Studio Link: https://studio.youtube.com/video/{VIDEO_ID}/edit")
    print(f"Live Watch Link: https://youtu.be/{VIDEO_ID}")

if __name__ == "__main__":
    main()
