from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class CitationCanvasItem(Base):
  __tablename__ = "citation_canvas_items"
  __table_args__ = (
    UniqueConstraint("user_id", "paper_id", name="uq_canvas_user_paper"),
  )

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(
    Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
  )
  paper_id = Column(
    Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False
  )
  x = Column(Float, nullable=False)
  y = Column(Float, nullable=False)
  created_at = Column(
    DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
  )
  updated_at = Column(
    DateTime(timezone=True),
    default=lambda: datetime.now(timezone.utc),
    onupdate=lambda: datetime.now(timezone.utc),
    nullable=False,
  )

  user = relationship("User", back_populates="canvas_items")
  paper = relationship("Paper")
