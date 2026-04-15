# Celery tasks module
# Import all tasks to ensure they are registered with Celery

from app.tasks.ai_tasks import (
  extract_findings_task,
  generate_embedding_task,
  generate_highlights_task,
  generate_reading_guide_task,
  generate_summary_task,
)
from app.tasks.paper_processing import (
  extract_citations_task,
  process_paper_full,
)
from app.tasks.discovery_tasks import (
  search_source_task,
  ai_enhance_task,
)

__all__ = [
  "generate_summary_task",
  "extract_findings_task",
  "generate_reading_guide_task",
  "generate_highlights_task",
  "generate_embedding_task",
  "extract_citations_task",
  "process_paper_full",
  "search_source_task",
  "ai_enhance_task",
]
