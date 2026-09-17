"""Golden evals for slices 1-3 (RAG gate, discovery rerank+dedup, citations).

Same contract as the router golden: gate on accuracy floor with zero
errors; misses become fixtures, not tuning fodder.

  cd backend
  .venv/bin/python evals/golden/run_slice_golden.py [--slice rag|discovery|citation|all]
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.judgments import (  # noqa: E402
  check_citations,
  citation_norm,
  composite_score,
  gate_passages,
  is_configured,
  rank_papers,
  recency_score,
  score_duplicate_pairs,
)

HERE = os.path.dirname(os.path.abspath(__file__))
FLOOR = 0.85


def load(name: str) -> list[dict]:
  with open(os.path.join(HERE, name), encoding="utf-8") as f:
    return [json.loads(line) for line in f if line.strip()]


async def eval_rag() -> tuple[int, int]:
  """Returns (correct, total) passage routes."""
  correct, total = 0, 0
  for row in load("rag_golden.jsonl"):
    gated = await gate_passages(
      row["query"],
      [{"id": p["id"], "title": p["title"], "text": p["text"],
        "source_type": "library"} for p in row["passages"]],
    )
    assert gated, f"{row['id']}: gate returned nothing"
    for p in row["passages"]:
      total += 1
      got = (gated.get(p["id"]) or {}).get("route")
      if got == p["route"]:
        correct += 1
      else:
        print(f"  MISS {row['id']}/{p['id']}: got={got} want={p['route']}")
  return correct, total


async def eval_discovery() -> tuple[int, int]:
  correct, total = 0, 0
  sem = asyncio.Semaphore(4)

  async def _rank(row: dict) -> None:
    nonlocal correct
    async with sem:
      ranked = await rank_papers(
        row["query"],
        [{"id": c["id"], "title": c["title"], "abstract": c["abstract"],
          "year": c.get("year")} for c in row["candidates"]],
      )
    assert ranked, f"{row['id']}: no scores"
    by_id = {c["id"]: c for c in row["candidates"]}
    max_cites = max((c.get("citation_count") or 0 for c in row["candidates"]), default=0)
    scored = {
      cid: composite_score(
        s["noul"], None,
        citation_norm(by_id[cid].get("citation_count"), max_cites),
        recency_score(by_id[cid].get("year"), 2026),
      )
      for cid, s in ranked.items()
    }
    top = max(scored, key=scored.get)
    if top == row["top"]:
      correct += 1
    else:
      print(f"  MISS {row['id']}: top={top} want={row['top']} scores={scored}")
    return None

  rank_rows = load("discovery_rank_golden.jsonl")
  await asyncio.gather(*[_rank(r) for r in rank_rows])
  total += len(rank_rows)
  pairs = [
    ({"id": r["id"] + ":a", **r["a"]}, {"id": r["id"] + ":b", **r["b"]})
    for r in load("discovery_dedup_golden.jsonl")
  ]
  judged = await score_duplicate_pairs(pairs)
  expected = {r["id"]: r["same"] for r in load("discovery_dedup_golden.jsonl")}
  for row_id, want in expected.items():
    got = (judged.get((row_id + ":a", row_id + ":b")) or {}).get("same")
    total += 1
    if got == want:
      correct += 1
    else:
      print(f"  MISS {row_id}: got={got} want={want}")
  return correct, total


async def eval_citation() -> tuple[int, int]:
  rows = load("citation_golden.jsonl")
  results = await check_citations(
    [{"id": r["id"], "claim": r["claim"], "context": r["context"]} for r in rows]
  )
  assert results, "citation gate returned nothing"
  correct, total = 0, 0
  for r in rows:
    total += 1
    got = (results.get(r["id"]) or {}).get("verdict")
    if got == r["verdict"]:
      correct += 1
    else:
      print(f"  MISS {r['id']}: got={got} want={r['verdict']}")
  return correct, total


async def main() -> int:
  which = sys.argv[sys.argv.index("--slice") + 1] if "--slice" in sys.argv else "all"
  if not is_configured():
    print("Set TYPESAFE_API_KEY for the golden run.")
    return 2
  suites = {
    "rag": ("RAG gate", eval_rag),
    "discovery": ("discovery rerank+dedup", eval_discovery),
    "citation": ("citation check", eval_citation),
  }
  if which != "all":
    suites = {which: suites[which]}
  failed = False
  for name, (label, fn) in suites.items():
    print(f"[{name}] {label}:")
    try:
      correct, total = await fn()
    except Exception as e:  # noqa: BLE001 — report, don't crash the batch
      print(f"  ERROR: {str(e)[:200]}")
      failed = True
      continue
    acc = correct / max(1, total)
    print(f"  {correct}/{total} = {acc:.2f} (floor {FLOOR})")
    if acc < FLOOR:
      failed = True
  if failed:
    print("GATE FAIL — inspect misses, do not ship.")
    return 1
  print("GATE PASS.")
  return 0


if __name__ == "__main__":
  raise SystemExit(asyncio.run(main()))
