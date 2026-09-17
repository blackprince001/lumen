"""RAG (Retrieval-Augmented Generation) function tool.

Provides ``semantic_search`` — a tool that lets agents retrieve
relevant paper passages using vector embeddings and pgvector
cosine similarity.
"""

from __future__ import annotations

# OpenAI Agents SDK — optional dependency
try:
  from agents import function_tool
except ImportError:
  def function_tool(f):
    return f  # type: ignore[assignment]

from app.core.logger import get_logger
from app.services.ai.agent.context import get_byo_context
from app.services.ai.agent.tools import rollback_quietly, with_timeout
from app.services.deep_research.evidence import collect_context_evidence
from app.services.embeddings import embedding_service
from app.services.judgments import (
  ROUTE_CONFLICT,
  ROUTE_INCLUDE,
  gate_passages,
)
from app.services.judgments import (
  is_configured as judgments_configured,
)

logger = get_logger(__name__)


def _format_paper_row(row, excerpt: str | None, score: float, index: int) -> list[str]:
  lines = [f"{index}. [{row.id}] {row.title} (similarity: {score:.3f})"]
  meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
  row_authors = meta.get("authors")
  if row_authors:
    if isinstance(row_authors, (list, tuple)):
      row_authors = ", ".join(str(a) for a in row_authors if a)
    lines.append(f"   Authors: {str(row_authors)[:100]}")
  if excerpt:
    lines.append(f"   Excerpt: {excerpt}...")
  lines.append("")
  return lines


@function_tool
@with_timeout()
async def semantic_search(query: str, limit: int = 5) -> str:
  """Search papers using semantic similarity.

  Converts the query into a vector embedding and finds the most
  semantically similar papers in the user's library.  Use this for
  finding papers by concept, topic, or meaning rather than exact
  keyword matches.

  Args:
      query: The search query (natural language).
      limit: Maximum number of results to return (default 5, max 20).

  Returns:
      A formatted list of semantically similar papers with relevance
      scores and content excerpts.
  """
  ctx = get_byo_context()
  db = ctx.extra.get("db_session")
  user_id = ctx.user_id
  is_admin = ctx.is_admin

  if not db:
    return "Error: No database session available."

  try:
    limit = min(max(1, limit), 20)

    embedding = await embedding_service.generate_query_embedding(query)
    if not embedding:
      return "Error: Could not generate embedding for the query."

    from sqlalchemy import select

    from app.models.paper import Paper
    from app.services.access import apply_agent_paper_visibility_filter

    distance = Paper.embedding.cosine_distance(embedding)
    sql = (
      select(
        Paper.id,
        Paper.title,
        Paper.metadata_json,
        (1 - distance).label("similarity"),
      )
      .where(Paper.embedding.is_not(None))
      .order_by(distance)
      .limit(limit)
    )
    sql = apply_agent_paper_visibility_filter(sql, user_id, is_admin=is_admin)

    result = await db.execute(sql)
    rows = result.fetchall()

    if not rows:
      return "No semantically similar papers found."

    # Fetch excerpts once — used both for Jev state and the formatted output.
    excerpts: dict[int, str] = {}
    for row in rows:
      paper = await db.get(Paper, row.id)
      if paper and paper.content_text:
        excerpts[row.id] = paper.content_text[:500].replace("\n", " ")

    gated: dict[str, dict] | None = None
    if judgments_configured():
      passages = [
        {
          "id": str(row.id),
          "title": row.title or "Untitled",
          "text": excerpts.get(row.id, row.title or ""),
          "source_type": "library",
        }
        for row in rows
      ]
      gated = await gate_passages(query, passages)

    # Fail-soft: None (off/error) or {} (every judgment failed) keeps the
    # legacy unfiltered format. A non-empty gate always carries per-passage
    # routes, so genuine all-excluded results still take the gated path.
    if not gated:
      collect_context_evidence(
        ctx.extra,
        [
          {"source": "library", "external_id": str(row.id), "title": row.title or "Untitled"}
          for row in rows
        ],
      )
      lines = [f"Top {len(rows)} semantically similar paper(s):\n"]
      for i, row in enumerate(rows, 1):
        score = float(row.similarity) if row.similarity is not None else 0.0
        lines.extend(_format_paper_row(row, excerpts.get(row.id), score, i))
      return "\n".join(lines).strip()

    by_id = {str(row.id): row for row in rows}
    kept = [pid for pid, s in gated.items() if s["route"] == ROUTE_INCLUDE]
    conflicts = [pid for pid, s in gated.items() if s["route"] == ROUTE_CONFLICT]
    dropped = len(rows) - len(kept) - len(conflicts)
    collect_context_evidence(
      ctx.extra,
      [
        {"source": "library", "external_id": pid, "title": by_id[pid].title or "Untitled"}
        for pid in (*kept, *conflicts)
        if pid in by_id
      ],
    )
    logger.info(
      "rag_gate_routed", kept=len(kept), conflicting=len(conflicts), dropped=dropped
    )
    if not kept and not conflicts:
      return (
        f"Top {len(rows)} semantically similar paper(s) were all filtered "
        f"as off-topic or unusable ({dropped} dropped). No evidence to answer from — "
        "say so rather than guessing."
      )
    lines = [
      f"Top {len(rows)} semantically similar paper(s) "
      f"(Jev-gated: {len(kept)} kept, {len(conflicts)} conflicting, {dropped} dropped):\n"
    ]
    if kept:
      lines.append("Accepted evidence:")
      for i, pid in enumerate(kept, 1):
        row = by_id[pid]
        score = float(row.similarity) if row.similarity is not None else 0.0
        lines.extend(_format_paper_row(row, excerpts.get(row.id), score, i))
    if conflicts:
      lines.append("Conflicting evidence (disputes the query premise — do not merge with accepted):")
      for i, pid in enumerate(conflicts, 1):
        row = by_id[pid]
        score = float(row.similarity) if row.similarity is not None else 0.0
        lines.extend(_format_paper_row(row, excerpts.get(row.id), score, i))
    return "\n".join(lines).strip()

  except Exception as e:
    await rollback_quietly(db)
    logger.error("Error in semantic_search", query=query, error=str(e))
    return f"Error performing semantic search: {str(e)[:200]}"
