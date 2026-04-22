"""Bookmark CRUD functions."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud.paper import get_visible_paper_or_404
from app.models.bookmark import Bookmark
from app.services.access import get_effective_paper_permission


async def get_bookmark_or_404(
  session: AsyncSession,
  bookmark_id: int,
  paper_id: int | None = None,
  *,
  user_id: int | None = None,
) -> Bookmark:
  query = select(Bookmark).where(Bookmark.id == bookmark_id)
  if paper_id is not None:
    query = query.where(Bookmark.paper_id == paper_id)

  result = await session.execute(query)
  bookmark = result.scalar_one_or_none()

  if not bookmark:
    raise HTTPException(status_code=404, detail="Bookmark not found")

  # Only the bookmark author or the paper owner can delete
  if user_id is not None:
    is_author = bookmark.user_id == user_id or bookmark.user_id is None
    if not is_author:
      from app.models.paper import Paper

      paper_result = await session.execute(
        select(Paper.uploaded_by_id).where(Paper.id == bookmark.paper_id)
      )
      paper_owner_id = paper_result.scalar_one_or_none()
      if paper_owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this bookmark")

  return bookmark


async def list_bookmarks_for_paper(
  session: AsyncSession,
  paper_id: int,
  *,
  user_id: int | None = None,
) -> list[Bookmark]:
  await get_visible_paper_or_404(session, paper_id, user_id=user_id)

  # All bookmarks on the paper are visible to anyone with access
  query = (
    select(Bookmark)
    .where(Bookmark.paper_id == paper_id)
    .order_by(Bookmark.page_number, Bookmark.created_at)
  )
  result = await session.execute(query)
  return list(result.scalars().all())


async def create_bookmark(
  session: AsyncSession,
  paper_id: int,
  page_number: int,
  note: str | None = None,
  *,
  user_id: int | None = None,
) -> Bookmark:
  paper = await get_visible_paper_or_404(session, paper_id, user_id=user_id)

  if user_id is not None and paper.uploaded_by_id != user_id:
    perm = await get_effective_paper_permission(session, user_id, paper)
    if perm not in ("owner", "editor"):
      raise HTTPException(status_code=403, detail="Editor permission required to bookmark")

  bookmark = Bookmark(
    paper_id=paper_id,
    user_id=user_id,
    page_number=page_number,
    note=note,
  )
  session.add(bookmark)
  await session.commit()
  await session.refresh(bookmark)

  return bookmark


async def delete_bookmark(
  session: AsyncSession,
  bookmark_id: int,
  paper_id: int,
  *,
  user_id: int | None = None,
) -> None:
  bookmark = await get_bookmark_or_404(
    session, bookmark_id, paper_id=paper_id, user_id=user_id
  )
  await session.delete(bookmark)
  await session.commit()
