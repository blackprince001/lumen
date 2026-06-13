"""PDF layout extraction with PyMuPDF.

Produces per-page text/figure blocks in the exact ParsedOcrBlock shape the
frontend's @extend layout-blocks components consume:

- ``boundingBox`` is ``{left, top, right, bottom}`` in **absolute page
  units** (PDF points); the component normalizes against
  ``metadata.page.width/height`` itself.
- ``type`` must come from the component's closed vocabulary (unknown types
  are silently dropped by ``getOcrBlocks``): we emit ``text``, ``heading``,
  and ``figure``.

The auto-highlight AI pipeline uses these same blocks to anchor highlights;
it converts to the annotation system's normalized 0-1 rects at write time.
"""

from __future__ import annotations

import base64
import statistics
from typing import Any

import fitz  # PyMuPDF

from app.core.logger import get_logger

logger = get_logger(__name__)

HEADING_SIZE_RATIO = 1.25
HEADING_MAX_CHARS = 200

# Figure rendering: longest side is rendered to at most this many pixels so the
# inline base64 stays a reasonable size in the layout_blocks JSON column.
FIGURE_MAX_PX = 1024
# Skip rendering tiny regions (icons, rules, bullets) — not real figures.
FIGURE_MIN_PTS = 40.0


def _render_figure_data_url(
  page: "fitz.Page", bbox: tuple[float, float, float, float]
) -> str | None:
  """Render a figure region to a base64 PNG ``data:`` URL, or ``None``.

  The image is captured at extraction time and embedded directly in the
  layout block so downstream consumers (vision models, the frontend) get the
  pixels without re-opening the PDF.
  """
  x0, y0, x1, y1 = bbox
  w, h = x1 - x0, y1 - y0
  if w < FIGURE_MIN_PTS or h < FIGURE_MIN_PTS:
    return None
  try:
    # Scale so the longest side lands near FIGURE_MAX_PX (clamped 1x–3x).
    zoom = max(1.0, min(3.0, FIGURE_MAX_PX / max(w, h)))
    pix = page.get_pixmap(
      clip=fitz.Rect(x0, y0, x1, y1), matrix=fitz.Matrix(zoom, zoom)
    )
    png_bytes = pix.tobytes("png")
  except Exception as e:  # noqa: BLE001 — rendering is best-effort
    logger.warning("Failed to render figure region", error=str(e))
    return None
  encoded = base64.b64encode(png_bytes).decode("ascii")
  return f"data:image/png;base64,{encoded}"


def _block_text_and_max_size(block: dict[str, Any]) -> tuple[str, float]:
  parts: list[str] = []
  max_size = 0.0
  for line in block.get("lines", []):
    spans = line.get("spans", [])
    parts.append("".join(span.get("text", "") for span in spans))
    for span in spans:
      max_size = max(max_size, float(span.get("size", 0.0)))
  return "\n".join(parts).strip(), max_size


def extract_layout(pdf_bytes: bytes) -> list[dict[str, Any]]:
  """Extract ParsedOcrBlock-shaped layout blocks from a PDF."""
  doc = fitz.open(stream=pdf_bytes, filetype="pdf")
  try:
    raw: list[dict[str, Any]] = []
    span_sizes: list[float] = []

    for page_number, page in enumerate(doc, start=1):
      width, height = page.rect.width, page.rect.height
      if width <= 0 or height <= 0:
        continue

      for i, block in enumerate(page.get_text("dict")["blocks"]):
        x0, y0, x1, y1 = block["bbox"]
        is_image = block.get("type") == 1
        image_data_url: str | None = None
        if is_image:
          text, max_size = "[figure]", 0.0
          # Capture the figure's pixels as inline base64 PNG at extraction
          # time so models/clients can use the image directly.
          image_data_url = _render_figure_data_url(page, (x0, y0, x1, y1))
        else:
          text, max_size = _block_text_and_max_size(block)
          if not text:
            continue
          span_sizes.append(max_size)

        entry: dict[str, Any] = {
          "id": f"b{page_number}-{i}",
          "type": "figure" if is_image else "text",
          "content": text,
          "metadata": {
            "page": {"number": page_number, "width": width, "height": height},
            # Born-digital extraction: geometry/text come from the PDF
            # itself, so confidence is exact.
            "avgOcrConfidence": 1.0,
          },
          "boundingBox": {
            "left": max(0.0, x0),
            "top": max(0.0, y0),
            "right": min(width, x1),
            "bottom": min(height, y1),
          },
          "_max_size": max_size,
        }
        if image_data_url:
          entry["image"] = image_data_url
        raw.append(entry)

    median_size = statistics.median(span_sizes) if span_sizes else 0.0
    for block in raw:
      max_size = block.pop("_max_size")
      if (
        block["type"] == "text"
        and median_size > 0
        and max_size > median_size * HEADING_SIZE_RATIO
        and len(block["content"]) < HEADING_MAX_CHARS
      ):
        block["type"] = "heading"

    return raw
  finally:
    doc.close()


def layout_to_text(blocks: list[dict[str, Any]]) -> str:
  """Flatten layout blocks into readable plain text for ``content_text``.

  Concatenates ``text``/``heading`` blocks in reading order with ``[p<n>]``
  page markers.  This is the single source of a paper's text now that
  ingestion extracts the full layout rather than the first few pages.
  """
  parts: list[str] = []
  for block in blocks:
    if block.get("type") not in ("text", "heading"):
      continue
    content = (block.get("content") or "").strip()
    if not content:
      continue
    page = ((block.get("metadata") or {}).get("page") or {}).get("number")
    line = f"[p{page}] {content}\n" if page else f"{content}\n"
    parts.append(line)
  return "".join(parts).strip()
