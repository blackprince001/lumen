from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ShareRequest(BaseModel):
  emails: list[str] = Field(min_length=1)
  permission: Literal["viewer", "editor"] = "viewer"


class ShareUpdate(BaseModel):
  permission: Literal["viewer", "editor"]


class ShareRecipient(BaseModel):
  user_id: int
  email: str
  display_name: str
  permission: Literal["viewer", "editor"]
  shared_by_id: int | None = None
  created_at: datetime


class ShareListResponse(BaseModel):
  shares: list[ShareRecipient]
  missing_emails: list[str] = Field(default_factory=list)
  skipped_emails: list[str] = Field(default_factory=list)
