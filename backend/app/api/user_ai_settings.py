"""API endpoints for user AI provider settings."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud.user_ai_settings import (
  create_user_ai_settings,
  delete_user_ai_settings,
  get_user_ai_settings,
  update_user_ai_settings,
)
from app.dependencies import CurrentUser, get_db
from app.schemas.user_ai_settings import (
  ProviderTestRequest,
  ProviderTestResponse,
  ProviderTypeInfo,
  UserAISettingsCreate,
  UserAISettingsResponse,
  UserAISettingsUpdate,
)
from app.services.ai.provider_factory import create_provider, list_provider_types
from app.services.ai.providers.base import GenerateConfig, ProviderConfig

router = APIRouter()


@router.get(
  "/user/ai-settings",
  response_model=UserAISettingsResponse | None,
)
async def get_my_ai_settings(
  user: CurrentUser,
  db_session: AsyncSession = Depends(get_db),
):
  """Get the current user's AI provider settings."""
  settings = await get_user_ai_settings(db_session, user.id)  # type: ignore[arg-type]
  if not settings:
    return None
  return UserAISettingsResponse.model_validate(settings)


@router.put(
  "/user/ai-settings",
  response_model=UserAISettingsResponse,
)
async def set_my_ai_settings(
  data: UserAISettingsCreate,
  user: CurrentUser,
  db_session: AsyncSession = Depends(get_db),
):
  """Create or fully replace the current user's AI settings."""
  existing = await get_user_ai_settings(db_session, user.id)  # type: ignore[arg-type]
  if existing:
    # Update existing with full replacement semantics
    existing.provider = data.provider  # type: ignore[assignment]
    if data.api_key:
      existing.set_api_key(data.api_key)
    existing.base_url = data.base_url  # type: ignore[assignment]
    existing.model = data.model  # type: ignore[assignment]
    await db_session.commit()
    await db_session.refresh(existing)
    return UserAISettingsResponse.model_validate(existing)

  settings = await create_user_ai_settings(db_session, user.id, data)  # type: ignore[arg-type]
  return UserAISettingsResponse.model_validate(settings)


@router.patch(
  "/user/ai-settings",
  response_model=UserAISettingsResponse,
)
async def update_my_ai_settings(
  data: UserAISettingsUpdate,
  user: CurrentUser,
  db_session: AsyncSession = Depends(get_db),
):
  """Partially update the current user's AI settings."""
  settings = await update_user_ai_settings(db_session, user.id, data)  # type: ignore[arg-type]
  if not settings:
    raise HTTPException(status_code=404, detail="AI settings not found")
  return UserAISettingsResponse.model_validate(settings)


@router.delete("/user/ai-settings", status_code=204)
async def delete_my_ai_settings(
  user: CurrentUser,
  db_session: AsyncSession = Depends(get_db),
):
  """Delete the current user's AI settings."""
  deleted = await delete_user_ai_settings(db_session, user.id)  # type: ignore[arg-type]
  if not deleted:
    raise HTTPException(status_code=404, detail="AI settings not found")
  return None


@router.get(
  "/ai/providers",
  response_model=list[ProviderTypeInfo],
)
async def list_available_providers():
  """List all registered AI provider types."""
  return [ProviderTypeInfo(**info) for info in list_provider_types()]


@router.post(
  "/ai/providers/test",
  response_model=ProviderTestResponse,
)
async def test_ai_provider(
  data: ProviderTestRequest,
):
  """Test a provider connection by sending a minimal request.

  Creates a temporary provider instance from the given config and attempts
  a single-token generation to verify the endpoint, API key, and model.
  """
  model = data.model or "gpt-4o"
  config = ProviderConfig(
    provider=data.provider,
    api_key=data.api_key,
    base_url=data.base_url,
    model=model,
  )
  instance = create_provider(data.provider, config)
  if instance is None:
    return ProviderTestResponse(
      success=False,
      message=f"Unknown provider type: {data.provider}",
    )

  try:
    await instance.generate(
      "Respond with a single word: ok", GenerateConfig(model=model, max_output_tokens=1)
    )
    return ProviderTestResponse(success=True, message="Connection successful")
  except Exception as e:
    return ProviderTestResponse(success=False, message=str(e))
