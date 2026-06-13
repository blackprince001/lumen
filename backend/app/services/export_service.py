import csv
import io
import json
from typing import List, Optional

from app.models.paper import Paper


def _meta(paper: Paper, key: str, default: str = "") -> str:
  val = paper.metadata_json.get(key) if paper.metadata_json else None
  return str(val) if val else default


class ExportService:
  def export_csv(self, papers: List[Paper], user_states: Optional[dict] = None) -> str:
    user_states = user_states or {}
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(
      [
        "ID",
        "Title",
        "DOI",
        "URL",
        "Authors",
        "Journal",
        "Volume",
        "Issue",
        "Pages",
        "Year",
        "Tags",
        "Groups",
        "Reading Status",
        "Priority",
        "Reading Time (min)",
        "Created At",
      ]
    )

    for paper in papers:
      authors = _meta(paper, "author", "")
      if isinstance(authors, list):
        authors = ", ".join(authors)
      journal = _meta(paper, "journal") or _meta(paper, "producer", "")
      tags = ", ".join([tag.name for tag in getattr(paper, "tags", [])])
      groups = ", ".join([group.name for group in getattr(paper, "groups", [])])
      state = user_states.get(paper.id)
      year = _extract_csv_year(paper)

      writer.writerow(
        [
          paper.id,
          paper.title,
          paper.doi or "",
          paper.url or "",
          authors,
          journal,
          paper.volume or _meta(paper, "volume", ""),
          paper.issue or _meta(paper, "issue", ""),
          paper.pages or _meta(paper, "pages", ""),
          year,
          tags,
          groups,
          state.reading_status if state else "not_started",
          state.priority if state else "low",
          state.reading_time_minutes if state else 0,
          paper.created_at.isoformat() if paper.created_at else "",
        ]
      )

    return output.getvalue()

  def export_json(
    self,
    papers: List[Paper],
    include_annotations: bool = False,
    user_states: Optional[dict] = None,
  ) -> str:
    user_states = user_states or {}
    papers_data = []
    for paper in papers:
      state = user_states.get(paper.id)
      paper_dict = {
        "id": paper.id,
        "title": paper.title,
        "doi": paper.doi,
        "url": paper.url,
        "metadata": paper.metadata_json,
        "volume": paper.volume,
        "issue": paper.issue,
        "pages": paper.pages,
        "reading_status": state.reading_status if state else "not_started",
        "priority": state.priority if state else "low",
        "reading_time_minutes": state.reading_time_minutes if state else 0,
        "created_at": paper.created_at.isoformat() if paper.created_at else None,
      }
      if include_annotations:
        paper_dict["annotations"] = [
          {"id": ann.id, "content": ann.content, "type": ann.type}
          for ann in getattr(paper, "annotations", [])
        ]
      papers_data.append(paper_dict)

    return json.dumps(papers_data, indent=2)

  def export_ris(self, papers: List[Paper]) -> str:
    ris_lines = []
    for paper in papers:
      ris_lines.append("TY  - JOUR")
      ris_lines.append(f"TI  - {paper.title}")

      authors = _meta(paper, "author") or _meta(paper, "authors_list", "")
      if isinstance(authors, list):
        for author in authors:
          ris_lines.append(f"AU  - {author}")
      elif isinstance(authors, str) and authors:
        for author in authors.replace(";", ",").split(","):
          a = author.strip()
          if a:
            ris_lines.append(f"AU  - {a}")

      journal = _meta(paper, "journal") or _meta(paper, "producer", "")
      if journal:
        ris_lines.append(f"JO  - {journal}")

      vol = paper.volume or _meta(paper, "volume", "")
      if vol:
        ris_lines.append(f"VL  - {vol}")

      issue = paper.issue or _meta(paper, "issue", "")
      if issue:
        ris_lines.append(f"IS  - {issue}")

      pages = paper.pages or _meta(paper, "pages", "")
      if pages:
        if "-" in pages:
          sp, _, ep = pages.partition("-")
          ris_lines.append(f"SP  - {sp.strip()}")
          ris_lines.append(f"EP  - {ep.strip()}")
        else:
          ris_lines.append(f"SP  - {pages}")

      year = _extract_csv_year(paper)
      ris_lines.append(f"PY  - {year}")

      if paper.doi:
        ris_lines.append(f"DO  - {paper.doi}")
        ris_lines.append("M3  - doi")

      if paper.url:
        ris_lines.append(f"UR  - {paper.url}")

      ris_lines.append("ER  -")
      ris_lines.append("")

    return "\n".join(ris_lines)

  def export_endnote(self, papers: List[Paper]) -> str:
    endnote_lines = []
    for paper in papers:
      endnote_lines.append("%0 Journal Article")
      endnote_lines.append(f"%T {paper.title}")

      authors = _meta(paper, "author") or _meta(paper, "authors_list", "")
      if isinstance(authors, list):
        for author in authors:
          endnote_lines.append(f"%A {author}")
      elif isinstance(authors, str) and authors:
        for author in authors.replace(";", ",").split(","):
          a = author.strip()
          if a:
            endnote_lines.append(f"%A {a}")

      journal = _meta(paper, "journal") or _meta(paper, "producer", "")
      if journal:
        endnote_lines.append(f"%J {journal}")

      vol = paper.volume or _meta(paper, "volume", "")
      if vol:
        endnote_lines.append(f"%V {vol}")

      issue = paper.issue or _meta(paper, "issue", "")
      if issue:
        endnote_lines.append(f"%N {issue}")

      pages = paper.pages or _meta(paper, "pages", "")
      if pages:
        endnote_lines.append(f"%P {pages}")

      year = _extract_csv_year(paper)
      endnote_lines.append(f"%D {year}")

      if paper.doi:
        endnote_lines.append(f"%R {paper.doi}")

      if paper.url:
        endnote_lines.append(f"%U {paper.url}")

      issn = _meta(paper, "issn", "")
      if not issn:
        issn = paper.issn or ""
      if issn:
        endnote_lines.append(f"%@ {issn}")

      endnote_lines.append("")

    return "\n".join(endnote_lines)


def _extract_csv_year(paper: Paper) -> str:
  meta = paper.metadata_json or {}
  pub_date = meta.get("publication_date")
  if pub_date:
    try:
      return str(datetime.strptime(str(pub_date)[:10], "%Y-%m-%d").year)
    except ValueError:
      pass
  year = meta.get("year")
  if year:
    try:
      return str(int(str(year)[:4]))
    except (ValueError, TypeError):
      pass
  if paper.created_at:
    return str(paper.created_at.year)
  return ""


from datetime import datetime  # noqa: E402

export_service = ExportService()
