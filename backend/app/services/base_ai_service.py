"""Legacy base class — kept for import compatibility.

Use ``app.services.ai.base_ai_service.BaseAIService`` instead.
"""

import warnings

from app.services.ai.base_ai_service import BaseAIService


class BaseGoogleAIService(BaseAIService):
  """Deprecated. Use ``BaseAIService`` instead."""

  def __init__(self) -> None:
    super().__init__()
    warnings.warn(
      "BaseGoogleAIService is deprecated. Use BaseAIService from "
      "app.services.ai.base_ai_service instead.",
      DeprecationWarning,
      stacklevel=2,
    )
