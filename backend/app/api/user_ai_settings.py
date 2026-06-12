"""API endpoints for user AI provider settings."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.user_ai_settings import (
  create_user_ai_settings,
  delete_user_ai_settings,
  get_user_ai_settings,
  update_user_ai_settings,
)
from app.dependencies import CurrentUser, get_db
from app.schemas.user_ai_settings import (
  ProviderTypeInfo,
  UserAISettingsCreate,
  UserAISettingsResponse,
  UserAISettingsUpdate,
)
from app.services.ai.providers.registry import ai_provider_registry

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
  settings = await get_user_ai_settings(db_session, user.id)
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
  existing = await get_user_ai_settings(db_session, user.id)
  if existing:
    # Update existing with full replacement semantics
    existing.provider = data.provider
    if data.api_key:
      existing.set_api_key(data.api_key)
    existing.base_url = data.base_url
    existing.model = data.model
    existing.embedding_model = data.embedding_model
    existing.embedding_dimension = data.embedding_dimension
    await db_session.commit()
    await db_session.refresh(existing)
    return UserAISettingsResponse.model_validate(existing)

  settings = await create_user_ai_settings(db_session, user.id, data)
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
  settings = await update_user_ai_settings(db_session, user.id, data)
  if not settings:
    raise HTTPException(status_code=404, detail="AI settings not found")
  return UserAISettingsResponse.model_validate(settings)


@router.delete("/user/ai-settings", status_code=204)
async def delete_my_ai_settings(
  user: CurrentUser,
  db_session: AsyncSession = Depends(get_db),
):
  """Delete the current user's AI settings."""
  deleted = await delete_user_ai_settings(db_session, user.id)
  if not deleted:
    raise HTTPException(status_code=404, detail="AI settings not found")
  return None


@router.get(
  "/ai/providers",
  response_model=list[ProviderTypeInfo],
)
async def list_available_providers():
  """List all registered AI provider types."""
  return [ProviderTypeInfo(**info) for info in ai_provider_registry.list_types()]
