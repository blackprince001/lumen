from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reading_session import ReadingSession
from app.models.sharing import UserPaperState
from app.schemas.reading_progress import ReadingStatistics, ReadingStreak


class ReadingTrackerService:
  async def calculate_statistics(self, session: AsyncSession, user_id: int | None = None) -> ReadingStatistics:
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    month_start = now.replace(day=1)
    year_start = now.replace(month=1, day=1)

    def _state_filter(q):
      if user_id is not None:
        return q.where(UserPaperState.user_id == user_id)
      return q

    papers_read_this_week = (
      await session.scalar(
        _state_filter(select(func.count()).select_from(UserPaperState).where(
          UserPaperState.reading_status == "read",
          UserPaperState.status_updated_at >= week_start,
        ))
      )
      or 0
    )

    papers_read_this_month = (
      await session.scalar(
        _state_filter(select(func.count()).select_from(UserPaperState).where(
          UserPaperState.reading_status == "read",
          UserPaperState.status_updated_at >= month_start,
        ))
      )
      or 0
    )

    papers_read_this_year = (
      await session.scalar(
        _state_filter(select(func.count()).select_from(UserPaperState).where(
          UserPaperState.reading_status == "read",
          UserPaperState.status_updated_at >= year_start,
        ))
      )
      or 0
    )

    total_reading_time = (
      await session.scalar(
        _state_filter(select(func.sum(UserPaperState.reading_time_minutes)).select_from(UserPaperState))
      )
      or 0
    )

    total_papers = (
      await session.scalar(
        _state_filter(select(func.count()).select_from(UserPaperState))
      )
      or 1
    )
    average_reading_time = total_reading_time / total_papers if total_papers > 0 else 0.0

    streak_data = await self._calculate_streak(session, user_id=user_id)

    status_dist = await session.execute(
      _state_filter(
        select(UserPaperState.reading_status, func.count())
        .select_from(UserPaperState)
        .group_by(UserPaperState.reading_status)
        .where(UserPaperState.reading_status.isnot(None))
      )
    )
    status_distribution = {status: count for status, count in status_dist.fetchall()}

    priority_dist = await session.execute(
      _state_filter(
        select(UserPaperState.priority, func.count())
        .select_from(UserPaperState)
        .group_by(UserPaperState.priority)
        .where(UserPaperState.priority.isnot(None))
      )
    )
    priority_distribution = {priority: count for priority, count in priority_dist.fetchall()}

    return ReadingStatistics(
      papers_read_this_week=papers_read_this_week,
      papers_read_this_month=papers_read_this_month,
      papers_read_this_year=papers_read_this_year,
      total_reading_time_minutes=total_reading_time,
      average_reading_time_per_paper=average_reading_time,
      reading_streak_days=streak_data.current_streak,
      status_distribution=status_distribution,
      priority_distribution=priority_distribution,
    )

  async def _calculate_streak(self, session: AsyncSession, user_id: int | None = None) -> ReadingStreak:
    q = (
      select(func.date(ReadingSession.start_time).label("date"))
      .distinct()
      .order_by(func.date(ReadingSession.start_time).desc())
    )
    if user_id is not None:
      q = q.where(ReadingSession.user_id == user_id)
    sessions = await session.execute(q)

    dates_with_activity = [row[0] for row in sessions.fetchall() if row[0]]

    if not dates_with_activity:
      return ReadingStreak(
        current_streak=0,
        longest_streak=0,
        streak_start_date=None,
        last_reading_date=None,
      )

    dates_with_activity = sorted(set(dates_with_activity), reverse=True)
    last_reading_date = dates_with_activity[0]

    current_streak = 0
    today = datetime.now(timezone.utc).date()
    expected_date = today

    for date in dates_with_activity:
      if date == expected_date:
        current_streak += 1
        expected_date = expected_date - timedelta(days=1)
      elif date < expected_date:
        break

    longest_streak = 0
    current_run = 0
    prev_date = None

    for date in sorted(dates_with_activity, reverse=False):
      if prev_date is None:
        current_run = 1
      elif (date - prev_date).days == 1:
        current_run += 1
      else:
        longest_streak = max(longest_streak, current_run)
        current_run = 1
      prev_date = date

    longest_streak = max(longest_streak, current_run)

    streak_start_date = (
      dates_with_activity[current_streak - 1] if current_streak > 0 else None
    )

    return ReadingStreak(
      current_streak=current_streak,
      longest_streak=longest_streak,
      streak_start_date=datetime.combine(
        streak_start_date, datetime.min.time()
      ).replace(tzinfo=timezone.utc)
      if streak_start_date
      else None,
      last_reading_date=datetime.combine(
        last_reading_date, datetime.min.time()
      ).replace(tzinfo=timezone.utc)
      if last_reading_date
      else None,
    )

  async def get_reading_streak(self, session: AsyncSession, user_id: int | None = None) -> ReadingStreak:
    return await self._calculate_streak(session, user_id=user_id)

  async def aggregate_reading_time(self, session: AsyncSession, paper_id: int) -> int:
    total_minutes = await session.scalar(
      select(func.sum(ReadingSession.duration_minutes)).where(
        ReadingSession.paper_id == paper_id
      )
    )
    return total_minutes or 0


reading_tracker_service = ReadingTrackerService()
