"""Multi-paper chat models for group/selection-based AI conversations."""

from datetime import datetime, timezone

from sqlalchemy import (
  JSON,
  Column,
  DateTime,
  ForeignKey,
  Integer,
  String,
  Table,
  Text,
)
from sqlalchemy.orm import relationship

from app.models.base import Base

# Junction table for many-to-many between sessions and papers
multi_chat_session_papers = Table(
  "multi_chat_session_papers",
  Base.metadata,
  Column(
    "session_id",
    Integer,
    ForeignKey("multi_chat_sessions.id", ondelete="CASCADE"),
    primary_key=True,
  ),
  Column(
    "paper_id",
    Integer,
    ForeignKey("papers.id", ondelete="CASCADE"),
    primary_key=True,
  ),
)


class MultiChatSession(Base):
  __tablename__ = "multi_chat_sessions"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(
    Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
  )
  name = Column(String, server_default="New Session", nullable=False)
  group_id = Column(
    Integer,
    ForeignKey("groups.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
  )
  created_at = Column(
    DateTime(timezone=True),
    default=lambda: datetime.now(timezone.utc),
    nullable=False,
  )
  updated_at = Column(
    DateTime(timezone=True),
    default=lambda: datetime.now(timezone.utc),
    onupdate=lambda: datetime.now(timezone.utc),
    nullable=False,
  )

  # Relationships
  user = relationship("User", back_populates="multi_chat_sessions")
  group = relationship("Group")
  papers = relationship("Paper", secondary=multi_chat_session_papers)
  messages = relationship(
    "MultiChatMessage",
    back_populates="session",
    cascade="all, delete-orphan",
    order_by="MultiChatMessage.created_at",
  )


class MultiChatMessage(Base):
  __tablename__ = "multi_chat_messages"

  id = Column(Integer, primary_key=True, index=True)
  session_id = Column(
    Integer,
    ForeignKey("multi_chat_sessions.id", ondelete="CASCADE"),
    nullable=False,
    index=True,
  )
  parent_message_id = Column(
    Integer,
    ForeignKey("multi_chat_messages.id", ondelete="CASCADE"),
    nullable=True,
    index=True,
  )
  role = Column(String, nullable=False)
  content = Column(Text, nullable=False)
  references = Column(JSON, default=dict)
  created_at = Column(
    DateTime(timezone=True),
    default=lambda: datetime.now(timezone.utc),
    nullable=False,
  )

  session = relationship("MultiChatSession", back_populates="messages")
  parent_message = relationship(
    "MultiChatMessage",
    remote_side=[id],
    backref="thread_replies",
    foreign_keys=[parent_message_id],
  )
