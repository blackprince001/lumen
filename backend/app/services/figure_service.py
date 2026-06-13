"""Render and describe figures from a paper's PDF.

Layout extraction records figure *regions* (bounding box + page) but discards
the pixels. This service renders those regions back to PNG images on demand so
they can be (a) shown to a vision-capable model, or (b) associated with their
captions for text-only models.
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

# Cap how many figures we render/describe per request — vision calls are slow
# and token-heavy.
MAX_FIGURES = 8

_CAPTION_PREFIXES = ("figure", "fig.", "fig ", "table", "tbl", "scheme", "chart")


def resolve_pdf_path(file_path: str | None) -> Path | None:
  """Resolve a paper's stored ``file_path`` to an absolute, existing path."""
  if not file_path:
    return None
  path = Path(file_path)
  if not path.is_absolute():
    path = Path(settings.STORAGE_PATH) / path
  return path if path.exists() else None


def _caption_for(blocks: list[dict[str, Any]], index: int) -> str:
  """Return the caption text near the figure block at ``index``, if any.

  Captions are usually the first text block immediately below a figure that
  begins with "Figure"/"Table"/etc.
  """
  for nb in blocks[index + 1 : index + 4]:
    if not isinstance(nb, dict) or nb.get("type") not in ("text", "heading"):
      continue
    content = (nb.get("content") or "").strip()
    if content[:8].lower().lstrip().startswith(_CAPTION_PREFIXES):
      return content[:300]
  return ""


def list_figures(layout_blocks: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
  """Extract figure descriptors (page, bbox, caption) from layout blocks."""
  blocks = layout_blocks or []
  figures: list[dict[str, Any]] = []
  for i, b in enumerate(blocks):
    if not isinstance(b, dict) or b.get("type") != "figure":
      continue
    page = (b.get("metadata", {}) or {}).get("page", {}) or {}
    figures.append(
      {
        "id": b.get("id"),
        "page": page.get("number"),
        "bbox": b.get("boundingBox"),
        "caption": _caption_for(blocks, i),
        # Inline base64 PNG captured at extraction time (may be absent for
        # papers extracted before figure rendering was added).
        "image": b.get("image"),
      }
    )
  return figures


def render_figure_data_url(
  pdf_path: Path,
  page_number: int,
  bbox: dict[str, Any],
  zoom: float = 2.0,
) -> str | None:
  """Render a figure region to a base64 PNG ``data:`` URL.

  Returns ``None`` if rendering fails (e.g. bad geometry or missing page).
  """
  try:
    import fitz  # PyMuPDF
  except ImportError:
    logger.warning("PyMuPDF (fitz) not available; cannot render figures")
    return None

  try:
    doc = fitz.open(pdf_path)
    try:
      if page_number is None or page_number < 1 or page_number > doc.page_count:
        return None
      page = doc[page_number - 1]
      rect = fitz.Rect(bbox["left"], bbox["top"], bbox["right"], bbox["bottom"])
      if rect.is_empty or rect.width < 2 or rect.height < 2:
        return None
      pix = page.get_pixmap(clip=rect, matrix=fitz.Matrix(zoom, zoom))
      png_bytes = pix.tobytes("png")
    finally:
      doc.close()
  except Exception as e:  # noqa: BLE001 — rendering is best-effort
    logger.warning("Failed to render figure", page=page_number, error=str(e))
    return None

  encoded = base64.b64encode(png_bytes).decode("ascii")
  return f"data:image/png;base64,{encoded}"
