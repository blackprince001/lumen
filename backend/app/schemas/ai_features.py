from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class SummaryRequest(BaseModel):
  pass


class SummaryResponse(BaseModel):
  summary: Optional[str] = None
  generated_at: Optional[datetime] = None
  status: str = "completed"  # pending, processing, completed, failed


class FindingsResponse(BaseModel):
  findings: Optional[Dict] = None
  status: str = "completed"


class ReadingGuideResponse(BaseModel):
  guide: Optional[Dict] = None
  status: str = "completed"


class HighlightRequest(BaseModel):
  pass


class SelectionRect(BaseModel):
  """One highlight rect, normalized 0-1 against the page dimensions."""

  left: float
  top: float
  width: float
  height: float


class AIActionRequest(BaseModel):
  """Selection AI action: answer is saved as an anchored annotation."""

  action: Literal["explain", "why", "define"]
  selection_text: str = Field(min_length=1, max_length=4000)
  page: int = Field(ge=1)
  rects: List[SelectionRect] = []
  context: Optional[Dict[str, Any]] = None
