"""Time the approved narration text with Whisper word timings.

Whisper mishears some words ("You're exact income"), so captions use the
approved chapter text and borrow only the timings: tokens are matched in
order, and unmatched approved words are interpolated between neighbours.

Usage:
  python3 captions.py NARRATION_DIR --lead 0.15 --gap 0.6 --output captions.json
NARRATION_DIR holds chN.txt, chN.wav and chN.words.json (from align_captions.py).
"""

import argparse
import json
import re
import subprocess
from difflib import SequenceMatcher
from pathlib import Path

MAX_CHARS = 54  # one 34px B1 caption line at 1280×720; the renderer re-checks fit


def norm(token):
    return re.sub(r"[^a-z0-9]", "", token.lower())


def duration(wav):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(wav)], capture_output=True, text=True, check=True)
    return float(out.stdout)


def timed_tokens(text, words):
    approved = text.split()
    heard = [w["word"].strip() for w in words]
    times = [None] * len(approved)
    matcher = SequenceMatcher(a=[norm(t) for t in approved], b=[norm(t) for t in heard], autojunk=False)
    for block in matcher.get_matching_blocks():
        for k in range(block.size):
            w = words[block.b + k]
            times[block.a + k] = (w["start"], w["end"])
    # Interpolate gaps between known neighbours.
    i = 0
    while i < len(times):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(times) and times[j] is None:
            j += 1
        left = times[i - 1][1] if i > 0 else (words[0]["start"] if words else 0.0)
        right = times[j][0] if j < len(times) else (words[-1]["end"] if words else left)
        step = (right - left) / (j - i)
        for k in range(i, j):
            times[k] = (left + step * (k - i), left + step * (k - i + 1))
        i = j
    return list(zip(approved, times))


ABBREVIATIONS = {"U.S.", "Mr.", "Mrs.", "Dr.", "e.g.", "i.e."}


def clauses(tokens):
    """Split at sentence ends, and at commas once a clause has 3+ words."""
    out, cur = [], []
    for tok, tm in tokens:
        cur.append((tok, tm))
        sentence_end = re.search(r"[.?!]['\"”]?$", tok) and tok not in ABBREVIATIONS
        if sentence_end or (re.search(r"[,;:]$", tok) and len(cur) >= 3):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def balanced(clause):
    """Split an over-long clause into equal-length lines instead of leaving an orphan word."""
    text = " ".join(t for t, _ in clause)
    parts = -(-len(text) // MAX_CHARS)
    if parts <= 1:
        return [clause]
    target, out, cur = len(text) / parts, [], []
    for tok, tm in clause:
        if cur and len(out) < parts - 1 and len(" ".join(t for t, _ in cur)) + len(tok) / 2 > target:
            out.append(cur)
            cur = []
        cur.append((tok, tm))
    out.append(cur)
    return out


def cues(tokens, offset):
    out = []
    for clause in clauses(tokens):
        for line in balanced(clause):
            out.append({"start": round(line[0][1][0] + offset, 3), "end": round(line[-1][1][1] + offset, 3),
                        "text": " ".join(t for t, _ in line)})
    # Never let a cue overlap the next one.
    for a, b in zip(out, out[1:]):
        a["end"] = min(a["end"], b["start"])
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("narration_dir", type=Path)
    ap.add_argument("--lead", type=float, default=0.0)
    ap.add_argument("--gap", type=float, default=0.0, help="silence inserted between chapters")
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    offset, result = args.lead, []
    for txt in sorted(args.narration_dir.glob("ch*.txt")):
        stem = txt.with_suffix("")
        words = json.loads(Path(f"{stem}.words.json").read_text())["words"]
        result += cues(timed_tokens(txt.read_text(), words), offset)
        offset += duration(f"{stem}.wav") + args.gap
    args.output.write_text(json.dumps(result, indent=1, ensure_ascii=False))
    print(f"{len(result)} cues, longest {max(len(c['text']) for c in result)} chars → {args.output}")


if __name__ == "__main__":
    main()
