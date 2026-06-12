"""Tests for the MultiProvider builder and route resolution."""

from __future__ import annotations

from app.services.ai.agent.multi_provider import (
  MultiProviderBuilder,
  ProviderRouteConfig,
  build_from_configs,
)


class TestProviderRouteConfig:
  """ProviderRouteConfig dataclass construction."""

  def test_default_values(self):
    cfg = ProviderRouteConfig(provider_type="openai", api_key="sk-test")
    assert cfg.provider_type == "openai"
    assert cfg.api_key == "sk-test"
    assert cfg.base_url is None
    assert cfg.model_prefix == ""
    assert cfg.default_model == ""
    assert cfg.is_active is True

  def test_custom_values(self):
    cfg = ProviderRouteConfig(
      provider_type="anthropic",
      api_key="sk-ant-test",
      base_url="https://api.anthropic.com/v1",
      model_prefix="anthropic/",
      default_model="claude-sonnet-4-20250514",
      is_active=True,
    )
    assert cfg.provider_type == "anthropic"
    assert cfg.default_model == "claude-sonnet-4-20250514"


class TestMultiProviderBuilder:
  """MultiProviderBuilder: registration and build."""

  def test_builder_initialises_empty(self):
    builder = MultiProviderBuilder()
    assert builder.provider_list == []

  def test_add_openai(self):
    builder = MultiProviderBuilder()
    builder.add_openai(api_key="sk-test")
    assert len(builder.provider_list) == 1
    assert builder.provider_list[0].provider_type == "openai"
    assert builder.provider_list[0].model_prefix == "openai/"

  def test_add_anthropic(self):
    builder = MultiProviderBuilder()
    builder.add_anthropic(api_key="sk-ant-test")
    assert builder.provider_list[0].provider_type == "anthropic"
    assert builder.provider_list[0].model_prefix == "anthropic/"

  def test_add_deepseek(self):
    builder = MultiProviderBuilder()
    builder.add_deepseek(api_key="sk-deep-test")
    assert builder.provider_list[0].provider_type == "deepseek"
    assert builder.provider_list[0].model_prefix == "deepseek/"

  def test_add_ollama(self):
    builder = MultiProviderBuilder()
    builder.add_ollama(base_url="http://192.168.1.50:11434/v1")
    assert builder.provider_list[0].provider_type == "ollama"
    assert builder.provider_list[0].model_prefix == "ollama/"

  def test_add_vllm(self):
    builder = MultiProviderBuilder()
    builder.add_vllm(base_url="http://192.168.1.51:8000/v1")
    assert builder.provider_list[0].provider_type == "vllm"
    assert builder.provider_list[0].model_prefix == "vllm/"

  def test_add_custom(self):
    builder = MultiProviderBuilder()
    builder.add_custom(
      api_key="sk-custom",
      base_url="https://custom.example.com/v1",
      model_prefix="myprovider/",
      default_model="my-model",
    )
    prov = builder.provider_list[0]
    assert prov.provider_type == "openai-compatible"
    assert prov.model_prefix == "myprovider/"

  def test_add_multiple_providers(self):
    builder = MultiProviderBuilder()
    builder.add_openai(api_key="sk-openai")
    builder.add_anthropic(api_key="sk-anthropic")
    builder.add_ollama()
    assert len(builder.provider_list) == 3
    prefixes = [p.model_prefix for p in builder.provider_list]
    assert prefixes == ["openai/", "anthropic/", "ollama/"]

  def test_provider_list_is_copy(self):
    builder = MultiProviderBuilder()
    builder.add_openai(api_key="sk-test")
    plist = builder.provider_list
    assert len(plist) == 1
    assert len(builder.provider_list) == 1


class TestModelResolution:
  """Prefix matching and model name resolution."""

  def test_get_prefix_for_model_matches(self):
    builder = MultiProviderBuilder()
    builder.add_openai(api_key="sk-test")
    builder.add_ollama()
    assert builder.get_prefix_for_model("openai/gpt-4o") == "openai/"
    assert builder.get_prefix_for_model("ollama/llama3") == "ollama/"

  def test_get_prefix_for_model_no_match(self):
    builder = MultiProviderBuilder()
    builder.add_openai(api_key="sk-test")
    assert builder.get_prefix_for_model("unknown/model") is None

  def test_resolve_model_name_strips_prefix(self):
    builder = MultiProviderBuilder()
    builder.add_openai(api_key="sk-test")
    assert builder.resolve_model_name("openai/gpt-4o") == "gpt-4o"

  def test_resolve_model_name_no_prefix(self):
    builder = MultiProviderBuilder()
    assert builder.resolve_model_name("gpt-4o") == "gpt-4o"


class TestBuildFromConfigs:
  """build_from_configs convenience function."""

  def test_build_from_active_configs(self, sample_provider_configs):
    mp = build_from_configs(sample_provider_configs)
    assert mp is not None

  def test_build_from_empty_list(self):
    mp = build_from_configs([])
    assert mp is not None

  def test_build_skips_inactive(self, inactive_provider_config):
    mp = build_from_configs([inactive_provider_config])
    assert mp is not None


class TestProviderDefaults:
  """Default base URLs and model prefixes."""

  def test_openai_default_base_url(self):
    builder = MultiProviderBuilder()
    builder.add_openai(api_key="sk-test")
    client = builder.provider_list[0].openai_client
    assert "api.openai.com" in str(client.base_url)

  def test_ollama_default_base_url(self):
    builder = MultiProviderBuilder()
    builder.add_ollama()
    client = builder.provider_list[0].openai_client
    assert "localhost:11434" in str(client.base_url)

  def test_custom_base_url_overrides_default(self):
    builder = MultiProviderBuilder()
    builder.add_openai(api_key="sk-test", base_url="https://myproxy.example.com/v1")
    client = builder.provider_list[0].openai_client
    assert "myproxy.example.com" in str(client.base_url)
