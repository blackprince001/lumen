"""Resolve inline ``ref:<kind>/<id>`` tokens into structured preview data.

Extracts reference tokens from model output, resolves each against the
database (with permission scoping), and returns a manifest suitable for
frontend hover previews and click actions.
"""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logger import get_logger
from app.services.access import apply_visible_papers_filter

logger = get_logger(__name__)

REF_PATTERN = re.compile(r"ref:([a-z][a-z0-9_]*)/([A-Za-z0-9:._-]+)")


def extract_references(content: str) -> list[tuple[str, str]]:
  """Extract all ``(kind, id)`` tuples from ``ref:`` tokens in ``content``.

  Returns them in document order (including duplicates, which callers
  should deduplicate).
  """
  return REF_PATTERN.findall(content)


async def resolve_manifest(
  db: AsyncSession,
  user_id: int | None,
  content: str,
  *,
  paper_id: int | None = None,
) -> list[dict[str, Any]]:
  """Extract all ``ref:`` tokens from ``content``, resolve each, deduplicate.

  Applies permission scoping — papers are filtered via
  ``apply_visible_papers_filter``; annotations and notes are scoped to
  the owning ``user_id`` + ``paper_id``. Unresolvable references are
  silently dropped.
  """
  raw = extract_references(content)
  seen: set[tuple[str, str]] = set()
  entries: list[dict[str, Any]] = []
  for kind, rid in raw:
    key = (kind, rid)
    if key in seen:
      continue
    seen.add(key)
    entry = await _resolve_one(db, user_id, kind, rid, paper_id=paper_id)
    if entry is not None:
      entries.append(entry)
  return entries


async def resolve_batch(
  db: AsyncSession,
  user_id: int | None,
  refs: list[dict[str, str]],
  *,
  paper_id: int | None = None,
) -> list[dict[str, Any]]:
  """Resolve a list of ``{\"kind\": …, \"id\": …}`` dicts (no dedup)."""
  entries: list[dict[str, Any]] = []
  for r in refs:
    entry = await _resolve_one(
      db, user_id, r.get("kind", ""), r.get("id", ""), paper_id=paper_id
    )
    if entry is not None:
      entries.append(entry)
  return entries


async def _resolve_one(
  db: AsyncSession,
  user_id: int | None,
  kind: str,
  rid: str,
  *,
  paper_id: int | None = None,
) -> dict[str, Any] | None:
  """Resolve a single ``(kind, id)`` reference.

  Returns ``None`` when the reference cannot be found or the user doesn't
  have permission to view it.
  """
  resolver = _RESOLVERS.get(kind)
  if resolver is None:
    logger.debug("Unknown reference kind", kind=kind, id=rid)
    return None
  try:
    return await resolver(db, user_id, rid, paper_id=paper_id)
  except Exception:
    logger.warning("Failed to resolve reference", kind=kind, id=rid, exc_info=True)
    return None


async def _resolve_paper(
  db: AsyncSession,
  user_id: int | None,
  rid: str,
  **kwargs: Any,
) -> dict[str, Any] | None:
  from app.models.paper import Paper

  try:
    pid = int(rid)
  except (ValueError, TypeError):
    return None

  query = select(Paper).where(Paper.id == pid).options(selectinload(Paper.tags))
  if user_id is not None:
    query = apply_visible_papers_filter(query, user_id)
  result = await db.execute(query)
  paper = result.scalar_one_or_none()
  if not paper:
    return None

  authors = _authors_str(paper)
  return {
    "kind": "paper",
    "id": rid,
    "label": paper.title or f"Paper {rid}",
    "title": paper.title or "",
    "subtitle": authors,
    "snippet": getattr(paper, "ai_summary", None) or "",
    "thumbnail_url": None,
    "internal": True,
    "target": f"/papers/{pid}",
  }


