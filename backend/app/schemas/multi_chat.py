"""Schemas for multi-paper chat (group/selection-based AI conversations)."""

import base64
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


def generate_multi_session_name() -> str:
  """Generate a random base64 session name."""
  return base64.urlsafe_b64encode(secrets.token_bytes(6)).decode()


# --- Paper summary (lightweight representation) ---


class PaperSummary(BaseModel):
  id: int
  title: str
  has_file: bool = False

  class Config:
    from_attributes = True


# --- Messages ---


class MultiChatMessageBase(BaseModel):
  role: str  # 'user' or 'assistant'
  content: str
  references: Optional[Dict[str, Any]] = {}


class MultiChatMessageCreate(BaseModel):
  content: str
  references: Optional[Dict[str, Any]] = {}


class MultiChatMessage(MultiChatMessageBase):
  id: int
  session_id: int
  parent_message_id: Optional[int] = None
  thread_count: int = 0
  created_at: datetime

  model_config = {"from_attributes": True}


# --- Sessions ---


class MultiChatSessionCreate(BaseModel):
  paper_ids: Optional[List[int]] = None
  group_id: Optional[int] = None
  name: str = Field(default_factory=generate_multi_session_name)


class MultiChatSessionUpdate(BaseModel):
  name: str


class MultiChatSession(BaseModel):
  id: int
  name: str
  group_id: Optional[int] = None
  paper_ids: List[int] = []
  papers: List[PaperSummary] = []
  messages: List[MultiChatMessage] = []
  created_at: datetime
  updated_at: datetime

  model_config = {"from_attributes": True}


# --- Request / Response ---


class MultiChatRequest(BaseModel):
  message: str
  references: Optional[Dict[str, Any]] = {}
  session_id: Optional[int] = None
  paper_ids: Optional[List[int]] = None
  group_id: Optional[int] = None


class MultiChatResponse(BaseModel):
  message: MultiChatMessage
  session: MultiChatSession
