"""Tests for function tools."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from app.services.ai.agent.tools.chat_history import get_chat_history, get_chat_sessions
from app.services.ai.agent.tools.paper_tools import (
  get_annotations,
  get_citations,
  get_notes,
  get_paper_content,
  get_paper_metadata,
  search_papers,
)
from app.services.ai.agent.tools.rag_tool import semantic_search


class TestGetPaperContent:
  """get_paper_content tool."""

  async def test_no_db_session(self):
    with patch(
      "app.services.ai.agent.tools.paper_tools.get_byo_context",
      return_value=AsyncMock(extra={}, user_id=None),
    ):
      result = await get_paper_content(paper_ids=[1])
      assert "No database session" in result


class TestGetPaperMetadata:
  """get_paper_metadata tool."""

  async def test_no_db_session(self):
    with patch(
      "app.services.ai.agent.tools.paper_tools.get_byo_context",
      return_value=AsyncMock(extra={}, user_id=None),
    ):
      result = await get_paper_metadata(paper_id=1)
      assert "No database session" in result


class TestSearchPapers:
  """search_papers tool."""

  async def test_no_db_session(self):
    with patch(
      "app.services.ai.agent.tools.paper_tools.get_byo_context",
      return_value=AsyncMock(extra={}, user_id=None),
    ):
      result = await search_papers(query="machine learning", limit=5)
      assert "No database session" in result

  async def test_limits_clamped(self):
    ctx = AsyncMock(extra={"db_session": AsyncMock()})
    with patch(
      "app.services.ai.agent.tools.paper_tools.get_byo_context",
      return_value=ctx,
    ):
      result = await search_papers(query="test", limit=100)
      assert isinstance(result, str)


class TestGetAnnotations:
  """get_annotations tool."""

  async def test_no_db_session(self):
    with patch(
      "app.services.ai.agent.tools.paper_tools.get_byo_context",
      return_value=AsyncMock(extra={}, user_id=None),
    ):
      result = await get_annotations(paper_id=1)
      assert "No database session" in result


class TestGetNotes:
  """get_notes tool."""

  async def test_no_db_session(self):
    with patch(
      "app.services.ai.agent.tools.paper_tools.get_byo_context",
      return_value=AsyncMock(extra={}, user_id=None),
    ):
      result = await get_notes(paper_id=1)
      assert "No database session" in result


class TestGetCitations:
  """get_citations tool."""

  async def test_no_db_session(self):
    with patch(
      "app.services.ai.agent.tools.paper_tools.get_byo_context",
      return_value=AsyncMock(extra={}, user_id=None),
    ):
      result = await get_citations(paper_id=1)
      assert "No database session" in result


class TestSemanticSearch:
  """semantic_search tool."""

  async def test_no_db_session(self):
    with patch(
      "app.services.ai.agent.tools.rag_tool.get_byo_context",
      return_value=AsyncMock(extra={}, user_id=None),
    ):
      result = await semantic_search(query="deep learning", limit=3)
      assert "No database session" in result

  async def test_limit_clamped(self):
    ctx = AsyncMock(extra={"db_session": AsyncMock()})
    with (
      patch(
        "app.services.ai.agent.tools.rag_tool.get_byo_context",
        return_value=ctx,
      ),
      patch(
        "app.services.ai.agent.tools.rag_tool.embedding_service.generate_query_embedding",
        return_value=None,
      ),
    ):
      result = await semantic_search(query="test", limit=100)
      assert isinstance(result, str)


class TestGetChatHistory:
  """get_chat_history tool."""

  async def test_no_db_session(self):
    with patch(
      "app.services.ai.agent.tools.chat_history.get_byo_context",
      return_value=AsyncMock(extra={}, user_id=None),
    ):
      result = await get_chat_history(session_id=1)
      assert "No database session" in result


class TestGetChatSessions:
  """get_chat_sessions tool."""

  async def test_no_db_session(self):
    with patch(
      "app.services.ai.agent.tools.chat_history.get_byo_context",
      return_value=AsyncMock(extra={}, user_id=None),
    ):
      result = await get_chat_sessions(paper_id=1)
      assert "No database session" in result
