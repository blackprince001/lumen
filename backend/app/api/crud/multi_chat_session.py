"""MultiChatSession CRUD functions."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.crud.utils import ensure_loaded
from app.models.multi_chat import MultiChatSession


async def get_multi_chat_session_or_404(
  session: AsyncSession,
  session_id: int,
  *,
  with_messages: bool = False,
  with_papers: bool = False,
  user_id: int | None = None,
) -> MultiChatSession:
  """Fetch a multi-chat session by ID or raise 404."""
  query = select(MultiChatSession).where(MultiChatSession.id == session_id)
  if user_id is not None:
    query = query.where(
      (MultiChatSession.user_id == user_id) | (MultiChatSession.user_id.is_(None))
    )

  if with_messages:
    query = query.options(selectinload(MultiChatSession.messages))
  if with_papers:
    query = query.options(selectinload(MultiChatSession.papers))

  result = await session.execute(query)
  chat_session = result.scalar_one_or_none()

  if not chat_session:
    raise HTTPException(status_code=404, detail="Multi-chat session not found")

  if with_messages:
    ensure_loaded(chat_session, "messages")
  if with_papers:
    ensure_loaded(chat_session, "papers")

  return chat_session


async def list_multi_chat_sessions_for_group(
  session: AsyncSession,
  group_id: int,
  *,
  user_id: int | None = None,
) -> list[MultiChatSession]:
  """List multi-chat sessions for a group, optionally scoped to a user."""
  query = (
    select(MultiChatSession)
    .options(
      selectinload(MultiChatSession.messages),
      selectinload(MultiChatSession.papers),
    )
    .where(MultiChatSession.group_id == group_id)
  )
  if user_id is not None:
    query = query.where(
      (MultiChatSession.user_id == user_id) | (MultiChatSession.user_id.is_(None))
    )
  query = query.order_by(MultiChatSession.updated_at.desc())
  result = await session.execute(query)
  sessions = list(result.scalars().all())

  for s in sessions:
    ensure_loaded(s, "messages")
    ensure_loaded(s, "papers")

  return sessions


async def delete_multi_chat_session(
  session: AsyncSession,
  session_id: int,
  *,
  user_id: int | None = None,
) -> None:
  """Delete a multi-chat session."""
  chat_session = await get_multi_chat_session_or_404(
    session, session_id, user_id=user_id
  )
  await session.delete(chat_session)
  await session.commit()
