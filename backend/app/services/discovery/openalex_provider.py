"""Discovery provider for OpenAlex — open index of 250M+ scholarly works.

* Free, no API key required for basic usage
* Covers all disciplines, not just CS/ML
* Supports author profiles and topic classification
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.logger import get_logger
from app.services.discovery.base_provider import (
  BaseDiscoveryProvider,
  ExternalPaperResult,
  SearchFilters,
)

logger = get_logger(__name__)


def _reconstruct_abstract(inverted_index: dict | None) -> str | None:
  """Rebuild abstract string from OpenAlex's inverted index format."""
  if not inverted_index:
    return None
  word_positions: list[tuple[int, str]] = []
  for word, positions in inverted_index.items():
    for pos in positions:
      word_positions.append((pos, word))
  word_positions.sort(key=lambda x: x[0])
  return " ".join(word for _, word in word_positions)


class OpenAlexProvider(BaseDiscoveryProvider):
  """Discovery provider for OpenAlex."""

  name = "openalex"
  display_name = "OpenAlex"
  description = "Open index of 250M+ scholarly works across all disciplines"
  base_url = "https://api.openalex.org"

  supports_search = True
  supports_citations = True
  supports_recommendations = False

  # Without key: 10 req/s (polite pool); with key: higher limits
  requests_per_second = 10.0

  def _get_headers(self) -> Dict[str, str]:
    headers = {}
    if settings.OPENALEX_API_KEY:
      headers["api_key"] = settings.OPENALEX_API_KEY
    return headers

  def _get_params(self, extra: Dict[str, Any] | None = None) -> Dict[str, Any]:
    params: Dict[str, Any] = {}
    if settings.OPENALEX_API_KEY:
      params["api_key"] = settings.OPENALEX_API_KEY
    if extra:
      params.update(extra)
    return params

  async def search(
    self,
    query: str,
    filters: Optional[SearchFilters] = None,
    limit: int = 20,
  ) -> List[ExternalPaperResult]:
    params = self._get_params(
      {
        "search": query,
        "per_page": min(limit, 50),
        "sort": "relevance_score:desc",
      }
    )

    if filters:
      if filters.year_from or filters.year_to:
        year_filter = ""
        if filters.year_from:
          year_filter += str(filters.year_from)
        year_filter += "-"
        if filters.year_to:
          year_filter += str(filters.year_to)
        params["filter"] = f"publication_year:{year_filter}"

    try:
      data = await self._get("works", params)
      results = data.get("results", [])
      return [self._format_work(w) for w in results if w.get("id")]
    except Exception as e:
      logger.error("OpenAlex search failed", error=str(e), query=query)
      return []

  async def get_paper_details(
    self,
    external_id: str,
  ) -> Optional[ExternalPaperResult]:
    oaid = self._resolve_id(external_id)
    params = self._get_params()
    try:
      data = await self._get(f"works/{oaid}", params)
      if data and data.get("id"):
        return self._format_work(data)
      return None
    except Exception as e:
      logger.error(
        "OpenAlex get_paper_details failed",
        error=str(e),
        external_id=external_id,
      )
      return None

  async def get_citations(
    self,
    external_id: str,
    limit: int = 10,
  ) -> List[ExternalPaperResult]:
    oaid = self._resolve_id(external_id)
    params = self._get_params({"per_page": min(limit, 50)})
    try:
      data = await self._get(f"works/{oaid}/citations", params)
      results = data.get("results", [])
      return [self._format_work(w) for w in results if w.get("id")]
    except Exception as e:
      logger.error(
        "OpenAlex get_citations failed",
        error=str(e),
        external_id=external_id,
      )
      return []

  async def get_references(
    self,
    external_id: str,
    limit: int = 10,
  ) -> List[ExternalPaperResult]:
    """Fetch referenced works by first getting the work's referenced_works list,
    then fetching each referenced work in parallel."""
    oaid = self._resolve_id(external_id)
    params_work = self._get_params({"select": "id,referenced_works"})
    try:
      work_data = await self._get(f"works/{oaid}", params_work)
      ref_ids: list[str] = work_data.get("referenced_works", [])[:limit]
      if not ref_ids:
        return []

      import asyncio

      params_ref = self._get_params(
        {"select": "id,title,authorships,publication_year,doi,cited_by_count"}
      )
      ref_tasks = [
        self._get(f"works/{self._extract_id(rid)}", params_ref) for rid in ref_ids
      ]
      ref_results = await asyncio.gather(*ref_tasks, return_exceptions=True)

      papers = []
      for r in ref_results:
        if isinstance(r, dict) and r.get("id"):
          papers.append(self._format_work(r))
      return papers
    except Exception as e:
      logger.error(
        "OpenAlex get_references failed",
        error=str(e),
        external_id=external_id,
      )
      return []

  async def search_authors(
    self,
    query: str,
    limit: int = 10,
  ) -> List[Dict[str, Any]]:
    """Search for author profiles."""
    params = self._get_params(
      {
        "search": query,
        "per_page": min(limit, 50),
      }
    )
    try:
      data = await self._get("authors", params)
      return data.get("results", [])
    except Exception as e:
      logger.error("OpenAlex author search failed", error=str(e), query=query)
      return []

  async def get_author_details(
    self,
    author_id: str,
  ) -> Optional[Dict[str, Any]]:
    """Get full author profile with works count, h-index, institutions."""
    oaid = self._resolve_id(author_id)
    params = self._get_params()
    try:
      data = await self._get(f"authors/{oaid}", params)
      return data if data.get("id") else None
    except Exception as e:
      logger.error(
        "OpenAlex get_author_details failed",
        error=str(e),
        author_id=author_id,
      )
      return None

  async def get_author_works(
    self,
    author_id: str,
    limit: int = 20,
  ) -> List[ExternalPaperResult]:
    """Get works by a specific author."""
    oaid = self._resolve_id(author_id)
    params = self._get_params(
      {
        "filter": f"authorships.author.id:{oaid}",
        "per_page": min(limit, 50),
        "sort": "cited_by_count:desc",
      }
    )
    try:
      data = await self._get("works", params)
      results = data.get("results", [])
      return [self._format_work(w) for w in results if w.get("id")]
    except Exception as e:
      logger.error(
        "OpenAlex get_author_works failed",
        error=str(e),
        author_id=author_id,
      )
      return []

  def _resolve_id(self, external_id: str) -> str:
    """Resolve various ID formats to an OpenAlex ID path component."""
    # If it's already an OpenAlex ID (starts with W or A)
    cleaned = external_id.strip()
    if cleaned.startswith("W") or cleaned.startswith("A"):
      return cleaned
    # If it's a DOI
    if cleaned.startswith("10."):
      return f"doi:{cleaned}"
    # If it's a full DOI URL
    if "doi.org/" in cleaned:
      doi_part = cleaned.split("doi.org/")[-1]
      return f"doi:{doi_part}"
    # If it's a full OpenAlex URL
    if "openalex.org/" in cleaned:
      return cleaned.split("openalex.org/")[-1].lstrip("/")
    # If it's a PubMed ID
    if cleaned.startswith("PMID:"):
      return cleaned
    # If it's a PubMed Central ID
    if cleaned.startswith("PMC"):
      return f"pmc:{cleaned}"
    # Assume it's an OpenAlex ID
    return cleaned

  def _extract_id(self, url: str) -> str:
    """Extract OpenAlex ID from a full URL like https://openalex.org/W123."""
    if "openalex.org/" in url:
      return url.split("openalex.org/")[-1].lstrip("/")
    return url

  def _format_work(self, work: Dict[str, Any]) -> ExternalPaperResult:
    """Format a work from OpenAlex API response to ExternalPaperResult."""
    oaid = self._extract_id(work.get("id", ""))

    # Authors
    authors = []
    for authorship in work.get("authorships", []) or []:
      author_data = authorship.get("author", {}) or {}
      if author_data.get("display_name"):
        authors.append(author_data["display_name"])

    # Abstract (reconstruct from inverted index)
    abstract = _reconstruct_abstract(work.get("abstract_inverted_index"))

    # DOI
    doi = None
    raw_doi = work.get("doi")
    if raw_doi and isinstance(raw_doi, str):
      doi = raw_doi.replace("https://doi.org/", "")

    # Primary location (URL)
    url = None
    primary_loc = work.get("primary_location", {}) or {}
    if primary_loc.get("landing_page_url"):
      url = primary_loc["landing_page_url"]
    elif doi:
      url = f"https://doi.org/{doi}"

    # PDF URL (open access)
    pdf_url = None
    oa = work.get("open_access", {}) or {}
    if oa.get("oa_url"):
      pdf_url = oa["oa_url"]

    # Source/journal name
    source_name = None
    source_data = primary_loc.get("source", {}) or {}
    if source_data.get("display_name"):
      source_name = source_data["display_name"]

    # Type
    work_type = work.get("type")

    return ExternalPaperResult(
      source=self.name,
      external_id=oaid,
      title=work.get("title", ""),
      authors=authors,
      abstract=abstract,
      year=work.get("publication_year"),
      doi=doi,
      url=url,
      pdf_url=pdf_url,
      citation_count=work.get("cited_by_count"),
      relevance_score=work.get("relevance_score"),
      metadata={
        "openalex_id": oaid,
        "type": work_type,
        "source": source_name,
        "keywords": work.get("keywords", []),
        "is_oa": oa.get("is_oa", False),
        "referenced_works_count": len(work.get("referenced_works", [])),
      },
    )

  def _format_author(self, author: Dict[str, Any]) -> Dict[str, Any]:
    """Format an author profile for agent consumption."""
    institutions = []
    for inst in author.get("last_known_institutions", []) or []:
      institutions.append(
        {
          "name": inst.get("display_name"),
          "country": inst.get("country_code"),
          "type": inst.get("type"),
        }
      )

    topics = []
    for topic in author.get("topics", []) or []:
      topics.append(
        {
          "name": topic.get("display_name"),
          "subfield": (topic.get("subfield") or {}).get("display_name"),
          "field": (topic.get("field") or {}).get("display_name"),
        }
      )

    return {
      "openalex_id": author.get("id", ""),
      "display_name": author.get("display_name", ""),
      "works_count": author.get("works_count"),
      "cited_by_count": author.get("cited_by_count"),
      "h_index": author.get("h_index"),
      "i10_index": author.get("i10_index"),
      "2yr_mean_citedness": author.get("2yr_mean_citedness"),
      "orcid": author.get("orcid"),
      "institutions": institutions,
      "topics": topics,
      "counts_by_year": author.get("counts_by_year", []),
    }
