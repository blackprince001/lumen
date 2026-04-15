from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class RefreshToken(Base):
  __tablename__ = "refresh_tokens"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(
    Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
  )
  token_hash = Column(String(255), unique=True, nullable=False, index=True)
  expires_at = Column(DateTime(timezone=True), nullable=False)
  created_at = Column(
    DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
  )
  revoked_at = Column(DateTime(timezone=True), nullable=True)

  user = relationship("User", back_populates="refresh_tokens")
