"""Intent routing for the home omnibox (slice 4)."""

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, get_db, scoped_user_id
from app.models.paper import Paper
from app.services.judgments import (
  DEST_LIBRARY,
  route_query,
)

router = APIRouter()


class RouteRequest(BaseModel):
  query: str = Field(min_length=1, max_length=500)


class RouteResponse(BaseModel):
  destination: str
  action: Literal["route", "suggest", "fallback"]
  confidence: float
  probabilities: dict[str, float] = {}
  model: str = ""
  fallback: bool = False
  context: dict[str, Any] = {}


async def library_hint(
  session: AsyncSession, user_id: int | None, query: str
) -> dict[str, Any]:
  """Small grounded facts about the user's collection for the router.

  Total size plus whole-phrase/keyword title matches (top 3 titles).
  Millisecond-scale COUNT + LIMIT queries — no embeddings, no full text.
  """
  scope = [] if user_id is None else [Paper.uploaded_by_id == user_id]
  total = (
    await session.execute(select(func.count()).select_from(Paper).where(*scope))
  ).scalar_one() or 0
  phrase = query.strip()[:200]
  tokens = [t for t in phrase.split() if len(t) > 3][:5]
  clauses = [Paper.title.ilike(f"%{phrase}%")]
  clauses.extend(Paper.title.ilike(f"%{token}%") for token in tokens)
  rows = (
    await session.execute(
      select(Paper.title).where(*scope, or_(*clauses)).limit(3)
    )
  ).scalars().all()
  return {
    "total_papers": int(total),
    "title_matches": len(rows),
    "match_titles": [str(t)[:200] for t in rows],
  }


@router.post("/route", response_model=RouteResponse)
async def route_search(
  body: RouteRequest,
  user: CurrentUser,
  session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
  """Judge where a search request should go.

  Attaches a small library hint so the judgment is grounded in the user's
  collection. Fail-soft: when judging is unavailable the response
  reproduces today's behavior (library search), flagged with
  ``fallback: true``.
  """
  query = body.query.strip()
  if not query:
    raise HTTPException(status_code=400, detail="Query must not be empty")
  context = {"library": await library_hint(session, scoped_user_id(user), query)}
  result = await route_query(query, context)
  if result is None:
    return {
      "destination": DEST_LIBRARY,
      "action": "route",
      "confidence": 0.0,
      "probabilities": {},
      "model": "",
      "fallback": True,
      "context": context,
    }
  return {**result, "fallback": False, "context": context}
