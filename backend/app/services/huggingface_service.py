from datetime import date
from typing import List

import httpx

from app.core.logger import get_logger
from app.schemas.huggingface import HFPaperItem

logger = get_logger(__name__)

HF_DAILY_PAPERS_API = "https://huggingface.co/api/daily_papers"


class HuggingFaceService:
  def __init__(self) -> None:
    self._timeout = 30.0

  def _build_paper_url(self, paper_id: str) -> str:
    return f"https://huggingface.co/papers/{paper_id}"

  async def fetch_daily_papers(
    self, target_date: date | None = None
  ) -> List[HFPaperItem]:
    if target_date is None:
      target_date = date.today()

    # Format date as YYYY-MM-DD
    date_str = target_date.strftime("%Y-%m-%d")
    url = f"{HF_DAILY_PAPERS_API}?date={date_str}"

    logger.info("Fetching HuggingFace daily papers", date=date_str, url=url)

    try:
      async with httpx.AsyncClient(timeout=self._timeout) as client:
        response = await client.get(url)
        response.raise_for_status()

        raw_items = response.json()

        papers = []
        for item in raw_items:
          if item.get("paper"):
            try:
              paper_item = HFPaperItem.model_validate(item)
              # Set computed paperUrl
              paper_item.paperUrl = self._build_paper_url(paper_item.paper.id)
              papers.append(paper_item)
            except Exception as e:
              logger.warning(
                "Failed to parse paper item",
                error=str(e),
                item_title=item.get("title", "unknown"),
              )

        logger.info(
          "Successfully fetched HuggingFace papers",
          date=date_str,
          count=len(papers),
        )
        return papers

    except httpx.HTTPStatusError as e:
      logger.error(
        "HuggingFace API HTTP error",
        status_code=e.response.status_code,
        date=date_str,
      )
      return []
    except httpx.RequestError as e:
      logger.error("HuggingFace API request error", error=str(e), date=date_str)
      return []
    except Exception as e:
      logger.error(
        "Unexpected error fetching HuggingFace papers",
        error=str(e),
        date=date_str,
      )
      return []


huggingface_service = HuggingFaceService()
