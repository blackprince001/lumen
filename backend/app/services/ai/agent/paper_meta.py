"""Helpers for reading paper metadata stored in ``Paper.metadata_json``.

The ``Paper`` model does not have dedicated columns for fields like
``authors`` or ``abstract``; these are stored in the ``metadata_json``
JSON column (see :class:`app.schemas.paper.PaperMetadata`).  These
helpers provide safe accessors so agent tools don't crash with
``AttributeError`` when reaching for non-existent columns.
"""

from __future__ import annotations

from typing import Any


def _meta(paper: Any) -> dict:
  meta = getattr(paper, "metadata_json", None)
  return meta if isinstance(meta, dict) else {}


def authors_str(paper: Any) -> str | None:
  """Return a comma-joined authors string, or ``None`` if unavailable."""
  authors = _meta(paper).get("authors")
  if not authors:
    return None
  if isinstance(authors, str):
    return authors
  if isinstance(authors, (list, tuple)):
    return ", ".join(str(a) for a in authors if a) or None
  return str(authors)


def abstract(paper: Any) -> str | None:
  return _meta(paper).get("abstract")


def publication_year(paper: Any) -> str | None:
  date = _meta(paper).get("publication_date")
  if not date:
    return None
  return str(date)[:4]


def journal(paper: Any) -> str | None:
  return _meta(paper).get("journal")
