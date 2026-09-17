"""Tests for the shared Jev judgments module (S1/J0).

`route_answers` is pure — no SDK, no network. Gate tests cover the
fail-closed contract: disabled/unconfigured/SDK-missing returns None so
callers keep legacy behavior.
"""

from __future__ import annotations

from unittest.mock import patch

from app.services.judgments import (
  CITATION_CONTRADICTED,
  CITATION_UNSUPPORTED,
  CITATION_VERIFIED,
  DEST_DEEP_RESEARCH,
  DEST_DISCOVERY,
  DEST_LIBRARY,
  DEST_UNSUPPORTED,
  ROUTE_CONFLICT,
  ROUTE_EXCLUDE,
  ROUTE_INCLUDE,
  annotate_manifest,
  check_citations,
  citation_claims_for_report,
  citation_norm,
  citation_verdict,
  composite_score,
  decide_citation_outcome,
  extract_citation_claims,
  extract_quoted_spans,
  find_near_duplicate_pairs,
  find_quote_in_source,
  gate_passages,
  is_configured,
  normalize_quote,
  normalize_title,
  rank_papers,
  recency_score,
  route_action,
  route_answers,
  route_query,
  score_duplicate_pairs,
  token_jaccard,
)


class TestRouteAnswers:
  async def test_injection_excluded_first(self):
    assert (
      route_answers(
        {
          "is_relevant": 0.99,
          "contains_answer_evidence": 0.99,
          "contradicts_query_premise": 0.0,
          "contains_prompt_injection": 0.99,
        }
      )
      == ROUTE_EXCLUDE
    )

  async def test_contradiction_beats_evidence(self):
    # A premise-denying passage usually also scores as usable; it must land
    # in the conflict block, not the accepted one.
    assert (
      route_answers(
        {
          "is_relevant": 0.49,
          "contains_answer_evidence": 0.51,
          "contradicts_query_premise": 0.92,
          "contains_prompt_injection": 0.15,
        }
      )
      == ROUTE_CONFLICT
    )

  async def test_off_topic_excluded(self):
    assert (
      route_answers(
        {
          "is_relevant": 0.10,
          "contains_answer_evidence": 0.08,
          "contradicts_query_premise": 0.11,
          "contains_prompt_injection": 0.15,
        }
      )
      == ROUTE_EXCLUDE
    )

  async def test_usable_included(self):
    assert (
      route_answers(
        {
          "is_relevant": 0.99,
          "contains_answer_evidence": 0.98,
          "contradicts_query_premise": 0.03,
          "contains_prompt_injection": 0.23,
        }
      )
      == ROUTE_INCLUDE
    )

  async def test_nothing_usable_excluded(self):
    assert (
      route_answers(
        {
          "is_relevant": 0.48,
          "contains_answer_evidence": 0.41,
          "contradicts_query_premise": 0.39,
          "contains_prompt_injection": 0.26,
        }
      )
      == ROUTE_EXCLUDE
    )


class TestGateFailClosed:
  async def test_disabled_returns_none(self):
    with patch("app.services.judgments.settings") as s:
      s.TYPESAFE_ENABLED = False
      s.TYPESAFE_API_KEY = "key"
      assert await gate_passages("q", [{"id": "1"}]) is None

  async def test_missing_key_returns_none(self):
    with patch("app.services.judgments.settings") as s:
      s.TYPESAFE_ENABLED = True
      s.TYPESAFE_API_KEY = ""
      assert await gate_passages("q", [{"id": "1"}]) is None
      assert is_configured() is False

  async def test_empty_passages_returns_empty(self):
    with patch(
      "app.services.judgments.is_configured", return_value=True
    ):
      assert await gate_passages("q", []) == {}


class TestExtractCitationClaims:
  async def test_pulls_link_with_sentence(self):
    text = (
      "Access tokens live 1 hour by default "
      "([sessions](https://docs.example/sessions)). "
      "Signing keys rotate quarterly."
    )
    claims = extract_citation_claims(text)
    assert len(claims) == 1
    assert claims[0]["url"] == "https://docs.example/sessions"
    assert "Access tokens" in claims[0]["claim"]

  async def test_no_links_no_claims(self):
    assert extract_citation_claims("Plain answer, no citations.") == []

  async def test_bounded(self):
    text = " ".join(f"Point {i} ([s{i}](https://x.example/{i}))." for i in range(30))
    assert len(extract_citation_claims(text)) == 20


