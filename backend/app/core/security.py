"""JWT, password hashing, and Google token verification utilities."""

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
  return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
  return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: int, role: str, email: str) -> tuple[str, int]:
  """Create a JWT access token. Returns (token, expires_in_seconds)."""
  expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
  now = datetime.now(timezone.utc)
  expire = now + expires_delta
  payload = {
    "sub": str(user_id),
    "email": email,
    "role": role,
    "iat": now,
    "exp": expire,
    "type": "access",
  }
  token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
  return token, int(expires_delta.total_seconds())


def verify_access_token(token: str) -> dict:
  """Verify and decode an access token. Raises ValueError on failure."""
  try:
    payload = jwt.decode(
      token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )
    if payload.get("type") != "access":
      raise ValueError("Not an access token")
    return payload
  except jwt.ExpiredSignatureError:
    raise ValueError("Token has expired")  # noqa: B904
  except jwt.InvalidTokenError as e:
    raise ValueError(f"Invalid token: {e}")  # noqa: B904


def create_refresh_token() -> str:
  """Generate a cryptographically random refresh token."""
  return secrets.token_hex(32)


def hash_token(token: str) -> str:
  """SHA-256 hash a token for database storage."""
  return hashlib.sha256(token.encode()).hexdigest()


def get_refresh_token_expiry() -> datetime:
  return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


def verify_google_id_token(token: str) -> dict:
  """Verify a Google ID token and return user info.

  Returns dict with keys: sub, email, name, picture.
  Raises ValueError on verification failure.
  """
  if not settings.GOOGLE_CLIENT_ID:
    raise ValueError("GOOGLE_CLIENT_ID is not configured")

  try:
    idinfo = google_id_token.verify_oauth2_token(
      token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
    )

    if idinfo["iss"] not in ("accounts.google.com", "https://accounts.google.com"):
      raise ValueError("Invalid token issuer")

    return {
      "sub": idinfo["sub"],
      "email": idinfo["email"],
      "name": idinfo.get("name", idinfo["email"].split("@")[0]),
      "picture": idinfo.get("picture"),
    }
  except Exception as e:
    raise ValueError(f"Google token verification failed: {e}")  # noqa: B904


def decode_admin_credentials() -> tuple[str, str] | None:
  """Decode base64-encoded admin credentials from env vars.

  Returns (username, password) or None if not configured.
  """
  if not settings.ADMIN_USERNAME or not settings.ADMIN_PASSWORD:
    return None

  try:
    username = base64.b64decode(settings.ADMIN_USERNAME).decode("utf-8")
    password = base64.b64decode(settings.ADMIN_PASSWORD).decode("utf-8")
    return username, password
  except Exception:
    return None
