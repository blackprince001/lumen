from datetime import datetime
from typing import List

from sqlalchemy import Select, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.annotation import Annotation
from app.models.paper import Paper, paper_group_association
from app.models.sharing import UserPaperState
from app.models.tag import paper_tag_association
from app.schemas.search import SearchRequest


class SearchService:
  async def fulltext_search(
    self, session: AsyncSession, query: str, limit: int = 10, user_id: int | None = None
  ) -> List[Paper]:
    if not query or not query.strip():
      return []

    query_escaped = query.replace("'", "''").replace(":", "\\:")
    query_terms = query_escaped.split()
    tsquery = " & ".join([f"{term}:*" for term in query_terms])

    user_filter = "AND uploaded_by_id = :user_id" if user_id is not None else ""
    sql_query = text(f"""
      SELECT id, ts_rank_cd(
        to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content_text, '')),
        to_tsquery(:tsquery)
      ) AS rank
      FROM papers
      WHERE to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content_text, ''))
        @@ to_tsquery(:tsquery)
      {user_filter}
      ORDER BY rank DESC
      LIMIT :limit
    """)

    params: dict = {"tsquery": tsquery, "limit": limit}
    if user_id is not None:
      params["user_id"] = user_id

    result = await session.execute(sql_query, params)
    rows = result.fetchall()

    if not rows:
      return []

    paper_ids = [row[0] for row in rows]
    papers_query = (
      select(Paper)
      .options(
        selectinload(Paper.annotations),
        selectinload(Paper.groups),
        selectinload(Paper.tags),
      )
      .where(Paper.id.in_(paper_ids))
    )
    papers_result = await session.execute(papers_query)
    papers = list(papers_result.scalars().all())

    rank_map = {row[0]: row[1] for row in rows}
    papers.sort(key=lambda p: rank_map.get(p.id, 0), reverse=True)

    return papers

  async def search_annotations(
    self, session: AsyncSession, query: str, limit: int = 10, user_id: int | None = None
  ) -> List[Annotation]:
    if not query or not query.strip():
      return []

    query_escaped = query.replace("'", "''").replace(":", "\\:")
    query_terms = query_escaped.split()
    tsquery = " & ".join([f"{term}:*" for term in query_terms])

    user_filter = "AND user_id = :user_id" if user_id is not None else ""
    sql_query = text(f"""
      SELECT id
      FROM annotations
      WHERE to_tsvector('english', COALESCE(content, '')) @@ to_tsquery(:tsquery)
      {user_filter}
      ORDER BY ts_rank_cd(
        to_tsvector('english', COALESCE(content, '')),
        to_tsquery(:tsquery)
      ) DESC
      LIMIT :limit
    """)

    params: dict = {"tsquery": tsquery, "limit": limit}
    if user_id is not None:
      params["user_id"] = user_id

    result = await session.execute(sql_query, params)
    rows = result.fetchall()

    if not rows:
      return []

    annotation_ids = [row[0] for row in rows]
    annotations_query = select(Annotation).where(Annotation.id.in_(annotation_ids))
    annotations_result = await session.execute(annotations_query)

    return list(annotations_result.scalars().all())

  def apply_filters(
    self, query: Select, search_request: SearchRequest, session: AsyncSession, *, user_id: int | None = None
  ):
    """Apply advanced filters to search query."""
    # Date range filters
    if search_request.date_from:
      try:
        date_from_obj = datetime.fromisoformat(
          search_request.date_from.replace("Z", "+00:00")
        )
        query = query.where(Paper.created_at >= date_from_obj)
      except ValueError:
        pass

    if search_request.date_to:
      try:
        date_to_obj = datetime.fromisoformat(
          search_request.date_to.replace("Z", "+00:00")
        )
        query = query.where(Paper.created_at <= date_to_obj)
      except ValueError:
        pass

    # Author filter (in metadata_json)
    if search_request.authors:
      author_conditions = []
      for author in search_request.authors:
        author_conditions.append(
          Paper.metadata_json["author"].astext.ilike(f"%{author}%")
        )
        author_conditions.append(
          Paper.metadata_json["authors_list"].astext.ilike(f"%{author}%")
        )
      if author_conditions:
        query = query.where(or_(*author_conditions))

    # Journal filter
    if search_request.journal:
      query = query.where(
        or_(
          Paper.metadata_json["journal"].astext.ilike(f"%{search_request.journal}%"),
          Paper.metadata_json["producer"].astext.ilike(f"%{search_request.journal}%"),
        )
      )

    # Tag filter
    if search_request.tag_ids:
      query = query.join(paper_tag_association).where(
        paper_tag_association.c.tag_id.in_(search_request.tag_ids)
      )

    # Per-user state filters (reading_status, priority, reading_time)
    needs_state_join = (
      search_request.reading_status
      or search_request.priority
      or search_request.reading_time_min is not None
      or search_request.reading_time_max is not None
    )
    if needs_state_join and user_id is not None:
      query = query.join(
        UserPaperState,
        (UserPaperState.paper_id == Paper.id) & (UserPaperState.user_id == user_id),
      )
      if search_request.reading_status:
        query = query.where(UserPaperState.reading_status == search_request.reading_status)
      if search_request.priority:
        query = query.where(UserPaperState.priority == search_request.priority)
      if search_request.reading_time_min is not None:
        query = query.where(UserPaperState.reading_time_minutes >= search_request.reading_time_min)
      if search_request.reading_time_max is not None:
        query = query.where(UserPaperState.reading_time_minutes <= search_request.reading_time_max)

    # Group filter
    if search_request.group_ids:
      query = query.join(paper_group_association).where(
        paper_group_association.c.group_id.in_(search_request.group_ids)
      )

    # Has annotations filter
    if search_request.has_annotations is not None:
      if search_request.has_annotations:
        query = query.where(Paper.annotations.any())
      else:
        query = query.where(~Paper.annotations.any())

    # Has notes filter (notes are annotations with type='note')
    if search_request.has_notes is not None:
      from app.models.annotation import Annotation as AnnModel

      if search_request.has_notes:
        subquery = select(AnnModel.paper_id).where(AnnModel.type == "note").distinct()
        query = query.where(Paper.id.in_(subquery))
      else:
        subquery = select(AnnModel.paper_id).where(AnnModel.type == "note").distinct()
        query = query.where(~Paper.id.in_(subquery))

    return query


search_service = SearchService()
