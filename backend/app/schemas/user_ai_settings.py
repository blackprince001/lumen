"""Pydantic schemas for user AI provider settings."""

from datetime import datetime

from pydantic import BaseModel, Field


class UserAISettingsCreate(BaseModel):
  """Request schema for creating/updating AI settings."""

  provider: str = Field(
    default="openai-compatible",
    description="Provider type: 'gemini', 'openai-compatible'",
  )
  api_key: str = Field(default="", description="API key for the provider")
  base_url: str | None = Field(
    default=None, description="Base URL for OpenAI-compatible providers"
  )
  model: str = Field(default="", description="Model name for chat/generation")


class UserAISettingsUpdate(BaseModel):
  """Request schema for partial updates."""

  provider: str | None = None
  api_key: str | None = None
  base_url: str | None = None
  model: str | None = None


class UserAISettingsResponse(BaseModel):
  """Response schema (API key never returned)."""

  id: int
  user_id: int
  provider: str
  base_url: str | None = None
  model: str
  is_active: bool
  created_at: datetime
  updated_at: datetime

  model_config = {"from_attributes": True}


class ProviderTypeInfo(BaseModel):
  """Information about a registered provider type."""

  type: str
  display_name: str
  supports_grounding: bool


class ModelInfo(BaseModel):
  """A model available from a supported provider."""

  provider: str = Field(
    description="Internal provider type, e.g. 'openai', 'anthropic'"
  )
  model: str = Field(description="Raw model name sent to the API, e.g. 'gpt-4o'")
  name: str = Field(description="Human-readable display name")
  context_length: int = Field(description="Maximum context length in tokens")
  source: str = Field(
    description="'api' for closed-source API-only, 'self-hosted' for open-weight models"
  )


class ProviderTestRequest(BaseModel):
  """Request schema for testing a provider connection."""

  provider: str = Field(description="Provider type, e.g. 'openai', 'ollama'")
  api_key: str = Field(
    default="", description="API key (not required for local providers)"
  )
  base_url: str | None = Field(default=None, description="Base URL override")
  model: str = Field(default="", description="Model name to test with")


class ProviderTestResponse(BaseModel):
  """Result of a provider connection test."""

  success: bool
  message: str
