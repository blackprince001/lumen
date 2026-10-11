"""List the chat models a provider actually serves, using the user's own key.

Model IDs come straight from each provider's native ``/models`` endpoint, so
whatever we store is a name that provider's API accepts. Aggregator catalogs
(OpenRouter) use their own slugs and variant suffixes (``:batch``, ``:free``)
that the native APIs reject.
"""

from dataclasses import dataclass

import httpx

OPENAI_BASE_URL = "https://api.openai.com/v1"
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
ANTHROPIC_VERSION = "2023-06-01"

_DEFAULT_BASE_URLS = {
  "openai": OPENAI_BASE_URL,
  "deepseek": DEEPSEEK_BASE_URL,
}

# Substrings that mark non-chat models in OpenAI-style and Gemini listings.
_SKIP = (
  "embed",
  "whisper",
  "tts",
  "dall-e",
  "moderation",
  "audio",
  "realtime",
  "transcribe",
  "image",
  "imagen",
  "veo",
  "video",
  "search",
  "similarity",
  "edit",
  "davinci",
  "babbage",
  "curie",
  "ada",
  "instruct",
  "computer-use",
)
_KEEP_PREFIXES = ("gpt", "o1", "o3", "o4", "chat", "reasoner", "deepseek", "gemini")


class ModelListError(Exception):
  """The provider could not be asked for its models."""


@dataclass(frozen=True)
class ProviderModel:
  id: str
  name: str


def _is_chat_model(text: str) -> bool:
  lower = text.lower()
  if any(skip in lower for skip in _SKIP):
    return False
  return lower.startswith(_KEEP_PREFIXES)


async def _get_json(
  url: str, headers: dict[str, str], params: dict[str, str] | None = None
) -> dict:
  try:
    async with httpx.AsyncClient(timeout=15.0) as client:
      resp = await client.get(url, headers=headers, params=params)
  except httpx.HTTPError as e:
    raise ModelListError(f"Could not reach the provider: {e}") from e

  if resp.status_code in (401, 403):
    raise ModelListError("The provider rejected this API key")
  if resp.status_code == 429:
    raise ModelListError("Rate limited while listing models")
  if resp.status_code >= 300:
    raise ModelListError(f"Provider returned {resp.status_code} while listing models")
  try:
    return resp.json()
  except ValueError as e:
    raise ModelListError("Could not read the provider's model list") from e


async def _list_openai_style(
  base_url: str, api_key: str, filter_chat: bool
) -> list[ProviderModel]:
  headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
  body = await _get_json(base_url.rstrip("/") + "/models", headers)
  ids = [m.get("id", "") for m in body.get("data", [])]
  return [
    ProviderModel(id=i, name=i)
    for i in ids
    if i and (not filter_chat or _is_chat_model(i))
  ]


async def _list_anthropic(base_url: str, api_key: str) -> list[ProviderModel]:
  headers = {"x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION}
  body = await _get_json(
    base_url.rstrip("/") + "/models", headers, params={"limit": "1000"}
  )
  return [
    ProviderModel(id=m["id"], name=m.get("display_name") or m["id"])
    for m in body.get("data", [])
    if m.get("id")
  ]


async def _list_gemini(api_key: str) -> list[ProviderModel]:
  body = await _get_json(
    GEMINI_BASE_URL + "/models",
    {"x-goog-api-key": api_key},
    params={"pageSize": "1000"},
  )
  out: list[ProviderModel] = []
  for m in body.get("models", []):
    if "generateContent" not in m.get("supportedGenerationMethods", []):
      continue
    model_id = m.get("name", "").removeprefix("models/")
    name = m.get("displayName") or model_id
    if model_id and _is_chat_model(f"{model_id} {name}"):
      out.append(ProviderModel(id=model_id, name=name))
  return out


async def list_provider_models(
  provider: str, api_key: str, base_url: str | None = None
) -> list[ProviderModel]:
  """Return the chat models ``provider`` serves for this key, sorted by ID.

  Self-hosted/OpenAI-compatible endpoints are listed unfiltered, since their
  model names follow no common convention.
  """
  if provider == "gemini":
    models = await _list_gemini(api_key)
  elif provider == "anthropic":
    models = await _list_anthropic(base_url or ANTHROPIC_BASE_URL, api_key)
  elif provider in _DEFAULT_BASE_URLS:
    models = await _list_openai_style(
      base_url or _DEFAULT_BASE_URLS[provider], api_key, filter_chat=True
    )
  elif base_url:
    models = await _list_openai_style(base_url, api_key, filter_chat=False)
  else:
    raise ModelListError("A base URL is required to list models for this provider")

  return sorted(models, key=lambda m: m.id)
