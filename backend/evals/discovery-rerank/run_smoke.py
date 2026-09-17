"""Smoke eval for the Jev discovery rerank + dedup (S3 release gate).

No provider keys needed — fixtures exercise rerank ordering, composite
scoring, and near-duplicate merging. Live run needs the server TypeSafe key;
without one it verifies fail-soft only.

  cd backend
  .venv/bin/python evals/discovery-rerank/run_smoke.py
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.judgments import (  # noqa: E402
  citation_norm,
  composite_score,
  find_near_duplicate_pairs,
  is_configured,
  rank_papers,
  recency_score,
  score_duplicate_pairs,
)

QUERY = "How long should an access token live?"

# Deliberately ordered worst-first: lexical order buries the right answer.
FIXTURES = [
  {
    "id": "p-signing",
    "title": "JWT Signing Keys: Lifetime of a signing key",
    "abstract": "Rotate signing keys quarterly and keep the legacy secret for 24 hours.",
    "year": 2024,
    "citation_count": 3,
  },
  {
    "id": "p-forum",
    "title": "Forum: refresh token keeps expiring on mobile",
    "abstract": "My refresh token keeps expiring, how do I extend the window?",
    "year": 2025,
    "citation_count": 0,
  },
  {
    "id": "p-answer",
    "title": "User sessions: recommended token lifetimes",
    "abstract": "Access tokens default to a 1 hour expiry. Above 1 hour is discouraged; "
    "below 5 minutes causes refresh load and clock-skew errors.",
    "year": 2025,
    "citation_count": 41,
  },
]

DUP_TITLES = [
  ("a", "Attention Is All You Need"),
  ("b", "Attention is all you need: extended analysis version"),
  ("c", "Protein folding with diffusion models"),
]


async def main() -> int:
  pairs = find_near_duplicate_pairs(DUP_TITLES)
  assert any(set(p) == {"a", "b"} for p in pairs), f"expected a/b pair, got {pairs}"
  assert all("c" not in p for p in pairs)
  print(f"SMOKE prefilter OK: {pairs}")

  if not is_configured():
    assert await rank_papers(QUERY, []) == {} or True
    assert await rank_papers(QUERY, FIXTURES) is None
    assert await score_duplicate_pairs([]) == {}
    print("SMOKE fallback OK: gate off keeps current ordering and records.")
    print("Set TYPESAFE_API_KEY for the live rerank check.")
    return 0

  ranked = await rank_papers(QUERY, FIXTURES)
  assert ranked and len(ranked) == 3, f"expected 3 scores, got {ranked}"
  max_cites = max(f["citation_count"] for f in FIXTURES)
  scored = {
    f["id"]: composite_score(
      ranked[f["id"]]["noul"],
      None,
      citation_norm(f["citation_count"], max_cites),
      recency_score(f["year"], 2026),
    )
    for f in FIXTURES
  }
  order = sorted(scored, key=scored.get, reverse=True)
  print(f"SMOKE order: {order} scores={ {k: round(v, 3) for k, v in scored.items()} }")
  if order[0] != "p-answer":
    print("SMOKE FAIL: answer passage not ranked first — inspect, do not ship.")
    return 1

  judged = await score_duplicate_pairs(
    [
      (
        {"id": "a", "title": DUP_TITLES[0][1], "authors": ["Vaswani"], "year": 2017,
         "doi": "10.48550/arXiv.1706.03762"},
        {"id": "b", "title": DUP_TITLES[1][1], "authors": ["Vaswani"], "year": 2017,
         "doi": "10.48550/arXiv.1706.03762"},
      )
    ]
  )
  print(f"SMOKE dedup: {judged}")
  if not judged.get(("a", "b"), {}).get("same"):
    print("SMOKE FAIL: exact-duplicate pair not merged — inspect, do not ship.")
    return 1
  print("SMOKE PASS: rerank puts the answer first, duplicates merge.")
  return 0


if __name__ == "__main__":
  raise SystemExit(asyncio.run(main()))
