from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Query

from app.core.logger import get_logger
from app.dependencies import CurrentUser
from app.schemas.huggingface import HFDailyPapersResponse
from app.services.huggingface_service import huggingface_service

logger = get_logger(__name__)

router = APIRouter()


@router.get("/daily-papers", response_model=HFDailyPapersResponse)
async def get_daily_papers(
  target_date: Optional[str] = Query(
    default=None,
    alias="date",
    description="Date to fetch papers for (YYYY-MM-DD format). Defaults to today.",
    examples=["2026-02-06"],
  ),
):
  if target_date:
    try:
      parsed_date = datetime.strptime(target_date, "%Y-%m-%d").date()
    except ValueError:
      logger.warning("Invalid date format, using today", input_date=target_date)
      parsed_date = date.today()
  else:
    parsed_date = date.today()

  papers = await huggingface_service.fetch_daily_papers(parsed_date)

  return HFDailyPapersResponse(
    date=parsed_date.strftime("%Y-%m-%d"),
    papers=papers,
    total_count=len(papers),
  )
