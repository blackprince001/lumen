"""Citation canvas API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, get_db
from app.models.citation_canvas import CitationCanvasItem
from app.models.paper import Paper
from app.models.paper_citation import PaperCitation
from app.schemas.citation_canvas import (
  CanvasBulkPositions,
  CanvasEdge,
  CanvasItem,
  CanvasItemCreate,
  CanvasItemPositionUpdate,
  CanvasResponse,
)
from app.schemas.paper import Paper as PaperSchema
from app.services.access import visible_papers_clause

router = APIRouter()


async def _load_canvas_items(
  session: AsyncSession, user_id: int
) -> list[CitationCanvasItem]:
  """Load all canvas items for a user with their associated Paper eager-loaded."""
  query = (
    select(CitationCanvasItem)
    .options(
      selectinload(CitationCanvasItem.paper).selectinload(Paper.tags),
      selectinload(CitationCanvasItem.paper).selectinload(Paper.groups),
    )
    .where(CitationCanvasItem.user_id == user_id)
    .order_by(CitationCanvasItem.created_at.asc())
  )
  result = await session.execute(query)
  return list(result.scalars().all())


async def _compute_edges(
  session: AsyncSession, paper_ids: list[int]
) -> list[CanvasEdge]:
  """Return citation edges between papers currently on the canvas."""
  if len(paper_ids) < 2:
    return []

  query = select(PaperCitation.paper_id, PaperCitation.cited_paper_id).where(
    and_(
      PaperCitation.paper_id.in_(paper_ids),
      PaperCitation.cited_paper_id.in_(paper_ids),
    )
  )
  result = await session.execute(query)
  return [CanvasEdge(source=row[0], target=row[1]) for row in result.all()]


async def _get_item_or_404(
  session: AsyncSession, user_id: int, paper_id: int
) -> CitationCanvasItem:
  query = select(CitationCanvasItem).where(
    and_(
      CitationCanvasItem.user_id == user_id,
      CitationCanvasItem.paper_id == paper_id,
    )
  )
  result = await session.execute(query)
  item = result.scalar_one_or_none()
  if not item:
    raise HTTPException(status_code=404, detail="Canvas item not found")
  return item


async def _assert_paper_visible(
  session: AsyncSession, user_id: int, paper_id: int
) -> None:
  """Verify the user can see this paper (owned, directly shared, or via shared group)."""
  query = select(Paper.id).where(
    and_(Paper.id == paper_id, visible_papers_clause(user_id))
  )
  result = await session.execute(query)
  if result.scalar_one_or_none() is None:
    raise HTTPException(status_code=403, detail="Paper not accessible")


def _build_item_response(item: CitationCanvasItem) -> CanvasItem:
  return CanvasItem(
    paper_id=item.paper_id,
    x=item.x,
    y=item.y,
    created_at=item.created_at,
    updated_at=item.updated_at,
    paper=PaperSchema.model_validate(item.paper),
  )


@router.get("/citation-canvas", response_model=CanvasResponse)
async def get_canvas(user: CurrentUser, session: AsyncSession = Depends(get_db)):
  """Return the current user's canvas items and edges between them.

  Stale items (papers the user can no longer access) are silently dropped from
  the response — the row stays in the DB so re-granting access restores position.
  """
  items = await _load_canvas_items(session, user.id)

  if not items:
    return CanvasResponse(items=[], edges=[])

  paper_ids = [i.paper_id for i in items]
  visibility_query = select(Paper.id).where(
    and_(Paper.id.in_(paper_ids), visible_papers_clause(user.id))
  )
  visible_result = await session.execute(visibility_query)
  visible_ids = {row[0] for row in visible_result.all()}

  visible_items = [i for i in items if i.paper_id in visible_ids]
  edges = await _compute_edges(session, [i.paper_id for i in visible_items])

  return CanvasResponse(
    items=[_build_item_response(i) for i in visible_items],
    edges=edges,
  )


@router.post("/citation-canvas/items", response_model=CanvasItem, status_code=201)
async def add_canvas_item(
  body: CanvasItemCreate,
  user: CurrentUser,
  session: AsyncSession = Depends(get_db),
):
  """Add a paper to the canvas at a given position."""
  await _assert_paper_visible(session, user.id, body.paper_id)

  existing_query = select(CitationCanvasItem).where(
    and_(
      CitationCanvasItem.user_id == user.id,
      CitationCanvasItem.paper_id == body.paper_id,
    )
  )
  existing = (await session.execute(existing_query)).scalar_one_or_none()
  if existing:
    raise HTTPException(status_code=409, detail="Paper already on canvas")

  item = CitationCanvasItem(
    user_id=user.id,
    paper_id=body.paper_id,
    x=body.x,
    y=body.y,
  )
  session.add(item)
  await session.commit()

  reload_query = (
    select(CitationCanvasItem)
    .options(
      selectinload(CitationCanvasItem.paper).selectinload(Paper.tags),
      selectinload(CitationCanvasItem.paper).selectinload(Paper.groups),
    )
    .where(CitationCanvasItem.id == item.id)
  )
  item = (await session.execute(reload_query)).scalar_one()
  return _build_item_response(item)


@router.patch("/citation-canvas/items/{paper_id}", response_model=CanvasItem)
async def update_canvas_item_position(
  paper_id: int,
  body: CanvasItemPositionUpdate,
  user: CurrentUser,
  session: AsyncSession = Depends(get_db),
):
  """Update the x/y position of a canvas item."""
  item = await _get_item_or_404(session, user.id, paper_id)
  item.x = body.x
  item.y = body.y
  await session.commit()

  reload_query = (
    select(CitationCanvasItem)
    .options(
      selectinload(CitationCanvasItem.paper).selectinload(Paper.tags),
      selectinload(CitationCanvasItem.paper).selectinload(Paper.groups),
    )
    .where(CitationCanvasItem.id == item.id)
  )
  item = (await session.execute(reload_query)).scalar_one()
  return _build_item_response(item)


@router.post("/citation-canvas/positions", status_code=204)
async def bulk_update_positions(
  body: CanvasBulkPositions,
  user: CurrentUser,
  session: AsyncSession = Depends(get_db),
):
  """Bulk-update positions. Unknown paper_ids are ignored silently."""
  if not body.items:
    return None

  paper_ids = [p.paper_id for p in body.items]
  query = select(CitationCanvasItem).where(
    and_(
      CitationCanvasItem.user_id == user.id,
      CitationCanvasItem.paper_id.in_(paper_ids),
    )
  )
  result = await session.execute(query)
  existing = {i.paper_id: i for i in result.scalars().all()}

  for update in body.items:
    item = existing.get(update.paper_id)
    if item is not None:
      item.x = update.x
      item.y = update.y

  await session.commit()
  return None


@router.delete("/citation-canvas/items/{paper_id}", status_code=204)
async def remove_canvas_item(
  paper_id: int,
  user: CurrentUser,
  session: AsyncSession = Depends(get_db),
):
  """Remove a single paper from the canvas."""
  item = await _get_item_or_404(session, user.id, paper_id)
  await session.delete(item)
  await session.commit()
  return None


@router.delete("/citation-canvas", status_code=204)
async def clear_canvas(user: CurrentUser, session: AsyncSession = Depends(get_db)):
  """Remove all items from the current user's canvas."""
  await session.execute(
    CitationCanvasItem.__table__.delete().where(
      CitationCanvasItem.user_id == user.id
    )
  )
  await session.commit()
  return None
