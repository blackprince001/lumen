"""Service for multi-paper chat functionality (group/selection-based AI conversations)."""

import asyncio
from typing import Any, AsyncGenerator, cast

from google import genai
from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.logger import get_logger
from app.models.multi_chat import MultiChatMessage, MultiChatSession
from app.models.paper import Paper
from app.services.base_ai_service import BaseGoogleAIService
from app.services.content_provider import content_provider
from app.utils.citation_extractor import add_citations

logger = get_logger(__name__)

# Maximum number of papers to upload as file parts to Gemini
MAX_FILE_PARTS = 10
# Total text budget when using text fallback (characters)
TOTAL_TEXT_BUDGET = 6000

RATE_LIMIT_ERROR_MESSAGE = (
  "I apologize, but I've hit the API rate limit/quota. "
  "This means your Google API quota has been exceeded. "
  "Please check your plan and billing details at https://ai.dev/rate-limit. "
  "If you've changed your API key, please restart the backend server."
)

API_KEY_ERROR_MESSAGE = (
  "I apologize, but there's an issue with the API key configuration. "
  "Please check that your Google API key is valid and has the necessary permissions."
)


def _build_error_message(error: Exception) -> str:
  """Build user-facing error message based on exception type."""
  from app.services.chat import _is_api_key_error, _is_rate_limit_error

  if _is_rate_limit_error(error):
    return RATE_LIMIT_ERROR_MESSAGE
  if _is_api_key_error(error):
    return API_KEY_ERROR_MESSAGE
  return f"I apologize, but I encountered an error: {str(error)[:200]}"


