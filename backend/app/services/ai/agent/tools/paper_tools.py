"""Function tools for paper content retrieval.

These tools give agents access to the user's library: paper text,
metadata, annotations, notes, and citation data.  They use the
per-request ``BYOContext`` for user identity and permission scoping.
"""

from __future__ import annotations

# OpenAI Agents SDK — optional dependency
try:
  from agents import function_tool
except ImportError:
  function_tool = lambda f: f  # type: ignore[assignment]

from app.core.logger import get_logger
from app.services.ai.agent.context import get_byo_context
from app.services.ai.agent.tools import with_timeout

logger = get_logger(__name__)


@function_tool
@with_timeout()
async def get_paper_content(paper_id: int) -> str:
  """Retrieve the full text content of a paper by its ID.

  Use this when you need to read the paper's body text to answer
  detailed questions about methodology, results, or conclusions.

  Args:
      paper_id: The unique ID of the paper in the user's library.

  Returns:
      The paper's full text content, or an error message if the
      paper is not found or not accessible.
  """
  ctx = get_byo_context()
  db = ctx.extra.get("db_session")
  user_id = ctx.user_id

  if not db:
    return "Error: No database session available."

  try:
    from sqlalchemy import select

    from app.models.paper import Paper

    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    paper = result.scalar_one_or_none()

    if not paper:
      return f"Paper {paper_id} not found."

    from app.services.access import apply_visible_papers_filter

    if user_id is not None:
      visible_query = apply_visible_papers_filter(select(Paper), user_id)
      visible_papers = (await db.execute(visible_query)).scalars().all()
      if paper not in visible_papers:
        return f"Paper {paper_id} is not accessible."

    text = paper.content_text
    if not text:
      return f"Paper '{paper.title}' has no extracted text content."

    max_chars = 15000
    if len(text) > max_chars:
      text = text[:max_chars] + "\n\n[Content truncated...]"

    return f"# {paper.title}\n\n{text}"

  except Exception as e:
    logger.error("Error in get_paper_content", paper_id=paper_id, error=str(e))
    return f"Error retrieving paper content: {str(e)[:200]}"


@function_tool
@with_timeout()
async def get_paper_metadata(paper_id: int) -> str:
  """Retrieve metadata about a paper by its ID.

  Returns title, authors, DOI, arXiv ID, publication year, source,
  and page count.  Useful for quickly identifying papers or building
  citations.

  Args:
      paper_id: The unique ID of the paper in the user's library.

  Returns:
      A formatted string with the paper's metadata.
  """
  ctx = get_byo_context()
  db = ctx.extra.get("db_session")
  user_id = ctx.user_id

  if not db:
    return "Error: No database session available."

  try:
    from sqlalchemy import select

    from app.models.paper import Paper

    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    paper = result.scalar_one_or_none()

    if not paper:
      return f"Paper {paper_id} not found."

    lines = [
      f"Title: {paper.title or 'N/A'}",
      f"Authors: {paper.authors or 'N/A'}",
      f"DOI: {paper.doi or 'N/A'}",
      f"arXiv ID: {paper.arxiv_id or 'N/A'}",
      f"Year: {paper.publication_year or 'N/A'}",
      f"Source: {paper.source or 'N/A'}",
      f"Pages: {paper.page_count or 'N/A'}",
      f"Tags: {', '.join(t.name for t in paper.tags) if hasattr(paper, 'tags') and paper.tags else 'None'}",
    ]
    return "\n".join(lines)

  except Exception as e:
    logger.error("Error in get_paper_metadata", paper_id=paper_id, error=str(e))
    return f"Error retrieving paper metadata: {str(e)[:200]}"


@function_tool
@with_timeout()
async def search_papers(query: str, limit: int = 10) -> str:
  """Search the user's library for papers matching a text query.

  Performs a full-text search across paper titles, abstracts, and
  content.  Returns a list of matching papers with their IDs, titles,
  and authors.

  Args:
      query: The search query string.
      limit: Maximum number of results to return (default 10, max 50).

  Returns:
      A formatted list of matching papers.
  """
  ctx = get_byo_context()
  db = ctx.extra.get("db_session")

  if not db:
    return "Error: No database session available."

  try:
    from sqlalchemy import or_, select

    from app.models.paper import Paper

    limit = min(max(1, limit), 50)

    search_filter = or_(
      Paper.title.ilike(f"%{query}%"),
      Paper.abstract.ilike(f"%{query}%"),
      Paper.authors.ilike(f"%{query}%"),
    )

    result = await db.execute(select(Paper).where(search_filter).limit(limit))
    papers = result.scalars().all()

    if not papers:
      return f"No papers found matching '{query}'."

    lines = [f"Found {len(papers)} paper(s) matching '{query}':\n"]
    for i, p in enumerate(papers, 1):
      lines.append(f"{i}. [{p.id}] {p.title}")
      if p.authors:
        lines.append(f"   Authors: {p.authors[:100]}")
      lines.append("")

    return "\n".join(lines).strip()

  except Exception as e:
    logger.error("Error in search_papers", query=query, error=str(e))
    return f"Error searching papers: {str(e)[:200]}"


