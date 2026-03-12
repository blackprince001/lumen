import re
import xml.etree.ElementTree as ET
from typing import List, Optional, cast
from urllib.parse import quote_plus

import httpx

from app.core.logger import get_logger
from app.services.discovery.base_provider import (
  BaseDiscoveryProvider,
  ExternalPaperResult,
  SearchFilters,
)

logger = get_logger(__name__)

# arXiv XML API base (used only for single paper lookup)
ARXIV_API_BASE = "https://export.arxiv.org/api"

# XML namespaces used in arXiv API responses
ARXIV_NAMESPACES = {
  "atom": "http://www.w3.org/2005/Atom",
  "arxiv": "http://arxiv.org/schemas/atom",
}


class ArxivProvider(BaseDiscoveryProvider):
  """Discovery provider for arXiv papers.

  Uses SearchTheArxiv (searchthearxiv.com) for semantic search,
  and the official arXiv API for single paper lookup.
  """

  name = "arxiv"
  display_name = "arXiv"
  description = (
    "Semantic search over 300k+ ML papers from arXiv"
  )
  base_url = "https://searchthearxiv.com"

  supports_search = True
  supports_citations = False
  supports_recommendations = False

  # Be cautious with third-party service
  requests_per_second = 1.0

  async def search(
    self,
    query: str,
    filters: Optional[SearchFilters] = None,
    limit: int = 20,
  ) -> List[ExternalPaperResult]:
    """Search arXiv papers using SearchTheArxiv semantic search.

    Args:
        query: Natural language search query
        filters: Optional filters (year range, etc.) — applied client-side
        limit: Maximum results to return (API returns max 10)

    Returns:
        List of paper results ranked by semantic similarity
    """
    # SearchTheArxiv enforces a 200 char max query length
    truncated_query = query[:200]

    try:
      client = await self._get_client()
      response = await client.get(
        f"{self.base_url}/search",
        params={"query": truncated_query},
      )
      response.raise_for_status()

      data = response.json()
      semantic_results = self._parse_searchthearxiv_response(data)

      # Apply client-side filters if provided
      if filters:
        semantic_results = self._apply_filters(semantic_results, filters)

      # If limit is > 10, we might need to augment with official arXiv keyword search
      # (since searchthearxiv only returns 10)
      if limit > len(semantic_results):
        additional_count = limit - len(semantic_results)
        official_results = await self._search_official_arxiv(
          query=query, filters=filters, limit=additional_count * 2
        )

        # Deduplicate: remove any official results that already exist in semantic results
        seen_ids = {p.external_id for p in semantic_results}
        augmented_results = semantic_results.copy()
        
        for p in official_results:
          if p.external_id not in seen_ids:
            augmented_results.append(p)
            seen_ids.add(p.external_id)
            if len(augmented_results) >= limit:
              break
        
        return augmented_results

      return semantic_results[:limit]

    except httpx.HTTPStatusError as e:
      logger.error(
        "SearchTheArxiv API error",
        status_code=e.response.status_code,
        query=truncated_query,
      )
      # Fallback to official search if semantic fails
      return await self._search_official_arxiv(query=query, filters=filters, limit=limit)
    except Exception as e:
      logger.error(
        "Error searching SearchTheArxiv",
        error=str(e),
        query=truncated_query,
      )
      # Fallback to official search if semantic fails
      return await self._search_official_arxiv(query=query, filters=filters, limit=limit)

  async def _search_official_arxiv(
    self,
    query: str,
    filters: Optional[SearchFilters] = None,
    limit: int = 20,
  ) -> List[ExternalPaperResult]:
    """Search official arXiv API using keyword matching.

    Args:
        query: Search query
        filters: Optional filters
        limit: Maximum results

    Returns:
        List of paper results
    """
    # Simple keyword search in all fields
    search_query = f"all:{query}"
    
    params = {
      "search_query": search_query,
      "max_results": limit,
    }

    try:
      client = await self._get_client()
      response = await client.get(
        f"{ARXIV_API_BASE}/query",
        params=params,
      )
      response.raise_for_status()

      results = self._parse_arxiv_xml(response.text)
      
      # Apply client-side filters (year, authors) if provided
      # even though some might be in the query, we apply to ensure consistency
      if filters:
        results = self._apply_filters(results, filters)
        
      return results[:limit]

    except Exception as e:
      logger.error("Error searching official arXiv", error=str(e), query=query)
      return []

  def _parse_searchthearxiv_response(
    self, data: dict
  ) -> List[ExternalPaperResult]:
    """Parse SearchTheArxiv JSON response into ExternalPaperResult list.

    Args:
        data: Raw JSON response from SearchTheArxiv API

    Returns:
        List of parsed paper results
    """
    results = []
    papers = data.get("papers", [])

    for paper in papers:
      try:
        arxiv_id = paper.get("id")
        if not arxiv_id:
          continue

        title = paper.get("title", "").strip()
        if not title:
          continue

        # authors_parsed is already a list of strings
        authors = paper.get("authors_parsed", [])
        if not authors:
          # Fallback: split the comma-separated authors string
          authors_str = paper.get("authors", "")
          authors = (
            [a.strip() for a in authors_str.split(",")]
            if authors_str
            else []
          )

        abstract = paper.get("abstract", "").strip()

        # Year comes as float (e.g. 2023.0), convert to int
        raw_year = paper.get("year")
        year = int(raw_year) if raw_year is not None else None

        # Score is cosine similarity (0-1)
        score = paper.get("score")
        relevance_score = round(float(score), 2) if score is not None else None

        url = f"https://arxiv.org/abs/{arxiv_id}"
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"

        results.append(
          ExternalPaperResult(
            source=self.name,
            external_id=arxiv_id,
            title=title,
            authors=authors,
            abstract=abstract,
            year=year,
            doi=None,
            arxiv_id=arxiv_id,
            url=url,
            pdf_url=pdf_url,
            citation_count=None,
            relevance_score=relevance_score,
            metadata={
              "month": paper.get("month"),
              "search_provider": "searchthearxiv",
            },
          )
        )

      except Exception as e:
        logger.error(
          "Error parsing SearchTheArxiv paper",
          error=str(e),
          paper_id=paper.get("id"),
        )

    return results

  def _apply_filters(
    self,
    results: List[ExternalPaperResult],
    filters: SearchFilters,
  ) -> List[ExternalPaperResult]:
    """Apply client-side filters to search results.

    Args:
        results: List of paper results
        filters: Search filters to apply

    Returns:
        Filtered list of papers
    """
    filtered = results

    if filters.year_from is not None:
      filtered = [
        p for p in filtered if p.year is not None and p.year >= filters.year_from
      ]

    if filters.year_to is not None:
      filtered = [
        p for p in filtered if p.year is not None and p.year <= filters.year_to
      ]

    if filters.authors:
      author_set = {a.lower() for a in filters.authors}
      filtered = [
        p
        for p in filtered
        if any(a.lower() in author_set for a in p.authors)
      ]

    return filtered

  async def get_paper_details(
    self,
    external_id: str,
  ) -> Optional[ExternalPaperResult]:
    """Get details for a specific arXiv paper via the official arXiv API.

    Args:
        external_id: arXiv ID (e.g., "2301.00001" or "2301.00001v1")

    Returns:
        Paper details or None
    """
    clean_id = self._clean_arxiv_id(external_id)

    params = {
      "id_list": clean_id,
      "max_results": 1,
    }

    try:
      client = await self._get_client()
      response = await client.get(
        f"{ARXIV_API_BASE}/query",
        params=params,
      )
      response.raise_for_status()

      results = self._parse_arxiv_xml(response.text)
      return results[0] if results else None

    except Exception as e:
      logger.error(
        "Error fetching arXiv paper",
        error=str(e),
        arxiv_id=external_id,
      )
      return None

  def _parse_arxiv_xml(self, xml_text: str) -> List[ExternalPaperResult]:
    """Parse arXiv Atom feed XML for single paper lookup.

    Args:
        xml_text: Raw XML response from arXiv API

    Returns:
        List of parsed paper results
    """
    results = []

    try:
      root = ET.fromstring(xml_text)

      for entry in root.findall("atom:entry", ARXIV_NAMESPACES):
        # Extract arXiv ID from entry ID URL
        entry_id = entry.find("atom:id", ARXIV_NAMESPACES)
        if entry_id is None or entry_id.text is None:
          continue

        match = re.search(r"arxiv\.org/abs/(.+)$", entry_id.text)
        if not match:
          match = re.search(r"(\d{4}\.\d{4,5}(?:v\d+)?)", entry_id.text)
        if not match:
          continue
        arxiv_id = match.group(1)

        # Title
        title_elem = entry.find("atom:title", ARXIV_NAMESPACES)
        title = " ".join(
          (cast(str, title_elem.text) if title_elem is not None else "").split()
        )
        if not title:
          continue

        # Abstract
        summary_elem = entry.find("atom:summary", ARXIV_NAMESPACES)
        abstract = " ".join(
          (cast(str, summary_elem.text) if summary_elem is not None else "").split()
        )

        # Authors
        authors = []
        for author_elem in entry.findall("atom:author", ARXIV_NAMESPACES):
          name_elem = author_elem.find("atom:name", ARXIV_NAMESPACES)
          if name_elem is not None and name_elem.text:
            authors.append(name_elem.text.strip())

        # Year from published date
        year = None
        published_elem = entry.find("atom:published", ARXIV_NAMESPACES)
        if published_elem is not None and published_elem.text:
          year_match = re.match(r"(\d{4})", published_elem.text)
          if year_match:
            year = int(year_match.group(1))

        # DOI
        doi = None
        doi_elem = entry.find("arxiv:doi", ARXIV_NAMESPACES)
        if doi_elem is not None and doi_elem.text:
          doi = doi_elem.text.strip()

        # Categories
        categories = []
        for cat_elem in entry.findall("atom:category", ARXIV_NAMESPACES):
          term = cat_elem.get("term")
          if term:
            categories.append(term)

        results.append(
          ExternalPaperResult(
            source=self.name,
            external_id=arxiv_id,
            title=title,
            authors=authors,
            abstract=abstract,
            year=year,
            doi=doi,
            arxiv_id=arxiv_id,
            url=f"https://arxiv.org/abs/{arxiv_id}",
            pdf_url=f"https://arxiv.org/pdf/{arxiv_id}.pdf",
            citation_count=None,
            metadata={
              "categories": categories,
              "primary_category": categories[0] if categories else None,
            },
          )
        )

    except ET.ParseError as e:
      logger.error("Error parsing arXiv XML", error=str(e))

    return results

  def _clean_arxiv_id(self, arxiv_id: str) -> str:
    """Clean arXiv ID for API queries.

    Args:
        arxiv_id: Raw arXiv ID

    Returns:
        Cleaned ID suitable for API
    """
    # Remove any URL prefix
    if "arxiv.org" in arxiv_id:
      match = re.search(r"arxiv\.org/abs/(.+)$", arxiv_id)
      if match:
        arxiv_id = match.group(1)

    # Remove 'arxiv:' prefix if present
    if arxiv_id.lower().startswith("arxiv:"):
      arxiv_id = arxiv_id[6:]

    return arxiv_id.strip()
