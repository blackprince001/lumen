"""Celery tasks for AI operations — provider-agnostic.

Uses BaseAITask.provider instead of a hardcoded Gemini client.
"""

from typing import Any, cast

from app.celery_app import celery_app
from app.core.config import settings
from app.core.logger import get_logger
from app.models.annotation import Annotation
from app.models.paper import Paper
from app.services.ai.providers.base import EmbeddingConfig, GenerateConfig
from app.tasks.base import BaseAITask, get_sync_session
from app.utils.json_extractor import extract_json_from_text

logger = get_logger(__name__)

SUMMARY_PROMPT = """Generate a concise summary (2-3 paragraphs) of this research paper.

Paper Title: {title}

Provide a clear, structured summary covering the main objectives, methodology, key findings, and conclusions."""

FINDINGS_PROMPT = """Extract key findings from this research paper in JSON format.

Paper Title: {title}

Return a JSON object with this structure:
{{
  "key_findings": ["finding1", "finding2", ...],
  "conclusions": ["conclusion1", "conclusion2", ...],
  "methodology": "brief methodology description",
  "limitations": ["limitation1", "limitation2", ...],
  "future_work": ["future work item1", "future work item2", ...]
}}"""

READING_GUIDE_PROMPT = """Create a reading guide for this research paper.

Paper Title: {title}

Return a JSON object with this structure:
{{
  "pre_reading": ["question1", "question2", ...],
  "during_reading": ["question1", "question2", ...],
  "post_reading": ["question1", "question2", ...]
}}"""

HIGHLIGHTS_PROMPT = """Identify key sections in this research paper:
- Methods (type: "method")
- Results (type: "result")
- Conclusions (type: "conclusion")
- Key contributions (type: "key_contribution")

Paper Title: {title}

For each section, provide the exact text excerpt and its type.
IMPORTANT: Use exactly these type values: "method", "result", "conclusion", "key_contribution"

Return a JSON array with this structure:
[
  {{"text": "exact excerpt", "type": "method"}},
  {{"text": "exact excerpt", "type": "result"}},
  {{"text": "exact excerpt", "type": "conclusion"}},
  {{"text": "exact excerpt", "type": "key_contribution"}}
]"""

VALID_HIGHLIGHT_TYPES = {"method", "result", "conclusion", "key_contribution"}
HIGHLIGHT_TYPE_ALIASES = {
  "contribution": "key_contribution",
  "contributions": "key_contribution",
  "key_contributions": "key_contribution",
  "methods": "method",
  "results": "result",
  "conclusions": "conclusion",
  "finding": "result",
  "findings": "result",
}


def _build_prompt_with_content(
  prompt_template: str, paper: Paper, title: str | None = None
) -> str:
  """Build a prompt with paper title and content.

  Includes paper content as context for the AI model.
  """
  paper_title = title or paper.title or "Unknown"
  content = ""
  if paper.content_text:
    content = cast(str, paper.content_text)
    max_content_length = 15000
    if len(content) > max_content_length:
      content = content[:max_content_length] + "..."

  system = f"Paper Context:\n{paper_title}\n\n"
  if content:
    system += f"Paper Content:\n{content}\n\n"

  prompt = prompt_template.format(title=paper_title or "Unknown")
  return f"{system}\n\n{prompt}"


def _normalize_highlight_type(raw_type: str | None) -> str | None:
  if not raw_type:
    return None
  normalized = raw_type.lower().strip()
  if normalized in VALID_HIGHLIGHT_TYPES:
    return normalized
  return HIGHLIGHT_TYPE_ALIASES.get(normalized)


@celery_app.task(bind=True, base=BaseAITask, name="ai.generate_summary")
def generate_summary_task(self, paper_id: int) -> dict[str, Any]:
  """Generate AI summary for a paper."""
  session = get_sync_session()
  try:
    paper = session.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
      return {"status": "error", "error": "Paper not found", "paper_id": paper_id}

    p = self.provider
    if not p:
      return {
        "status": "error",
        "error": "No AI provider available",
        "paper_id": paper_id,
      }

    import asyncio

    full_prompt = _build_prompt_with_content(SUMMARY_PROMPT, paper)
    config = GenerateConfig(
      model=p.config.model or settings.GENAI_MODEL,
      temperature=0.3,
    )
    summary = asyncio.run(p.generate(full_prompt, config))

    paper.ai_summary = summary
    from datetime import datetime, timezone

    paper.summary_generated_at = datetime.now(timezone.utc)
    session.commit()

    logger.info("Generated summary", paper_id=paper_id)
    return {"status": "success", "paper_id": paper_id, "summary_length": len(summary)}

  except Exception as e:
    session.rollback()
    logger.error("Error generating summary", paper_id=paper_id, error=str(e))
    raise
  finally:
    session.close()


