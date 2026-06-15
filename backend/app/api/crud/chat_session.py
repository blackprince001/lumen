"""ChatSession CRUD functions."""

from collections import Counter

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.crud.paper import get_visible_paper_or_404
from app.api.crud.utils import ensure_loaded
from app.models.chat import ChatSession


def _populate_thread_counts(chat_session: ChatSession) -> None:
  """Stamp each message's ``thread_count`` from the loaded message set.

  All replies live in ``chat_session.messages`` (they share the session),
  so the count is derived in-memory rather than with extra queries. The
  value is set as a transient attribute that the Pydantic schema reads.
  """
  messages = chat_session.messages or []
  reply_counts = Counter(
    m.parent_message_id for m in messages if m.parent_message_id is not None
  )
  for m in messages:
    m.thread_count = reply_counts.get(m.id, 0)


async def get_chat_session_or_404(
  session: AsyncSession,
  session_id: int,
  *,
  with_messages: bool = False,
  user_id: int | None = None,
) -> ChatSession:
  """Fetch a chat session by ID or raise 404."""
  query = select(ChatSession).where(ChatSession.id == session_id)
  if user_id is not None:
    query = query.where(
      (ChatSession.user_id == user_id) | (ChatSession.user_id.is_(None))
    )

  query = query.options(selectinload(ChatSession.user), selectinload(ChatSession.paper))
  if with_messages:
    query = query.options(selectinload(ChatSession.messages))

  result = await session.execute(query)
  chat_session = result.scalar_one_or_none()

  if not chat_session:
    raise HTTPException(status_code=404, detail="Session not found")

  if with_messages:
    ensure_loaded(chat_session, "messages")
    _populate_thread_counts(chat_session)

  return chat_session


async def list_chat_sessions_for_paper(
  session: AsyncSession,
  paper_id: int,
  *,
  user_id: int | None = None,
) -> list[ChatSession]:
  """List chat sessions for a paper, optionally scoped to a single user."""
  # Verify paper exists
  await get_visible_paper_or_404(session, paper_id)

  query = (
    select(ChatSession)
    .options(
      selectinload(ChatSession.messages),
      selectinload(ChatSession.user),
      selectinload(ChatSession.paper),
    )
    .where(ChatSession.paper_id == paper_id)
  )
  if user_id is not None:
    query = query.where(
      (ChatSession.user_id == user_id) | (ChatSession.user_id.is_(None))
    )
  query = query.order_by(ChatSession.updated_at.desc())
  result = await session.execute(query)
  sessions = list(result.scalars().all())

  for s in sessions:
    ensure_loaded(s, "messages")
    _populate_thread_counts(s)

  return sessions


async def delete_chat_session(
  session: AsyncSession,
  session_id: int,
  *,
  user_id: int | None = None,
) -> None:
  """Delete a chat session."""
  chat_session = await get_chat_session_or_404(session, session_id, user_id=user_id)
  await session.delete(chat_session)
  await session.commit()