class TestCitationVerdict:
  async def test_supports_high_confidence_acts(self):
    verdict, auto = citation_verdict("supports", 0.95)
    assert (verdict, auto) == (CITATION_VERIFIED, True)

  async def test_contradicts_high_confidence_acts(self):
    verdict, auto = citation_verdict("contradicts", 0.99)
    assert (verdict, auto) == (CITATION_CONTRADICTED, True)

  async def test_low_confidence_never_blocks(self):
    for choice in ("supports", "contradicts", "says_nothing"):
      _, auto = citation_verdict(choice, 0.56)
      assert auto is False

  async def test_says_nothing_maps_unsupported(self):
    verdict, auto = citation_verdict("says_nothing", 0.9)
    assert (verdict, auto) == (CITATION_UNSUPPORTED, True)


class TestDecideCitationOutcome:
  async def test_gate_off_keeps_syntactic_verdict(self):
    assert decide_citation_outcome(None) == "keep"
    assert decide_citation_outcome({}) == "keep"

  async def test_contradicted_replaces(self):
    assert (
      decide_citation_outcome({"c1": {"verdict": CITATION_CONTRADICTED, "auto": True}})
      == "replace"
    )

  async def test_low_confidence_keeps(self):
    assert (
      decide_citation_outcome({"c1": {"verdict": CITATION_UNSUPPORTED, "auto": False}})
      == "keep"
    )

  async def test_thin_context_unsupported_keeps_and_logs(self):
    # Ledger context is title-only: absence-of-support must not nuke answers.
    assert (
      decide_citation_outcome({"c1": {"verdict": CITATION_UNSUPPORTED, "auto": True}})
      == "keep"
    )

  async def test_verified_keeps(self):
    assert (
      decide_citation_outcome({"c1": {"verdict": CITATION_VERIFIED, "auto": True}})
      == "keep"
    )


class TestCheckCitationsFailSoft:
  async def test_disabled_returns_none(self):
    with patch("app.services.judgments.settings") as s:
      s.TYPESAFE_ENABLED = False
      s.TYPESAFE_API_KEY = "key"
      assert await check_citations([{"id": "c1"}]) is None


class TestRerankMath:
  async def test_normalize_title(self):
    assert normalize_title("Attention Is All You Need!") == "attention is all you need"

  async def test_token_jaccard(self):
    assert token_jaccard("a b c", "a b c") == 1.0
    assert token_jaccard("a b", "c d") == 0.0
    assert token_jaccard("", "a") == 0.0

  async def test_citation_norm(self):
    assert citation_norm(None, 100) == 0.0
    assert citation_norm(0, 100) == 0.0
    assert citation_norm(100, 100) == 1.0
    assert 0.0 < citation_norm(10, 1000) < 1.0

  async def test_recency_score(self):
    assert recency_score(2026, 2026) == 1.0
    assert recency_score(None, 2026) == 0.5
    assert recency_score(1990, 2026) == 0.0
    assert 0.0 < recency_score(2016, 2026) < 1.0

  async def test_composite_prefers_jev(self):
    full = composite_score(0.9, 0.5, 0.5, 0.5)
    assert 0.0 <= full <= 1.0
    # Missing LLM redistributes to Jev; missing Jev redistributes to LLM.
    assert composite_score(0.9, None, 0.0, 0.0) > composite_score(0.5, None, 0.0, 0.0)
    assert composite_score(None, 0.9, 0.0, 0.0) > composite_score(None, 0.5, 0.0, 0.0)

  async def test_find_pairs_skips_exact_and_unrelated(self):
    pairs = find_near_duplicate_pairs(
      [
        ("a", "Attention Is All You Need"),
        ("b", "attention is all you need"),
        ("c", "Attention is all you need: extended analysis"),
        ("d", " totally unrelated protein folding work "),
      ]
    )
    assert ("a", "c") in pairs or ("b", "c") in pairs
    assert all("d" not in pair for pair in pairs)

  async def test_find_pairs_capped(self):
    titles = [(str(i), f"shared tokens paper number {i} extended edition") for i in range(8)]
    assert len(find_near_duplicate_pairs(titles, threshold=0.3, cap=3)) == 3


