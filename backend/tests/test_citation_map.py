"""Unit tests for the pure citation-map graph assembly."""

from app.services.citation_map_service import assemble_graph


def _focal(pid, s2_id, title="P", year=2020):
  return {
    "id": pid,
    "s2_id": s2_id,
    "title": title,
    "authors": "Author",
    "year": year,
    "doi": None,
    "url": None,
  }


def _neighbor(s2_id, title="N", year=2015, citations=10):
  return {
    "s2_id": s2_id,
    "title": title,
    "year": year,
    "citation_count": citations,
    "authors": ["Jane Doe"],
  }


def _nodes_by_key(graph):
  return {n["key"]: n for n in graph["nodes"]}


def test_single_focal_with_references():
  graph = assemble_graph(
    focal=[_focal(1, "s2-focal")],
    references_by_focal={1: [_neighbor("a"), _neighbor("b")]},
  )
  nodes = _nodes_by_key(graph)
  assert nodes["lib:1"]["is_focal"] is True
  assert {"s2:a", "s2:b"} <= set(nodes)
  # Reference edges go focal -> reference (what the paper built on).
  edge_set = {(e["source"], e["target"], e["type"]) for e in graph["edges"]}
  assert ("lib:1", "s2:a", "reference") in edge_set
  assert all(e["type"] == "reference" for e in graph["edges"])


def test_overlapping_reference_is_shared_and_deduped():
  shared = _neighbor("shared-ref", title="Shared")
  graph = assemble_graph(
    focal=[_focal(1, "s2-1"), _focal(2, "s2-2")],
    references_by_focal={1: [shared], 2: [dict(shared)]},
  )
  nodes = _nodes_by_key(graph)
  # One deduped node connected to both focal papers.
  assert "s2:shared-ref" in nodes
  assert nodes["s2:shared-ref"]["shared"] is True
  edges = {(e["source"], e["target"]) for e in graph["edges"]}
  assert ("lib:1", "s2:shared-ref") in edges
  assert ("lib:2", "s2:shared-ref") in edges


def test_non_overlapping_reference_not_shared():
  graph = assemble_graph(
    focal=[_focal(1, "s2-1"), _focal(2, "s2-2")],
    references_by_focal={1: [_neighbor("only-1")]},
  )
  nodes = _nodes_by_key(graph)
  assert nodes["s2:only-1"]["shared"] is False


def test_neighbor_that_is_focal_collapses():
  # Focal paper 2 (s2-2) appears as a reference of focal paper 1.
  graph = assemble_graph(
    focal=[_focal(1, "s2-1"), _focal(2, "s2-2")],
    references_by_focal={1: [_neighbor("s2-2", title="Focal 2 as ref")]},
  )
  nodes = _nodes_by_key(graph)
  # No standalone s2:s2-2 node; it collapses onto lib:2.
  assert "s2:s2-2" not in nodes
  edges = {(e["source"], e["target"], e["type"]) for e in graph["edges"]}
  assert ("lib:1", "lib:2", "reference") in edges


def test_neighbor_without_s2_id_dropped():
  graph = assemble_graph(
    focal=[_focal(1, "s2-1")],
    references_by_focal={1: [{"title": "no id", "year": 2010}]},
  )
  nodes = _nodes_by_key(graph)
  assert set(nodes) == {"lib:1"}
  assert graph["edges"] == []


def test_positions_attached():
  graph = assemble_graph(
    focal=[_focal(1, "s2-1")],
    references_by_focal={1: [_neighbor("a")]},
    positions={"lib:1": {"x": 5.0, "y": 9.0}},
  )
  nodes = _nodes_by_key(graph)
  assert nodes["lib:1"]["position"] == {"x": 5.0, "y": 9.0}
  assert nodes["s2:a"]["position"] is None
