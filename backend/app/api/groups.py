"""Groups API endpoints."""

from datetime import datetime
from typing import List, cast

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.crud import (
  create_group,
  delete_group,
  get_visible_group_or_404,
  list_groups,
  update_group,
)
from app.api.crud.enrichment import enrich_paper_with_user_state
from app.api.crud.user_paper_state import batch_get_states
from app.dependencies import CurrentUser, get_db, scoped_user_id
from app.models.group import Group
from app.models.sharing import GroupShare
from app.models.user import User
from app.schemas.group import Group as GroupSchema
from app.schemas.group import GroupCreate, GroupUpdate
from app.schemas.sharing import (
  ShareListResponse,
  ShareRecipient,
  ShareRequest,
  ShareUpdate,
)

router = APIRouter()


def _serialize_group_share(share: GroupShare) -> ShareRecipient:
  recipient = cast(User, share.recipient)
  return ShareRecipient(
    user_id=cast(int, recipient.id),
    email=cast(str, recipient.email),
    display_name=cast(str, recipient.display_name),
    permission=cast(str, share.permission),
    shared_by_id=cast(int | None, share.shared_by_id),
    created_at=cast(datetime, share.created_at),
  )


def _collect_group_paper_ids(group: Group) -> set[int]:
  paper_ids = {cast(int, paper.id) for paper in group.papers or [] if paper.id is not None}
  for child in group.children or []:
    paper_ids.update(_collect_group_paper_ids(child))
  return paper_ids


def _group_to_schema(group: Group, user_states: dict[int, object]) -> GroupSchema:
  data = GroupSchema.model_validate(group).model_dump()
  data["papers"] = [
    enrich_paper_with_user_state(paper, user_states.get(cast(int, paper.id)))
    for paper in group.papers or []
  ]
  data["children"] = [
    _group_to_schema(child, user_states)
    for child in group.children or []
  ]
  return GroupSchema(**data)


async def _get_owned_group_or_403(
  session: AsyncSession, group_id: int, user: CurrentUser
) -> Group:
  result = await session.execute(select(Group).where(Group.id == group_id))
  group = result.scalar_one_or_none()
  if not group:
    raise HTTPException(status_code=404, detail="Group not found")
  if group.user_id != user.id:
    raise HTTPException(status_code=403, detail="Only the group owner can manage shares")
  return group


@router.get("/groups", response_model=List[GroupSchema])
async def list_groups_endpoint(user: CurrentUser, session: AsyncSession = Depends(get_db)):
  user_id = scoped_user_id(user)
  groups = await list_groups(session, user_id=user_id)
  paper_ids = sorted({paper_id for group in groups for paper_id in _collect_group_paper_ids(group)})
  user_states = await batch_get_states(session, user_id, paper_ids) if user_id is not None else {}
  return [_group_to_schema(group, user_states) for group in groups]


