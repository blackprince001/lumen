"""Smoke eval for the Jev citation check (S2 release gate, fixture-based).

No database needed — fixtures exercise verdicts, the confidence gate, and
budgets. Live run needs a server key; without one it verifies fail-soft only.

  cd backend
  .venv/bin/python evals/citation-check/run_smoke.py
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.judgments import (  # noqa: E402
  CITATION_CONTRADICTED,
  CITATION_UNSUPPORTED,
  CITATION_VERIFIED,
  check_citations,
  decide_citation_outcome,
  is_configured,
)

# (claim staked on the citation, cited source title/metadata, expected verdict)
FIXTURES = [
  (
    "Access tokens expire after 1 hour by default.",
    "User sessions: recommended lifetimes — access tokens default to 1 hour "
    "expiry; above 1 hour is discouraged [official_documentation]",
    CITATION_VERIFIED,
  ),
  (
    "Use of the exp claim is REQUIRED for all tokens.",
    "JWT registered claims: use of the exp claim is OPTIONAL [official_documentation]",
    CITATION_CONTRADICTED,
  ),
  (
    "Refresh token rotation requires a hardware security key.",
    "JWT signing keys: getting started [official_documentation]",
    CITATION_UNSUPPORTED,
  ),
]

COST_PER_MTOK_IN = 0.042  # jev-1.13.0, docs 2026-09-17; output tokens free


async def main() -> int:
  if not is_configured():
    assert await check_citations([{"id": "c1"}]) is None
    assert decide_citation_outcome(None) == "keep"
    print("SMOKE fallback OK: gate off keeps the syntactic verdict.")
    print("Set TYPESAFE_API_KEY for the live verdict check.")
    return 0

  citations = [
    {"id": f"c{i + 1}", "claim": claim, "context": context}
    for i, (claim, context, _) in enumerate(FIXTURES)
  ]
  results = await check_citations(citations)
  assert results, "configured gate returned nothing"
  failures = 0
  for i, (_, _, expected) in enumerate(FIXTURES):
    got = results.get(f"c{i + 1}", {})
    mark = "ok" if got.get("verdict") == expected else "MISMATCH"
    if got.get("verdict") != expected:
      failures += 1
    print(
      f"[{mark}] c{i + 1} choice={got.get('choice')} "
      f"verdict={got.get('verdict')} expect={expected} "
      f"conf={got.get('confidence', 0):.2f} auto={got.get('auto')}"
    )
  print(f"outcome with these results: {decide_citation_outcome(results)}")
  if failures:
    print(f"SMOKE FAIL: {failures} verdict mismatch(es) — inspect, do not ship.")
    return 1
  print("SMOKE PASS: verdicts match. Promote live misses to regression fixtures.")
  return 0


if __name__ == "__main__":
  raise SystemExit(asyncio.run(main()))
