"""Authentication endpoints: Google OAuth, admin login, token refresh, logout."""

from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.core.rate_limit import rate_limit
from app.core.security import (
  create_access_token,
  create_refresh_token,
  decode_admin_credentials,
  get_refresh_token_expiry,
  hash_token,
  verify_google_id_token,
  verify_password,
)
from app.dependencies import CurrentUser, get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
  AdminLoginRequest,
  GoogleAuthRequest,
  RefreshResponse,
  TokenResponse,
)
from app.schemas.user import UserProfileUpdate, UserResponse

logger = get_logger(__name__)

router = APIRouter()

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days


def _set_refresh_cookie(response: Response, token: str) -> None:
  response.set_cookie(
    key=REFRESH_COOKIE_NAME,
    value=token,
    httponly=True,
    secure=False,  # Set to True in production with HTTPS
    samesite="lax",
    max_age=REFRESH_COOKIE_MAX_AGE,
    path="/",
  )


def _clear_refresh_cookie(response: Response) -> None:
  response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")


async def _issue_tokens(
  user: User, db: AsyncSession, response: Response
) -> TokenResponse:
  """Create access + refresh tokens and set refresh cookie."""
  access_token, expires_in = create_access_token(user.id, user.role, user.email)
  refresh = create_refresh_token()

  # Store refresh token hash in DB
  db_token = RefreshToken(
    user_id=user.id,
    token_hash=hash_token(refresh),
    expires_at=get_refresh_token_expiry(),
  )
  db.add(db_token)

  # Update login stats
  user.last_login_at = datetime.now(timezone.utc)
  user.login_count = (user.login_count or 0) + 1

  await db.flush()

  _set_refresh_cookie(response, refresh)

  return TokenResponse(
    access_token=access_token,
    expires_in=expires_in,
    user=UserResponse.model_validate(user),
  )


@router.post("/auth/google", response_model=TokenResponse)
async def google_auth(
  request: GoogleAuthRequest,
  req: Request,
  response: Response,
  db: AsyncSession = Depends(get_db),
):
  """Verify Google ID token and issue JWT tokens."""
  await rate_limit(req, max_requests=20, window_seconds=60)
  try:
    google_user = verify_google_id_token(request.id_token)
  except ValueError as e:
    raise HTTPException(status_code=401, detail=str(e))

  # Find existing user by google_id or email
  result = await db.execute(
    select(User).where(
      (User.google_id == google_user["sub"]) | (User.email == google_user["email"])
    )
  )
  user = result.scalar_one_or_none()

  if user:
    if not user.is_active:
      raise HTTPException(status_code=403, detail="Account has been deactivated")
    # Update profile from Google if changed
    if not user.google_id:
      user.google_id = google_user["sub"]
    user.avatar_url = google_user.get("picture") or user.avatar_url
    user.display_name = google_user.get("name") or user.display_name
  else:
    # Create new user
    user = User(
      email=google_user["email"],
      google_id=google_user["sub"],
      display_name=google_user["name"],
      avatar_url=google_user.get("picture"),
      role="user",
      auth_provider="google",
    )
    db.add(user)
    await db.flush()  # Get the ID
    logger.info("New user registered via Google", email=google_user["email"])

  return await _issue_tokens(user, db, response)


@router.post("/auth/admin/login", response_model=TokenResponse)
async def admin_login(
  request: AdminLoginRequest,
  req: Request,
  response: Response,
  db: AsyncSession = Depends(get_db),
):
  """Authenticate admin with username/password from env vars."""
  await rate_limit(req, max_requests=5, window_seconds=60)
  creds = decode_admin_credentials()
  if not creds:
    raise HTTPException(status_code=401, detail="Admin login is not configured")

  admin_username, _ = creds

  if request.username != admin_username:
    raise HTTPException(status_code=401, detail="Invalid credentials")

  # Look up the admin user (seeded on startup)
  admin_email = f"{admin_username}@admin.local"
  result = await db.execute(
    select(User).where(User.email == admin_email, User.role == "admin")
  )
  user = result.scalar_one_or_none()

  if not user or not user.password_hash:
    raise HTTPException(status_code=401, detail="Invalid credentials")

  if not verify_password(request.password, user.password_hash):
    raise HTTPException(status_code=401, detail="Invalid credentials")

  if not user.is_active:
    raise HTTPException(status_code=403, detail="Account has been deactivated")

  return await _issue_tokens(user, db, response)


@router.post("/auth/refresh", response_model=RefreshResponse)
async def refresh_token(
  req: Request,
  response: Response,
  db: AsyncSession = Depends(get_db),
  refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
):
  """Use refresh token cookie to get a new access token."""
  await rate_limit(req, max_requests=10, window_seconds=60)
  if not refresh_token:
    raise HTTPException(status_code=401, detail="No refresh token")

  token_hash = hash_token(refresh_token)
  result = await db.execute(
    select(RefreshToken).where(
      RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None)
    )
  )
  db_token = result.scalar_one_or_none()

  if not db_token:
    # Possible token theft — a revoked token was reused
    # For safety, we could revoke all tokens for this user, but we don't know
    # who the user is from a revoked token. Just reject.
    _clear_refresh_cookie(response)
    raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

  if db_token.expires_at < datetime.now(timezone.utc):
    db_token.revoked_at = datetime.now(timezone.utc)
    _clear_refresh_cookie(response)
    raise HTTPException(status_code=401, detail="Refresh token expired")

  # Load user
  user_result = await db.execute(select(User).where(User.id == db_token.user_id))
  user = user_result.scalar_one_or_none()

  if not user or not user.is_active:
    db_token.revoked_at = datetime.now(timezone.utc)
    _clear_refresh_cookie(response)
    raise HTTPException(status_code=401, detail="User not found or deactivated")

  # Rotate: revoke old, issue new
  db_token.revoked_at = datetime.now(timezone.utc)

  new_refresh = create_refresh_token()
  new_db_token = RefreshToken(
    user_id=user.id,
    token_hash=hash_token(new_refresh),
    expires_at=get_refresh_token_expiry(),
  )
  db.add(new_db_token)

  access_token, expires_in = create_access_token(user.id, user.role, user.email)
  _set_refresh_cookie(response, new_refresh)

  return RefreshResponse(access_token=access_token, expires_in=expires_in)


@router.post("/auth/logout")
async def logout(
  response: Response,
  user: CurrentUser,
  db: AsyncSession = Depends(get_db),
  refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
):
  """Revoke refresh token and clear cookie."""
  if refresh_token:
    token_hash = hash_token(refresh_token)
    result = await db.execute(
      select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    db_token = result.scalar_one_or_none()
    if db_token:
      db_token.revoked_at = datetime.now(timezone.utc)

  _clear_refresh_cookie(response)
  return {"detail": "Logged out"}


@router.get("/auth/me", response_model=UserResponse)
async def get_me(user: CurrentUser):
  """Get current user profile."""
  return UserResponse.model_validate(user)


@router.patch("/auth/me", response_model=UserResponse)
async def update_me(
  update: UserProfileUpdate,
  user: CurrentUser,
  db: AsyncSession = Depends(get_db),
):
  """Update current user profile."""
  update_data = update.model_dump(exclude_unset=True)
  for field, value in update_data.items():
    setattr(user, field, value)
  await db.flush()
  return UserResponse.model_validate(user)
