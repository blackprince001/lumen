from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
  JSON,
  Column,
  DateTime,
  Enum,
  ForeignKey,
  Integer,
  String,
  Table,
  Text,
)
from sqlalchemy.orm import relationship

from app.core.config import settings
from app.models.base import Base

paper_group_association = Table(
  "paper_groups",
  Base.metadata,
  Column("paper_id", Integer, ForeignKey("papers.id"), primary_key=True),
  Column("group_id", Integer, ForeignKey("groups.id"), primary_key=True),
)


class Paper(Base):
  __tablename__ = "papers"

  id = Column(Integer, primary_key=True, index=True)
  uploaded_by_id = Column(
    Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
  )
  title = Column(String, nullable=False, index=True)
  doi = Column(String, unique=True, index=True, nullable=True)
  url = Column(String, nullable=True)
  file_path = Column(String, nullable=True)
  embedding = Column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)
  metadata_json = Column(JSON, default=dict)
  content_text = Column(Text, nullable=True)
  volume = Column(String, nullable=True)
  issue = Column(String, nullable=True)
  pages = Column(String, nullable=True)
  isbn = Column(String, nullable=True)
  issn = Column(String, nullable=True)
  viewed_count = Column(Integer, default=0, nullable=False)
  # Processing status for background AI tasks
  processing_status = Column(
    Enum("pending", "processing", "completed", "failed", name="processingstatus"),
    nullable=False,
    default="pending",
    server_default="pending",
    index=True,
  )
  processing_error = Column(Text, nullable=True)
  created_at = Column(
    DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
  )
  updated_at = Column(
    DateTime(timezone=True),
    default=lambda: datetime.now(timezone.utc),
    onupdate=lambda: datetime.now(timezone.utc),
    nullable=False,
  )

  @property
  def file_url(self) -> str | None:
    if not self.file_path or self.id is None:
      return None
    return f"/papers/{self.id}/file"

  uploaded_by = relationship("User", back_populates="papers", foreign_keys=[uploaded_by_id])
  annotations = relationship(
    "Annotation", back_populates="paper", cascade="all, delete-orphan"
  )
  groups = relationship(
    "Group", secondary=paper_group_association, back_populates="papers"
  )
  tags = relationship("Tag", secondary="paper_tags", back_populates="papers")
  reading_sessions = relationship(
    "ReadingSession", back_populates="paper", cascade="all, delete-orphan"
  )
  user_states = relationship(
    "UserPaperState", back_populates="paper", cascade="all, delete-orphan"
  )
  shares = relationship("PaperShare", back_populates="paper", cascade="all, delete-orphan")
  bookmarks = relationship(
    "Bookmark", back_populates="paper", cascade="all, delete-orphan"
  )
  ai_summary = Column(Text, nullable=True)
  summary_generated_at = Column(DateTime(timezone=True), nullable=True)
  key_findings = Column(JSON, nullable=True)
  findings_extracted_at = Column(DateTime(timezone=True), nullable=True)
  reading_guide = Column(JSON, nullable=True)
  guide_generated_at = Column(DateTime(timezone=True), nullable=True)
