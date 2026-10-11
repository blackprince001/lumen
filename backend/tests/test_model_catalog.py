"""Model lists come from each provider's own API, so saved names are valid."""

from __future__ import annotations

import asyncio

import httpx
import pytest
from app.services.ai import model_catalog
from app.services.ai.model_catalog import ModelListError, list_provider_models


def _serve(monkeypatch, handler):
  """Route the catalog's HTTP calls to ``handler`` and record requests."""
  seen: list[httpx.Request] = []
  real_client = httpx.AsyncClient

  def record(request: httpx.Request) -> httpx.Response:
    seen.append(request)
    return handler(request)

  monkeypatch.setattr(
    model_catalog.httpx,
    "AsyncClient",
    lambda **kw: real_client(transport=httpx.MockTransport(record), **kw),
  )
  return seen


def _ids(models) -> list[str]:
  return [m.id for m in models]


def test_deepseek_lists_native_ids_from_its_own_api(monkeypatch):
  seen = _serve(
    monkeypatch,
    lambda r: httpx.Response(
      200, json={"data": [{"id": "deepseek-v4-pro"}, {"id": "deepseek-flash"}]}
    ),
  )

  models = asyncio.run(list_provider_models("deepseek", "sk-test"))

  assert _ids(models) == ["deepseek-flash", "deepseek-v4-pro"]
  assert str(seen[0].url) == "https://api.deepseek.com/v1/models"
  assert seen[0].headers["authorization"] == "Bearer sk-test"


def test_openai_listing_drops_non_chat_models(monkeypatch):
  _serve(
    monkeypatch,
    lambda r: httpx.Response(
      200,
      json={
        "data": [
          {"id": "gpt-5"},
          {"id": "text-embedding-3-small"},
          {"id": "whisper-1"},
          {"id": "o4-mini"},
        ]
      },
    ),
  )

  models = asyncio.run(list_provider_models("openai", "sk-test"))

  assert _ids(models) == ["gpt-5", "o4-mini"]


def test_anthropic_uses_display_names_and_its_auth_headers(monkeypatch):
  seen = _serve(
    monkeypatch,
    lambda r: httpx.Response(
      200, json={"data": [{"id": "claude-x-1", "display_name": "Claude X"}]}
    ),
  )

  models = asyncio.run(list_provider_models("anthropic", "sk-ant"))

  assert [(m.id, m.name) for m in models] == [("claude-x-1", "Claude X")]
  assert seen[0].headers["x-api-key"] == "sk-ant"
  assert "anthropic-version" in seen[0].headers


def test_gemini_keeps_only_generate_content_chat_models(monkeypatch):
  seen = _serve(
    monkeypatch,
    lambda r: httpx.Response(
      200,
      json={
        "models": [
          {
            "name": "models/gemini-3-flash",
            "displayName": "Gemini 3 Flash",
            "supportedGenerationMethods": ["generateContent"],
          },
          {
            "name": "models/gemini-embedding-001",
            "supportedGenerationMethods": ["embedContent"],
          },
        ]
      },
    ),
  )

  models = asyncio.run(list_provider_models("gemini", "AIza-test"))

  assert _ids(models) == ["gemini-3-flash"]
  assert "AIza-test" not in str(seen[0].url)


def test_self_hosted_lists_everything_at_its_base_url(monkeypatch):
  seen = _serve(
    monkeypatch, lambda r: httpx.Response(200, json={"data": [{"id": "llama3"}]})
  )

  models = asyncio.run(list_provider_models("ollama", "", "http://localhost:11434/v1"))

  assert _ids(models) == ["llama3"]
  assert str(seen[0].url) == "http://localhost:11434/v1/models"


def test_rejected_key_raises_a_readable_error(monkeypatch):
  _serve(monkeypatch, lambda r: httpx.Response(401, json={}))

  with pytest.raises(ModelListError, match="rejected this API key"):
    asyncio.run(list_provider_models("deepseek", "bad"))


def test_self_hosted_without_base_url_is_an_error():
  with pytest.raises(ModelListError, match="base URL"):
    asyncio.run(list_provider_models("openai-compatible", ""))
