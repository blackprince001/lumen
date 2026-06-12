"""Service for multi-paper chat functionality (group/selection-based AI conversations)."""

from typing import Any, AsyncGenerator, cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logger import get_logger
from app.models.multi_chat import MultiChatMessage, MultiChatSession
from app.models.paper import Paper
from app.services.ai.base_ai_service import BaseAIService
from app.services.ai.providers.base import AIProviderError, AuthError, RateLimitError
from app.services.content_provider import content_provider

logger = get_logger(__name__)

MAX_FILE_PARTS = 10
TOTAL_TEXT_BUDGET = 6000

RATE_LIMIT_ERROR_MESSAGE = (
  "I apologize, but I've hit the API rate limit. Please wait a moment and try again."
)

API_KEY_ERROR_MESSAGE = (
  "I apologize, but there's an issue with the API key configuration. "
  "Please check your AI provider settings and ensure the key is valid."
)


def _build_error_message(error: Exception) -> str:
  if isinstance(error, RateLimitError):
    return RATE_LIMIT_ERROR_MESSAGE
  if isinstance(error, AuthError):
    return API_KEY_ERROR_MESSAGE
  if isinstance(error, AIProviderError):
    return f"I apologize, but I encountered an error: {str(error)[:200]}"
  return f"I apologize, but I encountered an error: {str(error)[:200]}"