@function_tool
@with_timeout()
async def get_annotations(
  paper_id: int, annotation_ids: list[int] | None = None
) -> str:
  """Retrieve user annotations or highlights for a paper.

  Annotations are user-created highlights with comments on specific
  passages.  If annotation_ids is provided, returns only those
  specific annotations.  Otherwise returns all annotations for the
  paper.

  Args:
      paper_id: The paper to get annotations for.
      annotation_ids: Optional list of specific annotation IDs to retrieve.

  Returns:
      A formatted string with annotation content, page numbers, and
      highlighted text.
  """
  ctx = get_byo_context()
  db = ctx.extra.get("db_session")

  if not db:
    return "Error: No database session available."

  try:
    from sqlalchemy import select

    from app.models.annotation import Annotation

    query = select(Annotation).where(
      Annotation.paper_id == paper_id,
      Annotation.type == "annotation",
    )
    if annotation_ids:
      query = query.where(Annotation.id.in_(annotation_ids))

    result = await db.execute(query)
    annotations = result.scalars().all()

    if not annotations:
      return f"No annotations found for paper {paper_id}."

    lines = [f"Found {len(annotations)} annotation(s):\n"]
    for ann in annotations:
      page = ann.coordinate_data.get("page") if ann.coordinate_data else None
      page_str = f" (p{page})" if page else ""
      highlighted = ann.highlighted_text or ""
      comment = ann.content or ""
      lines.append(f"--- Annotation {ann.id}{page_str} ---")
      if highlighted:
        lines.append(f'Highlighted: "{highlighted[:300]}"')
      if comment:
        lines.append(f"Comment: {comment[:300]}")
      lines.append("")

    return "\n".join(lines).strip()

  except Exception as e:
    logger.error("Error in get_annotations", paper_id=paper_id, error=str(e))
    return f"Error retrieving annotations: {str(e)[:200]}"


@function_tool
@with_timeout()
async def get_notes(paper_id: int, note_ids: list[int] | None = None) -> str:
  """Retrieve user notes for a paper.

  Notes are user-written text attached to specific pages or general
  to the paper.  If note_ids is provided, returns only those
  specific notes.

  Args:
      paper_id: The paper to get notes for.
      note_ids: Optional list of specific note IDs to retrieve.

  Returns:
      A formatted string with note content.
  """
  ctx = get_byo_context()
  db = ctx.extra.get("db_session")

  if not db:
    return "Error: No database session available."

  try:
    from sqlalchemy import select

    from app.models.annotation import Annotation

    query = select(Annotation).where(
      Annotation.paper_id == paper_id,
      Annotation.type == "note",
    )
    if note_ids:
      query = query.where(Annotation.id.in_(note_ids))

    result = await db.execute(query)
    notes = result.scalars().all()

    if not notes:
      return f"No notes found for paper {paper_id}."

    lines = [f"Found {len(notes)} note(s):\n"]
    for note in notes:
      page = note.coordinate_data.get("page") if note.coordinate_data else None
      page_str = f" (p{page})" if page else ""
      content = note.content or ""
      lines.append(f"--- Note {note.id}{page_str} ---")
      lines.append(content[:500])
      lines.append("")

    return "\n".join(lines).strip()

  except Exception as e:
    logger.error("Error in get_notes", paper_id=paper_id, error=str(e))
    return f"Error retrieving notes: {str(e)[:200]}"


@function_tool
@with_timeout()
async def get_citations(paper_id: int) -> str:
  """Retrieve citation information for a paper.

  Returns the paper's references (papers it cites) and its
  citations (papers that cite it) if available.

  Args:
      paper_id: The paper to get citation info for.

  Returns:
      A formatted string with citation information.
  """
  ctx = get_byo_context()
  db = ctx.extra.get("db_session")

  if not db:
    return "Error: No database session available."

  try:
    from sqlalchemy import select

    from app.models.paper_citation import PaperCitation

    result = await db.execute(
      select(PaperCitation).where(PaperCitation.paper_id == paper_id)
    )
    citations = result.scalars().all()

    if not citations:
      return f"No citation data available for paper {paper_id}."

    lines = [f"Citation info for paper {paper_id}:\n"]
    for c in citations:
      lines.append(f"- {c.citation_text or 'N/A'}")
      if c.doi:
        lines.append(f"  DOI: {c.doi}")

    return "\n".join(lines).strip()

  except Exception as e:
    logger.error("Error in get_citations", paper_id=paper_id, error=str(e))
    return f"Error retrieving citations: {str(e)[:200]}"
