"""Tests for the streaming event adapter."""

from __future__ import annotations

from typing import Any, AsyncIterator

from app.services.ai.agent.stream_adapter import (
  _classify_event,
  adapt_stream,
)


class MockEvent:
  """Minimal mock for SDK streaming events."""

  def __init__(self, event_cls: str, **kwargs: Any) -> None:
    self._event_cls = event_cls
    for k, v in kwargs.items():
      setattr(self, k, v)

  @property
  def __class__(self):
    return type("MockClass", (), {"__name__": self._event_cls})()


class MockRunResultStreaming:
  """Minimal mock for RunResultStreaming."""

  def __init__(self, events: list[MockEvent]) -> None:
    self._events = events

  async def stream_events(self) -> AsyncIterator[MockEvent]:
    for event in self._events:
      yield event


class TestClassifyEvent:
  """Event classification."""

  def test_text_delta(self):
    event = MockEvent("AgentTextDelta", delta="Hello")
    assert _classify_event(event) == "text_delta"

  def test_tool_call(self):
    event = MockEvent("ToolCall", tool_name="search", arguments={})
    assert _classify_event(event) == "tool_call"

  def test_tool_result(self):
    event = MockEvent("ToolResult", tool_name="search", result="found")
    assert _classify_event(event) == "tool_result"

  def test_thought(self):
    event = MockEvent("Thought", content="I need to think...")
    assert _classify_event(event) == "thought"

  def test_error(self):
    event = MockEvent("Error", message="Something broke")
    assert _classify_event(event) == "error"

  def test_unknown(self):
    event = MockEvent("UnknownEvent")
    assert _classify_event(event) == "unknown"


class TestAdaptStream:
  """Full stream adaptation."""

  async def test_text_chunks_yielded(self):
    events = [
      MockEvent("AgentTextDelta", delta="Hello "),
      MockEvent("AgentTextDelta", delta="World"),
    ]
    stream = MockRunResultStreaming(events)
    results = []
    async for chunk in adapt_stream(stream, session_id=1, message_id=10):
      results.append(chunk)

    assert len(results) == 3
    assert results[0] == {"type": "chunk", "content": "Hello "}
    assert results[1] == {"type": "chunk", "content": "World"}
    assert results[2]["type"] == "done"
    assert results[2]["message_id"] == 10
    assert results[2]["session_id"] == 1
    assert results[2]["content"] == "Hello World"

  async def test_error_stops_stream(self):
    events = [
      MockEvent("AgentTextDelta", delta="Starting..."),
      MockEvent("Error", message="Rate limit hit"),
    ]
    stream = MockRunResultStreaming(events)
    results = []
    async for chunk in adapt_stream(stream):
      results.append(chunk)

    assert len(results) == 2
    assert results[0]["type"] == "chunk"
    assert results[1] == {"type": "error", "error": "Rate limit hit"}

  async def test_empty_stream(self):
    stream = MockRunResultStreaming([])
    results = []
    async for chunk in adapt_stream(stream, session_id=5, message_id=20):
      results.append(chunk)

    assert len(results) == 1
    assert results[0]["type"] == "done"
    assert results[0]["session_id"] == 5
    assert results[0]["message_id"] == 20

  async def test_tool_call_and_result(self):
    events = [
      MockEvent("ToolCall", tool_name="search_papers", arguments={"query": "test"}),
      MockEvent("ToolResult", tool_name="search_papers", result="found 3 papers"),
      MockEvent("AgentTextDelta", delta="Here are the results."),
    ]
    stream = MockRunResultStreaming(events)
    results = []
    async for chunk in adapt_stream(stream, session_id=1):
      results.append(chunk)

    assert results[0]["type"] == "tool_call"
    assert results[0]["tool"] == "search_papers"
    assert results[1]["type"] == "tool_result"
    assert results[2]["type"] == "chunk"
    assert results[3]["type"] == "done"
