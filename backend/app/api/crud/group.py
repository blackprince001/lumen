"""Group CRUD functions."""

from typing import cast

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.crud.utils import ensure_loaded
from app.models.group import Group
from app.models.paper import Paper


async def get_group_or_404(
  session: AsyncSession,
  group_id: int,
  *,
  with_relations: bool = False,
  user_id: int | None = None,
) -> Group:
  query = select(Group).where(Group.id == group_id)
  if user_id is not None:
    query = query.where(Group.user_id == user_id)

  if with_relations:
    query = query.options(
      selectinload(Group.papers).selectinload(Paper.tags),
      selectinload(Group.children).selectinload(Group.papers).selectinload(Paper.tags),
    )

  result = await session.execute(query)
  group = result.scalar_one_or_none()

  if not group:
    raise HTTPException(status_code=404, detail="Group not found")

  if with_relations:
    ensure_loaded(group, "papers")

  return group


async def list_groups(session: AsyncSession, *, user_id: int | None = None) -> list[Group]:
  query = (
    select(Group)
    .options(
      selectinload(Group.papers).selectinload(Paper.tags),
      selectinload(Group.children).selectinload(Group.papers).selectinload(Paper.tags),
    )
    .order_by(Group.name)
  )
  if user_id is not None:
    query = query.where(Group.user_id == user_id)
  result = await session.execute(query)
  groups = list(result.scalars().all())

  for group in groups:
    ensure_loaded(group, "papers")

  return groups


async def create_group(
  session: AsyncSession,
  name: str,
  parent_id: int | None = None,
  user_id: int | None = None,
) -> Group:
  if parent_id is not None:
    await get_group_or_404(session, parent_id, user_id=user_id)

  query = select(Group).where(Group.name == name)
  if user_id is not None:
    query = query.where(Group.user_id == user_id)
  if parent_id is not None:
    query = query.where(Group.parent_id == parent_id)
  else:
    query = query.where(Group.parent_id.is_(None))

  existing = await session.execute(query)
  if existing.scalar_one_or_none():
    raise HTTPException(
      status_code=400,
      detail="Group with this name already exists in the specified parent",
    )

  group = Group(name=name, parent_id=parent_id, user_id=user_id)
  session.add(group)
  await session.commit()

  return await get_group_or_404(session, cast(int, group.id), with_relations=True, user_id=user_id)


async def update_group(
  session: AsyncSession,
  group_id: int,
  *,
  name: str | None = None,
  parent_id: int | None = None,
  user_id: int | None = None,
) -> Group:
  group = await get_group_or_404(session, group_id, user_id=user_id)

  new_parent_id = parent_id if parent_id is not None else group.parent_id

  # Handle parent_id update with cycle prevention
  if parent_id is not None and parent_id != group.parent_id:
    if new_parent_id is not None:
      await get_group_or_404(session, cast(int, new_parent_id), user_id=user_id)

    # Check for cycles
    if await _check_group_cycle(session, group_id, cast(int, new_parent_id)):
      raise HTTPException(
        status_code=400, detail="Cannot set parent: would create a cycle"
      )

    group.parent_id = new_parent_id

  # Handle name update
  if name is not None:
    query = select(Group).where(Group.name == name, Group.id != group_id)
    if user_id is not None:
      query = query.where(Group.user_id == user_id)
    if new_parent_id is not None:
      query = query.where(Group.parent_id == new_parent_id)
    else:
      query = query.where(Group.parent_id.is_(None))

    existing = await session.execute(query)
    if existing.scalar_one_or_none():
      raise HTTPException(
        status_code=400,
        detail="Group with this name already exists in the specified parent",
      )
    group.name = name

  await session.commit()

  return await get_group_or_404(session, group_id, with_relations=True, user_id=user_id)


async def delete_group(session: AsyncSession, group_id: int, *, user_id: int | None = None) -> None:
  query = (
    select(Group).options(selectinload(Group.children)).where(Group.id == group_id)
  )
  if user_id is not None:
    query = query.where(Group.user_id == user_id)
  result = await session.execute(query)
  group = result.scalar_one_or_none()

  if not group:
    raise HTTPException(status_code=404, detail="Group not found")

  if group.children and len(group.children) > 0:
    raise HTTPException(
      status_code=400,
      detail="Cannot delete group with sub-groups. Please delete or move sub-groups first.",
    )

  await session.delete(group)
  await session.commit()


async def _check_group_cycle(
  session: AsyncSession, group_id: int, new_parent_id: int
) -> bool:
  """Check if setting new_parent_id as parent would create a cycle."""
  if new_parent_id == group_id:
    return True

  current_parent_id = new_parent_id
  visited = {group_id}

  while current_parent_id is not None:
    if current_parent_id in visited:
      return True
    visited.add(current_parent_id)

    result = await session.execute(
      select(Group.parent_id).where(Group.id == current_parent_id)
    )
    current_parent_id = result.scalar_one_or_none()
    if current_parent_id == group_id:
      return True

  return False
