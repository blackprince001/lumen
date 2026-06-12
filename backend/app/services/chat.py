"""Service for chat functionality with research papers.

Uses the OpenAI Agents SDK for agent execution with function-calling
tools for paper content retrieval.  Falls back to the legacy
``provider.generate()`` path for providers that are not yet
OpenAI-compatible (e.g. Gemini).
"""

import asyncio
import re
from typing import Any, AsyncGenerator, cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.models.annotation import Annotation
from app.models.chat import ChatMessage, ChatSession
from app.models.paper import Paper
from app.services.ai.agent import (
  ERROR_CODE_AUTH,
  ERROR_CODE_INTERNAL,
  ERROR_CODE_NETWORK,
  ERROR_CODE_NO_PROVIDER,
  ERROR_CODE_PROVIDER_UNAVAILABLE,
  ERROR_CODE_RATE_LIMIT,
  ERROR_CODE_TIMEOUT,
  ERROR_CODE_TOOL_ERROR,
  adapt_stream,
  build_run_config,
)
from app.services.ai.agent.agents import create_paper_agent
from app.services.ai.agent.context import (
  BYOContext,
  get_byo_context,
  set_byo_context,
)
from app.services.ai.agent.multi_provider import ProviderRouteConfig
from app.services.ai.base_ai_service import BaseAIService
from app.services.ai.providers.base import (
  AIProviderError,
  AuthError,
  RateLimitError,
)
from app.services.content_provider import content_provider

logger = get_logger(__name__)

RATE_LIMIT_ERROR_MESSAGE = (
  "I apologize, but I've hit the API rate limit. Please wait a moment and try again."
)

API_KEY_ERROR_MESSAGE = (
  "I apologize, but there's an issue with the API key configuration. "
  "Please check your AI provider settings and ensure the key is valid."
)

AGENT_PROVIDER_TYPES = {
  "openai-compatible",
  "openai",
  "anthropic",
  "deepseek",
  "ollama",
  "vllm",
}


def _get_runner():
  """Lazy import of the OpenAI Agents SDK Runner.

  Returns ``None`` when the ``openai-agents`` package is not installed,
  allowing the legacy provider path to operate without it.
  """
  if adapt_stream is None:
    return None
  try:
    from agents import Runner as R

    return R
  except ImportError:
    return None


def _build_error_message(error: Exception) -> str:
  """Build user-facing error message from provider-agnostic errors."""
  if isinstance(error, RateLimitError):
    return RATE_LIMIT_ERROR_MESSAGE
  if isinstance(error, AuthError):
    return API_KEY_ERROR_MESSAGE
  if isinstance(error, AIProviderError):
    return f"I apologize, but I encountered an error: {str(error)[:200]}"
  return f"I apologize, but I encountered an error: {str(error)[:200]}"


def _classify_exception(error: Exception) -> tuple[str, bool]:
  """Classify an exception into (error_code, recoverable)."""
  if isinstance(error, RateLimitError):
    return ERROR_CODE_RATE_LIMIT, True
  if isinstance(error, AuthError):
    return ERROR_CODE_AUTH, False

  error_str = str(error).lower()
  error_name = type(error).__name__.lower()

  if any(k in error_str + error_name for k in ("429", "rate", "ratelimit")):
    return ERROR_CODE_RATE_LIMIT, True
  if any(k in error_str + error_name for k in ("auth", "api key", "unauthorized", "401", "403")):
    return ERROR_CODE_AUTH, False
  if any(k in error_str + error_name for k in ("timeout", "timed out")):
    return ERROR_CODE_TIMEOUT, True
  if any(k in error_str + error_name for k in ("5", "502", "503", "unavailable")):
    return ERROR_CODE_PROVIDER_UNAVAILABLE, True
  if any(k in error_str for k in ("connect", "network", "econnrefused", "econnreset")):
    return ERROR_CODE_NETWORK, True

  return ERROR_CODE_INTERNAL, False


