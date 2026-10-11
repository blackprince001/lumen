"""API endpoints for managing a user's AI providers (multi-provider BYO)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud.user_ai_provider import (
  create_user_ai_provider,
  delete_user_ai_provider,
  get_user_ai_provider,
  list_user_ai_providers,
  set_default_provider,
  update_user_ai_provider,
)
from app.dependencies import CurrentUser, get_db
from app.schemas.user_ai_provider import (
  ProviderModel,
  ProviderModelsRequest,
  ProviderModelsResponse,
  UserAIProviderCreate,
  UserAIProviderResponse,
  UserAIProviderUpdate,
)
from app.services.ai.model_catalog import ModelListError, list_provider_models

router = APIRouter()

# Hosted providers whose model must be one their API lists. Self-hosted
# endpoints are trusted as typed, since they may not expose /models.
_VALIDATED_PROVIDERS = {"openai", "anthropic", "deepseek", "gemini"}


async def _ensure_model_offered(
  provider: str, api_key: str, base_url: str | None, model: str
) -> None:
  """Reject a model the provider's own API does not list."""
  if provider not in _VALIDATED_PROVIDERS or not model:
    return
  try:
    models = await list_provider_models(provider, api_key, base_url)
  except ModelListError as e:
    raise HTTPException(status_code=502, detail=str(e)) from e
  if model not in {m.id for m in models}:
    raise HTTPException(
      status_code=422,
      detail=f"{provider} does not offer the model '{model}'. Pick one from the list.",
    )


@router.post(
  "/user/ai-providers/models",
  response_model=ProviderModelsResponse,
)
async def list_models_for_provider(
  data: ProviderModelsRequest,
  user: CurrentUser,
  db_session: AsyncSession = Depends(get_db),
):
  """List the models a provider serves, asked of that provider directly."""
  api_key = data.api_key
  if not api_key and data.provider_id is not None:
    saved = await get_user_ai_provider(db_session, user.id, data.provider_id)  # type: ignore[arg-type]
    if not saved:
      raise HTTPException(status_code=404, detail="Provider not found")
    api_key = saved.get_api_key()

  try:
    models = await list_provider_models(data.provider, api_key, data.base_url)
  except ModelListError as e:
    raise HTTPException(status_code=502, detail=str(e)) from e
  return ProviderModelsResponse(
    models=[ProviderModel(id=m.id, name=m.name) for m in models]
  )


@router.get(
  "/user/ai-providers",
  response_model=list[UserAIProviderResponse],
)
async def list_my_ai_providers(
  user: CurrentUser,
  db_session: AsyncSession = Depends(get_db),
):
  """List all of the current user's saved AI providers."""
  providers = await list_user_ai_providers(db_session, user.id)  # type: ignore[arg-type]
  return [UserAIProviderResponse.model_validate(p) for p in providers]


@router.post(
  "/user/ai-providers",
  response_model=UserAIProviderResponse,
  status_code=201,
)
async def create_my_ai_provider(
  data: UserAIProviderCreate,
  user: CurrentUser,
  db_session: AsyncSession = Depends(get_db),
):
  """Create a new AI provider for the current user."""
  await _ensure_model_offered(data.provider, data.api_key, data.base_url, data.model)
  provider = await create_user_ai_provider(db_session, user.id, data)  # type: ignore[arg-type]
  return UserAIProviderResponse.model_validate(provider)


@router.patch(
  "/user/ai-providers/{provider_id}",
  response_model=UserAIProviderResponse,
)
async def update_my_ai_provider(
  provider_id: int,
  data: UserAIProviderUpdate,
  user: CurrentUser,
  db_session: AsyncSession = Depends(get_db),
):
  """Partially update one of the current user's AI providers."""
  fields = data.model_fields_set
  if fields & {"provider", "model", "base_url", "api_key"}:
    existing = await get_user_ai_provider(db_session, user.id, provider_id)  # type: ignore[arg-type]
    if not existing:
      raise HTTPException(status_code=404, detail="Provider not found")
    await _ensure_model_offered(
      data.provider or str(existing.provider),
      data.api_key or existing.get_api_key(),
      data.base_url if "base_url" in fields else existing.base_url,  # type: ignore[arg-type]
      data.model if data.model is not None else str(existing.model),
    )
  provider = await update_user_ai_provider(db_session, user.id, provider_id, data)  # type: ignore[arg-type]
  if not provider:
    raise HTTPException(status_code=404, detail="Provider not found")
  return UserAIProviderResponse.model_validate(provider)


@router.put(
  "/user/ai-providers/{provider_id}/default",
  response_model=UserAIProviderResponse,
)
async def set_my_default_ai_provider(
  provider_id: int,
  user: CurrentUser,
  db_session: AsyncSession = Depends(get_db),
):
  """Mark one of the current user's providers as the default."""
  provider = await set_default_provider(db_session, user.id, provider_id)  # type: ignore[arg-type]
  if not provider:
    raise HTTPException(status_code=404, detail="Provider not found")
  return UserAIProviderResponse.model_validate(provider)


@router.delete("/user/ai-providers/{provider_id}", status_code=204)
async def delete_my_ai_provider(
  provider_id: int,
  user: CurrentUser,
  db_session: AsyncSession = Depends(get_db),
):
  """Delete one of the current user's AI providers."""
  deleted = await delete_user_ai_provider(db_session, user.id, provider_id)  # type: ignore[arg-type]
  if not deleted:
    raise HTTPException(status_code=404, detail="Provider not found")
  return None
