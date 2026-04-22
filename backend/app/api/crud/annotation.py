"""Annotation CRUD functions."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud.paper import get_visible_paper_or_404
from app.models.annotation import Annotation
from app.services.access import get_effective_paper_permission


async def get_annotation_or_404(
  session: AsyncSession,
  annotation_id: int,
  *,
  user_id: int | None = None,
) -> Annotation:
  query = select(Annotation).where(Annotation.id == annotation_id)
  result = await session.execute(query)
  annotation = result.scalar_one_or_none()

  if not annotation:
    raise HTTPException(status_code=404, detail="Annotation not found")

  # Only the annotation author or the paper owner can modify/delete
  if user_id is not None:
    is_author = annotation.user_id == user_id or annotation.user_id is None
    if not is_author:
      from app.models.paper import Paper

      paper_result = await session.execute(
        select(Paper.uploaded_by_id).where(Paper.id == annotation.paper_id)
      )
      paper_owner_id = paper_result.scalar_one_or_none()
      if paper_owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this annotation")

  return annotation


async def list_annotations_for_paper(
  session: AsyncSession,
  paper_id: int,
  *,
  user_id: int | None = None,
) -> list[Annotation]:
  # Verify paper is visible to user
  await get_visible_paper_or_404(session, paper_id, user_id=user_id)

  # All annotations on the paper are visible to anyone with access
  from sqlalchemy.orm import selectinload

  query = (
    select(Annotation)
    .where(Annotation.paper_id == paper_id)
    .options(selectinload(Annotation.user))
    .order_by(Annotation.created_at.desc())
  )
  result = await session.execute(query)
  return list(result.scalars().all())


async def create_annotation(
  session: AsyncSession,
  paper_id: int,
  *,
  user_id: int | None = None,
  content: str | None = None,
  type: str = "annotation",
  highlighted_text: str | None = None,
  selection_data: dict | None = None,
  note_scope: str | None = None,
  coordinate_data: dict | None = None,
) -> Annotation:
  paper = await get_visible_paper_or_404(session, paper_id, user_id=user_id)

  # Require at least editor permission for non-owners
  if user_id is not None and paper.uploaded_by_id != user_id:
    perm = await get_effective_paper_permission(session, user_id, paper)
    if perm not in ("owner", "editor"):
      raise HTTPException(status_code=403, detail="Editor permission required to annotate")

  annotation = Annotation(
    paper_id=paper_id,
    user_id=user_id,
    content=content,
    type=type,
    highlighted_text=highlighted_text,
    selection_data=selection_data,
    note_scope=note_scope,
    coordinate_data=coordinate_data or {},
  )

  session.add(annotation)
  await session.commit()
  await session.refresh(annotation)

  return annotation


async def update_annotation(
  session: AsyncSession,
  annotation_id: int,
  *,
  user_id: int | None = None,
  content: str | None = None,
  type: str | None = None,
  highlighted_text: str | None = None,
  selection_data: dict | None = None,
  note_scope: str | None = None,
  coordinate_data: dict | None = None,
) -> Annotation:
  annotation = await get_annotation_or_404(session, annotation_id, user_id=user_id)

  if content is not None:
    annotation.content = content
  if type is not None:
    annotation.type = type
  if highlighted_text is not None:
    annotation.highlighted_text = highlighted_text
  if selection_data is not None:
    annotation.selection_data = selection_data
  if note_scope is not None:
    annotation.note_scope = note_scope
  if coordinate_data is not None:
    annotation.coordinate_data = coordinate_data

  await session.commit()
  await session.refresh(annotation)

  return annotation


async def delete_annotation(
  session: AsyncSession,
  annotation_id: int,
  *,
  user_id: int | None = None,
) -> None:
  annotation = await get_annotation_or_404(session, annotation_id, user_id=user_id)
  await session.delete(annotation)
  await session.commit()
