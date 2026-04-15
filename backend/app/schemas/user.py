from datetime import datetime

from pydantic import BaseModel


class UserResponse(BaseModel):
  id: int
  email: str
  display_name: str
  avatar_url: str | None = None
  organization: str | None = None
  department: str | None = None
  research_field: str | None = None
  role: str
  is_active: bool
  created_at: datetime

  model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
  display_name: str | None = None
  organization: str | None = None
  department: str | None = None
  research_field: str | None = None
  bio: str | None = None


class AdminUserUpdate(BaseModel):
  is_active: bool | None = None
  role: str | None = None


class UserAnalytics(BaseModel):
  id: int
  email: str
  display_name: str
  organization: str | None = None
  role: str
  is_active: bool
  login_count: int
  last_login_at: datetime | None = None
  papers_uploaded: int = 0
  annotations_count: int = 0
  total_reading_minutes: int = 0
  created_at: datetime

  model_config = {"from_attributes": True}
