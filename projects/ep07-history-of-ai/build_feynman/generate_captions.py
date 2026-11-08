import json
import re
from pathlib import Path

DIR = Path('projects/ep07-history-of-ai/build_feynman')
SRT_OUT = Path('exports/EP07-The-Complete-History-of-AI.en.srt')

ACT_DURATIONS = [
    103.88,  # Act 1
    78.36,   # Act 2
    73.00,   # Act 3
    64.48,   # Act 4
    45.48,   # Act 5
    58.72    # Act 6
]
GAP = 0.8

def format_srt_time(sec):
    hrs = int(sec // 3600)
    mins = int((sec % 3600) // 60)
    secs = int(sec % 60)
    ms = int((sec - int(sec)) * 1000)
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{ms:03d}"

captions = []
current_time = 0.0

for act_idx in range(6):
    act_file = DIR / f"f{act_idx + 1}.txt"
    text = act_file.read_text(encoding='utf-8').strip()
    
    # Split text into bite-sized spoken phrases (commas, periods, question marks)
    # Regex splits on punctuation while keeping reasonable phrase lengths
    raw_sentences = [s.strip() for s in re.split(r'(?<=[.?!:])\s+', text) if s.strip()]
    
    # Estimate timing weighted by character length
    total_chars = sum(len(s) for s in raw_sentences)
    act_dur = ACT_DURATIONS[act_idx]
    
    t_cursor = current_time
    for s in raw_sentences:
        s_dur = (len(s) / total_chars) * act_dur
        # Shorten very long lines into two if needed
        captions.append({
            "start": round(t_cursor, 2),
            "end": round(t_cursor + s_dur, 2),
            "text": s
        })
        t_cursor += s_dur
        
    current_time += act_dur + GAP

# Save JSON
out_json = DIR / "captions.json"
out_json.write_text(json.dumps(captions, indent=2), encoding='utf-8')
print(f"✓ Saved {len(captions)} caption cues to {out_json}")

# Save SRT
srt_lines = []
for idx, c in enumerate(captions, 1):
    srt_lines.append(str(idx))
    srt_lines.append(f"{format_srt_time(c['start'])} --> {format_srt_time(c['end'])}")
    srt_lines.append(c['text'])
    srt_lines.append("")

SRT_OUT.write_text("\n".join(srt_lines), encoding='utf-8')
print(f"✓ Saved SRT subtitles to {SRT_OUT}")