class MultiChatService(BaseAIService):
  """Service for chat functionality with multiple research papers."""

  # ---- Session Management ----

  async def create_session(
    self,
    db_session: AsyncSession,
    paper_ids: list[int],
    group_id: int | None = None,
    name: str = "New Session",
    user_id: int | None = None,
  ) -> MultiChatSession:
    papers = await self._fetch_papers(db_session, paper_ids)
    if not papers:
      raise ValueError("No valid papers found for the given IDs.")

    chat_session = MultiChatSession(name=name, group_id=group_id, user_id=user_id)
    chat_session.papers = papers
    db_session.add(chat_session)
    await db_session.commit()
    await db_session.refresh(chat_session)
    return chat_session

  async def get_session(
    self, db_session: AsyncSession, session_id: int
  ) -> MultiChatSession | None:
    query = (
      select(MultiChatSession)
      .options(
        selectinload(MultiChatSession.messages),
        selectinload(MultiChatSession.papers),
      )
      .where(MultiChatSession.id == session_id)
    )
    result = await db_session.execute(query)
    return result.scalar_one_or_none()

  async def get_latest_session(
    self, db_session: AsyncSession, group_id: int, user_id: int | None = None
  ) -> MultiChatSession | None:
    query = (
      select(MultiChatSession)
      .options(
        selectinload(MultiChatSession.messages),
        selectinload(MultiChatSession.papers),
      )
      .where(MultiChatSession.group_id == group_id)
    )
    if user_id is not None:
      query = query.where(MultiChatSession.user_id == user_id)
    query = query.order_by(MultiChatSession.updated_at.desc()).limit(1)
    result = await db_session.execute(query)
    return result.scalar_one_or_none()

  async def _get_or_create_session(
    self,
    db_session: AsyncSession,
    paper_ids: list[int],
    group_id: int | None,
    session_id: int | None,
  ) -> tuple[MultiChatSession | None, str | None]:
    chat_session = None

    if session_id:
      chat_session = await self.get_session(db_session, session_id)
      if not chat_session:
        return None, f"Session {session_id} not found"

    if not chat_session and group_id:
      chat_session = await self.get_latest_session(db_session, group_id)

    if not chat_session:
      try:
        chat_session = await self.create_session(
          db_session, paper_ids, group_id=group_id
        )
      except ValueError as e:
        return None, str(e)

    return chat_session, None

  # ---- Paper Fetching ----

  async def _fetch_papers(
    self, db_session: AsyncSession, paper_ids: list[int]
  ) -> list[Paper]:
    if not paper_ids:
      return []
    query = select(Paper).where(Paper.id.in_(paper_ids))
    result = await db_session.execute(query)
    return list(result.scalars().all())

  async def _fetch_group_paper_ids(
    self, db_session: AsyncSession, group_id: int
  ) -> list[int]:
    from app.models.paper import paper_group_association

    query = select(paper_group_association.c.paper_id).where(
      paper_group_association.c.group_id == group_id
    )
    result = await db_session.execute(query)
    return [row[0] for row in result.fetchall()]

  # ---- Context Building ----

  def _build_multi_context_header(self, papers: list[Paper]) -> list[str]:
    parts = [
      "You are an AI assistant helping a user learn from a collection of "
      "research papers. Provide clear, educational responses that draw on "
      "the provided papers. When referring to specific papers, mention them "
      "by title.",
      f"\n## Papers in Context ({len(papers)}):",
    ]
    for i, paper in enumerate(papers, 1):
      doi_info = f" (DOI: {paper.doi})" if paper.doi else ""
      has_file = bool(paper.file_path)
      context_type = "[Full PDF]" if has_file else "[Text excerpt]"
      parts.append(f'{i}. "{paper.title}"{doi_info} — {context_type}')

    return parts

  def _build_multi_context_content(
    self,
    papers: list[Paper],
    file_paper_ids: set[int],
  ) -> list[str]:
    text_papers = [p for p in papers if cast(int, p.id) not in file_paper_ids]
    if not text_papers:
      return []

    parts = ["\n## Paper Contents:"]
    budget_per_paper = max(500, TOTAL_TEXT_BUDGET // len(text_papers))

    for paper in text_papers:
      if not paper.content_text:
        parts.append(f'\n### "{paper.title}"')
        parts.append("[No text content available]")
        continue

      content = cast(str, paper.content_text)
      if len(content) > budget_per_paper:
        content = content[:budget_per_paper] + "..."

      parts.append(f'\n### "{paper.title}"')
      parts.append(content)

    return parts

  def _build_multi_context_history(
    self, chat_history: list[MultiChatMessage]
  ) -> list[str]:
    if not chat_history:
      return []

    parts = ["\n## Conversation:"]
    for msg in chat_history[-5:]:
      role_label = "U" if msg.role == "user" else "A"
      msg_content = msg.content[:500]
      if len(msg.content) > 500:
        msg_content += "..."
      parts.append(f"\n{role_label}: {msg_content}")

    return parts

  def build_multi_context(
    self,
    papers: list[Paper],
    chat_history: list[MultiChatMessage],
    file_paper_ids: set[int] | None = None,
  ) -> str:
    context_parts = self._build_multi_context_header(papers)
    context_parts.extend(
      self._build_multi_context_content(papers, file_paper_ids or set())
    )
    context_parts.extend(self._build_multi_context_history(chat_history))
    return "\n".join(context_parts)

  # ---- Content Parts (File uploads) ----

  async def _get_multi_content_parts(
    self, papers: list[Paper]
  ) -> tuple[list[Any], set[int]]:
    content_parts: list[Any] = []
    file_paper_ids: set[int] = set()

    papers_with_files = [p for p in papers if p.file_path]

    for paper in papers_with_files[:MAX_FILE_PARTS]:
      try:
        parts = await content_provider.get_content_parts(
          paper, include_text_fallback=False
        )
        if parts:
          content_parts.extend(parts)
          file_paper_ids.add(cast(int, paper.id))
      except Exception as e:
        logger.warning(
          "Failed to get content parts for paper",
          paper_id=paper.id,
          error=str(e),
        )

    return content_parts, file_paper_ids

  # ---- Message Persistence ----

  async def _save_user_message(
    self,
    db_session: AsyncSession,
    session_id: int,
    content: str,
    references: dict[str, Any] | None = None,
  ) -> MultiChatMessage:
    user_msg = MultiChatMessage(
      session_id=session_id,
      role="user",
      content=content,
      references=references or {},
    )
    db_session.add(user_msg)
    await db_session.commit()
    return user_msg

  async def _save_assistant_message(
    self,
    db_session: AsyncSession,
    session_id: int,
    content: str,
  ) -> MultiChatMessage:
    assistant_msg = MultiChatMessage(
      session_id=session_id,
      role="assistant",
      content=content,
      references={},
    )
    db_session.add(assistant_msg)
    await db_session.commit()
    await db_session.refresh(assistant_msg)
    return assistant_msg

  async def _get_chat_history(
    self, db_session: AsyncSession, session_id: int
  ) -> list[MultiChatMessage]:
    query = (
      select(MultiChatMessage)
      .where(MultiChatMessage.session_id == session_id)
      .order_by(MultiChatMessage.created_at)
    )
    result = await db_session.execute(query)
    return list(result.scalars().all())

  # ---- Streaming ----

  async def stream_message(
    self,
    db_session: AsyncSession,
    user_message: str,
    paper_ids: list[int] | None = None,
    group_id: int | None = None,
    references: dict[str, Any] | None = None,
    session_id: int | None = None,
    user_id: int | None = None,
  ) -> AsyncGenerator[dict[str, Any], None]:
    """Stream a multi-paper chat message response."""
    provider = await self._get_provider(db_session, user_id)
    if not provider:
      yield {
        "type": "error",
        "error": "AI provider not configured. Please configure your AI provider in settings.",
      }
      return

    effective_paper_ids = paper_ids or []
    if not effective_paper_ids and group_id:
      effective_paper_ids = await self._fetch_group_paper_ids(db_session, group_id)

    if not effective_paper_ids:
      yield {
        "type": "error",
        "error": "No papers provided for context. Add papers to the group or select papers to chat about.",
      }
      return

    chat_session, session_error = await self._get_or_create_session(
      db_session, effective_paper_ids, group_id, session_id
    )
    if session_error or not chat_session:
      yield {"type": "error", "error": session_error or "Failed to get session"}
      return

    papers = await self._fetch_papers(db_session, effective_paper_ids)
    if not papers:
      yield {"type": "error", "error": "No papers found for the given IDs."}
      return

    try:
      _, file_paper_ids = await self._get_multi_content_parts(papers)
    except Exception as e:
      logger.error("Failed to get content parts", error=str(e))
      file_paper_ids = set()

    chat_history = await self._get_chat_history(db_session, cast(int, chat_session.id))
    context = self.build_multi_context(papers, chat_history, file_paper_ids)

    await self._save_user_message(
      db_session,
      cast(int, chat_session.id),
      user_message,
      references,
    )

    full_prompt = f"{context}\n\n## User Question:\n{user_message}"

    try:
      config = self._build_config(provider)
      full_content = await provider.generate(full_prompt, config)

      chunk_size = 50
      for i in range(0, len(full_content), chunk_size):
        chunk = full_content[i : i + chunk_size]
        yield {"type": "chunk", "content": chunk}

      assistant_msg = await self._save_assistant_message(
        db_session, cast(int, chat_session.id), full_content
      )

      yield {
        "type": "done",
        "message_id": assistant_msg.id,
        "session_id": chat_session.id,
      }

    except Exception as e:
      logger.error(
        "AI provider error in multi-chat stream_message",
        error_type=type(e).__name__,
        error_message=str(e),
      )
      error_content = _build_error_message(e)
      await self._save_assistant_message(
        db_session, cast(int, chat_session.id), error_content
      )
      yield {"type": "error", "error": error_content}

  # ---- Non-Streaming ----

  async def send_message(
    self,
    db_session: AsyncSession,
    user_message: str,
    paper_ids: list[int] | None = None,
    group_id: int | None = None,
    references: dict[str, Any] | None = None,
    session_id: int | None = None,
    user_id: int | None = None,
  ) -> MultiChatMessage | None:
    """Send a multi-paper chat message and get a response (non-streaming)."""
    provider = await self._get_provider(db_session, user_id)
    if not provider:
      raise ValueError(
        "AI provider not configured. Please configure your AI provider in settings."
      )

    effective_paper_ids = paper_ids or []
    if not effective_paper_ids and group_id:
      effective_paper_ids = await self._fetch_group_paper_ids(db_session, group_id)

    if not effective_paper_ids:
      raise ValueError("No papers provided for context.")

    chat_session, session_error = await self._get_or_create_session(
      db_session, effective_paper_ids, group_id, session_id
    )
    if session_error or not chat_session:
      raise ValueError(session_error or "Failed to get session")

    papers = await self._fetch_papers(db_session, effective_paper_ids)
    if not papers:
      raise ValueError("No papers found for the given IDs.")

    _, file_paper_ids = await self._get_multi_content_parts(papers)

    chat_history = await self._get_chat_history(db_session, cast(int, chat_session.id))
    context = self.build_multi_context(papers, chat_history, file_paper_ids)

    await self._save_user_message(
      db_session,
      cast(int, chat_session.id),
      user_message,
      references,
    )

    full_prompt = f"{context}\n\n## User Question:\n{user_message}"

    try:
      config = self._build_config(provider)
      text_with_citations = await provider.generate(full_prompt, config)

      return await self._save_assistant_message(
        db_session, cast(int, chat_session.id), text_with_citations
      )
    except Exception as e:
      logger.error(
        "AI provider error in multi-chat send_message",
        error_type=type(e).__name__,
        error_message=str(e),
      )
      error_content = _build_error_message(e)
      await self._save_assistant_message(
        db_session, cast(int, chat_session.id), error_content
      )
      raise ValueError(f"Failed to get AI response: {str(e)[:200]}") from e


multi_chat_service = MultiChatService()
