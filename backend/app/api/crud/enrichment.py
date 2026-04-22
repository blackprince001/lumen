"""Helpers for enriching paper responses with per-user state."""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from app.schemas.paper import Paper as PaperSchema

if TYPE_CHECKING:
  from app.models.paper import Paper
  from app.models.sharing import UserPaperState


def enrich_paper_with_user_state(
  paper: Paper, state: UserPaperState | None
) -> PaperSchema:
  schema = PaperSchema.model_validate(paper)
  if state is not None:
    schema.reading_status = str(state.reading_status)
    schema.priority = str(state.priority)
    schema.reading_time_minutes = int(state.reading_time_minutes or 0)
    schema.last_read_page = cast(int | None, state.last_read_page)
    schema.last_read_at = state.last_read_at
    schema.status_updated_at = state.status_updated_at
  else:
    schema.reading_status = "not_started"
    schema.priority = "low"
    schema.reading_time_minutes = 0
    schema.last_read_page = None
    schema.last_read_at = None
    schema.status_updated_at = None
  return schema
