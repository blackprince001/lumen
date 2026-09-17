"""Smoke eval for chat-ref manifest annotation (fail-soft, additive field).

  cd backend
  .venv/bin/python evals/chat-refs/run_smoke.py
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.judgments import annotate_manifest, is_configured  # noqa: E402

CONTENT = (
  "Access tokens expire after 1 hour by default (ref:citation/1). "
  "Use of exp is REQUIRED for all tokens (ref:citation/2)."
)

MANIFEST = [
  {"kind": "citation", "id": "1", "title": "Sessions",
   "snippet": "Access tokens default to 1 hour expiry."},
  {"kind": "citation", "id": "2", "title": "JWT claims",
   "snippet": "Use of the exp claim is OPTIONAL."},
]


async def main() -> int:
  if not is_configured():
    out = await annotate_manifest(CONTENT, [dict(m) for m in MANIFEST])
    assert all("verification" not in e for e in out)
    print("SMOKE fallback OK: gate off leaves the manifest untouched.")
    return 0
  out = await annotate_manifest(CONTENT, [dict(m) for m in MANIFEST])
  got = [e["verification"] for e in out]
  print(f"SMOKE verifications: {got}")
  if got != ["verified", "contradicted"]:
    print("SMOKE FAIL: unexpected verdicts — inspect, do not ship.")
    return 1
  print("SMOKE PASS.")
  return 0


if __name__ == "__main__":
  raise SystemExit(asyncio.run(main()))
