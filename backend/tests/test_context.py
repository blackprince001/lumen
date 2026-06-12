"""Tests for BYOContext and the per-request context var."""

from __future__ import annotations

from app.services.ai.agent.context import (
  BYOContext,
  get_byo_context,
  reset_byo_context,
  set_byo_context,
)
from app.services.ai.agent.multi_provider import ProviderRouteConfig


class TestBYOContext:
  """BYOContext dataclass."""

  def test_default_context(self):
    ctx = BYOContext()
    assert ctx.user_id is None
    assert ctx.provider_configs == []
    assert ctx.extra == {}

  def test_context_with_values(self):
    configs = [
      ProviderRouteConfig(provider_type="openai", api_key="sk-test"),
    ]
    ctx = BYOContext(
      user_id=42,
      provider_configs=configs,
      extra={"session_id": 123},
    )
    assert ctx.user_id == 42
    assert len(ctx.provider_configs) == 1
    assert ctx.extra["session_id"] == 123


class TestContextVar:
  """ContextVar get/set/reset."""

  def setUp(self):
    reset_byo_context()

  def test_get_returns_default(self):
    ctx = get_byo_context()
    assert ctx.user_id is None

  def test_set_and_get(self):
    ctx = BYOContext(user_id=99)
    set_byo_context(ctx)
    retrieved = get_byo_context()
    assert retrieved.user_id == 99

  def test_reset(self):
    set_byo_context(BYOContext(user_id=55))
    reset_byo_context()
    ctx = get_byo_context()
    assert ctx.user_id is None

  def test_isolation_between_contexts(self):
    set_byo_context(BYOContext(user_id=1))
    ctx1 = get_byo_context()

    set_byo_context(BYOContext(user_id=2))
    ctx2 = get_byo_context()

    assert ctx1.user_id == 1
    assert ctx2.user_id == 2
