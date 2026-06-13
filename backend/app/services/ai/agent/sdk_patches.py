"""Runtime patches for the openai-agents SDK.

These work around incompatibilities between the SDK's Chat Completions
message construction and stricter OpenAI-compatible providers (notably
DeepSeek).

``filter_empty_assistant_messages``
    When a model returns empty text alongside ``tool_calls`` in one turn,
    the SDK's ``Converter.items_to_messages`` emits a separate, empty
    ``{"role": "assistant", "content": ""}`` message *between* the
    assistant message that carries the ``tool_calls`` and the ``tool``
    result messages. DeepSeek rejects this with::

        400 - An assistant message with 'tool_calls' must be followed by
        tool messages responding to each 'tool_call_id'.

    because the tool_calls message is no longer immediately followed by
    the tool responses. We strip those content-less assistant messages
    (they carry no information) so the required adjacency is preserved.
"""

from __future__ import annotations

from app.core.logger import get_logger

logger = get_logger(__name__)

_PATCHED = False


def _is_empty_assistant(msg: dict) -> bool:
  if msg.get("role") != "assistant":
    return False
  if msg.get("tool_calls") or msg.get("function_call"):
    return False
  content = msg.get("content")
  if content is None:
    return True
  if isinstance(content, str):
    return not content.strip()
  # A list of content parts (rare for assistant) — treat as non-empty.
  return False


def apply_sdk_patches() -> None:
  """Idempotently apply all SDK patches. Safe to call repeatedly."""
  global _PATCHED
  if _PATCHED:
    return

  try:
    from agents.models.chatcmpl_converter import Converter
  except ImportError:
    # SDK not installed — nothing to patch.
    _PATCHED = True
    return

  if getattr(Converter, "_papers_empty_msg_patch", False):
    _PATCHED = True
    return

  original = Converter.items_to_messages.__func__  # unwrap classmethod

  def items_to_messages(cls, *args, **kwargs):
    messages = original(cls, *args, **kwargs)
    try:
      return [m for m in messages if not _is_empty_assistant(m)]
    except Exception:  # noqa: BLE001 — never break message construction
      return messages

  Converter.items_to_messages = classmethod(items_to_messages)
  Converter._papers_empty_msg_patch = True
  _PATCHED = True
  logger.info("Applied openai-agents SDK patches (empty assistant filter)")
