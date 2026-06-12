"""Provider-agnostic embedding service.

Resolves the user's configured AI provider and uses it to
generate embeddings for text content.
"""

from typing import Any

from pgvector.sqlalchemy import Vector

from app.core.config import settings
from app.core.logger import get_logger
from app.services.ai.helpers import get_provider_for_user
from app.services.ai.providers.base import (
  AIProvider,
  AIProviderError,
  EmbeddingConfig,
)

logger = get_logger(__name__)

TASK_TYPE_DOCUMENT = "RETRIEVAL_DOCUMENT"
TASK_TYPE_QUERY = "RETRIEVAL_QUERY"


class EmbeddingService:
  """Generates vector embeddings using the configured AI provider."""

  def __init__(self) -> None:
    self._provider: AIProvider | None = None

  async def _get_provider(self) -> AIProvider | None:
    """Get or create the AI provider for embeddings.

    Uses the default provider (from env settings) since embeddings
    are typically generated in system context (Celery tasks, paper ingest).
    """
    if self._provider is not None:
      return self._provider
    self._provider = await get_provider_for_user()
    return self._provider

  def set_provider(self, provider: AIProvider) -> None:
    self._provider = provider

  def _get_zero_embedding(self) -> list[float]:
    return [0.0] * settings.EMBEDDING_DIMENSION

  def _get_embedding_model(self) -> str:
    return settings.EMBEDDING_MODEL

  def _get_embedding_dimension(self) -> int:
    return settings.EMBEDDING_DIMENSION

  async def generate_embedding(
    self, text: str, task_type: str = TASK_TYPE_DOCUMENT
  ) -> list[float]:
    if not text or not text.strip():
      return self._get_zero_embedding()

    provider = await self._get_provider()
    if not provider:
      logger.warning("No AI provider available for embedding")
      return self._get_zero_embedding()

    try:
      config = EmbeddingConfig(
        model=provider.config.embedding_model or self._get_embedding_model(),
        task_type=task_type,
        dimensions=self._get_embedding_dimension(),
      )
      embeddings = await provider.embed([text], config)
      if embeddings and len(embeddings) > 0:
        return embeddings[0]
      return self._get_zero_embedding()
    except AIProviderError as e:
      logger.error("Error generating embedding", error=str(e))
      return self._get_zero_embedding()
    except Exception as e:
      logger.error("Unexpected error generating embedding", error=str(e))
      return self._get_zero_embedding()

  async def generate_embedding_async(
    self, text: str, task_type: str = TASK_TYPE_DOCUMENT
  ) -> list[float]:
    return await self.generate_embedding(text, task_type)

  async def generate_query_embedding(self, text: str) -> list[float]:
    return await self.generate_embedding(text, task_type=TASK_TYPE_QUERY)

  def _filter_empty_texts(self, texts: list[str]) -> tuple[list[int], list[str]]:
    indices: list[int] = []
    filtered_texts: list[str] = []
    for i, text in enumerate(texts):
      if text and text.strip():
        indices.append(i)
        filtered_texts.append(text)
    return indices, filtered_texts

  def _build_batch_results(
    self, texts: list[str], indices: list[int], embeddings: Any
  ) -> list[list[float]]:
    results: list[list[float]] = [self._get_zero_embedding() for _ in texts]
    if not embeddings:
      return results
    for idx, embedding in zip(indices, embeddings, strict=True):
      results[idx] = list(embedding.values)
    return results

  async def generate_embeddings_batch(
    self, texts: list[str], task_type: str = TASK_TYPE_DOCUMENT
  ) -> list[list[float]]:
    if not texts:
      return []

    provider = await self._get_provider()
    if not provider:
      logger.warning("No AI provider available for batch embedding")
      return [self._get_zero_embedding() for _ in texts]

    indices, filtered_texts = self._filter_empty_texts(texts)
    if not filtered_texts:
      return [self._get_zero_embedding() for _ in texts]

    try:
      config = EmbeddingConfig(
        model=provider.config.embedding_model or self._get_embedding_model(),
        task_type=task_type,
        dimensions=self._get_embedding_dimension(),
      )
      embeddings = await provider.embed(filtered_texts, config)
      if not embeddings:
        return [self._get_zero_embedding() for _ in texts]

      results: list[list[float]] = [self._get_zero_embedding() for _ in texts]
      for idx, emb in zip(indices, embeddings, strict=True):
        results[idx] = emb
      return results
    except AIProviderError as e:
      logger.error("Error generating batch embeddings", error=str(e))
      return [self._get_zero_embedding() for _ in texts]
    except Exception as e:
      logger.error("Unexpected error generating batch embeddings", error=str(e))
      return [self._get_zero_embedding() for _ in texts]

  def get_embedding_dimension(self) -> int:
    return settings.EMBEDDING_DIMENSION

  async def text_to_vector(self, text: str) -> Vector:
    embedding = await self.generate_embedding(text)
    return Vector(embedding)


embedding_service = EmbeddingService()
