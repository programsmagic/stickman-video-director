# Projects

Our own videos, kept outside `skills/` as the Autopilot docs require.

```
projects/
  research/            topic research and scoring
    outliers.csv       recent 1M+ videos (title, channel, subs, views, age, family, url)
    families.csv       1M+ hit rate per upload for each format family
    topics.csv         candidate topics with comparable views and competition
    score_topics.py    ranks topics.csv → python3 research/score_topics.py
  epNN-<slug>/         one folder per episode
    script.md          approved script, sources, facts to verify
    project.json       Autopilot manifest (created after script approval)
    output/            preview/full renders (written by the renderer)
  b1-example/          bundled offline demo, kept as a renderer smoke test
  _archive/            dropped drafts
```

## Per-episode loop
1. Refresh research: add new outliers/topics, run the scorer, re-check YouTube search for the chosen topic.
2. Write `script.md`; verify every fact in its table; get approval.
3. `node ../skills/directing-stickman-videos/scripts/autopilot.mjs init <episode-dir>` and build the 20-second preview.
4. Approve the preview, then render the full film.
