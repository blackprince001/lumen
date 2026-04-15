from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, get_db, scoped_user_id
from app.schemas.reading_progress import ReadingStatistics, ReadingStreak
from app.services.reading_tracker import reading_tracker_service

router = APIRouter()


@router.get("/statistics/dashboard", response_model=ReadingStatistics)
async def get_dashboard_statistics(user: CurrentUser, session: AsyncSession = Depends(get_db)):
  return await reading_tracker_service.calculate_statistics(session, user_id=scoped_user_id(user))


@router.get("/statistics/reading-streaks", response_model=ReadingStreak)
async def get_reading_streaks(user: CurrentUser, session: AsyncSession = Depends(get_db)):
  return await reading_tracker_service.get_reading_streak(session, user_id=scoped_user_id(user))
