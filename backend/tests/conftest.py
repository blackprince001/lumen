"""Shared test fixtures for the papers backend."""

import pytest


@pytest.fixture
def sample_provider_configs():
  """Return a list of ProviderRouteConfig-like dicts for testing."""
  from app.services.ai.agent.multi_provider import ProviderRouteConfig

  return [
    ProviderRouteConfig(
      provider_type="openai",
      api_key="sk-test-openai",
      base_url="https://api.openai.com/v1",
      model_prefix="openai/",
      default_model="gpt-4o",
      is_active=True,
    ),
    ProviderRouteConfig(
      provider_type="anthropic",
      api_key="sk-test-anthropic",
      base_url="https://api.anthropic.com/v1",
      model_prefix="anthropic/",
      default_model="claude-sonnet-4-20250514",
      is_active=True,
    ),
    ProviderRouteConfig(
      provider_type="ollama",
      api_key="ollama",
      base_url="http://localhost:11434/v1",
      model_prefix="ollama/",
      default_model="llama3",
      is_active=True,
    ),
  ]


@pytest.fixture
def inactive_provider_config():
  from app.services.ai.agent.multi_provider import ProviderRouteConfig

  return ProviderRouteConfig(
    provider_type="deepseek",
    api_key="sk-test-deepseek",
    base_url="https://api.deepseek.com/v1",
    model_prefix="deepseek/",
    default_model="deepseek-chat",
    is_active=False,
  )
