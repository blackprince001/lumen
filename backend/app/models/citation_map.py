from datetime import datetime, timezone

from sqlalchemy import (
  JSON,
  Column,
  DateTime,
  Float,
  ForeignKey,
  Integer,
  String,
  UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import Base


class CitationMapItem(Base):
  __tablename__ = "citation_map_items"
  __table_args__ = (
    UniqueConstraint("user_id", "paper_id", name="uq_citation_map_user_paper"),
  )

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(
    Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
  )
  paper_id = Column(
    Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False
  )
  created_at = Column(
    DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
  )

  paper = relationship("Paper")


class CitationMapPosition(Base):
  __tablename__ = "citation_map_positions"
  __table_args__ = (
    UniqueConstraint("user_id", "node_key", name="uq_citation_map_user_node"),
  )

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(
    Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
  )
  # Node identity: "lib:<paper_id>" for library papers, "s2:<paperId>" for
  # external Semantic Scholar papers.
  node_key = Column(String, nullable=False)
  x = Column(Float, nullable=False)
  y = Column(Float, nullable=False)
  updated_at = Column(
    DateTime(timezone=True),
    default=lambda: datetime.now(timezone.utc),
    onupdate=lambda: datetime.now(timezone.utc),
    nullable=False,
  )


class CitationMapCache(Base):
  __tablename__ = "citation_map_cache"

  paper_id = Column(
    Integer,
    ForeignKey("papers.id", ondelete="CASCADE"),
    primary_key=True,
  )
  s2_paper_id = Column(String, nullable=True)
  resolved = Column(Integer, default=0, nullable=False)
  references_json = Column(JSON, nullable=True)
  citations_json = Column(JSON, nullable=True)
  fetched_at = Column(
    DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
  )