async def _resolve_citation(
  db: AsyncSession,
  user_id: int | None,
  rid: str,
  **kwargs: Any,
) -> dict[str, Any] | None:
  from app.models.paper_citation import PaperCitation

  citation: Any = None

  paper_id = kwargs.get("paper_id")

  try:
    cid = int(rid)
    q = select(PaperCitation).where(PaperCitation.id == cid)
    if paper_id is not None:
      q = q.where(PaperCitation.paper_id == paper_id)
    result = await db.execute(q)
    citation = result.scalar_one_or_none()
  except (ValueError, TypeError):
    pass

  if citation is None and rid.strip() and not rid.strip().isdigit():
    clean = rid.rstrip(",").strip()
    if clean:
      q = select(PaperCitation).where(
        PaperCitation.citation_context.ilike(f"%{clean}%")
      )
      if paper_id is not None:
        q = q.where(PaperCitation.paper_id == paper_id)
      result = await db.execute(q.limit(1))
      citation = result.scalar_one_or_none()

      # 2b. Broader fallback — try matching external_paper_title
      if citation is None:
        q2 = select(PaperCitation).where(
          PaperCitation.external_paper_title.ilike(f"%{clean}%")
        )
        if paper_id is not None:
          q2 = q2.where(PaperCitation.paper_id == paper_id)
        result = await db.execute(q2.limit(1))
        citation = result.scalar_one_or_none()

  if not citation:
    return None

  if user_id is not None:
    from app.models.paper import Paper

    vq = apply_visible_papers_filter(
      select(Paper.id).where(Paper.id == citation.paper_id), user_id
    )
    if (await db.execute(vq)).first() is None:
      return None

  title = citation.external_paper_title or "Cited reference"
  doi = citation.external_paper_doi or ""
  context = citation.citation_context or ""
  internal = citation.cited_paper_id is not None

  target = None
  if internal and citation.cited_paper_id is not None:
    target = f"/papers/{citation.cited_paper_id}"
  elif doi:
    target = f"https://doi.org/{doi}"

  return {
    "kind": "citation",
    "id": rid,
    "label": title,
    "title": title,
    "subtitle": f"DOI: {doi}" if doi else "",
    "snippet": context[:200] if context else "",
    "thumbnail_url": None,
    "internal": internal,
    "target": target,
  }


async def _resolve_figure(
  db: AsyncSession,
  user_id: int | None,
  rid: str,
  **kwargs: Any,
) -> dict[str, Any] | None:
  from app.models.paper import Paper

  paper_id = kwargs.get("paper_id")
  if paper_id is None:
    return None

  try:
    idx = int(rid)
  except (ValueError, TypeError):
    return None

  result = await db.execute(select(Paper).where(Paper.id == paper_id))
  paper = result.scalar_one_or_none()
  if not paper or not paper.layout_blocks:
    return None

  from app.services.figure_service import list_figures

  figures = list_figures(paper.layout_blocks)
  if idx < 1 or idx > len(figures):
    return None

  fig = figures[idx - 1]
  page = fig.get("page")
  caption = fig.get("caption") or ""

  return {
    "kind": "figure",
    "id": rid,
    "label": f"Figure {idx}",
    "title": f"Figure {idx}" + (f" (p{page})" if page else ""),
    "subtitle": "",
    "snippet": caption[:300] if caption else "",
    # Thumbnail is fetched lazily via the figure thumbnail endpoint so we
    # never persist base64 image data in the manifest / DB row.
    "thumbnail_url": None,
    "internal": True,
    "target": f"/papers/{paper_id}?page={page}" if page else f"/papers/{paper_id}",
  }


async def _resolve_section(
  db: AsyncSession,
  user_id: int | None,
  rid: str,
  **kwargs: Any,
) -> dict[str, Any] | None:
  from app.models.paper import Paper

  paper_id = kwargs.get("paper_id")
  if paper_id is None:
    return None

  result = await db.execute(select(Paper).where(Paper.id == paper_id))
  paper = result.scalar_one_or_none()
  if not paper or not paper.layout_blocks:
    return None

  # Parse page anchor: "p7" or "7"
  page_num: int | None = None
  if rid.startswith("p") and rid[1:].isdigit():
    page_num = int(rid[1:])
  elif rid.isdigit():
    page_num = int(rid)

  if page_num is None:
    return None

  # Find the heading nearest to this page
  heading_text = ""
  for b in paper.layout_blocks or []:
    if not isinstance(b, dict):
      continue
    if b.get("type") != "heading":
      continue
    meta = (b.get("metadata") or {}) or {}
    bp = ((meta.get("page") or {}) or {}).get("number")
    if bp and bp == page_num:
      heading_text = (b.get("content") or "").strip()[:120]
      break

  return {
    "kind": "section",
    "id": rid,
    "label": f"p{page_num}" if heading_text else f"Section {rid}",
    "title": heading_text or f"Page {page_num}",
    "subtitle": "",
    "snippet": "",
    "thumbnail_url": None,
    "internal": True,
    "target": f"/papers/{paper_id}?page={page_num}",
  }


