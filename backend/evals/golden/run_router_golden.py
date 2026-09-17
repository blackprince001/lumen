"""Golden eval for the intent router (tune + holdout).

50 author-written requests; every 5th id is a sequestered holdout.
Gates: zero deep-research auto-routes, holdout exact accuracy >= 0.70.
Tune accuracy and the confusion matrix guide wording changes — never gate.

  cd backend
  .venv/bin/python evals/golden/run_router_golden.py [--save results.json]
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.judgments import is_configured, route_query  # noqa: E402

GOLDEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "router_golden.jsonl")
HOLDOUT_MOD = 5
HOLDOUT_FLOOR = 0.70
COST_PER_MTOK_IN = 0.042


def load() -> list[dict]:
  rows = []
  with open(GOLDEN, encoding="utf-8") as f:
    for line in f:
      line = line.strip()
      if line:
        rows.append(json.loads(line))
  return rows


def is_holdout(row: dict) -> bool:
  return int(row["id"][1:]) % HOLDOUT_MOD == 0


async def main() -> int:
  save_path = sys.argv[sys.argv.index("--save") + 1] if "--save" in sys.argv else None
  if not is_configured():
    print("Set TYPESAFE_API_KEY for the golden run (no fallback mode here).")
    return 2

  rows = load()
  sem = asyncio.Semaphore(8)

  async def _one(row: dict) -> dict:
    async with sem:
      try:
        result = await route_query(row["query"])
      except Exception as e:  # noqa: BLE001 — one failure must not sink the eval
        return {"id": row["id"], "error": str(e)[:120]}
      return {"id": row["id"], "result": result}

  outcomes = await asyncio.gather(*[_one(r) for r in rows])
  by_id = {r["id"]: r for r in rows}
  records, violations, errors = [], 0, 0
  for outcome in outcomes:
    row = by_id[outcome["id"]]
    result = outcome.get("result")
    if result is None or "error" in outcome:
      errors += 1
      records.append({**row, "got": None, "pass": False, "note": "error/fallback"})
      continue
    dest, action = result["destination"], result["action"]
    if dest == "deep_research" and action == "route":
      violations += 1
    if row["kind"] == "exact":
      passed = dest == row["expected"]
    else:
      passed = not (dest == "deep_research" and action == "route")
    records.append({**row, **result, "got": dest, "pass": passed})

  def accuracy(subset: list[dict]) -> float:
    exact = [r for r in subset if r["kind"] == "exact" and r.get("got")]
    return sum(1 for r in exact if r["pass"]) / max(1, len(exact))

  tune = [r for r in records if not is_holdout(r)]
  hold = [r for r in records if is_holdout(r)]
  tune_acc, hold_acc = accuracy(tune), accuracy(hold)

  matrix: Counter = Counter()
  for r in records:
    if r["kind"] == "exact" and r.get("got"):
      matrix[(r["expected"], r["got"])] += 1
  actions = Counter(r.get("action", "?") for r in records if r.get("got"))
  lush_harm = [r for r in records if not r["pass"]]

  print(f"n={len(records)} tune_exact_acc={tune_acc:.2f} holdout_exact_acc={hold_acc:.2f}")
  print(f"actions={dict(actions)} violations={violations} errors={errors}")
  print("confusion (expected → got):")
  for (exp, got), count in sorted(matrix.items()):
    flag = "" if exp == got else "  <-- MISS"
    print(f"  {exp:<16} → {got:<16} ×{count}{flag}")
  if lush_harm:
    print("misses:")
    for r in lush_harm:
      print(f"  {r['id']} [{r['kind']}] {r['query'][:60]!r} → {r.get('got')} ({r.get('action')})")

  if save_path:
    with open(save_path, "w", encoding="utf-8") as f:
      json.dump(
        {"tune_acc": tune_acc, "holdout_acc": hold_acc,
         "violations": violations, "errors": errors, "records": records},
        f, indent=2,
      )
    print(f"saved {save_path}")

  if violations:
    print("GATE FAIL: deep research auto-routed — inspect, do not ship.")
    return 1
  if hold_acc < HOLDOUT_FLOOR:
    print(f"GATE FAIL: holdout {hold_acc:.2f} < {HOLDOUT_FLOOR} — inspect, do not ship.")
    return 1
  print("GATE PASS.")
  return 0


if __name__ == "__main__":
  raise SystemExit(asyncio.run(main()))
