from pydantic import BaseModel

from app.schemas.user import UserResponse


class GoogleAuthRequest(BaseModel):
  id_token: str


class AdminLoginRequest(BaseModel):
  username: str
  password: str


class TokenResponse(BaseModel):
  access_token: str
  token_type: str = "bearer"
  expires_in: int
  user: UserResponse


class RefreshResponse(BaseModel):
  access_token: str
  token_type: str = "bearer"
  expires_in: int