async def _resolve_annotation(
  db: AsyncSession,
  user_id: int | None,
  rid: str,
  **kwargs: Any,
) -> dict[str, Any] | None:
  from app.models.annotation import Annotation

  try:
    aid = int(rid)
  except (ValueError, TypeError):
    return None

  result = await db.execute(
    select(Annotation)
    .where(Annotation.id == aid)
    .where(Annotation.type == "annotation")
  )
  ann = result.scalar_one_or_none()
  if not ann:
    return None

  # Scope to the same paper if provided
  paper_id = kwargs.get("paper_id")
  if paper_id is not None and ann.paper_id != paper_id:
    return None
  # Scope to the owning user
  if user_id is not None and ann.user_id is not None and ann.user_id != user_id:
    return None

  page = ann.coordinate_data.get("page") if ann.coordinate_data else None
  highlighted = (ann.highlighted_text or "")[:200]
  comment = (ann.content or "")[:200]
  snippet = highlighted or comment

  return {
    "kind": "annotation",
    "id": rid,
    "label": snippet[:60] or f"Annotation {rid}",
    "title": f"Annotation {rid}" + (f" (p{page})" if page else ""),
    "subtitle": "",
    "snippet": snippet,
    "thumbnail_url": None,
    "internal": True,
    "target": _material_target(ann.paper_id, page, "annotation", aid),
  }


async def _resolve_note(
  db: AsyncSession,
  user_id: int | None,
  rid: str,
  **kwargs: Any,
) -> dict[str, Any] | None:
  from app.models.annotation import Annotation

  try:
    nid = int(rid)
  except (ValueError, TypeError):
    return None

  result = await db.execute(
    select(Annotation).where(Annotation.id == nid).where(Annotation.type == "note")
  )
  note = result.scalar_one_or_none()
  if not note:
    return None

  paper_id = kwargs.get("paper_id")
  if paper_id is not None and note.paper_id != paper_id:
    return None
  if user_id is not None and note.user_id is not None and note.user_id != user_id:
    return None

  page = note.coordinate_data.get("page") if note.coordinate_data else None
  content = (note.content or "")[:300]

  return {
    "kind": "note",
    "id": rid,
    "label": content[:60] or f"Note {rid}",
    "title": f"Note {rid}" + (f" (p{page})" if page else ""),
    "subtitle": "",
    "snippet": content,
    "thumbnail_url": None,
    "internal": True,
    "target": _material_target(note.paper_id, page, "note", nid),
  }


_RESOLVERS: dict[str, Any] = {
  "paper": _resolve_paper,
  "citation": _resolve_citation,
  "figure": _resolve_figure,
  "section": _resolve_section,
  "annotation": _resolve_annotation,
  "note": _resolve_note,
}


def _authors_str(paper: Any) -> str:
  from app.services.ai.agent.paper_meta import authors_str as fmt_authors

  return fmt_authors(paper) or ""


def _material_target(
  paper_id: int | None, page: int | None, focus_kind: str, focus_id: int
) -> str | None:
  """Build a reader deep-link to the actual material (page + focused item).

  Returns a ``/papers/{id}?page=N&focus=kind:id`` URL so clicking a chip
  jumps to the highlight/note in the reader instead of just opening the paper.
  """
  if paper_id is None:
    return None
  base = f"/papers/{paper_id}"
  params = []
  if page:
    params.append(f"page={page}")
  params.append(f"focus={focus_kind}:{focus_id}")
  return f"{base}?{'&'.join(params)}"
