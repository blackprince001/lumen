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

import statistics
from typing import Any

import fitz  # PyMuPDF

MAX_CONTENT_CHARS = 2000
HEADING_SIZE_RATIO = 1.25
HEADING_MAX_CHARS = 200


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
        if is_image:
          text, max_size = "[figure]", 0.0
        else:
          text, max_size = _block_text_and_max_size(block)
          if not text:
            continue
          span_sizes.append(max_size)

        raw.append(
          {
            "id": f"b{page_number}-{i}",
            "type": "figure" if is_image else "text",
            "content": text[:MAX_CONTENT_CHARS],
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
        )

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
