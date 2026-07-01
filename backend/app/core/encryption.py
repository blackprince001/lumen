"""Symmetric encryption for sensitive data (API keys, etc.).

Uses Fernet (AES-128-CBC) keyed from AI_KEY_ENCRYPTION_KEY when set, with a
JWT_SECRET_KEY-derived key as decrypt-only fallback for legacy values.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, MultiFernet

from app.core.config import settings


def _derive_fernet_key(secret: str) -> bytes:
  """Derive a Fernet-compatible 32-byte key from an arbitrary secret."""
  raw = hashlib.sha256(secret.encode()).digest()
  return base64.urlsafe_b64encode(raw)


def _build_fernet() -> MultiFernet:
  keys = []
  if settings.AI_KEY_ENCRYPTION_KEY:
    keys.append(Fernet(_derive_fernet_key(settings.AI_KEY_ENCRYPTION_KEY)))
  keys.append(Fernet(_derive_fernet_key(settings.JWT_SECRET_KEY)))
  return MultiFernet(keys)


_fernet = _build_fernet()


def encrypt_value(value: str) -> str:
  """Encrypt a plaintext value.

  Args:
      value: Plaintext to encrypt

  Returns:
      URL-safe base64-encoded ciphertext
  """
  return _fernet.encrypt(value.encode()).decode()


def decrypt_value(encrypted: str) -> str:
  """Decrypt a previously encrypted value.

  Args:
      encrypted: Fernet ciphertext (URL-safe base64)

  Returns:
      Decrypted plaintext
  """
  return _fernet.decrypt(encrypted.encode()).decode()
