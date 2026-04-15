"""Tags API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import create_tag, delete_tag, get_tag_or_404, list_tags, update_tag
from app.dependencies import CurrentUser, get_db, scoped_user_id
from app.schemas.tag import Tag as TagSchema
from app.schemas.tag import TagCreate, TagListResponse, TagUpdate

router = APIRouter()


@router.get("/tags", response_model=TagListResponse)
async def list_tags_endpoint(
  user: CurrentUser,
  page: int = Query(1, ge=1),
  page_size: int = Query(100, ge=1, le=1000),
  search: str | None = None,
  session: AsyncSession = Depends(get_db),
):
  tags, total = await list_tags(session, page=page, page_size=page_size, search=search, user_id=scoped_user_id(user))
  return TagListResponse(tags=[TagSchema.model_validate(t) for t in tags], total=total)


@router.post("/tags", response_model=TagSchema, status_code=201)
async def create_tag_endpoint(
  tag_in: TagCreate, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  tag = await create_tag(session, tag_in.name, user_id=scoped_user_id(user))
  return TagSchema.model_validate(tag)


@router.get("/tags/{tag_id}", response_model=TagSchema)
async def get_tag_endpoint(tag_id: int, user: CurrentUser, session: AsyncSession = Depends(get_db)):
  tag = await get_tag_or_404(session, tag_id, user_id=scoped_user_id(user))
  return TagSchema.model_validate(tag)


@router.patch("/tags/{tag_id}", response_model=TagSchema)
async def update_tag_endpoint(
  tag_id: int, tag_update: TagUpdate, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  if tag_update.name is not None:
    tag = await update_tag(session, tag_id, tag_update.name, user_id=scoped_user_id(user))
  else:
    tag = await get_tag_or_404(session, tag_id, user_id=scoped_user_id(user))
  return TagSchema.model_validate(tag)


@router.delete("/tags/{tag_id}", status_code=204)
async def delete_tag_endpoint(tag_id: int, user: CurrentUser, session: AsyncSession = Depends(get_db)):
  await delete_tag(session, tag_id, user_id=scoped_user_id(user))
  return None
