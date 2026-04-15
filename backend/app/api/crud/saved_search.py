"""SavedSearch CRUD functions."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.saved_search import SavedSearch


async def get_saved_search_or_404(
  session: AsyncSession,
  search_id: int,
  *,
  user_id: int | None = None,
) -> SavedSearch:
  """Fetch a saved search by ID or raise 404.

  If `user_id` is provided, only saved searches owned by that user (or legacy
  rows with NULL user_id) are returned.
  """
  query = select(SavedSearch).where(SavedSearch.id == search_id)
  if user_id is not None:
    query = query.where(
      (SavedSearch.user_id == user_id) | (SavedSearch.user_id.is_(None))
    )
  result = await session.execute(query)
  saved_search = result.scalar_one_or_none()

  if not saved_search:
    raise HTTPException(status_code=404, detail="Saved search not found")

  return saved_search


async def list_saved_searches(
  session: AsyncSession,
  *,
  user_id: int | None = None,
) -> list[SavedSearch]:
  """List saved searches, optionally scoped to a single user."""
  query = select(SavedSearch)
  if user_id is not None:
    query = query.where(
      (SavedSearch.user_id == user_id) | (SavedSearch.user_id.is_(None))
    )
  query = query.order_by(SavedSearch.created_at.desc())
  result = await session.execute(query)
  return list(result.scalars().all())


async def create_saved_search(
  session: AsyncSession,
  name: str,
  *,
  user_id: int | None = None,
  description: str | None = None,
  query_params: dict | None = None,
) -> SavedSearch:
  """Create a new saved search."""
  saved_search = SavedSearch(
    user_id=user_id,
    name=name,
    description=description,
    query_params=query_params,
  )
  session.add(saved_search)
  await session.commit()
  await session.refresh(saved_search)

  return saved_search


async def delete_saved_search(
  session: AsyncSession,
  search_id: int,
  *,
  user_id: int | None = None,
) -> None:
  """Delete a saved search."""
  saved_search = await get_saved_search_or_404(session, search_id, user_id=user_id)
  await session.delete(saved_search)
  await session.commit()