@router.post("/groups", response_model=GroupSchema, status_code=201)
async def create_group_endpoint(
  group_in: GroupCreate, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  user_id = scoped_user_id(user)
  group = await create_group(session, group_in.name, group_in.parent_id, user_id=user_id)
  paper_ids = sorted(_collect_group_paper_ids(group))
  user_states = await batch_get_states(session, user_id, paper_ids) if user_id is not None else {}
  return _group_to_schema(group, user_states)


@router.get("/groups/{group_id}", response_model=GroupSchema)
async def get_group_endpoint(group_id: int, user: CurrentUser, session: AsyncSession = Depends(get_db)):
  user_id = scoped_user_id(user)
  group = await get_visible_group_or_404(session, group_id, with_relations=True, user_id=user_id)
  paper_ids = sorted(_collect_group_paper_ids(group))
  user_states = await batch_get_states(session, user_id, paper_ids) if user_id is not None else {}
  return _group_to_schema(group, user_states)


@router.patch("/groups/{group_id}", response_model=GroupSchema)
async def update_group_endpoint(
  group_id: int, group_update: GroupUpdate, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  user_id = scoped_user_id(user)
  group = await update_group(
    session,
    group_id,
    name=group_update.name,
    parent_id=group_update.parent_id,
    user_id=user_id,
  )
  paper_ids = sorted(_collect_group_paper_ids(group))
  user_states = await batch_get_states(session, user_id, paper_ids) if user_id is not None else {}
  return _group_to_schema(group, user_states)


@router.delete("/groups/{group_id}", status_code=204)
async def delete_group_endpoint(group_id: int, user: CurrentUser, session: AsyncSession = Depends(get_db)):
  await delete_group(session, group_id, user_id=scoped_user_id(user))
  return None


# ── Group sharing endpoints ──────────────────────────────────────────────


def _normalize_emails(emails: list[str]) -> list[str]:
  seen: set[str] = set()
  out: list[str] = []
  for e in emails:
    c = e.strip().lower()
    if c and c not in seen:
      seen.add(c)
      out.append(c)
  return out


@router.post("/groups/{group_id}/share", response_model=ShareListResponse)
async def share_group(
  group_id: int,
  payload: ShareRequest,
  user: CurrentUser,
  session: AsyncSession = Depends(get_db),
):
  group = await _get_owned_group_or_403(session, group_id, user)
  group_name = str(group.name)

  emails = _normalize_emails(payload.emails)
  if not emails:
    raise HTTPException(status_code=400, detail="At least one recipient email is required")

  users_result = await session.execute(select(User).where(User.email.in_(emails)))
  recipients = list(users_result.scalars().all())
  recipients_by_email = {cast(str, r.email).lower(): r for r in recipients}

  missing_emails = [e for e in emails if e not in recipients_by_email]
  skipped_emails: list[str] = []
  shares: list[GroupShare] = []

  recipient_ids = [cast(int, r.id) for r in recipients if cast(int, r.id) != user.id]
  for r in recipients:
    if r.id == user.id:
      skipped_emails.append(cast(str, r.email))

  existing_by_rid: dict[int, GroupShare] = {}
  if recipient_ids:
    existing_result = await session.execute(
      select(GroupShare)
      .where(GroupShare.group_id == group_id, GroupShare.recipient_id.in_(recipient_ids))
      .options(selectinload(GroupShare.recipient))
    )
    existing_by_rid = {cast(int, s.recipient_id): s for s in existing_result.scalars().all()}

  for r in recipients:
    rid = cast(int, r.id)
    if rid == user.id:
      continue
    share = existing_by_rid.get(rid)
    if share is None:
      share = GroupShare(
        group_id=group_id, recipient_id=rid,
        shared_by_id=user.id, permission=payload.permission,
      )
      share.recipient = r
      session.add(share)
    else:
      share.permission = payload.permission
      share.shared_by_id = user.id
    shares.append(share)

  await session.commit()

  if shares:
    ids = [cast(int, s.id) for s in shares if s.id is not None]
    refreshed = await session.execute(
      select(GroupShare).where(GroupShare.id.in_(ids))
      .options(selectinload(GroupShare.recipient))
      .order_by(GroupShare.created_at.asc(), GroupShare.id.asc())
    )
    shares = list(refreshed.scalars().all())

  from app.tasks.email_tasks import send_share_email

  for share in shares:
    if share.recipient and getattr(share.recipient, 'email', None):
      send_share_email.delay(
        str(share.recipient.email),
        str(user.display_name),
        "group",
        group_name,
        payload.permission,
      )

  return ShareListResponse(
    shares=[_serialize_group_share(s) for s in shares],
    missing_emails=missing_emails,
    skipped_emails=skipped_emails,
  )


@router.get("/groups/{group_id}/shares", response_model=ShareListResponse)
async def list_group_shares(
  group_id: int, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  await _get_owned_group_or_403(session, group_id, user)
  result = await session.execute(
    select(GroupShare)
    .where(GroupShare.group_id == group_id)
    .options(selectinload(GroupShare.recipient))
    .order_by(GroupShare.created_at.asc(), GroupShare.id.asc())
  )
  shares = list(result.scalars().all())
  return ShareListResponse(shares=[_serialize_group_share(s) for s in shares])


@router.patch("/groups/{group_id}/share/{target_user_id}", response_model=ShareRecipient)
async def update_group_share(
  group_id: int, target_user_id: int, payload: ShareUpdate,
  user: CurrentUser, session: AsyncSession = Depends(get_db),
):
  await _get_owned_group_or_403(session, group_id, user)
  result = await session.execute(
    select(GroupShare)
    .where(GroupShare.group_id == group_id, GroupShare.recipient_id == target_user_id)
    .options(selectinload(GroupShare.recipient))
  )
  share = result.scalar_one_or_none()
  if not share:
    raise HTTPException(status_code=404, detail="Share not found")
  share.permission = payload.permission
  share.shared_by_id = user.id
  await session.commit()
  await session.refresh(share, ["recipient"])
  return _serialize_group_share(share)


@router.delete("/groups/{group_id}/share/me", status_code=204)
async def leave_group_share(
  group_id: int, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  result = await session.execute(
    select(GroupShare)
    .where(GroupShare.group_id == group_id, GroupShare.recipient_id == user.id)
  )
  share = result.scalar_one_or_none()
  if not share:
    raise HTTPException(status_code=404, detail="Direct share not found")
  await session.delete(share)
  await session.commit()
  return None


@router.delete("/groups/{group_id}/share/{target_user_id}", status_code=204)
async def revoke_group_share(
  group_id: int, target_user_id: int,
  user: CurrentUser, session: AsyncSession = Depends(get_db),
):
  await _get_owned_group_or_403(session, group_id, user)
  result = await session.execute(
    select(GroupShare)
    .where(GroupShare.group_id == group_id, GroupShare.recipient_id == target_user_id)
  )
  share = result.scalar_one_or_none()
  if not share:
    raise HTTPException(status_code=404, detail="Share not found")
  await session.delete(share)
  await session.commit()
  return None
