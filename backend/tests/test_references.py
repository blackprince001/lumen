"""Tests for reference citation formatting."""

from datetime import datetime, timezone

from app.models.paper import Paper
from app.services.references import (
  _escape_bibtex,
  citation_fields,
  reference_formatter,
)


def make_paper(
  title="Test Paper",
  doi=None,
  url=None,
  author=None,
  journal=None,
  volume=None,
  issue=None,
  pages=None,
  publisher=None,
  year=None,
  pub_date=None,
  created_at=None,
):
  meta = {}
  if author:
    meta["author"] = author
  if journal:
    meta["journal"] = journal
  if publisher:
    meta["publisher"] = publisher
  if year:
    meta["year"] = year
  if pub_date:
    meta["publication_date"] = pub_date

  return Paper(
    id=1,
    title=title,
    doi=doi,
    url=url,
    volume=volume,
    issue=issue,
    pages=pages,
    metadata_json=meta or None,
    created_at=created_at or datetime(2024, 1, 1, tzinfo=timezone.utc),
  )


class TestCitationFields:
  def test_parse_authors_semicolon(self):
    paper = make_paper(author="Smith, John; Doe, Jane")
    fields = citation_fields(paper)
    assert fields["authors"] == ["Smith, John", "Doe, Jane"]

  def test_parse_authors_comma_delimited(self):
    paper = make_paper(author="Smith, John, Doe, Jane")
    fields = citation_fields(paper)
    assert fields["authors"] == ["Smith, John", "Doe, Jane"]

  def test_parse_authors_single(self):
    paper = make_paper(author="Einstein, Albert")
    fields = citation_fields(paper)
    assert fields["authors"] == ["Einstein, Albert"]

  def test_no_authors(self):
    paper = make_paper()
    fields = citation_fields(paper)
    assert fields["authors"] == []

  def test_year_from_pub_date(self):
    paper = make_paper(pub_date="2023-05-15")
    assert citation_fields(paper)["year"] == "2023"

  def test_year_from_year_field(self):
    paper = make_paper(year="2022")
    assert citation_fields(paper)["year"] == "2022"

  def test_year_fallback_to_created_at(self):
    paper = make_paper(created_at=datetime(2020, 6, 1, tzinfo=timezone.utc))
    assert citation_fields(paper)["year"] == "2020"


class TestAPA:
  def test_single_author(self):
    paper = make_paper(author="Smith, John", year="2023", title="A Great Paper")
    ref = reference_formatter.format_apa(paper)
    assert "Smith, J." in ref
    assert "2023" in ref
    assert "A Great Paper" in ref

  def test_two_authors(self):
    paper = make_paper(author="Smith, John, Doe, Jane", year="2023")
    ref = reference_formatter.format_apa(paper)
    assert "Smith, J." in ref
    assert "Doe, J." in ref
    assert "&" in ref

  def test_journal_with_volume(self):
    paper = make_paper(
      author="Smith, John", year="2023", journal="Nature", volume="42", pages="100-110"
    )
    ref = reference_formatter.format_apa(paper)
    assert "Nature" in ref
    assert "42" in ref
    assert "100-110" in ref

  def test_doi_url(self):
    paper = make_paper(author="Smith, John", year="2023", doi="10.1234/test")
    ref = reference_formatter.format_apa(paper)
    assert "https://doi.org/10.1234/test" in ref

  def test_arxiv_doi(self):
    paper = make_paper(author="Smith, John", year="2023", doi="arxiv:2301.12345")
    ref = reference_formatter.format_apa(paper)
    assert "arXiv:2301.12345" in ref


class TestMLA:
  def test_single_author(self):
    paper = make_paper(author="Smith, John", year="2023", title="A Great Paper")
    ref = reference_formatter.format_mla(paper)
    assert "Smith, John" in ref
    assert '"A Great Paper."' in ref

  def test_many_authors_et_al(self):
    authors = ", ".join([f"Author{i}, First{i}" for i in range(4)])
    paper = make_paper(author=authors, year="2023")
    ref = reference_formatter.format_mla(paper)
    assert "et al." in ref


class TestChicago:
  def test_basic(self):
    paper = make_paper(
      author="Smith, John", year="2023", title="A Great Paper", journal="Nature"
    )
    ref = reference_formatter.format_chicago(paper)
    assert "Smith, John" in ref
    assert "2023" in ref
    assert "Nature" in ref

  def test_many_authors(self):
    authors = ", ".join([f"Author{i}, First{i}" for i in range(10)])
    paper = make_paper(author=authors, year="2023")
    ref = reference_formatter.format_chicago(paper)
    assert "and" in ref
    assert "Author7" in ref  # 8th author (0-indexed), abbreviated to 8


class TestIEEE:
  def test_basic(self):
    paper = make_paper(
      author="Smith, John", year="2023", title="Test", journal="IEEE Journal"
    )
    ref = reference_formatter.format_ieee(paper)
    assert "J. Smith" in ref
    assert "IEEE Journal" in ref
    assert "2023" in ref

  def test_many_authors_et_al(self):
    authors = ", ".join([f"Author{i}, First{i}" for i in range(8)])
    paper = make_paper(author=authors, year="2023")
    ref = reference_formatter.format_ieee(paper)
    assert "et al." in ref


class TestBibTeX:
  def test_basic(self):
    paper = make_paper(
      author="Smith, John", year="2023", title="Test Paper", doi="10.1234/test"
    )
    ref = reference_formatter.format_bibtex(paper)
    assert "@article{" in ref
    assert "author = {Smith, John}" in ref
    assert "doi = {10.1234/test}" in ref
    assert ref.strip().endswith("}")

  def test_journal_volume_pages(self):
    paper = make_paper(
      author="Smith, John",
      year="2023",
      title="Test",
      journal="Nature",
      volume="42",
      issue="3",
      pages="100-110",
      doi="10.1234/test",
    )
    ref = reference_formatter.format_bibtex(paper)
    assert "volume = {42}" in ref
    assert "number = {3}" in ref
    assert "pages = {100-110}" in ref

  def test_arxiv(self):
    paper = make_paper(
      author="Smith, John", year="2023", title="Test", doi="arxiv:2301.12345"
    )
    ref = reference_formatter.format_bibtex(paper)
    assert "eprint = {2301.12345}" in ref
    assert "archivePrefix = {arXiv}" in ref


class TestEscapeBibTeX:
  def test_accented_chars(self):
    assert "\\'{e}" in _escape_bibtex("é")
    assert '\\"{u}' in _escape_bibtex("ü")

  def test_special_chars(self):
    escaped = _escape_bibtex("100% Organic & {Free}")
    assert "\\%" in escaped
    assert "\\&" in escaped
    # Braces not escaped — part of LaTeX command syntax

  def test_em_dash(self):
    assert "---" in _escape_bibtex("—")
