"""Utility functions for extracting JSON from AI responses."""

import json
import re
from typing import Any


def _strip_markdown(text: str) -> str:
  """Remove markdown code fences (```json ... ``` or ``` ... ```)."""
  if text.startswith("```"):
    nl = text.find("\n")
    if nl != -1:
      text = text[nl + 1 :]
    else:
      text = text[3:]
  if text.endswith("```"):
    text = text[:-3]
  return text.strip()


def _remove_trailing_commas(json_text: str) -> str:
  """Remove trailing commas before ] or } — a common LLM mistake."""
  # Remove comma right before closing bracket/brace
  text = re.sub(r",\s*([}\]])", r"\1", json_text)
  # Remove a bare trailing comma at end of string
  text = re.sub(r",\s*$", "", text)
  return text


def _close_unclosed_structures(text: str) -> str:
  """Append missing closing braces, brackets, and quotes to truncated JSON."""
  # Count open vs closed
  open_braces = text.count("{") - text.count("}")
  open_brackets = text.count("[") - text.count("]")

  # Detect if the text ends mid-string
  in_string = False
  escape = False
  for ch in text:
    if escape:
      escape = False
      continue
    if ch == "\\":
      escape = True
      continue
    if ch == '"':
      in_string = not in_string

  if in_string:
    text += '"'

  # Close arrays before objects (outermost first)
  if open_brackets > 0:
    text += "]" * open_brackets
  if open_braces > 0:
    text += "}" * open_braces

  return text


def _extract_json_block(text: str) -> str | None:
  """Find the first {…} or […] block with balanced brackets."""
  for i, ch in enumerate(text):
    if ch not in ("{", "["):
      continue
    open_ch = ch
    close_ch = "}" if ch == "{" else "]"
    depth = 0
    for j in range(i, len(text)):
      c = text[j]
      if c == open_ch:
        depth += 1
      elif c == close_ch:
        depth -= 1
        if depth == 0:
          return text[i : j + 1]
    # unbalanced — nothing we can extract cleanly
    return None
  return None


def _try_parse_with_repairs(json_text: str) -> Any:
  """Try progressively more aggressive repairs to parse JSON."""
  # 1. Try raw
  try:
    return json.loads(json_text)
  except json.JSONDecodeError:
    pass

  # 2. Remove trailing commas
  fixed = _remove_trailing_commas(json_text)
  if fixed != json_text:
    try:
      return json.loads(fixed)
    except json.JSONDecodeError:
      pass

  # 3. Close unclosed structures (truncated output)
  fixed = _close_unclosed_structures(json_text)
  if fixed != json_text:
    try:
      return json.loads(fixed)
    except json.JSONDecodeError:
      pass

  # 4. Both
  fixed = _close_unclosed_structures(_remove_trailing_commas(json_text))
  if fixed != json_text:
    try:
      return json.loads(fixed)
    except json.JSONDecodeError:
      pass

  raise


def extract_json_from_text(text: str) -> Any:
  """Extract and parse JSON from AI response text.

  Handles:
  - Clean JSON, markdown-wrapped JSON, JSON mixed with prose
  - Trailing commas, unclosed strings/braces (truncated output)

  Returns the parsed value (dict or list).
  Raises ValueError if no valid JSON can be extracted.
  """
  if not text or not text.strip():
    raise ValueError("Text is empty")

  text = text.strip()

  # Strategy A: Whole text is clean JSON
  try:
    return json.loads(text)
  except json.JSONDecodeError:
    pass

  # Strategy B: Strip markdown fences first
  cleaned = _strip_markdown(text)
  if cleaned != text:
    try:
      return _try_parse_with_repairs(cleaned)
    except json.JSONDecodeError:
      pass

  # Strategy C: Extract the JSON block from within prose
  block = _extract_json_block(cleaned)
  if block:
    try:
      return _try_parse_with_repairs(block)
    except json.JSONDecodeError as e:
      raise json.JSONDecodeError(
        f"Failed to parse extracted JSON block. Preview: {block[:200]}",
        block,
        e.pos if hasattr(e, "pos") else 0,
      ) from e

  raise ValueError(f"No valid JSON found in text. First 200 chars: {text[:200]}")