class TestRerankFailSoft:
  async def test_rank_disabled_returns_none(self):
    with patch("app.services.judgments.settings") as s:
      s.TYPESAFE_ENABLED = False
      s.TYPESAFE_API_KEY = "key"
      assert await rank_papers("q", [{"id": "1"}]) is None

  async def test_dedup_disabled_returns_empty(self):
    with patch("app.services.judgments.settings") as s:
      s.TYPESAFE_ENABLED = False
      s.TYPESAFE_API_KEY = "key"
      assert await score_duplicate_pairs([({"id": "a"}, {"id": "b"})]) == {}


class TestCitationClaimsForReport:
  SOURCES = [
    {"url": "https://docs.example/sessions", "title": "Sessions", "source_type": "web"},
    {"url": "not-a-url", "title": "Bad", "source_type": "web"},
    {"url": "", "title": "Empty", "source_type": "web"},
  ]

  async def test_matches_and_skips(self):
    report = (
      "Tokens live 1 hour ([a](https://docs.example/sessions)). "
      "See also ([b](https://other.example/x))."
    )
    claims = citation_claims_for_report(report, self.SOURCES)
    assert len(claims) == 1
    assert claims[0]["url"] == "https://docs.example/sessions"
    assert claims[0]["context"] == "Sessions [web]"

  async def test_case_insensitive_match(self):
    # Scheme/host case folds; path case is significant (matches the ledger
    # normalizer — servers treat paths as case-sensitive).
    assert len(
      citation_claims_for_report("Tokens ([a](HTTPS://DOCS.example/sessions)).", self.SOURCES)
    ) == 1
    assert (
      len(
        citation_claims_for_report(
          "Tokens ([a](https://docs.example/SESSIONS)).", self.SOURCES
        )
      )
      == 0
    )

  async def test_parity_with_evidence_normalizer(self):
    from app.services.deep_research.evidence import normalize_url
    from app.services.judgments import _normalize_citation_url

    for raw in [
      "https://Example.com/Path?q=1.",
      "HTTP://x.example/a,",
      "not a url",
      "",
      "ftp://x.example/a",
    ]:
      assert _normalize_citation_url(raw) == normalize_url(raw)


class TestRouteAction:
  async def test_confident_library_routes(self):
    assert route_action(DEST_LIBRARY, 0.91) == "route"

  async def test_mid_confidence_suggests(self):
    assert route_action(DEST_DISCOVERY, 0.65) == "suggest"

  async def test_low_confidence_falls_back(self):
    assert route_action(DEST_LIBRARY, 0.3) == "fallback"
    assert route_action(DEST_UNSUPPORTED, 0.95) == "fallback"

  async def test_deep_research_never_auto_routes(self):
    assert route_action(DEST_DEEP_RESEARCH, 0.99) == "suggest"


class TestRouteQueryFailSoft:
  async def test_disabled_returns_none(self):
    with patch("app.services.judgments.settings") as s:
      s.TYPESAFE_ENABLED = False
      s.TYPESAFE_API_KEY = "key"
      assert await route_query("some query") is None

  async def test_blank_returns_none(self):
    assert await route_query("   ") is None

  async def test_context_flows_into_state(self):
    from types import SimpleNamespace

    seen: dict = {}

    class FakeClient:
      def __init__(self, *args, **kwargs):
        pass

      async def __aenter__(self):
        return self

      async def __aexit__(self, *args):
        return False

      async def system_one(self, **kwargs):
        seen.update(kwargs)
        return SimpleNamespace(
          answers={
            "destination": SimpleNamespace(
              choice="library_search",
              confidence=0.9,
              probabilities={"library_search": 0.9},
            )
          },
          model="fake",
        )

    context = {"library": {"total_papers": 5, "title_matches": 2}}
    with (
      patch("app.services.judgments.settings") as s,
      patch("typesafe_sdk.AsyncTypeSafeClient", return_value=FakeClient()),
    ):
      s.TYPESAFE_ENABLED = True
      s.TYPESAFE_API_KEY = "key"
      result = await route_query("diffusion", context)
    assert result is not None and result["destination"] == "library_search"
    assert seen["state"]["context"] == context
    assert seen["state"]["request"] == "diffusion"


