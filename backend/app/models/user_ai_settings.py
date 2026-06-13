"""User-specific AI provider settings."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.encryption import decrypt_value, encrypt_value


class UserAISettings(Base):
  """Per-user AI provider configuration.

  Each user can configure their preferred AI provider, API key,
  model, and endpoint.  API keys are encrypted at rest.
  """

  __tablename__ = "user_ai_settings"

  id = Column(Integer, primary_key=True, index=True)
  user_id = Column(
    Integer,
    ForeignKey("users.id", ondelete="CASCADE"),
    nullable=False,
    unique=True,
    index=True,
  )
  provider = Column(
    String(50),
    nullable=False,
    default="openai-compatible",
    server_default="openai-compatible",
  )
  _api_key_encrypted = Column("api_key", Text, nullable=True)
  base_url = Column(String(500), nullable=True)
  model = Column(String(100), nullable=False, default="", server_default="")
  is_active = Column(Boolean, nullable=False, default=True, server_default="true")
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

  user = relationship("User", backref="ai_settings")

  def set_api_key(self, api_key: str) -> None:
    """Encrypt and store the API key."""
    self._api_key_encrypted = encrypt_value(api_key) if api_key else None

  def get_api_key(self) -> str:
    """Decrypt and return the API key."""
    if not self._api_key_encrypted:
      return ""
    return decrypt_value(self._api_key_encrypted)

  @property
  def is_configured(self) -> bool:
    """Whether this settings record has enough info to use."""
    return bool(self._api_key_encrypted) and bool(self.provider)
