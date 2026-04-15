"""User management endpoints (admin-only)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.dependencies import AdminUser, get_db
from app.models.annotation import Annotation
from app.models.paper import Paper
from app.models.reading_session import ReadingSession
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.user import AdminUserUpdate, UserAnalytics, UserResponse

logger = get_logger(__name__)

router = APIRouter()


@router.get("/users", response_model=list[UserResponse])
async def list_users(
  admin: AdminUser,
  db: AsyncSession = Depends(get_db),
  page: int = Query(1, ge=1),
  page_size: int = Query(50, ge=1, le=200),
  search: str | None = None,
  role: str | None = None,
  is_active: bool | None = None,
):
  """List all users with filtering (admin only)."""
  query = select(User).order_by(User.created_at.desc())

  if search:
    query = query.where(
      User.display_name.ilike(f"%{search}%")
      | User.email.ilike(f"%{search}%")
      | User.organization.ilike(f"%{search}%")
    )
  if role:
    query = query.where(User.role == role)
  if is_active is not None:
    query = query.where(User.is_active == is_active)

  query = query.offset((page - 1) * page_size).limit(page_size)
  result = await db.execute(query)
  return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.get("/users/{user_id}", response_model=UserAnalytics)
async def get_user(
  user_id: int,
  admin: AdminUser,
  db: AsyncSession = Depends(get_db),
):
  """Get user details with analytics (admin only)."""
  result = await db.execute(select(User).where(User.id == user_id))
  user = result.scalar_one_or_none()
  if not user:
    raise HTTPException(status_code=404, detail="User not found")

  # Gather analytics
  papers_count = await db.scalar(
    select(func.count()).select_from(Paper).where(Paper.uploaded_by_id == user_id)
  )
  annotations_count = await db.scalar(
    select(func.count()).select_from(Annotation).where(Annotation.user_id == user_id)
  )
  total_reading = await db.scalar(
    select(func.coalesce(func.sum(ReadingSession.duration_minutes), 0))
    .select_from(ReadingSession)
    .where(ReadingSession.user_id == user_id)
  )

  return UserAnalytics(
    id=user.id,
    email=user.email,
    display_name=user.display_name,
    organization=user.organization,
    role=user.role,
    is_active=user.is_active,
    login_count=user.login_count or 0,
    last_login_at=user.last_login_at,
    papers_uploaded=papers_count or 0,
    annotations_count=annotations_count or 0,
    total_reading_minutes=total_reading or 0,
    created_at=user.created_at,
  )


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
  user_id: int,
  update: AdminUserUpdate,
  admin: AdminUser,
  db: AsyncSession = Depends(get_db),
):
  """Update user role or active status (admin only)."""
  result = await db.execute(select(User).where(User.id == user_id))
  user = result.scalar_one_or_none()
  if not user:
    raise HTTPException(status_code=404, detail="User not found")

  # Prevent self-deactivation
  if user.id == admin.id and update.is_active is False:
    raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

  update_data = update.model_dump(exclude_unset=True)

  if "role" in update_data and update_data["role"] not in ("user", "admin"):
    raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")

  for field, value in update_data.items():
    setattr(user, field, value)

  # If deactivating, revoke all refresh tokens
  if update.is_active is False:
    token_result = await db.execute(
      select(RefreshToken).where(
        RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
      )
    )
    for token in token_result.scalars().all():
      token.revoked_at = datetime.now(timezone.utc)

  await db.flush()
  return UserResponse.model_validate(user)


@router.delete("/users/{user_id}")
async def delete_user(
  user_id: int,
  admin: AdminUser,
  db: AsyncSession = Depends(get_db),
):
  """Delete a user (admin only)."""
  if user_id == admin.id:
    raise HTTPException(status_code=400, detail="Cannot delete yourself")

  result = await db.execute(select(User).where(User.id == user_id))
  user = result.scalar_one_or_none()
  if not user:
    raise HTTPException(status_code=404, detail="User not found")

  await db.delete(user)
  await db.flush()
  return {"detail": "User deleted"}
