"""Rank candidate video topics from the research data in this folder.

Inputs (CSV, UTF-8, header row):
  outliers.csv  title,channel,channel_subs,views,age_days,length_min,family,source_url
  topics.csv    topic,family,comparable_views,comparable_format,competitors_1m,
                stickman_competitor,rpm_tier,policy_risk,notes
  families.csv  family,hit_rate,basis   (1M+ hits per upload; optional)

Usage:
  python3 score_topics.py            # print ranked topics + family stats
  python3 score_topics.py --top 10
"""

import argparse
import csv
import math
from collections import defaultdict
from pathlib import Path
from statistics import median

HERE = Path(__file__).parent

# Weights sum to 1.0. Demand and gap dominate: the goal is one video that
# can reach 1–2M views on a new channel, not the highest RPM.
WEIGHTS = {
    "demand": 0.35,      # best comparable video's views (log scale)
    "gap": 0.25,         # few existing 1M+ videos on the same idea
    "family": 0.20,      # how often this format family breaks out lately
    "rpm": 0.10,
    "safety": 0.10,      # advertiser / policy risk
}
RPM_TIERS = {"high": 1.0, "medium": 0.6, "low": 0.25}
RISK = {"low": 1.0, "medium": 0.6, "high": 0.2}
# A live-action skit or Short proves interest in the idea, not that an
# animated long-form video on it will travel as far.
FORMAT_DISCOUNT = {"animated": 1.0, "live-action": 0.4, "short": 0.3}


def num(value, default=0.0):
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return default


def read_csv(name):
    path = HERE / name
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as fh:
        return [row for row in csv.DictReader(fh) if any(row.values())]


def family_stats(outliers):
    """Recent 1M+ videos per family and their median views."""
    by_family = defaultdict(list)
    for row in outliers:
        views = num(row["views"])
        if views >= 1_000_000:
            by_family[row["family"].strip()].append(views)
    return {
        fam: {"count": len(v), "median": median(v), "max": max(v)}
        for fam, v in by_family.items()
    }


def family_rates(fam_stats):
    """Per-upload hit rates from families.csv; fall back to sampled counts."""
    rows = read_csv("families.csv")
    if rows:
        rates = {r["family"].strip(): num(r["hit_rate"]) for r in rows}
    else:
        rates = {fam: s["count"] for fam, s in fam_stats.items()}
    top = max(rates.values(), default=0)
    return {fam: (v / top if top else 0.0) for fam, v in rates.items()}


def score_topic(topic, fam_scores):
    views = num(topic["comparable_views"])
    views *= FORMAT_DISCOUNT.get(topic.get("comparable_format", "animated").strip().lower(), 1.0)
    # 1M views → 0.5, 10M → 1.0, 100K → 0.0
    demand = min(1.0, max(0.0, (math.log10(max(views, 1)) - 5) / 2))
    competitors = num(topic["competitors_1m"])
    gap = 1.0 / (1.0 + competitors)
    if topic["stickman_competitor"].strip().lower() in {"yes", "y", "true", "1"}:
        gap *= 0.5
    family = fam_scores.get(topic["family"].strip(), 0.0)
    rpm = RPM_TIERS.get(topic["rpm_tier"].strip().lower(), 0.5)
    safety = RISK.get(topic["policy_risk"].strip().lower(), 0.6)
    parts = {"demand": demand, "gap": gap, "family": family, "rpm": rpm, "safety": safety}
    total = sum(WEIGHTS[k] * v for k, v in parts.items())
    return round(total * 100, 1), parts


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--top", type=int, default=20)
    args = parser.parse_args()

    outliers = read_csv("outliers.csv")
    topics = read_csv("topics.csv")
    stats = family_stats(outliers)
    fam_scores = family_rates(stats)

    print(f"Format families (recent 1M+ videos, n={len(outliers)} rows)")
    for fam, s in sorted(stats.items(), key=lambda kv: -kv[1]["count"]):
        print(f"  {fam:<20} {s['count']:>3} videos  median {s['median']/1e6:5.2f}M  max {s['max']/1e6:5.2f}M")

    ranked = []
    for topic in topics:
        score, parts = score_topic(topic, fam_scores)
        ranked.append((score, topic, parts))
    ranked.sort(key=lambda r: -r[0])

    print(f"\nTop {min(args.top, len(ranked))} topics")
    for i, (score, topic, parts) in enumerate(ranked[: args.top], 1):
        detail = " ".join(f"{k}={v:.2f}" for k, v in parts.items())
        print(f"{i:>2}. {score:5.1f}  {topic['topic']}  [{topic['family']}]  {detail}")


if __name__ == "__main__":
    main()
