from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.ai_features import router as ai_features_router
from app.api.annotations import router as annotations_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.discovery import router as discovery_router
from app.api.duplicates import router as duplicates_router
from app.api.export import router as export_router
from app.api.groups import router as groups_router
from app.api.huggingface import router as huggingface_router
from app.api.ingest import router as ingest_router
from app.api.multi_chat import router as multi_chat_router
from app.api.papers import router as papers_router
from app.api.relationships import router as relationships_router
from app.api.search import router as search_router
from app.api.statistics import router as statistics_router
from app.api.tags import router as tags_router
from app.api.tasks import router as tasks_router
from app.api.users import router as users_router
from app.core.config import settings
from app.core.database import init_db
from app.core.logger import configure_logging, get_logger
from app.dependencies import get_current_user, require_admin

configure_logging(is_debug=settings.DEBUG)
logger = get_logger(__name__)

storage_path = Path(settings.STORAGE_PATH)
storage_path.mkdir(parents=True, exist_ok=True)


async def seed_admin_user() -> None:
  """Create or update admin user from environment variables."""
  from sqlalchemy import select

  from app.core.database import AsyncSessionLocal
  from app.core.security import decode_admin_credentials, hash_password
  from app.models.user import User

  creds = decode_admin_credentials()
  if not creds:
    logger.info("No admin credentials configured, skipping admin seed")
    return

  username, password = creds
  admin_email = f"{username}@admin.local"

  if len(password) < 8:
    logger.warning("Admin password is less than 8 characters — consider using a stronger password")

  password_hash = hash_password(password)

  async with AsyncSessionLocal() as session:
    try:
      result = await session.execute(
        select(User).where(User.email == admin_email)
      )
      user = result.scalar_one_or_none()

      if user:
        # Update password hash if credentials changed
        user.password_hash = password_hash
        user.role = "admin"
        user.auth_provider = "local"
        logger.info("Admin user updated", email=admin_email)
      else:
        user = User(
          email=admin_email,
          display_name=username,
          role="admin",
          auth_provider="local",
          password_hash=password_hash,
        )
        session.add(user)
        logger.info("Admin user created", email=admin_email)

      await session.commit()
    except Exception:
      await session.rollback()
      raise


@asynccontextmanager
async def lifespan(app: FastAPI):
  await init_db()
  await seed_admin_user()
  yield


app = FastAPI(title="Papers Research Engine", version="1.0.0", lifespan=lifespan)

# CORS — allow configured frontend + localhost for dev
allowed_origins = [settings.FRONTEND_URL]
if settings.DEBUG:
  allowed_origins.extend(["http://localhost:5173", "http://localhost:3000"])

app.add_middleware(
  CORSMiddleware,  # type: ignore[arg-type]
  allow_origins=allowed_origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# Auth routes are public (login, refresh). /auth/me and /auth/logout declare their
# own CurrentUser dependency internally, so we don't attach one at the router level.
app.include_router(auth_router, prefix="/api/v1", tags=["auth"])

# All remaining routers require an authenticated user. Admin-only endpoints add a
# stricter AdminUser dependency at the route level.
_auth_dep = [Depends(get_current_user)]
_admin_dep = [Depends(require_admin)]

app.include_router(users_router, prefix="/api/v1", tags=["users"], dependencies=_admin_dep)
app.include_router(ingest_router, prefix="/api/v1", tags=["ingest"], dependencies=_auth_dep)
app.include_router(relationships_router, prefix="/api/v1", tags=["relationships"], dependencies=_auth_dep)
app.include_router(papers_router, prefix="/api/v1", tags=["papers"], dependencies=_auth_dep)
app.include_router(annotations_router, prefix="/api/v1", tags=["annotations"], dependencies=_auth_dep)
app.include_router(groups_router, prefix="/api/v1", tags=["groups"], dependencies=_auth_dep)
app.include_router(search_router, prefix="/api/v1", tags=["search"], dependencies=_auth_dep)
app.include_router(chat_router, prefix="/api/v1", tags=["chat"], dependencies=_auth_dep)
app.include_router(multi_chat_router, prefix="/api/v1", tags=["multi-chat"], dependencies=_auth_dep)
app.include_router(tags_router, prefix="/api/v1", tags=["tags"], dependencies=_auth_dep)
app.include_router(statistics_router, prefix="/api/v1", tags=["statistics"], dependencies=_auth_dep)
app.include_router(export_router, prefix="/api/v1", tags=["export"], dependencies=_auth_dep)
app.include_router(duplicates_router, prefix="/api/v1", tags=["duplicates"], dependencies=_auth_dep)
app.include_router(ai_features_router, prefix="/api/v1", tags=["ai-features"], dependencies=_auth_dep)
app.include_router(discovery_router, prefix="/api/v1/discovery", tags=["discovery"], dependencies=_auth_dep)
app.include_router(tasks_router, prefix="/api/v1/tasks", tags=["tasks"], dependencies=_auth_dep)
app.include_router(
  huggingface_router, prefix="/api/v1/huggingface", tags=["huggingface"], dependencies=_auth_dep
)

app.mount("/storage", StaticFiles(directory=str(storage_path)), name="storage")


@app.get("/")
def read_root():
  return {"message": "Welcome to Papers API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
  """Health check including Redis and Celery status."""
  import redis

  health = {"status": "healthy", "components": {"celery": "", "redis": ""}}

  # Check Redis
  try:
    r = redis.Redis(
      host=settings.REDIS_HOST,
      port=settings.REDIS_PORT,
      db=settings.REDIS_DB,
    )
    r.ping()
    health["components"]["redis"] = "healthy"
  except Exception as e:
    health["components"]["redis"] = f"unhealthy: {str(e)}"
    health["status"] = "degraded"

  # Check Celery workers
  try:
    from app.celery_app import celery_app

    inspector = celery_app.control.inspect()
    stats = inspector.stats()
    if stats:
      health["components"]["celery"] = f"healthy ({len(stats)} workers)"
    else:
      health["components"]["celery"] = "no workers available"
      health["status"] = "degraded"
  except Exception as e:
    health["components"]["celery"] = f"unhealthy: {str(e)}"
    health["status"] = "degraded"

  return health
