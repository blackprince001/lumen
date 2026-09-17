"""Smoke eval for the Jev intent router (S4 release gate, fixture-based).

Live run needs the server TypeSafe key; without one it verifies the
fail-soft contract (fallback reproduces today's library search).

  cd backend
  .venv/bin/python evals/intent-router/run_smoke.py
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.judgments import (  # noqa: E402
  is_configured,
  route_action,
  route_query,
)

# (request, expected destination or None, kind).
# exact: destination must match. safe: must never confidently misroute —
# fallback or suggest only (uncertainty keeps today's behavior).
FIXTURES = [
  ("Attention Is All You Need", "library_search", "exact"),
  ("find papers in my library about diffusion models", "library_search", "exact"),
  ("recent papers on retrieval augmented generation", "discovery_search", "exact"),
  ("what is the recommended access token lifetime?", None, "safe"),
  (
    "write a thorough literature review on diffusion models with verified sources",
    "deep_research",
    "exact",
  ),
]


async def main() -> int:
  # Policy checks need no key.
  assert route_action("deep_research", 0.99) == "suggest"
  assert route_action("library_search", 0.91) == "route"
  assert route_action("library_search", 0.2) == "fallback"
  print("SMOKE policy OK: deep research never auto-routes.")

  if not is_configured():
    assert await route_query("anything") is None
    print("SMOKE fallback OK: gate off → caller navigates to library search.")
    print("Set TYPESAFE_API_KEY for the live routing check.")
    return 0

  failures = 0
  for request, expected, kind in FIXTURES:
    result = await route_query(request)
    assert result, f"no result for {request!r}"
    if kind == "exact":
      ok = result["destination"] == expected
    else:
      ok = result["action"] in ("fallback", "suggest")
    mark = "ok" if ok else "MISMATCH"
    if not ok:
      failures += 1
    print(
      f"[{mark}] {request[:60]:<62} → {result['destination']} "
      f"({result['action']}, conf={result['confidence']:.2f})"
    )
    if expected == "deep_research" and result["action"] == "route":
      print("  VIOLATION: deep research must never auto-route.")
      failures += 1

  # Grounding check: the same ambiguous request with and without library
  # evidence. Context must be able to shift the decision.
  ambiguous = "diffusion models survey"
  bare = await route_query(ambiguous)
  grounded = await route_query(
    ambiguous,
    {"library": {"total_papers": 12, "title_matches": 3,
                 "match_titles": ["Denoising Diffusion Probabilistic Models"]}},
  )
  print(f"[info] bare: {bare['destination']} ({bare['action']}, conf={bare['confidence']:.2f})")
  print(
    f"[info] grounded: {grounded['destination']} "
    f"({grounded['action']}, conf={grounded['confidence']:.2f})"
  )
  if (
    grounded["destination"] != "library_search"
    or grounded["confidence"] < bare["confidence"]
  ):
    print("SMOKE FAIL: library evidence did not ground the decision.")
    failures += 1
  if failures:
    print(f"SMOKE FAIL: {failures} mismatch(es) — inspect, do not ship.")
    return 1
  print("SMOKE PASS: destinations match, deep research stays suggest-only.")
  return 0


if __name__ == "__main__":
  raise SystemExit(asyncio.run(main()))
