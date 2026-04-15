"""Search API endpoints."""

import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.crud import (
  create_saved_search,
  delete_saved_search,
  list_saved_searches,
)
from app.dependencies import CurrentUser, get_db, scoped_user_id
from app.models.paper import Paper
from app.schemas.paper import Paper as PaperSchema
from app.schemas.search import (
  SavedSearchCreate,
  SavedSearchResponse,
  SearchRequest,
  SearchResponse,
  SearchResult,
)
from app.services.embeddings import embedding_service
from app.services.search_service import search_service


def _sanitize_similarity(value: float) -> float:
  """Sanitize similarity value to ensure JSON compliance."""
  if value is None or math.isnan(value) or math.isinf(value):
    return 0.0
  return float(value)


router = APIRouter()


@router.post("/search", response_model=SearchResponse)
async def semantic_search(
  search_request: SearchRequest, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  if not search_request.query or not search_request.query.strip():
    raise HTTPException(status_code=400, detail="Query cannot be empty")

  query_embedding = embedding_service.generate_query_embedding(search_request.query)
  similarity_threshold = search_request.threshold or 0.0

  vector_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

  uid = scoped_user_id(user)
  user_filter = "AND uploaded_by_id = :user_id" if uid is not None else ""

  query_sql = text(f"""
        SELECT 
            id,
            title,
            doi,
            url,
            file_path,
            content_text,
            metadata_json,
            created_at,
            updated_at,
            1 - (embedding <=> '{vector_str}'::vector) as similarity
        FROM papers
        WHERE embedding IS NOT NULL
        {user_filter}
        AND (1 - (embedding <=> '{vector_str}'::vector)) >= :threshold
        ORDER BY embedding <=> '{vector_str}'::vector
        LIMIT :limit
    """)

  params: dict = {"threshold": similarity_threshold, "limit": search_request.limit}
  if uid is not None:
    params["user_id"] = uid

  result = await session.execute(query_sql, params)

  rows = result.fetchall()

  if not rows:
    return SearchResponse(results=[], query=search_request.query, total=0)

  paper_ids = [row[0] for row in rows]
  similarity_scores = {row[0]: row[-1] for row in rows}

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
  papers = papers_result.scalars().all()

  # Filter papers by additional criteria if provided
  filtered_papers = []
  for paper in papers:
    include = True

    if (
      search_request.reading_status
      and getattr(paper, "reading_status", None) != search_request.reading_status
    ):
      include = False
    if (
      search_request.priority
      and getattr(paper, "priority", None) != search_request.priority
    ):
      include = False
    if search_request.has_annotations is not None:
      has_anns = len(getattr(paper, "annotations", [])) > 0
      if search_request.has_annotations != has_anns:
        include = False

    if include:
      filtered_papers.append(paper)

  results = [
    SearchResult(
      paper=PaperSchema.model_validate(paper),
      similarity=_sanitize_similarity(similarity_scores.get(paper.id, 0.0)),
    )
    for paper in filtered_papers
    if paper.id in similarity_scores
  ]

  results.sort(key=lambda x: x.similarity, reverse=True)

  return SearchResponse(results=results, query=search_request.query, total=len(results))


@router.post("/search/fulltext", response_model=SearchResponse)
async def fulltext_search(
  search_request: SearchRequest, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  if not search_request.query or not search_request.query.strip():
    raise HTTPException(status_code=400, detail="Query cannot be empty")

  papers = await search_service.fulltext_search(
    session, search_request.query, search_request.limit, user_id=scoped_user_id(user)
  )

  results = [
    SearchResult(paper=PaperSchema.model_validate(paper), similarity=1.0)
    for paper in papers
  ]

  return SearchResponse(results=results, query=search_request.query, total=len(results))


@router.post("/search/annotations")
async def search_annotations(
  query: str, user: CurrentUser, limit: int = 10, session: AsyncSession = Depends(get_db)
):
  if not query or not query.strip():
    raise HTTPException(status_code=400, detail="Query cannot be empty")

  annotations = await search_service.search_annotations(session, query, limit, user_id=scoped_user_id(user))

  return {
    "annotations": [
      {
        "id": ann.id,
        "paper_id": ann.paper_id,
        "content": ann.content,
        "highlighted_text": ann.highlighted_text,
      }
      for ann in annotations
    ],
    "total": len(annotations),
  }


@router.get("/saved-searches", response_model=list[SavedSearchResponse])
async def list_saved_searches_endpoint(user: CurrentUser, session: AsyncSession = Depends(get_db)):
  searches = await list_saved_searches(session, user_id=scoped_user_id(user))
  return [SavedSearchResponse.model_validate(s) for s in searches]


@router.post("/saved-searches", response_model=SavedSearchResponse, status_code=201)
async def create_saved_search_endpoint(
  search_create: SavedSearchCreate, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  saved_search = await create_saved_search(
    session,
    search_create.name,
    user_id=scoped_user_id(user),
    description=search_create.description,
    query_params=search_create.query_params,
  )
  return SavedSearchResponse.model_validate(saved_search)


@router.delete("/saved-searches/{search_id}", status_code=204)
async def delete_saved_search_endpoint(
  search_id: int, user: CurrentUser, session: AsyncSession = Depends(get_db)
):
  await delete_saved_search(session, search_id, user_id=scoped_user_id(user))
  return None