class ChatService(BaseAIService):
  """Service for chat functionality with research papers."""

  def parse_mentions(self, text: str) -> dict[str, list[int]]:
    """Parse @mentions from message text."""
    parsed_mentions: dict[str, list[int]] = {
      "notes": [],
      "annotations": [],
      "papers": [],
    }
    patterns = {
      "notes": r"@note(?:{(\d+)})?",
      "annotations": r"@annotation(?:{(\d+)})?",
      "papers": r"@paper(?:{(\d+)})?",
    }

    for mention_type, pattern in patterns.items():
      matches = re.finditer(pattern, text, re.IGNORECASE)
      for match in matches:
        mention_id = match.group(1)
        if mention_id:
          parsed_mentions[mention_type].append(int(mention_id))

    return parsed_mentions

  async def _resolve_notes(
    self, db_session: AsyncSession, paper_id: int, note_ids: list[int]
  ) -> list[dict[str, Any]]:
    if not note_ids:
      return []
    query = (
      select(Annotation)
      .where(Annotation.id.in_(note_ids))
      .where(Annotation.paper_id == paper_id)
      .where(Annotation.type == "note")
    )
    result = await db_session.execute(query)
    notes = result.scalars().all()
    resolved_notes = []
    for note in notes:
      page_info = ""
      if note.note_scope == "page" and note.coordinate_data:
        page = note.coordinate_data.get("page")
        if page:
          page_info = f" (Page {page})"
      resolved_notes.append(
        {
          "id": note.id,
          "content": note.content,
          "page": note.coordinate_data.get("page") if note.coordinate_data else None,
          "scope": note.note_scope,
          "display": f"Note {note.id}{page_info}: {note.content[:100]}...",
        }
      )
    return resolved_notes

  async def _resolve_annotations(
    self, db_session: AsyncSession, paper_id: int, annotation_ids: list[int]
  ) -> list[dict[str, Any]]:
    if not annotation_ids:
      return []
    query = (
      select(Annotation)
      .where(Annotation.id.in_(annotation_ids))
      .where(Annotation.paper_id == paper_id)
      .where(Annotation.type == "annotation")
    )
    result = await db_session.execute(query)
    annotations = result.scalars().all()
    resolved_annotations = []
    for ann in annotations:
      page_info = ""
      if ann.coordinate_data:
        page = ann.coordinate_data.get("page")
        if page:
          page_info = f" (Page {page})"
      highlighted = ann.highlighted_text or ann.content[:100]
      resolved_annotations.append(
        {
          "id": ann.id,
          "content": ann.content,
          "highlighted_text": ann.highlighted_text,
          "page": ann.coordinate_data.get("page") if ann.coordinate_data else None,
          "display": f"Annotation {ann.id}{page_info}: {highlighted}...",
        }
      )
    return resolved_annotations

  async def _resolve_papers(
    self, db_session: AsyncSession, paper_ids: list[int]
  ) -> list[dict[str, Any]]:
    if not paper_ids:
      return []
    query = select(Paper).where(Paper.id.in_(paper_ids))
    result = await db_session.execute(query)
    papers = result.scalars().all()
    return [
      {
        "id": paper.id,
        "title": paper.title,
        "content_text": paper.content_text or "",
        "doi": paper.doi,
        "display": f"Paper: {paper.title}",
      }
      for paper in papers
    ]

  async def resolve_references(
    self,
    db_session: AsyncSession,
    paper_id: int,
    mentions: dict[str, list[int]],
  ) -> dict[str, Any]:
    notes = await self._resolve_notes(db_session, paper_id, mentions.get("notes", []))
    annotations = await self._resolve_annotations(
      db_session, paper_id, mentions.get("annotations", [])
    )
    papers = await self._resolve_papers(db_session, mentions.get("papers", []))
    return {"notes": notes, "annotations": annotations, "papers": papers}

  # ---- Session Management (unchanged) ----

  async def create_session(
    self,
    db_session: AsyncSession,
    paper_id: int,
    name: str = "New Session",
    user_id: int | None = None,
  ) -> ChatSession:
    chat_session = ChatSession(paper_id=paper_id, name=name, user_id=user_id)
    db_session.add(chat_session)
    await db_session.commit()
    await db_session.refresh(chat_session)
    return chat_session

  async def get_session(
    self, db_session: AsyncSession, session_id: int
  ) -> ChatSession | None:
    query = select(ChatSession).where(ChatSession.id == session_id)
    result = await db_session.execute(query)
    return result.scalar_one_or_none()

  async def get_latest_session(
    self, db_session: AsyncSession, paper_id: int, user_id: int | None = None
  ) -> ChatSession | None:
    query = select(ChatSession).where(ChatSession.paper_id == paper_id)
    if user_id is not None:
      query = query.where(ChatSession.user_id == user_id)
    query = query.order_by(ChatSession.updated_at.desc()).limit(1)
    result = await db_session.execute(query)
    return result.scalar_one_or_none()

  async def _get_or_create_session(
    self,
    db_session: AsyncSession,
    paper_id: int,
    session_id: int | None,
    user_id: int | None = None,
  ) -> tuple[ChatSession | None, str | None]:
    chat_session = None
    if session_id:
      chat_session = await self.get_session(db_session, session_id)
      if chat_session and chat_session.paper_id != paper_id:
        return None, "Session does not belong to this paper"
    if not chat_session:
      chat_session = await self.get_latest_session(
        db_session, paper_id, user_id=user_id
      )
    if not chat_session:
      chat_session = await self.create_session(db_session, paper_id, user_id=user_id)
    return chat_session, None

  async def _fetch_paper(self, db_session: AsyncSession, paper_id: int) -> Paper | None:
    paper_query = select(Paper).where(Paper.id == paper_id)
    paper_result = await db_session.execute(paper_query)
    return paper_result.scalar_one_or_none()

  async def _get_chat_history(
    self, db_session: AsyncSession, session_id: int
  ) -> list[ChatMessage]:
    messages_query = (
      select(ChatMessage)
      .where(ChatMessage.session_id == session_id)
      .order_by(ChatMessage.created_at)
    )
    messages_result = await db_session.execute(messages_query)
    return list(messages_result.scalars().all())

  def _extract_mention_ids(
    self, references: dict[str, Any] | None
  ) -> dict[str, list[int]]:
    if not references:
      return {"notes": [], "annotations": [], "papers": []}
    return {
      "notes": [r.get("id") for r in references.get("notes", []) if r.get("id")],
      "annotations": [
        r.get("id") for r in references.get("annotations", []) if r.get("id")
      ],
      "papers": [r.get("id") for r in references.get("papers", []) if r.get("id")],
    }

  # ---- Message Persistence (unchanged) ----

  async def _save_user_message(
    self,
    db_session: AsyncSession,
    session_id: int,
    content: str,
    references: dict[str, Any],
  ) -> ChatMessage:
    user_msg = ChatMessage(
      session_id=session_id,
      role="user",
      content=content,
      references=references,
    )
    db_session.add(user_msg)
    await db_session.commit()
    return user_msg

  async def _save_assistant_message(
    self,
    db_session: AsyncSession,
    session_id: int,
    content: str,
  ) -> ChatMessage:
    assistant_msg = ChatMessage(
      session_id=session_id,
      role="assistant",
      content=content,
      references={},
    )
    db_session.add(assistant_msg)
    await db_session.commit()
    await db_session.refresh(assistant_msg)
    return assistant_msg

  # ---- Streaming (rewritten to use agent framework) ----

  async def _setup_byo_context(
    self,
    db_session: AsyncSession,
    user_id: int | None,
  ) -> list[ProviderRouteConfig]:
    """Set up the BYOContext for the current request and return provider configs."""
    provider_configs = await self._resolve_provider_configs(db_session, user_id)

    ctx = get_byo_context()
    if ctx.user_id is None:
      set_byo_context(
        BYOContext(
          user_id=user_id,
          provider_configs=provider_configs,
          extra={"db_session": db_session},
        )
      )
    return provider_configs

  async def _resolve_provider_configs(
    self,
    db_session: AsyncSession,
    user_id: int | None,
  ) -> list[ProviderRouteConfig]:
    """Resolve provider configs for the user, with env fallback."""
    from app.crud.user_ai_settings import get_user_ai_settings

    configs: list[ProviderRouteConfig] = []

    if user_id is not None:
      try:
        ai_settings = await get_user_ai_settings(db_session, user_id)
        if ai_settings and ai_settings.is_configured:
          configs.append(
            ProviderRouteConfig(
              provider_type=ai_settings.provider or "openai-compatible",
              api_key=ai_settings.get_api_key(),
              base_url=ai_settings.base_url,
              default_model=ai_settings.model,
            )
          )
      except Exception as e:
        logger.error("Error loading user AI settings", user_id=user_id, error=str(e))

    if not configs:
      from app.core.config import settings as app_settings

      if app_settings.GOOGLE_API_KEY:
        configs.append(
          ProviderRouteConfig(
            provider_type="gemini",
            api_key=app_settings.GOOGLE_API_KEY,
            default_model=app_settings.GENAI_MODEL,
          )
        )

      if app_settings.OPENAI_API_KEY:
        configs.append(
          ProviderRouteConfig(
            provider_type="openai",
            api_key=app_settings.OPENAI_API_KEY,
            default_model="gpt-4o",
          )
        )

      if app_settings.ANTHROPIC_API_KEY:
        configs.append(
          ProviderRouteConfig(
            provider_type="anthropic",
            api_key=app_settings.ANTHROPIC_API_KEY,
            default_model="claude-sonnet-4-20250514",
          )
        )

      if app_settings.DEEPSEEK_API_KEY:
        configs.append(
          ProviderRouteConfig(
            provider_type="deepseek",
            api_key=app_settings.DEEPSEEK_API_KEY,
            default_model="deepseek-chat",
          )
        )

    return configs

  def _can_use_agent(self, provider_type: str) -> bool:
    """Check if the provider supports the agent framework."""
    return provider_type.lower() in AGENT_PROVIDER_TYPES

  async def _prepare_message_context(
    self,
    db_session: AsyncSession,
    paper_id: int,
    user_message: str,
    references: dict[str, Any] | None,
    chat_session: ChatSession,
  ) -> tuple[str, dict[str, Any], list[Any]]:
    """Legacy context preparation for non-agent provider path."""
    has_explicit_refs = references and (
      references.get("notes")
      or references.get("annotations")
      or references.get("papers")
    )
    if has_explicit_refs:
      mention_ids = self._extract_mention_ids(references)
    else:
      mention_ids = self.parse_mentions(user_message)
    resolved_references = await self.resolve_references(
      db_session, paper_id, mention_ids
    )
    paper = await self._fetch_paper(db_session, paper_id)
    if not paper:
      raise ValueError(f"Paper {paper_id} not found")
    paper_content_parts = await content_provider.get_content_parts(paper)
    use_file_context = False
    if paper_content_parts and hasattr(paper_content_parts[0], "file_uri"):
      use_file_context = True
    chat_history = await self._get_chat_history(db_session, cast(int, chat_session.id))
    context = self.build_context(
      paper, resolved_references, chat_history, use_file_context=use_file_context
    )
    return context, resolved_references, paper_content_parts

  def build_context(
    self,
    paper: Paper,
    references: dict[str, Any],
    chat_history: list[ChatMessage],
    use_file_context: bool = False,
  ) -> str:
    """Build context string for legacy provider path."""
    context_parts = self._build_context_header(paper)
    if not use_file_context:
      context_parts.append(self._build_context_content(paper))
    context_parts.extend(self._build_context_references(references))
    context_parts.extend(self._build_context_history(chat_history))
    return "\n".join(context_parts)

  def _build_context_header(self, paper: Paper) -> list[str]:
    parts = [
      "You are an AI assistant helping a user learn from research papers. "
      "Provide clear, educational responses.",
      f"\n## Paper: {paper.title}",
    ]
    if paper.doi:
      parts.append(f"DOI: {paper.doi}")
    return parts

  def _build_context_content(self, paper: Paper) -> str:
    if not paper.content_text:
      return ""
    content = cast(str, paper.content_text)
    max_length = 3000
    if len(content) > max_length:
      content = content[:max_length] + "..."
    return f"\nContent:\n{content}"

  def _build_context_references(self, references: dict[str, Any]) -> list[str]:
    parts = []
    if references.get("notes"):
      parts.append("\n## Notes:")
      for note in references["notes"][:5]:
        page_info = f" (p{note['page']})" if note.get("page") else ""
        note_content = note["content"][:500]
        if len(note["content"]) > 500:
          note_content += "..."
        parts.append(f"\nNote {note['id']}{page_info}: {note_content}")
    if references.get("annotations"):
      parts.append("\n## Annotations:")
      for ann in references["annotations"][:5]:
        page_info = f" (p{ann['page']})" if ann.get("page") else ""
        ann_content = ann["content"][:500]
        if len(ann["content"]) > 500:
          ann_content += "..."
        parts.append(f"\nAnn {ann['id']}{page_info}: {ann_content}")
    if references.get("papers"):
      parts.append("\n## Referenced Papers:")
      for ref_paper in references["papers"][:3]:
        content = ref_paper["content_text"][:1000]
        if len(ref_paper["content_text"]) > 1000:
          content += "..."
        parts.append(f"\n{ref_paper['title']}:\n{content}")
    return parts

  def _build_context_history(self, chat_history: list[ChatMessage]) -> list[str]:
    if not chat_history:
      return []
    parts = ["\n## Conversation:"]
    for msg in chat_history[-5:]:
      role_label = "U" if msg.role == "user" else "A"
      msg_content = msg.content[:500]
      if len(cast(str, msg.content)) > 500:
        msg_content += "..."
      parts.append(f"\n{role_label}: {msg_content}")
    return parts

  async def stream_message(
    self,
    db_session: AsyncSession,
    paper_id: int,
    user_message: str,
    references: dict[str, Any] | None = None,
    session_id: int | None = None,
    user_id: int | None = None,
  ) -> AsyncGenerator[dict[str, Any], None]:
    """Stream a chat message response.

    Uses the new agent framework for OpenAI-compatible providers and
    falls back to the legacy ``provider.generate()`` path for others.
    """
    chat_session, session_error = await self._get_or_create_session(
      db_session, paper_id, session_id, user_id=user_id
    )
    if session_error or not chat_session:
      yield {
        "type": "error",
        "error": session_error or "Failed to get session",
        "error_code": ERROR_CODE_INTERNAL,
        "recoverable": False,
      }
      return

    paper = await self._fetch_paper(db_session, paper_id)
    if not paper:
      yield {
        "type": "error",
        "error": f"Paper {paper_id} not found",
        "error_code": ERROR_CODE_INTERNAL,
        "recoverable": False,
      }
      return

    # Resolve provider configs for agent path (supports multiple env keys)
    provider_configs = await self._resolve_provider_configs(db_session, user_id)

    # ---- Agent path (OpenAI-compatible providers) ----
    if provider_configs and self._can_use_agent(provider_configs[0].provider_type):
      _Runner = _get_runner()
      if _Runner is None:
        yield {
          "type": "error",
          "error": "OpenAI Agents SDK not installed. Please install openai-agents to use this provider.",
          "error_code": ERROR_CODE_NO_PROVIDER,
          "recoverable": False,
        }
        return
      try:
        provider_configs = await self._setup_byo_context(db_session, user_id)
        agent = create_paper_agent(paper)
        rc = build_run_config(
          provider_configs=provider_configs,
          model_hint=provider_configs[0].default_model or None,
        )

        await self._save_user_message(
          db_session, cast(int, chat_session.id), user_message, {}
        )

        full_content: list[str] = []
        had_error = False
        result = _Runner.run_streamed(agent, input=user_message, run_config=rc)
        async for adapted in adapt_stream(result, session_id=chat_session.id):
          if adapted["type"] == "chunk":
            full_content.append(adapted.get("content", ""))
          elif adapted["type"] == "error":
            had_error = True
          yield adapted

        if not had_error:
          response_text = "".join(full_content)
          assistant_msg = await self._save_assistant_message(
            db_session, cast(int, chat_session.id), response_text
          )
          yield {
            "type": "done",
            "content": response_text,
            "message_id": assistant_msg.id,
            "session_id": chat_session.id,
          }

      except Exception as e:
        logger.error(
          "Agent error in stream_message",
          error_type=type(e).__name__,
          error_message=str(e),
        )
        error_content = _build_error_message(e)
        error_code, recoverable = _classify_exception(e)
        await self._save_assistant_message(
          db_session, cast(int, chat_session.id), error_content
        )
        yield {
          "type": "error",
          "error": error_content,
          "error_code": error_code,
          "recoverable": recoverable,
        }
      return

    # ---- Legacy path (Gemini etc.) ----
    provider = await self._get_provider(db_session, user_id)
    if not provider:
      yield {
        "type": "error",
        "error": "AI provider not configured. Please configure your AI provider in settings.",
        "error_code": ERROR_CODE_NO_PROVIDER,
        "recoverable": False,
      }
      return

    try:
      context, resolved_refs, content_parts = await self._prepare_message_context(
        db_session, paper_id, user_message, references, chat_session
      )
    except ValueError as e:
      yield {
        "type": "error",
        "error": str(e),
        "error_code": ERROR_CODE_INTERNAL,
        "recoverable": False,
      }
      return

    await self._save_user_message(
      db_session, cast(int, chat_session.id), user_message, resolved_refs
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
        "AI provider error in stream_message",
        error_type=type(e).__name__,
        error_message=str(e),
      )
      error_content = _build_error_message(e)
      error_code, recoverable = _classify_exception(e)
      await self._save_assistant_message(
        db_session, cast(int, chat_session.id), error_content
      )
      yield {
        "type": "error",
        "error": error_content,
        "error_code": error_code,
        "recoverable": recoverable,
      }

  async def send_message(
    self,
    db_session: AsyncSession,
    paper_id: int,
    user_message: str,
    references: dict[str, Any] | None = None,
    session_id: int | None = None,
    user_id: int | None = None,
  ) -> ChatMessage | None:
    """Send a chat message and get a response (non-streaming).

    Uses agent framework for OpenAI-compatible providers, legacy path for others.
    """
    chat_session, session_error = await self._get_or_create_session(
      db_session, paper_id, session_id, user_id=user_id
    )
    if session_error or not chat_session:
      raise ValueError(session_error or "Failed to get session")

    provider_configs = await self._resolve_provider_configs(db_session, user_id)

    # ---- Agent path ----
    if provider_configs and self._can_use_agent(provider_configs[0].provider_type):
      _Runner = _get_runner()
      if _Runner is None:
        raise ValueError("OpenAI Agents SDK not installed. Please install openai-agents to use this provider.")
      paper = await self._fetch_paper(db_session, paper_id)
      if not paper:
        raise ValueError(f"Paper {paper_id} not found")
      try:
        provider_configs = await self._setup_byo_context(db_session, user_id)
        agent = create_paper_agent(paper)
        rc = build_run_config(
          provider_configs=provider_configs,
          model_hint=provider_configs[0].default_model or None,
        )

        await self._save_user_message(
          db_session, cast(int, chat_session.id), user_message, {}
        )

        result = await _Runner.run(agent, input=user_message, run_config=rc)
        response_text = result.final_output

        return await self._save_assistant_message(
          db_session, cast(int, chat_session.id), response_text
        )

      except Exception as e:
        logger.error(
          "Agent error in send_message",
          error_type=type(e).__name__,
          error_message=str(e),
        )
        error_content = _build_error_message(e)
        await self._save_assistant_message(
          db_session, cast(int, chat_session.id), error_content
        )
        raise ValueError(f"Failed to get AI response: {str(e)[:200]}") from e

    # ---- Legacy path ----
    provider = await self._get_provider(db_session, user_id)
    if not provider:
      raise ValueError(
        "AI provider not configured. Please configure your AI provider in settings."
      )
    paper = await self._fetch_paper(db_session, paper_id)
    if not paper:
      raise ValueError(f"Paper {paper_id} not found")

    context, resolved_refs, content_parts = await self._prepare_message_context(
      db_session, paper_id, user_message, references, chat_session
    )

    await self._save_user_message(
      db_session, cast(int, chat_session.id), user_message, resolved_refs
    )

    full_prompt = f"{context}\n\n## User Question:\n{user_message}"

    max_retries = 3
    base_delay = 1.0

    for attempt in range(max_retries):
      try:
        config = self._build_config(provider)
        text_with_citations = await provider.generate(full_prompt, config)
        return await self._save_assistant_message(
          db_session, cast(int, chat_session.id), text_with_citations
        )
      except RateLimitError as e:
        if attempt < max_retries - 1:
          retry_delay = base_delay * (2**attempt)
          await asyncio.sleep(retry_delay)
          continue
        error_content = _build_error_message(e)
        await self._save_assistant_message(
          db_session, cast(int, chat_session.id), error_content
        )
        raise ValueError("API rate limit exceeded. Please wait and try again.") from e
      except Exception as e:
        logger.error(
          "AI provider error in send_message",
          attempt=attempt + 1,
          error_type=type(e).__name__,
          error_message=str(e),
        )
        error_content = _build_error_message(e)
        await self._save_assistant_message(
          db_session, cast(int, chat_session.id), error_content
        )
        if isinstance(e, RateLimitError):
          raise ValueError("API rate limit exceeded. Please wait and try again.") from e
        raise ValueError(f"Failed to get AI response: {str(e)[:200]}") from e
    return None

  # ---- Thread Methods (unchanged) ----

  async def get_thread_messages(
    self, db_session: AsyncSession, parent_message_id: int
  ) -> list[ChatMessage]:
    query = (
      select(ChatMessage)
      .where(ChatMessage.parent_message_id == parent_message_id)
      .order_by(ChatMessage.created_at)
    )
    result = await db_session.execute(query)
    return list(result.scalars().all())

  async def get_thread_count(self, db_session: AsyncSession, message_id: int) -> int:
    from sqlalchemy import func

    query = select(func.count()).where(ChatMessage.parent_message_id == message_id)
    result = await db_session.execute(query)
    return result.scalar() or 0

  async def get_message_by_id(
    self, db_session: AsyncSession, message_id: int
  ) -> ChatMessage | None:
    query = select(ChatMessage).where(ChatMessage.id == message_id)
    result = await db_session.execute(query)
    return result.scalar_one_or_none()

  def build_thread_context(
    self,
    paper: Paper,
    parent_message: ChatMessage,
    thread_history: list[ChatMessage],
    use_file_context: bool = False,
  ) -> str:
    context_parts = self._build_context_header(paper)
    if not use_file_context:
      context_parts.append(self._build_context_content(paper))
    context_parts.append("\n## Original Message (you are replying to this):")
    context_parts.append(f"Assistant: {parent_message.content}")
    if thread_history:
      context_parts.append("\n## Thread Conversation:")
      for msg in thread_history[-5:]:
        role_label = "User" if msg.role == "user" else "Assistant"
        msg_content = msg.content[:500]
        if len(msg.content) > 500:
          msg_content += "..."
        context_parts.append(f"\n{role_label}: {msg_content}")
    return "\n".join(context_parts)

  async def _save_thread_message(
    self,
    db_session: AsyncSession,
    session_id: int,
    parent_message_id: int,
    role: str,
    content: str,
    references: dict[str, Any] | None = None,
  ) -> ChatMessage:
    msg = ChatMessage(
      session_id=session_id,
      parent_message_id=parent_message_id,
      role=role,
      content=content,
      references=references or {},
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)
    return msg

  async def stream_thread_message(
    self,
    db_session: AsyncSession,
    parent_message_id: int,
    user_message: str,
    references: dict[str, Any] | None = None,
    user_id: int | None = None,
  ) -> AsyncGenerator[dict[str, Any], None]:
    """Stream AI response for a thread message.

    Uses the legacy provider path since thread context building is
    tightly coupled to the manual prompt pattern.
    """
    provider = await self._get_provider(db_session, user_id)
    if not provider:
      yield {
        "type": "error",
        "error": "AI provider not configured. Please configure your AI provider in settings.",
        "error_code": ERROR_CODE_NO_PROVIDER,
        "recoverable": False,
      }
      return

    parent_message = await self.get_message_by_id(db_session, parent_message_id)
    if not parent_message:
      yield {
        "type": "error",
        "error": "Parent message not found",
        "error_code": ERROR_CODE_INTERNAL,
        "recoverable": False,
      }
      return

    if parent_message.role != "assistant":
      yield {
        "type": "error",
        "error": "Can only create threads on assistant messages",
        "error_code": ERROR_CODE_INTERNAL,
        "recoverable": False,
      }
      return

    session_id = parent_message.session_id
    chat_session = await self.get_session(db_session, session_id)
    if not chat_session:
      yield {
        "type": "error",
        "error": "Session not found",
        "error_code": ERROR_CODE_INTERNAL,
        "recoverable": False,
      }
      return

    paper_id = chat_session.paper_id
    paper = await self._fetch_paper(db_session, paper_id)
    if not paper:
      yield {
        "type": "error",
        "error": f"Paper {paper_id} not found",
        "error_code": ERROR_CODE_INTERNAL,
        "recoverable": False,
      }
      return

    thread_history = await self.get_thread_messages(db_session, parent_message_id)

    paper_content_parts = await content_provider.get_content_parts(paper)
    use_file_context = bool(paper_content_parts) and any(
      hasattr(p, "file_uri") for p in paper_content_parts
    )

    context = self.build_thread_context(
      paper, parent_message, thread_history, use_file_context=use_file_context
    )

    await self._save_thread_message(
      db_session, session_id, parent_message_id, "user", user_message, references
    )

    full_prompt = f"{context}\n\n## User Question (in thread):\n{user_message}"

    try:
      config = self._build_config(provider)
      full_content = await provider.generate(full_prompt, config)

      chunk_size = 50
      for i in range(0, len(full_content), chunk_size):
        chunk = full_content[i : i + chunk_size]
        yield {"type": "chunk", "content": chunk}

      assistant_msg = await self._save_thread_message(
        db_session, session_id, parent_message_id, "assistant", full_content
      )
      yield {
        "type": "done",
        "message_id": assistant_msg.id,
        "parent_message_id": parent_message_id,
      }

    except Exception as e:
      logger.error(
        "AI provider error in stream_thread_message",
        error_type=type(e).__name__,
        error_message=str(e),
      )
      error_content = _build_error_message(e)
      error_code, recoverable = _classify_exception(e)
      await self._save_thread_message(
        db_session, session_id, parent_message_id, "assistant", error_content
      )
      yield {
        "type": "error",
        "error": error_content,
        "error_code": error_code,
        "recoverable": recoverable,
      }

  async def send_thread_message(
    self,
    db_session: AsyncSession,
    parent_message_id: int,
    user_message: str,
    references: dict[str, Any] | None = None,
    user_id: int | None = None,
  ) -> tuple[ChatMessage, ChatMessage]:
    """Send a thread message and get AI response (non-streaming)."""
    provider = await self._get_provider(db_session, user_id)
    if not provider:
      raise ValueError(
        "AI provider not configured. Please configure your AI provider in settings."
      )

    parent_message = await self.get_message_by_id(db_session, parent_message_id)
    if not parent_message:
      raise ValueError("Parent message not found")
    if parent_message.role != "assistant":
      raise ValueError("Can only create threads on assistant messages")

    session_id = parent_message.session_id
    chat_session = await self.get_session(db_session, session_id)
    if not chat_session:
      raise ValueError("Session not found")

    paper_id = chat_session.paper_id
    paper = await self._fetch_paper(db_session, paper_id)
    if not paper:
      raise ValueError(f"Paper {paper_id} not found")

    thread_history = await self.get_thread_messages(db_session, parent_message_id)
    paper_content_parts = await content_provider.get_content_parts(paper)
    use_file_context = bool(paper_content_parts) and any(
      hasattr(p, "file_uri") for p in paper_content_parts
    )

    context = self.build_thread_context(
      paper, parent_message, thread_history, use_file_context=use_file_context
    )

    user_msg = await self._save_thread_message(
      db_session, session_id, parent_message_id, "user", user_message, references
    )

    full_prompt = f"{context}\n\n## User Question (in thread):\n{user_message}"

    try:
      config = self._build_config(provider)
      full_content = await provider.generate(full_prompt, config)
      assistant_msg = await self._save_thread_message(
        db_session, session_id, parent_message_id, "assistant", full_content
      )
      return user_msg, assistant_msg
    except Exception as e:
      logger.error(
        "AI provider error in send_thread_message",
        error_type=type(e).__name__,
        error_message=str(e),
      )
      error_content = _build_error_message(e)
      error_msg = await self._save_thread_message(
        db_session, session_id, parent_message_id, "assistant", error_content
      )
      return user_msg, error_msg


chat_service = ChatService()
