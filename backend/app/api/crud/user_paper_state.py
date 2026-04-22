"""UserPaperState CRUD functions."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sharing import UserPaperState


async def get_or_create_state(
  session: AsyncSession, user_id: int, paper_id: int
) -> UserPaperState:
  result = await session.execute(
    select(UserPaperState).where(
      UserPaperState.user_id == user_id,
      UserPaperState.paper_id == paper_id,
    )
  )
  state = result.scalar_one_or_none()
  if state is not None:
    return state

  now = datetime.now(timezone.utc)
  state = UserPaperState(
    user_id=user_id,
    paper_id=paper_id,
    reading_status="not_started",
    priority="low",
    reading_time_minutes=0,
    created_at=now,
    updated_at=now,
  )
  session.add(state)
  await session.flush()
  return state


async def batch_get_states(
  session: AsyncSession, user_id: int, paper_ids: list[int]
) -> dict[int, UserPaperState]:
  if not paper_ids:
    return {}
  result = await session.execute(
    select(UserPaperState).where(
      UserPaperState.user_id == user_id,
      UserPaperState.paper_id.in_(paper_ids),
    )
  )
  return {int(s.paper_id): s for s in result.scalars().all()}
