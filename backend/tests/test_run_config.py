"""Tests for RunConfig builder functions."""

from __future__ import annotations

import pytest
from app.services.ai.agent.run_config import (
  build_run_config,
  build_run_config_for_local,
  build_simple_run_config,
)


class TestBuildRunConfig:
  """build_run_config with multiple provider configs."""

  def test_raises_on_empty_configs(self):
    with pytest.raises(ValueError, match="No active AI providers"):
      build_run_config(provider_configs=[])

  def test_resolves_first_default(self, sample_provider_configs):
    rc = build_run_config(provider_configs=sample_provider_configs, model_hint=None)
    assert rc is not None
    assert rc.model is not None

  def test_resolves_model_hint(self, sample_provider_configs):
    rc = build_run_config(
      provider_configs=sample_provider_configs, model_hint="openai/gpt-4o"
    )
    assert rc is not None

  def test_resolves_unknown_model_hint(self, sample_provider_configs):
    rc = build_run_config(
      provider_configs=sample_provider_configs, model_hint="unknown/model"
    )
    assert rc is not None

  def test_resolves_short_model_name(self, sample_provider_configs):
    rc = build_run_config(provider_configs=sample_provider_configs, model_hint="gpt-4o")
    assert rc is not None

  def test_temperature_passed_through(self, sample_provider_configs):
    rc = build_run_config(provider_configs=sample_provider_configs, temperature=0.3)
    assert rc is not None

  def test_max_tokens_passed_through(self, sample_provider_configs):
    rc = build_run_config(provider_configs=sample_provider_configs, max_tokens=2048)
    assert rc is not None


class TestBuildRunConfigForLocal:
  """build_run_config_for_local for local/self-hosted models."""

  def test_basic_local_config(self):
    rc = build_run_config_for_local(
      model_name="llama3",
      base_url="http://localhost:11434/v1",
    )
    assert rc.model == "llama3"
    assert rc is not None

  def test_custom_api_key_local(self):
    rc = build_run_config_for_local(
      model_name="mistral",
      base_url="http://192.168.1.50:11434/v1",
      api_key="custom-key",
    )
    assert rc.model == "mistral"

  def test_temperature_and_tokens(self):
    rc = build_run_config_for_local(
      model_name="llama3",
      base_url="http://localhost:11434/v1",
      temperature=0.5,
      max_tokens=1024,
    )
    assert rc is not None


class TestBuildSimpleRunConfig:
  """build_simple_run_config for single-provider setups."""

  def test_basic_simple_config(self):
    rc = build_simple_run_config(api_key="sk-test", model="gpt-4o")
    assert rc.model == "gpt-4o"
    assert rc is not None

  def test_custom_base_url(self):
    rc = build_simple_run_config(
      api_key="sk-test",
      model="gpt-4o",
      base_url="https://myproxy.example.com/v1",
    )
    assert rc is not None

  def test_default_model_is_gpt4o(self):
    rc = build_simple_run_config(api_key="sk-test")
    assert rc.model == "gpt-4o"
