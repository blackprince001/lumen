"""Citation map API — a Semantic-Scholar-backed reference/citation graph."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, get_db
from app.models.citation_map import CitationMapItem, CitationMapPosition
from app.models.paper import Paper
from app.schemas.citation_map import (
  BulkPositions,
  CitationMapResponse,
  CitedByResponse,
  FocalCreate,
)
from app.services.access import visible_papers_clause
from app.services.citation_map_service import citation_map_service

router = APIRouter()


async def _assert_paper_visible(
  session: AsyncSession, user_id: int, paper_id: int
) -> Paper:
  query = select(Paper).where(
    and_(Paper.id == paper_id, visible_papers_clause(user_id))
  )
  paper = (await session.execute(query)).scalar_one_or_none()
  if paper is None:
    raise HTTPException(status_code=403, detail="Paper not accessible")
  return paper


@router.get("/citation-map", response_model=CitationMapResponse)
async def get_citation_map(user: CurrentUser, session: AsyncSession = Depends(get_db)):
  """Return the user's citation map: focal papers, neighbours, edges, positions."""
  return await citation_map_service.build_map(session, user.id)


@router.post("/citation-map/focal", response_model=CitationMapResponse, status_code=201)
async def add_focal_paper(
  body: FocalCreate, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  """Add a library paper as a focal point and return the rebuilt map."""
  await _assert_paper_visible(session, user.id, body.paper_id)

  existing = (
    await session.execute(
      select(CitationMapItem).where(
        and_(
          CitationMapItem.user_id == user.id,
          CitationMapItem.paper_id == body.paper_id,
        )
      )
    )
  ).scalar_one_or_none()
  if existing is None:
    session.add(CitationMapItem(user_id=user.id, paper_id=body.paper_id))
    await session.commit()

  return await citation_map_service.build_map(session, user.id)


@router.delete("/citation-map/focal/{paper_id}", response_model=CitationMapResponse)
async def remove_focal_paper(
  paper_id: int, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  """Remove a focal paper and return the rebuilt map."""
  item = (
    await session.execute(
      select(CitationMapItem).where(
        and_(
          CitationMapItem.user_id == user.id,
          CitationMapItem.paper_id == paper_id,
        )
      )
    )
  ).scalar_one_or_none()
  if item is not None:
    await session.delete(item)
    await session.commit()

  return await citation_map_service.build_map(session, user.id)


@router.post("/citation-map/positions", status_code=204)
async def save_positions(
  body: BulkPositions, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  """Upsert manual position overrides for nodes (focal or neighbour)."""
  if not body.positions:
    return None

  keys = [p.node_key for p in body.positions]
  existing_rows = (
    (
      await session.execute(
        select(CitationMapPosition).where(
          and_(
            CitationMapPosition.user_id == user.id,
            CitationMapPosition.node_key.in_(keys),
          )
        )
      )
    )
    .scalars()
    .all()
  )
  existing = {r.node_key: r for r in existing_rows}

  for upd in body.positions:
    row = existing.get(upd.node_key)
    if row is None:
      session.add(
        CitationMapPosition(user_id=user.id, node_key=upd.node_key, x=upd.x, y=upd.y)
      )
    else:
      row.x = upd.x
      row.y = upd.y

  await session.commit()
  return None


@router.delete("/citation-map", status_code=204)
async def clear_citation_map(
  user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  """Remove all focal papers and saved positions for the user."""
  await session.execute(
    CitationMapItem.__table__.delete().where(CitationMapItem.user_id == user.id)
  )
  await session.execute(
    CitationMapPosition.__table__.delete().where(CitationMapPosition.user_id == user.id)
  )
  await session.commit()
  return None


@router.get("/citation-map/cited-by/{paper_id}", response_model=CitedByResponse)
async def get_cited_by(
  paper_id: int,
  user: CurrentUser,
  session: AsyncSession = Depends(get_db),
  offset: int = Query(0, ge=0),
  limit: int = Query(25, ge=1, le=100),
):
  """List the works that cite this paper (forward citations), paginated."""
  paper = await _assert_paper_visible(session, user.id, paper_id)
  result = await citation_map_service.get_cited_by(
    session, paper, offset=offset, limit=limit
  )
  return CitedByResponse(**result)