@celery_app.task(bind=True, base=BaseAITask, name="ai.extract_findings")
def extract_findings_task(self, paper_id: int) -> dict[str, Any]:
  """Extract key findings from a paper."""
  session = get_sync_session()
  try:
    paper = session.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
      return {"status": "error", "error": "Paper not found", "paper_id": paper_id}

    p = self.provider
    if not p:
      return {
        "status": "error",
        "error": "No AI provider available",
        "paper_id": paper_id,
      }

    import asyncio

    full_prompt = _build_prompt_with_content(FINDINGS_PROMPT, paper)
    config = GenerateConfig(
      model=p.config.model or settings.GENAI_MODEL, temperature=0.3
    )
    text = asyncio.run(p.generate(full_prompt, config))

    parsed = extract_json_from_text(text)
    if isinstance(parsed, dict):
      paper.key_findings = parsed
      from datetime import datetime, timezone

      paper.findings_extracted_at = datetime.now(timezone.utc)
      session.commit()
      logger.info("Extracted findings", paper_id=paper_id)
      return {"status": "success", "paper_id": paper_id, "findings": parsed}

    return {"status": "error", "error": "Invalid response format", "paper_id": paper_id}

  except Exception as e:
    session.rollback()
    logger.error("Error extracting findings", paper_id=paper_id, error=str(e))
    raise
  finally:
    session.close()


@celery_app.task(bind=True, base=BaseAITask, name="ai.generate_reading_guide")
def generate_reading_guide_task(self, paper_id: int) -> dict[str, Any]:
  """Generate reading guide for a paper."""
  session = get_sync_session()
  try:
    paper = session.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
      return {"status": "error", "error": "Paper not found", "paper_id": paper_id}

    p = self.provider
    if not p:
      return {
        "status": "error",
        "error": "No AI provider available",
        "paper_id": paper_id,
      }

    import asyncio

    full_prompt = _build_prompt_with_content(READING_GUIDE_PROMPT, paper)
    config = GenerateConfig(
      model=p.config.model or settings.GENAI_MODEL, temperature=0.3
    )
    text = asyncio.run(p.generate(full_prompt, config))

    parsed = extract_json_from_text(text)
    if isinstance(parsed, dict):
      paper.reading_guide = parsed
      from datetime import datetime, timezone

      paper.guide_generated_at = datetime.now(timezone.utc)
      session.commit()
      logger.info("Generated reading guide", paper_id=paper_id)
      return {"status": "success", "paper_id": paper_id, "guide": parsed}

    return {"status": "error", "error": "Invalid response format", "paper_id": paper_id}

  except Exception as e:
    session.rollback()
    logger.error("Error generating reading guide", paper_id=paper_id, error=str(e))
    raise
  finally:
    session.close()


@celery_app.task(bind=True, base=BaseAITask, name="ai.generate_highlights")
def generate_highlights_task(self, paper_id: int) -> dict[str, Any]:
  """Generate auto-highlights for a paper."""
  session = get_sync_session()
  try:
    paper = session.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
      return {"status": "error", "error": "Paper not found", "paper_id": paper_id}

    p = self.provider
    if not p:
      return {
        "status": "error",
        "error": "No AI provider available",
        "paper_id": paper_id,
      }

    import asyncio

    full_prompt = _build_prompt_with_content(HIGHLIGHTS_PROMPT, paper)
    config = GenerateConfig(
      model=p.config.model or settings.GENAI_MODEL, temperature=0.3
    )
    text = asyncio.run(p.generate(full_prompt, config))

    parsed = extract_json_from_text(text)
    if isinstance(parsed, list):
      count = 0
      for item in parsed:
        if not isinstance(item, dict):
          continue
        h_type = _normalize_highlight_type(item.get("type"))
        if not h_type:
          continue
        annotation = Annotation(
          paper_id=paper_id,
          content=item.get("text", ""),
          highlighted_text=item.get("text", ""),
          type="annotation",
          auto_highlighted=True,
          highlight_type=h_type,
        )
        session.add(annotation)
        count += 1
      session.commit()
      logger.info(f"Generated {count} highlights", paper_id=paper_id)
      return {"status": "success", "paper_id": paper_id, "count": count}

    return {"status": "error", "error": "Invalid response format", "paper_id": paper_id}

  except Exception as e:
    session.rollback()
    logger.error("Error generating highlights", paper_id=paper_id, error=str(e))
    raise
  finally:
    session.close()


@celery_app.task(bind=True, base=BaseAITask, name="ai.generate_embedding")
def generate_embedding_task(self, paper_id: int) -> dict[str, Any]:
  """Generate embedding for a paper."""
  session = get_sync_session()
  try:
    paper = session.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
      return {"status": "error", "error": "Paper not found", "paper_id": paper_id}

    p = self.provider
    if not p:
      return {
        "status": "error",
        "error": "No AI provider available",
        "paper_id": paper_id,
      }

    text_to_embed = paper.content_text or paper.title or ""
    if not text_to_embed:
      return {"status": "error", "error": "No text to embed", "paper_id": paper_id}

    max_chars = 20000
    import asyncio

    config = EmbeddingConfig(
      model=p.config.embedding_model or settings.EMBEDDING_MODEL,
      task_type="RETRIEVAL_DOCUMENT",
      dimensions=p.config.embedding_dimension or settings.EMBEDDING_DIMENSION,
    )
    embeddings = asyncio.run(p.embed([text_to_embed[:max_chars]], config))

    if embeddings and len(embeddings) > 0:
      paper.embedding = embeddings[0]
      session.commit()
      logger.info("Generated embedding", paper_id=paper_id)
      return {
        "status": "success",
        "paper_id": paper_id,
        "dimension": len(embeddings[0]),
      }

    return {"status": "error", "error": "No embedding returned", "paper_id": paper_id}

  except Exception as e:
    session.rollback()
    logger.error("Error generating embedding", paper_id=paper_id, error=str(e))
    raise
  finally:
    session.close()
