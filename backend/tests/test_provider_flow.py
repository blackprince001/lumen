"""End-to-end provider flow tests.

These guard the BYO-provider plumbing that powers chat and discovery:

1. ``build_run_config`` must construct a working ``MultiProvider`` for any
   selected provider without raising (regression test for the
   ``'MultiProvider' object has no attribute 'add_provider'`` bug).
2. The resolved model must route to the correct client/endpoint and use the
   right transport — Chat Completions for OpenAI-compatible providers
   (DeepSeek, Ollama, vLLM, custom), Responses API only for real OpenAI.
3. An opt-in live test runs a real agent against DeepSeek to exercise the
   whole chat flow (provider resolution → run config → streamed run).
   Set ``DEEPSEEK_TEST_KEY`` to enable it.
"""

from __future__ import annotations

import asyncio
import os

import pytest
from app.services.ai.agent.multi_provider import (
  ProviderRouteConfig,
)
from app.services.ai.agent.run_config import build_run_config


def _model_class_name(run_config, model_str: str) -> str:
  model = run_config.model_provider.get_model(model_str)
  return type(model).__name__


def _model_client_base_url(run_config, model_str: str) -> str:
  model = run_config.model_provider.get_model(model_str)
  return str(model._client.base_url)


# (provider_type, default_model, base_url, expected base_url fragment)
PROVIDER_CASES = [
  ("openai", "gpt-4o", None, "api.openai.com"),
  ("deepseek", "deepseek-chat", None, "api.deepseek.com"),
  ("anthropic", "claude-sonnet-4-20250514", None, "api.anthropic.com"),
  ("ollama", "llama3", "http://localhost:11434/v1", "localhost:11434"),
  ("vllm", "mistral", "http://localhost:8000/v1", "localhost:8000"),
  (
    "openai-compatible",
    "my-model",
    "https://proxy.example.com/v1",
    "proxy.example.com",
  ),
]


class TestProviderRouting:
  """Each selected provider builds a usable, correctly-routed RunConfig."""

  @pytest.mark.parametrize(
    "provider_type,default_model,base_url,expected_url", PROVIDER_CASES
  )
  def test_build_run_config_does_not_raise(
    self, provider_type, default_model, base_url, expected_url
  ):
    # Regression: build() used to call MultiProvider.add_provider (removed
    # from the SDK), raising AttributeError for every provider.
    cfg = ProviderRouteConfig(
      provider_type=provider_type,
      api_key="sk-test-key",
      base_url=base_url,
      default_model=default_model,
    )
    rc = build_run_config(provider_configs=[cfg], model_hint=cfg.default_model or None)
    assert rc is not None
    assert rc.model

  @pytest.mark.parametrize(
    "provider_type,default_model,base_url,expected_url", PROVIDER_CASES
  )
  def test_routes_to_correct_endpoint(
    self, provider_type, default_model, base_url, expected_url
  ):
    cfg = ProviderRouteConfig(
      provider_type=provider_type,
      api_key="sk-test-key",
      base_url=base_url,
      default_model=default_model,
    )
    rc = build_run_config(provider_configs=[cfg], model_hint=cfg.default_model)
    assert expected_url in _model_client_base_url(rc, rc.model)

  @pytest.mark.parametrize(
    "provider_type,default_model,base_url,expected_url", PROVIDER_CASES
  )
  def test_transport_matches_provider(
    self, provider_type, default_model, base_url, expected_url
  ):
    # Only real OpenAI gets the Responses API; everyone else must use
    # Chat Completions or the request 404s/400s against their endpoint.
    cfg = ProviderRouteConfig(
      provider_type=provider_type,
      api_key="sk-test-key",
      base_url=base_url,
      default_model=default_model,
    )
    rc = build_run_config(provider_configs=[cfg], model_hint=cfg.default_model)
    cls = _model_class_name(rc, rc.model)
    if provider_type == "openai":
      assert cls == "OpenAIResponsesModel"
    else:
      assert cls == "OpenAIChatCompletionsModel"

  def test_model_name_strips_prefix(self):
    cfg = ProviderRouteConfig(
      provider_type="deepseek",
      api_key="sk-test-key",
      default_model="deepseek-chat",
    )
    rc = build_run_config(provider_configs=[cfg], model_hint="deepseek/deepseek-chat")
    model = rc.model_provider.get_model(rc.model)
    assert model.model == "deepseek-chat"


class TestFallbackChainRouteConfigs:
  """The fallback runner builds a RunConfig per ResolvedProvider route."""

  def test_each_route_builds_independently(self):
    routes = [
      ProviderRouteConfig(
        provider_type=pt, api_key="sk-x", base_url=bu, default_model=dm
      )
      for pt, dm, bu, _ in PROVIDER_CASES
    ]
    for route in routes:
      rc = build_run_config(
        provider_configs=[route], model_hint=route.default_model or None
      )
      assert rc is not None


# ── Live test (opt-in) ────────────────────────────────────────────────────

DEEPSEEK_TEST_KEY = os.environ.get("DEEPSEEK_TEST_KEY")


@pytest.mark.skipif(
  not DEEPSEEK_TEST_KEY,
  reason="Set DEEPSEEK_TEST_KEY to run the live DeepSeek agent flow test",
)
def test_live_deepseek_agent_stream():
  """Run a real agent against DeepSeek and assert we get streamed text.

  Exercises the full chat path: provider route → run config → SDK Runner
  streamed run → stream adapter output.
  """
  from agents import Agent, Runner
  from app.services.ai.agent import adapt_stream

  cfg = ProviderRouteConfig(
    provider_type="deepseek",
    api_key=DEEPSEEK_TEST_KEY,
    default_model="deepseek-chat",
  )
  run_config = build_run_config(
    provider_configs=[cfg], model_hint="deepseek/deepseek-chat"
  )

  agent = Agent(
    name="Test Assistant",
    instructions="You are a helpful assistant. Answer in one short sentence.",
  )

  async def _run() -> tuple[str, bool]:
    result = Runner.run_streamed(
      agent, input="Say the word 'pong' and nothing else.", run_config=run_config
    )
    text = ""
    saw_error = False
    async for adapted in adapt_stream(result, session_id=None):
      if adapted.get("type") == "chunk":
        text += adapted.get("content", "")
      elif adapted.get("type") == "error":
        saw_error = True
        text = adapted.get("error", "")
    return text, saw_error

  text, saw_error = asyncio.run(_run())
  assert not saw_error, f"Agent stream errored: {text}"
  assert text.strip(), "Expected non-empty streamed response from DeepSeek"