class MultiChatService(BaseGoogleAIService):
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
    """Get a multi-chat session by ID with papers and messages loaded."""
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
    """Get existing session or create a new one. Returns (session, error)."""
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
    """Fetch multiple papers by their IDs."""
    if not paper_ids:
      return []
    query = select(Paper).where(Paper.id.in_(paper_ids))
    result = await db_session.execute(query)
    return list(result.scalars().all())

  async def _fetch_group_paper_ids(
    self, db_session: AsyncSession, group_id: int
  ) -> list[int]:
    """Fetch all paper IDs belonging to a group."""
    from app.models.paper import paper_group_association

    query = select(paper_group_association.c.paper_id).where(
      paper_group_association.c.group_id == group_id
    )
    result = await db_session.execute(query)
    return [row[0] for row in result.fetchall()]

  # ---- Context Building ----

  def _build_multi_context_header(self, papers: list[Paper]) -> list[str]:
    """Build context header listing all papers."""
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
    """Build paper content sections for papers that don't have file uploads."""
    text_papers = [p for p in papers if cast(int, p.id) not in file_paper_ids]
    if not text_papers:
      return []

    parts = ["\n## Paper Contents:"]
    # Distribute text budget equally across papers
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
    """Build the conversation history section of context."""
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
    """Build the full context string for multi-paper AI prompt."""
    context_parts = self._build_multi_context_header(papers)
    context_parts.extend(
      self._build_multi_context_content(papers, file_paper_ids or set())
    )
    context_parts.extend(self._build_multi_context_history(chat_history))
    return "\n".join(context_parts)

  # ---- Content Parts (File uploads) ----

  async def _get_multi_content_parts(
    self, papers: list[Paper]
  ) -> tuple[list[types.Part], set[int]]:
    """Upload papers to Gemini and return content parts.

    Returns:
        Tuple of (content_parts, set of paper IDs that were uploaded as files)
    """
    content_parts: list[types.Part] = []
    file_paper_ids: set[int] = set()

    # Sort papers: those with files first
    papers_with_files = [p for p in papers if p.file_path]
    papers_without_files = [p for p in papers if not p.file_path]

    # Upload up to MAX_FILE_PARTS papers as files
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

    # For papers without files, add text parts if they have content
    remaining_slots = MAX_FILE_PARTS - len(file_paper_ids)
    for paper in papers_without_files[:remaining_slots]:
      if paper.content_text:
        content = cast(str, paper.content_text)
        budget = max(500, TOTAL_TEXT_BUDGET // len(papers))
        if len(content) > budget:
          content = content[:budget] + "..."
        # These are included in the context string instead
        pass

    return content_parts, file_paper_ids

  # ---- Message Persistence ----

  async def _save_user_message(
    self,
    db_session: AsyncSession,
    session_id: int,
    content: str,
    references: dict[str, Any] | None = None,
  ) -> MultiChatMessage:
    """Save user message to database."""
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
    """Save assistant message to database."""
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
    """Get chat history for a session."""
    query = (
      select(MultiChatMessage)
      .where(MultiChatMessage.session_id == session_id)
      .order_by(MultiChatMessage.created_at)
    )
    result = await db_session.execute(query)
    return list(result.scalars().all())

  # ---- GenAI API ----

  def _call_genai_api_sync(
    self,
    client: genai.Client,
    prompt: str,
    content_parts: list[types.Part] | None = None,
  ) -> Any:
    """Synchronous GenAI API call with grounding and optional file content."""
    grounding_tool = types.Tool(google_search=types.GoogleSearch())
    config = types.GenerateContentConfig(tools=[grounding_tool])

    contents: list[types.Part] = []
    if content_parts:
      contents.extend(content_parts)
    contents.append(types.Part.from_text(text=prompt))

    return client.models.generate_content(
      model=settings.GENAI_MODEL,
      contents=contents,
      config=config,
    )

  async def _call_genai_api(
    self,
    client: genai.Client,
    prompt: str,
    content_parts: list[types.Part] | None = None,
  ) -> Any:
    """Call the GenAI API without blocking the event loop."""
    return await asyncio.to_thread(
      self._call_genai_api_sync, client, prompt, content_parts
    )

  # ---- Streaming ----

  async def stream_message(
    self,
    db_session: AsyncSession,
    user_message: str,
    paper_ids: list[int] | None = None,
    group_id: int | None = None,
    references: dict[str, Any] | None = None,
    session_id: int | None = None,
  ) -> AsyncGenerator[dict[str, Any], None]:
    """Stream a multi-paper chat message response."""
    client = self._get_client()
    if not client:
      yield {
        "type": "error",
        "error": "Google API key not configured. Please set GOOGLE_API_KEY.",
      }
      return

    # Resolve paper IDs from group if not provided
    effective_paper_ids = paper_ids or []
    if not effective_paper_ids and group_id:
      effective_paper_ids = await self._fetch_group_paper_ids(db_session, group_id)

    if not effective_paper_ids:
      yield {
        "type": "error",
        "error": "No papers provided for context. Add papers to the group or select papers to chat about.",
      }
      return

    # Get or create session
    chat_session, session_error = await self._get_or_create_session(
      db_session, effective_paper_ids, group_id, session_id
    )
    if session_error or not chat_session:
      yield {"type": "error", "error": session_error or "Failed to get session"}
      return

    # Fetch all papers
    papers = await self._fetch_papers(db_session, effective_paper_ids)
    if not papers:
      yield {"type": "error", "error": "No papers found for the given IDs."}
      return

    # Upload papers and get content parts
    try:
      content_parts, file_paper_ids = await self._get_multi_content_parts(papers)
    except Exception as e:
      logger.error("Failed to get content parts", error=str(e))
      content_parts = []
      file_paper_ids = set()

    # Build context
    chat_history = await self._get_chat_history(db_session, cast(int, chat_session.id))
    context = self.build_multi_context(papers, chat_history, file_paper_ids)

    # Save user message
    await self._save_user_message(
      db_session,
      cast(int, chat_session.id),
      user_message,
      references,
    )

    full_prompt = f"{context}\n\n## User Question:\n{user_message}"

    try:
      response = await self._call_genai_api(client, full_prompt, content_parts)
      full_content = add_citations(response)

      chunk_size = 50
      for i in range(0, len(full_content), chunk_size):
        chunk = full_content[i : i + chunk_size]
        yield {"type": "chunk", "content": chunk}
        await asyncio.sleep(0.01)

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
        "Google API error in multi-chat stream_message",
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
  ) -> MultiChatMessage | None:
    """Send a multi-paper chat message and get a response (non-streaming)."""
    client = self._get_client()
    if not client:
      raise ValueError("Google API key not configured. Please set GOOGLE_API_KEY.")

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

    content_parts, file_paper_ids = await self._get_multi_content_parts(papers)

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
      response = await self._call_genai_api(client, full_prompt, content_parts)
      text_with_citations = add_citations(response)

      return await self._save_assistant_message(
        db_session, cast(int, chat_session.id), text_with_citations
      )
    except Exception as e:
      logger.error(
        "Google API error in multi-chat send_message",
        error_type=type(e).__name__,
        error_message=str(e),
      )
      error_content = _build_error_message(e)
      await self._save_assistant_message(
        db_session, cast(int, chat_session.id), error_content
      )
      raise ValueError(f"Failed to get AI response: {str(e)[:200]}") from e


multi_chat_service = MultiChatService()
