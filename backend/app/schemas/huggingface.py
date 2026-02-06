"""Pydantic schemas for HuggingFace Daily Papers API."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class HFAuthor(BaseModel):
  """Author information from HuggingFace paper."""

  name: str
  hidden: bool = False


class HFSubmittedBy(BaseModel):
  """User who submitted the paper."""

  fullname: Optional[str] = None
  user: Optional[str] = None
  avatarUrl: Optional[str] = None


class HFOrganization(BaseModel):
  """Organization associated with a paper."""

  name: str
  fullname: str
  avatar: Optional[str] = None


class HFPaperCore(BaseModel):
  """Core paper information from HuggingFace API."""

  id: str
  title: str
  authors: List[HFAuthor] = Field(default_factory=list)
  summary: Optional[str] = None
  ai_summary: Optional[str] = None
  ai_keywords: List[str] = Field(default_factory=list)
  upvotes: int = 0
  publishedAt: Optional[datetime] = None
  discussionId: Optional[str] = None
  projectPage: Optional[str] = None
  githubRepo: Optional[str] = None
  githubStars: Optional[int] = None


class HFPaperItem(BaseModel):
  """Full paper item from daily papers API response."""

  paper: HFPaperCore
  title: str
  summary: Optional[str] = None
  thumbnail: Optional[str] = None
  numComments: int = 0
  publishedAt: Optional[datetime] = None
  submittedBy: Optional[HFSubmittedBy] = None
  organization: Optional[HFOrganization] = None
  isAuthorParticipating: bool = False

  # Computed field - set after fetch
  paperUrl: Optional[str] = None


class HFDailyPapersResponse(BaseModel):
  """Response for daily papers endpoint."""

  date: str
  papers: List[HFPaperItem]
  total_count: int
