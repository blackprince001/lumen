"""Content provider for paper file access.

Handles file resolution, uploads to AI providers, and provides content
parts for AI requests. Supports Gemini file uploads and text fallback.
"""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, cast

from app.core.config import settings
from app.core.logger import get_logger
from app.models.paper import Paper
from app.services.ai.helpers import get_provider_for_user

logger = get_logger(__name__)

CACHE_TTL = timedelta(hours=1)
PDF_MIME_TYPE = "application/pdf"


class ContentProvider:
  """Resolves paper file content for AI provider consumption.

  For Gemini, supports PDF file uploads to get a file URI.
  For other providers, falls back to the paper's extracted text content.
  """

  def __init__(self) -> None:
    self._cached_uris: dict[int, tuple[str, datetime]] = {}

  def get_cached_uri(self, paper_id: int) -> str | None:
    if paper_id not in self._cached_uris:
      return None

    uri, cached_at = self._cached_uris[paper_id]
    if datetime.now() - cached_at >= CACHE_TTL:
      del self._cached_uris[paper_id]
      return None

    return uri

  def cache_uri(self, paper_id: int, uri: str) -> None:
    self._cached_uris[paper_id] = (uri, datetime.now())

  def clear_cache(self, paper_id: int | None = None) -> None:
    if paper_id is None:
      self._cached_uris.clear()
      return
    self._cached_uris.pop(paper_id, None)

  def _resolve_absolute_path(self, file_path: Path) -> Path | None:
    if file_path.exists():
      return file_path
    storage_path = Path(settings.STORAGE_PATH)
    fallback = storage_path / file_path.name
    if fallback.exists():
      return fallback
    return None

  def _resolve_relative_path(self, file_path: Path) -> Path | None:
    if file_path.exists():
      return file_path
    storage_path = Path(settings.STORAGE_PATH)
    full_path = storage_path / file_path
    if full_path.exists():
      return full_path
    full_path = storage_path / file_path.name
    if full_path.exists():
      return full_path
    return None

  def get_local_file_path(self, paper: Paper) -> Path | None:
    if not paper.file_path:
      return None
    file_path = Path(cast(str, paper.file_path))
    if file_path.is_absolute():
      return self._resolve_absolute_path(file_path)
    return self._resolve_relative_path(file_path)

  async def get_content_parts(
    self, paper: Paper, include_text_fallback: bool = True
  ) -> list[Any]:
    """Get content parts for a paper.

    For Gemini, attempts to upload the PDF and return a file URI part.
    For all providers, falls back to text content if no file is available
    or if the provider doesn't support file uploads.

    Returns:
        A list of content parts (dicts with 'file_uri' or 'text' keys),
        or an empty list if no content is available.
    """
    paper_id = cast(int, paper.id)

    # Try to get a provider that supports file upload (e.g. Gemini)
    provider = await get_provider_for_user()

    if provider and provider.supports_file_upload and paper.file_path:
      cached_uri = self.get_cached_uri(paper_id)
      if cached_uri:
        return [{"file_uri": cached_uri, "mime_type": PDF_MIME_TYPE}]

      local_path = self.get_local_file_path(paper)
      if local_path:
        uri = await provider.upload_file(str(local_path))
        if uri:
          self.cache_uri(paper_id, uri)
          return [{"file_uri": uri, "mime_type": PDF_MIME_TYPE}]

    if include_text_fallback and paper.content_text:
      return [{"text": cast(str, paper.content_text)}]

    logger.warning("No content available", paper_id=paper_id)
    return []


content_provider = ContentProvider()
