from typing import TYPE_CHECKING, Annotated, AsyncGenerator

from fastapi import Depends, HTTPException, Path
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import verify_access_token

if TYPE_CHECKING:
  from app.models.paper import Paper
  from app.models.user import User

# Bearer token extraction — auto_error=False so we can make it optional
_bearer_scheme = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
  async for session in get_session():
    yield session


async def get_current_user(
  credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
  session: AsyncSession = Depends(get_db),
) -> "User":
  """Decode JWT and load user. Raises 401 on any failure."""
  from app.models.user import User

  if not credentials:
    raise HTTPException(status_code=401, detail="Not authenticated")

  try:
    payload = verify_access_token(credentials.credentials)
  except ValueError as e:
    raise HTTPException(status_code=401, detail=str(e))  # noqa: B904

  raw_sub = payload.get("sub")
  if not raw_sub:
    raise HTTPException(status_code=401, detail="Invalid token payload")
  try:
    user_id = int(raw_sub)
  except (TypeError, ValueError):
    raise HTTPException(status_code=401, detail="Invalid token payload")  # noqa: B904

  result = await session.execute(select(User).where(User.id == user_id))
  user = result.scalar_one_or_none()

  if not user:
    raise HTTPException(status_code=401, detail="User not found")
  if not user.is_active:
    raise HTTPException(status_code=403, detail="Account has been deactivated")

  return user


async def require_admin(
  user: "User" = Depends(get_current_user),
) -> "User":
  """Requires the current user to have admin role."""
  if user.role != "admin":
    raise HTTPException(status_code=403, detail="Admin access required")
  return user


async def get_optional_user(
  credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
  session: AsyncSession = Depends(get_db),
) -> "User | None":
  """Returns user if token present and valid, None otherwise."""
  if not credentials:
    return None
  try:
    return await get_current_user(credentials, session)
  except HTTPException:
    return None


# Type aliases for clean route signatures
CurrentUser = Annotated["User", Depends(get_current_user)]
AdminUser = Annotated["User", Depends(require_admin)]
OptionalUser = Annotated["User | None", Depends(get_optional_user)]


def scoped_user_id(user: "User") -> int | None:
  """Returns user.id for regular users, None for admins (no filter = see all)."""
  return None if user.role == "admin" else user.id


async def get_paper_or_404(
  paper_id: Annotated[int, Path(description="The paper ID")],
  session: AsyncSession = Depends(get_db),
) -> "Paper":
  """Dependency that fetches a paper by ID or raises 404."""
  from sqlalchemy.orm import selectinload

  from app.models.paper import Paper

  query = select(Paper).where(Paper.id == paper_id).options(selectinload(Paper.tags))
  result = await session.execute(query)
  paper = result.scalar_one_or_none()

  if not paper:
    raise HTTPException(status_code=404, detail="Paper not found")

  return paper


# Type alias for cleaner dependency injection
PaperDep = Annotated["Paper", Depends(get_paper_or_404)]
