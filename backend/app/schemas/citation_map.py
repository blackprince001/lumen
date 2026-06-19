from pydantic import BaseModel


class NodePosition(BaseModel):
  x: float
  y: float


class MapNode(BaseModel):
  key: str
  s2_id: str | None = None
  library_paper_id: int | None = None
  title: str
  authors: str = ""
  year: int | None = None
  citation_count: int | None = None
  is_focal: bool = False
  is_library: bool = False
  shared: bool = False
  doi: str | None = None
  url: str | None = None
  position: NodePosition | None = None


class MapEdge(BaseModel):
  source: str
  target: str
  type: str  # "reference" — focal paper cites target


class UnresolvedPaper(BaseModel):
  library_paper_id: int
  title: str


class CitationMapResponse(BaseModel):
  nodes: list[MapNode]
  edges: list[MapEdge]
  focal_paper_ids: list[int]
  unresolved: list[UnresolvedPaper]


class FocalCreate(BaseModel):
  paper_id: int


class PositionUpdate(BaseModel):
  node_key: str
  x: float
  y: float


class BulkPositions(BaseModel):
  positions: list[PositionUpdate]


class CitedByPaper(BaseModel):
  s2_id: str | None = None
  title: str | None = None
  authors: list[str] = []
  year: int | None = None
  citation_count: int | None = None
  doi: str | None = None
  url: str | None = None


class CitedByResponse(BaseModel):
  paper_id: int
  resolved: bool
  citations: list[CitedByPaper]
  offset: int = 0
  limit: int = 25
  has_more: bool = False
