"""Groups API endpoints."""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import (
  create_group,
  delete_group,
  get_group_or_404,
  list_groups,
  update_group,
)
from app.dependencies import CurrentUser, get_db, scoped_user_id
from app.schemas.group import Group as GroupSchema
from app.schemas.group import GroupCreate, GroupUpdate

router = APIRouter()


@router.get("/groups", response_model=List[GroupSchema])
async def list_groups_endpoint(user: CurrentUser, session: AsyncSession = Depends(get_db)):
  groups = await list_groups(session, user_id=scoped_user_id(user))
  return [GroupSchema.model_validate(g) for g in groups]


@router.post("/groups", response_model=GroupSchema, status_code=201)
async def create_group_endpoint(
  group_in: GroupCreate, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  group = await create_group(session, group_in.name, group_in.parent_id, user_id=scoped_user_id(user))
  return GroupSchema.model_validate(group)


@router.get("/groups/{group_id}", response_model=GroupSchema)
async def get_group_endpoint(group_id: int, user: CurrentUser, session: AsyncSession = Depends(get_db)):
  group = await get_group_or_404(session, group_id, with_relations=True, user_id=scoped_user_id(user))
  return GroupSchema.model_validate(group)


@router.patch("/groups/{group_id}", response_model=GroupSchema)
async def update_group_endpoint(
  group_id: int, group_update: GroupUpdate, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  group = await update_group(
    session,
    group_id,
    name=group_update.name,
    parent_id=group_update.parent_id,
    user_id=scoped_user_id(user),
  )
  return GroupSchema.model_validate(group)


@router.delete("/groups/{group_id}", status_code=204)
async def delete_group_endpoint(group_id: int, user: CurrentUser, session: AsyncSession = Depends(get_db)):
  await delete_group(session, group_id, user_id=scoped_user_id(user))
  return None