def test_route_endpoint_registered():
  from app.main import app

  paths = {route.path for route in app.routes}
  assert "/api/v1/route" in paths


class TestQuoteHelpers:
  async def test_normalize_folds_quotes_and_space(self):
    assert normalize_quote("“hello   world”") == '"hello world"'

  async def test_find_present_and_missing(self):
    assert find_quote_in_source("hello world", "say hello world today")
    assert not find_quote_in_source("goodbye world", "say hello world today")
    assert not find_quote_in_source("   ", "anything")

  async def test_extract_spans_min_length(self):
    assert extract_quoted_spans('A "short" and "a much longer verifiable statement here".') == [
      "a much longer verifiable statement here"
    ]


class TestAnnotateManifest:
  CONTENT = 'Tokens live 1 hour (ref:citation/1). Other claim (ref:citation/2).'

  def _manifest(self):
    return [
      {"kind": "citation", "id": "1", "title": "Sessions",
       "snippet": "Access tokens default to 1 hour expiry."},
      {"kind": "citation", "id": "2", "title": "Keys",
       "snippet": "Rotate signing keys quarterly."},
    ]

  async def test_gate_off_returns_unchanged(self):
    manifest = self._manifest()
    with patch("app.services.judgments.settings") as s:
      s.TYPESAFE_ENABLED = False
      s.TYPESAFE_API_KEY = "key"
      result = await annotate_manifest(self.CONTENT, manifest)
    assert result is manifest
    assert all("verification" not in e for e in result)

  async def test_verdicts_annotated(self):
    async def fake_check(citations):
      return {
        "citation/1": {"verdict": CITATION_VERIFIED, "auto": True, "confidence": 0.95},
        "citation/2": {"verdict": CITATION_CONTRADICTED, "auto": True, "confidence": 0.9},
      }

    with (
      patch("app.services.judgments.settings") as s,
      patch("app.services.judgments.check_citations", side_effect=fake_check),
    ):
      s.TYPESAFE_ENABLED = True
      s.TYPESAFE_API_KEY = "key"
      result = await annotate_manifest(self.CONTENT, self._manifest())
    assert [e["verification"] for e in result] == ["verified", "contradicted"]

  async def test_quote_miss_downgrades_to_logged_only(self):
    content = 'It states "tokens never expire under any circumstance at all" (ref:citation/1).'

    async def fake_check(citations):
      return {
        "citation/1": {"verdict": CITATION_VERIFIED, "auto": True, "confidence": 0.9},
      }

    with (
      patch("app.services.judgments.settings") as s,
      patch("app.services.judgments.check_citations", side_effect=fake_check),
    ):
      s.TYPESAFE_ENABLED = True
      s.TYPESAFE_API_KEY = "key"
      (entry,) = await annotate_manifest(
        content,
        [{"kind": "citation", "id": "1", "title": "Sessions",
          "snippet": "Access tokens default to 1 hour expiry."}],
      )
    assert entry["verification"] == "unsupported"

  async def test_snippet_less_entry_unreviewed(self):
    async def fake_check(citations):
      assert citations == []
      return {}

    with (
      patch("app.services.judgments.settings") as s,
      patch("app.services.judgments.check_citations", side_effect=fake_check),
    ):
      s.TYPESAFE_ENABLED = True
      s.TYPESAFE_API_KEY = "key"
      (entry,) = await annotate_manifest(
        "See (ref:section/p7).", [{"kind": "section", "id": "p7", "title": "Page 7"}]
      )
    assert entry["verification"] == "unreviewed"
