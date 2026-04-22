from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict

from app.schemas.paper import Paper


class CanvasItemCreate(BaseModel):
  paper_id: int
  x: float
  y: float


class CanvasItemPosition(BaseModel):
  paper_id: int
  x: float
  y: float


class CanvasItemPositionUpdate(BaseModel):
  x: float
  y: float


class CanvasBulkPositions(BaseModel):
  items: List[CanvasItemPosition]


class CanvasItem(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  paper_id: int
  x: float
  y: float
  created_at: datetime
  updated_at: datetime
  paper: Paper


class CanvasEdge(BaseModel):
  source: int
  target: int


class CanvasResponse(BaseModel):
  items: List[CanvasItem]
  edges: List[CanvasEdge]
